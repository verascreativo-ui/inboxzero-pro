-- Migración 006: eliminación de cuenta con periodo de gracia de 30 días
-- Añade dos columnas nullable a profiles. Si scheduled_deletion_at es NULL,
-- la cuenta está activa normal. Si tiene fecha, está en periodo de gracia.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at timestamptz;

COMMENT ON COLUMN public.profiles.deletion_requested_at IS 'Momento en que el usuario solicitó eliminar su cuenta. NULL = no ha solicitado eliminación.';
COMMENT ON COLUMN public.profiles.scheduled_deletion_at IS 'Fecha en la que la cuenta se borrará definitivamente (deletion_requested_at + 30 días). NULL = cuenta activa normal. Si tiene valor, la cuenta está en periodo de gracia.';

-- Índice para que la tarea programada diaria encuentre rápido las cuentas
-- cuyo plazo ya venció, sin recorrer toda la tabla.
CREATE INDEX IF NOT EXISTS idx_profiles_scheduled_deletion
  ON public.profiles (scheduled_deletion_at)
  WHERE scheduled_deletion_at IS NOT NULL;
