-- Брокерите не се броят като посещения/разглеждания и от браузър, в който не са влизали в CRM
-- (напр. Safari на iPhone, когато CRM е инсталиран като приложение – двете не делят паметта си).
-- Когато служител отвори CRM, се пази отпечатъкът на устройството му md5(IP|браузър) – същият като nd_site_visits.fp.
-- Посещение от такъв отпечатък (за 60 дни) не се брои, а вече записаните от него се махат.
-- fp2 = md5(IP|устройство) – само частта в първите скоби на браузъра (напр. „iPhone; CPU iPhone OS 18_1 like Mac OS X“):
-- приложението CRM на началния екран и Safari на същия телефон имат различен низ на браузъра, но едно и също устройство.
create table if not exists public.nd_staff_fp (
  fp text primary key,
  fp2 text,
  user_id uuid,
  seen_at timestamptz not null default now()
);
create index if not exists nd_staff_fp_fp2_idx on public.nd_staff_fp (fp2, seen_at desc);
alter table public.nd_site_visits add column if not exists fp2 text;
create index if not exists nd_site_visits_fp2_idx on public.nd_site_visits (fp2);

create or replace function public.nd_dev_fp(p_ip text, p_ua text)
returns text language sql immutable as $$
  select case when coalesce(p_ip, '') = '' or coalesce(p_ua, '') = '' then null
              else md5(p_ip || '|' || coalesce(substring(p_ua from '\(([^)]*)\)'), p_ua)) end
$$;
alter table public.nd_staff_fp enable row level security;
grant all on public.nd_staff_fp to service_role;

create or replace function public.nd_staff_seen()
returns int language plpgsql security definer set search_path = public as $$
declare h json; ua text; ipx text; v_fp text; v_fp2 text; n int := 0;
begin
  if not nd_is_staff() then return 0; end if;
  begin h := current_setting('request.headers', true)::json; exception when others then h := null; end;
  ua := coalesce(h ->> 'user-agent', '');
  ipx := btrim(split_part(coalesce(nullif(h ->> 'x-forwarded-for', ''), h ->> 'x-real-ip', ''), ',', 1));
  if ipx = '' or ua = '' then return 0; end if;
  v_fp := md5(ipx || '|' || ua); v_fp2 := nd_dev_fp(ipx, ua);
  insert into nd_staff_fp (fp, fp2, user_id, seen_at) values (v_fp, v_fp2, auth.uid(), now())
    on conflict (fp) do update set seen_at = now(), fp2 = excluded.fp2, user_id = excluded.user_id;
  -- записи отпреди fp2 (26.11): по същия IP
  delete from nd_site_visits where fp = v_fp or (fp2 is not null and fp2 = v_fp2) or (fp2 is null and ip = md5(ipx));
  get diagnostics n = row_count;
  return n;
end $$;
grant execute on function public.nd_staff_seen() to authenticated;

create or replace function public.nd_visit(p_visitor text, p_prop text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare h json; ua text; ipx text; v_fp text; v_fp2 text; v_ip text; v_prop text := coalesce(p_prop, ''); n int;
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
  v_fp2 := nd_dev_fp(ipx, ua);
  -- устройство, от което служител е отварял CRM (същия IP и браузър) през последните 60 дни → брокер, не се брои
  if v_fp is not null and exists (select 1 from nd_staff_fp s where s.fp = v_fp and s.seen_at > now() - interval '60 days') then return false; end if;
  if v_fp2 is not null and exists (select 1 from nd_staff_fp s where s.fp2 = v_fp2 and s.seen_at > now() - interval '30 days') then return false; end if;
  if v_fp is not null and exists (select 1 from nd_site_visits where fp = v_fp and prop_id = v_prop and created_at > now() - interval '24 hours') then return false; end if;
  if v_ip is not null and (select count(*) from nd_site_visits where ip = v_ip and created_at > now() - interval '24 hours') >= 300 then return false; end if;
  insert into nd_site_visits (visitor, prop_id, fp, fp2, ip) values (p_visitor, v_prop, v_fp, v_fp2, v_ip) on conflict do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;
