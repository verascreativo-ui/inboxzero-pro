/**
 * ScrapingBee: proxy residencial + render JS + screenshot bajo demanda.
 * Docs: https://www.scrapingbee.com/documentation/
 */

import { fetchWithTimeout } from '../fetch-timeout.js';

/** Chrome de escritorio moderno — evita que Facebook sirva el muro de login móvil/bot */
const CHROME_DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function requireKey() {
  const key =
    process.env.SCRAPINGBEE_API_KEY?.trim() ||
    process.env.SCRAPE_API_KEY?.trim();
  if (!key) {
    const err = new Error('SCRAPINGBEE_API_KEY / SCRAPE_API_KEY no configurada');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }
  return key;
}

export function isScrapingBeeConfigured() {
  return Boolean(
    process.env.SCRAPINGBEE_API_KEY?.trim() || process.env.SCRAPE_API_KEY?.trim()
  );
}

function buildScrapingBeeParams(targetUrl, opts = {}) {
  const apiKey = requireKey();
  const country = (process.env.PROXY_COUNTRY || 'es').toLowerCase();
  const isFacebook = /facebook\.com|fb\.com|fb\.watch/i.test(targetUrl) || opts.facebook;

  const params = new URLSearchParams({
    api_key: apiKey,
    url: targetUrl,
    render_js: 'true',
    premium_proxy: 'true',
    country_code: country,
    block_resources: 'false',
    device: 'desktop',
    // Reenvía Spb-* como cabeceras reales al destino (User-Agent Chrome)
    forward_headers: 'true',
  });

  if (isFacebook) {
    params.set('wait', '10000');
    params.set('window_width', '1440');
    params.set('window_height', '900');
    params.set('stealth_proxy', 'true');
    if (!opts.screenshot) {
      // Esperar al h1 de la página pública (ej. "Las Recetas de MJ")
      params.set('wait_for', 'h1');
    }
  } else {
    params.set('wait', '3000');
  }

  if (opts.screenshot) {
    params.set('screenshot', 'true');
    params.set('screenshot_full_page', 'false');
    params.set('window_width', params.get('window_width') || '1280');
    params.set('window_height', params.get('window_height') || '720');
  }

  return params;
}

function scrapingBeeForwardHeaders() {
  return {
    'Spb-User-Agent': CHROME_DESKTOP_UA,
    'Spb-Accept-Language': 'es-ES,es;q=0.9,en-US;q=0.8,en;q=0.7',
    'Spb-Accept':
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Spb-Upgrade-Insecure-Requests': '1',
    'Spb-Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
    'Spb-Sec-Ch-Ua-Mobile': '?0',
    'Spb-Sec-Ch-Ua-Platform': '"Windows"',
  };
}

/**
 * @param {string} targetUrl
 * @param {{ screenshot?: boolean, facebook?: boolean }} [opts]
 */
export async function fetchWithScrapingBee(targetUrl, opts = {}) {
  const params = buildScrapingBeeParams(targetUrl, opts);
  const endpoint = `https://app.scrapingbee.com/api/v1/?${params.toString()}`;

  const res = await fetchWithTimeout(endpoint, {
    headers: {
      Accept: opts.screenshot ? '*/*' : 'text/html,application/xhtml+xml',
      ...scrapingBeeForwardHeaders(),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`ScrapingBee HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.code = 'PROVIDER_HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';
  if (opts.screenshot && contentType.includes('image')) {
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      html: '',
      screenshotDataUrl: `data:${contentType.split(';')[0]};base64,${buf.toString('base64')}`,
      provider: 'scrapingbee',
    };
  }

  if (opts.screenshot && contentType.includes('application/json')) {
    const data = await res.json();
    const shot = data.screenshot || data.image;
    if (shot) {
      const screenshotDataUrl = String(shot).startsWith('data:')
        ? shot
        : `data:image/png;base64,${shot}`;
      return {
        html: data.html || data.content || '',
        screenshotDataUrl,
        provider: 'scrapingbee',
      };
    }
  }

  const html = await res.text();
  return { html, provider: 'scrapingbee' };
}

/**
 * 1) HTML con render_js + proxy + Chrome UA
 * 2) Si no hay cover/og:image usable, screenshot opcional
 */
export async function fetchHtmlAndScreenshotScrapingBee(targetUrl, options = {}) {
  const forceScreenshot = Boolean(options.forceScreenshot);
  const isFacebook = /facebook\.com|fb\.com|fb\.watch/i.test(targetUrl);
  const htmlResult = await fetchWithScrapingBee(targetUrl, {
    screenshot: false,
    facebook: isFacebook,
  });

  const html = htmlResult.html || '';
  const hasCoverSignal =
    /property=["']og:image["'][^>]*content=["']https?:\/\//i.test(html) ||
    /content=["']https?:\/\/[^"']+["'][^>]*property=["']og:image["']/i.test(html) ||
    /alt=["']Foto de portada["']/i.test(html) ||
    /alt=["']Cover photo["']/i.test(html) ||
    /profileCoverPhoto|coverPhoto|scontent[^"']*fbcdn/i.test(html);

  let screenshotDataUrl = htmlResult.screenshotDataUrl;

  // En Facebook solo pedir screenshot si no hay señales de portada real
  if (forceScreenshot || !hasCoverSignal) {
    try {
      const shot = await fetchWithScrapingBee(targetUrl, {
        screenshot: true,
        facebook: isFacebook,
      });
      screenshotDataUrl = shot.screenshotDataUrl || screenshotDataUrl;
    } catch (_) {
      /* screenshot opcional si el plan no lo incluye */
    }
  }

  return {
    html,
    screenshotDataUrl,
    provider: 'scrapingbee',
    usedScreenshotFallback: Boolean(screenshotDataUrl && !hasCoverSignal),
  };
}
