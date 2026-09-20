-- ============================================================
-- Автоматизация №3: AI Квалификация на клиенти
-- бюджет · район · интерес · скоринг (BANT-подобен модел)
-- Безопасна миграция: само IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ---------- Разширения по лийдовете ----------
alter table public.leads add column if not exists qualification_status text default 'pending';   -- pending|qualified|nurture|disqualified
alter table public.leads add column if not exists qualification_score int;                      -- 0-100 (претеглен)
alter table public.leads add column if not exists qualification_grade text;                     -- A|B|C|D
alter table public.leads add column if not exists qualified_at timestamptz;
alter table public.leads add column if not exists timeframe text;                               -- immediate|1_3_months|3_6_months|6_12_months|exploring
alter table public.leads add column if not exists financing text;                               -- cash|mortgage_approved|mortgage_needed|unknown
alter table public.leads add column if not exists rooms_min int;
alter table public.leads add column if not exists area_min numeric;
alter table public.leads add column if not exists area_max numeric;
alter table public.leads add column if not exists desired_district text;
alter table public.leads add column if not exists motivation text;

create index if not exists leads_qualification_status_idx on public.leads (qualification_status);
create index if not exists leads_qualification_score_idx on public.leads (qualification_score desc);

-- ---------- История на квалификациите ----------
create table if not exists public.lead_qualifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.leads(id) on delete cascade,

  -- извлечени параметри
  lead_type text,
  intent text,
  budget_min numeric,
  budget_max numeric,
  currency text default 'EUR',
  desired_city text,
  desired_district text,
  desired_property_type text,
  rooms_min int,
  area_min numeric,
  area_max numeric,
  timeframe text,
  financing text,
  motivation text,

  -- скоринг
  score int not null default 0,
  grade text,
  status text not null default 'pending',            -- qualified|nurture|disqualified|pending
  breakdown jsonb,                                   -- {budget: n, timeframe: n, ...}
  missing_fields text[],
  matched_properties int default 0,
  recommended_action text,
  next_questions text[],
  ai_summary text,
  ai_raw jsonb,
  model text,
  source text not null default 'auto',               -- auto|manual|form
  actor text
);

create index if not exists lead_qualifications_lead_idx on public.lead_qualifications (lead_id, created_at desc);

grant select, insert, update, delete on public.lead_qualifications to authenticated;
grant all on public.lead_qualifications to service_role;
alter table public.lead_qualifications enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_qualifications' and policyname='lead_qualifications_auth_all') then
    create policy lead_qualifications_auth_all on public.lead_qualifications for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Отговори от публичния въпросник ----------
create table if not exists public.qualification_answers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid references public.leads(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  ip text,
  landing_path text
);

create index if not exists qualification_answers_lead_idx on public.qualification_answers (lead_id, created_at desc);

grant select, insert on public.qualification_answers to authenticated;
grant all on public.qualification_answers to service_role;
alter table public.qualification_answers enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='qualification_answers' and policyname='qualification_answers_auth_all') then
    create policy qualification_answers_auth_all on public.qualification_answers for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки на скоринга ----------
insert into public.automation_settings (key, value) values
  ('qualification', '{"enabled": true, "ai_enabled": true, "auto_on_capture": true, "qualified_threshold": 70, "nurture_threshold": 40, "weights": {"budget": 25, "timeframe": 20, "financing": 15, "location": 15, "contactability": 15, "engagement": 10}}'::jsonb)
on conflict (key) do nothing;
