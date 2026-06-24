
ALTER TABLE public.backups ADD COLUMN IF NOT EXISTS is_auto BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.backup_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  frequency TEXT NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekly')),
  weekday SMALLINT NOT NULL DEFAULT 1 CHECK (weekday BETWEEN 0 AND 6),
  hour_utc SMALLINT NOT NULL DEFAULT 6 CHECK (hour_utc BETWEEN 0 AND 23),
  retention_count INTEGER NOT NULL DEFAULT 14 CHECK (retention_count > 0),
  retention_days INTEGER NOT NULL DEFAULT 60 CHECK (retention_days > 0),
  last_run_at TIMESTAMPTZ,
  last_status TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.backup_settings TO authenticated;
GRANT ALL ON public.backup_settings TO service_role;

ALTER TABLE public.backup_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read backup settings" ON public.backup_settings;
CREATE POLICY "Admins read backup settings" ON public.backup_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins write backup settings" ON public.backup_settings;
CREATE POLICY "Admins write backup settings" ON public.backup_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.backup_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
