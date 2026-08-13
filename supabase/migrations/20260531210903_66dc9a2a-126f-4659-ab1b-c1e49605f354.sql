
-- Storage policies for property-images bucket (admin write, public read)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'property-images public read') THEN
    CREATE POLICY "property-images public read" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'property-images admin insert') THEN
    CREATE POLICY "property-images admin insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'property-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'property-images admin update') THEN
    CREATE POLICY "property-images admin update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'property-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'property-images admin delete') THEN
    CREATE POLICY "property-images admin delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'property-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));
  END IF;
END $$;
