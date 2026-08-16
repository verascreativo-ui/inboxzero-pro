import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const app = read('js/app.js');

test('P0. la clave Guest de fichas no cambia de nombre', () => {
  assert.match(app, /const GUEST_CARDS_STORAGE_KEY\s*=\s*'inboxzero_guest_cards'/);
});

test('P0. existe un único contexto local inboxzero_guest_context', () => {
  assert.match(app, /const GUEST_CONTEXT_STORAGE_KEY\s*=\s*'inboxzero_guest_context'/);
  assert.match(app, /function readGuestContext\(/);
  assert.match(app, /function writeGuestContext\(/);
  assert.match(app, /function ensureGuestContext\(/);
  assert.equal((app.match(/inboxzero_guest_context/g) || []).length >= 1, true);
});

test('P0. el contexto solo tiene id y boundUid', () => {
  const writeFn = app.slice(
    app.indexOf('function writeGuestContext'),
    app.indexOf('function ensureGuestContext')
  );
  assert.match(writeFn, /id:\s*String\(ctx\.id\)\.trim\(\)/);
  assert.match(writeFn, /boundUid:/);
  assert.doesNotMatch(writeFn, /email/);
  assert.match(app, /const ctx = \{ id: createCardId\(\), boundUid: null \}/);
});

test('P0. guestSessionId reutiliza createCardId / randomUUID y no altera IDs de fichas', () => {
  assert.match(app, /function createCardId\(/);
  assert.match(app, /crypto\.randomUUID/);
  assert.match(app, /const ctx = \{ id: createCardId\(\), boundUid: null \}/);
  assert.match(app, /function persistCards\(/);
});

test('P0. la primera escritura Guest crea contexto unbound', () => {
  const saveFn = app.slice(
    app.indexOf('function saveGuestCardsStorage'),
    app.indexOf('function readGuestContext')
  );
  assert.match(saveFn, /if \(list\.length > 0\)/);
  assert.match(saveFn, /ensureGuestContext\(\)/);
});

test('P0. boundUid compara contra el UID Auth, no contra email', () => {
  const allowFn = app.slice(
    app.indexOf('function guestContextAllowsUid'),
    app.indexOf('function purgeGuestStateAfterAuthenticatedSignOut')
  );
  assert.match(allowFn, /ctx\.boundUid === current/);
  assert.doesNotMatch(allowFn, /email/);
  assert.match(app, /function bindGuestContextToUid\(/);
  assert.match(app, /existing\.boundUid !== current/);
});

test('P0. UID distinto no recibe oferta ni puede importar', () => {
  const offer = app.slice(
    app.indexOf('async function maybeOfferGuestMigration'),
    app.indexOf('function scheduleGuestMigrationOffer')
  );
  assert.match(offer, /if \(!guestContextAllowsUid\(uid\)\) return;/);
  assert.match(offer, /bindGuestContextToUid\(uid\)/);

  const run = app.slice(
    app.indexOf('async function runGuestCloudMigration'),
    app.indexOf('guestMigrationLifecycleHandler = (type')
  );
  assert.match(run, /if \(!guestContextAllowsUid\(uid\)\) return;/);
  assert.match(run, /insertOwnCardRepo/);
});

test('P0. SIGNED_OUT autenticado purga Guest y contexto; HYDRATE_GUEST no', () => {
  const life = app.slice(
    app.indexOf('guestMigrationLifecycleHandler = (type'),
    app.indexOf('function openTrialLimitModal')
  );
  assert.match(life, /type === 'SIGNED_OUT'/);
  assert.match(life, /if \(uid\) \{/);
  assert.match(life, /purgeGuestStateAfterAuthenticatedSignOut\(\)/);
  assert.match(life, /clearGuestMigrationDismissed\(uid\)/);
  assert.match(life, /type === 'HYDRATE_GUEST'/);
  const hydrateGuest = life.slice(life.indexOf("type === 'HYDRATE_GUEST'"));
  assert.doesNotMatch(hydrateGuest, /purgeGuestStateAfterAuthenticatedSignOut/);
});

test('P0. la purga vacía el cubo Guest y borra el contexto, no el caché UID', () => {
  const purge = app.slice(
    app.indexOf('function purgeGuestStateAfterAuthenticatedSignOut'),
    app.indexOf('function getUserCardsCache(uid)')
  );
  assert.match(purge, /GUEST_CARDS_STORAGE_KEY/);
  assert.match(purge, /clearGuestContext\(\)/);
  assert.doesNotMatch(purge, /inboxzero_cards_/);
  assert.doesNotMatch(purge, /getUserCardsCacheKey/);
});

test('P0. Ahora no mantiene fichas y vincula boundUid', () => {
  const dismiss = app.slice(
    app.indexOf('function dismissGuestMigrationForSession'),
    app.indexOf('function acknowledgeGuestMigrationResult')
  );
  assert.match(dismiss, /bindGuestContextToUid\(uid\)/);
  assert.match(dismiss, /setGuestMigrationDismissed\(uid\)/);
  assert.doesNotMatch(dismiss, /purgeGuestStateAfterAuthenticatedSignOut/);
  assert.doesNotMatch(dismiss, /saveGuestCardsStorage\(\[\]\)/);
});

test('P0. cambio de usuario resetea preview, filtros y URL', () => {
  const reset = app.slice(
    app.indexOf('function resetTransientUiForAuthBoundary'),
    app.indexOf('guestMigrationLifecycleHandler = (type')
  );
  assert.match(reset, /previewDraft = null/);
  assert.match(reset, /currentFilter = 'all'/);
  assert.match(reset, /currentCategory = null/);
  assert.match(reset, /urlInput\.value = ''/);
  assert.match(reset, /modal-edit/);
  assert.match(app, /lastHydratedAuthUid !== uid/);
  assert.match(app, /resetTransientUiForAuthBoundary\(\)/);
});

test('P0. no introduce store externo ni cuentas anónimas ni Realtime', () => {
  assert.doesNotMatch(app, /redux|zustand|pinia|mobx/i);
  assert.doesNotMatch(app, /signInAnonymously|anonymous.*auth/i);
  assert.doesNotMatch(app, /postgres_changes|\.channel\(/);
});
