import { adminGetBillingByUserId, isBillingAdminConfigured } from './supabase-admin.js';
export async function handleBillingStatus(req, res) {
  const uid = req.authUser && req.authUser.id ? String(req.authUser.id) : '';
  if (!uid) {
    return res.status(401).json({ status: 'fail', message: 'No autorizado' });
  }
  if (!isBillingAdminConfigured()) {
    return res.status(503).json({ status: 'fail', message: 'Facturación no disponible' });
  }
  try {
    const billing = await adminGetBillingByUserId(uid);
    return res.status(200).json({
      status: 'success',
      hasSubscription: Boolean(billing && billing.stripe_subscription_id),
      subscriptionStatus: (billing && billing.stripe_status) || null,
      cancelAtPeriodEnd: Boolean(billing && billing.cancel_at_period_end),
      currentPeriodEnd: (billing && billing.current_period_end) || null,
    });
  } catch (err) {
    console.error('[InboxZero Billing] status');
    console.error(err);
    return res.status(500).json({ status: 'fail', message: 'Error interno' });
  }
}
