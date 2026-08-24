-- =============================================================================
-- Inbox Zero — Migración 002: blindaje de profiles.tipo_plan
-- DELTA sobre el esquema ya aplicado por 001_inboxzero_schema.sql
-- No recrea tablas, cards, ni triggers de signup / límite de 20 fichas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Policy INSERT: solo el propio perfil y únicamente como free
--    handle_new_user (SECURITY DEFINER, migración 001) omite RLS y sigue
--    creando perfiles free en el signup vía on_auth_user_created.
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (
    auth.uid() = id
    and tipo_plan = 'free'
  );

-- ---------------------------------------------------------------------------
-- 2. Policy UPDATE: ownership (columnas controladas por GRANT abajo)
-- ---------------------------------------------------------------------------
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- 3. Trigger: impedir cambio de tipo_plan desde roles cliente (JWT)
--    - claim role authenticated / anon → bloqueado
--    - claim role service_role (backend futuro) → permitido
--    - SQL Editor / postgres (sin JWT de cliente) → permitido
--    SECURITY INVOKER: lee (auth.jwt() ->> 'role') de la sesión;
--    no se requiere SECURITY DEFINER.
--    Usa auth.jwt() (API actual de claims JWT en Supabase).
-- ---------------------------------------------------------------------------
create or replace function public.prevent_client_tipo_plan_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if old.tipo_plan is distinct from new.tipo_plan then
    if (auth.jwt() ->> 'role') in ('authenticated', 'anon') then
      raise exception 'No está permitido modificar tipo_plan desde el cliente'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

comment on function public.prevent_client_tipo_plan_change() is
  'Impide cambios de profiles.tipo_plan cuando auth.jwt()->>role es authenticated/anon; service_role y operadores DB pueden.';

drop trigger if exists profiles_prevent_client_tipo_plan_change on public.profiles;

create trigger profiles_prevent_client_tipo_plan_change
  before update on public.profiles
  for each row
  execute function public.prevent_client_tipo_plan_change();

-- ---------------------------------------------------------------------------
-- 4. Privilegios de columna: authenticated solo puede UPDATE (nombre)
-- ---------------------------------------------------------------------------
revoke update on public.profiles from authenticated;
grant update (nombre) on public.profiles to authenticated;

comment on column public.profiles.tipo_plan is
  'free: máx. 20 fichas; premium: sin límite en esta fase. Inmutable desde el cliente (authenticated/anon); solo backend service_role u operadores DB.';
