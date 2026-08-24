import * as cheerio from 'cheerio';

function absUrl(base, maybeRelative) {
  if (!maybeRelative) return '';
  try {
    return new URL(maybeRelative, base).href;
  } catch (_) {
    return maybeRelative;
  }
}

export function extractOpenGraph($, pageUrl) {
  const pick = (...sels) => {
    for (const sel of sels) {
      const v = $(sel).attr('content') || $(sel).attr('value');
      if (v && String(v).trim()) return String(v).trim();
    }
    return '';
  };

  const title =
    pick('meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]') ||
    $('title').first().text().trim();

  const description = pick(
    'meta[property="og:description"]',
    'meta[name="description"]',
    'meta[name="twitter:description"]'
  );

  const image = absUrl(
    pageUrl,
    pick('meta[property="og:image"]', 'meta[property="og:image:url"]', 'meta[name="twitter:image"]')
  );

  const canonical =
    pick('meta[property="og:url"]') ||
    $('link[rel="canonical"]').attr('href') ||
    pageUrl;

  return {
    title: title || '',
    description: description || '',
    image: image || '',
    url: absUrl(pageUrl, canonical) || pageUrl,
  };
}

export function loadHtml(html) {
  return cheerio.load(html || '', { decodeEntities: true });
}
