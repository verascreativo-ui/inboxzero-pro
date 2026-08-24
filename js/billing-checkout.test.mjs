import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const app = read('js/app.js');

test('frontend Checkout exige Auth y no manda price/user_id', () => {
  const fn = app.slice(
    app.indexOf("subscribeForm.addEventListener('submit'"),
    app.indexOf("document.querySelectorAll('[data-close]')")
  );
  assert.match(fn, /createBillingCheckoutSession\(\)/);
  assert.match(fn, /currentAuthUser\?\.id/);
  assert.match(fn, /subscribe\.needAuth/);
  assert.match(fn, /window\.location\.href\s*=\s*result\.url/);
  assert.doesNotMatch(fn, /subscribe\.pendingSync/);
  assert.match(fn, /subscribe\.alreadyPremium/);
  assert.ok(fn.indexOf('result.url') < fn.indexOf('alreadyPremium'));
  assert.doesNotMatch(fn, /checkout\.stripe\.com\/test/);
  assert.doesNotMatch(fn, /tipo_plan/);
  assert.doesNotMatch(fn, /STRIPE_PRICE/);
});

test('retorno de Checkout refresca perfil sin hidratar cards', () => {
  assert.match(app, /function maybeRefreshProfileAfterCheckoutReturn/);
  const refresh = app.slice(
    app.indexOf('async function refreshOwnProfileOnly'),
    app.indexOf('let billingReturnHandled')
  );
  assert.match(refresh, /fetchOwnProfileRepo/);
  const returnFn = app.slice(
    app.indexOf('function showPremiumWelcomeToast'),
    app.indexOf('function libraryHasDuplicateUrl')
  );
  assert.match(returnFn, /billing !== 'success'/);
  assert.match(returnFn, /showPremiumWelcomeToast/);
  assert.match(returnFn, /header\.premiumWelcome/);
  assert.doesNotMatch(returnFn, /subscribe\.pendingSync/);
  assert.doesNotMatch(returnFn, /alert\(/);
  assert.doesNotMatch(refresh, /hydrateLibraryForAuthUser/);
  assert.doesNotMatch(refresh, /notifyLibraryAuthSync/);
});
