import { extractOpenGraph, loadHtml } from './opengraph.js';
import { extractFacebookGroupMeta } from './facebook.js';

export function detectPlatform(url) {
  const raw = String(url || '').toLowerCase();
  if (raw.includes('facebook.com') || raw.includes('fb.com') || raw.includes('fb.watch')) {
    return 'facebook';
  }
  if (raw.includes('instagram.com')) return 'instagram';
  if (raw.includes('linkedin.com')) return 'linkedin';
  if (raw.includes('twitter.com') || /(^|\/\/|\.)x\.com(\/|$|\?|#)/i.test(raw)) return 'twitter';
  return 'generic';
}

function extractInstagramMeta(html, pageUrl, screenshotDataUrl) {
  const $ = loadHtml(html);
  const og = extractOpenGraph($, pageUrl);
  let title = og.title;
  let description = og.description;
  let image = og.image;

  if (!title) {
    const h1 = $('h1, h2').first().text().replace(/\s+/g, ' ').trim();
    if (h1) title = h1;
  }
  if (!image) {
    const img =
      $('meta[property="og:image"]').attr('content') ||
      $('article img').first().attr('src') ||
      $('img[src*="cdninstagram"]').first().attr('src');
    if (img) image = img;
  }
  if (!image && screenshotDataUrl) image = screenshotDataUrl;

  return {
    title: title || '',
    description: description || '',
    image: image || '',
    url: og.url || pageUrl,
    platform: 'instagram',
  };
}

function extractLinkedInMeta(html, pageUrl, screenshotDataUrl) {
  const $ = loadHtml(html);
  const og = extractOpenGraph($, pageUrl);
  let title = og.title;
  let description = og.description;
  let image = og.image;

  if (!title || /^linkedin$/i.test(title)) {
    const h1 = $('h1').first().text().replace(/\s+/g, ' ').trim();
    if (h1) title = h1;
  }
  if (!image) {
    const img =
      $('meta[property="og:image"]').attr('content') ||
      $('img.profile-photo-edit__preview').attr('src') ||
      $('img[src*="media.licdn"]').first().attr('src');
    if (img) image = img;
  }
  if (!image && screenshotDataUrl) image = screenshotDataUrl;

  return {
    title: title || '',
    description: description || '',
    image: image || '',
    url: og.url || pageUrl,
    platform: 'linkedin',
  };
}

/**
 * Parsea HTML scrapeado según la plataforma.
 */
export function parseScrapedPage(html, pageUrl, screenshotDataUrl) {
  const platform = detectPlatform(pageUrl);

  if (platform === 'facebook') {
    return extractFacebookGroupMeta(html, pageUrl, screenshotDataUrl);
  }
  if (platform === 'instagram') {
    return extractInstagramMeta(html, pageUrl, screenshotDataUrl);
  }
  if (platform === 'linkedin') {
    return extractLinkedInMeta(html, pageUrl, screenshotDataUrl);
  }

  const $ = loadHtml(html);
  const og = extractOpenGraph($, pageUrl);
  if (!og.image && screenshotDataUrl) og.image = screenshotDataUrl;
  return { ...og, platform };
}
