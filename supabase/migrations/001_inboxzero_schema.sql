-- =============================================================================
-- Inbox Zero — Fase 2: esquema inicial (profiles + cards + RLS + límite free)
-- Ejecutar una sola vez en: Supabase Dashboard → SQL Editor → New query → Run
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tabla profiles (1:1 con auth.users)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null default '',
  email text not null,
  tipo_plan text not null default 'free'
    check (tipo_plan in ('free', 'premium')),
  creado_en timestamptz not null default now()
);

comment on table public.profiles is 'Perfil de aplicación por usuario autenticado';
comment on column public.profiles.tipo_plan is 'free: máx. 20 fichas; premium: sin límite en esta migración';

-- ---------------------------------------------------------------------------
-- 2. Tabla cards (fichas del usuario)
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null default '',
  description text not null default '',
  url text not null default '',
  category text not null default '',
  favorite boolean not null default false,
  "readLater" boolean not null default false,
  notes text not null default '',
  image text not null default '',
  creado_en timestamptz not null default now()
);

create index if not exists cards_user_id_idx on public.cards (user_id);
create index if not exists cards_user_id_creado_en_idx on public.cards (user_id, creado_en desc);

comment on table public.cards is 'Fichas de conocimiento guardadas por cada usuario';

-- ---------------------------------------------------------------------------
-- 3. Perfil automático al registrarse (Supabase Auth)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, nombre, tipo_plan)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'nombre',
      ''
    ),
    'free'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. Límite estricto: plan free → máximo 20 fichas (solo INSERT)
-- ---------------------------------------------------------------------------
create or replace function public.enforce_free_plan_card_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  plan text;
  card_count integer;
  free_limit constant integer := 20;
begin
  select p.tipo_plan into plan
  from public.profiles p
  where p.id = new.user_id;

  if plan is null then
    raise exception 'Perfil no encontrado para el usuario %', new.user_id
      using errcode = 'P0001';
  end if;

  if plan = 'free' then
    select count(*)::integer into card_count
    from public.cards c
    where c.user_id = new.user_id;

    if card_count >= free_limit then
      raise exception
        'Límite del plan gratuito alcanzado (% fichas). Actualiza a premium para guardar más.',
        free_limit
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists cards_enforce_free_plan_limit on public.cards;

create trigger cards_enforce_free_plan_limit
  before insert on public.cards
  for each row
  execute function public.enforce_free_plan_card_limit();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security (RLS)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.cards enable row level security;

-- profiles: solo el propio usuario
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Inserción manual del propio perfil (por si el trigger fallara en usuarios legacy)
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = id);

-- cards: CRUD solo sobre fichas propias
drop policy if exists "cards_select_own" on public.cards;
create policy "cards_select_own"
  on public.cards
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "cards_insert_own" on public.cards;
create policy "cards_insert_own"
  on public.cards
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "cards_update_own" on public.cards;
create policy "cards_update_own"
  on public.cards
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "cards_delete_own" on public.cards;
create policy "cards_delete_own"
  on public.cards
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Permisos para el rol authenticated (RLS sigue aplicando)
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.cards to authenticated;
