-- =====================================================================
-- Автоматизация №4 — Автоматично изпращане на имоти (matching engine)
-- Съвпадение между клиенти (лийдове) и активни оферти + авто-разпращане.
-- =====================================================================

-- ---------- Настройки ----------
insert into public.automation_settings (key, value)
values ('matching', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'auto_on_qualified', true,
  'auto_on_new_property', true,
  'min_score', 55,
  'max_per_send', 5,
  'cooldown_hours', 48,
  'max_sends_per_week', 3,
  'min_grade', 'C',
  'price_tolerance_pct', 12,
  'weights', jsonb_build_object(
    'price', 30, 'type', 20, 'location', 20, 'rooms', 12, 'area', 10, 'freshness', 8
  )
))
on conflict (key) do nothing;

-- ---------- Съвпадения лийд ⇄ имот ----------
create table if not exists public.property_matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  client_id uuid references public.clients(id) on delete set null,
  property_id uuid not null references public.properties(id) on delete cascade,
  score int not null default 0,                       -- 0-100
  grade text,                                         -- A|B|C|D
  breakdown jsonb not null default '{}'::jsonb,
  reasons text[] not null default '{}',
  mismatches text[] not null default '{}',
  status text not null default 'new',                 -- new|queued|sent|viewed|interested|rejected|expired
  source text not null default 'lead',                -- lead|property|manual
  send_id uuid,
  sent_at timestamptz,
  responded_at timestamptz,
  feedback text,
  unique (lead_id, property_id)
);

create index if not exists property_matches_lead_idx on public.property_matches (lead_id, score desc);
create index if not exists property_matches_property_idx on public.property_matches (property_id, score desc);
create index if not exists property_matches_status_idx on public.property_matches (status, created_at desc);

grant select, insert, update, delete on public.property_matches to authenticated;
grant all on public.property_matches to service_role;
alter table public.property_matches enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='property_matches' and policyname='property_matches_auth_all') then
    create policy property_matches_auth_all on public.property_matches for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Изпращания (digest) ----------
create table if not exists public.match_sends (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  channel text not null default 'email',              -- email|sms|whatsapp|viber|manual
  subject text,
  body text,
  property_ids uuid[] not null default '{}',
  match_count int not null default 0,
  status text not null default 'pending',             -- pending|sent|failed|manual
  error text,
  token text not null default replace(gen_random_uuid()::text, '-', ''),
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  ai_used boolean not null default false,
  model text
);

create index if not exists match_sends_lead_idx on public.match_sends (lead_id, created_at desc);
create index if not exists match_sends_status_idx on public.match_sends (status, created_at desc);
create unique index if not exists match_sends_token_idx on public.match_sends (token);

grant select, insert, update, delete on public.match_sends to authenticated;
grant all on public.match_sends to service_role;
alter table public.match_sends enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='match_sends' and policyname='match_sends_auth_all') then
    create policy match_sends_auth_all on public.match_sends for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Полета по лийда ----------
alter table public.leads add column if not exists last_match_sent_at timestamptz;
alter table public.leads add column if not exists match_sends_count int not null default 0;
alter table public.leads add column if not exists matching_opt_out boolean not null default false;

create index if not exists leads_last_match_idx on public.leads (last_match_sent_at desc nulls last);
