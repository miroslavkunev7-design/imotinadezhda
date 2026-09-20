-- ============================================================
-- Автоматизация №11: AI Описание на Имот
-- Генериране на обяви, портални текстове, социални постове и SEO мета.
-- Безопасна миграция: само IF NOT EXISTS.
-- ============================================================

-- ---------- Шаблони / канали ----------
create table if not exists public.copy_templates (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  channel text not null default 'site',        -- site | portal | social | seo | email
  tone text not null default 'premium',
  language text not null default 'bg',
  max_title int not null default 70,
  max_body int not null default 1600,
  instructions text,
  include_price boolean not null default true,
  include_contacts boolean not null default false,
  emoji_allowed boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Генерирани текстове (версии) ----------
create table if not exists public.property_copy (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  template_code text not null default 'site_premium',
  channel text not null default 'site',
  language text not null default 'bg',
  version int not null default 1,
  title text,
  body text,
  short_text text,
  bullets text[] not null default '{}',
  seo_title text,
  seo_description text,
  seo_keywords text[] not null default '{}',
  slug text,
  hashtags text[] not null default '{}',
  status text not null default 'draft',        -- draft | approved | published | rejected
  quality_score int not null default 0,
  seo_score int not null default 0,
  issues text[] not null default '{}',
  word_count int not null default 0,
  ai_used boolean not null default false,
  model text,
  prompt_hash text,
  applied_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists property_copy_property_idx on public.property_copy (property_id, created_at desc);
create index if not exists property_copy_status_idx on public.property_copy (status);
create unique index if not exists property_copy_version_uidx on public.property_copy (property_id, template_code, version);

-- ---------- Опашка за генериране ----------
create table if not exists public.copy_queue (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  template_code text not null default 'site_premium',
  status text not null default 'queued',       -- queued | done | error | skipped
  attempts int not null default 0,
  error text,
  requested_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists copy_queue_unique_idx on public.copy_queue (property_id, template_code) where status = 'queued';
create index if not exists copy_queue_status_idx on public.copy_queue (status, created_at);

-- ---------- Лог ----------
create table if not exists public.copy_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  copy_id uuid references public.property_copy(id) on delete set null,
  action text not null,
  status text not null default 'ok',
  message text,
  meta jsonb,
  actor text not null default 'automation',
  created_at timestamptz not null default now()
);

create index if not exists copy_events_created_idx on public.copy_events (created_at desc);

-- ---------- Права ----------
grant select, insert, update, delete on public.copy_templates to authenticated;
grant select, insert, update, delete on public.property_copy to authenticated;
grant select, insert, update, delete on public.copy_queue to authenticated;
grant select, insert on public.copy_events to authenticated;
grant all on public.copy_templates to service_role;
grant all on public.property_copy to service_role;
grant all on public.copy_queue to service_role;
grant all on public.copy_events to service_role;

alter table public.copy_templates enable row level security;
alter table public.property_copy enable row level security;
alter table public.copy_queue enable row level security;
alter table public.copy_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'copy_templates' and policyname = 'crm manages copy templates') then
    create policy "crm manages copy templates" on public.copy_templates for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'property_copy' and policyname = 'crm manages property copy') then
    create policy "crm manages property copy" on public.property_copy for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'property_copy' and policyname = 'public reads published copy') then
    create policy "public reads published copy" on public.property_copy for select to anon using (status = 'published');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'copy_queue' and policyname = 'crm manages copy queue') then
    create policy "crm manages copy queue" on public.copy_queue for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'copy_events' and policyname = 'crm reads copy events') then
    create policy "crm reads copy events" on public.copy_events for select to authenticated using (true);
  end if;
end $$;

grant select on public.property_copy to anon;

-- ---------- Настройки ----------
insert into public.automation_settings (key, value)
values ('property_copy', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'batch_size', 5,
  'lease_seconds', 300,
  'auto_queue_new', true,
  'auto_apply_approved', true,
  'auto_approve_min_score', 85,
  'default_template', 'site_premium',
  'min_words', 90,
  'max_words', 320,
  'retry_limit', 3
))
on conflict (key) do nothing;

-- ---------- Шаблони по канали ----------
insert into public.copy_templates (code, name, channel, tone, max_title, max_body, instructions, include_price, emoji_allowed) values
  ('site_premium', 'Сайт — премиум описание', 'site', 'premium', 70, 1800,
   'Пиши като луксозна агенция: първо усещането от имота, после фактите. Кратки абзаци, без клишета („уникален шанс“), без главни букви за акцент. Завърши с покана за оглед.', true, false),
  ('portal_imot', 'Портал — Imot.bg / Imoti.net', 'portal', 'factual', 60, 900,
   'Стегнат портален текст: факти в първите две изречения (тип, площ, етаж, квартал, състояние). Без телефони и линкове — порталите ги режат.', true, false),
  ('social_fb', 'Социални мрежи — Facebook/Instagram', 'social', 'friendly', 80, 500,
   'Жив, разговорен тон, 3–5 къси изречения, до 5 хаштага накрая, ясно call-to-action. Без изброявания с тирета.', true, true),
  ('seo_meta', 'SEO мета и ключови думи', 'seo', 'seo', 60, 320,
   'Оптимизирай за търсения от типа „двустаен апартамент Шумен център“. SEO заглавие до 60 знака с град и тип имот, мета описание 140–160 знака, 6–10 ключови думи на български.', true, false),
  ('email_offer', 'Имейл оферта до клиент', 'email', 'personal', 70, 900,
   'Персонално писмо до конкретен клиент: защо точно този имот му подхожда, 3 предимства, покана за оглед. Без маркетингов шум.', true, false)
on conflict (code) do nothing;
