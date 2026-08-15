-- =============================================================================
-- Inbox Zero — Migración 003: serializar el límite de 20 fichas (plan free)
-- DELTA sobre 001/002. No recrea tablas, RLS, ni el trigger
-- cards_enforce_free_plan_limit (sigue ejecutando esta función).
--
-- Problema: COUNT(*) en BEFORE INSERT sin lock. En READ COMMITTED, N INSERT
-- concurrentes ven el mismo recuento y pueden superar 20.
-- Solución: pg_advisory_xact_lock por usuario, solo si tipo_plan = 'free'.
-- El lock se libera al COMMIT/ROLLBACK de esa transacción.
-- =============================================================================

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
    -- Namespace 872001 = límite de fichas InboxZero. Clave 2 = hash del user_id.
    -- Usuarios distintos no se bloquean entre sí. Premium no entra aquí.
    perform pg_advisory_xact_lock(872001, hashtext(new.user_id::text));

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

comment on function public.enforce_free_plan_card_limit() is
  'BEFORE INSERT: free máx. 20 fichas. pg_advisory_xact_lock(872001, hashtext(user_id)) serializa INSERT concurrentes del mismo usuario; premium no se limita.';
