-- ============================================================
-- Автоматизация №13: Отчети към Собственици
-- Автоматични периодични отчети за интерес, огледи и препоръки.
-- Безопасна миграция: само IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ---------- Шаблони за отчет ----------
create table if not exists public.owner_report_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  description text,
  sections text[] not null default array['summary','interest','viewings','feedback','recommendations'],
  tone text not null default 'professional',
  include_ai_summary boolean not null default true,
  include_price_advice boolean not null default true,
  is_active boolean not null default true
);

grant select, insert, update, delete on public.owner_report_templates to authenticated;
grant all on public.owner_report_templates to service_role;
alter table public.owner_report_templates enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='owner_report_templates' and policyname='owner_report_templates_auth_all') then
    create policy owner_report_templates_auth_all on public.owner_report_templates for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.owner_report_templates (code, name, description, sections, tone)
values
  ('monthly_standard', 'Месечен отчет (стандартен)', 'Пълен месечен отчет за интерес, огледи и обратна връзка.',
    array['summary','interest','viewings','feedback','recommendations'], 'professional'),
  ('weekly_short', 'Седмичен кратък отчет', 'Кратка седмична справка за активността по имота.',
    array['summary','interest','viewings'], 'concise'),
  ('price_review', 'Отчет с ценови анализ', 'Отчет с акцент върху пазарния интерес и препоръка за цената.',
    array['summary','interest','recommendations'], 'advisory')
on conflict (code) do nothing;

-- ---------- Отчети ----------
create table if not exists public.owner_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id uuid references public.owners(id) on delete cascade,
  owner_name text,
  owner_email text,
  property_ids uuid[] not null default '{}',
  template_code text not null default 'monthly_standard',
  period_start timestamptz not null,
  period_end timestamptz not null,
  status text not null default 'draft',            -- draft|ready|sent|failed|archived
  metrics jsonb not null default '{}'::jsonb,
  summary text,
  recommendations text,
  html text,
  subject text,
  recipient text,
  ai_used boolean not null default false,
  model text,
  token text not null default encode(gen_random_bytes(16), 'hex'),
  sent_at timestamptz,
  opened_at timestamptz,
  open_count int not null default 0,
  error text,
  schedule_id uuid,
  created_by text,
  unique (token)
);

create index if not exists owner_reports_owner_idx on public.owner_reports (owner_id, period_end desc);
create index if not exists owner_reports_status_idx on public.owner_reports (status, created_at desc);

grant select, insert, update, delete on public.owner_reports to authenticated;
grant all on public.owner_reports to service_role;
alter table public.owner_reports enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='owner_reports' and policyname='owner_reports_auth_all') then
    create policy owner_reports_auth_all on public.owner_reports for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Графици ----------
create table if not exists public.owner_report_schedules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  owner_id uuid references public.owners(id) on delete cascade,
  template_code text not null default 'monthly_standard',
  frequency text not null default 'monthly',        -- weekly|biweekly|monthly
  hour int not null default 9,
  channel text not null default 'email',
  auto_send boolean not null default true,
  is_active boolean not null default true,
  next_run_at timestamptz not null default now(),
  last_run_at timestamptz,
  last_report_id uuid,
  notes text,
  unique (owner_id, template_code)
);

create index if not exists owner_report_schedules_due_idx on public.owner_report_schedules (is_active, next_run_at);

grant select, insert, update, delete on public.owner_report_schedules to authenticated;
grant all on public.owner_report_schedules to service_role;
alter table public.owner_report_schedules enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='owner_report_schedules' and policyname='owner_report_schedules_auth_all') then
    create policy owner_report_schedules_auth_all on public.owner_report_schedules for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Журнал ----------
create table if not exists public.owner_report_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  report_id uuid references public.owner_reports(id) on delete cascade,
  owner_id uuid,
  action text not null,
  status text not null default 'ok',
  message text,
  actor text
);

create index if not exists owner_report_events_time_idx on public.owner_report_events (created_at desc);

grant select, insert, update, delete on public.owner_report_events to authenticated;
grant all on public.owner_report_events to service_role;
alter table public.owner_report_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='owner_report_events' and policyname='owner_report_events_auth_all') then
    create policy owner_report_events_auth_all on public.owner_report_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки и задача ----------
insert into public.automation_settings (key, value)
values ('owner_reports', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'auto_send', true,
  'batch_size', 5,
  'lease_seconds', 300,
  'default_template', 'monthly_standard',
  'default_frequency', 'monthly',
  'period_days', 30,
  'send_hour', 9,
  'skip_empty_activity', false
))
on conflict (key) do nothing;

insert into public.automation_jobs (key)
values ('owner_reports_sweep')
on conflict (key) do nothing;