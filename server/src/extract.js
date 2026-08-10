import { fetchPageViaProvider } from './providers/index.js';
import { detectPlatform, parseScrapedPage } from './parse/social.js';

/**
 * Extracción avanzada de metadatos para redes con muro de login.
 * Devuelve objeto listo para el frontend / modal.
 *
 * @param {string} pageUrl
 * @returns {Promise<{
 *   status: 'success'|'fail',
 *   data?: { title: string, description: string, image: string, url: string, platform: string, provider: string },
 *   message?: string
 * }>}
 */
export async function extractAdvancedMetadata(pageUrl) {
  let normalized;
  try {
    normalized = new URL(pageUrl).href;
  } catch (_) {
    return { status: 'fail', message: 'URL inválida' };
  }

  const platform = detectPlatform(normalized);
  const needsStealth = ['facebook', 'instagram', 'linkedin'].includes(platform);

  try {
    const scraped = await fetchPageViaProvider(normalized, {
      // Facebook: priorizar HTML (h1 / Foto de portada); screenshot solo si no hay cover
      preferScreenshot: needsStealth,
    });

    const parsed = parseScrapedPage(
      scraped.html || '',
      normalized,
      scraped.screenshotDataUrl
    );

    // Redes: screenshot solo si no hay imagen real (evitar muro de login en FB)
    if (!parsed.image && scraped.screenshotDataUrl && !parsed.generic) {
      parsed.image = scraped.screenshotDataUrl;
    }
    if (
      platform === 'facebook' &&
      !parsed.image &&
      scraped.screenshotDataUrl &&
      parsed.authentic &&
      parsed.title
    ) {
      parsed.image = scraped.screenshotDataUrl;
    }

    // Si solo hay screenshot (HTML vacío por respuesta binaria), rellenar mínimo
    if (!parsed.title && !parsed.image && scraped.screenshotDataUrl) {
      parsed.image = scraped.screenshotDataUrl;
      parsed.title = platform === 'facebook' ? 'Contenido de Facebook' : normalized;
    }

    if (!parsed.title && !parsed.description && !parsed.image) {
      return {
        status: 'fail',
        message: 'No se pudieron extraer metadatos reales de la página',
        data: {
          title: '',
          description: '',
          image: scraped.screenshotDataUrl || '',
          url: normalized,
          platform,
          provider: scraped.provider,
        },
      };
    }

    const safeScreenshot =
      scraped.screenshotDataUrl &&
      (platform !== 'facebook' || (parsed.authentic && parsed.title && !parsed.generic))
        ? scraped.screenshotDataUrl
        : '';

    return {
      status: 'success',
      data: {
        title: parsed.title || '',
        description: parsed.description || '',
        image: parsed.image || safeScreenshot || '',
        url: parsed.url || normalized,
        platform: parsed.platform || platform,
        provider: scraped.provider,
        generic: Boolean(parsed.generic),
        authentic: Boolean(parsed.authentic),
      },
    };
  } catch (err) {
    return {
      status: 'fail',
      message: err.message || 'Error de extracción',
      code: err.code || 'EXTRACT_ERROR',
    };
  }
}
