-- ============================================================
-- Автоматизация №14: Събиране на Ревюта
-- Автоматични покани за Google / Facebook оценки след приключена сделка.
-- Безопасна миграция: само IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ---------- Платформи за ревюта ----------
create table if not exists public.review_platforms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,                       -- google|facebook|internal
  name text not null,
  review_url text,
  is_active boolean not null default true,
  priority int not null default 1,
  min_rating_to_redirect int not null default 4,   -- под този рейтинг не пращаме към публична платформа
  notes text
);

grant select, insert, update, delete on public.review_platforms to authenticated;
grant all on public.review_platforms to service_role;
alter table public.review_platforms enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_platforms' and policyname='review_platforms_auth_all') then
    create policy review_platforms_auth_all on public.review_platforms for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.review_platforms (code, name, review_url, priority) values
  ('google', 'Google Business Profile', 'https://g.page/r/imoti-nadezhda/review', 1),
  ('facebook', 'Facebook страница', 'https://www.facebook.com/imotinadezhda/reviews', 2),
  ('internal', 'Отзив на сайта', 'https://imotinadezhda.bg/#reviews', 3)
on conflict (code) do nothing;

-- ---------- Шаблони за покана ----------
create table if not exists public.review_templates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,
  name text not null,
  channel text not null default 'email',           -- email|sms
  deal_type text,                                  -- sale|rent|null = всички
  step_no int not null default 1,                  -- 1 = първа покана, 2 = напомняне
  subject text,
  body text not null,
  is_active boolean not null default true
);

grant select, insert, update, delete on public.review_templates to authenticated;
grant all on public.review_templates to service_role;
alter table public.review_templates enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_templates' and policyname='review_templates_auth_all') then
    create policy review_templates_auth_all on public.review_templates for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.review_templates (code, name, channel, deal_type, step_no, subject, body) values
  ('sale_invite_1', 'Покана след покупка/продажба', 'email', 'sale', 1, 'Как оценявате работата ни, {{name}}?',
   E'Здравейте, {{name}},\n\nБлагодарим Ви за доверието към „Имоти Надежда“{{property_line}}. Ще се радваме да отделите минута и да оцените работата ни.\n\nОценете ни тук: {{review_link}}\n\nПоздрави,\nЕкип „Имоти Надежда“'),
  ('sale_invite_2', 'Напомняне за оценка', 'email', null, 2, 'Само едно кликване, {{name}}',
   E'Здравейте, {{name}},\n\nАко имате момент — Вашата оценка помага на други хора да ни намерят.\n\n{{review_link}}\n\nБлагодарим!\nЕкип „Имоти Надежда“'),
  ('rent_invite_1', 'Покана след наем', 'email', 'rent', 1, 'Вашето мнение е важно, {{name}}',
   E'Здравейте, {{name}},\n\nБлагодарим Ви, че наехте имот с „Имоти Надежда“{{property_line}}. Ще се радваме на кратка оценка.\n\n{{review_link}}\n\nПоздрави,\nЕкип „Имоти Надежда“'),
  ('sms_invite_1', 'SMS покана', 'sms', null, 1, null,
   'Здравейте, {{name}}! Благодарим за доверието към Имоти Надежда. Оценете ни тук: {{review_link}}')
on conflict (code) do nothing;

-- ---------- Покани ----------
create table if not exists public.review_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deal_id uuid references public.deals(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  owner_id uuid references public.owners(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  broker_id uuid references public.brokers(id) on delete set null,
  contact_name text,
  contact_email text,
  contact_phone text,
  channel text not null default 'email',
  template_code text,
  platform_code text not null default 'google',
  step_no int not null default 1,
  status text not null default 'pending',            -- pending|scheduled|sent|clicked|rated|completed|failed|skipped|opted_out
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  clicked_at timestamptz,
  click_count int not null default 0,
  rating int,
  rated_at timestamptz,
  feedback text,
  sentiment text,                                    -- positive|neutral|negative
  ai_used boolean not null default false,
  model text,
  subject text,
  body text,
  token text not null default encode(gen_random_bytes(16), 'hex'),
  attempts int not null default 0,
  error text,
  created_by text,
  unique (token)
);

create index if not exists review_requests_due_idx on public.review_requests (status, scheduled_at);
create index if not exists review_requests_deal_idx on public.review_requests (deal_id, step_no);

grant select, insert, update, delete on public.review_requests to authenticated;
grant all on public.review_requests to service_role;
alter table public.review_requests enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_requests' and policyname='review_requests_auth_all') then
    create policy review_requests_auth_all on public.review_requests for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Получени ревюта ----------
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  request_id uuid references public.review_requests(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  client_id uuid references public.clients(id) on delete set null,
  broker_id uuid references public.brokers(id) on delete set null,
  platform_code text not null default 'internal',
  author_name text,
  author_email text,
  rating int not null default 5,
  title text,
  body text,
  sentiment text,
  ai_summary text,
  ai_reply text,
  reply_sent_at timestamptz,
  is_public boolean not null default false,
  is_featured boolean not null default false,
  status text not null default 'new',                -- new|approved|published|hidden
  source text not null default 'internal',           -- internal|google|facebook|manual
  external_url text,
  external_id text
);

create index if not exists reviews_rating_idx on public.reviews (rating desc, created_at desc);
create index if not exists reviews_public_idx on public.reviews (is_public, status);

grant select, insert, update, delete on public.reviews to authenticated;
grant all on public.reviews to service_role;
grant select on public.reviews to anon;
alter table public.reviews enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reviews' and policyname='reviews_auth_all') then
    create policy reviews_auth_all on public.reviews for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='reviews' and policyname='reviews_public_read') then
    create policy reviews_public_read on public.reviews for select to anon using (is_public = true and status = 'published');
  end if;
end $$;

-- ---------- Журнал ----------
create table if not exists public.review_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid,
  review_id uuid,
  deal_id uuid,
  action text not null,
  status text not null default 'ok',
  message text,
  actor text
);

create index if not exists review_events_time_idx on public.review_events (created_at desc);

grant select, insert, update, delete on public.review_events to authenticated;
grant all on public.review_events to service_role;
alter table public.review_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='review_events' and policyname='review_events_auth_all') then
    create policy review_events_auth_all on public.review_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки и задача ----------
insert into public.automation_settings (key, value)
values ('review_collection', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'auto_enroll_won_deals', true,
  'delay_hours', 24,
  'reminder_after_days', 5,
  'max_steps', 2,
  'batch_size', 10,
  'lease_seconds', 300,
  'default_platform', 'google',
  'gate_low_ratings', true,
  'min_public_rating', 4,
  'auto_publish_min_rating', 5,
  'auto_ai_reply', true
))
on conflict (key) do nothing;

insert into public.automation_jobs (key)
values ('review_collection_sweep')
on conflict (key) do nothing;