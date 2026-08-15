/**
 * Descubrimiento de imágenes candidatas en HTML (Fase 2 — Paso 1).
 * No altera el flujo de extracción de redes sociales ni Fase 1 del frontend.
 */

import { loadHtml } from './opengraph.js';
import { rankImageCandidates } from './image-score.js';
import { enrichCandidatesWithDimensions } from './image-dims.js';
import { fetchPageViaProvider, getProviderStatus } from '../providers/index.js';
import { fetchWithTimeout } from '../fetch-timeout.js';

const MAX_CANDIDATES = 20;
/** Límite de sondas de cabecera de imagen (bytes parciales, no descarga completa). */
const MAX_DIM_PROBES = 12;
const DIM_PROBE_CONCURRENCY = 4;

function absUrl(base, maybeRelative) {
  if (!maybeRelative) return '';
  try {
    return new URL(maybeRelative, base).href;
  } catch (_) {
    return '';
  }
}

function parseSrcsetBest(srcset, pageUrl) {
  if (!srcset) return '';
  let bestUrl = '';
  let bestScore = -1;
  for (const part of String(srcset).split(',')) {
    const bits = part.trim().split(/\s+/);
    const u = bits[0];
    if (!u) continue;
    const desc = bits[1] || '';
    const w = /(\d+)w/i.exec(desc);
    const x = /(\d+(?:\.\d+)?)x/i.exec(desc);
    const score = w ? Number(w[1]) : x ? Number(x[1]) * 1000 : 1;
    if (score >= bestScore) {
      bestScore = score;
      bestUrl = absUrl(pageUrl, u);
    }
  }
  return bestUrl;
}

function pushCandidate(map, candidate) {
  const url = String(candidate.url || '').trim();
  if (!url || !/^https?:\/\//i.test(url)) return;
  if (/^data:/i.test(url)) return;
  const key = url.split('#')[0];
  const prev = map.get(key);
  if (!prev) {
    map.set(key, { ...candidate, url: key });
    return;
  }
  // Conservar el de mejor señal (main/hero/meta > genérico)
  const rank = (c) => {
    let r = 0;
    if (c.inMain) r += 3;
    if (String(c.source || '').includes('og') || c.source === 'twitter-image' || c.source === 'json-ld') {
      r += 2;
    }
    if (c.width && c.height) r += 1;
    return r;
  };
  if (rank(candidate) > rank(prev)) {
    map.set(key, { ...prev, ...candidate, url: key });
  }
}

function collectFromMeta($, pageUrl, map) {
  const ogImages = [];
  $('meta[property="og:image"], meta[property="og:image:url"]').each((_, el) => {
    const content = $(el).attr('content');
    const url = absUrl(pageUrl, content);
    if (url) ogImages.push(url);
  });
  const ogWidth = Number($('meta[property="og:image:width"]').attr('content')) || undefined;
  const ogHeight = Number($('meta[property="og:image:height"]').attr('content')) || undefined;

  ogImages.forEach((url, i) => {
    pushCandidate(map, {
      url,
      source: i === 0 ? 'og:image' : 'og:image-extra',
      positionIndex: i,
      width: i === 0 ? ogWidth : undefined,
      height: i === 0 ? ogHeight : undefined,
      dimsSource: i === 0 && ogWidth && ogHeight ? 'og-meta' : undefined,
    });
  });

  $('meta[name="twitter:image"], meta[name="twitter:image:src"], meta[property="twitter:image"]').each(
    (_, el) => {
      const url = absUrl(pageUrl, $(el).attr('content'));
      pushCandidate(map, { url, source: 'twitter-image' });
    }
  );

  $('link[rel="image_src"]').each((_, el) => {
    const url = absUrl(pageUrl, $(el).attr('href'));
    pushCandidate(map, { url, source: 'link-image_src' });
  });
}

function collectFromJsonLd($, pageUrl, map) {
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).contents().text();
    if (!raw || !raw.trim()) return;
    let data;
    try {
      data = JSON.parse(raw);
    } catch (_) {
      return;
    }
    const nodes = Array.isArray(data) ? data : [data];
    const visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(visit);
        return;
      }
      const img = node.image || node.primaryImageOfPage || node.thumbnailUrl;
      const pushImg = (value) => {
        if (!value) return;
        if (typeof value === 'string') {
          pushCandidate(map, { url: absUrl(pageUrl, value), source: 'json-ld' });
        } else if (Array.isArray(value)) {
          value.forEach(pushImg);
        } else if (typeof value === 'object') {
          const u = value.url || value.contentUrl || value['@id'];
          if (u) pushCandidate(map, { url: absUrl(pageUrl, u), source: 'json-ld' });
        }
      };
      pushImg(img);
      if (node['@graph']) visit(node['@graph']);
    };
    nodes.forEach(visit);
  });
}

function isInMainContext($, el) {
  const node = $(el);
  if (node.closest('main, [role="main"], .hero, .banner, .jumbotron, header.hero').length) {
    return true;
  }
  // Evitar nav/footer/aside genéricos
  if (node.closest('nav, footer, aside, .navbar, .menu, .cookie').length) {
    return false;
  }
  return false;
}

function collectFromImgs($, pageUrl, map) {
  let mainIndex = 0;
  let globalIndex = 0;

  $('img').each((_, el) => {
    if (map.size >= MAX_CANDIDATES) return false;
    const node = $(el);
    const src =
      parseSrcsetBest(node.attr('srcset'), pageUrl) ||
      absUrl(pageUrl, node.attr('src')) ||
      absUrl(pageUrl, node.attr('data-src')) ||
      absUrl(pageUrl, node.attr('data-lazy-src')) ||
      absUrl(pageUrl, node.attr('data-original'));

    if (!src) return;
    const width = Number(node.attr('width')) || undefined;
    const height = Number(node.attr('height')) || undefined;
    const alt = (node.attr('alt') || '').trim();
    const inMain = isInMainContext($, el);
    const source = inMain
      ? node.closest('.hero, .banner, .jumbotron').length
        ? 'img-hero'
        : 'img-main'
      : 'img';

    pushCandidate(map, {
      url: src,
      source,
      width,
      height,
      alt,
      inMain,
      positionIndex: inMain ? mainIndex++ : globalIndex,
      dimsSource: width && height ? 'html-attr' : undefined,
    });
    globalIndex += 1;
  });
}

/**
 * Extrae candidatos del HTML, enriquece dimensiones (sonda limitada) y puntúa.
 * @param {string} html
 * @param {string} pageUrl
 * @param {{ logoUrl?: string, minScore?: number }} [options]
 */
export async function collectPageImageCandidates(html, pageUrl, options = {}) {
  const $ = loadHtml(html || '');
  const map = new Map();

  collectFromMeta($, pageUrl, map);
  collectFromJsonLd($, pageUrl, map);
  collectFromImgs($, pageUrl, map);

  // Logo de referencia (favicon) para penalizar coincidencias
  let logoUrl = options.logoUrl || '';
  if (!logoUrl) {
    const iconHref =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      $('link[rel="apple-touch-icon"]').attr('href');
    logoUrl = absUrl(pageUrl, iconHref);
  }

  const list = Array.from(map.values()).slice(0, MAX_CANDIDATES);
  const dims = await enrichCandidatesWithDimensions(list, {
    maxProbes: MAX_DIM_PROBES,
    concurrency: DIM_PROBE_CONCURRENCY,
  });

  const { ranked, best, minScore } = rankImageCandidates(dims.list, {
    logoUrl,
    minScore: options.minScore,
  });

  return {
    pageUrl,
    logoUrl: logoUrl || '',
    minScore,
    best,
    candidates: ranked,
    count: ranked.length,
    dimsProbed: dims.probed,
    dimsProbedOk: dims.probedOk,
  };
}

/**
 * Fetch HTML: primero fetch nativo; si falla, proveedores de scraping configurados.
 * @param {string} pageUrl
 */
export async function fetchHtmlForPageImages(pageUrl) {
  const errors = [];

  try {
    const res = await fetchWithTimeout(pageUrl, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 200) {
        return { html, provider: 'direct-fetch', finalUrl: res.url || pageUrl };
      }
      errors.push(`direct-fetch cuerpo demasiado corto (${html?.length || 0})`);
    } else {
      errors.push(`direct-fetch HTTP ${res.status}`);
    }
  } catch (e) {
    errors.push(`direct-fetch: ${e.message || e}`);
  }

  const status = getProviderStatus();
  if (status.scrapingbee || status.zenrows || status.puppeteer) {
    try {
      const scraped = await fetchPageViaProvider(pageUrl, { preferScreenshot: false });
      if (scraped?.html) {
        return {
          html: scraped.html,
          provider: scraped.provider || 'scrape-provider',
          finalUrl: pageUrl,
        };
      }
      errors.push('scrape-provider: HTML vacío');
    } catch (e) {
      errors.push(`scrape-provider: ${e.message || e}`);
    }
  } else {
    errors.push('sin proveedores de scraping configurados para fallback');
  }

  const err = new Error(`No se pudo obtener HTML: ${errors.join(' | ')}`);
  err.code = 'HTML_FETCH_FAILED';
  err.details = errors;
  throw err;
}

/**
 * Pipeline completo para el endpoint /api/page-images.
 * @param {string} pageUrl
 */
export async function analyzePageImages(pageUrl) {
  let normalized;
  try {
    normalized = new URL(pageUrl).href;
  } catch (_) {
    return { status: 'fail', message: 'URL inválida', code: 'INVALID_URL' };
  }

  try {
    const fetched = await fetchHtmlForPageImages(normalized);
    const analysis = await collectPageImageCandidates(
      fetched.html,
      fetched.finalUrl || normalized
    );
    return {
      status: 'success',
      data: {
        url: fetched.finalUrl || normalized,
        provider: fetched.provider,
        logoUrl: analysis.logoUrl,
        minScore: analysis.minScore,
        best: analysis.best,
        candidates: analysis.candidates,
        count: analysis.count,
        dimsProbed: analysis.dimsProbed,
        dimsProbedOk: analysis.dimsProbedOk,
      },
    };
  } catch (err) {
    return {
      status: 'fail',
      message: err.message || 'Error al analizar imágenes',
      code: err.code || 'PAGE_IMAGES_ERROR',
      details: err.details || undefined,
    };
  }
}
