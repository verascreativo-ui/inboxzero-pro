import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const checkout = read('server/src/billing/checkout.js');
const webhook = read('server/src/billing/webhook.js');
const index = read('server/src/index.js');
const app = read('js/app.js');
const html = read('app.html');
const envExample = read('server/.env.example');
const sql001 = read('supabase/migrations/001_inboxzero_schema.sql');
const sql002 = read('supabase/migrations/002_protect_tipo_plan.sql');
const sql003 = read('supabase/migrations/003_serialize_free_plan_card_limit.sql');
const sql004 = read('supabase/migrations/004_billing_subscriptions.sql');

test('A. cliente no envía tipo_plan=premium', () => {
  const create = app.slice(
    app.indexOf('async function createBillingCheckoutSession'),
    app.indexOf('async function extractApiHeaders')
  );
  assert.doesNotMatch(create, /tipo_plan/);
  assert.doesNotMatch(create, /price:/);
  assert.doesNotMatch(create, /user_id/);
  assert.match(create, /Authorization:\s*`Bearer \$\{token\}`/);
  assert.doesNotMatch(create, /JSON\.stringify/);
});

test('B. cliente no elige precio Stripe', () => {
  assert.doesNotMatch(app, /STRIPE_PRICE_ID/);
  assert.doesNotMatch(app, /STRIPE_SECRET_KEY/);
  assert.doesNotMatch(app, /STRIPE_WEBHOOK_SECRET/);
  assert.doesNotMatch(app, /SERVICE_ROLE/);
  assert.doesNotMatch(html, /sk_live|sk_test|whsec_|service_role/);
  assert.doesNotMatch(app, /checkout\.stripe\.com\/test/);
});

test('C-D. Checkout exige Auth y UID de requireUser', () => {
  assert.match(
    index,
    /app\.post\(\s*'\/api\/billing\/create-checkout-session',\s*requireUser,\s*handleCreateCheckoutSession\s*\)/
  );
  assert.match(checkout, /req\.authUser && req\.authUser\.id/);
  assert.doesNotMatch(checkout, /req\.body\.user_id/);
  assert.doesNotMatch(checkout, /req\.body\.price/);
});

test('E-H. Checkout usa STRIPE_PRICE_ID, subscription, client_reference_id y metadata', () => {
  assert.match(checkout, /getStripePriceId\(\)/);
  assert.match(checkout, /mode:\s*'subscription'/);
  assert.match(checkout, /line_items:\s*\[\s*\{\s*price:\s*priceId,\s*quantity:\s*1\s*\}/);
  assert.match(checkout, /client_reference_id:\s*uid/);
  assert.match(checkout, /subscription_data:\s*\{[\s\S]*metadata:\s*\{\s*inboxzero_user_id:\s*uid/);
  assert.match(checkout, /metadata:\s*\{\s*inboxzero_user_id:\s*uid\s*\}/);
});

test('I-J. webhook verifica firma y usa body raw antes de json', () => {
  const webhookMount = index.slice(
    0,
    index.indexOf('app.use(express.json')
  );
  assert.match(webhookMount, /\/api\/billing\/webhook/);
  assert.match(webhookMount, /express\.raw\(\s*\{\s*type:\s*'application\/json'\s*\}\s*\)/);
  assert.match(webhook, /constructEvent/);
  assert.match(webhook, /stripe-signature/);
  assert.match(webhook, /Firma inválida/);
});

test('K-R. entitlement cubre estados MVP y cancel_at_period_end', () => {
  const ent = read('server/src/billing/entitlement.js');
  assert.match(ent, /trialing/);
  assert.match(ent, /active/);
  assert.match(ent, /past_due/);
  assert.match(ent, /incomplete/);
  assert.match(ent, /canceled/);
  assert.match(ent, /unpaid/);
  assert.match(ent, /paused/);
  assert.match(ent, /cancel_at_period_end no baja a free/);
});

test('S. webhook recupera Subscription actual y no usa payload como fallback', () => {
  assert.match(webhook, /subscriptions\.retrieve/);
  assert.match(webhook, /BILLING_RETRIEVE/);
  assert.doesNotMatch(webhook, /fallbackSub/);
  assert.match(webhook, /selectEntitlementSubscription/);
});

test('T. P0/P3/P3.1 y Free 20 / tipo_plan cliente intactos', () => {
  assert.match(app, /signOut\(\s*\{\s*scope:\s*'local'\s*\}\s*\)/);
  assert.match(app, /signOut\(\s*\{\s*scope:\s*'others'\s*\}\s*\)/);
  assert.match(app, /probeRevokedSessionOnResume/);
  assert.match(app, /purgeGuestStateAfterAuthenticatedSignOut/);
  assert.match(sql003, /free_limit constant integer := 20/);
  assert.match(sql002, /prevent_client_tipo_plan_change/);
  assert.doesNotMatch(sql004, /drop trigger/);
  assert.doesNotMatch(sql004, /enforce_free_plan_card_limit/);
  assert.doesNotMatch(sql004, /prevent_client_tipo_plan_change/);
  assert.match(sql001 + sql002 + sql003, /auth\.uid\(\) = user_id/);
});

test('env example documenta secretos de servidor y no valores reales', () => {
  assert.match(envExample, /STRIPE_SECRET_KEY=/);
  assert.match(envExample, /STRIPE_PRICE_ID=/);
  assert.match(envExample, /STRIPE_WEBHOOK_SECRET=/);
  assert.match(envExample, /APP_BASE_URL=/);
  assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=/);
  assert.doesNotMatch(envExample, /sk_live_/);
  assert.doesNotMatch(envExample, /whsec_[A-Za-z0-9]{10,}/);
});

test('004 no otorga UPDATE al cliente', () => {
  assert.match(sql004, /enable row level security/);
  assert.match(sql004, /revoke all on table public\.billing_subscriptions from authenticated/);
  assert.match(sql004, /revoke all on table public\.billing_subscriptions from anon/);
});

test('Checkout no escribe tipo_plan al crear la sesión', () => {
  assert.match(checkout, /alreadyPremium/);
  assert.match(checkout, /idempotencyKey/);
  assert.match(checkout, /checkoutIdempotencyKey/);
  assert.doesNotMatch(checkout, /adminSetTipoPlan/);
  assert.doesNotMatch(checkout, /pendingSync/);
});
