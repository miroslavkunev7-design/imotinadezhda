-- ============================================================
-- Автоматизация №1: Smart Lead Capture System
-- Автоматизация №2: Instant First Contact Engine
-- Безопасна миграция: само IF NOT EXISTS, не променя съществуващи таблици.
-- ============================================================

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Канал и източник
  channel text not null default 'website',            -- website|property_page|mortgage|chat|phone|portal|manual|facebook|other
  source text,                                        -- напр. imot.bg, Google Ads, ръчно
  utm_source text,
  utm_medium text,
  utm_campaign text,
  referrer text,
  landing_path text,

  -- Контакт
  full_name text not null,
  phone text,
  email text,
  message text,
  preferred_contact text,                             -- phone|email|viber|whatsapp

  -- Връзки
  property_id uuid,
  client_id uuid,
  assigned_broker_id uuid,
  city_id uuid,

  -- AI обогатяване
  lead_type text,                                     -- buyer|seller|tenant|landlord|investor|unknown
  intent text,
  budget_min numeric,
  budget_max numeric,
  currency text default 'EUR',
  desired_city text,
  desired_property_type text,
  score int not null default 0,
  ai_summary text,
  ai_raw jsonb,

  -- Обработка
  status text not null default 'new',                 -- new|contacted|qualified|converted|lost|spam
  dedupe_key text,
  first_contact_at timestamptz,
  first_contact_seconds int,
  notes text
);

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx on public.leads (status);
create index if not exists leads_channel_idx on public.leads (channel);
create unique index if not exists leads_dedupe_key_idx on public.leads (dedupe_key) where dedupe_key is not null;

grant select, insert, update, delete on public.leads to authenticated;
grant all on public.leads to service_role;
alter table public.leads enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='leads' and policyname='leads_auth_all') then
    create policy leads_auth_all on public.leads for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Одит на събитията по лийд ----------
create table if not exists public.lead_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  event_type text not null,                          -- captured|enriched|deduped|contact_sent|contact_failed|status_changed|escalated|note
  channel text,
  detail text,
  payload jsonb,
  actor text
);

create index if not exists lead_events_lead_idx on public.lead_events (lead_id, created_at desc);

grant select, insert on public.lead_events to authenticated;
grant all on public.lead_events to service_role;
alter table public.lead_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_events' and policyname='lead_events_auth_all') then
    create policy lead_events_auth_all on public.lead_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Шаблони за първи контакт ----------
create table if not exists public.contact_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  channel text not null default 'email',             -- email|sms|whatsapp|viber
  lead_type text,                                    -- null = за всички
  subject text,
  body text not null,
  is_active boolean not null default true
);

grant select, insert, update, delete on public.contact_templates to authenticated;
grant all on public.contact_templates to service_role;
alter table public.contact_templates enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contact_templates' and policyname='contact_templates_auth_all') then
    create policy contact_templates_auth_all on public.contact_templates for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Опити за контакт ----------
create table if not exists public.contact_attempts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'email',
  template_id uuid references public.contact_templates(id) on delete set null,
  subject text,
  body text,
  status text not null default 'pending',             -- pending|sent|failed|skipped|manual
  error text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  latency_seconds int
);

create index if not exists contact_attempts_lead_idx on public.contact_attempts (lead_id, created_at desc);
create index if not exists contact_attempts_status_idx on public.contact_attempts (status, scheduled_at);

grant select, insert, update, delete on public.contact_attempts to authenticated;
grant all on public.contact_attempts to service_role;
alter table public.contact_attempts enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contact_attempts' and policyname='contact_attempts_auth_all') then
    create policy contact_attempts_auth_all on public.contact_attempts for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки на автоматизациите ----------
create table if not exists public.automation_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.automation_settings to authenticated;
grant all on public.automation_settings to service_role;
alter table public.automation_settings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='automation_settings' and policyname='automation_settings_auth_all') then
    create policy automation_settings_auth_all on public.automation_settings for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.automation_settings (key, value) values
  ('instant_contact', '{"enabled": true, "window_seconds": 30, "channel": "email", "ai_personalize": true, "escalate_after_minutes": 30, "work_hours_start": 8, "work_hours_end": 21}'::jsonb)
on conflict (key) do nothing;

insert into public.contact_templates (name, channel, lead_type, subject, body, is_active) values
  ('Първи контакт — купувач', 'email', 'buyer', 'Здравейте, {{name}} — Имоти Надежда',
   E'Здравейте, {{name}},\n\nБлагодарим за запитването Ви{{property_line}}. Аз съм от екипа на „Имоти Надежда“ и ще Ви съдействам лично.\n\nМога да Ви изпратя подбор от подходящи имоти и да организирам оглед в удобен за Вас час.\n\nТелефон: 0888 000 000\n\nПоздрави,\nЕкип „Имоти Надежда“', true),
  ('Първи контакт — продавач', 'email', 'seller', 'Оценка на Вашия имот — Имоти Надежда',
   E'Здравейте, {{name}},\n\nБлагодарим Ви, че се обърнахте към „Имоти Надежда“. Можем да направим безплатна пазарна оценка на имота Ви и да подготвим план за продажба.\n\nТелефон: 0888 000 000\n\nПоздрави,\nЕкип „Имоти Надежда“', true),
  ('Първи контакт — общ', 'email', null, 'Получихме Вашето запитване — Имоти Надежда',
   E'Здравейте, {{name}},\n\nПолучихме Вашето запитване{{property_line}} и ще се свържем с Вас в най-кратък срок.\n\nПоздрави,\nЕкип „Имоти Надежда“', true),
  ('Първи контакт — SMS', 'sms', null, null,
   'Здравейте, {{name}}! Получихме запитването Ви в Имоти Надежда и ще Ви потърсим веднага. Тел: 0888 000 000', true)
on conflict do nothing;
