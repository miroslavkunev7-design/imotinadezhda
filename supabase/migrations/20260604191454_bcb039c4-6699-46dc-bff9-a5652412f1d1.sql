-- Add new role values to app_role enum for broker hierarchy
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'head_broker';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'consultant';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'rental_dept';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'boss';