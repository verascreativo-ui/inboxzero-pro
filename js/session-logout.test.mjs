import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const app = read('js/app.js');
const html = read('index.html');

function sliceFn(name, endName) {
  const start = app.indexOf(name);
  const end = endName ? app.indexOf(endName, start + 1) : app.length;
  assert.ok(start >= 0, `missing ${name}`);
  return app.slice(start, end > start ? end : app.length);
}

test('P3. logout normal usa scope local', () => {
  const fn = sliceFn('async function signOutCurrentUser', 'async function signOutOtherSessions');
  assert.match(fn, /signOut\(\s*\{\s*scope:\s*'local'\s*\}\s*\)/);
  assert.match(fn, /notifyGuestMigrationLifecycle\('SIGNED_OUT'/);
  assert.match(fn, /notifyLibraryAuthSync\(null\)/);
});

test('P3. logout others usa scope others y no dispara P0', () => {
  const fn = sliceFn('async function signOutOtherSessions', 'function closeModalById');
  assert.match(fn, /signOut\(\s*\{\s*scope:\s*'others'\s*\}\s*\)/);
  assert.doesNotMatch(fn, /notifyGuestMigrationLifecycle/);
  assert.doesNotMatch(fn, /purgeGuestStateAfterAuthenticatedSignOut/);
  assert.doesNotMatch(fn, /notifyLibraryAuthSync/);
  assert.doesNotMatch(fn, /updateAuthChrome\(null\)/);
  assert.match(fn, /auth\.logoutOthersError/);
  assert.match(fn, /auth\.logoutOthersSuccess/);
});

test('P3. no existe signOut sin scope', () => {
  assert.doesNotMatch(app, /auth\.signOut\(\s*\)/);
  assert.doesNotMatch(app, /signOut\(\s*\{\s*scope:\s*'global'/);
});

test('P3. menú de cuenta y confirmación existen', () => {
  assert.match(html, /id="account-menu-wrapper"/);
  assert.match(html, /id="btn-account-menu"/);
  assert.match(html, /id="btn-logout-others"/);
  assert.match(html, /id="modal-logout-others"/);
  assert.match(html, /id="account-menu-name"/);
  assert.match(html, /id="account-menu-email"/);
  assert.doesNotMatch(html, /access_token|refresh_token|user\.id/);
});

test('P3. el menú no expone UID ni tokens', () => {
  const chrome = sliceFn('function refreshAccountMenuIdentity', 'function updateAuthChrome');
  assert.doesNotMatch(chrome, /access_token|refresh_token|\.id\b/);
  assert.match(chrome, /resolveAccountDisplayName/);
  assert.match(chrome, /user\?\.email/);
});

test('P0. SIGNED_OUT local sigue purgando Guest', () => {
  assert.match(app, /purgeGuestStateAfterAuthenticatedSignOut\(\)/);
  const life = app.slice(
    app.indexOf('guestMigrationLifecycleHandler = (type'),
    app.indexOf('function openTrialLimitModal')
  );
  assert.match(life, /type === 'SIGNED_OUT'/);
  assert.match(life, /purgeGuestStateAfterAuthenticatedSignOut\(\)/);
});

function detectorBlock() {
  const start = app.indexOf('SESSION_REVOKE_PROBE_THROTTLE_MS');
  const end = app.indexOf('function setupSupabaseAuth');
  assert.ok(start >= 0 && end > start, 'missing P3.1 detector');
  return app.slice(start, end);
}

test('P3.1. existe detector de focus/visibility con refreshSession', () => {
  const detector = detectorBlock();
  const setup = sliceFn('function setupRevokedSessionResumeProbe', 'function setupSupabaseAuth');
  assert.match(setup, /window\.addEventListener\(\s*'focus'/);
  assert.match(setup, /document\.addEventListener\(\s*'visibilitychange'/);
  assert.match(setup, /visibilityState === 'visible'/);
  assert.match(detector, /refreshSession\(\)/);
  assert.doesNotMatch(detector, /setInterval/);
  const authSetup = sliceFn('function setupSupabaseAuth', "document.addEventListener('i18n:ready'");
  assert.match(authSetup, /setupRevokedSessionResumeProbe\(\)/);
});

test('P3.1. el detector no valida con getUser ni getSession', () => {
  const detector = detectorBlock();
  assert.doesNotMatch(detector, /getUser\s*\(/);
  assert.doesNotMatch(detector, /getSession\s*\(/);
  assert.match(detector, /if\s*\(\s*!currentAuthUser\s*\)\s*return/);
});

test('P3.1. el detector no dispara P0 ni hidratación', () => {
  const detector = detectorBlock();
  assert.doesNotMatch(detector, /purgeGuestStateAfterAuthenticatedSignOut/);
  assert.doesNotMatch(detector, /notifyGuestMigrationLifecycle/);
  assert.doesNotMatch(detector, /notifyLibraryAuthSync/);
  assert.doesNotMatch(detector, /hydrateLibraryForAuthUser/);
  assert.doesNotMatch(detector, /scheduleLibraryAuthSync/);
  assert.doesNotMatch(detector, /signOut\s*\(/);
  assert.doesNotMatch(detector, /updateAuthChrome/);
});

test('P3.1. TOKEN_REFRESHED no hidrata', () => {
  const setup = sliceFn('function setupSupabaseAuth', "document.addEventListener('i18n:ready'");
  const gateStart = setup.indexOf("event === 'INITIAL_SESSION'");
  assert.ok(gateStart >= 0, 'missing hydrate event gate');
  const hydrateGate = setup.slice(gateStart, setup.indexOf('notifyLibraryAuthSync', gateStart));
  assert.match(hydrateGate, /INITIAL_SESSION/);
  assert.match(hydrateGate, /SIGNED_IN/);
  assert.match(hydrateGate, /SIGNED_OUT/);
  assert.match(hydrateGate, /USER_UPDATED/);
  assert.doesNotMatch(hydrateGate, /TOKEN_REFRESHED/);
});

test('P3.1. SIGNED_OUT sigue siendo el único camino que dispara P0 desde Auth', () => {
  const setup = sliceFn('function setupSupabaseAuth', "document.addEventListener('i18n:ready'");
  assert.match(
    setup,
    /if\s*\(\s*event === 'SIGNED_OUT'\s*\)\s*\{\s*notifyGuestMigrationLifecycle\('SIGNED_OUT'/
  );
  const detector = detectorBlock();
  assert.doesNotMatch(detector, /notifyGuestMigrationLifecycle\('SIGNED_OUT'/);
  const others = sliceFn('async function signOutOtherSessions', 'function closeModalById');
  assert.doesNotMatch(others, /notifyGuestMigrationLifecycle/);
});

test('P3.1. Preview Auth sin usuario no cae a Guest', () => {
  const fn = sliceFn('async function savePreviewDraftFromModal', 'function openPreviewModal');
  assert.match(fn, /if\s*\(\s*libraryHydratedAsAuth\s*\)\s*\{/);
  assert.match(fn, /failClosedPreviewSave\('NO_SESSION'\)/);
  const guestWrite = fn.indexOf('saveGuestCardsStorage');
  const authGuard = fn.indexOf('libraryHydratedAsAuth');
  assert.ok(authGuard >= 0 && guestWrite > authGuard, 'Guest write must follow Auth guard');
});

test('P3.1. foco con sesión válida no rehidrata ni toca cards', () => {
  const probe = sliceFn(
    'async function probeRevokedSessionOnResume',
    'function setupRevokedSessionResumeProbe'
  );
  assert.match(probe, /refreshSession\(\)/);
  assert.doesNotMatch(probe, /notifyLibraryAuthSync/);
  assert.doesNotMatch(probe, /hydrateLibraryForAuthUser/);
  assert.doesNotMatch(probe, /persistCards/);
  assert.doesNotMatch(probe, /saveGuestCardsStorage/);
  assert.doesNotMatch(probe, /renderCards/);
});

test('P3.1. error de red en refreshSession no provoca logout artificial', () => {
  const probe = sliceFn(
    'async function probeRevokedSessionOnResume',
    'function setupRevokedSessionResumeProbe'
  );
  assert.match(probe, /catch\s*\(_\)\s*\{/);
  assert.doesNotMatch(probe, /signOut\s*\(/);
  assert.doesNotMatch(probe, /notifyGuestMigrationLifecycle/);
  assert.doesNotMatch(probe, /updateAuthChrome\(\s*null\s*\)/);
  assert.match(probe, /sessionRevokeProbeInFlight/);
});
