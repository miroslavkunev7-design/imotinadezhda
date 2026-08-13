ALTER TABLE public.archived_properties
  ADD CONSTRAINT archived_properties_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE SET NULL,
  ADD CONSTRAINT archived_properties_quarter_id_fkey FOREIGN KEY (quarter_id) REFERENCES public.quarters(id) ON DELETE SET NULL;
NOTIFY pgrst, 'reload schema';