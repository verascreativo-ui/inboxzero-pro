import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkoutIdempotencyKey,
  createCheckoutSessionForUser,
  latestCheckoutSessionId,
  pickOpenCheckoutSession,
} from '../src/billing/checkout.js';
import {
  applySubscriptionEntitlement,
  dispatchVerifiedEvent,
} from '../src/billing/webhook.js';

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

function jsonResponse(body, status = 200) {
  return new Response(body == null ? '' : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function subscription({ id, status, customer = 'cus_1', uid = 'user-1' }) {
  return {
    id,
    status,
    customer,
    metadata: { inboxzero_user_id: uid },
    items: { data: [] },
  };
}

function installAdminMock(profile = { id: 'user-1', email: 'a@b.c', tipo_plan: 'free' }) {
  const original = globalThis.fetch;
  const state = { tipoPlanWrites: [], billingWrites: [] };
  process.env.SUPABASE_URL = 'https://example.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
  globalThis.fetch = async (url, opts = {}) => {
    const u = String(url);
    const method = String(opts.method || 'GET').toUpperCase();
    if (u.includes('/rest/v1/profiles') && method === 'GET') {
      return jsonResponse([profile]);
    }
    if (u.includes('/rest/v1/profiles') && method === 'PATCH') {
      state.tipoPlanWrites.push(JSON.parse(String(opts.body || '{}')));
      return jsonResponse({});
    }
    if (u.includes('/rest/v1/billing_subscriptions') && method === 'GET') {
      return jsonResponse([]);
    }
    if (u.includes('/rest/v1/billing_subscriptions')) {
      const body = JSON.parse(String(opts.body || '{}'));
      state.billingWrites.push(body);
      return jsonResponse([body]);
    }
    return jsonResponse([]);
  };
  return {
    state,
    restore() {
      globalThis.fetch = original;
    },
  };
}

test('1. sub antigua canceled + nueva active → Premium permanece', async () => {
  const admin = installAdminMock();
  try {
    const oldSub = subscription({ id: 'sub_old', status: 'canceled' });
    const newSub = subscription({ id: 'sub_new', status: 'active' });
    const stripe = {
      subscriptions: {
        list: async () => ({ data: [oldSub, newSub] }),
      },
    };
    const result = await applySubscriptionEntitlement(stripe, oldSub, null);
    assert.equal(result.plan, 'premium');
    assert.equal(admin.state.tipoPlanWrites.at(-1).tipo_plan, 'premium');
    assert.equal(admin.state.billingWrites.at(-1).stripe_subscription_id, 'sub_new');
  } finally {
    admin.restore();
  }
});

test('2. sub antigua deleted + nueva trialing → Premium permanece', async () => {
  const admin = installAdminMock();
  try {
    const oldSub = subscription({ id: 'sub_old', status: 'canceled' });
    const newSub = subscription({ id: 'sub_new', status: 'trialing' });
    const stripe = {
      subscriptions: {
        retrieve: async () => oldSub,
        list: async () => ({ data: [oldSub, newSub] }),
      },
    };
    const res = mockRes();
    await dispatchVerifiedEvent(
      stripe,
      {
        type: 'customer.subscription.deleted',
        data: { object: oldSub },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(admin.state.tipoPlanWrites.at(-1).tipo_plan, 'premium');
  } finally {
    admin.restore();
  }
});

test('3. sub antigua canceled + ninguna otra premium → Free', async () => {
  const admin = installAdminMock();
  try {
    const oldSub = subscription({ id: 'sub_old', status: 'canceled' });
    const stripe = {
      subscriptions: {
        retrieve: async () => oldSub,
        list: async () => ({ data: [oldSub] }),
      },
    };
    const res = mockRes();
    await dispatchVerifiedEvent(
      stripe,
      {
        type: 'customer.subscription.updated',
        data: { object: oldSub },
      },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(admin.state.tipoPlanWrites.at(-1).tipo_plan, 'free');
  } finally {
    admin.restore();
  }
});

test('4. subscriptions.retrieve falla → HTTP 500 y tipo_plan no cambia', async () => {
  const admin = installAdminMock();
  try {
    const stripe = {
      subscriptions: {
        retrieve: async () => {
          throw new Error('stripe_unavailable');
        },
        list: async () => ({ data: [] }),
      },
    };
    const res = mockRes();
    await dispatchVerifiedEvent(
      stripe,
      {
        type: 'customer.subscription.deleted',
        data: { object: subscription({ id: 'sub_old', status: 'canceled' }) },
      },
      res
    );
    assert.equal(res.statusCode, 500);
    assert.notEqual(res.body && res.body.received, true);
    assert.equal(admin.state.tipoPlanWrites.length, 0);
  } finally {
    admin.restore();
  }
});

test('5. Checkout retry usa idempotency key estable', async () => {
  const admin = installAdminMock();
  const createArgs = [];
  try {
    const stripe = {
      customers: {
        create: async () => ({ id: 'cus_1' }),
        retrieve: async () => ({ id: 'cus_1' }),
      },
      subscriptions: {
        list: async () => ({ data: [] }),
      },
      checkout: {
        sessions: {
          list: async () => ({ data: [] }),
          create: async (params, request) => {
            createArgs.push({ params, request });
            return { id: 'cs_1', url: 'https://checkout.stripe.com/c/pay/cs_1' };
          },
        },
      },
    };
    const first = await createCheckoutSessionForUser(stripe, 'user-1', {
      priceId: 'price_test',
      appBase: 'http://localhost:5500',
    });
    const second = await createCheckoutSessionForUser(stripe, 'user-1', {
      priceId: 'price_test',
      appBase: 'http://localhost:5500',
    });
    assert.equal(first.body.url, 'https://checkout.stripe.com/c/pay/cs_1');
    assert.equal(second.body.url, first.body.url);
    assert.equal(createArgs.length, 2);
    assert.equal(createArgs[0].request.idempotencyKey, createArgs[1].request.idempotencyKey);
    assert.equal(createArgs[0].request.idempotencyKey, checkoutIdempotencyKey('user-1', 'none'));
  } finally {
    admin.restore();
  }
});

test('6. Nueva compra legítima posterior no queda bloqueada', () => {
  const firstAttempt = checkoutIdempotencyKey('user-1', '');
  const retrySameAttempt = checkoutIdempotencyKey('user-1', 'none');
  const afterCompleted = checkoutIdempotencyKey('user-1', 'cs_completed_1');
  assert.equal(firstAttempt, retrySameAttempt);
  assert.notEqual(afterCompleted, firstAttempt);
  const prior = [{ id: 'cs_completed_1', status: 'complete', mode: 'subscription' }];
  assert.equal(latestCheckoutSessionId(prior), 'cs_completed_1');
  assert.equal(pickOpenCheckoutSession(prior), null);
  const open = pickOpenCheckoutSession([
    { id: 'cs_open', status: 'open', mode: 'subscription', url: 'https://checkout.stripe.com/c/pay/cs_open' },
  ]);
  assert.equal(open.id, 'cs_open');
});

test('7. perfil free + Stripe premium → Checkout crea URL y no escribe tipo_plan', async () => {
  const admin = installAdminMock({ id: 'user-1', email: 'a@b.c', tipo_plan: 'free' });
  let created = 0;
  try {
    const live = subscription({ id: 'sub_live', status: 'active' });
    const stripe = {
      customers: {
        create: async () => ({ id: 'cus_1' }),
      },
      subscriptions: {
        list: async () => ({ data: [live] }),
      },
      checkout: {
        sessions: {
          list: async () => ({ data: [] }),
          create: async () => {
            created += 1;
            return { url: 'https://checkout.stripe.com/c/pay/cs_x' };
          },
        },
      },
    };
    const result = await createCheckoutSessionForUser(stripe, 'user-1', {
      priceId: 'price_test',
      appBase: 'http://localhost:5500',
    });
    assert.equal(result.body.status, 'success');
    assert.equal(result.body.url, 'https://checkout.stripe.com/c/pay/cs_x');
    assert.equal(result.body.pendingSync, undefined);
    assert.equal(created, 1);
    assert.equal(
      admin.state.tipoPlanWrites.some((row) => row.tipo_plan === 'premium'),
      false
    );
  } finally {
    admin.restore();
  }
});

test('8. webhook válido de subscription premium → premium', async () => {
  const admin = installAdminMock();
  try {
    const live = subscription({ id: 'sub_live', status: 'active' });
    const stripe = {
      subscriptions: {
        retrieve: async () => live,
      },
    };
    const res = mockRes();
    await dispatchVerifiedEvent(
      stripe,
      { type: 'customer.subscription.updated', data: { object: live } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.received, true);
    assert.equal(admin.state.tipoPlanWrites.at(-1).tipo_plan, 'premium');
  } finally {
    admin.restore();
  }
});

test('9. webhook válido de cancelación sin otra premium → free', async () => {
  const admin = installAdminMock({ id: 'user-1', email: 'a@b.c', tipo_plan: 'premium' });
  try {
    const canceled = subscription({ id: 'sub_old', status: 'canceled' });
    const stripe = {
      subscriptions: {
        retrieve: async () => canceled,
        list: async () => ({ data: [canceled] }),
      },
    };
    const res = mockRes();
    await dispatchVerifiedEvent(
      stripe,
      { type: 'customer.subscription.deleted', data: { object: canceled } },
      res
    );
    assert.equal(res.statusCode, 200);
    assert.equal(admin.state.tipoPlanWrites.at(-1).tipo_plan, 'free');
  } finally {
    admin.restore();
  }
});
