BEGIN;
DO $patch$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.nd_units_price()'::regprocedure) INTO definition;
 IF position('round(base_area * new.price_per_m2, 0)' IN definition)>0 THEN
   EXECUTE replace(definition,'round(base_area * new.price_per_m2, 0)','round(base_area * new.price_per_m2, 2)');
 ELSIF position('round(base_area * new.price_per_m2, 2)' IN definition)=0 THEN
   RAISE EXCEPTION 'Unexpected price function; manual review required';
 END IF;
END
$patch$;
COMMENT ON COLUMN public.nd_units.price_total IS 'Цена = избрана площ по ценовата политика × цена на m², с точност 0,01 EUR. Ръчна стойност само с price_override и причина.';
UPDATE public.nd_units SET price_per_m2=price_per_m2
WHERE project_id='82f5aa6a94154507afe916c45f6091fc'
  AND NOT price_override AND price_per_m2=1550
  AND price_total IS DISTINCT FROM round(area_net * price_per_m2,2);
DO $verify$
BEGIN
 IF (SELECT count(*) FROM public.nd_units WHERE project_id='82f5aa6a94154507afe916c45f6091fc' AND NOT price_override AND price_per_m2=1550 AND price_total=round(area_net*1550,2))<>6 THEN
  RAISE EXCEPTION 'Six exact project prices were not verified';
 END IF;
END
$verify$;
COMMIT;
SELECT code,area_net,price_per_m2,price_total,status FROM public.nd_units WHERE project_id='82f5aa6a94154507afe916c45f6091fc' ORDER BY code;