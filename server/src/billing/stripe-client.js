import Stripe from 'stripe';

let stripeSingleton = null;

export function getStripe() {
  const key = String(process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) return null;
  if (stripeSingleton) return stripeSingleton;
  stripeSingleton = new Stripe(key, { apiVersion: '2025-03-31.basil' });
  return stripeSingleton;
}

export function getStripePriceId() {
  return String(process.env.STRIPE_PRICE_ID || '').trim();
}

export function getStripePriceIdAnnual() {
  return String(process.env.STRIPE_PRICE_ID_ANNUAL || '').trim();
}

export function getStripeWebhookSecret() {
  return String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
}

export function getAppBaseUrl() {
  return String(process.env.APP_BASE_URL || 'http://localhost:5500')
    .trim()
    .replace(/\/$/, '');
}

export function resetStripeSingletonForTests() {
  stripeSingleton = null;
}
