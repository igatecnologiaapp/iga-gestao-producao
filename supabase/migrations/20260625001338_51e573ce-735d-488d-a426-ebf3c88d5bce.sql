
CREATE TABLE IF NOT EXISTS public.units_of_measure (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  description TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS units_of_measure_abbr_lower_idx
  ON public.units_of_measure (lower(abbreviation));

GRANT SELECT ON public.units_of_measure TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.units_of_measure TO authenticated;
GRANT ALL ON public.units_of_measure TO service_role;

ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;

CREATE POLICY "units_select_all_authenticated"
  ON public.units_of_measure FOR SELECT TO authenticated USING (true);

CREATE POLICY "units_insert_admin"
  ON public.units_of_measure FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "units_update_admin"
  ON public.units_of_measure FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "units_delete_admin"
  ON public.units_of_measure FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER units_of_measure_set_updated_at
  BEFORE UPDATE ON public.units_of_measure
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed defaults (idempotent, on conflict do nothing)
INSERT INTO public.units_of_measure (name, abbreviation, description, active, display_order)
VALUES
  ('Quilograma', 'kg', 'Unidade de massa (1000 g)', true, 10),
  ('Grama', 'g', 'Unidade de massa', true, 20),
  ('Litro', 'litro', 'Unidade de volume', true, 30),
  ('Mililitro', 'ml', 'Unidade de volume (1/1000 L)', true, 40),
  ('Unidade', 'unidade', 'Item unitário', true, 50),
  ('Pacote', 'pacote', 'Embalagem em pacote', true, 60),
  ('Caixa', 'caixa', 'Embalagem em caixa', true, 70),
  ('Porção', 'porção', 'Porção individual', true, 80),
  ('Outra', 'outra', 'Outra unidade', true, 999)
ON CONFLICT DO NOTHING;

-- Migrate any units already in use that are not in the seed
INSERT INTO public.units_of_measure (name, abbreviation, description, active, display_order)
SELECT DISTINCT
  u.unit AS name,
  u.unit AS abbreviation,
  'Migrada automaticamente dos dados existentes' AS description,
  true,
  500
FROM (
  SELECT unit FROM public.materials WHERE unit IS NOT NULL AND unit <> ''
  UNION
  SELECT unit FROM public.products WHERE unit IS NOT NULL AND unit <> ''
) u
WHERE NOT EXISTS (
  SELECT 1 FROM public.units_of_measure x
  WHERE lower(x.abbreviation) = lower(u.unit)
);
