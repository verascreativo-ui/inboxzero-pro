/**
 * Guardia de forma de URL de usuario. Primera línea antes de SSRF/DNS/fetch.
 * No resuelve DNS ni abre conexiones: eso sigue en ssrf-guard.js.
 *
 * Rechaza esquemas no HTTP(S), credenciales, controles, URLs excesivas
 * y puertos distintos de 80/443.
 */

import { SsrfError, SSRF_CODE, SSRF_MESSAGE } from '../ssrf-guard.js';

export { SsrfError, SSRF_CODE, SSRF_MESSAGE };

export const MAX_URL_LENGTH = 2048;
export const ALLOWED_PORTS = new Set([80, 443]);

function blocked() {
  throw new SsrfError();
}

function defaultPort(protocol) {
  if (protocol === 'https:') return 443;
  if (protocol === 'http:') return 80;
  return 0;
}

/**
 * Valida y normaliza una URL de usuario. Síncrono: sin DNS.
 * @param {string} input
 * @returns {URL}
 */
export function assertGuardedUrl(input) {
  const raw = String(input || '').trim();
  if (!raw || raw.length > MAX_URL_LENGTH) blocked();
  if (/[\u0000-\u001F\u007F]/.test(raw)) blocked();
  if (/\s/.test(raw)) blocked();

  let parsed;
  try {
    parsed = new URL(raw);
  } catch (_) {
    blocked();
  }

  const protocol = String(parsed.protocol || '').toLowerCase();
  if (protocol !== 'http:' && protocol !== 'https:') blocked();
  if (parsed.username || parsed.password) blocked();

  const hostname = String(parsed.hostname || '')
    .trim()
    .replace(/^\[|\]$/g, '');
  if (!hostname) blocked();

  const port = parsed.port ? Number(parsed.port) : defaultPort(protocol);
  if (!ALLOWED_PORTS.has(port)) blocked();

  return parsed;
}
