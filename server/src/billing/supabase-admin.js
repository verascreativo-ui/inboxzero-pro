/**
 * Cliente REST privilegiado (service_role). Nunca se envía al navegador.
 */

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key };
}

function adminHeaders() {
  const { key } = supabaseConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

export function isBillingAdminConfigured() {
  const { url, key } = supabaseConfig();
  return Boolean(url && key);
}

async function adminFetch(path, options = {}) {
  const { url, key } = supabaseConfig();
  if (!url || !key) {
    const err = new Error('billing_admin_unconfigured');
    err.code = 'BILLING_ADMIN';
    throw err;
  }
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...adminHeaders(), ...(options.headers || {}) },
    signal: options.signal || AbortSignal.timeout(12000),
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (_) {
      json = null;
    }
  }
  if (!res.ok) {
    const err = new Error('billing_admin_error');
    err.code = 'BILLING_ADMIN';
    err.status = res.status;
    throw err;
  }
  return json;
}

export async function adminGetProfile(uid) {
  const id = String(uid || '').trim();
  if (!id) return null;
  const rows = await adminFetch(
    `/rest/v1/profiles?id=eq.${encodeURIComponent(id)}&select=id,email,nombre,tipo_plan`
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function adminGetBillingByUserId(uid) {
  const id = String(uid || '').trim();
  if (!id) return null;
  const rows = await adminFetch(
    `/rest/v1/billing_subscriptions?user_id=eq.${encodeURIComponent(id)}&select=*`
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function adminGetBillingByCustomerId(customerId) {
  const id = String(customerId || '').trim();
  if (!id) return null;
  const rows = await adminFetch(
    `/rest/v1/billing_subscriptions?stripe_customer_id=eq.${encodeURIComponent(id)}&select=*`
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function adminUpsertBillingRow(row) {
  const user_id = String(row.user_id || '').trim();
  if (!user_id) {
    const err = new Error('billing_row_missing_user');
    err.code = 'BILLING_ADMIN';
    throw err;
  }
  const payload = {
    user_id,
    stripe_customer_id: row.stripe_customer_id || null,
    stripe_subscription_id: row.stripe_subscription_id || null,
    stripe_price_id: row.stripe_price_id || null,
    stripe_status: row.stripe_status || null,
    current_period_end: row.current_period_end || null,
    cancel_at_period_end: Boolean(row.cancel_at_period_end),
    updated_at: new Date().toISOString(),
  };
  const rows = await adminFetch('/rest/v1/billing_subscriptions?on_conflict=user_id', {
    method: 'POST',
    headers: {
      Prefer: 'resolution=merge-duplicates,return=representation',
    },
    body: JSON.stringify(payload),
  });
  return Array.isArray(rows) && rows[0] ? rows[0] : payload;
}

export async function adminSetTipoPlan(uid, plan) {
  const id = String(uid || '').trim();
  const tipo = plan === 'premium' ? 'premium' : 'free';
  if (!id) return;
  await adminFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ tipo_plan: tipo }),
  });
}
