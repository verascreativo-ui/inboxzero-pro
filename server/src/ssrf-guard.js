/**
 * Validación SSRF centralizada. Única fuente de rangos IP / esquemas / redirects.
 * No filtrar por el bind local del servidor: el riesgo es el DESTINO saliente.
 *
 * Cada hop de fetchSafeHttp fija la conexión a la IP ya validada con un
 * undici.Agent (connect.lookup pinneado). Así fetch no vuelve a resolver DNS.
 */

import dns from 'node:dns/promises';
import net from 'node:net';
import { Agent } from 'undici';
import { fetchWithTimeout } from './fetch-timeout.js';

export const SSRF_CODE = 'URL_NOT_ALLOWED';
export const SSRF_MESSAGE = 'URL no permitida';
export const MAX_SAFE_REDIRECTS = 3;

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'local',
  'host.docker.internal',
  'gateway.docker.internal',
  'metadata.google.internal',
  'metadata',
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.localdomain',
  '.home.arpa',
  '.corp',
];

const v4Block = new net.BlockList();
v4Block.addSubnet('0.0.0.0', 8, 'ipv4');
v4Block.addSubnet('10.0.0.0', 8, 'ipv4');
v4Block.addSubnet('100.64.0.0', 10, 'ipv4');
v4Block.addSubnet('127.0.0.0', 8, 'ipv4');
v4Block.addSubnet('169.254.0.0', 16, 'ipv4');
v4Block.addSubnet('172.16.0.0', 12, 'ipv4');
v4Block.addSubnet('192.0.0.0', 24, 'ipv4');
v4Block.addSubnet('192.0.2.0', 24, 'ipv4');
v4Block.addSubnet('192.88.99.0', 24, 'ipv4');
v4Block.addSubnet('192.168.0.0', 16, 'ipv4');
v4Block.addSubnet('198.18.0.0', 15, 'ipv4');
v4Block.addSubnet('198.51.100.0', 24, 'ipv4');
v4Block.addSubnet('203.0.113.0', 24, 'ipv4');
v4Block.addSubnet('224.0.0.0', 4, 'ipv4');
v4Block.addSubnet('240.0.0.0', 4, 'ipv4');

const v6Block = new net.BlockList();
v6Block.addAddress('::', 'ipv6');
v6Block.addAddress('::1', 'ipv6');
v6Block.addSubnet('100::', 64, 'ipv6');
v6Block.addSubnet('2001::', 32, 'ipv6');
v6Block.addSubnet('2001:2::', 48, 'ipv6');
v6Block.addSubnet('2001:10::', 28, 'ipv6');
v6Block.addSubnet('2001:db8::', 32, 'ipv6');
v6Block.addSubnet('fc00::', 7, 'ipv6');
v6Block.addSubnet('fe80::', 10, 'ipv6');
v6Block.addSubnet('fec0::', 10, 'ipv6');
v6Block.addSubnet('ff00::', 8, 'ipv6');

export class SsrfError extends Error {
  constructor() {
    super(SSRF_MESSAGE);
    this.name = 'SsrfError';
    this.code = SSRF_CODE;
    this.status = 400;
  }
}

function blocked() {
  throw new SsrfError();
}

function defaultLookup(hostname) {
  return dns.lookup(hostname, { all: true, verbatim: true });
}

/** IPv4 canónico: 4 octetos decimales 0-255, sin ceros a la izquierda. */
export function parseCanonicalIPv4(hostname) {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(hostname || ''));
  if (!m) return null;
  const parts = [m[1], m[2], m[3], m[4]];
  if (parts.some((p) => (p.length > 1 && p.startsWith('0')) || Number(p) > 255)) return null;
  return parts.map(Number).join('.');
}

function looksLikeNonCanonicalIp(hostname) {
  const host = String(hostname || '');
  if (/^[\d.]+$/.test(host) && !parseCanonicalIPv4(host)) return true;
  if (/^0x[0-9a-f]+$/i.test(host)) return true;
  if (/^0x[0-9a-f.]+$/i.test(host)) return true;
  if (/^\d+$/.test(host)) return true;
  if (/(^|\.)0[0-9]/.test(host) && /^[0-9.]+$/.test(host)) return true;
  return false;
}

function ipv4FromMappedIPv6(addr) {
  const lower = String(addr || '').toLowerCase().replace(/^\[|\]$/g, '');
  const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
  if (dotted) return parseCanonicalIPv4(dotted[1]) || dotted[1];
  const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (hex) {
    const a = parseInt(hex[1], 16);
    const b = parseInt(hex[2], 16);
    return `${(a >> 8) & 255}.${a & 255}.${(b >> 8) & 255}.${b & 255}`;
  }
  const nat64 = /^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(lower);
  if (nat64) {
    const a = parseInt(nat64[1], 16);
    const b = parseInt(nat64[2], 16);
    return `${(a >> 8) & 255}.${a & 255}.${(b >> 8) & 255}.${b & 255}`;
  }
  return null;
}

export function isBlockedIpAddress(address) {
  const raw = String(address || '').trim().replace(/^\[|\]$/g, '');
  if (!raw) return true;

  const mapped = ipv4FromMappedIPv6(raw);
  if (mapped) return isBlockedIpAddress(mapped);

  const kind = net.isIP(raw);
  if (kind === 4) return v4Block.check(raw, 'ipv4');
  if (kind === 6) return v6Block.check(raw, 'ipv6');

  const canonical = parseCanonicalIPv4(raw);
  if (canonical) return v4Block.check(canonical, 'ipv4');
  return true;
}

function isBlockedHostname(hostname) {
  const host = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/\.+$/, '');
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) return true;
  return false;
}

function parseHttpUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) blocked();
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
  if (isBlockedHostname(hostname)) blocked();
  if (looksLikeNonCanonicalIp(hostname)) blocked();
  return parsed;
}

function normalizeLookupHost(hostname) {
  return String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '');
}

function recordAddress(rec) {
  if (!rec) return '';
  if (typeof rec === 'string') return rec;
  return rec.address ? String(rec.address) : '';
}

function recordFamily(rec, address) {
  const fromRec = rec && typeof rec === 'object' ? Number(rec.family) : 0;
  if (fromRec === 4 || fromRec === 6) return fromRec;
  const kind = net.isIP(address);
  if (kind === 4 || kind === 6) return kind;
  return parseCanonicalIPv4(address) ? 4 : 0;
}

function attachPinnedAddress(parsed, address, family) {
  const addr = String(address || '')
    .trim()
    .replace(/^\[|\]$/g, '');
  let fam = Number(family);
  if (fam !== 4 && fam !== 6) fam = recordFamily(null, addr);
  if (!addr || (fam !== 4 && fam !== 6)) blocked();
  parsed.pinnedAddress = addr;
  parsed.pinnedFamily = fam;
  return parsed;
}

/**
 * Valida esquema, host, literales IP y DNS. No realiza HTTP.
 * El URL retornado incluye pinnedAddress y pinnedFamily (4 o 6).
 * @param {string} input
 * @param {{ lookup?: typeof defaultLookup }} [options]
 * @returns {Promise<URL & { pinnedAddress: string, pinnedFamily: 4|6 }>}
 */
export async function assertSafeHttpUrl(input, options = {}) {
  const parsed = parseHttpUrl(input);
  const hostname = String(parsed.hostname || '').replace(/^\[|\]$/g, '');

  if (net.isIP(hostname) || parseCanonicalIPv4(hostname)) {
    if (isBlockedIpAddress(hostname)) blocked();
    const canonical = parseCanonicalIPv4(hostname);
    return attachPinnedAddress(parsed, canonical || hostname, net.isIP(canonical || hostname));
  }

  const lookupFn = options.lookup || defaultLookup;
  let records;
  try {
    records = await lookupFn(hostname);
  } catch (_) {
    blocked();
  }
  const list = Array.isArray(records) ? records : records ? [records] : [];
  if (!list.length) blocked();
  for (const rec of list) {
    const address = recordAddress(rec);
    if (isBlockedIpAddress(address)) blocked();
  }
  const first = list[0];
  const pinned = recordAddress(first);
  return attachPinnedAddress(parsed, pinned, recordFamily(first, pinned));
}

/**
 * Agent undici cuya resolución DNS de `hostname` queda fijada a pinnedAddress.
 * Cualquier otro hostname en lookup falla (no hay DNS real).
 * @param {string} hostname
 * @param {string} pinnedAddress
 * @param {4|6|number} pinnedFamily
 * @returns {import('undici').Agent}
 */
export function createPinnedDispatcher(hostname, pinnedAddress, pinnedFamily) {
  const expectedHost = normalizeLookupHost(hostname);
  const address = String(pinnedAddress || '')
    .trim()
    .replace(/^\[|\]$/g, '');
  const family = Number(pinnedFamily) === 6 ? 6 : 4;
  if (!expectedHost || !address) blocked();

  return new Agent({
    connect: {
      lookup(host, options, callback) {
        const cb = typeof options === 'function' ? options : callback;
        const resolved = normalizeLookupHost(host);
        if (resolved !== expectedHost) {
          cb(new SsrfError());
          return;
        }
        cb(null, address, family);
      },
    },
  });
}

function closeDispatcher(dispatcher, { destroy = false } = {}) {
  if (!dispatcher) return;
  try {
    if (destroy && typeof dispatcher.destroy === 'function') {
      dispatcher.destroy();
      return;
    }
    if (typeof dispatcher.close === 'function') {
      dispatcher.close();
      return;
    }
    if (typeof dispatcher.destroy === 'function') dispatcher.destroy();
  } catch (_) {
    /* ignore */
  }
}

export function resolveRedirectUrl(currentHref, locationHeader) {
  const loc = String(locationHeader || '').trim();
  if (!loc) blocked();
  try {
    return new URL(loc, currentHref).href;
  } catch (_) {
    blocked();
  }
}

async function discardBody(res) {
  try {
    if (res && res.body && typeof res.body.cancel === 'function') await res.body.cancel();
  } catch (_) {
    /* ignore */
  }
}

/**
 * fetch HTTP(S) con validación SSRF en cada hop. redirect: 'manual'.
 * Cada hop usa un dispatcher pinneado a la IP validada en ese hop.
 * @returns {Promise<{ response: Response, finalUrl: string }>}
 */
export async function fetchSafeHttp(url, options = {}, deps = {}) {
  const doFetch = deps.fetch || fetchWithTimeout;
  const maxRedirects =
    Number.isFinite(deps.maxRedirects) && deps.maxRedirects >= 0
      ? deps.maxRedirects
      : MAX_SAFE_REDIRECTS;

  let current = await assertSafeHttpUrl(url, { lookup: deps.lookup });
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const host = String(current.hostname || '').replace(/^\[|\]$/g, '');
    if (!current.pinnedAddress) blocked();
    const pinnedDispatcher = createPinnedDispatcher(
      host,
      current.pinnedAddress,
      current.pinnedFamily
    );
    let response;
    try {
      response = await doFetch(current.href, {
        ...options,
        redirect: 'manual',
        dispatcher: pinnedDispatcher,
      });
    } catch (err) {
      closeDispatcher(pinnedDispatcher, { destroy: true });
      throw err;
    }
    const status = Number(response.status);
    if (status >= 300 && status < 400) {
      const nextHref = resolveRedirectUrl(current.href, response.headers.get('location'));
      await discardBody(response);
      closeDispatcher(pinnedDispatcher, { destroy: true });
      current = await assertSafeHttpUrl(nextHref, { lookup: deps.lookup });
      continue;
    }
    closeDispatcher(pinnedDispatcher);
    return { response, finalUrl: current.href };
  }
  blocked();
}
