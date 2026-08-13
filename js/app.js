const TRIAL_MAX = 20;

/**
 * S1.4-D: normalización conservadora para duplicados de URL.
 * Equivalencias: trim, hostname en minúsculas, puerto por defecto, slash final.
 * No equivale: http/https, www/apex, query distinta.
 */
function normalizeUrlForDuplicateCheck(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_) {
    return trimmed;
  }
  const protocol = String(parsed.protocol || '').toLowerCase();
  const hostname = String(parsed.hostname || '').toLowerCase();
  if (!hostname) return trimmed;
  const port = String(parsed.port || '');
  const defaultPort =
    (protocol === 'http:' && (!port || port === '80')) ||
    (protocol === 'https:' && (!port || port === '443'));
  const host = defaultPort || !port ? hostname : `${hostname}:${port}`;
  let pathname = parsed.pathname || '/';
  if (pathname.length > 1) {
    pathname = pathname.replace(/\/+$/, '');
    if (!pathname) pathname = '/';
  }
  return `${protocol}//${host}${pathname}${parsed.search}${parsed.hash}`;
}

// =============================================================================
// S1.1 — Storage local (Guest / Legacy / caché por UID)
// Contrato v1.1 + DP1/DP2. La clave global legacy NO es escritura normal.
// =============================================================================
const LEGACY_CARDS_STORAGE_KEY = 'inboxzero_cards';
const GUEST_CARDS_STORAGE_KEY = 'inboxzero_guest_cards';

/**
 * Identidad persistente de ficha (S1.2): UUID string.
 * No usar Date.now() como id.
 */
function createCardId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback sin dependencias externas (RFC4122 v4 aproximado)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const n = (Math.random() * 16) | 0;
    const v = ch === 'x' ? n : (n & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Comparación estable de ids de card (string/UUID o legacy numérico serializado). */
function cardIdsEqual(a, b) {
  return String(a ?? '') === String(b ?? '');
}

/** Lee id de card desde DOM/atributos sin parseInt/Number. */
function readDomCardId(value) {
  const id = String(value ?? '').trim();
  return id || null;
}

/**
 * Normaliza id al cargar storage: string; conserva IDs legacy numéricos como string.
 * No inventa UUID para sustituir un id histórico existente.
 */
function normalizePersistedCardId(rawId) {
  if (rawId == null || rawId === '') return createCardId();
  return String(rawId);
}

/** Clave de caché autenticado: inboxzero_cards_<UID> */
function getUserCardsCacheKey(uid) {
  const id = String(uid || '').trim();
  if (!id) {
    throw new Error('[InboxZero Storage] UID autenticado requerido para caché de usuario');
  }
  return `inboxzero_cards_${id}`;
}

function readLocalCardsArray(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err) {
    console.warn('[InboxZero Storage] No se pudo leer', storageKey, err);
    return null;
  }
}

function writeLocalCardsArray(storageKey, cardsArray) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(Array.isArray(cardsArray) ? cardsArray : []));
    return true;
  } catch (err) {
    console.warn('[InboxZero Storage] No se pudo guardar', storageKey, err);
    return false;
  }
}

function hasLegacyCardsStorage() {
  try {
    return localStorage.getItem(LEGACY_CARDS_STORAGE_KEY) != null;
  } catch (_) {
    return false;
  }
}

/** Lectura LEGACY solo-lectura. No escribe ni borra inboxzero_cards. */
function readLegacyCardsStorage() {
  return readLocalCardsArray(LEGACY_CARDS_STORAGE_KEY);
}

function getGuestCardsStorage() {
  return readLocalCardsArray(GUEST_CARDS_STORAGE_KEY);
}

function saveGuestCardsStorage(cardsArray) {
  return writeLocalCardsArray(GUEST_CARDS_STORAGE_KEY, cardsArray);
}

function getUserCardsCache(uid) {
  return readLocalCardsArray(getUserCardsCacheKey(uid));
}

function saveUserCardsCache(uid, cardsArray) {
  return writeLocalCardsArray(getUserCardsCacheKey(uid), cardsArray);
}

/**
 * Distingue orígenes locales de fichas (sin mezclar automáticamente).
 * @returns {{ guest: boolean, legacy: boolean, userCache: boolean, userCacheKey: string|null }}
 */
function detectLocalCardsStorageState(uid) {
  const guest = getGuestCardsStorage() != null;
  const legacy = hasLegacyCardsStorage();
  let userCache = false;
  let userCacheKey = null;
  const id = String(uid || '').trim();
  if (id) {
    userCacheKey = getUserCardsCacheKey(id);
    userCache = readLocalCardsArray(userCacheKey) != null;
  }
  return { guest, legacy, userCache, userCacheKey };
}

/** Placeholder SVG elegante cuando falla la miniatura de una ficha */
const CARD_THUMB_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140" role="img" aria-hidden="true">
      <rect width="140" height="140" rx="12" fill="#eef2f7"/>
      <rect x="18" y="18" width="104" height="104" rx="10" fill="#e5e7eb"/>
      <circle cx="52" cy="54" r="10" fill="#cbd5e1"/>
      <path d="M28 104 L56 72 L74 88 L96 64 L112 104 Z" fill="#94a3b8"/>
      <rect x="86" y="34" width="28" height="20" rx="4" fill="#64748b"/>
      <path d="M96 40 L108 44 L96 48 Z" fill="#f8fafc"/>
    </svg>
  `.trim());

function escapeHtmlAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** True si hay una URL de imagen usable (http(s), data: o ruta local). */
function isUsableImageUrl(value) {
  const src = String(value || '').trim();
  if (!src) return false;
  if (src === CARD_THUMB_PLACEHOLDER) return true;
  if (/^data:image\//i.test(src)) return true;
  if (/^https?:\/\//i.test(src)) return true;
  if (/^[\w./-]+\.(png|jpe?g|gif|webp|svg)(\?.*)?$/i.test(src)) return true;
  return false;
}

/** Favicon / icono de respaldo cuando no hay Open Graph. */
function getFaviconFallback(pageUrl) {
  try {
    const host = new URL(pageUrl).hostname;
    if (!host) return CARD_THUMB_PLACEHOLDER;
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`;
  } catch (_) {
    return CARD_THUMB_PLACEHOLDER;
  }
}

/** Resuelve la mejor imagen disponible para una ficha o URL. */
function resolveDisplayImage(imageUrl, pageUrl) {
  if (isUsableImageUrl(imageUrl)) return String(imageUrl).trim();
  const ytId = extractYoutubeVideoId(pageUrl);
  if (ytId) return getYoutubeThumbUrl(ytId, 'hqdefault');
  if (pageUrl && /^https?:\/\//i.test(String(pageUrl))) {
    return getFaviconFallback(pageUrl);
  }
  return CARD_THUMB_PLACEHOLDER;
}

/**
 * Si la imagen de la tarjeta falla, sustituye por un placeholder limpio
 * y oculta el texto alternativo para no romper el diseño.
 * Para miniaturas YouTube maxres inexistentes, degrada a hqdefault.
 */
function handleCardThumbError(img) {
  if (!img) return;

  const src = String(img.currentSrc || img.src || '');
  const ytMax = src.match(/i\.ytimg\.com\/vi\/([^/]+)\/maxresdefault\.jpg/i);
  if (ytMax && img.dataset.ytHqTried !== '1') {
    img.dataset.ytHqTried = '1';
    img.src = `https://i.ytimg.com/vi/${ytMax[1]}/hqdefault.jpg`;
    return;
  }

  // Segundo intento: favicon del sitio (si conocemos la página)
  const pageUrl = img.dataset.pageUrl || img.getAttribute('data-page-url') || '';
  if (pageUrl && img.dataset.faviconTried !== '1') {
    img.dataset.faviconTried = '1';
    const fav = getFaviconFallback(pageUrl);
    if (fav && fav !== src) {
      img.src = fav;
      return;
    }
  }

  if (img.dataset.fallbackApplied === '1') return;
  img.dataset.fallbackApplied = '1';
  img.src = CARD_THUMB_PLACEHOLDER;
  img.alt = '';
  img.removeAttribute('title');
  img.classList.add('card-thumb--fallback');
  img.setAttribute('aria-hidden', 'true');
}

window.handleCardThumbError = handleCardThumbError;

/** Extrae el ID de un vídeo de YouTube / Shorts / youtu.be */
function extractYoutubeVideoId(url) {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
  const match = String(url || '').match(regExp);
  return match && match[2] && match[2].length === 11 ? match[2] : null;
}

function getYoutubeThumbUrl(videoId, quality) {
  const q = quality || 'maxresdefault';
  return `https://i.ytimg.com/vi/${videoId}/${q}.jpg`;
}

async function fetchYoutubeOEmbed(pageUrl) {
  const endpoints = [
    `https://noembed.com/embed?url=${encodeURIComponent(pageUrl)}`,
    `https://www.youtube.com/oembed?url=${encodeURIComponent(pageUrl)}&format=json`,
  ];
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint);
      if (!res.ok) continue;
      const data = await res.json();
      if (data && !data.error && (data.title || data.thumbnail_url)) {
        return data;
      }
    } catch (_) {
      /* probar siguiente endpoint */
    }
  }
  return null;
}

/**
 * Heurística conservadora: ¿esta URL parece logo / icono / asset de marca?
 * No descarta cualquier imagen cuadrada: combina señales de nombre, tipo y tamaño.
 * Fase 2 podrá reutilizar esta señal dentro de un score multi-candidato.
 *
 * @param {string} imageUrl
 * @param {{ width?: number, height?: number, logoUrl?: string, type?: string }} [options]
 */
function isLikelyBrandOrLogoImage(imageUrl, options = {}) {
  const url = String(imageUrl || '').trim();
  if (!url) return false;

  const logoUrl = String(options.logoUrl || '').trim();
  if (logoUrl) {
    try {
      if (new URL(url).href === new URL(logoUrl, url).href) return true;
    } catch (_) {
      if (url === logoUrl) return true;
    }
  }

  const path = url.split(/[?#]/)[0] || url;
  const fileName = path.split('/').pop() || '';
  const typeHint = String(options.type || '').toLowerCase();

  if (/\.ico$/i.test(path) || typeHint === 'ico') return true;
  if (/favicon|apple-touch-icon|android-chrome|mstile|site-icon/i.test(url)) return true;
  if (/(^|[/_-])logo([/_.-]|$)/i.test(path) || /\/logos?\//i.test(path)) return true;
  if (/(^|[/_-])icon([/_.-]|$)/i.test(path) && !/iconic|iconograph/i.test(path)) return true;
  if (/brand[-_]?logo|site[-_]?logo|company[-_]?logo|brand[-_]?mark/i.test(path)) return true;

  // SVG: solo si el path sugiere icono/logo (no todo SVG de contenido)
  if (/\.svg$/i.test(path) && /(logo|icon|favicon|brand)/i.test(path)) return true;
  if (/^data:image\/svg\+xml/i.test(url)) return true;

  let width = Number(options.width) || 0;
  let height = Number(options.height) || 0;
  const dimInName = fileName.match(/(?:^|[_-])(\d{2,4})x(\d{2,4})(?:\.[a-z]+)?$/i);
  if ((!width || !height) && dimInName) {
    width = width || Number(dimInName[1]);
    height = height || Number(dimInName[2]);
  }

  if (width > 0 && height > 0) {
    const maxSide = Math.max(width, height);
    const minSide = Math.min(width, height);
    const nearlySquare = minSide > 0 && maxSide / minSide <= 1.08;

    // Iconos muy pequeños: fuerte señal de marca
    if (nearlySquare && maxSide <= 256) return true;

    // Cuadrados medianos (p. ej. 274×274): solo con señal de nombre/marca en el archivo
    if (
      nearlySquare &&
      maxSide <= 400 &&
      (/logo|brand|icon|favicon|apple|touch/i.test(fileName) ||
        /^[a-z0-9]+-\d{2,4}x\d{2,4}\.(jpe?g|png|webp|gif)$/i.test(fileName))
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Construye candidatos Microlink normalizados (preparado para scoring Fase 2).
 * @param {{ image?: object, logo?: object, screenshot?: object }} microlink
 * @returns {Array<{ url: string, source: string, width?: number, height?: number, type?: string }>}
 */
function buildMicrolinkImageCandidates(microlink) {
  const out = [];
  const push = (obj, source) => {
    const url = obj && obj.url ? String(obj.url).trim() : '';
    if (!url || !isUsableImageUrl(url)) return;
    out.push({
      url,
      source,
      width: Number(obj.width) || undefined,
      height: Number(obj.height) || undefined,
      type: obj.type ? String(obj.type) : undefined,
    });
  };
  if (microlink) {
    push(microlink.image, 'microlink-image');
    push(microlink.screenshot, 'microlink-screenshot');
    push(microlink.logo, 'microlink-logo');
  }
  return out;
}

/**
 * Fase 1: elige imagen Microlink (foto/OG vs screenshot si logo-like).
 * Fase 2: podrá puntuar `candidates` y devolver otra URL.
 *
 * @param {Array<{ url: string, source: string, width?: number, height?: number, type?: string }>} candidates
 * @param {{ logoUrl?: string }} [options]
 * @returns {{ url: string, source: string, logoLike: boolean, candidates: typeof candidates }}
 */
function selectPreferredMicrolinkImage(candidates, options = {}) {
  const list = Array.isArray(candidates) ? candidates : [];
  const logoUrl = String(options.logoUrl || '').trim();
  const primary = list.find((c) => c.source === 'microlink-image');
  const screenshot = list.find((c) => c.source === 'microlink-screenshot');
  const logo = list.find((c) => c.source === 'microlink-logo');

  if (primary) {
    const logoLike = isLikelyBrandOrLogoImage(primary.url, {
      width: primary.width,
      height: primary.height,
      type: primary.type,
      logoUrl: logoUrl || logo?.url || '',
    });
    if (!logoLike) {
      return { url: primary.url, source: primary.source, logoLike: false, candidates: list };
    }
    if (screenshot?.url) {
      return { url: screenshot.url, source: screenshot.source, logoLike: true, candidates: list };
    }
    // Logo-like sin screenshot disponible: conservar image (fallbacks posteriores intactos)
    return { url: primary.url, source: primary.source, logoLike: true, candidates: list };
  }

  if (screenshot?.url) {
    return { url: screenshot.url, source: screenshot.source, logoLike: false, candidates: list };
  }
  if (logo?.url) {
    return { url: logo.url, source: logo.source, logoLike: true, candidates: list };
  }
  return { url: '', source: '', logoLike: false, candidates: list };
}

/**
 * Extracción real de metadatos vía Microlink (API gratuita).
 * Endpoint: https://api.microlink.io/?url=...
 * Devuelve también `microlink` crudo para selección inteligente / Fase 2.
 */
async function fetchMicrolinkMetadata(pageUrl, options = {}) {
  const params = new URLSearchParams({ url: pageUrl });
  if (options.screenshot) params.set('screenshot', 'true');
  if (options.palette) params.set('palette', 'true');
  const endpoint = `https://api.microlink.io/?${params.toString()}`;
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error(`Microlink HTTP ${res.status}`);
  }
  const datos = await res.json();
  if (!datos || datos.status !== 'success' || !datos.data) {
    throw new Error((datos && datos.message) || 'Microlink no devolvió datos');
  }
  const d = datos.data;
  const microlink = {
    image: d.image || null,
    logo: d.logo || null,
    screenshot: d.screenshot || null,
  };
  const candidates = buildMicrolinkImageCandidates(microlink);
  const picked = selectPreferredMicrolinkImage(candidates, {
    logoUrl: (d.logo && d.logo.url) || '',
  });
  // Compat: si no hay selección, cadena clásica image → screenshot → logo
  const imageUrl =
    picked.url ||
    (d.image && d.image.url) ||
    (d.screenshot && d.screenshot.url) ||
    (d.logo && d.logo.url) ||
    '';
  return {
    title: (d.title && String(d.title).trim()) || '',
    description: (d.description && String(d.description).trim()) || '',
    image: imageUrl,
    canonicalUrl: d.url || pageUrl,
    imageSource: picked.source || '',
    imageLogoLike: Boolean(picked.logoLike),
    imageCandidates: candidates,
    microlink,
  };
}

const FACEBOOK_GENERIC_TITLE_RE =
  /^(facebook|facebook\s*[-–|]\s*log\s*in|log\s*in\s*to\s*facebook|meta)$/i;
const FACEBOOK_GENERIC_DESC_RE =
  /explore the things you love|connect with friends[, ]+family and other people|facebook helps you|log into facebook|crea una cuenta o inicia sesión|see photos and updates/i;

function isGenericFacebookMeta(title, description) {
  const t = String(title || '').trim();
  const d = String(description || '').trim();
  if (!t && !d) return true;
  if (FACEBOOK_GENERIC_TITLE_RE.test(t)) return true;
  if (d && FACEBOOK_GENERIC_DESC_RE.test(d)) return true;
  if (/explore the things you love/i.test(t)) return true;
  return false;
}

/** Título por defecto limpio (sin IDs / números de Facebook) */
function getFacebookDefaultTitle() {
  return t('social.facebook.title') || 'Enlace de Facebook';
}

function getFacebookDefaultDescription() {
  return (
    t('social.facebook.description') ||
    'Contenido de Facebook indexado correctamente. Por motivos de privacidad y seguridad de la plataforma, haz clic en el enlace para visualizar la publicación completa en tu cuenta.'
  );
}

/**
 * Logo oficial de Facebook (Wikimedia): "f" blanca sobre azul.
 * Contingencia cuando falla el scraping — nunca Unsplash ni miniaturas YouTube.
 */
const FACEBOOK_CONTINGENCY_LOGO =
  'https://upload.wikimedia.org/wikipedia/commons/5/51/Facebook_f_logo_%282019%29.svg';

function getFacebookContingencyLogo() {
  return FACEBOOK_CONTINGENCY_LOGO;
}

/** Imagen de contingencia / logo de marca Facebook (SVG data o Wikimedia). */
function isFacebookContingencyImage(src) {
  const value = String(src || '').trim();
  if (!value) return false;
  if (/^data:image\/svg\+xml/i.test(value)) return true;
  if (value === FACEBOOK_CONTINGENCY_LOGO) return true;
  if (/upload\.wikimedia\.org\/.*Facebook_f_logo/i.test(value)) return true;
  // Basura de marca cruzada a eliminar
  if (/ytimg\.com|youtube\.com\/vi\//i.test(value)) return true;
  if (/unsplash\.com/i.test(value)) return true;
  return false;
}

/** Descripciones antiguas / genéricas → sustituir por el copy profesional actual */
function isLegacyFacebookDescription(desc) {
  const d = String(desc || '').trim();
  if (!d) return true;
  if (d === getFacebookDefaultDescription()) return false;
  if (isGenericFacebookMeta('', d)) return true;
  return (
    /contenido guardado desde (la plataforma de )?facebook/i.test(d) ||
    /content saved from facebook/i.test(d) ||
    /inhalt von facebook gespeichert/i.test(d) ||
    /contenu enregistré depuis facebook/i.test(d) ||
    /conteúdo guardado do facebook/i.test(d) ||
    /enlace guardado y optimizado/i.test(d)
  );
}

/** Contingencia instantánea: sin ScrapingBee / Microlink (Facebook bloquea). */
function getFacebookInstantMetadata(pageUrl) {
  return {
    title: getFacebookDefaultTitle(),
    description: getFacebookDefaultDescription(),
    image: getFacebookContingencyLogo(),
    canonicalUrl: pageUrl,
    facebookSmart: true,
    authentic: false,
    skipScrape: true,
  };
}

/** Detecta títulos feos con IDs numéricos o basura de scraping */
function isUglyFacebookTitle(title) {
  const value = String(title || '').trim();
  if (!value) return true;
  if (isGenericFacebookMeta(value, '')) return true;
  if (/^\d+$/.test(value)) return true;
  if (/\b\d{5,}\b/.test(value)) return true;
  if (/facebook\.com|fb\.watch|fb\.com/i.test(value)) return true;
  if (/^Grupo «|^Página «|^Vídeo o Reel|^Grupo de Recetas|^Contenido de Facebook/i.test(value)) {
    return true;
  }
  return false;
}

/**
 * Imagen usable de Facebook: cover http(s) o screenshot ScrapingBee (data:image).
 * Se excluye solo el logo SVG corporativo de fallback.
 */
function isAuthenticFacebookImage(src) {
  const value = String(src || '').trim();
  if (!value) return false;
  if (isFacebookContingencyImage(value)) return false;
  if (/ytimg\.com|youtube\.com|unsplash\.com/i.test(value)) return false;
  if (/^data:image\/svg\+xml/i.test(value)) return false;
  if (/^data:image\//i.test(value)) return true; // screenshot ScrapingBee
  return /^https?:\/\//i.test(value);
}

function isAuthenticFacebookTitle(title) {
  const value = String(title || '').trim();
  if (!value) return false;
  if (isUglyFacebookTitle(value)) return false;
  if (value === getFacebookDefaultTitle()) return false;
  return true;
}

/**
 * Fallback UX Facebook (sin scraping).
 */
function refineFacebookMetadata(pageUrl) {
  return getFacebookInstantMetadata(pageUrl);
}

/** Compat: siempre contingencia instantánea (Facebook bloqueado). */
function mergeFacebookExtraction(pageUrl) {
  return getFacebookInstantMetadata(pageUrl);
}

/**
 * Backend avanzado (ScrapingBee). Facebook / Instagram / LinkedIn / webs.
 */
async function fetchAdvancedExtractApi(pageUrl) {
  const base = String(window.INBOXZERO_EXTRACT_API || 'http://localhost:8787').replace(/\/$/, '');
  const endpoint = `${base}/api/extract?url=${encodeURIComponent(pageUrl)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 55000);
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    if (!payload) return null;
    if (payload.status === 'success' && payload.data) {
      const d = payload.data;
      return {
        title: (d.title && String(d.title).trim()) || '',
        description: (d.description && String(d.description).trim()) || '',
        image: d.image || '',
        canonicalUrl: d.url || pageUrl,
        provider: d.provider || 'advanced',
        generic: Boolean(d.generic),
        authentic: Boolean(d.authentic),
        fromAdvancedApi: true,
      };
    }
    return null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fase 2: candidatos HTML puntuados (backend /api/page-images).
 * Solo para URLs genéricas cuando Microlink no aporta foto usable.
 * @returns {Promise<{ url: string, source: string, score: number, candidate: object } | null>}
 */
async function fetchPageImagesBest(pageUrl) {
  const base = String(window.INBOXZERO_EXTRACT_API || 'http://localhost:8787').replace(/\/$/, '');
  const endpoint = `${base}/api/page-images?url=${encodeURIComponent(pageUrl)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const payload = await res.json().catch(() => null);
    if (!payload || payload.status !== 'success' || !payload.data) return null;
    const best = payload.data.best;
    if (best && best.accepted === true && best.url && isUsableImageUrl(best.url)) {
      return {
        url: String(best.url).trim(),
        source: 'page-html',
        score: Number(best.score) || 0,
        candidate: best,
        candidates: Array.isArray(payload.data.candidates) ? payload.data.candidates : [],
      };
    }
    return null;
  } catch (_) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Extracción usable de página pública de Facebook (no muro de login / no Unsplash). */
function isUsableFacebookExtraction(meta) {
  if (!meta) return false;
  const title = String(meta.title || '').trim();
  const desc = String(meta.description || '').trim();
  const image = String(meta.image || '').trim();
  if (isGenericFacebookMeta(title, desc) && !isAuthenticFacebookImage(image)) return false;
  if (/explore the things you love/i.test(title) || /explore the things you love/i.test(desc)) {
    return false;
  }
  const realTitle = Boolean(title && isAuthenticFacebookTitle(title));
  const realImage =
    Boolean(image) &&
    isAuthenticFacebookImage(image) &&
    !isFacebookContingencyImage(image);
  const realDesc = Boolean(desc && !isGenericFacebookMeta('', desc) && !isLegacyFacebookDescription(desc));
  return realTitle || realImage || (realDesc && (realTitle || realImage));
}

function needsAdvancedScrape(pageUrl) {
  const brand = detectSocialBrand(pageUrl);
  return brand === 'facebook' || brand === 'instagram' || brand === 'linkedin';
}

/**
 * Extracción: Facebook → ScrapingBee (páginas públicas) → contingencia;
 * IG/LinkedIn ScrapingBee; resto Microlink.
 */
async function extractUrlMetadata(pageUrl) {
  if (detectSocialBrand(pageUrl) === 'facebook') {
    try {
      const advanced = await fetchAdvancedExtractApi(pageUrl);
      if (isUsableFacebookExtraction(advanced)) {
        return {
          ...advanced,
          facebookSmart: false,
          authentic: true,
        };
      }
    } catch (_) {
      /* contingencia */
    }
    return getFacebookInstantMetadata(pageUrl);
  }

  if (needsAdvancedScrape(pageUrl)) {
    try {
      const advanced = await fetchAdvancedExtractApi(pageUrl);
      if (advanced && (advanced.title || advanced.image || advanced.description)) {
        return { ...advanced, facebookSmart: false, authentic: true };
      }
    } catch (_) {
      /* continuar */
    }
  }

  try {
    // URLs genéricas:
    // Microlink image → (si falta/logoLike) /api/page-images → (si no) screenshot Fase 1 → fallbacks.
    let meta = await fetchMicrolinkMetadata(pageUrl);
    if (!meta) return null;

    const primary = meta.microlink?.image;
    const primaryUrl = (primary && primary.url) || '';
    const logoUrl = (meta.microlink?.logo && meta.microlink.logo.url) || '';
    const imageMissingOrLogoLike =
      !primaryUrl ||
      Boolean(meta.imageLogoLike) ||
      isLikelyBrandOrLogoImage(primaryUrl, {
        width: primary?.width,
        height: primary?.height,
        type: primary?.type,
        logoUrl,
      });

    // Imagen Microlink usable y no logo → conservar (no page-images ni screenshot)
    if (!imageMissingOrLogoLike) {
      return meta;
    }

    // Fase 2: candidatos HTML puntuados (solo si falta imagen o es logo-like)
    try {
      const pageBest = await fetchPageImagesBest(pageUrl);
      if (pageBest?.url) {
        const pageCandidates = Array.isArray(pageBest.candidates) ? pageBest.candidates : [];
        return {
          ...meta,
          image: pageBest.url,
          imageSource: 'page-html',
          imageLogoLike: Boolean(primaryUrl),
          imageCandidates: [
            ...(Array.isArray(meta.imageCandidates) ? meta.imageCandidates : []),
            ...pageCandidates,
          ],
          pageImageBest: pageBest.candidate || null,
        };
      }
    } catch (_) {
      /* page-images opcional; continuar a screenshot Fase 1 */
    }

    // Fase 1: screenshot Microlink como fallback visual
    try {
      const withShot = await fetchMicrolinkMetadata(pageUrl, { screenshot: true });
      const shotUrl =
        (withShot?.microlink?.screenshot && withShot.microlink.screenshot.url) || '';
      if (withShot && shotUrl && isUsableImageUrl(shotUrl)) {
        const mergedCandidates = buildMicrolinkImageCandidates({
          image: meta.microlink?.image || null,
          logo: meta.microlink?.logo || withShot.microlink?.logo || null,
          screenshot: withShot.microlink?.screenshot || null,
        });
        meta = {
          title: meta.title || withShot.title,
          description: meta.description || withShot.description,
          image: shotUrl,
          canonicalUrl: meta.canonicalUrl || withShot.canonicalUrl,
          imageSource: 'microlink-screenshot',
          imageLogoLike: Boolean(primaryUrl),
          imageCandidates: mergedCandidates,
          microlink: {
            image: meta.microlink?.image || null,
            logo: meta.microlink?.logo || withShot.microlink?.logo || null,
            screenshot: withShot.microlink?.screenshot || null,
          },
        };
      } else if (withShot && !meta.image && withShot.image) {
        // Sin image primaria: conservar comportamiento previo (screenshot/logo vía picker)
        meta = {
          title: meta.title || withShot.title,
          description: meta.description || withShot.description,
          image: withShot.image,
          canonicalUrl: meta.canonicalUrl || withShot.canonicalUrl,
          imageSource: withShot.imageSource || meta.imageSource,
          imageLogoLike: withShot.imageLogoLike,
          imageCandidates: withShot.imageCandidates || meta.imageCandidates,
          microlink: withShot.microlink || meta.microlink,
        };
      }
      // Si el screenshot falla y había image logo-like, se conserva meta.image (fallbacks actuales)
    } catch (_) {
      /* screenshot opcional */
    }

    return meta;
  } catch (_) {
    return null;
  }
}

/** Logos corporativos en SVG (Data URL) para fallbacks de redes sociales */
const SOCIAL_BRAND_LOGOS = {
  // Data URL corporativo (azul #1877F2) para vista previa profesional sin Unsplash
  facebook:
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100" height="100"><circle cx="256" cy="256" r="256" fill="#1877F2"/><path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.8 90.6 226.4 209.3 245V342.3h-56.5V256h56.5v-65.7c0-55.7 33-86.5 84-86.5 24.4 0 50 4.4 50 4.4v55h-28.1c-27.6 0-36.2 17.1-36.2 34.7V256h62l-9.9 86.3h-52.1V501C413.4 482.4 504 379.8 504 256z" fill="white"/></svg>'
    ),
  instagram:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100" height="100"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#f58529"/><stop offset="50%" stop-color="#dd2a7b"/><stop offset="100%" stop-color="#515bd4"/></linearGradient></defs><rect width="512" height="512" rx="64" fill="url(#ig)"/><rect x="120" y="120" width="272" height="272" rx="72" fill="none" stroke="#fff" stroke-width="36"/><circle cx="256" cy="256" r="78" fill="none" stroke="#fff" stroke-width="36"/><circle cx="348" cy="164" r="22" fill="#fff"/></svg>'
    ),
  linkedin:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100" height="100"><rect width="512" height="512" rx="64" fill="#0A66C2"/><rect x="96" y="196" width="72" height="220" fill="#fff"/><circle cx="132" cy="132" r="40" fill="#fff"/><path d="M244 196h70v34c12-22 38-42 78-42 76 0 90 50 90 116v112h-72V328c0-36-14-60-46-60-34 0-50 24-50 60v88h-70V196z" fill="#fff"/></svg>'
    ),
  twitter:
    'data:image/svg+xml,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100" height="100"><rect width="512" height="512" rx="64" fill="#000"/><path d="M318.6 156H352l-74.2 84.8L364 356h-70.4l-55-72.2L168 356h-34.2l79.4-90.8L148 156h72.2l49.6 66.2L318.6 156zm-12.4 180h21.8L206.6 175.4h-23.4L306.2 336z" fill="#fff"/></svg>'
    ),
};

function detectSocialBrand(url) {
  const raw = String(url || '').toLowerCase();
  // Detección por contenido de URL (fallback sin metadatos reales)
  if (raw.includes('facebook.com') || raw.includes('fb.com') || raw.includes('fb.watch')) {
    return 'facebook';
  }
  if (raw.includes('instagram.com')) return 'instagram';
  if (raw.includes('linkedin.com')) return 'linkedin';
  if (raw.includes('twitter.com') || /(^|\/\/|\.)x\.com(\/|$|\?|#)/i.test(raw)) {
    return 'twitter';
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    if (host === 'facebook.com' || host.endsWith('.facebook.com') || host === 'fb.com' || host === 'fb.watch' || host.endsWith('.fb.com')) {
      return 'facebook';
    }
    if (host === 'instagram.com' || host.endsWith('.instagram.com')) return 'instagram';
    if (host === 'linkedin.com' || host.endsWith('.linkedin.com')) return 'linkedin';
    if (host === 'twitter.com' || host.endsWith('.twitter.com') || host === 'x.com' || host.endsWith('.x.com')) {
      return 'twitter';
    }
  } catch (_) {
    /* ignore */
  }
  return null;
}

/** Fallback de marca cuando no hay metadatos reales (Facebook, Instagram, LinkedIn, X) */
function getSocialBrandFallback(brand) {
  if (!brand || !SOCIAL_BRAND_LOGOS[brand]) return null;
  return {
    brand,
    title: t(`social.${brand}.title`),
    description: t(`social.${brand}.description`),
    image: brand === 'facebook' ? getFacebookContingencyLogo() : SOCIAL_BRAND_LOGOS[brand],
  };
}

function isBrandLogoImage(src) {
  const value = String(src || '');
  if (/^data:image\/svg\+xml/i.test(value)) return true;
  if (/upload\.wikimedia\.org\/.*Facebook_f_logo/i.test(value)) return true;
  return false;
}

function getSupabaseClient() {
  return window.inboxZeroSupabase || null;
}

// =============================================================================
// S1.1 — Capa mínima de acceso a profiles / cards (preparada, no cableada al CRUD)
// user_id de escritura siempre desde la sesión Auth; nunca desde la UI.
// =============================================================================

/** UID de la sesión actual (auth.uid() vía JWT). No acepta user_id externo. */
async function getAuthenticatedUserId() {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data?.session?.user?.id) return null;
    return String(data.session.user.id);
  } catch (_) {
    return null;
  }
}

/**
 * Resuelve UID para repos: prioriza sessionUid conocido (Auth user.id).
 * Nunca inventa un UID; si no hay argumento, cae a getSession (fuera de onAuthStateChange).
 */
async function resolveRepoUserId(sessionUid) {
  const known = String(sessionUid || '').trim();
  if (known) return known;
  return (await getAuthenticatedUserId()) || '';
}

/**
 * Lee el perfil propio (nombre, email, tipo_plan).
 * @param {string} [sessionUid] UID ya conocido del usuario Auth (evita getSession).
 */
async function fetchOwnProfileRepo(sessionUid) {
  const supabase = getSupabaseClient();
  const uid = await resolveRepoUserId(sessionUid);
  if (!supabase || !uid) {
    return { ok: false, code: 'NO_SESSION', data: null, error: null };
  }
  const { data, error } = await supabase
    .from('profiles')
    .select('id,nombre,email,tipo_plan,creado_en')
    .eq('id', uid)
    .maybeSingle();
  if (error) return { ok: false, code: 'PROFILE_ERROR', data: null, error };
  return { ok: true, code: 'OK', data: data || null, error: null };
}

/**
 * Lista fichas Cloud del usuario autenticado.
 * @param {string} [sessionUid] UID ya conocido del usuario Auth (evita getSession).
 */
async function fetchOwnCardsRepo(sessionUid) {
  const supabase = getSupabaseClient();
  const uid = await resolveRepoUserId(sessionUid);
  if (!supabase || !uid) {
    return { ok: false, code: 'NO_SESSION', data: null, error: null };
  }
  const { data, error } = await supabase
    .from('cards')
    .select(
      'id,user_id,title,description,url,category,favorite,readLater,notes,image,creado_en'
    )
    .eq('user_id', uid)
    .order('creado_en', { ascending: false });
  if (error) return { ok: false, code: 'CARDS_ERROR', data: null, error };
  return { ok: true, code: 'OK', data: Array.isArray(data) ? data : [], error: null };
}

/**
 * Clasifica un fallo de INSERT Cloud sin exponer detalles técnicos al usuario.
 * S1.4-C: LIMIT solo con texto de cuota; el resto FAIL CLOSED.
 */
function classifyCardInsertError(error) {
  if (!error) return 'INSERT_ERROR';
  const msg = String(error.message || error.details || error.hint || '');
  const name = String(error.name || '');
  const status = Number(error.status || error.statusCode || 0);
  if (
    /l[ií]mite del plan gratuito|l[ií]mite del plan de prueba|free plan (card )?limit|maximum of 20 cards|20 fichas/i.test(
      msg
    )
  ) {
    return 'INSERT_LIMIT';
  }
  if (
    name === 'TypeError' ||
    name === 'AbortError' ||
    name === 'AuthRetryableFetchError' ||
    /RetryableFetchError/i.test(name) ||
    status === 0 ||
    status === 408 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    /failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout|timed out|offline|econnreset|enotfound/i.test(
      msg
    )
  ) {
    return 'INSERT_NETWORK';
  }
  return 'INSERT_ERROR';
}

/**
 * INSERT de ficha propia. Fuerza user_id = sesión; ignora user_id del payload.
 * S1.4-C: nunca lanza; errores tipados (NO_SESSION / INSERT_LIMIT / INSERT_NETWORK / INSERT_ERROR).
 */
async function insertOwnCardRepo(cardFields) {
  const supabase = getSupabaseClient();
  const uid = await getAuthenticatedUserId();
  if (!supabase || !uid) {
    return { ok: false, code: 'NO_SESSION', data: null, error: null };
  }
  try {
    const src = cardFields && typeof cardFields === 'object' ? cardFields : {};
    const row = {
      user_id: uid,
      title: src.title != null ? String(src.title) : '',
      description: src.description != null ? String(src.description) : '',
      url: src.url != null ? String(src.url) : '',
      category: src.category != null ? String(src.category) : 'uncategorized',
      favorite: Boolean(src.favorite),
      readLater: Boolean(src.readLater),
      notes: src.notes != null ? String(src.notes) : '',
      image: src.image != null ? String(src.image) : '',
    };
    if (src.id) row.id = String(src.id);
    const { data, error } = await supabase.from('cards').insert(row).select().maybeSingle();
    if (error) {
      return { ok: false, code: classifyCardInsertError(error), data: null, error };
    }
    if (!data || !data.id) {
      return { ok: false, code: 'INSERT_ERROR', data: null, error: null };
    }
    return { ok: true, code: 'OK', data, error: null };
  } catch (err) {
    return { ok: false, code: classifyCardInsertError(err), data: null, error: err };
  }
}

/**
 * UPDATE de ficha propia por id. No permite cambiar user_id.
 * Preparado para S1.5+; no invocado en S1.1.
 */
async function updateOwnCardRepo(cardId, patch) {
  const supabase = getSupabaseClient();
  const uid = await getAuthenticatedUserId();
  const id = String(cardId || '').trim();
  if (!supabase || !uid) {
    return { ok: false, code: 'NO_SESSION', data: null, error: null };
  }
  if (!id) return { ok: false, code: 'INVALID_ID', data: null, error: null };
  const src = patch && typeof patch === 'object' ? patch : {};
  const row = {};
  for (const key of [
    'title',
    'description',
    'url',
    'category',
    'favorite',
    'readLater',
    'notes',
    'image',
  ]) {
    if (Object.prototype.hasOwnProperty.call(src, key)) row[key] = src[key];
  }
  const { data, error } = await supabase
    .from('cards')
    .update(row)
    .eq('id', id)
    .eq('user_id', uid)
    .select()
    .maybeSingle();
  if (error) return { ok: false, code: 'UPDATE_ERROR', data: null, error };
  return { ok: true, code: 'OK', data: data || null, error: null };
}

/**
 * DELETE de ficha propia por id.
 * Preparado para S1.6+; no invocado en S1.1.
 */
async function deleteOwnCardRepo(cardId) {
  const supabase = getSupabaseClient();
  const uid = await getAuthenticatedUserId();
  const id = String(cardId || '').trim();
  if (!supabase || !uid) {
    return { ok: false, code: 'NO_SESSION', data: null, error: null };
  }
  if (!id) return { ok: false, code: 'INVALID_ID', data: null, error: null };
  const { error } = await supabase.from('cards').delete().eq('id', id).eq('user_id', uid);
  if (error) return { ok: false, code: 'DELETE_ERROR', data: null, error };
  return { ok: true, code: 'OK', data: { id }, error: null };
}

let currentAuthUser = null;
/** Perfil Cloud (S1.3); nombre para saludo según DP7. */
let currentProfile = null;

/** S1.4-D: Premium solo con tipo_plan leído. Sin perfil → no Premium (fail-safe). */
function isPremiumPlan() {
  return String(currentProfile && currentProfile.tipo_plan ? currentProfile.tipo_plan : '').toLowerCase() ===
    'premium';
}

/**
 * Callback registrado desde el closure de la biblioteca (i18n:ready).
 * Hidrata Guest vs Cloud tras Auth — no cablea INSERT/UPDATE/DELETE.
 */
let libraryAuthSyncHandler = null;
let libraryHydrateGeneration = 0;
/** Timer para salir del callback Auth antes de hidratar (anti-deadlock supabase-js). */
let libraryAuthSyncTimer = null;
let libraryAuthSyncPendingUser = null;
/** S1.4-C: GET Cloud en vuelo (evita reentrada Offline mientras el primero no termina). */
let libraryCloudHydrateInFlight = false;
/** S1.4-C: GET Cloud ya falló por red; no relanzar automáticamente mientras siga Offline. */
let libraryCloudFetchBlocked = false;

function isBrowserOffline() {
  try {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  } catch (_) {
    return false;
  }
}

/** Error de red/Offline en lecturas Cloud (no 401/RLS). No usa el clasificador de INSERT. */
function isLibraryCloudNetworkError(error) {
  if (!error || typeof error !== 'object') return false;
  const msg = String(error.message || error.details || error.hint || '');
  const name = String(error.name || '');
  const rawStatus = error.status != null ? error.status : error.statusCode;
  const status = rawStatus != null ? Number(rawStatus) : NaN;
  if (
    name === 'TypeError' ||
    name === 'AbortError' ||
    name === 'AuthRetryableFetchError' ||
    /RetryableFetchError/i.test(name) ||
    status === 0
  ) {
    return true;
  }
  return /failed to fetch|networkerror|load failed|err_internet_disconnected|network request failed|fetch failed|offline/i.test(
    msg
  );
}

function shouldSkipLibraryCloudFetch() {
  return isBrowserOffline() && (libraryCloudFetchBlocked || libraryCloudHydrateInFlight);
}

function shouldBlockLibraryCloudFetch(profileRes, cardsRes) {
  if (isBrowserOffline()) return true;
  if (profileRes && !profileRes.ok && isLibraryCloudNetworkError(profileRes.error)) return true;
  if (cardsRes && !cardsRes.ok && isLibraryCloudNetworkError(cardsRes.error)) return true;
  return false;
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    libraryCloudFetchBlocked = false;
  });
}

/**
 * Programa hidratación FUERA del stack de onAuthStateChange.
 * Deduplica getSession + INITIAL_SESSION/SIGNED_IN en el mismo tick.
 */
function scheduleLibraryAuthSync(user) {
  libraryAuthSyncPendingUser = user || null;
  if (libraryAuthSyncTimer != null) {
    clearTimeout(libraryAuthSyncTimer);
  }
  libraryAuthSyncTimer = setTimeout(() => {
    libraryAuthSyncTimer = null;
    const pending = libraryAuthSyncPendingUser;
    if (typeof libraryAuthSyncHandler === 'function') {
      libraryAuthSyncHandler(pending);
    }
  }, 0);
}

function notifyLibraryAuthSync(user) {
  scheduleLibraryAuthSync(user);
}

/** Nombre mostrado en el saludo; se sustituye por el del usuario al hacer login real */
const DEFAULT_GREETING_NAME = 'Creador';
let greetingDisplayName = DEFAULT_GREETING_NAME;

function escapeHtmlText(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Resuelve el nombre a saludar (DP7: profiles.nombre → metadata Auth → genérico) */
function resolveGreetingDisplayName(user = currentAuthUser) {
  if (currentProfile && String(currentProfile.nombre || '').trim()) {
    return String(currentProfile.nombre).trim();
  }
  if (!user) return DEFAULT_GREETING_NAME;
  const meta = user.user_metadata || {};
  const fromMeta = meta.full_name || meta.name || meta.display_name || meta.first_name;
  if (fromMeta && String(fromMeta).trim()) return String(fromMeta).trim();
  if (user.email) {
    const local = String(user.email).split('@')[0];
    if (local) return local;
  }
  return DEFAULT_GREETING_NAME;
}

/** Franja horaria local del sistema del usuario */
function getGreetingPeriod(date = new Date()) {
  const hour = date.getHours(); // zona horaria del navegador
  if (hour >= 6 && hour <= 12) return 'morning';
  if (hour >= 13 && hour <= 20) return 'afternoon';
  return 'night'; // 21:00 – 5:59
}

/**
 * Saludo dinámico del dashboard según la hora local.
 * Mañana / tarde / noche + nombre (Creador o usuario registrado).
 */
function renderDashboardGreeting(user = currentAuthUser) {
  const root = document.getElementById('dashboard-greeting');
  const titleEl = document.getElementById('dashboard-greeting-text');
  if (!titleEl) return;

  greetingDisplayName = resolveGreetingDisplayName(user);
  const period = getGreetingPeriod();
  const safeName = escapeHtmlText(greetingDisplayName);
  const raw = t(`greeting.${period}`, { name: '[[NAME]]' });
  let html = escapeHtmlText(raw).replace(
    '[[NAME]]',
    `<span class="greeting-name">${safeName}</span>`
  );
  // Emojis a escala controlada (☕, ☀️, 🌙, etc.)
  html = html.replace(
    /(\p{Extended_Pictographic}\uFE0F?|\p{Emoji_Presentation})/gu,
    '<span class="greeting-emoji" aria-hidden="true">$1</span>'
  );

  titleEl.innerHTML = html;
  if (root) root.dataset.period = period;
}

function setLoginAuthMessage(text, isError) {
  const el = document.getElementById('login-auth-message');
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
  el.classList.toggle('auth-message--error', Boolean(isError));
  el.classList.toggle('auth-message--success', Boolean(text && !isError));
}

function readLoginCredentials() {
  const email = document.getElementById('login-email')?.value.trim() || '';
  const password = document.getElementById('login-password')?.value || '';
  return { email, password };
}

function updateAuthChrome(user) {
  currentAuthUser = user || null;
  const btnLogin = document.getElementById('btn-login-modal');
  const btnLogout = document.getElementById('btn-logout');

  if (btnLogin) {
    if (user?.email) {
      btnLogin.textContent = user.email;
      btnLogin.title = user.email;
    } else {
      btnLogin.textContent = t('header.login');
      btnLogin.removeAttribute('title');
    }
  }

  if (btnLogout) {
    btnLogout.hidden = !user;
  }

  renderDashboardGreeting(currentAuthUser);
}

async function signInWithEmailPassword(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    setLoginAuthMessage(t('auth.notConfigured'), true);
    return;
  }

  setLoginAuthMessage('', false);
  const submitBtn = document.getElementById('btn-submit-login');
  if (submitBtn) submitBtn.disabled = true;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (submitBtn) submitBtn.disabled = false;

  if (error) {
    setLoginAuthMessage(error.message, true);
    return;
  }

  setLoginAuthMessage(t('auth.signInSuccess'), false);
  document.getElementById('modal-login')?.classList.remove('active');
  updateAuthChrome(data.user);
}

async function signUpWithEmailPassword(email, password) {
  const supabase = getSupabaseClient();
  if (!supabase) {
    setLoginAuthMessage(t('auth.notConfigured'), true);
    return;
  }

  setLoginAuthMessage('', false);
  const registerBtn = document.getElementById('btn-register-login');
  if (registerBtn) registerBtn.disabled = true;

  const redirectTo = `${window.location.origin}${window.location.pathname}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });

  if (registerBtn) registerBtn.disabled = false;

  if (error) {
    setLoginAuthMessage(error.message, true);
    return;
  }

  if (data.session) {
    setLoginAuthMessage(t('auth.signUpSuccess'), false);
    document.getElementById('modal-login')?.classList.remove('active');
    updateAuthChrome(data.user);
    return;
  }

  setLoginAuthMessage(t('auth.signUpConfirmEmail'), false);
}

async function signOutCurrentUser() {
  const supabase = getSupabaseClient();
  if (!supabase) return;
  await supabase.auth.signOut();
  currentProfile = null;
  updateAuthChrome(null);
  setLoginAuthMessage('', false);
  notifyLibraryAuthSync(null);
}

function setupSupabaseAuth() {
  const form = document.getElementById('login-form');
  const registerBtn = document.getElementById('btn-register-login');
  const logoutBtn = document.getElementById('btn-logout');
  const supabase = getSupabaseClient();

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const { email, password } = readLoginCredentials();
      if (!email || !password) {
        setLoginAuthMessage(t('auth.missingCredentials'), true);
        return;
      }
      signInWithEmailPassword(email, password);
    });
  }

  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      const { email, password } = readLoginCredentials();
      if (!email || !password) {
        setLoginAuthMessage(t('auth.missingCredentials'), true);
        return;
      }
      signUpWithEmailPassword(email, password);
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      signOutCurrentUser();
    });
  }

  if (!supabase) {
    notifyLibraryAuthSync(null);
    return;
  }

  supabase.auth.getSession().then(({ data: { session } }) => {
    updateAuthChrome(session?.user ?? null);
    notifyLibraryAuthSync(session?.user ?? null);
  });

  supabase.auth.onAuthStateChange((event, session) => {
    updateAuthChrome(session?.user ?? null);
    if (
      event === 'INITIAL_SESSION' ||
      event === 'SIGNED_IN' ||
      event === 'SIGNED_OUT' ||
      event === 'USER_UPDATED'
    ) {
      notifyLibraryAuthSync(session?.user ?? null);
    }
  });
}

document.addEventListener('i18n:ready', () => {
  // setupSupabaseAuth se registra tras definir hydrateLibraryForAuthUser (S1.3)

  // Ficha modelo fija: evita el lienzo en blanco y no cuenta en el trial del usuario
  const WELCOME_CARD_ID = 0;
  const WELCOME_CARD = Object.freeze({
    id: WELCOME_CARD_ID,
    isGuide: true,
    title: '',
    description: '',
    url: 'https://inboxzero.es',
    category: 'guide',
    favorite: false,
    readLater: false,
    notes: '',
    image: 'logo.png',
  });

  const SYSTEM_CATEGORY_KEYS = ['health', 'sports', 'videos', 'guide', 'uncategorized'];
  const UNCATEGORIZED_ID = 'uncategorized';
  const LEGACY_CATEGORY_TO_KEY = {
    'Comida Sana': 'health',
    'Healthy Food': 'health',
    'Alimentation saine': 'health',
    'Gesundes Essen': 'health',
    'Comida Saudável': 'health',
    'Ejercicios en Casa': 'sports',
    'Home Workouts': 'sports',
    'Exercices à la maison': 'sports',
    'Übungen zu Hause': 'sports',
    'Exercícios em Casa': 'sports',
    'Vídeos Divertidos': 'videos',
    'Fun Videos': 'videos',
    'Vidéos amusantes': 'videos',
    'Lustige Videos': 'videos',
    'Guía': 'guide',
    'Guide': 'guide',
    'Leitfaden': 'guide',
    'Guia': 'guide',
    'Ficha Modelo': 'guide',
    'Model Card': 'guide',
    'Modellkarte': 'guide',
    'Fiche modèle': 'guide',
    'Ficha modelo': 'guide',
    'Sin categoría': 'uncategorized',
    'Sin clasificar': 'uncategorized',
    'Uncategorized': 'uncategorized',
    'Sans catégorie': 'uncategorized',
    'Ohne Kategorie': 'uncategorized',
    'Sem categoria': 'uncategorized',
  };

  function normalizeCategoryId(raw) {
    const value = String(raw || '').trim();
    if (!value) return UNCATEGORIZED_ID;
    if (SYSTEM_CATEGORY_KEYS.includes(value)) return value;
    if (LEGACY_CATEGORY_TO_KEY[value]) return LEGACY_CATEGORY_TO_KEY[value];
    return value;
  }

  function getCategoryLabel(categoryId) {
    const id = normalizeCategoryId(categoryId);
    if (!id) return t('categories.uncategorized');
    if (id === 'guide') return t('welcome.category');
    if (id === 'health') return t('categories.health');
    if (id === 'sports') return t('categories.sports');
    if (id === 'videos') return t('categories.videos');
    if (id === 'uncategorized') return t('categories.uncategorized');
    return id;
  }

  function getWelcomeTexts() {
    return {
      title: t('welcome.title'),
      description: t('welcome.description'),
      notes: t('welcome.notes'),
      category: t('welcome.category'),
    };
  }

  let cards = [{ ...WELCOME_CARD }];

  /** S1.4-A: borrador de Analyze/Preview. Nunca entra en `cards` ni en storage. */
  let previewDraft = null;
  const PREVIEW_DRAFT_TOKEN = '__inboxzero_preview_draft__';
  let previewSaveInFlight = false;
  /** Clave i18n del último error de Guardar Ficha (S1.4-C). */
  let previewSaveErrorKey = null;

  let currentFilter = 'all';
  let currentCategory = null;

  const cardsGrid = document.getElementById('cards-grid');
  const trialPlanText = document.getElementById('trial-plan-text');
  const progressFill = document.getElementById('progress-fill');
  const showingCounter = document.getElementById('showing-counter');
  const sectionTitle = document.getElementById('section-title');
  const urlInput = document.getElementById('url-input');
  const btnSave = document.getElementById('btn-save-card');

  function isGuideCard(card) {
    return Boolean(card && (card.isGuide || cardIdsEqual(card.id, WELCOME_CARD_ID)));
  }

  /** Solo fichas reales del usuario (la Guía nunca entra en métricas ni en el trial). */
  function userCards() {
    return cards.filter((c) => !isGuideCard(c));
  }

  /** La Guía queda siempre primera; las fichas nuevas van justo después. */
  function pinGuideFirst(userList) {
    const guide = cards.find(isGuideCard) || { ...WELCOME_CARD };
    const rest = (userList || userCards()).filter((c) => !isGuideCard(c));
    cards = [guide, ...rest];
    return cards;
  }

  function isDemoTestCard(card) {
    if (!card) return false;
    const title = String(card.title || '');
    const description = String(card.description || '');
    const url = String(card.url || '');
    return (
      /^Ficha de prueba #\d+/i.test(title) ||
      /ficticia generada para simular/i.test(description) ||
      /inboxzero\.es\/demo\//i.test(url)
    );
  }

  function serializeUserCards() {
    return userCards().map((c) => ({
      id: String(c.id),
      title: c.title,
      description: c.description,
      url: c.url,
      category: c.category,
      favorite: Boolean(c.favorite),
      readLater: Boolean(c.readLater),
      notes: c.notes || '',
      image: c.image,
      youtubeId: c.youtubeId || undefined,
      socialBrand: c.socialBrand || undefined,
    }));
  }

  /** Normaliza filas crudas de storage local (Guest o Legacy) al shape de UI. */
  function normalizeStoredCardRows(parsed) {
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((c) => c && typeof c === 'object' && !c.isGuide && !cardIdsEqual(c.id, WELCOME_CARD_ID))
      .filter((c) => !isDemoTestCard(c))
      .map((c) => ({
        id: normalizePersistedCardId(c.id),
        title: String(c.title || 'Sin título'),
        description: String(c.description || ''),
        url: String(c.url || 'https://inboxzero.es'),
        category: normalizeCategoryId(c.category) || UNCATEGORIZED_ID,
        favorite: Boolean(c.favorite),
        readLater: Boolean(c.readLater),
        notes: String(c.notes || ''),
        image: resolveDisplayImage(c.image, c.url),
        youtubeId: c.youtubeId || extractYoutubeVideoId(c.url) || undefined,
        socialBrand: c.socialBrand || detectSocialBrand(c.url) || undefined,
      }));
  }

  /** true cuando ya se resolvió Guest vs Cloud; bloquea escrituras durante el boot (DP5). */
  let librarySessionReady = false;

  /**
   * S1.3 — persistencia consciente de sesión.
   * Sin sesión → Guest. Con sesión → caché UID (nunca Legacy; nunca Guest con sesión).
   */
  function persistCards() {
    if (!librarySessionReady) return;
    const uid = currentAuthUser?.id ? String(currentAuthUser.id) : '';
    if (uid) {
      saveUserCardsCache(uid, serializeUserCards());
      return;
    }
    saveGuestCardsStorage(serializeUserCards());
  }

  /**
   * Carga local Guest (o Legacy solo-lectura si Guest vacío).
   * No usa caché UID ni Cloud — eso va por hydrateLibraryForAuthUser.
   */
  function loadCardsFromStorage() {
    const guestRaw = getGuestCardsStorage();
    const guestNormalized = normalizeStoredCardRows(guestRaw);
    if (guestNormalized && guestNormalized.length > 0) return guestNormalized;

    if (hasLegacyCardsStorage()) {
      const legacyNormalized = normalizeStoredCardRows(readLegacyCardsStorage());
      if (legacyNormalized && legacyNormalized.length > 0) return legacyNormalized;
    }

    if (guestNormalized) return guestNormalized;
    return null;
  }

  /** Mapea fila public.cards → shape UI (derivados FE en hidratación). */
  function mapCloudCardToUi(row) {
    const url = String(row?.url || '');
    return {
      id: String(row?.id || createCardId()),
      title: String(row?.title || ''),
      description: String(row?.description || ''),
      url,
      category: normalizeCategoryId(row?.category) || UNCATEGORIZED_ID,
      favorite: Boolean(row?.favorite),
      readLater: Boolean(row?.readLater),
      notes: String(row?.notes || ''),
      image: resolveDisplayImage(row?.image, url),
      youtubeId: extractYoutubeVideoId(url) || undefined,
      socialBrand: detectSocialBrand(url) || undefined,
      creado_en: row?.creado_en || undefined,
    };
  }

  function setLibraryBootLoading(active) {
    if (active) {
      if (sectionTitle) {
        sectionTitle.textContent = 'Cargando tu biblioteca...';
      }
      if (cardsGrid) {
        cardsGrid.innerHTML =
          '<p class="empty-state library-loading" role="status">Cargando tu biblioteca...</p>';
      }
      return;
    }
    // El contenido definitivo lo pinta renderCards(); aquí solo limpiamos el marker si quedara.
    const loadingEl = cardsGrid?.querySelector('.library-loading');
    if (loadingEl) loadingEl.remove();
  }

  function ensureWelcomeCardPresent() {
    if (!cards.some(isGuideCard)) {
      cards = [{ ...WELCOME_CARD }, ...cards.filter((c) => !isGuideCard(c))];
    } else {
      pinGuideFirst();
    }
  }

  // Boot S1.3 (DP5): solo guía hasta resolver Auth — no hidratar Guest/Legacy todavía.
  cards = [{ ...WELCOME_CARD }];
  setLibraryBootLoading(true);

  function isTrialLimitReached() {
    // S1.4-D: Premium ilimitado en UI. Sin tipo_plan (Guest / Offline) → tope 20.
    if (isPremiumPlan()) return false;
    return userCards().length >= TRIAL_MAX;
  }

  function libraryHasDuplicateUrl(url) {
    const key = normalizeUrlForDuplicateCheck(url);
    if (!key) return false;
    return userCards().some((card) => {
      const other = normalizeUrlForDuplicateCheck(card && card.url);
      return Boolean(other) && other === key;
    });
  }

  function openDuplicateUrlModal() {
    openModal('modal-duplicate-url');
  }

  function closeDuplicateUrlModal() {
    closeModal('modal-duplicate-url');
  }

  function openModal(modalId) {
    document.getElementById(modalId)?.classList.add('active');
  }

  function closeModal(modalId) {
    document.getElementById(modalId)?.classList.remove('active');
  }

  function openTrialLimitModal() {
    openModal('modal-trial-limit');
  }

  function openSubscribeModal() {
    closeModal('modal-trial-limit');
    openModal('modal-subscribe');
  }

  function updateTrialPlanLabel(current) {
    if (!trialPlanText) return;
    const progressBox = trialPlanText.closest('.progress-container');
    if (isPremiumPlan()) {
      progressBox?.classList.add('progress-container--unlimited');
      trialPlanText.removeAttribute('data-i18n-vars');
      trialPlanText.setAttribute('data-i18n', 'header.premiumPlan');
      trialPlanText.textContent = t('header.premiumPlan');
      if (progressFill) progressFill.style.width = '0%';
      return;
    }
    progressBox?.classList.remove('progress-container--unlimited');
    const vars = { current, max: TRIAL_MAX };
    trialPlanText.setAttribute('data-i18n', 'header.trialPlan');
    trialPlanText.setAttribute('data-i18n-vars', JSON.stringify(vars));
    trialPlanText.textContent = t('header.trialPlan', vars);
    if (progressFill) {
      progressFill.style.width = `${Math.min((current / TRIAL_MAX) * 100, 100)}%`;
    }
  }

  function updateShowingCounter(count) {
    if (!showingCounter) return;
    const vars = { count };
    showingCounter.setAttribute('data-i18n-vars', JSON.stringify(vars));
    showingCounter.textContent = t('main.showingCards', vars);
  }

  function updateSectionTitle() {
    if (!sectionTitle) return;
    if (currentCategory) {
      sectionTitle.textContent = t('sections.category', { name: getCategoryLabel(currentCategory) });
    } else if (currentFilter === 'favorites') {
      sectionTitle.textContent = t('sections.favorites');
    } else if (currentFilter === 'readLater') {
      sectionTitle.textContent = t('sections.readLater');
    } else {
      sectionTitle.textContent = t('sections.latest');
    }
  }

  function setBadgeText(el, value) {
    if (el) el.textContent = String(value);
  }

  function getActiveCategories() {
    const counts = new Map();
    userCards().forEach((card) => {
      const id = normalizeCategoryId(card.category);
      if (!id || id === 'guide') return;
      counts.set(id, (counts.get(id) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([id, count]) => ({
        id,
        name: id,
        label: getCategoryLabel(id),
        count,
      }))
      .sort((a, b) => {
        // "Sin clasificar" primero; el resto alfabético
        if (a.id === UNCATEGORIZED_ID) return -1;
        if (b.id === UNCATEGORIZED_ID) return 1;
        return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
      });
  }

  function populateEditCategorySelect(selectedId) {
    const select = document.getElementById('edit-category-select');
    if (!select) return;

    const categories = getActiveCategories();
    const selected = normalizeCategoryId(selectedId) || UNCATEGORIZED_ID;
    select.replaceChildren();

    // Opción por defecto siempre disponible y seleccionada si no hay otra
    const uncategorizedOpt = document.createElement('option');
    uncategorizedOpt.value = UNCATEGORIZED_ID;
    uncategorizedOpt.textContent = t('categories.uncategorized');
    select.appendChild(uncategorizedOpt);

    categories.forEach(({ id, label }) => {
      if (id === UNCATEGORIZED_ID) return; // ya añadida arriba
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = label;
      select.appendChild(opt);
    });

    // Si la ficha tiene una categoría real aún no listada, incluirla
    if (selected && selected !== 'guide' && selected !== UNCATEGORIZED_ID
        && !categories.some((c) => c.id === selected)) {
      const opt = document.createElement('option');
      opt.value = selected;
      opt.textContent = getCategoryLabel(selected);
      select.appendChild(opt);
    }

    if (selected && selected !== 'guide' && Array.from(select.options).some((o) => o.value === selected)) {
      select.value = selected;
    } else {
      select.value = UNCATEGORIZED_ID;
    }

    clearCategoryValidation();
  }

  function clearCategoryValidation() {
    const select = document.getElementById('edit-category-select');
    const newCatInput = document.getElementById('edit-new-category-input');
    const errorEl = document.getElementById('edit-category-error');
    const group = document.getElementById('edit-category-group');
    select?.classList.remove('is-invalid');
    newCatInput?.classList.remove('is-invalid');
    group?.classList.remove('has-error');
    if (errorEl) errorEl.hidden = true;
  }

  function showCategoryValidation() {
    const select = document.getElementById('edit-category-select');
    const newCatInput = document.getElementById('edit-new-category-input');
    const errorEl = document.getElementById('edit-category-error');
    const group = document.getElementById('edit-category-group');
    select?.classList.add('is-invalid');
    newCatInput?.classList.add('is-invalid');
    group?.classList.add('has-error');
    if (errorEl) {
      errorEl.textContent = t('edit.categoryRequired');
      errorEl.hidden = false;
    }
    select?.focus();
  }

  function selectCategoryFilter(categoryName) {
    currentCategory = normalizeCategoryId(categoryName);
    currentFilter = 'all';
    renderCards();
    document.querySelectorAll('.dropdown-wrapper').forEach((w) => w.classList.remove('active'));
  }

  function renderCategoryMenus() {
    const categories = getActiveCategories();
    const hasCategories = categories.length > 0;

    if (currentCategory && !categories.some((c) => c.id === currentCategory)) {
      currentCategory = null;
    }

    const sidebarList = document.getElementById('sidebar-category-list');
    const sidebarHeading = document.getElementById('sidebar-categories-heading');
    if (sidebarHeading) sidebarHeading.hidden = !hasCategories;
    if (sidebarList) {
      sidebarList.replaceChildren();
      categories.forEach(({ id, label, count }) => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = '#';
        link.className = `filter-cat${currentCategory === id ? ' active' : ''}`;
        link.dataset.cat = id;
        link.textContent = `📁 ${label}`;
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = String(count);
        li.append(link, ' ', badge);
        sidebarList.appendChild(li);
      });
    }

    const dropdownList = document.getElementById('dropdown-category-list');
    const dropdownDivider = document.getElementById('dropdown-categories-divider');
    const dropdownTitle = document.getElementById('dropdown-categories-title');
    if (dropdownDivider) dropdownDivider.hidden = !hasCategories;
    if (dropdownTitle) dropdownTitle.hidden = !hasCategories;
    if (dropdownList) {
      dropdownList.replaceChildren();
      categories.forEach(({ id, label, count }) => {
        const link = document.createElement('a');
        link.href = '#';
        link.className = 'filter-cat';
        link.dataset.cat = id;
        link.append(`📁 ${label} `);
        const badge = document.createElement('span');
        badge.className = 'badge';
        badge.textContent = String(count);
        link.appendChild(badge);
        dropdownList.appendChild(link);
      });
    }

    // Mantener el selector del modal sincronizado (vacío si no hay categorías reales)
    const editModal = document.getElementById('modal-edit');
    if (editModal?.classList.contains('active')) {
      const editingId = readDomCardId(document.getElementById('edit-card-id')?.value);
      if (previewDraft && isPreviewDraftToken(editingId)) {
        populateEditCategorySelect(previewDraft.category || UNCATEGORIZED_ID);
      } else {
        const editingCard = cards.find((c) => cardIdsEqual(c.id, editingId));
        populateEditCategorySelect(editingCard && !isGuideCard(editingCard) ? editingCard.category : '');
      }
    } else {
      populateEditCategorySelect('');
    }
  }

  function updateLibraryCounters() {
    const userOnly = userCards();
    const totalCount = userOnly.length;
    const favCount = userOnly.filter((c) => c.favorite).length;
    const readCount = userOnly.filter((c) => c.readLater).length;

    setBadgeText(document.getElementById('badge-all'), totalCount);
    setBadgeText(document.getElementById('badge-fav'), favCount);
    setBadgeText(document.getElementById('badge-read'), readCount);

    document.querySelectorAll('.filter-link[data-filter="all"] .badge').forEach((el) => {
      setBadgeText(el, totalCount);
    });
    document.querySelectorAll('.filter-link[data-filter="favorites"] .badge').forEach((el) => {
      setBadgeText(el, favCount);
    });
    document.querySelectorAll('.filter-link[data-filter="readLater"] .badge').forEach((el) => {
      setBadgeText(el, readCount);
    });

    renderCategoryMenus();
  }

  /** Contingencia solo si la ficha Facebook no tiene datos reales de ScrapingBee. */
  function normalizeFacebookCards() {
    userCards().forEach((card) => {
      if (detectSocialBrand(card.url) !== 'facebook') return;
      card.socialBrand = 'facebook';
      // No pisar extracción auténtica (título/portada reales de la página pública)
      if (card.facebookAuthentic) return;
      if (!card.title || isUglyFacebookTitle(card.title)) {
        card.title = getFacebookDefaultTitle();
      }
      if (isLegacyFacebookDescription(card.description)) {
        card.description = getFacebookDefaultDescription();
      }
      if (!card.image || isFacebookContingencyImage(card.image)) {
        card.image = getFacebookContingencyLogo();
      }
      card.facebookSmart = true;
    });
  }

  function renderCards() {
    ensureWelcomeCardPresent();
    normalizeFacebookCards();

    // Si la categoría activa ya no tiene fichas, volver a la vista general
    const activeCats = getActiveCategories();
    if (currentCategory && !activeCats.some((c) => c.id === currentCategory)) {
      currentCategory = null;
    }

    let filtered = cards.filter((card) => {
      // Guía fija: visible al inicio de "Últimas / Todas", nunca en fav, later ni categorías
      if (isGuideCard(card)) {
        return !currentCategory && currentFilter === 'all';
      }
      if (currentCategory) {
        return normalizeCategoryId(card.category) === currentCategory;
      }
      if (currentFilter === 'favorites') return card.favorite;
      if (currentFilter === 'readLater') return card.readLater;
      return true; // 'all'
    });

    // Garantizar que la Guía, si entra en la vista, va siempre la primera
    const guideInView = filtered.find(isGuideCard);
    if (guideInView) {
      filtered = [guideInView, ...filtered.filter((c) => !isGuideCard(c))];
    }

    cardsGrid.innerHTML = '';

    if (filtered.length === 0) {
      cardsGrid.innerHTML = `<p style="color: #6b7280; font-size: 14px; grid-column: 1/-1;">${t('main.emptyView')}</p>`;
    } else {
      filtered.forEach((card) => {
        const guide = isGuideCard(card);
        const welcome = guide ? getWelcomeTexts() : null;
        const displayTitle = welcome ? welcome.title : card.title;
        const displayDescription = welcome ? welcome.description : card.description;
        const displayCategory = welcome
          ? welcome.category
          : getCategoryLabel(card.category || UNCATEGORIZED_ID);
        const cardEl = document.createElement('div');
        cardEl.className = guide ? 'card-item card-item--guide' : 'card-item';
        cardEl.dataset.cardId = String(card.id);
        if (guide) cardEl.dataset.guide = '1';

        const deleteBtn = guide
          ? `<button type="button" class="card-btn-action card-btn-action--locked" disabled title="Ficha modelo: no se puede borrar">🔒</button>`
          : `<button type="button" class="card-btn-action" data-action="delete" data-id="${card.id}" title="${t('cards.deleteTitle')}">🗑️</button>`;

        const favBtn = guide
          ? ''
          : `<button type="button" class="card-btn-action ${card.favorite ? 'active-fav' : ''}" data-action="favorite" data-id="${card.id}" title="${t('cards.favoriteTitle')}">⭐</button>`;

        const readBtn = guide
          ? ''
          : `<button type="button" class="card-btn-action ${card.readLater ? 'active-read' : ''}" data-action="readLater" data-id="${card.id}" title="${t('cards.readLaterTitle')}">⏰</button>`;

        const thumbSrc = resolveDisplayImage(card.image, card.url);
        // Persistir resolución para que el dashboard no se quede en gris
        if (!guide && isUsableImageUrl(thumbSrc) && !isUsableImageUrl(card.image)) {
          card.image = thumbSrc;
        }
        const thumbAlt = escapeHtmlAttr(displayTitle || t('cards.thumbAlt') || 'Vista previa del enlace');
        const brand = card.socialBrand || detectSocialBrand(card.url);
        const brandThumb = Boolean(brand && isBrandLogoImage(thumbSrc));
        // Logo Wikimedia / SVG de contingencia Facebook (nunca YouTube / Unsplash)
        const fbLogoThumb = Boolean(
          brand === 'facebook' && isFacebookContingencyImage(thumbSrc)
        );
        const thumbClass = [
          'card-thumb',
          guide || (brandThumb && !fbLogoThumb) ? 'card-thumb--logo' : '',
          brandThumb && !fbLogoThumb ? `card-thumb--brand card-thumb--brand-${brand}` : '',
          fbLogoThumb ? 'card-thumb--facebook-smart object-contain bg-blue-50 p-4' : '',
        ].filter(Boolean).join(' ');

        cardEl.innerHTML = `
          <span class="card-top-tag">${displayCategory.toUpperCase()}</span>
          <div class="card-content-box">
            <img
              src="${escapeHtmlAttr(thumbSrc)}"
              class="${thumbClass}"
              alt="${thumbAlt}"
              data-page-url="${escapeHtmlAttr(card.url || '')}"
              loading="lazy"
              decoding="async"
              referrerpolicy="no-referrer"
              onerror="handleCardThumbError(this)"
            >
            <div class="card-details">
              <h3 class="card-title line-clamp-2">${escapeHtmlText(displayTitle)}</h3>
              <p class="card-desc line-clamp-3 text-sm text-gray-600">${escapeHtmlText(displayDescription)}</p>
              <a href="${escapeHtmlAttr(card.url)}" target="_blank" rel="noopener noreferrer" class="card-link">${escapeHtmlText(card.url)}</a>
            </div>
          </div>
          <div class="card-footer-actions">
            ${favBtn}
            ${readBtn}
            <button type="button" class="card-btn-action" data-action="edit" data-id="${card.id}" title="${t('cards.editTitle')}">✏️</button>
            ${deleteBtn}
          </div>
        `;
        cardsGrid.appendChild(cardEl);
      });
    }

    // Métricas: solo fichas reales (la Guía no suma)
    const trialCount = userCards().length;
    updateTrialPlanLabel(trialCount);
    const shownUserCount = filtered.filter((c) => !isGuideCard(c)).length;
    updateShowingCounter(
      currentFilter === 'all' && !currentCategory ? trialCount : shownUserCount
    );
    updateSectionTitle();
    updateLibraryCounters();
    persistCards();
  }

  /**
   * S1.3-FIX — hidratación tras Auth (fuera del auth lock).
   * Sesión: profile + cards Cloud (fuente de verdad) + caché UID.
   * Sin sesión: Guest/Legacy. No INSERT/UPDATE/DELETE Cloud.
   */
  async function hydrateLibraryForAuthUser(user) {
    const syncId = ++libraryHydrateGeneration;
    const uid = user?.id ? String(user.id) : '';

    try {
      if (!uid) {
        libraryCloudFetchBlocked = false;
        libraryCloudHydrateInFlight = false;
        currentProfile = null;
        const stored = loadCardsFromStorage() || [];
        if (syncId !== libraryHydrateGeneration) return;
        cards = [{ ...WELCOME_CARD }, ...stored];
        librarySessionReady = true;
        setLibraryBootLoading(false);
        renderCards();
        renderDashboardGreeting(null);
        return;
      }

      // S1.4-C: un GET Cloud; reentradas Offline → caché UID, sin nuevo GET.
      if (shouldSkipLibraryCloudFetch()) {
        if (syncId !== libraryHydrateGeneration) return;
        const cached = normalizeStoredCardRows(getUserCardsCache(uid)) || [];
        cards = [{ ...WELCOME_CARD }, ...cached];
        librarySessionReady = true;
        setLibraryBootLoading(false);
        renderCards();
        renderDashboardGreeting(user);
        return;
      }

      // Evitar flash Guest y escrituras mientras llega Cloud
      libraryCloudHydrateInFlight = true;
      librarySessionReady = false;
      cards = [{ ...WELCOME_CARD }];
      setLibraryBootLoading(true);

      // UID pasado explícitamente: no getSession dentro de los repos
      const [profileRes, cardsRes] = await Promise.all([
        fetchOwnProfileRepo(uid),
        fetchOwnCardsRepo(uid),
      ]);

      if (shouldBlockLibraryCloudFetch(profileRes, cardsRes)) {
        libraryCloudFetchBlocked = true;
      }

      if (syncId !== libraryHydrateGeneration) return;

      if (profileRes.ok && profileRes.data) {
        currentProfile = profileRes.data;
      } else {
        currentProfile = null;
      }

      let userRows = [];
      if (cardsRes.ok && Array.isArray(cardsRes.data)) {
        userRows = cardsRes.data.map(mapCloudCardToUi);
      } else {
        console.warn(
          '[InboxZero] No se pudo cargar cards Cloud; usando caché UID si existe.',
          cardsRes.code || cardsRes.error
        );
        userRows = normalizeStoredCardRows(getUserCardsCache(uid)) || [];
      }

      if (syncId !== libraryHydrateGeneration) return;

      cards = [{ ...WELCOME_CARD }, ...userRows];
      librarySessionReady = true;
      setLibraryBootLoading(false);
      renderCards();
      renderDashboardGreeting(user);
    } catch (err) {
      if (uid && (isBrowserOffline() || isLibraryCloudNetworkError(err))) {
        libraryCloudFetchBlocked = true;
      }
      console.warn('[InboxZero] Error en hidratación de biblioteca:', err);
      if (syncId !== libraryHydrateGeneration) return;

      // Recuperable: con sesión NO escribir Guest; usar caché UID o vacío
      currentProfile = null;
      if (uid) {
        const cached = normalizeStoredCardRows(getUserCardsCache(uid)) || [];
        cards = [{ ...WELCOME_CARD }, ...cached];
      } else {
        const stored = loadCardsFromStorage() || [];
        cards = [{ ...WELCOME_CARD }, ...stored];
      }
      librarySessionReady = true;
      setLibraryBootLoading(false);
      renderCards();
      renderDashboardGreeting(uid ? user : null);
    } finally {
      if (uid) libraryCloudHydrateInFlight = false;
      // Solo la generación activa puede cerrar loading / forzar ready
      if (syncId !== libraryHydrateGeneration) return;
      if (!librarySessionReady) {
        librarySessionReady = true;
        setLibraryBootLoading(false);
        ensureWelcomeCardPresent();
        renderCards();
      }
    }
  }

  libraryAuthSyncHandler = hydrateLibraryForAuthUser;
  setupSupabaseAuth();

  // S1.4-A: Analizar URL → Preview (borrador). Sin persistencia.
  if (btnSave && urlInput) {
    btnSave.addEventListener('click', async () => {
      const val = urlInput.value.trim();
      if (!val) {
        alert(t('messages.invalidUrlOrTitle'));
        return;
      }

      // S1.4-D: gate de Analyze (optimización). Guardar vuelve a comprobar.
      if (isTrialLimitReached()) {
        openTrialLimitModal();
        return;
      }

      let finalTitle = val;
      let finalUrl = val;
      let finalDesc = '';
      let finalImage = '';
      let youtubeId = null;
      let socialBrand = null;
      let microlinkOk = false;
      let facebookSmart = false;
      let facebookAuthentic = false;

      const prevBtnLabel = btnSave.textContent;
      btnSave.disabled = true;
      btnSave.setAttribute('aria-busy', 'true');

      try {
        if (val.startsWith('http://') || val.startsWith('https://')) {
          try {
            finalUrl = new URL(val).href;
          } catch (_) {
            finalUrl = val;
          }

          youtubeId = extractYoutubeVideoId(finalUrl);
          socialBrand = detectSocialBrand(finalUrl) || undefined;

          // Facebook páginas públicas → ScrapingBee (datos reales); si falla, contingencia
          try {
            const meta = await extractUrlMetadata(finalUrl);
            if (meta) {
              microlinkOk = true;
              facebookSmart = Boolean(meta.facebookSmart);
              facebookAuthentic = Boolean(meta.authentic);
              if (meta.title) finalTitle = meta.title;
              if (meta.description) finalDesc = meta.description;
              if (meta.image) finalImage = meta.image;
              if (meta.canonicalUrl) finalUrl = meta.canonicalUrl;
            }
          } catch (_) {
            microlinkOk = false;
          }

          if (socialBrand === 'facebook' && !facebookAuthentic) {
            const instant = getFacebookInstantMetadata(finalUrl);
            if (!finalTitle || isUglyFacebookTitle(finalTitle)) finalTitle = instant.title;
            if (!finalDesc || isLegacyFacebookDescription(finalDesc) || isGenericFacebookMeta('', finalDesc)) {
              finalDesc = instant.description;
            }
            if (!finalImage || isBrandLogoImage(finalImage)) finalImage = instant.image;
            facebookSmart = true;
            microlinkOk = true;
          }

          if (!microlinkOk || !finalTitle) {
            try {
              finalTitle = finalTitle || new URL(finalUrl).hostname;
            } catch (_) {
              finalTitle = finalTitle || finalUrl;
            }
          }
          if (!finalDesc) finalDesc = '';
          if (!finalImage && youtubeId && socialBrand !== 'facebook') {
            finalImage = getYoutubeThumbUrl(youtubeId, 'hqdefault');
          }
          // Facebook: nunca YouTube/Unsplash; logo Wikimedia de contingencia
          if (socialBrand === 'facebook' && (!finalImage || isFacebookContingencyImage(finalImage))) {
            if (!facebookAuthentic) {
              finalImage = getFacebookContingencyLogo();
              facebookSmart = true;
            }
          }
          // Último recurso visual: favicon del dominio (evita preview en blanco)
          if (!isUsableImageUrl(finalImage)) {
            finalImage = resolveDisplayImage('', finalUrl);
          }

          // YouTube: oEmbed al draft (antes del Preview). No escribe cards ni Cloud.
          if (youtubeId && socialBrand !== 'facebook') {
            try {
              const ytMeta = await fetchYoutubeOEmbed(finalUrl);
              if (ytMeta?.title && (!microlinkOk || !finalTitle || /Video de YouTube \(ID:|Recursos de youtube|Resources from youtube/i.test(finalTitle))) {
                finalTitle = String(ytMeta.title);
              }
              if (ytMeta?.author_name && !finalDesc) {
                finalDesc = t('messages.youtubeFromAuthor', { author: ytMeta.author_name });
              }
              if (ytMeta?.thumbnail_url && isUsableImageUrl(ytMeta.thumbnail_url)) {
                if (!isUsableImageUrl(finalImage) || /ytimg\.com\/vi\//i.test(String(finalImage))) {
                  finalImage = String(ytMeta.thumbnail_url);
                }
              }
            } catch (_) {
              /* Preview con lo ya extraído */
            }
          }
        } else {
          finalUrl =
            'https://inboxzero.es/recurso/' +
            encodeURIComponent(val.toLowerCase().replace(/\s+/g, '-'));
          finalDesc = t('messages.manualCardDesc');
          if (!isUsableImageUrl(finalImage)) {
            finalImage = CARD_THUMB_PLACEHOLDER;
          }
        }

        const draft = {
          title: finalTitle,
          description: finalDesc,
          url: finalUrl,
          category: normalizeCategoryId(currentCategory) || UNCATEGORIZED_ID,
          favorite: false,
          readLater: false,
          notes: '',
          image: resolveDisplayImage(finalImage, finalUrl),
          youtubeId: youtubeId || undefined,
          socialBrand: socialBrand || undefined,
          facebookSmart: facebookSmart || undefined,
          facebookAuthentic: facebookAuthentic || undefined,
        };

        openPreviewModal(draft);
      } catch (_) {
        /* S1.4-A: no emergency-create; el Analyze no persiste */
      } finally {
        btnSave.disabled = false;
        btnSave.removeAttribute('aria-busy');
        btnSave.textContent = t('main.analyzeUrl');
        if (prevBtnLabel && !btnSave.textContent) btnSave.textContent = prevBtnLabel;
      }
    });

    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') btnSave.click();
    });
  }

  async function enrichYoutubeCardMetadata(cardId, pageUrl, videoId) {
    const meta = await fetchYoutubeOEmbed(pageUrl);
    const card = cards.find((c) => cardIdsEqual(c.id, cardId));
    if (!card || isGuideCard(card)) return;

    let changed = false;

    if (meta?.title) {
      card.title = String(meta.title);
      changed = true;
    }

    if (meta?.author_name) {
      card.description = t('messages.youtubeFromAuthor', { author: meta.author_name });
      changed = true;
    }

    if (meta?.thumbnail_url) {
      card.image = String(meta.thumbnail_url);
      changed = true;
    } else if (!/i\.ytimg\.com\/vi\//i.test(String(card.image || ''))) {
      card.image = getYoutubeThumbUrl(videoId, 'maxresdefault');
      changed = true;
    }

    card.youtubeId = videoId;

    if (!changed) return;

    persistCards();
    renderCards();

    // Si el modal de edición está abierto para esta ficha, refrescar con datos reales
    const editModal = document.getElementById('modal-edit');
    const editingId = readDomCardId(document.getElementById('edit-card-id')?.value);
    if (editModal?.classList.contains('active') && cardIdsEqual(editingId, cardId)) {
      openEditModal(cardId);
    }
  }

  function toggleFavorite(id) {
    const card = cards.find((c) => cardIdsEqual(c.id, id));
    if (!card || isGuideCard(card)) return;
    card.favorite = !card.favorite;
    renderCards();
  }

  function toggleReadLater(id) {
    const card = cards.find((c) => cardIdsEqual(c.id, id));
    if (!card || isGuideCard(card)) return;
    card.readLater = !card.readLater;
    renderCards();
  }

  let pendingDeleteId = null;

  function closeDeleteConfirmModal() {
    pendingDeleteId = null;
    closeModal('modal-confirm-delete');
  }

  function openDeleteConfirmModal(id) {
    const card = cards.find((c) => cardIdsEqual(c.id, id));
    if (!card || isGuideCard(card)) return;
    pendingDeleteId = id;
    openModal('modal-confirm-delete');
  }

  function confirmDeleteCard() {
    if (pendingDeleteId == null) return;
    const id = pendingDeleteId;
    pendingDeleteId = null;
    cards = cards.filter((c) => !cardIdsEqual(c.id, id));
    ensureWelcomeCardPresent();
    closeModal('modal-confirm-delete');
    renderCards();
  }

  /** Abre el modal de confirmación (sin confirm() nativo del navegador) */
  function deleteCard(id) {
    openDeleteConfirmModal(id);
  }

  function updateEditPreview(imageUrl, pageUrl, options = {}) {
    const preview = document.getElementById('edit-preview-img');
    const previewFrame = preview?.closest('.edit-preview-frame');
    if (!preview) return;

    const guide = Boolean(options.guide);
    const brand = options.brand || detectSocialBrand(pageUrl);
    // Modal: vacío → placeholder; URL usable → exactamente esa (sin favicon/YT de pageUrl)
    const rawImage = String(imageUrl ?? '').trim();
    let resolved;
    if (!rawImage) {
      resolved = CARD_THUMB_PLACEHOLDER;
    } else if (isUsableImageUrl(rawImage)) {
      resolved = rawImage;
    } else {
      resolved = resolveDisplayImage(rawImage, pageUrl);
    }

    preview.onerror = function onPreviewError() {
      handleCardThumbError(this);
    };
    preview.referrerPolicy = 'no-referrer';
    preview.dataset.pageUrl = String(pageUrl || '');
    preview.removeAttribute('data-fallback-applied');
    preview.removeAttribute('data-yt-hq-tried');
    preview.removeAttribute('data-favicon-tried');
    preview.classList.remove('card-thumb--fallback');
    preview.removeAttribute('aria-hidden');

    const isBrand = Boolean(brand && isBrandLogoImage(resolved) && brand !== 'facebook');
    const isFbLogoPreview = Boolean(
      brand === 'facebook' && isFacebookContingencyImage(resolved)
    );
    const isLogo =
      guide ||
      /logo\.png$/i.test(String(resolved || '')) ||
      (isBrandLogoImage(resolved) && !isBrand && !isFbLogoPreview);

    preview.classList.toggle('edit-preview-large--logo', isLogo && !isBrand && !isFbLogoPreview);
    preview.classList.toggle('edit-preview--brand', isBrand && !isFbLogoPreview);
    preview.classList.toggle('edit-preview--facebook-smart', isFbLogoPreview);
    preview.classList.toggle('object-contain', isFbLogoPreview);
    preview.classList.toggle('edit-preview--photo', !isLogo && !isBrand && !isFbLogoPreview);
    ['facebook', 'instagram', 'linkedin', 'twitter'].forEach((b) => {
      preview.classList.toggle(`edit-preview--brand-${b}`, brand === b && isBrand && !isFbLogoPreview);
    });

    if (previewFrame) {
      previewFrame.classList.toggle('edit-preview-frame--logo', isLogo && !isBrand && !isFbLogoPreview);
      previewFrame.classList.toggle('edit-preview-frame--brand', isBrand && !isFbLogoPreview);
      previewFrame.classList.toggle('edit-preview-frame--facebook-smart', isFbLogoPreview);
      previewFrame.classList.toggle('edit-preview-frame--photo', !isLogo && !isBrand && !isFbLogoPreview);
      previewFrame.classList.toggle('bg-blue-50', isFbLogoPreview);
      previewFrame.classList.toggle('p-4', isFbLogoPreview);
      ['facebook', 'instagram', 'linkedin', 'twitter'].forEach((b) => {
        previewFrame.classList.toggle(
          `edit-preview-frame--brand-${b}`,
          brand === b && isBrand && !isFbLogoPreview
        );
      });
    }

    // Forzar recarga visual aunque la URL sea la misma
    if (preview.getAttribute('src') === resolved) {
      preview.removeAttribute('src');
    }
    preview.src = resolved;
    return resolved;
  }

  function restoreEditSaveButton() {
    const btn = document.getElementById('btn-save-edit');
    if (!btn) return;
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('title');
    btn.setAttribute('data-i18n', 'edit.saveChanges');
    btn.removeAttribute('data-i18n-title');
    btn.textContent = t('edit.saveChanges');
  }

  function applyPreviewSaveButtonState() {
    const btn = document.getElementById('btn-save-edit');
    if (!btn) return;
    btn.disabled = false;
    btn.removeAttribute('aria-disabled');
    btn.removeAttribute('title');
    btn.removeAttribute('data-i18n-title');
    btn.setAttribute('data-i18n', 'main.saveCard');
    btn.textContent = t('main.saveCard');
  }

  function ensurePreviewSaveErrorEl() {
    let el = document.getElementById('preview-save-error');
    if (el) return el;
    el = document.createElement('p');
    el.id = 'preview-save-error';
    el.className = 'field-error preview-save-error';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    const actions = document.querySelector('#modal-edit .edit-modal-actions');
    if (actions?.parentElement) {
      actions.parentElement.insertBefore(el, actions);
    } else {
      document.querySelector('#modal-edit .edit-modal-fields')?.appendChild(el);
    }
    return el;
  }

  function clearPreviewSaveError() {
    previewSaveErrorKey = null;
    const el = document.getElementById('preview-save-error');
    if (!el) return;
    el.hidden = true;
    el.setAttribute('hidden', '');
    el.style.removeProperty('display');
    el.textContent = '';
    el.removeAttribute('data-i18n');
  }

  function setPreviewSaveError(key) {
    previewSaveErrorKey = key;
    const el = ensurePreviewSaveErrorEl();
    if (!el) return;
    el.removeAttribute('hidden');
    el.hidden = false;
    el.style.display = 'block';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'assertive');
    el.setAttribute('data-i18n', key);
    el.textContent = t(key);
    try {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    } catch (_) {
      /* ignore */
    }
  }

  function failClosedPreviewSave(code) {
    if (code === 'INSERT_LIMIT') {
      setPreviewSaveError('messages.saveErrorLimit');
      openTrialLimitModal();
      return;
    }
    if (code === 'NO_SESSION') {
      setPreviewSaveError('messages.saveErrorSession');
      return;
    }
    if (code === 'INSERT_NETWORK') {
      setPreviewSaveError('messages.saveErrorNetwork');
      return;
    }
    setPreviewSaveError('messages.saveErrorGeneric');
  }

  function discardPreviewDraft() {
    previewDraft = null;
    restoreEditSaveButton();
    const modal = document.getElementById('modal-edit');
    if (!modal?.classList.contains('active')) clearPreviewSaveError();
  }

  function isPreviewDraftToken(id) {
    return String(id || '') === PREVIEW_DRAFT_TOKEN;
  }

  function syncPreviewDraftFromForm() {
    if (!previewDraft) return;
    previewDraft.title = document.getElementById('edit-title-input')?.value || previewDraft.title;
    previewDraft.description = document.getElementById('edit-desc-input')?.value || '';
    const newCat = document.getElementById('edit-new-category-input')?.value.trim();
    const selected = document.getElementById('edit-category-select')?.value;
    previewDraft.category = newCat
      ? (normalizeCategoryId(newCat) || newCat)
      : (normalizeCategoryId(selected) || previewDraft.category || UNCATEGORIZED_ID);
    const imageVal = (document.getElementById('edit-image-input')?.value || '').trim();
    previewDraft.image = resolveDisplayImage(imageVal || previewDraft.image, previewDraft.url);
    previewDraft.favorite = Boolean(document.getElementById('edit-fav-check')?.checked);
    previewDraft.readLater = Boolean(document.getElementById('edit-read-check')?.checked);
    previewDraft.notes = document.getElementById('edit-notes-input')?.value || '';
  }

  function buildGuestCardFromDraft(draft) {
    return {
      id: createCardId(),
      title: draft.title || '',
      description: draft.description || '',
      url: draft.url || '',
      category: normalizeCategoryId(draft.category) || UNCATEGORIZED_ID,
      favorite: Boolean(draft.favorite),
      readLater: Boolean(draft.readLater),
      notes: draft.notes || '',
      image: resolveDisplayImage(draft.image, draft.url),
      youtubeId: draft.youtubeId || extractYoutubeVideoId(draft.url) || undefined,
      socialBrand: draft.socialBrand || detectSocialBrand(draft.url) || undefined,
      facebookSmart: draft.facebookSmart || undefined,
      facebookAuthentic: draft.facebookAuthentic || undefined,
    };
  }

  /**
   * S1.4-B/C/D: persiste el Preview. Guest → local; Auth → INSERT Cloud.
   * Orden Guardar: in-flight → sync → límite → duplicado → persistencia B → errores C.
   * Fallo → FAIL CLOSED: no ficha fantasma, Preview y draft intactos, reintento.
   */
  async function savePreviewDraftFromModal(options) {
    if (previewSaveInFlight) return;
    if (!previewDraft) {
      failClosedPreviewSave(currentAuthUser?.id ? 'INSERT_NETWORK' : 'INSERT_ERROR');
      return;
    }
    previewSaveInFlight = true;
    const btn = document.getElementById('btn-save-edit');
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    clearPreviewSaveError();
    try {
      syncPreviewDraftFromForm();
      const draft = previewDraft;
      if (!draft) {
        failClosedPreviewSave('INSERT_ERROR');
        return;
      }

      if (isTrialLimitReached()) {
        failClosedPreviewSave('INSERT_LIMIT');
        return;
      }

      if (!(options && options.allowDuplicate) && libraryHasDuplicateUrl(draft.url)) {
        openDuplicateUrlModal();
        return;
      }

      const uid = currentAuthUser?.id ? String(currentAuthUser.id) : '';

      if (uid) {
        const result = await insertOwnCardRepo({
          title: draft.title || '',
          description: draft.description || '',
          url: draft.url || '',
          category: draft.category || UNCATEGORIZED_ID,
          favorite: Boolean(draft.favorite),
          readLater: Boolean(draft.readLater),
          notes: draft.notes || '',
          image: draft.image || '',
        });
        if (!result.ok || !result.data || !result.data.id) {
          failClosedPreviewSave(result.code || 'INSERT_ERROR');
          return;
        }
        try {
          const uiCard = mapCloudCardToUi(result.data);
          pinGuideFirst([uiCard, ...userCards()]);
          renderCards();
        } finally {
          document.getElementById('modal-edit')?.classList.remove('active');
          discardPreviewDraft();
        }
        return;
      }

      const newCard = buildGuestCardFromDraft(draft);
      const stored = serializeUserCards().concat([
        {
          id: String(newCard.id),
          title: newCard.title,
          description: newCard.description,
          url: newCard.url,
          category: newCard.category,
          favorite: Boolean(newCard.favorite),
          readLater: Boolean(newCard.readLater),
          notes: newCard.notes || '',
          image: newCard.image,
          youtubeId: newCard.youtubeId,
          socialBrand: newCard.socialBrand,
        },
      ]);
      const written = saveGuestCardsStorage(stored);
      if (!written) {
        failClosedPreviewSave('INSERT_ERROR');
        return;
      }
      try {
        pinGuideFirst([newCard, ...userCards()]);
        renderCards();
      } finally {
        document.getElementById('modal-edit')?.classList.remove('active');
        discardPreviewDraft();
      }
    } catch (_) {
      if (previewDraft) {
        failClosedPreviewSave(currentAuthUser?.id ? 'INSERT_NETWORK' : 'INSERT_ERROR');
      }
    } finally {
      previewSaveInFlight = false;
      if (btn) btn.removeAttribute('aria-busy');
      if (previewDraft) applyPreviewSaveButtonState();
    }
  }

  /** S1.4-A: Preview editable desde draft. No toca `cards` ni storage. */
  function openPreviewModal(draft, options) {
    const modal = document.getElementById('modal-edit');
    if (!modal || !draft) return;

    previewDraft = draft;
    if (!options?.keepError) clearPreviewSaveError();

    const setValue = (elId, value) => {
      const el = document.getElementById(elId);
      if (el) el.value = value;
    };
    const setChecked = (elId, value) => {
      const el = document.getElementById(elId);
      if (el) el.checked = value;
    };

    const pageUrl = String(previewDraft.url || '');
    const ytId = previewDraft.youtubeId || extractYoutubeVideoId(pageUrl);
    const socialForThumb = detectSocialBrand(pageUrl);
    if (ytId && socialForThumb !== 'facebook') {
      previewDraft.youtubeId = ytId;
      if (!isUsableImageUrl(previewDraft.image) || /unsplash\.com/i.test(String(previewDraft.image || ''))) {
        previewDraft.image = getYoutubeThumbUrl(ytId, 'hqdefault');
      }
    }
    previewDraft.socialBrand = previewDraft.socialBrand || socialForThumb || undefined;

    const isFacebookCard = detectSocialBrand(pageUrl) === 'facebook';
    if (isFacebookCard) {
      previewDraft.socialBrand = 'facebook';
      previewDraft.youtubeId = undefined;
      if (!previewDraft.facebookAuthentic || isFacebookContingencyImage(previewDraft.image)) {
        if (!previewDraft.title || isUglyFacebookTitle(previewDraft.title)) {
          previewDraft.title = getFacebookDefaultTitle();
        }
        if (isLegacyFacebookDescription(previewDraft.description)) {
          previewDraft.description = getFacebookDefaultDescription();
        }
        if (!previewDraft.image || isFacebookContingencyImage(previewDraft.image)) {
          previewDraft.image = getFacebookContingencyLogo();
        }
        if (isFacebookContingencyImage(previewDraft.image)) {
          previewDraft.facebookAuthentic = false;
          previewDraft.facebookSmart = true;
        }
      } else {
        previewDraft.facebookSmart = false;
      }
    }

    const previewImage = resolveDisplayImage(
      isFacebookCard ? (previewDraft.image || getFacebookContingencyLogo()) : previewDraft.image,
      pageUrl
    );
    if (isUsableImageUrl(previewImage)) {
      previewDraft.image = previewImage;
    }

    setValue('edit-card-id', PREVIEW_DRAFT_TOKEN);
    setValue('edit-title-input', previewDraft.title || '');
    setValue('edit-desc-input', previewDraft.description || '');
    populateEditCategorySelect(previewDraft.category || UNCATEGORIZED_ID);
    setValue('edit-new-category-input', '');
    setValue('edit-image-input', previewImage === CARD_THUMB_PLACEHOLDER ? '' : previewImage);
    updateEditPreview(previewImage, pageUrl, {
      guide: false,
      brand: previewDraft.socialBrand || socialForThumb,
    });
    setValue('edit-notes-input', previewDraft.notes || '');
    setChecked('edit-fav-check', Boolean(previewDraft.favorite));
    setChecked('edit-read-check', Boolean(previewDraft.readLater));

    const visitLink = document.getElementById('edit-visit-link');
    if (visitLink) visitLink.href = pageUrl || '#';

    applyPreviewSaveButtonState();
    modal.classList.add('active');

    const focusTitle = () => {
      const titleInput = document.getElementById('edit-title-input');
      if (!titleInput) return;
      titleInput.focus({ preventScroll: true });
      titleInput.select();
    };
    requestAnimationFrame(() => {
      focusTitle();
      setTimeout(focusTitle, 40);
    });
  }

  function openEditModal(id) {
    discardPreviewDraft();
    clearPreviewSaveError();
    const card = cards.find((c) => cardIdsEqual(c.id, id));
    const modal = document.getElementById('modal-edit');
    if (!card || !modal) return;

    const setValue = (elId, value) => {
      const el = document.getElementById(elId);
      if (el) el.value = value;
    };
    const setChecked = (elId, value) => {
      const el = document.getElementById(elId);
      if (el) el.checked = value;
    };

    const guide = isGuideCard(card);
    const welcome = guide ? getWelcomeTexts() : null;

    setValue('edit-card-id', card.id);
    setValue('edit-title-input', welcome ? welcome.title : card.title);
    setValue('edit-desc-input', welcome ? welcome.description : card.description);
    populateEditCategorySelect(guide ? UNCATEGORIZED_ID : (card.category || UNCATEGORIZED_ID));
    setValue('edit-new-category-input', welcome ? welcome.category : '');

    // YouTube: miniatura nativa si aún no hay imagen (Microlink tiene prioridad al guardar)
    if (!guide) {
      const ytId = card.youtubeId || extractYoutubeVideoId(card.url);
      const socialForThumb = detectSocialBrand(card.url);
      // Nunca asignar miniatura YouTube a fichas Facebook
      if (ytId && socialForThumb !== 'facebook') {
        card.youtubeId = ytId;
        if (!isUsableImageUrl(card.image) || /unsplash\.com/i.test(String(card.image || ''))) {
          card.image = getYoutubeThumbUrl(ytId, 'hqdefault');
        }
      }
      card.socialBrand = card.socialBrand || socialForThumb || undefined;
    }

    const isFacebookCard = !guide && detectSocialBrand(card.url) === 'facebook';

    // Facebook: datos reales de ScrapingBee si existen; si no, logo Wikimedia oficial
    if (isFacebookCard) {
      card.socialBrand = 'facebook';
      card.youtubeId = undefined;
      if (!card.facebookAuthentic || isFacebookContingencyImage(card.image)) {
        if (!card.title || isUglyFacebookTitle(card.title)) {
          card.title = getFacebookDefaultTitle();
        }
        if (isLegacyFacebookDescription(card.description)) {
          card.description = getFacebookDefaultDescription();
        }
        if (!card.image || isFacebookContingencyImage(card.image)) {
          card.image = getFacebookContingencyLogo();
        }
        if (isFacebookContingencyImage(card.image)) {
          card.facebookAuthentic = false;
          card.facebookSmart = true;
        }
      } else {
        card.facebookSmart = false;
      }
      setValue('edit-title-input', card.title);
      setValue('edit-desc-input', card.description);
    }

    // Siempre una imagen visible en preview + input (nunca src vacío)
    const previewImage = resolveDisplayImage(
      isFacebookCard ? (card.image || getFacebookContingencyLogo()) : card.image,
      card.url
    );
    if (!guide && isUsableImageUrl(previewImage)) {
      card.image = previewImage;
    }
    setValue('edit-image-input', previewImage === CARD_THUMB_PLACEHOLDER ? '' : previewImage);
    updateEditPreview(previewImage, card.url, {
      guide,
      brand: card.socialBrand || detectSocialBrand(card.url),
    });

    setValue('edit-notes-input', welcome ? welcome.notes : (card.notes || ''));

    setChecked('edit-fav-check', guide ? false : card.favorite);
    setChecked('edit-read-check', guide ? false : card.readLater);

    const visitLink = document.getElementById('edit-visit-link');
    if (visitLink) visitLink.href = card.url;

    modal.classList.add('active');

    // Título enfocado y totalmente seleccionado para sobrescribir al instante
    if (!guide) {
      const focusTitle = () => {
        const titleInput = document.getElementById('edit-title-input');
        if (!titleInput) return;
        titleInput.focus({ preventScroll: true });
        titleInput.select();
      };
      requestAnimationFrame(() => {
        focusTitle();
        setTimeout(focusTitle, 40);
      });
    }

    // Si es YouTube y aún tiene título genérico, enriquecer en caliente
    if (!guide) {
      const ytId = card.youtubeId || extractYoutubeVideoId(card.url);
      if (ytId && (!card.title || /Recursos de youtube|Resources from youtube|Video de YouTube \(ID:/i.test(card.title))) {
        enrichYoutubeCardMetadata(card.id, card.url, ytId);
      }
    }
  }

  // Reconectar acciones de tarjeta por delegación (evita onclick inline rotos)
  if (cardsGrid && !cardsGrid.dataset.actionsBound) {
    cardsGrid.dataset.actionsBound = '1';
    cardsGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action][data-id]');
      if (!btn || !cardsGrid.contains(btn)) return;

      const action = btn.getAttribute('data-action');
      const id = readDomCardId(btn.getAttribute('data-id'));
      if (!id) return;

      e.preventDefault();
      e.stopPropagation();

      if (action === 'favorite') toggleFavorite(id);
      else if (action === 'readLater') toggleReadLater(id);
      else if (action === 'edit') openEditModal(id);
      else if (action === 'delete') deleteCard(id);
    });
  }

  document.getElementById('btn-confirm-delete')?.addEventListener('click', () => {
    confirmDeleteCard();
  });

  document.getElementById('modal-confirm-delete')?.addEventListener('click', (e) => {
    // Clic fuera del cuadro: cerrar sin borrar
    if (e.target.id === 'modal-confirm-delete') {
      closeDeleteConfirmModal();
    }
  });

  document.querySelectorAll('[data-close="modal-confirm-delete"]').forEach((el) => {
    el.addEventListener('click', () => {
      pendingDeleteId = null;
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const deleteModal = document.getElementById('modal-confirm-delete');
    if (deleteModal?.classList.contains('active')) {
      closeDeleteConfirmModal();
      return;
    }
    const retentionModal = document.getElementById('modal-retention');
    if (retentionModal?.classList.contains('active')) {
      closeRetentionModal();
      return;
    }
    const editModalEsc = document.getElementById('modal-edit');
    if (editModalEsc?.classList.contains('active')) {
      editModalEsc.classList.remove('active');
      discardPreviewDraft();
    }
  });

  // Modal de retención inteligente (baja de suscripción)
  function resetRetentionModalView() {
    const formView = document.getElementById('retention-form-view');
    const successView = document.getElementById('retention-success-view');
    if (formView) formView.hidden = false;
    if (successView) successView.hidden = true;
    document.querySelectorAll('input[name="retention-reason"]').forEach((input) => {
      input.checked = false;
    });
  }

  function openRetentionModal() {
    resetRetentionModalView();
    openModal('modal-retention');
  }

  function closeRetentionModal() {
    closeModal('modal-retention');
    resetRetentionModalView();
  }

  function getRetentionReasons() {
    return Array.from(document.querySelectorAll('input[name="retention-reason"]:checked')).map(
      (el) => el.value
    );
  }

  function confirmRetentionCancel() {
    const reasons = getRetentionReasons();
    console.log('[InboxZero] Solicitud de baja de suscripción', {
      reasons,
      at: new Date().toISOString(),
    });

    const formView = document.getElementById('retention-form-view');
    const successView = document.getElementById('retention-success-view');
    if (formView) formView.hidden = true;
    if (successView) successView.hidden = false;

    window.setTimeout(() => {
      closeRetentionModal();
    }, 2200);
  }

  document.getElementById('btn-unsubscribe-side')?.addEventListener('click', (e) => {
    e.preventDefault();
    openRetentionModal();
  });

  document.getElementById('btn-retention-keep')?.addEventListener('click', () => {
    closeRetentionModal();
  });

  document.getElementById('btn-retention-support')?.addEventListener('click', () => {
    console.log('[InboxZero] Retención: usuario eligió hablar con soporte');
    closeRetentionModal();
  });

  document.getElementById('btn-retention-confirm')?.addEventListener('click', () => {
    confirmRetentionCancel();
  });

  document.getElementById('btn-retention-success-close')?.addEventListener('click', () => {
    closeRetentionModal();
  });

  document.getElementById('modal-retention')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-retention') {
      closeRetentionModal();
    }
  });

  document.querySelectorAll('[data-close="modal-retention"]').forEach((el) => {
    el.addEventListener('click', () => {
      closeRetentionModal();
    });
  });

  // Compatibilidad por si algún markup antiguo aún usa window.*
  window.toggleFavorite = toggleFavorite;
  window.toggleReadLater = toggleReadLater;
  window.deleteCard = deleteCard;
  window.openEditModal = openEditModal;

  const btnDuplicateSaveAnyway = document.getElementById('btn-duplicate-save-anyway');
  if (btnDuplicateSaveAnyway) {
    btnDuplicateSaveAnyway.addEventListener('click', () => {
      closeDuplicateUrlModal();
      savePreviewDraftFromModal({ allowDuplicate: true });
    });
  }

  const btnSaveEdit = document.getElementById('btn-save-edit');
  if (btnSaveEdit) {
    btnSaveEdit.addEventListener('click', () => {
      const id = readDomCardId(document.getElementById('edit-card-id')?.value);
      if (previewDraft || isPreviewDraftToken(id)) {
        savePreviewDraftFromModal();
        return;
      }
      const card = cards.find((c) => cardIdsEqual(c.id, id));
      if (!card) {
        failClosedPreviewSave(currentAuthUser?.id ? 'INSERT_NETWORK' : 'INSERT_ERROR');
        return;
      }

      // La ficha guía permanece blindada: textos viven en i18n (welcome.*), no se fijan en español
      if (isGuideCard(card)) {
        const imageVal = document.getElementById('edit-image-input')?.value;
        if (imageVal !== undefined && imageVal.trim()) {
          card.image = imageVal.trim();
          const preview = document.getElementById('edit-preview-img');
          if (preview) preview.src = card.image;
        }
        card.title = '';
        card.description = '';
        card.notes = '';
        card.favorite = false;
        card.readLater = false;
        card.isGuide = true;
        card.category = 'guide';
        document.getElementById('modal-edit')?.classList.remove('active');
        renderCards();
        return;
      }

      card.title = document.getElementById('edit-title-input')?.value || card.title;
      card.description = document.getElementById('edit-desc-input')?.value || card.description;

      const newCat = document.getElementById('edit-new-category-input')?.value.trim();
      const selected = document.getElementById('edit-category-select')?.value;
      // Por defecto: "Sin clasificar" si no elige ni escribe otra
      const resolvedCategory = newCat
        ? (normalizeCategoryId(newCat) || newCat)
        : (normalizeCategoryId(selected) || UNCATEGORIZED_ID);

      clearCategoryValidation();
      card.category = resolvedCategory;

      const imageVal = (document.getElementById('edit-image-input')?.value || '').trim();
      if (detectSocialBrand(card.url) === 'facebook') {
        card.socialBrand = 'facebook';
        card.youtubeId = undefined;
        if (imageVal && !isFacebookContingencyImage(imageVal) && !/ytimg\.com|unsplash\.com/i.test(imageVal)) {
          card.image = imageVal;
        } else if (
          card.facebookAuthentic &&
          isAuthenticFacebookImage(card.image) &&
          !isFacebookContingencyImage(card.image)
        ) {
          /* conservar portada real extraída */
        } else {
          card.image = getFacebookContingencyLogo();
        }
        const hasReal =
          !isFacebookContingencyImage(card.image) &&
          (card.facebookAuthentic ||
            (isAuthenticFacebookTitle(card.title) && isAuthenticFacebookImage(card.image)));
        card.facebookSmart = !hasReal;
        card.facebookAuthentic = Boolean(hasReal);
        if (!hasReal) {
          if (isLegacyFacebookDescription(card.description)) {
            card.description = getFacebookDefaultDescription();
          }
          if (!card.title || isUglyFacebookTitle(card.title)) {
            card.title = getFacebookDefaultTitle();
          }
        }
      } else {
        // Mantener imagen previa si el input queda vacío; si no, favicon/placeholder
        card.image = resolveDisplayImage(imageVal || card.image, card.url);
      }
      updateEditPreview(card.image, card.url, {
        brand: card.socialBrand || detectSocialBrand(card.url),
      });

      card.favorite = Boolean(document.getElementById('edit-fav-check')?.checked);
      card.readLater = Boolean(document.getElementById('edit-read-check')?.checked);
      card.notes = document.getElementById('edit-notes-input')?.value || '';

      document.getElementById('modal-edit')?.classList.remove('active');
      renderCards();
    });
  }

  const editModalEl = document.getElementById('modal-edit');
  if (editModalEl && !editModalEl.dataset.draftSyncBound) {
    editModalEl.dataset.draftSyncBound = '1';
    const syncDraftFields = () => {
      if (previewDraft) syncPreviewDraftFromForm();
    };
    editModalEl.addEventListener('input', syncDraftFields);
    editModalEl.addEventListener('change', syncDraftFields);
  }

  // Vista previa en vivo al editar la URL de imagen
  const editImageInput = document.getElementById('edit-image-input');
  if (editImageInput && !editImageInput.dataset.previewBound) {
    editImageInput.dataset.previewBound = '1';
    const syncPreviewFromInput = () => {
      const id = readDomCardId(document.getElementById('edit-card-id')?.value);
      if (previewDraft && isPreviewDraftToken(id)) {
        syncPreviewDraftFromForm();
        updateEditPreview(editImageInput.value.trim(), previewDraft.url || '', {
          guide: false,
          brand: previewDraft.socialBrand || detectSocialBrand(previewDraft.url || ''),
        });
        return;
      }
      const card = cards.find((c) => cardIdsEqual(c.id, id));
      const pageUrl = card?.url || '';
      updateEditPreview(editImageInput.value.trim(), pageUrl, {
        guide: card ? isGuideCard(card) : false,
        brand: card?.socialBrand || detectSocialBrand(pageUrl),
      });
    };
    editImageInput.addEventListener('input', syncPreviewFromInput);
    editImageInput.addEventListener('change', syncPreviewFromInput);
  }

  // Limpiar error de categoría al elegir/escribir
  document.getElementById('edit-category-select')?.addEventListener('change', clearCategoryValidation);
  document.getElementById('edit-new-category-input')?.addEventListener('input', clearCategoryValidation);

  document.querySelectorAll('.filter-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      currentFilter = link.getAttribute('data-filter');
      currentCategory = null;
      renderCards();
      document.querySelectorAll('.dropdown-wrapper').forEach(w => w.classList.remove('active'));
    });
  });

  // Categorías dinámicas: delegación (sidebar + desplegable Mi Biblioteca)
  document.addEventListener('click', (e) => {
    const link = e.target.closest('.filter-cat[data-cat]');
    if (!link) return;
    e.preventDefault();
    const cat = link.getAttribute('data-cat');
    if (!cat) return;
    selectCategoryFilter(cat);
  });

  const btnLibraryDrop = document.getElementById('btn-library-drop');
  if (btnLibraryDrop) {
    const dropdownWrapper = btnLibraryDrop.closest('.dropdown-wrapper');

    btnLibraryDrop.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownWrapper.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      dropdownWrapper.classList.remove('active');
    });
  }

  const setupModal = (btnId, modalId) => {
    const btn = document.getElementById(btnId);
    const modal = document.getElementById(modalId);
    if (btn && modal) {
      btn.addEventListener('click', () => modal.classList.add('active'));
    }
  };

  setupModal('btn-help-modal', 'modal-help');
  setupModal('btn-login-modal', 'modal-login');
  setupModal('btn-subscribe-modal', 'modal-subscribe');

  const SUPPORT_EMAIL = 'soporte@inboxzero.es';
  const LEGAL_DOC_KEYS = ['legal', 'privacy', 'cookies', 'terms'];
  const LEGAL_DOC_ICONS = {
    legal: '⚖️',
    privacy: '🔒',
    cookies: '🍪',
    terms: '📜',
  };
  let activeLegalDocKey = null;

  function buildLegalSectionsHtml(doc) {
    if (!doc || !Array.isArray(doc.sections)) return '';
    return doc.sections
      .map((section) => {
        const heading = section.heading
          ? `<h4>${section.heading}</h4>`
          : '';
        const paragraphs = Array.isArray(section.paragraphs)
          ? section.paragraphs.map((p) => `<p>${p}</p>`).join('')
          : '';
        const list = Array.isArray(section.list) && section.list.length
          ? `<ul>${section.list.map((item) => `<li>${item}</li>`).join('')}</ul>`
          : '';
        return `<section class="legal-section">${heading}${paragraphs}${list}</section>`;
      })
      .join('');
  }

  function renderLegalModalContent(docKey) {
    const getMsg = typeof getMessage === 'function' ? getMessage : () => undefined;
    const doc = getMsg(`legalDocs.${docKey}`);
    const titleEl = document.getElementById('legal-modal-title');
    const iconEl = document.getElementById('legal-modal-icon');
    const bodyEl = document.getElementById('legal-modal-body');
    const supportLink = document.getElementById('legal-support-link');

    if (!doc || typeof doc !== 'object') {
      if (titleEl) titleEl.textContent = t(`footer.${docKey}`) || docKey;
      if (bodyEl) {
        bodyEl.innerHTML = `<p class="legal-doc-intro"><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>`;
      }
      return;
    }

    if (iconEl) iconEl.textContent = LEGAL_DOC_ICONS[docKey] || '📄';
    if (titleEl) titleEl.textContent = doc.title || t(`footer.${docKey}`);
    if (supportLink) {
      supportLink.href = `mailto:${SUPPORT_EMAIL}`;
      supportLink.textContent = SUPPORT_EMAIL;
      supportLink.setAttribute('aria-label', SUPPORT_EMAIL);
    }
    if (bodyEl) {
      const intro = doc.intro ? `<p class="legal-doc-intro">${doc.intro}</p>` : '';
      bodyEl.innerHTML = intro + buildLegalSectionsHtml(doc);
      bodyEl.scrollTop = 0;
    }
  }

  function openLegalModal(docKey) {
    if (!LEGAL_DOC_KEYS.includes(docKey)) return;
    activeLegalDocKey = docKey;
    renderLegalModalContent(docKey);
    openModal('modal-legal');
  }

  document.querySelectorAll('[data-legal]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      openLegalModal(link.getAttribute('data-legal'));
    });
  });

  // Enlaces legales del formulario de suscripción (delegación; el HTML i18n se regenera)
  document.getElementById('modal-subscribe')?.addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (!link || !link.closest('.subscribe-terms, .subscribe-trial-alert')) return;
    e.preventDefault();
    const text = `${link.textContent || ''} ${link.getAttribute('href') || ''}`.toLowerCase();
    if (text.includes('cookie')) openLegalModal('cookies');
    else if (text.includes('priv') || text.includes('confidential') || text.includes('daten')) openLegalModal('privacy');
    else if (text.includes('térm') || text.includes('term') || text.includes('condition') || text.includes('bedingungen')) openLegalModal('terms');
    else openLegalModal('privacy');
  });

  const btnUpsellSubscribe = document.getElementById('btn-upsell-subscribe');
  if (btnUpsellSubscribe) {
    btnUpsellSubscribe.addEventListener('click', () => {
      openSubscribeModal();
    });
  }

  const subscribeForm = document.getElementById('subscribe-form');
  if (subscribeForm) {
    subscribeForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const captcha = document.getElementById('subscribe-captcha')?.value.trim();
      if (captcha !== '7') {
        alert(t('subscribe.captchaError'));
        return;
      }
      // Placeholder Stripe Checkout (modo pruebas) hasta conectar la pasarela real
      window.open('https://checkout.stripe.com/test', '_blank', 'noopener,noreferrer');
    });
  }

  document.querySelectorAll('[data-close]').forEach(el => {
    el.addEventListener('click', () => {
      const modalId = el.getAttribute('data-close');
      document.getElementById(modalId).classList.remove('active');
      if (modalId === 'modal-edit') discardPreviewDraft();
    });
  });

  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
        if (overlay.id === 'modal-edit') discardPreviewDraft();
      }
    });
  });

  window.addEventListener('localechange', () => {
    renderCards();
    renderDashboardGreeting(currentAuthUser);
    const editModal = document.getElementById('modal-edit');
    if (editModal?.classList.contains('active')) {
      const editingId = readDomCardId(document.getElementById('edit-card-id')?.value);
      if (previewDraft && isPreviewDraftToken(editingId)) {
        syncPreviewDraftFromForm();
        const errorKey = previewSaveErrorKey;
        openPreviewModal(previewDraft, { keepError: true });
        if (errorKey) setPreviewSaveError(errorKey);
      } else {
        const editingCard = cards.find((c) => cardIdsEqual(c.id, editingId));
        if (editingCard) {
          openEditModal(editingId);
        }
      }
    } else {
      populateEditCategorySelect('');
    }
    if (activeLegalDocKey && document.getElementById('modal-legal')?.classList.contains('active')) {
      renderLegalModalContent(activeLegalDocKey);
    }
    if (!currentAuthUser) {
      updateAuthChrome(null);
    }
  });

  renderDashboardGreeting(currentAuthUser);
  // renderCards lo dispara hydrateLibraryForAuthUser tras resolver Auth (S1.3)
});
