
DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT * FROM (VALUES
      ('clients','search_city_id','cities','id','SET NULL'),
      ('clients','search_quarter_id','quarters','id','SET NULL'),
      ('clients','assigned_broker_id','brokers','id','SET NULL'),
      ('client_documents','client_id','clients','id','CASCADE'),
      ('property_matches','property_id','properties','id','CASCADE'),
      ('property_matches','client_id','clients','id','CASCADE'),
      ('generated_contracts','client_id','clients','id','SET NULL'),
      ('generated_contracts','property_id','properties','id','SET NULL'),
      ('generated_contracts','template_id','contract_templates','id','SET NULL'),
      ('broker_tasks','broker_id','brokers','id','CASCADE'),
      ('broker_tasks','client_id','clients','id','SET NULL'),
      ('properties','city_id','cities','id','RESTRICT'),
      ('properties','quarter_id','quarters','id','SET NULL'),
      ('properties','owner_id','owners','id','SET NULL'),
      ('quarters','city_id','cities','id','CASCADE'),
      ('property_images','property_id','properties','id','CASCADE'),
      ('quarter_images','quarter_id','quarters','id','CASCADE'),
      ('property_documents','property_id','properties','id','CASCADE'),
      ('owners','city_id','cities','id','SET NULL')
    ) AS t(tbl, col, ref_tbl, ref_col, on_del)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
        AND tc.table_name = fk.tbl
        AND kcu.column_name = fk.col
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(%I) ON DELETE %s',
        fk.tbl, fk.tbl || '_' || fk.col || '_fkey', fk.col, fk.ref_tbl, fk.ref_col, fk.on_del
      );
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
