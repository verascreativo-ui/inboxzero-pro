import assert from 'node:assert/strict';
import test from 'node:test';
import {
  resolvePremiumEntitlement,
  selectEntitlementSubscription,
} from '../src/billing/entitlement.js';

function sub(status, extra = {}) {
  return { status, cancel_at_period_end: false, ...extra };
}

test('billing. trialing/active/past_due → premium', () => {
  assert.equal(resolvePremiumEntitlement(sub('trialing')), 'premium');
  assert.equal(resolvePremiumEntitlement(sub('active')), 'premium');
  assert.equal(resolvePremiumEntitlement(sub('past_due')), 'premium');
});

test('billing. incomplete/canceled/unpaid/paused → free', () => {
  assert.equal(resolvePremiumEntitlement(sub('incomplete')), 'free');
  assert.equal(resolvePremiumEntitlement(sub('incomplete_expired')), 'free');
  assert.equal(resolvePremiumEntitlement(sub('canceled')), 'free');
  assert.equal(resolvePremiumEntitlement(sub('unpaid')), 'free');
  assert.equal(resolvePremiumEntitlement(sub('paused')), 'free');
});

test('billing. cancel_at_period_end true con status active mantiene Premium', () => {
  assert.equal(
    resolvePremiumEntitlement(sub('active', { cancel_at_period_end: true })),
    'premium'
  );
});

test('billing. estado desconocido o vacío es free', () => {
  assert.equal(resolvePremiumEntitlement(sub('')), 'free');
  assert.equal(resolvePremiumEntitlement(null), 'free');
  assert.equal(resolvePremiumEntitlement({}), 'free');
});

test('billing. sub antigua canceled + nueva active → premium', () => {
  const chosen = selectEntitlementSubscription(
    { id: 'sub_old', status: 'canceled' },
    [
      { id: 'sub_old', status: 'canceled' },
      { id: 'sub_new', status: 'active' },
    ]
  );
  assert.equal(chosen.plan, 'premium');
  assert.equal(chosen.subscription.id, 'sub_new');
});

test('billing. sub antigua deleted + nueva trialing → premium', () => {
  const chosen = selectEntitlementSubscription(
    { id: 'sub_old', status: 'canceled' },
    [
      { id: 'sub_old', status: 'canceled' },
      { id: 'sub_new', status: 'trialing' },
    ]
  );
  assert.equal(chosen.plan, 'premium');
  assert.equal(chosen.subscription.id, 'sub_new');
});

test('billing. sub canceled sin otra premium → free', () => {
  const chosen = selectEntitlementSubscription(
    { id: 'sub_old', status: 'canceled' },
    [{ id: 'sub_old', status: 'canceled' }]
  );
  assert.equal(chosen.plan, 'free');
  assert.equal(chosen.subscription.id, 'sub_old');
});

test('billing. listado no trata como activa la sub que retrieve marca canceled', () => {
  const chosen = selectEntitlementSubscription(
    { id: 'sub_old', status: 'canceled' },
    [{ id: 'sub_old', status: 'active' }]
  );
  assert.equal(chosen.plan, 'free');
});
