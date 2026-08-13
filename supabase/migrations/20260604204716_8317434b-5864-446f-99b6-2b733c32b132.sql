DROP POLICY IF EXISTS "mortgage_applications anyone insert" ON public.mortgage_applications;
CREATE POLICY "mortgage_applications anyone insert"
ON public.mortgage_applications
FOR INSERT
TO anon, authenticated
WITH CHECK (
  full_name IS NOT NULL
  AND length(btrim(full_name)) BETWEEN 2 AND 200
  AND phone IS NOT NULL
  AND length(btrim(phone)) BETWEEN 4 AND 40
  AND (email IS NULL OR length(email) <= 200)
  AND (notes IS NULL OR length(notes) <= 2000)
  AND (monthly_income IS NULL OR monthly_income >= 0)
);