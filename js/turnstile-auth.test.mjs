import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('app.html');
const app = read('js/app.js');
const config = read('js/supabase-config.js');
const extractConfig = read('js/extract-config.js');
const sql001 = read('supabase/migrations/001_inboxzero_schema.sql');
const sql002 = read('supabase/migrations/002_protect_tipo_plan.sql');
const sql003 = read('supabase/migrations/003_serialize_free_plan_card_limit.sql');
const serverIndex = read('server/src/index.js');
const puppeteer = read('server/src/providers/puppeteer.js');
const envExample = read('server/.env.example');

const frontendBlob = [html, app, config, extractConfig].join('\n');
const localeFiles = ['es', 'en', 'fr', 'de', 'pt'].map(
  (code) => `locales/${code}.json`
);

test('A. el widget Turnstile existe en el modal de Auth', () => {
  const modal = html.slice(
    html.indexOf('id="modal-login"'),
    html.indexOf('id="modal-edit"')
  );
  assert.match(modal, /id="login-form"/);
  assert.match(modal, /id="login-turnstile"/);
  assert.match(html, /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js/);
  assert.match(html, /render=explicit/);
});

test('B. la Site Key pública se utiliza', () => {
  assert.match(config, /window\.INBOXZERO_TURNSTILE_SITE_KEY\s*=/);
  assert.match(app, /getTurnstileSiteKey\(\)/);
  assert.match(app, /INBOXZERO_TURNSTILE_SITE_KEY/);
  assert.match(app, /sitekey:\s*siteKey/);
});

test('C. la clave de verificación de Turnstile no aparece en el repositorio', () => {
  assert.doesNotMatch(frontendBlob, /TURNSTILE_SECRET/);
  assert.doesNotMatch(frontendBlob, /turnstileSecret/);
  assert.doesNotMatch(frontendBlob, /TURNSTILE_SECRET_KEY/);
  for (const rel of localeFiles) {
    const loc = read(rel);
    assert.doesNotMatch(loc, /TURNSTILE_SECRET/);
  }
});

test('D. signUp utiliza captchaToken de Turnstile', () => {
  assert.match(
    app,
    /supabase\.auth\.signUp\(\s*\{[\s\S]*?options:\s*\{\s*emailRedirectTo:\s*redirectTo,\s*captchaToken\s*\}/
  );
});

test('E. signInWithPassword utiliza captchaToken de Turnstile', () => {
  assert.match(
    app,
    /supabase\.auth\.signInWithPassword\(\s*\{[\s\S]*?options:\s*\{\s*captchaToken\s*\}/
  );
});

test('F. no se envía Auth sin captchaToken', () => {
  assert.match(app, /takeTurnstileTokenForAuth\(\)/);
  assert.match(app, /auth\.captchaRequired/);
  assert.match(app, /if\s*\(\s*!captchaToken\s*\)/);
  const es = JSON.parse(read('locales/es.json'));
  assert.equal(es.auth.captchaRequired, 'Completa la verificación de seguridad.');
});

test('G. el widget/token se resetea después de un intento', () => {
  assert.match(app, /function resetTurnstileWidget\(/);
  assert.match(app, /api\.reset\(loginTurnstileWidgetId\)/);
  const signIn = app.slice(
    app.indexOf('async function signInWithEmailPassword'),
    app.indexOf('async function signUpWithEmailPassword')
  );
  const signUp = app.slice(
    app.indexOf('async function signUpWithEmailPassword'),
    app.indexOf('async function signOutCurrentUser')
  );
  assert.match(signIn, /finally\s*\{[\s\S]*resetTurnstileWidget\(\)/);
  assert.match(signUp, /finally\s*\{[\s\S]*resetTurnstileWidget\(\)/);
});

test('H. abrir/cerrar el modal no genera widgets duplicados', () => {
  assert.match(app, /if \(loginTurnstileWidgetId != null\)/);
  assert.match(app, /mountLoginTurnstile\(\)/);
  assert.match(app, /modalId === 'modal-login'\) resetTurnstileWidget\(\)/);
  assert.match(app, /overlay\.id === 'modal-login'\) resetTurnstileWidget\(\)/);
  assert.equal((html.match(/id="login-turnstile"/g) || []).length, 1);
});

test('I. no se modificó 001/002/003, extract, SSRF, Puppeteer ni el límite Free 20', () => {
  assert.doesNotMatch(sql001 + sql002 + sql003, /turnstile/i);
  assert.match(sql003, /free_limit constant integer := 20/);
  assert.match(serverIndex, /HOST = String\(process\.env\.HOST \|\| '127\.0\.0\.1'\)/);
  assert.match(envExample, /ENABLE_PUPPETEER=0/);
  assert.match(puppeteer, /ENABLE_PUPPETEER === '1'/);
  assert.doesNotMatch(extractConfig, /captchaToken/);
  assert.doesNotMatch(app, /headers\.Authorization[\s\S]{0,80}captchaToken/);
});
