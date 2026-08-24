/**
 * ZenRows: premium proxy + JS render + screenshot.
 * Docs: https://docs.zenrows.com/
 */

import { fetchWithTimeout } from '../fetch-timeout.js';

function requireKey() {
  const key = process.env.ZENROWS_API_KEY?.trim();
  if (!key) {
    const err = new Error('ZENROWS_API_KEY no configurada');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }
  return key;
}

export function isZenRowsConfigured() {
  return Boolean(process.env.ZENROWS_API_KEY?.trim());
}

/**
 * @param {string} targetUrl
 * @param {{ screenshot?: boolean }} [opts]
 */
export async function fetchWithZenRows(targetUrl, opts = {}) {
  const apiKey = requireKey();
  const isFacebook = /facebook\.com|fb\.com|fb\.watch/i.test(targetUrl);
  const params = new URLSearchParams({
    apikey: apiKey,
    url: targetUrl,
    js_render: 'true',
    premium_proxy: 'true',
    proxy_country: process.env.PROXY_COUNTRY || 'es',
  });

  if (isFacebook) {
    params.set('wait', '5000');
  }

  if (opts.screenshot) {
    params.set('screenshot', 'true');
  }

  const endpoint = `https://api.zenrows.com/v1/?${params.toString()}`;
  const res = await fetchWithTimeout(endpoint);

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    const err = new Error(`ZenRows HTTP ${res.status}: ${body.slice(0, 200)}`);
    err.code = 'PROVIDER_HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const contentType = res.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const data = await res.json();
    const html = data.html || data.content || '';
    let screenshotDataUrl;
    if (data.screenshot) {
      screenshotDataUrl = String(data.screenshot).startsWith('data:')
        ? data.screenshot
        : `data:image/png;base64,${data.screenshot}`;
    }
    return { html, screenshotDataUrl, provider: 'zenrows' };
  }

  if (opts.screenshot && contentType.includes('image')) {
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      html: '',
      screenshotDataUrl: `data:${contentType.split(';')[0]};base64,${buf.toString('base64')}`,
      provider: 'zenrows',
    };
  }

  const html = await res.text();
  return { html, provider: 'zenrows' };
}
