/**
 * Valida el access token de Supabase Auth (anon key + /auth/v1/user).
 * No usa service_role. Sin token válido → 401. Sin config → 500.
 */

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : '';
}

export async function requireUser(req, res, next) {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ status: 'fail', message: 'No autorizado' });
  }

  const base = String(process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/$/, '');
  const anonKey = String(process.env.SUPABASE_ANON_KEY || '').trim();
  if (!base || !anonKey) {
    console.error('[InboxZero Extract] Falta SUPABASE_URL o SUPABASE_ANON_KEY');
    return res.status(500).json({ status: 'fail', message: 'Servicio no disponible' });
  }

  try {
    const response = await fetch(`${base}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) {
      return res.status(401).json({ status: 'fail', message: 'No autorizado' });
    }
    const user = await response.json().catch(() => null);
    const id = user && user.id ? String(user.id) : '';
    if (!id) {
      return res.status(401).json({ status: 'fail', message: 'No autorizado' });
    }
    req.authUser = { id };
    return next();
  } catch (err) {
    const reason =
      err && (err.name === 'TimeoutError' || err.name === 'AbortError')
        ? 'timeout'
        : 'verify failed';
    console.error('[InboxZero Extract] auth:', reason);
    return res.status(401).json({ status: 'fail', message: 'No autorizado' });
  }
}
