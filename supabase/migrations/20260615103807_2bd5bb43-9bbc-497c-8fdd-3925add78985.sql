
CREATE TABLE public.theme_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  presets jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.theme_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.theme_settings TO authenticated;
GRANT ALL ON public.theme_settings TO service_role;

ALTER TABLE public.theme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read theme"
ON public.theme_settings FOR SELECT
USING (true);

CREATE POLICY "Admins can insert theme"
ON public.theme_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update theme"
ON public.theme_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete theme"
ON public.theme_settings FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER set_updated_at_theme_settings
BEFORE UPDATE ON public.theme_settings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.theme_settings (singleton, tokens, presets)
VALUES (true, '{}'::jsonb, '{}'::jsonb)
ON CONFLICT (singleton) DO NOTHING;
