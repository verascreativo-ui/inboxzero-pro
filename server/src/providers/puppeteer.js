/**
 * Puppeteer en modo stealth (local).
 * Requiere: npm i puppeteer puppeteer-extra puppeteer-extra-plugin-stealth
 * Estructura lista; solo se activa si los paquetes están instalados.
 */

import { assertSafeHttpUrl } from '../ssrf-guard.js';

export function isPuppeteerConfigured() {
  // Activo si SCRAPE_PROVIDER=puppeteer o si no hay APIs cloud y se fuerza auto local
  return process.env.SCRAPE_PROVIDER === 'puppeteer' || process.env.ENABLE_PUPPETEER === '1';
}

async function loadStealthBrowser() {
  try {
    const puppeteerExtra = (await import('puppeteer-extra')).default;
    const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
    puppeteerExtra.use(StealthPlugin());
    return puppeteerExtra;
  } catch (_) {
    try {
      return (await import('puppeteer')).default;
    } catch (err) {
      const e = new Error(
        'Puppeteer no está instalado. Ejecuta: npm i puppeteer puppeteer-extra puppeteer-extra-plugin-stealth'
      );
      e.code = 'PROVIDER_NOT_CONFIGURED';
      throw e;
    }
  }
}

/**
 * Navegador headless stealth: HTML + screenshot recortado zona superior.
 * @param {string} targetUrl
 */
export async function fetchWithPuppeteerStealth(targetUrl) {
  const safe = await assertSafeHttpUrl(targetUrl);
  const safeUrl = safe.href;
  if (!isPuppeteerConfigured() && process.env.SCRAPE_PROVIDER !== 'auto') {
    const err = new Error('Puppeteer desactivado (ENABLE_PUPPETEER=1 o SCRAPE_PROVIDER=puppeteer)');
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }

  const puppeteer = await loadStealthBrowser();
  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1280,900',
    ],
    defaultViewport: { width: 1280, height: 900 },
  });

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', async (req) => {
      try {
        await assertSafeHttpUrl(req.url());
        await req.continue();
      } catch (_) {
        await req.abort('blockedbyclient');
      }
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    });

    await page.goto(safeUrl, { waitUntil: 'networkidle2', timeout: 45000 });
    // Esperar posibles h1 de grupo / feed
    await page.waitForSelector('h1, [role="main"], meta[property="og:title"]', { timeout: 8000 }).catch(() => {});

    const html = await page.content();

    // Screenshot recortado zona superior (banner / cover)
    const shotBuf = await page.screenshot({
      type: 'jpeg',
      quality: 82,
      clip: { x: 0, y: 0, width: 1280, height: 520 },
    });

    return {
      html,
      screenshotDataUrl: `data:image/jpeg;base64,${Buffer.from(shotBuf).toString('base64')}`,
      provider: 'puppeteer',
    };
  } finally {
    await browser.close().catch(() => {});
  }
}
