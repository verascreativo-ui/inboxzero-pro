import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSafeHttpUrl,
  fetchSafeHttp,
  isBlockedIpAddress,
  parseCanonicalIPv4,
  resolveRedirectUrl,
  SSRF_CODE,
  SSRF_MESSAGE,
} from '../src/ssrf-guard.js';

const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];
const privateLookup = async () => [{ address: '10.0.0.1', family: 4 }];
const loopbackLookup = async () => [{ address: '127.0.0.1', family: 4 }];

async function expectBlocked(url, options) {
  await assert.rejects(
    () => assertSafeHttpUrl(url, options),
    (err) => err && err.code === SSRF_CODE && err.message === SSRF_MESSAGE
  );
}

test('rechaza esquemas no HTTP/HTTPS', async () => {
  for (const url of [
    'file:///etc/passwd',
    'ftp://example.com/a',
    'data:text/html,hi',
    'javascript:alert(1)',
    'gopher://example.com/1',
    'ws://example.com/',
    'wss://example.com/',
  ]) {
    await expectBlocked(url);
  }
});

test('rechaza localhost y equivalentes por nombre', async () => {
  for (const url of [
    'http://localhost',
    'http://localhost.localdomain/',
    'http://ip6-localhost/',
    'http://host.docker.internal/',
    'http://foo.localhost/bar',
  ]) {
    await expectBlocked(url);
  }
});

test('rechaza literales IPv4 privadas/loopback/link-local/reservadas', async () => {
  for (const url of [
    'http://127.0.0.1',
    'http://127.0.0.1:8787/health',
    'http://10.0.0.1',
    'http://10.1.2.3/x',
    'http://172.16.0.1',
    'http://172.31.255.1',
    'http://192.168.1.1',
    'http://169.254.1.1',
    'http://0.0.0.0',
    'http://100.64.0.1',
    'http://192.0.0.1',
    'http://198.18.0.1',
    'http://198.51.100.1',
    'http://203.0.113.1',
  ]) {
    await expectBlocked(url);
  }
});

test('rechaza ::1 y IPv4-mapped IPv6 de loopback/privado', async () => {
  for (const url of [
    'http://[::1]',
    'http://[::ffff:127.0.0.1]',
    'http://[::ffff:7f00:1]',
    'http://[::ffff:10.0.0.1]',
    'http://[::ffff:c0a8:1]',
  ]) {
    await expectBlocked(url);
  }
});

test('rechaza representaciones alternativas de IP', async () => {
  for (const url of [
    'http://2130706433',
    'http://0x7f000001',
    'http://0177.0.0.1',
    'http://127.1',
    'http://127.0.1',
    'http://0x7f.0.0.1',
  ]) {
    await expectBlocked(url);
  }
});

test('rechaza userinfo en la URL', async () => {
  await expectBlocked('http://evil@127.0.0.1/');
  await expectBlocked('https://127.0.0.1@example.com/');
});

test('rechaza hostname que resuelve a IP privada (lookup simulado)', async () => {
  await expectBlocked('https://evil.example/path', { lookup: privateLookup });
  await expectBlocked('https://evil.example/', { lookup: loopbackLookup });
});

test('acepta HTTPS público con lookup simulado a IP global', async () => {
  const parsed = await assertSafeHttpUrl('https://example.com/foo', { lookup: publicLookup });
  assert.equal(parsed.protocol, 'https:');
  assert.equal(parsed.hostname, 'example.com');
});

test('isBlockedIpAddress cubre los rangos pedidos', () => {
  assert.equal(isBlockedIpAddress('127.0.0.1'), true);
  assert.equal(isBlockedIpAddress('10.0.0.1'), true);
  assert.equal(isBlockedIpAddress('172.16.5.5'), true);
  assert.equal(isBlockedIpAddress('192.168.1.1'), true);
  assert.equal(isBlockedIpAddress('169.254.169.254'), true);
  assert.equal(isBlockedIpAddress('0.0.0.0'), true);
  assert.equal(isBlockedIpAddress('::1'), true);
  assert.equal(isBlockedIpAddress('::ffff:127.0.0.1'), true);
  assert.equal(isBlockedIpAddress('8.8.8.8'), false);
  assert.equal(isBlockedIpAddress('93.184.216.34'), false);
  assert.equal(parseCanonicalIPv4('8.8.8.8'), '8.8.8.8');
  assert.equal(parseCanonicalIPv4('127.1'), null);
});

test('redirect Location hacia privado se bloquea sin fetch al destino', async () => {
  for (const loc of [
    'http://127.0.0.1/',
    'http://169.254.169.254/latest',
    'http://192.168.0.5/',
    'http://10.0.0.8/',
    'http://[::1]/',
  ]) {
    const next = resolveRedirectUrl('https://example.com/a', loc);
    await expectBlocked(next);
  }
});

test('fetchSafeHttp revalida cada redirect (mock, sin HTTP interno)', async () => {
  let calls = 0;
  const fakeFetch = async () => {
    calls += 1;
    return {
      status: 302,
      headers: { get: (name) => (name.toLowerCase() === 'location' ? 'http://127.0.0.1/secret' : null) },
      body: { cancel: async () => {} },
    };
  };
  await assert.rejects(
    () =>
      fetchSafeHttp(
        'https://example.com/start',
        {},
        { fetch: fakeFetch, lookup: publicLookup }
      ),
    (err) => err && err.code === SSRF_CODE && err.message === SSRF_MESSAGE
  );
  assert.equal(calls, 1);
});
