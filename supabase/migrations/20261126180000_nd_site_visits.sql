-- Реални посещения на публичния сайт и разглеждания на имот.
-- Един човек (устройство) се брои веднъж за сайта и веднъж за всеки имот; екипът (брокерите) и ботовете не се броят.
create table if not exists public.nd_site_visits (
  visitor text not null,
  prop_id text not null default '',          -- '' = посещение на сайта; иначе id на имота (nd_properties.id)
  fp text,                                   -- md5(IP|браузър): същото устройство без запомнен номер (инкогнито)
  ip text,                                   -- md5(IP) – само за защита от надуване; суров IP не се пази
  day date not null default ((now() at time zone 'Europe/Sofia')::date),
  created_at timestamptz not null default now(),
  primary key (visitor, prop_id)
);
create index if not exists nd_site_visits_prop_idx on public.nd_site_visits (prop_id);
create index if not exists nd_site_visits_day_idx on public.nd_site_visits (day);
create index if not exists nd_site_visits_fp_idx on public.nd_site_visits (fp, prop_id, created_at desc);
create index if not exists nd_site_visits_ip_idx on public.nd_site_visits (ip, created_at desc);
alter table public.nd_site_visits enable row level security;
drop policy if exists "nd staff read" on public.nd_site_visits;
create policy "nd staff read" on public.nd_site_visits for select to authenticated using (nd_is_staff());
revoke all on public.nd_site_visits from anon, authenticated;
grant select on public.nd_site_visits to authenticated;
grant all on public.nd_site_visits to service_role;

-- отчитане от публичния сайт (анонимно): връща true само при първо посещение
create or replace function public.nd_visit(p_visitor text, p_prop text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare h json; ua text; ipx text; v_fp text; v_ip text; v_prop text := coalesce(p_prop, ''); n int;
begin
  if p_visitor is null or p_visitor !~ '^[a-z0-9-]{16,64}$' or length(v_prop) > 64 then return false; end if;
  if auth.uid() is not null and nd_is_staff() then return false; end if;          -- брокерите не се броят
  begin h := current_setting('request.headers', true)::json; exception when others then h := null; end;
  ua := coalesce(h ->> 'user-agent', '');
  ipx := btrim(split_part(coalesce(nullif(h ->> 'x-forwarded-for', ''), h ->> 'x-real-ip', ''), ',', 1));
  if ua = '' or ua ~* '(bot|crawl|spider|slurp|facebookexternalhit|headless|lighthouse|pagespeed|curl/|wget|python|node-fetch|axios|scrapy|go-http)' then return false; end if;
  if v_prop <> '' and not exists (select 1 from nd_properties p where p.id = v_prop and p.data ->> 'status' = 'Публикуван') then return false; end if;
  if exists (select 1 from nd_site_visits where visitor = p_visitor and prop_id = v_prop) then return false; end if;
  v_ip := case when ipx = '' then null else md5(ipx) end;
  v_fp := case when ipx = '' then null else md5(ipx || '|' || ua) end;
  -- същото устройство (IP + браузър) в рамките на 24 ч. се брои веднъж, дори с изчистена памет или инкогнито
  if v_fp is not null and exists (select 1 from nd_site_visits where fp = v_fp and prop_id = v_prop and created_at > now() - interval '24 hours') then return false; end if;
  -- защита от надуване: най-много 300 записа от един IP за 24 ч.
  if v_ip is not null and (select count(*) from nd_site_visits where ip = v_ip and created_at > now() - interval '24 hours') >= 300 then return false; end if;
  insert into nd_site_visits (visitor, prop_id, fp, ip) values (p_visitor, v_prop, v_fp, v_ip) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.nd_visit(text, text) from public;
grant execute on function public.nd_visit(text, text) to anon, authenticated;

-- обобщение за CRM (само за екипа): общо посетители, днес, последните 7 дни и разглеждания по имот
create or replace function public.nd_visit_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not nd_is_staff() then '{}'::jsonb else jsonb_build_object(
    'total', (select count(*) from nd_site_visits where prop_id = ''),
    'today', (select count(*) from nd_site_visits where prop_id = '' and day = (now() at time zone 'Europe/Sofia')::date),
    'week', (select count(*) from nd_site_visits where prop_id = '' and day > (now() at time zone 'Europe/Sofia')::date - 7),
    'props', coalesce((select jsonb_object_agg(prop_id, c) from (select prop_id, count(*) c from nd_site_visits where prop_id <> '' group by prop_id) x), '{}'::jsonb),
    'props_week', coalesce((select jsonb_object_agg(prop_id, c) from (select prop_id, count(*) c from nd_site_visits where prop_id <> '' and day > (now() at time zone 'Europe/Sofia')::date - 7 group by prop_id) x), '{}'::jsonb)
  ) end
$$;
revoke all on function public.nd_visit_stats() from public, anon;
grant execute on function public.nd_visit_stats() to authenticated;
