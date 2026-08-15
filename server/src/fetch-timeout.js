/**
 * fetch() con timeout de servidor.
 * Destinos de usuario deben pasar antes por ssrf-guard (fetchSafeHttp).
 */

export function getExtractFetchTimeoutMs() {
  const n = Number(process.env.EXTRACT_FETCH_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 25000;
}

export async function fetchWithTimeout(url, options = {}, timeoutMs = getExtractFetchTimeoutMs()) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const parent = options.signal;
  if (parent) {
    if (parent.aborted) controller.abort();
    else parent.addEventListener('abort', () => controller.abort(), { once: true });
  }
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError')) {
      const timeoutErr = new Error('Tiempo de espera agotado');
      timeoutErr.code = 'TIMEOUT';
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
