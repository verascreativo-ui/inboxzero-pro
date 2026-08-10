import { fetchHtmlAndScreenshotScrapingBee, isScrapingBeeConfigured } from './scrapingbee.js';
import { fetchWithZenRows, isZenRowsConfigured } from './zenrows.js';
import { fetchWithPuppeteerStealth, isPuppeteerConfigured } from './puppeteer.js';

/**
 * Obtiene HTML (y screenshot si aplica) con el proveedor configurado.
 * Orden auto: ScrapingBee → ZenRows → Puppeteer stealth.
 */
export async function fetchPageViaProvider(targetUrl, { preferScreenshot = true } = {}) {
  const mode = (process.env.SCRAPE_PROVIDER || 'auto').toLowerCase();
  const errors = [];

  const tryScrapingBee = async () => {
    if (!isScrapingBeeConfigured()) {
      const err = new Error('ScrapingBee no configurado');
      err.code = 'PROVIDER_NOT_CONFIGURED';
      throw err;
    }
    return preferScreenshot
      ? fetchHtmlAndScreenshotScrapingBee(targetUrl)
      : fetchHtmlAndScreenshotScrapingBee(targetUrl);
  };

  const tryZenRows = async () => {
    if (!isZenRowsConfigured()) {
      const err = new Error('ZenRows no configurado');
      err.code = 'PROVIDER_NOT_CONFIGURED';
      throw err;
    }
    const htmlResult = await fetchWithZenRows(targetUrl, { screenshot: false });
    let screenshotDataUrl = htmlResult.screenshotDataUrl;
    if (preferScreenshot && !screenshotDataUrl) {
      try {
        const shot = await fetchWithZenRows(targetUrl, { screenshot: true });
        screenshotDataUrl = shot.screenshotDataUrl;
      } catch (_) {
        /* opcional */
      }
    }
    return {
      html: htmlResult.html,
      screenshotDataUrl,
      provider: 'zenrows',
    };
  };

  const tryPuppeteer = async () => {
    return fetchWithPuppeteerStealth(targetUrl);
  };

  const chain =
    mode === 'scrapingbee'
      ? [tryScrapingBee]
      : mode === 'zenrows'
        ? [tryZenRows]
        : mode === 'puppeteer'
          ? [tryPuppeteer]
          : [
              ...(isScrapingBeeConfigured() ? [tryScrapingBee] : []),
              ...(isZenRowsConfigured() ? [tryZenRows] : []),
              ...(isPuppeteerConfigured() || process.env.ENABLE_PUPPETEER === '1' ? [tryPuppeteer] : []),
            ];

  if (!chain.length) {
    const err = new Error(
      'Ningún proveedor de scraping configurado. Añade SCRAPINGBEE_API_KEY o ZENROWS_API_KEY en server/.env (ver .env.example).'
    );
    err.code = 'NO_PROVIDER';
    throw err;
  }

  for (const run of chain) {
    try {
      return await run();
    } catch (e) {
      errors.push(e.message || String(e));
      if (e.code === 'PROVIDER_NOT_CONFIGURED') continue;
      // Si falla la red/HTTP, probar siguiente proveedor
      continue;
    }
  }

  const err = new Error(`Todos los proveedores fallaron: ${errors.join(' | ')}`);
  err.code = 'ALL_PROVIDERS_FAILED';
  err.details = errors;
  throw err;
}

export function getProviderStatus() {
  return {
    scrapeProvider: process.env.SCRAPE_PROVIDER || 'auto',
    scrapingbee: isScrapingBeeConfigured(),
    zenrows: isZenRowsConfigured(),
    puppeteer: isPuppeteerConfigured() || process.env.ENABLE_PUPPETEER === '1',
  };
}
