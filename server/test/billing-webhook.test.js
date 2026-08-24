import assert from 'node:assert/strict';
import test from 'node:test';
import Stripe from 'stripe';
import { handleBillingWebhook, verifyStripeWebhookEvent } from '../src/billing/webhook.js';

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

test('billing. constructEvent rechaza firma inválida', () => {
  const stripe = new Stripe('sk_test_dummy', { maxNetworkRetries: 0 });
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'ping' });
  assert.throws(() => {
    verifyStripeWebhookEvent(stripe, payload, 't=1,v1=deadbeef', 'whsec_test_secret');
  });
});

test('billing. webhook sin firma → 400 y no received', async () => {
  const req = { headers: {}, body: Buffer.from('{}') };
  const res = mockRes();
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-test';
  await handleBillingWebhook(req, res);
  assert.equal(res.statusCode, 400);
  assert.notEqual(res.body && res.body.received, true);
});

test('billing. webhook firma inválida → 400', async () => {
  const req = {
    headers: { 'stripe-signature': 't=1,v1=deadbeef' },
    body: Buffer.from('{"id":"evt_bad"}'),
  };
  const res = mockRes();
  process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';
  process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'service-role-test';
  await handleBillingWebhook(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body && res.body.message, 'Firma inválida');
});
