-- Add monthly management fee (our commission) to rentals.
-- Net to landlord = monthly_rent - management_fee.

ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS management_fee NUMERIC(12,2) DEFAULT 0;