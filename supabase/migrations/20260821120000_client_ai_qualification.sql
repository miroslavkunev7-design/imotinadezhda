-- AI квалификация на клиенти (автоматизация №3)

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_score integer,
  ADD COLUMN IF NOT EXISTS lead_tier text,
  ADD COLUMN IF NOT EXISTS lead_urgency text,
  ADD COLUMN IF NOT EXISTS qualification_source text,
  ADD COLUMN IF NOT EXISTS qualification_summary text,
  ADD COLUMN IF NOT EXISTS qualification_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz;

ALTER TABLE public.inquiries
  ADD COLUMN IF NOT EXISTS lead_score integer,
  ADD COLUMN IF NOT EXISTS lead_tier text,
  ADD COLUMN IF NOT EXISTS lead_urgency text,
  ADD COLUMN IF NOT EXISTS qualification_source text,
  ADD COLUMN IF NOT EXISTS qualification_summary text,
  ADD COLUMN IF NOT EXISTS qualification_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS qualified_at timestamptz;

ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_lead_score_range;
ALTER TABLE public.clients ADD CONSTRAINT clients_lead_score_range
  CHECK (lead_score IS NULL OR (lead_score >= 0 AND lead_score <= 100));
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_lead_tier_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_lead_tier_check
  CHECK (lead_tier IS NULL OR lead_tier IN ('hot', 'warm', 'cold'));
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_lead_urgency_check;
ALTER TABLE public.clients ADD CONSTRAINT clients_lead_urgency_check
  CHECK (lead_urgency IS NULL OR lead_urgency IN ('high', 'medium', 'low'));

ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_lead_score_range;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_lead_score_range
  CHECK (lead_score IS NULL OR (lead_score >= 0 AND lead_score <= 100));
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_lead_tier_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_lead_tier_check
  CHECK (lead_tier IS NULL OR lead_tier IN ('hot', 'warm', 'cold'));
ALTER TABLE public.inquiries DROP CONSTRAINT IF EXISTS inquiries_lead_urgency_check;
ALTER TABLE public.inquiries ADD CONSTRAINT inquiries_lead_urgency_check
  CHECK (lead_urgency IS NULL OR lead_urgency IN ('high', 'medium', 'low'));

CREATE INDEX IF NOT EXISTS clients_lead_score_idx ON public.clients (lead_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS clients_lead_tier_idx ON public.clients (lead_tier);
CREATE INDEX IF NOT EXISTS inquiries_lead_score_idx ON public.inquiries (lead_score DESC NULLS LAST);

COMMENT ON COLUMN public.clients.lead_score IS 'Оценка 0–100: бюджет, район, интерес, пълнота на профила';
COMMENT ON COLUMN public.inquiries.lead_score IS 'Оценка 0–100 на запитване (евристика / AI)';

CREATE OR REPLACE FUNCTION public.guard_lead_qualification_cols()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.role(), '') = 'service_role'
     OR current_user IN ('postgres', 'supabase_admin', 'service_role') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.lead_score := NULL;
    NEW.lead_tier := NULL;
    NEW.lead_urgency := NULL;
    NEW.qualification_source := NULL;
    NEW.qualification_summary := NULL;
    NEW.qualification_breakdown := '{}'::jsonb;
    NEW.qualified_at := NULL;
  ELSE
    NEW.lead_score := OLD.lead_score;
    NEW.lead_tier := OLD.lead_tier;
    NEW.lead_urgency := OLD.lead_urgency;
    NEW.qualification_source := OLD.qualification_source;
    NEW.qualification_summary := OLD.qualification_summary;
    NEW.qualification_breakdown := OLD.qualification_breakdown;
    NEW.qualified_at := OLD.qualified_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_clients_qualification ON public.clients;
CREATE TRIGGER trg_guard_clients_qualification
  BEFORE INSERT OR UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_lead_qualification_cols();

DROP TRIGGER IF EXISTS trg_guard_inquiries_qualification ON public.inquiries;
CREATE TRIGGER trg_guard_inquiries_qualification
  BEFORE INSERT OR UPDATE ON public.inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_lead_qualification_cols();

REVOKE INSERT (lead_score, lead_tier, lead_urgency, qualification_source, qualification_summary, qualification_breakdown, qualified_at)
  ON public.clients FROM anon;
REVOKE UPDATE (lead_score, lead_tier, lead_urgency, qualification_source, qualification_summary, qualification_breakdown, qualified_at)
  ON public.clients FROM anon, authenticated;

REVOKE INSERT (lead_score, lead_tier, lead_urgency, qualification_source, qualification_summary, qualification_breakdown, qualified_at)
  ON public.inquiries FROM anon, authenticated;
REVOKE UPDATE (lead_score, lead_tier, lead_urgency, qualification_source, qualification_summary, qualification_breakdown, qualified_at)
  ON public.inquiries FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.guard_lead_qualification_cols() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.guard_lead_qualification_cols() FROM anon, authenticated;
