import {
  getAppBaseUrl,
  getStripe,
  getStripePriceId,
  getStripePriceIdAnnual,
} from './stripe-client.js';
import {
  adminGetBillingByUserId,
  adminGetProfile,
  adminUpsertBillingRow,
  isBillingAdminConfigured,
} from './supabase-admin.js';

export function checkoutIdempotencyKey(uid, latestSessionId) {
  const user = String(uid || '').trim();
  const latest = String(latestSessionId || '').trim() || 'none';
  return `iz-checkout-${user}-${latest}`.slice(0, 255);
}

export function pickOpenCheckoutSession(sessions, priceId) {
  const list = Array.isArray(sessions) ? sessions : [];
  return (
    list.find(
      (session) =>
        session &&
        session.status === 'open' &&
        session.mode === 'subscription' &&
        session.url &&
        (!priceId || sessionMatchesPrice(session, priceId))
    ) || null
  );
}
function sessionMatchesPrice(session, priceId) {
  const lineItems = session.line_items && session.line_items.data;
  if (!Array.isArray(lineItems) || !lineItems.length) return false;
  return lineItems.some((item) => item.price && item.price.id === priceId);
}

export function latestCheckoutSessionId(sessions) {
  const list = Array.isArray(sessions) ? sessions : [];
  const first = list[0];
  return first && first.id ? String(first.id) : '';
}

async function getOrCreateCustomer(stripe, uid, email, existingId) {
  if (existingId) {
    try {
      const existing = await stripe.customers.retrieve(existingId);
      if (existing && !existing.deleted) return existing;
    } catch (_) {
      /* crear uno nuevo */
    }
  }
  return stripe.customers.create(
    {
      email: email || undefined,
      metadata: { inboxzero_user_id: uid },
    },
    { idempotencyKey: `iz-customer-${uid}` }
  );
}

async function listCheckoutSessionsOrThrow(stripe, customerId) {
  const listed = await stripe.checkout.sessions.list({
    customer: customerId,
    limit: 10,
    expand: ['data.line_items'],
  });
  return Array.isArray(listed && listed.data) ? listed.data : [];
}

export async function createCheckoutSessionForUser(stripe, uid, options = {}) {
  const priceId = options.priceId || getStripePriceId();
  const appBase = options.appBase || getAppBaseUrl();
  const profile = await adminGetProfile(uid);
  if (!profile) {
    return {
      httpStatus: 400,
      body: { status: 'fail', message: 'Perfil no encontrado' },
    };
  }
  if (String(profile.tipo_plan || '').toLowerCase() === 'premium') {
    return {
      httpStatus: 200,
      body: { status: 'success', alreadyPremium: true },
    };
  }

  const billing = await adminGetBillingByUserId(uid);
  const customer = await getOrCreateCustomer(
    stripe,
    uid,
    profile.email || '',
    billing && billing.stripe_customer_id
  );

  await adminUpsertBillingRow({
    user_id: uid,
    stripe_customer_id: customer.id,
    stripe_subscription_id: billing && billing.stripe_subscription_id,
    stripe_price_id: billing && billing.stripe_price_id,
    stripe_status: billing && billing.stripe_status,
    current_period_end: billing && billing.current_period_end,
  });

  const priorSessions = await listCheckoutSessionsOrThrow(stripe, customer.id);
  const open = pickOpenCheckoutSession(priorSessions, priceId);
  if (open) {
    return {
      httpStatus: 200,
      body: { status: 'success', url: open.url },
    };
  }

  const session = await stripe.checkout.sessions.create(
    {
      mode: 'subscription',
      customer: customer.id,
      client_reference_id: uid,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appBase}/?billing=success&checkout_session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBase}/?billing=cancel`,
      metadata: { inboxzero_user_id: uid },
      subscription_data: {
        metadata: { inboxzero_user_id: uid },
      },
    },
    {
      idempotencyKey: checkoutIdempotencyKey(uid, latestCheckoutSessionId(priorSessions)),
    }
  );

  if (!session || !session.url) {
    return { httpStatus: 500, body: { status: 'fail', message: 'Error interno' } };
  }
  return { httpStatus: 200, body: { status: 'success', url: session.url } };
}

export async function handleCreateCheckoutSession(req, res) {
  const uid = req.authUser && req.authUser.id ? String(req.authUser.id) : '';
  if (!uid) {
    return res.status(401).json({ status: 'fail', message: 'No autorizado' });
  }

  const stripe = getStripe();
  const monthlyPriceId = getStripePriceId();
  const annualPriceId = getStripePriceIdAnnual();
  if (!stripe || !monthlyPriceId || !isBillingAdminConfigured()) {
    return res.status(503).json({ status: 'fail', message: 'Facturación no disponible' });
  }
  const requestedPlan = String((req.body && req.body.plan) || '').trim().toLowerCase();
  const priceId = requestedPlan === 'annual' && annualPriceId ? annualPriceId : monthlyPriceId;
  try {
    const result = await createCheckoutSessionForUser(stripe, uid, {
      priceId,
      appBase: getAppBaseUrl(),
    });
    return res.status(result.httpStatus || 200).json(result.body);
  } catch (err) {
    const code = err && err.code ? String(err.code) : '';
    if (code === 'BILLING_ADMIN') {
      console.error('[InboxZero Billing] admin');
    } else {
      console.error('[InboxZero Billing] checkout');
    }
    console.error(err);
    return res.status(500).json({ status: 'fail', message: 'Error interno' });
  }
}
