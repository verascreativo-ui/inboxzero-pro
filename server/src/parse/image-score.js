/**
 * Puntuación de imágenes candidatas (Fase 2 — Paso 1).
 * Heurística alineada con isLikelyBrandOrLogoImage del frontend (Fase 1).
 */

/**
 * @param {string} imageUrl
 * @param {{ width?: number, height?: number, logoUrl?: string, type?: string }} [options]
 */
export function isLikelyBrandOrLogoImage(imageUrl, options = {}) {
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

    if (nearlySquare && maxSide <= 256) return true;

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
 * @typedef {object} ImageCandidate
 * @property {string} url
 * @property {string} source
 * @property {number} [width]
 * @property {number} [height]
 * @property {string} [alt]
 * @property {boolean} [inMain]
 * @property {number} [positionIndex]
 * @property {string} [type]
 */

/**
 * @param {ImageCandidate} candidate
 * @param {{ logoUrl?: string }} [ctx]
 * @returns {{ score: number, logoLike: boolean, reasons: string[] }}
 */
export function scoreImageCandidate(candidate, ctx = {}) {
  const url = String(candidate?.url || '').trim();
  const reasons = [];
  if (!url) {
    return { score: -999, logoLike: true, reasons: ['empty-url'] };
  }

  const width = Number(candidate.width) || 0;
  const height = Number(candidate.height) || 0;
  const logoLike = isLikelyBrandOrLogoImage(url, {
    width,
    height,
    type: candidate.type,
    logoUrl: ctx.logoUrl || '',
  });

  if (logoLike) {
    return { score: -100, logoLike: true, reasons: ['logo-like'] };
  }

  // Exclusiones duras adicionales
  if (/1x1|spacer|pixel|tracking|transparent\.gif/i.test(url)) {
    return { score: -100, logoLike: false, reasons: ['tracking-or-spacer'] };
  }
  if (/^data:image\//i.test(url) && url.length < 80) {
    return { score: -100, logoLike: false, reasons: ['tiny-data-uri'] };
  }

  let score = 0;
  const maxSide = width && height ? Math.max(width, height) : 0;
  const minSide = width && height ? Math.min(width, height) : 0;

  if (maxSide >= 800) {
    score += 35;
    reasons.push('size>=800');
  } else if (maxSide >= 400) {
    score += 20;
    reasons.push('size>=400');
  } else if (maxSide >= 200) {
    score += 5;
    reasons.push('size>=200');
  } else if (maxSide > 0 && maxSide < 200) {
    score -= 25;
    reasons.push('size<200');
  } else {
    score -= 5;
    reasons.push('size-unknown');
  }

  if (maxSide > 0 && minSide > 0) {
    const ratio = maxSide / minSide;
    if (ratio >= 1.2 && ratio <= 2.2) {
      score += 25;
      reasons.push('photo-aspect');
    } else if (ratio <= 1.08 && maxSide <= 400) {
      score -= 30;
      reasons.push('small-square');
    }
  }

  const source = String(candidate.source || '');
  if (source === 'json-ld') {
    score += 15;
    reasons.push('src:json-ld');
  } else if (source.startsWith('og') || source === 'twitter-image') {
    score += 10;
    reasons.push('src:meta');
  } else if (source === 'img-main' || source === 'img-hero') {
    score += 20;
    reasons.push('src:main');
  } else if (source === 'img') {
    score += 5;
    reasons.push('src:img');
  }

  if (candidate.inMain) {
    score += 20;
    reasons.push('in-main');
  }

  const pos = Number(candidate.positionIndex);
  if (Number.isFinite(pos) && pos >= 0 && pos < 3) {
    const bonus = 10 - pos * 3;
    score += bonus;
    reasons.push(`pos:${pos}`);
  }

  const alt = String(candidate.alt || '');
  const haystack = `${url} ${alt}`.toLowerCase();
  if (/(food|plato|dish|hero|cover|photo|menu|receta|meal|comida|banner)/i.test(haystack)) {
    score += 10;
    reasons.push('content-keyword');
  }
  if (/(logo|icon|sprite|avatar|badge|favicon)/i.test(haystack)) {
    score -= 40;
    reasons.push('brand-keyword');
  }

  return { score, logoLike: false, reasons };
}

/**
 * @param {ImageCandidate[]} candidates
 * @param {{ logoUrl?: string, minScore?: number }} [options]
 */
export function rankImageCandidates(candidates, options = {}) {
  const minScore = Number.isFinite(options.minScore) ? options.minScore : 60;
  const ranked = (Array.isArray(candidates) ? candidates : [])
    .map((c) => {
      const { score, logoLike, reasons } = scoreImageCandidate(c, options);
      const width = Number(c.width) || 0;
      const height = Number(c.height) || 0;
      const ratio = width > 0 && height > 0 ? Number((width / height).toFixed(3)) : null;
      return {
        url: c.url,
        source: c.source,
        width: width || undefined,
        height: height || undefined,
        ratio,
        alt: c.alt || undefined,
        inMain: Boolean(c.inMain),
        positionIndex: Number.isFinite(Number(c.positionIndex)) ? Number(c.positionIndex) : undefined,
        type: c.type || undefined,
        dimsSource: c.dimsSource || undefined,
        score,
        logoLike,
        reasons,
        accepted: !logoLike && score >= minScore,
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const areaA = (Number(a.width) || 0) * (Number(a.height) || 0);
      const areaB = (Number(b.width) || 0) * (Number(b.height) || 0);
      if (areaB !== areaA) return areaB - areaA;
      return (Number(a.positionIndex) || 99) - (Number(b.positionIndex) || 99);
    });

  const best = ranked.find((c) => c.accepted) || null;
  return { ranked, best, minScore };
}
