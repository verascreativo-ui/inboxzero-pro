/**
 * Entitlement MVP InboxZero. Solo status de Subscription Stripe.
 * cancel_at_period_end no baja a free mientras status siga active/trialing/past_due.
 */

export const PREMIUM_STATUSES = new Set(['trialing', 'active', 'past_due']);
export const FREE_STATUSES = new Set([
  'incomplete',
  'incomplete_expired',
  'canceled',
  'unpaid',
  'paused',
]);

export function resolvePremiumEntitlement(subscription) {
  const status = String(subscription && subscription.status ? subscription.status : '')
    .trim()
    .toLowerCase();
  if (PREMIUM_STATUSES.has(status)) return 'premium';
  return 'free';
}

export function findLivePremiumSubscription(subscriptions) {
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  return list.find((sub) => resolvePremiumEntitlement(sub) === 'premium') || null;
}

/**
 * retrievedSubscription = estado actual (Stripe retrieve) de la Subscription del evento.
 * customerSubscriptions = listado actual del Customer.
 * La sub del evento, si retrieve dice que no es Premium, no se trata como activa
 * aunque el listado todavía la muestre.
 */
export function selectEntitlementSubscription(retrievedSubscription, customerSubscriptions) {
  if (resolvePremiumEntitlement(retrievedSubscription) === 'premium') {
    return { plan: 'premium', subscription: retrievedSubscription };
  }
  const retrievedId = retrievedSubscription && retrievedSubscription.id;
  const others = (Array.isArray(customerSubscriptions) ? customerSubscriptions : []).filter(
    (sub) => !retrievedId || !sub || sub.id !== retrievedId
  );
  const live = findLivePremiumSubscription(others);
  if (live) {
    return { plan: 'premium', subscription: live };
  }
  return { plan: 'free', subscription: retrievedSubscription };
}

export function periodEndIso(subscription) {
  const itemEnd =
    subscription &&
    subscription.items &&
    Array.isArray(subscription.items.data) &&
    subscription.items.data[0] &&
    subscription.items.data[0].current_period_end;
  const n = Number(
    (subscription && subscription.current_period_end) || itemEnd || 0
  );
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000).toISOString();
}

export function subscriptionPriceId(subscription) {
  const item =
    subscription &&
    subscription.items &&
    Array.isArray(subscription.items.data) &&
    subscription.items.data[0];
  const price = item && item.price;
  const id = price && price.id ? String(price.id) : '';
  return id || null;
}

export function resolveInboxZeroUserId(subscription, session, billingRow) {
  const fromSub =
    subscription && subscription.metadata && subscription.metadata.inboxzero_user_id;
  const fromSessionMeta =
    session && session.metadata && session.metadata.inboxzero_user_id;
  const fromRef = session && session.client_reference_id;
  const fromRow = billingRow && billingRow.user_id;
  const uid = String(fromSub || fromSessionMeta || fromRef || fromRow || '').trim();
  return uid || '';
}
