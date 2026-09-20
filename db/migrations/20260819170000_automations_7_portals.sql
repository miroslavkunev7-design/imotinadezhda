-- ============================================================
-- Автоматизация №7: Автоматично Публикуване на Обяви
-- Синхронизация на имотите към външни портали (feed + API).
-- Безопасна миграция: само IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ---------- Полета по имота ----------
alter table public.properties add column if not exists portals_enabled boolean not null default true;
alter table public.properties add column if not exists last_portal_sync_at timestamptz;
alter table public.properties add column if not exists portal_published_count int not null default 0;

-- ---------- Портали ----------
create table if not exists public.listing_portals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,                     -- imotbg, imotinet, homesbg, alobg, olx, fbmarket
  name text not null,
  kind text not null default 'feed',             -- feed|api|manual
  is_active boolean not null default false,
  feed_format text not null default 'xml',       -- xml|json|csv
  feed_token text,
  endpoint_url text,
  auth_type text not null default 'none',        -- none|bearer|basic|header
  credentials_env text,                          -- име на секрета в средата (не самата стойност!)
  auth_header text,
  field_map jsonb not null default '{}'::jsonb,
  max_listings int not null default 500,
  price_markup numeric not null default 0,
  requires_approval boolean not null default false,
  ai_copy boolean not null default true,
  notes text,
  last_sync_at timestamptz,
  last_status text,
  last_error text,
  published_count int not null default 0,
  sort_order int not null default 100
);

create index if not exists listing_portals_active_idx on public.listing_portals (is_active, sort_order);

grant select, insert, update, delete on public.listing_portals to authenticated;
grant all on public.listing_portals to service_role;
alter table public.listing_portals enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='listing_portals' and policyname='listing_portals_auth_all') then
    create policy listing_portals_auth_all on public.listing_portals for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Обяви по портали ----------
create table if not exists public.portal_listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  portal_id uuid not null references public.listing_portals(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  status text not null default 'queued',          -- queued|published|updated|pending_approval|rejected|removed|error|skipped
  external_id text,
  external_url text,
  payload jsonb,
  content_hash text,
  ai_title text,
  ai_description text,
  ai_used boolean not null default false,
  price_at_publish numeric,
  attempts int not null default 0,
  last_error text,
  published_at timestamptz,
  last_synced_at timestamptz,
  removed_at timestamptz,
  priority int not null default 100,
  unique (portal_id, property_id)
);

create index if not exists portal_listings_status_idx on public.portal_listings (status, updated_at desc);
create index if not exists portal_listings_portal_idx on public.portal_listings (portal_id, status);
create index if not exists portal_listings_property_idx on public.portal_listings (property_id);

grant select, insert, update, delete on public.portal_listings to authenticated;
grant all on public.portal_listings to service_role;
alter table public.portal_listings enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='portal_listings' and policyname='portal_listings_auth_all') then
    create policy portal_listings_auth_all on public.portal_listings for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Лог на синхронизациите ----------
create table if not exists public.portal_sync_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  portal_id uuid references public.listing_portals(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  listing_id uuid references public.portal_listings(id) on delete set null,
  action text not null,                            -- publish|update|remove|feed_pull|error|queue
  status text not null default 'ok',               -- ok|error|skipped
  http_status int,
  message text,
  payload jsonb,
  duration_ms int,
  actor text default 'automation'
);

create index if not exists portal_sync_log_created_idx on public.portal_sync_log (created_at desc);
create index if not exists portal_sync_log_portal_idx on public.portal_sync_log (portal_id, created_at desc);

grant select, insert on public.portal_sync_log to authenticated;
grant all on public.portal_sync_log to service_role;
alter table public.portal_sync_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='portal_sync_log' and policyname='portal_sync_log_auth_all') then
    create policy portal_sync_log_auth_all on public.portal_sync_log for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки на автоматизацията ----------
insert into public.automation_settings (key, value) values
  ('portals', '{"enabled": true, "ai_enabled": true, "batch_size": 20, "auto_queue": true, "auto_remove_sold": true, "min_price": 1000, "require_cover_image": true, "retry_limit": 3, "resync_hours": 24, "lease_seconds": 300}'::jsonb)
on conflict (key) do nothing;

-- ---------- Стартови портали ----------
insert into public.listing_portals (code, name, kind, feed_format, is_active, sort_order, notes)
select 'imotbg', 'Imot.bg', 'feed', 'xml', false, 10, 'XML feed за импорт от Imot.bg — активирайте след като порталът потвърди адреса на фида.'
where not exists (select 1 from public.listing_portals where code = 'imotbg');

insert into public.listing_portals (code, name, kind, feed_format, is_active, sort_order, notes)
select 'imotinet', 'Imoti.net', 'feed', 'xml', false, 20, 'XML feed за Imoti.net.'
where not exists (select 1 from public.listing_portals where code = 'imotinet');

insert into public.listing_portals (code, name, kind, feed_format, is_active, sort_order, notes)
select 'homesbg', 'Homes.bg', 'feed', 'xml', false, 30, 'XML feed за Homes.bg.'
where not exists (select 1 from public.listing_portals where code = 'homesbg');

insert into public.listing_portals (code, name, kind, feed_format, is_active, sort_order, notes)
select 'alobg', 'Alo.bg', 'feed', 'json', false, 40, 'JSON feed за Alo.bg.'
where not exists (select 1 from public.listing_portals where code = 'alobg');

insert into public.listing_portals (code, name, kind, feed_format, is_active, sort_order, notes)
select 'olx', 'OLX.bg', 'api', 'json', false, 50, 'API публикуване — добавете endpoint и име на секрета с токена.'
where not exists (select 1 from public.listing_portals where code = 'olx');

insert into public.listing_portals (code, name, kind, feed_format, is_active, sort_order, notes)
select 'fbmarket', 'Facebook Marketplace', 'manual', 'json', false, 60, 'Ръчно публикуване — системата подготвя текста и снимките.'
where not exists (select 1 from public.listing_portals where code = 'fbmarket');
