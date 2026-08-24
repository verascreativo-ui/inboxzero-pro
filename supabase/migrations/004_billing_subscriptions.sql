-- =============================================================================
-- Inbox Zero — Migración 004: billing_subscriptions (Stripe)
-- DELTA. No modifica 001/002/003, RLS de cards, ni profiles.tipo_plan
-- (el cliente sigue sin poder cambiar tipo_plan; ver 002).
-- =============================================================================

create table if not exists public.billing_subscriptions (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  stripe_status text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists billing_subscriptions_stripe_customer_id_uidx
  on public.billing_subscriptions (stripe_customer_id)
  where stripe_customer_id is not null;

create unique index if not exists billing_subscriptions_stripe_subscription_id_uidx
  on public.billing_subscriptions (stripe_subscription_id)
  where stripe_subscription_id is not null;

comment on table public.billing_subscriptions is
  'Estado Stripe por usuario. Solo backend privilegiado (service_role). El cliente no escribe tipo_plan.';

alter table public.billing_subscriptions enable row level security;

revoke all on table public.billing_subscriptions from public;
revoke all on table public.billing_subscriptions from anon;
revoke all on table public.billing_subscriptions from authenticated;
