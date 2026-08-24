import { getStripe, getStripeWebhookSecret } from './stripe-client.js';
import {
  adminGetBillingByCustomerId,
  adminSetTipoPlan,
  adminUpsertBillingRow,
  isBillingAdminConfigured,
} from './supabase-admin.js';
import {
  periodEndIso,
  resolveInboxZeroUserId,
  resolvePremiumEntitlement,
  selectEntitlementSubscription,
  subscriptionPriceId,
} from './entitlement.js';

const HANDLED_TYPES = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'invoice.paid',
  'invoice.payment_failed',
]);

function retrieveFailedError(reason) {
  const err = new Error(reason || 'subscription_retrieve_failed');
  err.code = 'BILLING_RETRIEVE';
  return err;
}

export function verifyStripeWebhookEvent(stripe, rawBody, signature, secret) {
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

function customerIdOf(obj) {
  if (!obj) return '';
  if (typeof obj.customer === 'string') return obj.customer;
  if (obj.customer && obj.customer.id) return String(obj.customer.id);
  return '';
}

export function subscriptionIdFromEvent(event, obj) {
  if (event.type && String(event.type).startsWith('customer.subscription.')) {
    return obj && obj.id ? String(obj.id) : '';
  }
  if (event.type === 'checkout.session.completed') {
    const sub = obj && obj.subscription;
    if (!sub) return '';
    return typeof sub === 'string' ? sub : String(sub.id || '');
  }
  if (event.type === 'invoice.paid' || event.type === 'invoice.payment_failed') {
    const sub = obj && obj.subscription;
    if (!sub) return '';
    return typeof sub === 'string' ? sub : String(sub.id || '');
  }
  return '';
}

async function retrieveSubscriptionOrThrow(stripe, subscriptionId) {
  const id = String(subscriptionId || '').trim();
  if (!id) throw retrieveFailedError('missing_subscription_id');
  try {
    const subscription = await stripe.subscriptions.retrieve(id);
    if (!subscription || !subscription.id) throw retrieveFailedError('subscription_retrieve_failed');
    return subscription;
  } catch (err) {
    if (err && err.code === 'BILLING_RETRIEVE') throw err;
    throw retrieveFailedError('subscription_retrieve_failed');
  }
}

async function listCustomerSubscriptionsOrThrow(stripe, customerId) {
  const id = String(customerId || '').trim();
  if (!id) throw retrieveFailedError('missing_customer_id');
  try {
    const listed = await stripe.subscriptions.list({
      customer: id,
      status: 'all',
      limit: 20,
    });
    return Array.isArray(listed && listed.data) ? listed.data : [];
  } catch (err) {
    if (err && err.code === 'BILLING_RETRIEVE') throw err;
    throw retrieveFailedError('subscription_list_failed');
  }
}

export async function applySubscriptionEntitlement(stripe, subscription, session, customerSubscriptions) {
  if (!subscription || !subscription.id) return { ok: false, reason: 'no_subscription' };
  const customerId = customerIdOf(subscription);
  const billingRow = customerId ? await adminGetBillingByCustomerId(customerId) : null;
  const uid = resolveInboxZeroUserId(subscription, session, billingRow);
  if (!uid) return { ok: false, reason: 'no_user' };

  let chosen = { plan: resolvePremiumEntitlement(subscription), subscription };
  if (chosen.plan === 'free') {
    const currentList =
      customerSubscriptions || (await listCustomerSubscriptionsOrThrow(stripe, customerId));
    chosen = selectEntitlementSubscription(subscription, currentList);
  }

  const winning = chosen.subscription || subscription;
  const uidFinal =
    resolveInboxZeroUserId(winning, session, billingRow) || uid;
  await adminUpsertBillingRow({
    user_id: uidFinal,
    stripe_customer_id: customerIdOf(winning) || customerId || (billingRow && billingRow.stripe_customer_id) || null,
    stripe_subscription_id: winning.id,
    stripe_price_id: subscriptionPriceId(winning),
    stripe_status: winning.status || null,
    current_period_end: periodEndIso(winning),
    cancel_at_period_end: Boolean(winning.cancel_at_period_end),
  });
  await adminSetTipoPlan(uidFinal, chosen.plan);
  return { ok: true, uid: uidFinal, plan: chosen.plan };
}

export async function processBillingEventAfterSignature(stripe, event) {
  if (!HANDLED_TYPES.has(event.type)) return { ok: true, skipped: true };
  const obj = event.data && event.data.object ? event.data.object : {};
  const session = event.type === 'checkout.session.completed' ? obj : null;
  const subId = subscriptionIdFromEvent(event, obj);
  const retrieved = await retrieveSubscriptionOrThrow(stripe, subId);
  return applySubscriptionEntitlement(stripe, retrieved, session);
}

export async function dispatchVerifiedEvent(stripe, event, res) {
  try {
    await processBillingEventAfterSignature(stripe, event);
    return res.json({ received: true });
  } catch (err) {
    console.error('[InboxZero Billing] webhook');
    return res.status(500).json({ status: 'fail', message: 'Error interno' });
  }
}

export async function handleBillingWebhook(req, res) {
  const stripe = getStripe();
  const secret = getStripeWebhookSecret();
  if (!stripe || !secret || !isBillingAdminConfigured()) {
    return res.status(500).json({ status: 'fail', message: 'Servicio no disponible' });
  }

  const signature = String(req.headers['stripe-signature'] || '');
  if (!signature) {
    return res.status(400).json({ status: 'fail', message: 'Firma inválida' });
  }

  let event;
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
    event = verifyStripeWebhookEvent(stripe, rawBody, signature, secret);
  } catch (_) {
    return res.status(400).json({ status: 'fail', message: 'Firma inválida' });
  }

  if (!HANDLED_TYPES.has(event.type)) {
    return res.json({ received: true });
  }

  return dispatchVerifiedEvent(stripe, event, res);
}
