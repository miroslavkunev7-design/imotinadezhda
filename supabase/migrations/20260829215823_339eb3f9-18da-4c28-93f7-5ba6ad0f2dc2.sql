CREATE TABLE public.crm_custom_shapes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  mask_url text NOT NULL,
  kind text NOT NULL DEFAULT 'mask',
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_custom_shapes TO authenticated;
GRANT ALL ON public.crm_custom_shapes TO service_role;

ALTER TABLE public.crm_custom_shapes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team can read custom shapes"
  ON public.crm_custom_shapes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create custom shapes"
  ON public.crm_custom_shapes FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Owner or admin can update custom shapes"
  ON public.crm_custom_shapes FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owner or admin can delete custom shapes"
  ON public.crm_custom_shapes FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER crm_custom_shapes_set_updated_at
  BEFORE UPDATE ON public.crm_custom_shapes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();