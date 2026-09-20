-- ============================================================
-- Автоматизация №12: AI Обработка на Снимки
-- Подобрение (enhance), HDR, виртуално обзавеждане, разчистване, залез, замяна на небе.
-- Безопасна миграция: само IF NOT EXISTS.
-- ============================================================

-- ---------- Пресети за обработка ----------
create table if not exists public.photo_presets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  kind text not null default 'enhance',        -- enhance | hdr | staging | declutter | twilight | sky
  room text,                                   -- living | bedroom | kitchen | bathroom | exterior | null
  style text,                                  -- modern | scandi | classic | minimal | luxury
  prompt text not null,
  size text not null default '1536x1024',
  strength int not null default 60,            -- 0–100 сила на обработката
  keep_structure boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Обработени снимки (версии) ----------
create table if not exists public.photo_assets (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  source_image_id uuid references public.property_images(id) on delete set null,
  source_url text not null,
  preset_code text not null default 'enhance_pro',
  kind text not null default 'enhance',
  version int not null default 1,
  result_url text,
  storage_path text,
  width int,
  height int,
  bytes int,
  status text not null default 'processing',    -- processing | ready | approved | published | rejected | error
  quality_score int not null default 0,
  issues text[] not null default '{}',
  ai_used boolean not null default false,
  provider text,
  model text,
  duration_ms int,
  error text,
  applied_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists photo_assets_property_idx on public.photo_assets (property_id, created_at desc);
create index if not exists photo_assets_status_idx on public.photo_assets (status);

-- ---------- Опашка за обработка ----------
create table if not exists public.photo_queue (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  source_image_id uuid references public.property_images(id) on delete cascade,
  source_url text not null,
  preset_code text not null default 'enhance_pro',
  status text not null default 'queued',        -- queued | done | error | skipped
  attempts int not null default 0,
  error text,
  requested_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists photo_queue_unique_idx
  on public.photo_queue (source_url, preset_code) where status = 'queued';
create index if not exists photo_queue_status_idx on public.photo_queue (status, created_at);

-- ---------- Лог ----------
create table if not exists public.photo_events (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  asset_id uuid references public.photo_assets(id) on delete set null,
  action text not null,
  status text not null default 'ok',
  message text,
  meta jsonb,
  actor text not null default 'automation',
  created_at timestamptz not null default now()
);

create index if not exists photo_events_created_idx on public.photo_events (created_at desc);

-- ---------- Права ----------
grant select, insert, update, delete on public.photo_presets to authenticated;
grant select, insert, update, delete on public.photo_assets to authenticated;
grant select, insert, update, delete on public.photo_queue to authenticated;
grant select, insert on public.photo_events to authenticated;
grant select on public.photo_presets to anon;
grant select on public.photo_assets to anon;
grant all on public.photo_presets to service_role;
grant all on public.photo_assets to service_role;
grant all on public.photo_queue to service_role;
grant all on public.photo_events to service_role;

alter table public.photo_presets enable row level security;
alter table public.photo_assets enable row level security;
alter table public.photo_queue enable row level security;
alter table public.photo_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'photo_presets' and policyname = 'crm manages photo presets') then
    create policy "crm manages photo presets" on public.photo_presets for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'photo_presets' and policyname = 'public reads photo presets') then
    create policy "public reads photo presets" on public.photo_presets for select to anon using (is_active);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'photo_assets' and policyname = 'crm manages photo assets') then
    create policy "crm manages photo assets" on public.photo_assets for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'photo_assets' and policyname = 'public reads published photos') then
    create policy "public reads published photos" on public.photo_assets for select to anon using (status = 'published');
  end if;
  if not exists (select 1 from pg_policies where tablename = 'photo_queue' and policyname = 'crm manages photo queue') then
    create policy "crm manages photo queue" on public.photo_queue for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'photo_events' and policyname = 'crm reads photo events') then
    create policy "crm reads photo events" on public.photo_events for select to authenticated using (true);
  end if;
end $$;

-- ---------- Настройки ----------
insert into public.automation_settings (key, value)
values ('property_photos', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'batch_size', 3,
  'lease_seconds', 600,
  'auto_queue_new', false,
  'auto_apply_approved', false,
  'auto_approve_min_score', 88,
  'default_preset', 'enhance_pro',
  'watermark', false,
  'max_per_property', 12,
  'retry_limit', 2
))
on conflict (key) do nothing;

-- ---------- Пресети ----------
insert into public.photo_presets (code, name, kind, room, style, prompt, size, strength, keep_structure) values
  ('enhance_pro', 'Подобрение — професионално', 'enhance', null, null,
   'Подобри снимката като професионален фотограф на недвижими имоти: изправи перспективата и вертикалите, балансирай баланса на бялото, изчисти шума, увеличи детайла и яснотата. Запази напълно архитектурата, мебелите и разположението — без добавяне или премахване на обекти.',
   '1536x1024', 55, true),
  ('hdr_windows', 'HDR — прозорци и сенки', 'hdr', null, null,
   'Направи HDR обработка: изсветли сенките, възстанови детайла в преекспонираните прозорци така че да се вижда изгледът навън, естествен контраст без ореоли и без пресищане на цветовете. Запази геометрията и всички обекти без промяна.',
   '1536x1024', 65, true),
  ('staging_living_modern', 'Виртуално обзавеждане — хол (модерен)', 'staging', 'living', 'modern',
   'Виртуално обзавеждане на празен хол в модерен стил: диван, холна маса, килим, осветление, растение и декор. Запази точно стените, прозорците, вратите, пода и перспективата на помещението. Реалистични сенки и осветление.',
   '1536x1024', 80, true),
  ('staging_bedroom_scandi', 'Виртуално обзавеждане — спалня (скандинавски)', 'staging', 'bedroom', 'scandi',
   'Виртуално обзавеждане на празна спалня в скандинавски стил: легло с текстил, две нощни шкафчета, лампи, светъл килим, минимален декор. Запази стените, прозорците, вратите и пода без промяна.',
   '1536x1024', 80, true),
  ('staging_kitchen_lux', 'Виртуално обзавеждане — кухня (луксозен)', 'staging', 'kitchen', 'luxury',
   'Виртуално обзавеждане на кухня в луксозен стил: бар столове, аксесоари на плота, осветителни тела, дискретен декор. Запази мебелите по стените, техниката, прозорците и настилката.',
   '1536x1024', 75, true),
  ('declutter', 'Разчистване — премахване на предмети', 'declutter', null, null,
   'Премахни разхвърляните лични предмети, кабели, кошчета, сушилници и хавлии, като запазиш мебелите и архитектурата. Възстанови реалистично повърхностите под премахнатите предмети.',
   '1536x1024', 60, true),
  ('twilight_exterior', 'Залез — външна снимка', 'twilight', 'exterior', null,
   'Преобразувай външната снимка в кадър по здрач: топло синьо небе, светещи прозорци, дискретно външно осветление, влажен отблясък по алеята. Запази сградата, растителността и геометрията без промяна.',
   '1536x1024', 70, true),
  ('sky_replace', 'Замяна на небе', 'sky', 'exterior', null,
   'Замени сивото небе с естествено синьо небе с леки облаци и съгласувай осветлението на сградата с новото небе. Не променяй сградата, дърветата и обектите.',
   '1536x1024', 50, true)
on conflict (code) do nothing;
