-- ============================================================
-- Автоматизация №15: Реактивиране на Клиенти
-- Връщане на стари/студени контакти в процеса чрез AI кампании.
-- Безопасна миграция: само IF NOT EXISTS.
-- ============================================================

-- ---------- Кампании ----------
create table if not exists public.reactivation_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  goal text,                                        -- цел на кампанията
  channel text not null default 'email',            -- email|sms|call
  audience text not null default 'cold',            -- cold|lost|old_inquiry|no_viewing|all
  inactive_days int not null default 90,
  max_steps int not null default 3,
  step_gap_days int not null default 5,
  offer_text text,
  is_active boolean not null default true,
  ai_personalize boolean not null default true,
  notes text
);

grant select, insert, update, delete on public.reactivation_campaigns to authenticated;
grant all on public.reactivation_campaigns to service_role;
alter table public.reactivation_campaigns enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reactivation_campaigns' and policyname='reactivation_campaigns_auth_all') then
    create policy reactivation_campaigns_auth_all on public.reactivation_campaigns for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.reactivation_campaigns (code, name, goal, audience, inactive_days, max_steps, step_gap_days, offer_text) values
  ('cold_90', 'Студени клиенти (90+ дни)', 'Възобновяване на търсенето', 'cold', 90, 3, 5,
   'Нови оферти в предпочитания от Вас район и актуализирани цени.'),
  ('lost_deals', 'Загубени сделки', 'Втори шанс за сделка', 'lost', 60, 2, 7,
   'Пазарът се промени — имаме подходящи нови имоти и по-добри условия.'),
  ('no_viewing', 'Без проведен оглед', 'Насрочване на оглед', 'no_viewing', 30, 2, 4,
   'Организираме оглед в удобен за Вас час, включително събота.')
on conflict (code) do nothing;

-- ---------- Шаблони по стъпки ----------
create table if not exists public.reactivation_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  campaign_code text not null default 'cold_90',
  step_no int not null default 1,
  channel text not null default 'email',
  subject text,
  body text not null,
  is_active boolean not null default true,
  unique (campaign_code, step_no, channel)
);

grant select, insert, update, delete on public.reactivation_templates to authenticated;
grant all on public.reactivation_templates to service_role;
alter table public.reactivation_templates enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reactivation_templates' and policyname='reactivation_templates_auth_all') then
    create policy reactivation_templates_auth_all on public.reactivation_templates for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.reactivation_templates (campaign_code, step_no, channel, subject, body) values
  ('cold_90', 1, 'email', 'Още ли търсите имот, {{name}}?',
   E'Здравейте, {{name}},\n\nПреди време търсехте {{search_summary}}. Пазарът се промени и вече имаме нови подходящи оферти.\n\n{{offer}}\n\nЖелаете ли да Ви изпратим актуалната селекция?\n\nПоздрави,\nЕкип „Имоти Надежда“'),
  ('cold_90', 2, 'email', 'Подбрахме {{count}} нови имота за Вас',
   E'Здравейте, {{name}},\n\nПодбрахме нови имоти според Вашите критерии ({{search_summary}}).\n\n{{offer}}\n\nОтговорете с „да“ и ще Ви изпратим детайлите днес.\n\nЕкип „Имоти Надежда“'),
  ('cold_90', 3, 'email', 'Да затворим ли търсенето Ви, {{name}}?',
   E'Здравейте, {{name}},\n\nАко в момента не търсите имот, ще спрем съобщенията. Ако обмисляте покупка през следващите месеци, само отговорете и ще Ви пишем при подходяща оферта.\n\nЕкип „Имоти Надежда“'),
  ('lost_deals', 1, 'email', 'Нова възможност за Вас, {{name}}',
   E'Здравейте, {{name}},\n\nПоследната сделка не се случи, но условията вече са различни.\n\n{{offer}}\n\nЩе се радваме на кратък разговор.\n\nЕкип „Имоти Надежда“'),
  ('lost_deals', 2, 'email', 'Все още сме на разположение',
   E'Здравейте, {{name}},\n\nАко все още обмисляте, разполагаме с нови имоти в {{search_summary}}.\n\n{{offer}}\n\nЕкип „Имоти Надежда“'),
  ('no_viewing', 1, 'email', 'Да насрочим ли оглед, {{name}}?',
   E'Здравейте, {{name}},\n\nЗабелязахме, че още не сме провели оглед. {{offer}}\n\nКажете удобен ден и час — ще организираме всичко.\n\nЕкип „Имоти Надежда“'),
  ('no_viewing', 2, 'email', 'Свободни часове за оглед тази седмица',
   E'Здравейте, {{name}},\n\nИмаме свободни часове за огледи тази седмица.\n\n{{offer}}\n\nЕкип „Имоти Надежда“')
on conflict (campaign_code, step_no, channel) do nothing;

-- ---------- Записани клиенти в кампания ----------
create table if not exists public.reactivation_enrollments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  campaign_code text not null default 'cold_90',
  client_id uuid references public.clients(id) on delete cascade,
  broker_id uuid references public.brokers(id) on delete set null,
  contact_name text,
  contact_email text,
  contact_phone text,
  channel text not null default 'email',
  status text not null default 'active',            -- active|paused|revived|exhausted|opted_out|failed
  step_no int not null default 0,
  next_action_at timestamptz not null default now(),
  last_sent_at timestamptz,
  inactive_days int,
  score int not null default 0,                     -- 0-100 вероятност за реактивиране
  score_reason text,
  ai_summary text,
  ai_updated_at timestamptz,
  revived_at timestamptz,
  revived_reason text,
  opted_out_at timestamptz,
  attempts int not null default 0,
  error text,
  created_by text,
  unique (campaign_code, client_id)
);

create index if not exists reactivation_enrollments_due_idx on public.reactivation_enrollments (status, next_action_at);
create index if not exists reactivation_enrollments_score_idx on public.reactivation_enrollments (score desc);

grant select, insert, update, delete on public.reactivation_enrollments to authenticated;
grant all on public.reactivation_enrollments to service_role;
alter table public.reactivation_enrollments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reactivation_enrollments' and policyname='reactivation_enrollments_auth_all') then
    create policy reactivation_enrollments_auth_all on public.reactivation_enrollments for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Изпратени съобщения ----------
create table if not exists public.reactivation_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  enrollment_id uuid references public.reactivation_enrollments(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  campaign_code text,
  step_no int not null default 1,
  channel text not null default 'email',
  subject text,
  body text,
  recipient text,
  status text not null default 'sent',              -- sent|failed|queued
  ai_used boolean not null default false,
  model text,
  replied_at timestamptz,
  error text,
  token text not null default encode(gen_random_bytes(16), 'hex')
);

create index if not exists reactivation_messages_enrollment_idx on public.reactivation_messages (enrollment_id, step_no);
create unique index if not exists reactivation_messages_token_idx on public.reactivation_messages (token);

grant select, insert, update, delete on public.reactivation_messages to authenticated;
grant all on public.reactivation_messages to service_role;
alter table public.reactivation_messages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reactivation_messages' and policyname='reactivation_messages_auth_all') then
    create policy reactivation_messages_auth_all on public.reactivation_messages for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Журнал ----------
create table if not exists public.reactivation_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  enrollment_id uuid,
  client_id uuid,
  campaign_code text,
  action text not null,
  status text not null default 'ok',
  message text,
  actor text
);

create index if not exists reactivation_events_time_idx on public.reactivation_events (created_at desc);

grant select, insert, update, delete on public.reactivation_events to authenticated;
grant all on public.reactivation_events to service_role;
alter table public.reactivation_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reactivation_events' and policyname='reactivation_events_auth_all') then
    create policy reactivation_events_auth_all on public.reactivation_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки и задача ----------
insert into public.automation_settings (key, value)
values ('client_reactivation', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'auto_enroll', true,
  'default_campaign', 'cold_90',
  'inactive_days', 90,
  'batch_size', 15,
  'enroll_batch', 25,
  'lease_seconds', 300,
  'min_score_to_send', 25,
  'stop_on_reply', true,
  'quiet_hours_start', 21,
  'quiet_hours_end', 8
))
on conflict (key) do nothing;

insert into public.automation_jobs (key)
values ('client_reactivation_sweep')
on conflict (key) do nothing;