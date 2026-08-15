/**
 * Rate limit en memoria (MVP). Sin Redis.
 * Clave: usuario autenticado si existe, si no IP del socket (sin X-Forwarded-For).
 */

const buckets = new Map();

function clientKey(req) {
  const uid = req.authUser && req.authUser.id ? String(req.authUser.id) : '';
  if (uid) return `u:${uid}`;
  const ip = req.socket && req.socket.remoteAddress ? String(req.socket.remoteAddress) : 'unknown';
  return `ip:${ip}`;
}

export function getRateLimitWindowMs() {
  const n = Number(process.env.EXTRACT_RATE_LIMIT_WINDOW_MS);
  return Number.isFinite(n) && n > 0 ? n : 600000;
}

export function getRateLimitMax() {
  const n = Number(process.env.EXTRACT_RATE_LIMIT_MAX);
  return Number.isFinite(n) && n > 0 ? n : 40;
}

export function rateLimitExtract(req, res, next) {
  const windowMs = getRateLimitWindowMs();
  const max = getRateLimitMax();
  const key = clientKey(req);
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now - bucket.start >= windowMs) {
    bucket = { start: now, count: 0 };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return res.status(429).json({ status: 'fail', message: 'Demasiadas peticiones' });
  }
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (now - b.start >= windowMs) buckets.delete(k);
    }
  }
  return next();
}
