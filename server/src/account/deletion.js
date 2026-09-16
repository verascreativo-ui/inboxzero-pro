import { adminGetProfile, adminSetAccountDeletion, isBillingAdminConfigured } from '../billing/supabase-admin.js';
import { cancelSubscriptionForUser } from '../billing/cancel.js';
import { getStripe } from '../billing/stripe-client.js';
const GRACE_PERIOD_DAYS = 30;
/**
 * Marca la cuenta para eliminación dentro de 30 días.
 * Si el usuario es Premium, cancela también la suscripción de Stripe
 * (cancel_at_period_end), igual que la baja normal.
 */
export async function requestAccountDeletion(uid) {
  const profile = await adminGetProfile(uid);
  if (!profile) {
    return { httpStatus: 404, body: { status: 'fail', message: 'Perfil no encontrado' } };
  }
  // Si es Premium, cancelamos la suscripción de Stripe primero.
  // Si falla la cancelación de Stripe, no marcamos la eliminación:
  // preferimos que el usuario reintente a dejar una cuenta a medio cancelar.
  if (profile.tipo_plan === 'premium') {
    const stripe = getStripe();
    const cancelResult = await cancelSubscriptionForUser(stripe, uid);
    if (cancelResult && cancelResult.httpStatus && cancelResult.httpStatus >= 400) {
      return cancelResult;
    }
  }
  const now = new Date();
  const scheduledAt = new Date(now.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  await adminSetAccountDeletion(uid, {
    requestedAt: now.toISOString(),
    scheduledAt: scheduledAt.toISOString(),
  });
  return {
    httpStatus: 200,
    body: { status: 'ok', scheduled_deletion_at: scheduledAt.toISOString() },
  };
}
/**
 * Se llama tras cada login. Si la cuenta estaba en periodo de gracia,
 * la reactiva (borra las fechas) y avisa al frontend para mostrar el aviso.
 * Si no estaba en periodo de gracia, no hace nada.
 */
export async function reactivateIfPending(uid) {
  const profile = await adminGetProfile(uid);
  if (!profile || !profile.scheduled_deletion_at) {
    return { wasReactivated: false };
  }
  await adminSetAccountDeletion(uid, { requestedAt: null, scheduledAt: null });
  return { wasReactivated: true };
}
export async function handleRequestAccountDeletion(req, res) {
  const uid = req.authUser && req.authUser.id ? String(req.authUser.id) : '';
  if (!uid) {
    return res.status(401).json({ status: 'fail', message: 'No autenticado' });
  }
  if (!isBillingAdminConfigured()) {
    return res.status(503).json({ status: 'fail', message: 'Servicio no disponible' });
  }
  try {
    const result = await requestAccountDeletion(uid);
    return res.status(result.httpStatus).json(result.body);
  } catch (err) {
    console.error('account_deletion_error', err);
    return res.status(500).json({ status: 'fail', message: 'Error al procesar la solicitud' });
  }
}
