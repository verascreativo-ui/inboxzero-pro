import { getStripe } from './stripe-client.js';
import { adminGetBillingByUserId, isBillingAdminConfigured } from './supabase-admin.js';
export async function cancelSubscriptionForUser(stripe, uid) {
  const billing = await adminGetBillingByUserId(uid);
  const subscriptionId = billing && billing.stripe_subscription_id;
  if (!subscriptionId) {
    return {
      httpStatus: 400,
      body: { status: 'fail', message: 'No se encontró ninguna suscripción activa' },
    };
  }
  const subscription = await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
  const periodEndTimestamp =
    subscription &&
    subscription.items &&
    subscription.items.data &&
    subscription.items.data[0] &&
    subscription.items.data[0].current_period_end;
  const periodEndIso = periodEndTimestamp
    ? new Date(periodEndTimestamp * 1000).toISOString()
    : null;
  return {
    httpStatus: 200,
    body: {
      status: 'success',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: periodEndIso,
    },
  };
}
export async function handleCancelSubscription(req, res) {
  const uid = req.authUser && req.authUser.id ? String(req.authUser.id) : '';
  if (!uid) {
    return res.status(401).json({ status: 'fail', message: 'No autorizado' });
  }
  const stripe = getStripe();
  if (!stripe || !isBillingAdminConfigured()) {
    return res.status(503).json({ status: 'fail', message: 'Facturación no disponible' });
  }
  try {
    const result = await cancelSubscriptionForUser(stripe, uid);
    return res.status(result.httpStatus || 200).json(result.body);
  } catch (err) {
    console.error('[InboxZero Billing] cancel');
    console.error(err);
    return res.status(500).json({ status: 'fail', message: 'Error interno' });
  }
}
