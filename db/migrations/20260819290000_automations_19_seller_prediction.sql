-- ============================================================
-- Автоматизация №19: AI Прогнозиране на Продавачи
-- Откриване на потенциални продавачи (собственици), скоринг и контакт.
-- Безопасна миграция: само IF NOT EXISTS.
-- ============================================================

-- ---------- Потенциални продавачи ----------
create table if not exists public.seller_prospects (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  full_name text,
  phone text,
  email text,
  city text,
  district text,
  address text,
  property_type text,                              -- apartment|house|land|office|shop
  rooms int,
  area numeric(10,2),
  build_year int,
  estimated_price numeric(12,2),
  currency text not null default 'EUR',
  ownership_years numeric(6,2),
  source text not null default 'manual',           -- manual|import|portal|crm|referral|expired_ad|rental
  source_ref text,
  property_id uuid,
  client_id uuid,
  broker_id uuid,
  status text not null default 'new',              -- new|scored|contacted|meeting|listing_won|not_interested|lost
  score int not null default 0,                    -- 0..100
  probability numeric(5,2),                        -- прогнозна вероятност %
  expected_window text,                            -- 0-3м / 3-6м / 6-12м / 12м+
  ai_reasoning text,
  ai_pitch text,
  ai_updated_at timestamptz,
  next_action_at timestamptz,
  last_contacted_at timestamptz,
  opted_out boolean not null default false,
  notes text,
  unique (phone, city)
);

create index if not exists seller_prospects_score_idx on public.seller_prospects (score desc, updated_at desc);
create index if not exists seller_prospects_status_idx on public.seller_prospects (status);

grant select, insert, update, delete on public.seller_prospects to authenticated;
grant all on public.seller_prospects to service_role;
alter table public.seller_prospects enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='seller_prospects' and policyname='seller_prospects_auth_all') then
    create policy seller_prospects_auth_all on public.seller_prospects for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Сигнали (белези за намерение за продажба) ----------
create table if not exists public.seller_signals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  prospect_id uuid references public.seller_prospects(id) on delete cascade,
  signal_code text not null,                       -- expired_ad|price_drop|rental_ended|inheritance|relocation|long_ownership|market_hot|repeat_visit|owner_inquiry
  weight int not null default 5,                   -- 1..20
  value text,
  detected_at timestamptz not null default now(),
  source text default 'system'
);

create index if not exists seller_signals_prospect_idx on public.seller_signals (prospect_id, created_at desc);

grant select, insert, update, delete on public.seller_signals to authenticated;
grant all on public.seller_signals to service_role;
alter table public.seller_signals enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='seller_signals' and policyname='seller_signals_auth_all') then
    create policy seller_signals_auth_all on public.seller_signals for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Правила за скоринг ----------
create table if not exists public.seller_signal_rules (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  label text not null,
  weight int not null default 5,
  is_active boolean not null default true,
  description text
);

grant select, insert, update, delete on public.seller_signal_rules to authenticated;
grant all on public.seller_signal_rules to service_role;
alter table public.seller_signal_rules enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='seller_signal_rules' and policyname='seller_signal_rules_auth_all') then
    create policy seller_signal_rules_auth_all on public.seller_signal_rules for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.seller_signal_rules (code, label, weight, description) values
  ('expired_ad', 'Изтекла или свалена обява', 18, 'Имотът е бил обявен, но обявата вече не е активна'),
  ('price_drop', 'Намаление на цената', 12, 'Собственикът е свалял цената — мотивиран продавач'),
  ('rental_ended', 'Прекратен наем', 10, 'Наемателят е напуснал — собственикът обмисля продажба'),
  ('inheritance', 'Наследствен имот', 15, 'Наследници обикновено продават'),
  ('relocation', 'Смяна на град/страна', 14, 'Собственикът се мести'),
  ('long_ownership', 'Дълга собственост (10+ г.)', 8, 'Голяма вероятност за смяна на жилище'),
  ('market_hot', 'Активен пазар в района', 6, 'Високо търсене в квартала'),
  ('repeat_visit', 'Повтарящи се посещения на оценка', 9, 'Собственикът проверява цени'),
  ('owner_inquiry', 'Запитване от собственик', 20, 'Директен интерес към продажба или оценка')
on conflict (code) do nothing;

-- ---------- Контакти / кампании към продавачи ----------
create table if not exists public.seller_outreach (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  prospect_id uuid not null references public.seller_prospects(id) on delete cascade,
  channel text not null default 'phone',           -- phone|sms|email|viber|letter|visit
  direction text not null default 'out',
  subject text,
  body text,
  ai_used boolean not null default false,
  status text not null default 'planned',          -- planned|sent|answered|no_answer|refused
  scheduled_at timestamptz,
  sent_at timestamptz,
  outcome text,
  broker_id uuid,
  actor text
);

create index if not exists seller_outreach_prospect_idx on public.seller_outreach (prospect_id, created_at desc);

grant select, insert, update, delete on public.seller_outreach to authenticated;
grant all on public.seller_outreach to service_role;
alter table public.seller_outreach enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='seller_outreach' and policyname='seller_outreach_auth_all') then
    create policy seller_outreach_auth_all on public.seller_outreach for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Журнал ----------
create table if not exists public.seller_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  prospect_id uuid,
  event_type text not null,                        -- created|signal|scored|ai_pitch|outreach|status|sweep|error
  status text not null default 'ok',
  message text,
  payload jsonb not null default '{}'::jsonb,
  actor text
);

create index if not exists seller_events_time_idx on public.seller_events (created_at desc);

grant select, insert on public.seller_events to authenticated;
grant all on public.seller_events to service_role;
alter table public.seller_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='seller_events' and policyname='seller_events_auth_all') then
    create policy seller_events_auth_all on public.seller_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки и задача ----------
insert into public.automation_settings (key, value)
values ('seller_prediction', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'auto_score_new', true,
  'hot_threshold', 70,
  'warm_threshold', 45,
  'auto_assign_broker', false,
  'batch_size', 25,
  'lease_seconds', 300,
  'follow_up_days', 14
))
on conflict (key) do nothing;

insert into public.automation_jobs (key)
values ('seller_prediction_sweep')
on conflict (key) do nothing;
