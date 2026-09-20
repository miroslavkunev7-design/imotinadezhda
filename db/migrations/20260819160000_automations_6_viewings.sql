-- ============================================================
-- Автоматизация №6: Насрочване на Огледи
-- Календар на огледите + автоматични напомняния и обратна връзка.
-- Безопасна миграция: само IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ---------- Допълнителни полета по лийда ----------
alter table public.leads add column if not exists viewings_count int not null default 0;
alter table public.leads add column if not exists last_viewing_at timestamptz;
alter table public.leads add column if not exists next_viewing_at timestamptz;

-- ---------- Огледи ----------
create table if not exists public.viewings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid references public.leads(id) on delete set null,
  client_id uuid,
  property_id uuid,
  agent_id uuid,
  agent_name text,
  agent_email text,
  agent_phone text,
  contact_name text,
  contact_email text,
  contact_phone text,
  scheduled_at timestamptz not null,
  duration_min int not null default 45,
  status text not null default 'proposed',      -- proposed|confirmed|rescheduled|completed|no_show|cancelled
  source text not null default 'crm',           -- crm|website|matching|followup|phone
  location text,
  notes text,
  internal_notes text,
  token text not null default encode(gen_random_bytes(16), 'hex'),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  rescheduled_from timestamptz,
  reschedule_count int not null default 0,
  outcome text,                                 -- interested|not_interested|offer|needs_second_visit
  outcome_notes text,
  rating int,
  feedback text,
  feedback_at timestamptz,
  reminders_sent int not null default 0,
  ai_used boolean not null default false,
  created_by text,
  unique (token)
);

create index if not exists viewings_sched_idx on public.viewings (scheduled_at);
create index if not exists viewings_status_idx on public.viewings (status, scheduled_at);
create index if not exists viewings_lead_idx on public.viewings (lead_id);
create index if not exists viewings_agent_idx on public.viewings (agent_id, scheduled_at);

grant select, insert, update, delete on public.viewings to authenticated;
grant all on public.viewings to service_role;
alter table public.viewings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='viewings' and policyname='viewings_auth_all') then
    create policy viewings_auth_all on public.viewings for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Напомняния по оглед ----------
create table if not exists public.viewing_reminders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  viewing_id uuid not null references public.viewings(id) on delete cascade,
  kind text not null,                           -- invite|reminder_24h|reminder_2h|feedback|agent_brief
  channel text not null default 'email',
  scheduled_at timestamptz not null,
  status text not null default 'pending',       -- pending|sent|manual|failed|skipped|cancelled
  recipient text,
  subject text,
  body text,
  sent_at timestamptz,
  error text,
  ai_used boolean not null default false,
  model text,
  unique (viewing_id, kind)
);

create index if not exists viewing_reminders_due_idx on public.viewing_reminders (status, scheduled_at);

grant select, insert, update, delete on public.viewing_reminders to authenticated;
grant all on public.viewing_reminders to service_role;
alter table public.viewing_reminders enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='viewing_reminders' and policyname='viewing_reminders_auth_all') then
    create policy viewing_reminders_auth_all on public.viewing_reminders for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Работно време за огледи ----------
create table if not exists public.viewing_availability (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent_id uuid,                                -- null = важи за целия офис
  weekday int not null,                         -- 0 = неделя ... 6 = събота
  start_hour int not null default 10,
  end_hour int not null default 19,
  slot_minutes int not null default 60,
  is_active boolean not null default true,
  unique (agent_id, weekday)
);

grant select, insert, update, delete on public.viewing_availability to authenticated;
grant all on public.viewing_availability to service_role;
alter table public.viewing_availability enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='viewing_availability' and policyname='viewing_availability_auth_all') then
    create policy viewing_availability_auth_all on public.viewing_availability for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Блокирани дати (отпуски, празници) ----------
create table if not exists public.viewing_blackouts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  agent_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text
);

create index if not exists viewing_blackouts_range_idx on public.viewing_blackouts (starts_at, ends_at);

grant select, insert, update, delete on public.viewing_blackouts to authenticated;
grant all on public.viewing_blackouts to service_role;
alter table public.viewing_blackouts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='viewing_blackouts' and policyname='viewing_blackouts_auth_all') then
    create policy viewing_blackouts_auth_all on public.viewing_blackouts for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Работно време по подразбиране (понеделник–събота) ----------
insert into public.viewing_availability (agent_id, weekday, start_hour, end_hour, slot_minutes)
select null, wd, 10, 19, 60
from (values (1),(2),(3),(4),(5),(6)) as t(wd)
where not exists (
  select 1 from public.viewing_availability va where va.agent_id is null and va.weekday = t.wd
);

-- ---------- Настройки на автоматизацията ----------
insert into public.automation_settings (key, value)
values (
  'viewings',
  jsonb_build_object(
    'enabled', true,
    'ai_enabled', true,
    'batch_size', 25,
    'send_invite', true,
    'reminder_24h', true,
    'reminder_2h', true,
    'feedback_request', true,
    'agent_brief', true,
    'feedback_delay_hours', 3,
    'auto_no_show_hours', 24,
    'min_lead_hours', 3,
    'slot_days_ahead', 10,
    'quiet_start', 21,
    'quiet_end', 8,
    'lease_seconds', 300
  )
)
on conflict (key) do nothing;

insert into public.automation_jobs (key) values ('viewings_sweep') on conflict (key) do nothing;
