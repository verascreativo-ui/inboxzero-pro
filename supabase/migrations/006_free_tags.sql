-- 006_free_tags.sql
-- Añade el campo "tags" (etiquetas libres) a la tabla de fichas.
-- No afecta a RLS existente: las políticas ya protegen la fila completa por user_id.
ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
COMMENT ON COLUMN public.cards.tags IS 'Etiquetas libres creadas por el usuario, máximo 5 por ficha (validado en frontend).';
