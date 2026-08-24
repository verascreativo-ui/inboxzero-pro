import { extractOpenGraph, loadHtml } from './opengraph.js';

const GENERIC_TITLE_RE =
  /^(facebook|facebook\s*[-–|]\s*log\s*in|log\s*in\s*to\s*facebook|meta)$/i;
const GENERIC_DESC_RE =
  /explore the things you love|connect with friends|facebook helps you|log into facebook|crea una cuenta o inicia sesión|see photos and updates/i;

function isGeneric(title, description) {
  const t = String(title || '').trim();
  const d = String(description || '').trim();
  if (!t && !d) return true;
  if (GENERIC_TITLE_RE.test(t)) return true;
  if (d && GENERIC_DESC_RE.test(d)) return true;
  if (/explore the things you love/i.test(t)) return true;
  return false;
}

function absUrl(base, maybeRelative) {
  if (!maybeRelative) return '';
  try {
    return new URL(maybeRelative, base).href;
  } catch (_) {
    return maybeRelative;
  }
}

function cleanText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Logo oficial Wikimedia para contingencia (nunca Unsplash / YouTube). */
export const FACEBOOK_CONTINGENCY_LOGO =
  'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg';

function isUsableCoverUrl(src) {
  if (!src || !/^https?:\/\//i.test(src)) return false;
  if (/emoji|static\.xx|rsrc\.php|safe_image\.php/i.test(src)) return false;
  if (/facebook\.com\/images\/fb_icon|fbcdn\.net\/.*\/logo/i.test(src)) return false;
  // Prohibido: miniaturas YouTube / Unsplash (contaminación de marca)
  if (/ytimg\.com|youtube\.com|youtu\.be/i.test(src)) return false;
  if (/unsplash\.com/i.test(src)) return false;
  return true;
}

/**
 * Título real de página/grupo: h1 principal (ej. "Las Recetas de MJ").
 */
function extractFacebookTitle($) {
  const h1Candidates = [
    'h1[dir="auto"]',
    'h1 span[dir="auto"]',
    '[role="main"] h1',
    '[data-pagelet*="ProfileTilesFeed"] h1',
    '[data-pagelet*="ProfileActions"] h1',
    '[data-pagelet*="Group"] h1',
    'div[role="main"] span[dir="auto"] > h1',
    'h1',
    'a[href*="/groups/"][role="link"] span[dir="auto"]',
    'a[href*="/groups/"] strong',
  ];

  for (const sel of h1Candidates) {
    const nodes = $(sel).toArray();
    for (const node of nodes) {
      const el = $(node);
      const text = cleanText(el.text());
      if (!text || text.length < 2) continue;
      if (GENERIC_TITLE_RE.test(text)) continue;
      if (/^(facebook|inicio|home|groups|grupos|pages|páginas)$/i.test(text)) continue;
      if (/^(unirse|join|invitar|invite|compartir|share|seguir|follow|me gusta|like)$/i.test(text)) {
        continue;
      }
      return text;
    }
  }
  return '';
}

/**
 * Descripción real: bloque de información / Detalles / Intro de la página.
 */
function extractFacebookDescription($, pageTitle) {
  const title = cleanText(pageTitle);

  const prioritized = [
    '[data-pagelet*="ProfileTilesFeed"] [data-ad-comet-preview="message"]',
    '[data-pagelet*="ProfileTilesFeed"] span[dir="auto"]',
    '[data-pagelet*="ProfileAppSection"] span[dir="auto"]',
    '[data-pagelet*="About"] span[dir="auto"]',
    '[data-pagelet*="GroupAbout"] span[dir="auto"]',
    'div[role="main"] div[data-ad-preview="message"]',
    'meta[property="og:description"]',
    'meta[name="description"]',
  ];

  for (const sel of prioritized) {
    if (sel.startsWith('meta')) {
      const v = cleanText($(sel).attr('content'));
      if (v && !GENERIC_DESC_RE.test(v) && v !== title) return v.slice(0, 400);
      continue;
    }
    const nodes = $(sel).toArray();
    for (const node of nodes) {
      const text = cleanText($(node).text());
      if (!text || text.length < 24) continue;
      if (GENERIC_DESC_RE.test(text)) continue;
      if (title && text === title) continue;
      if (/^(detalles|details|información|about|intro|más información)$/i.test(text)) continue;
      if (/^(me gusta|seguidores|followers|likes|publicaciones)$/i.test(text)) continue;
      return text.slice(0, 400);
    }
  }

  // Heurística: span largo bajo main (texto de Intro / Detalles)
  let best = '';
  $('div[role="main"] span[dir="auto"]').each((_, node) => {
    const text = cleanText($(node).text());
    if (!text || text.length < 40 || text.length > 480) return;
    if (GENERIC_DESC_RE.test(text)) return;
    if (title && (text === title || text.startsWith(title))) return;
    if (/^(me gusta|seguidores|followers|likes)/i.test(text)) return;
    if (text.length > best.length) best = text;
  });
  return best.slice(0, 400);
}

/**
 * Imagen real: alt="Foto de portada" → foto de perfil → cover/og conocidos.
 */
function extractFacebookCover($, pageUrl) {
  const coverSelectors = [
    'img[alt="Foto de portada"]',
    'img[alt="Cover photo"]',
    'img[alt*="Foto de portada" i]',
    'img[alt*="Cover photo" i]',
    'img[alt*="portada" i]',
    'img[data-imgperflogname="profileCoverPhoto"]',
    'img[data-imgperflogname="coverPhoto"]',
    '[data-pagelet*="CoverPhoto"] img',
    '[data-pagelet*="ProfileCover"] img',
    '[aria-label*="Foto de portada" i] img',
    '[aria-label*="Cover photo" i] img',
  ];

  for (const sel of coverSelectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const src =
      el.attr('src') ||
      el.attr('xlink:href') ||
      el.attr('href') ||
      el.attr('data-src');
    if (src && isUsableCoverUrl(src)) return absUrl(pageUrl, src);
  }

  // Foto de perfil redonda (fallback)
  const profileSelectors = [
    'img[alt*="foto del perfil" i]',
    'img[alt*="profile picture" i]',
    'img[alt*="Profile picture" i]',
    'image[preserveAspectRatio="xMidYMid slice"]',
    '[data-pagelet*="ProfilePhoto"] img',
    '[data-pagelet*="ProfilePhoto"] image',
    'svg image[preserveAspectRatio]',
  ];

  for (const sel of profileSelectors) {
    const el = $(sel).first();
    if (!el.length) continue;
    const src =
      el.attr('src') ||
      el.attr('xlink:href') ||
      el.attr('href') ||
      el.attr('data-src');
    if (src && isUsableCoverUrl(src)) return absUrl(pageUrl, src);
  }

  // Open Graph / twitter
  for (const sel of [
    'meta[property="og:image"]',
    'meta[property="og:image:url"]',
    'meta[name="twitter:image"]',
  ]) {
    const v = $(sel).attr('content');
    if (v && isUsableCoverUrl(v)) return absUrl(pageUrl, v);
  }

  // background-image
  let found = '';
  $('[style*="background-image"]').each((_, node) => {
    if (found) return;
    const style = $(node).attr('style') || '';
    const m = style.match(/url\(["']?([^"')]+)["']?\)/i);
    if (m?.[1] && isUsableCoverUrl(m[1])) found = absUrl(pageUrl, m[1]);
  });
  if (found) return found;

  // Mejor candidata scontent/fbcdn
  let best = '';
  let bestScore = 0;
  $('img[src*="scontent"], img[src*="fbcdn"], image[xlink\\:href*="scontent"], image[href*="scontent"]').each(
    (_, node) => {
      const el = $(node);
      const src = el.attr('src') || el.attr('xlink:href') || el.attr('href') || '';
      if (!isUsableCoverUrl(src)) return;
      const w = Number(el.attr('width')) || 0;
      const h = Number(el.attr('height')) || 0;
      const score = w * h || (src.includes('scontent') ? 1000 : 1);
      if (score >= bestScore) {
        bestScore = score;
        best = absUrl(pageUrl, src);
      }
    }
  );
  return best;
}

/**
 * Selectores de páginas/grupos públicos de Facebook.
 * Los datos reales (h1, Detalles, Foto de portada) pisan Open Graph genérico.
 */
export function extractFacebookGroupMeta(html, pageUrl, screenshotDataUrl) {
  const $ = loadHtml(html);
  const og = extractOpenGraph($, pageUrl);

  let title = og.title;
  let description = og.description;
  let image = og.image && isUsableCoverUrl(og.image) ? og.image : '';

  const h1Title = extractFacebookTitle($);
  // El h1 de la página pública es la fuente de verdad del nombre
  if (h1Title) {
    title = h1Title;
  }

  const pageDesc = extractFacebookDescription($, title);
  if (pageDesc && (!description || isGeneric(title, description) || GENERIC_DESC_RE.test(description))) {
    description = pageDesc;
  } else if (pageDesc && pageDesc.length > String(description || '').length) {
    description = pageDesc;
  }

  const cover = extractFacebookCover($, pageUrl);
  if (cover) image = cover;

  if (!image && screenshotDataUrl && !isGeneric(title, description)) {
    // Solo screenshot si ya hay título real (evitar capturar muro de login)
    if (!/ytimg\.com|unsplash\.com/i.test(screenshotDataUrl)) {
      image = screenshotDataUrl;
    }
  }

  const hasRealCover = Boolean(image && isUsableCoverUrl(image));
  const hasRealTitle = Boolean(
    title && !GENERIC_TITLE_RE.test(title) && !/explore the things you love/i.test(title)
  );
  const generic = isGeneric(title, description) && !hasRealCover;

  return {
    title: title || '',
    description: description || '',
    // Contingencia: logo oficial Wikimedia (nunca Unsplash / YouTube)
    image: hasRealCover ? image : FACEBOOK_CONTINGENCY_LOGO,
    url: og.url || pageUrl,
    generic,
    platform: 'facebook',
    // Auténtico solo con portada real (fbcdn/scontent); el logo Wikimedia es contingencia
    authentic: hasRealCover && hasRealTitle,
  };
}
