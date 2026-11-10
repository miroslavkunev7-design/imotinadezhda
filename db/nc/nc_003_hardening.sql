-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · nc_003 – втвърдяване след втората независима проверка
-- (REVIEW_TASK-002_v2_SQL: FX1–FX16; 19 пробива → 0). Прилага се СЛЕД nc_001 + nc_002, в същата миграция.
-- Най-важното: FX1 – служител не може да подмени БАЙТОВЕТЕ на производна/публична медия в storage;
-- FX2 – производна се записва само за сегашния план и статус.
-- Обратно: nc_001_down.sql (маха и тези обекти).
-- =====================================================================
begin;

-- FX1 (C09, C10) Байтовете на производните и на публичната медия: служител НЕ пише в
--     projects/*/private/derived/ (само service role) и в projects/*/public/ + private/tours/ (само админ).
--     RESTRICTIVE политики се добавят върху съществуващите „nd files staff *“, без да ги пипат.
--     Следствие: изпълнителят (_nc-tools.js runPlanJob) трябва да качва производната със service role, не с ctx.sb.
create function public.nd_nc_storage_write_ok(obj_name text, bucket text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select bucket is distinct from 'nd-files'
      or split_part(obj_name, '/', 1) <> 'projects'
      or (    not (split_part(obj_name, '/', 3) = 'private' and split_part(obj_name, '/', 4) = 'derived')
          and (public.nd_is_admin()
               or not (split_part(obj_name, '/', 3) = 'public'
                       or (split_part(obj_name, '/', 3) = 'private' and split_part(obj_name, '/', 4) = 'tours'))))
$function$;
revoke all on function public.nd_nc_storage_write_ok(text, text) from public, anon;
grant execute on function public.nd_nc_storage_write_ok(text, text) to authenticated, service_role;

create policy "nd nc no staff write insert" on storage.objects as restrictive for insert to authenticated
  with check (public.nd_nc_storage_write_ok(name, bucket_id));
create policy "nd nc no staff write update" on storage.objects as restrictive for update to authenticated
  using (public.nd_nc_storage_write_ok(name, bucket_id)) with check (public.nd_nc_storage_write_ok(name, bucket_id));
create policy "nd nc no staff write delete" on storage.objects as restrictive for delete to authenticated
  using (public.nd_nc_storage_write_ok(name, bucket_id));

-- FX2 (C06) Производна се записва само за СЕГАШНИЯ подпис (и вид за статуса). Изпълнителят чете входа
--     с една заявка (nd_floor_plan_input) → рисува → записва; ако междувременно нещо се е сменило, записът пада (40001).
create function public.nd_plan_files_check()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.unit_id is not null then
    if not exists (select 1 from public.nd_units u
                    where u.id = new.unit_id
                      and new.sig = u.plan_rev::text || ':' || u.status
                      and new.kind = case when u.status = 'free' then 'unit_wm' else 'unit_stamp' end) then
      raise exception 'Производната не е за сегашния план и статус' using errcode = '40001';
    end if;
  elsif new.sig is distinct from public.nd_floor_plan_sig(new.floor_id) then
    raise exception 'Етажната производна не е за сегашните статуси' using errcode = '40001';
  end if;
  return new;
end
$function$;
revoke all on function public.nd_plan_files_check() from public, anon, authenticated;
create trigger nd_plan_files_check before insert on public.nd_plan_files
  for each row execute function public.nd_plan_files_check();

create function public.nd_floor_plan_input(p_floor_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
           'sig', public.nd_floor_plan_sig(f.id),
           'plan', f.data #>> '{plan,private}',
           'polygons', coalesce(f.data -> 'polygons', '[]'::jsonb),
           'units', coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'code', u.code, 'status', u.status) order by u.id)
                                from public.nd_units u where u.floor_id = f.id), '[]'::jsonb))
    from public.nd_floors f where f.id = p_floor_id
$function$;
revoke all on function public.nd_floor_plan_input(text) from public, anon, authenticated;
grant execute on function public.nd_floor_plan_input(text) to service_role;

-- FX3 (G06) Отменена задача, чийто изпълнител е спрял, се приключва като cancelled (не остава queued завинаги).
create or replace function public.nd_job_claim(
  p_kinds text[],
  p_worker text
)
returns public.nd_jobs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  j public.nd_jobs%rowtype;
begin
  update public.nd_jobs x
     set status = case when x.cancel_requested then 'cancelled'
                       when x.crash_count + 1 >= 3 then 'failed' else 'queued' end,
         error = case when x.cancel_requested then x.error
                      when x.crash_count + 1 >= 3 then 'Изпълнителят спря 3 пъти' else x.error end,
         finished_at = case when x.cancel_requested or x.crash_count + 1 >= 3 then now() else null end,
         crash_count = x.crash_count + 1,
         attempts = greatest(x.attempts - 1, 0),
         locked_by = null, locked_at = null, heartbeat_at = null,
         next_attempt_at = now() + make_interval(secs => least(900, 30 * power(2, x.crash_count)::integer))
    from public.nd_job_kinds k
   where k.kind = x.kind
     and x.status = 'running'
     and x.kind = any (p_kinds)
     and coalesce(x.heartbeat_at, x.locked_at) < now() - make_interval(secs => k.stale_secs);

  select * into j
    from public.nd_jobs
   where status = 'queued'
     and kind = any (p_kinds)
     and next_attempt_at <= now()
     and not cancel_requested
   order by created_at
   limit 1
   for update skip locked;

  if not found then
    return null;
  end if;

  update public.nd_jobs
     set status = 'running', attempts = attempts + 1,
         locked_by = left(p_worker, 120), locked_at = now(), heartbeat_at = now()
   where id = j.id
   returning * into j;
  return j;
end
$function$;

-- FX4 (G07, G08) (а) системна задача отменя само админ; (б) нова заявка за същия подпис съживява
--     паднала/отменена задача (иначе ключът 'pd:…' е зает завинаги).
create or replace function public.nd_job_cancel(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  j public.nd_jobs%rowtype;
begin
  if not public.nd_is_staff() then
    raise exception 'Няма достъп' using errcode = '42501';
  end if;
  select * into j from public.nd_jobs where id = p_id for update;
  if not found then
    raise exception 'Задачата не е намерена' using errcode = 'P0002';
  end if;
  if (j.actor_kind = 'system' or j.actor_user_id is distinct from auth.uid()) and not public.nd_is_admin() then
    raise exception 'Само авторът или администратор отменя задача (системна – само администратор)' using errcode = '42501';
  end if;
  if j.status in ('done', 'failed', 'cancelled') then
    return jsonb_build_object('ok', true, 'id', j.id, 'status', j.status, 'changed', false);
  end if;
  if j.status in ('queued', 'review') then
    update public.nd_jobs set status = 'cancelled', cancel_requested = true, finished_at = now()
     where id = p_id returning * into j;
  else
    update public.nd_jobs set cancel_requested = true where id = p_id returning * into j;
  end if;
  return jsonb_build_object('ok', true, 'id', j.id, 'status', j.status, 'changed', true,
                            'cancel_requested', j.cancel_requested);
end
$function$;

create or replace function public.nd_nc_enqueue_plan(p_scope text, p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.nd_units%rowtype;
  f public.nd_floors%rowtype;
  s text;
  k text;
  inp jsonb;
  pid text;
begin
  if p_scope = 'unit' then
    select * into u from public.nd_units where id = p_id;
    if not found or (u.data #>> '{plan,private}') is null then return; end if;
    s := u.plan_rev::text || ':' || u.status;
    k := 'pd:u:' || u.id || ':' || s; pid := u.project_id;
    inp := jsonb_build_object('scope', 'unit', 'unit_id', u.id, 'sig', s, 'status', u.status);
  elsif p_scope = 'floor' then
    select * into f from public.nd_floors where id = p_id;
    if not found or (f.data #>> '{plan,private}') is null then return; end if;
    s := public.nd_floor_plan_sig(f.id);
    k := 'pd:f:' || f.id || ':' || s; pid := f.project_id;
    inp := jsonb_build_object('scope', 'floor', 'floor_id', f.id, 'sig', s);
  else
    return;
  end if;
  insert into public.nd_jobs (kind, idempotency_key, project_id, input, actor_kind, actor_user_id, max_attempts)
  values ('plan_derivative', k, pid, inp, 'system', auth.uid(), 3)
  on conflict (idempotency_key) do update
     set status = 'queued', attempts = 0, crash_count = 0, chunks = 0, cancel_requested = false,
         error = null, finished_at = null, locked_by = null, locked_at = null, heartbeat_at = null,
         next_attempt_at = now(), actor_user_id = excluded.actor_user_id
   where public.nd_jobs.status in ('failed', 'cancelled');
end
$function$;

-- FX5 (G01) plan_derivative е само системен (създава го nd_nc_enqueue_plan), не и през nd_job_create.
alter table public.nd_job_kinds add column system_only boolean not null default false;
update public.nd_job_kinds set system_only = true where kind = 'plan_derivative';
create or replace function public.nd_job_create(
  p_kind text,
  p_key text,
  p_project_id text default null,
  p_input jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  k public.nd_job_kinds%rowtype;
  j public.nd_jobs%rowtype;
  made boolean := true;
begin
  if not public.nd_is_staff() then
    raise exception 'Няма достъп' using errcode = '42501';
  end if;
  select * into k from public.nd_job_kinds where kind = p_kind;
  if not found then
    raise exception 'Непознат вид задача' using errcode = '22023';
  end if;
  if k.system_only then
    raise exception 'Този вид задача се създава само от системата' using errcode = '42501';
  end if;
  if k.admin_only and not public.nd_is_admin() then
    raise exception 'Този вид задача се пуска само от администратор' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^[A-Za-z0-9:._-]{8,200}$' or lower(p_key) like 'pd:%' then
    raise exception 'Невалиден ключ за повторяемост' using errcode = '22023';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' or pg_column_size(p_input) > 65536
     or not public.nd_nc_clean(p_input) then
    raise exception 'Невалидни входни данни' using errcode = '22023';
  end if;
  if p_project_id is not null and not exists (select 1 from public.nd_projects where id = p_project_id) then
    raise exception 'Проектът не е намерен' using errcode = 'P0002';
  end if;
  -- FX16 (G04) лимит: до 100 задачи на служител за 10 минути
  if (select count(*) from public.nd_jobs
       where actor_user_id = auth.uid() and actor_kind = 'user' and created_at > now() - interval '10 minutes') >= 100 then
    raise exception 'Твърде много задачи за кратко време' using errcode = '54000';
  end if;

  insert into public.nd_jobs (kind, idempotency_key, project_id, input, max_attempts, budget_usd,
                              actor_kind, actor_user_id, actor_email)
  values (k.kind, p_key, p_project_id, p_input, k.max_attempts, k.budget_usd,
          'user', auth.uid(), auth.jwt() ->> 'email')
  on conflict (idempotency_key) do nothing
  returning * into j;

  if not found then
    made := false;
    select * into j from public.nd_jobs where idempotency_key = p_key;
    if j.kind <> p_kind or j.actor_user_id is distinct from auth.uid() then
      raise exception 'Ключът вече е използван за друга задача' using errcode = '23505';
    end if;
  end if;
  return jsonb_build_object('ok', true, 'created', made, 'id', j.id, 'kind', j.kind, 'status', j.status);
end
$function$;

create index nd_jobs_actor_idx on public.nd_jobs (actor_user_id, created_at desc);

-- FX6 (A19, A20) Изведеният event_id важи само за същия автор и същата промяна; иначе е нов (случаен) →
--     чужда заявка получава 40001 (стара версия), а не „ok, replayed“; заето изведено id не блокира админа.
create or replace function public.nd_unit_set_status(
  p_unit_id text,
  p_to text,
  p_expected_version integer,
  p_event_id uuid default null,
  p_note text default null,
  p_client_id text default null,
  p_deal_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.nd_units%rowtype;
  ev public.nd_unit_events%rowtype;
  is_admin boolean := public.nd_is_admin();
  st constant text[] := array['free', 'reserved', 'sold'];
  rank_from integer;
  rank_to integer;
  backward boolean;
  eid uuid;
begin
  if not public.nd_is_staff() then
    raise exception 'Няма достъп' using errcode = '42501';
  end if;
  if p_to is null or not (p_to = any (st)) then
    raise exception 'Невалиден статус' using errcode = '22023';
  end if;
  if p_unit_id is null or p_expected_version is null then
    raise exception 'Липсва обект или очаквана версия' using errcode = '22023';
  end if;
  if length(coalesce(p_client_id, '')) > 64 or length(coalesce(p_deal_id, '')) > 64 then
    raise exception 'Невалидна връзка към клиент/сделка' using errcode = '22023';
  end if;
  eid := coalesce(p_event_id, md5('nc:' || p_unit_id || ':' || p_to || ':' || p_expected_version::text
                                  || ':' || coalesce(auth.uid()::text, ''))::uuid);

  select * into ev from public.nd_unit_events where event_id = eid;
  if found then
    if ev.unit_id = p_unit_id and ev.to_status = p_to and ev.by_user is not distinct from auth.uid() then
      select * into u from public.nd_units where id = p_unit_id;
      return jsonb_build_object('ok', true, 'replayed', true, 'unit_id', u.id, 'code', u.code,
        'status', u.status, 'version', u.version, 'event_id', eid, 'floor_id', u.floor_id);
    end if;
    if p_event_id is not null then
      raise exception 'event_id вече е използван за друга промяна' using errcode = '23505';
    end if;
    eid := gen_random_uuid();   -- изведеното id е заето от чужда промяна → не е повтор
  end if;

  select * into u from public.nd_units where id = p_unit_id for update;
  if not found then
    raise exception 'Обектът не е намерен' using errcode = 'P0002';
  end if;
  if u.version <> p_expected_version then
    raise exception 'Променен е от друг – презаредете' using errcode = '40001', detail = u.version::text;
  end if;
  if u.status = p_to then
    raise exception 'Статусът вече е такъв' using errcode = '22023';
  end if;

  rank_from := array_position(st, u.status);
  rank_to   := array_position(st, p_to);
  backward  := rank_to < rank_from;

  if (p_to = 'sold' or backward) and not is_admin then
    raise exception 'Само администратор може да направи тази промяна' using errcode = '42501';
  end if;
  if backward and coalesce(btrim(p_note), '') = '' then
    raise exception 'Връщането на статус изисква причина' using errcode = '22023';
  end if;

  update public.nd_units
     set status = p_to, version = version + 1, status_changed_at = now()
   where id = u.id
   returning * into u;

  insert into public.nd_unit_events (unit_id, event_id, from_status, to_status, by_user, by_email, note, client_id, deal_id)
  values (u.id, eid, st[rank_from], p_to, auth.uid(), auth.jwt() ->> 'email', left(p_note, 1000),
          nullif(btrim(p_client_id), ''), nullif(btrim(p_deal_id), ''));

  return jsonb_build_object('ok', true, 'replayed', false, 'unit_id', u.id, 'code', u.code,
    'status', u.status, 'version', u.version, 'event_id', eid, 'floor_id', u.floor_id);
end
$function$;

-- FX7 (F02, F05) nd_nc_clean: линейна (сканира текста на jsonb по низове-лексеми) и хваща варианти на ключа
--     (представки/наставки, интервали, невидими знаци, кирилски двойници, членувани форми, главни букви).
--     Невидимите знаци са изписани с chr(), за да не зависят от кодирането при пренос.
--     Стойностите не се проверяват (както досега). Законни: construction_stage, строителство, етап_на_строителството.
create or replace function public.nd_nc_clean(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select not exists (
    select 1
      from regexp_matches(j::text, '"((?:[^"\\]|\\.)*)"(: )?', 'g') m
     where m[2] is not null
       and (translate(lower(regexp_replace(m[1], '[[:space:]_.\-' || chr(8203) || '-' || chr(8207) || chr(8288) || chr(65279) || ']|\\u[0-9a-fA-F]{4}', '', 'g')),
                      'іаеорсухк', 'iaeopcyxk')
              ~ '(investor|builder|contractor|developer|constructioncompany)'
         or lower(regexp_replace(m[1], '[[:space:]_.\-' || chr(8203) || '-' || chr(8207) || chr(8288) || chr(65279) || ']', '', 'g'))
              ~ '(инвеститор|строител(?!ств)|изпълнител|възложител)'))
$function$;

-- FX8 (F05) горна граница за размера на data (иначе всяка заявка проверява мегабайти)
alter table public.nd_projects  add constraint nd_projects_data_size  check (pg_column_size(data) <= 262144);
alter table public.nd_buildings add constraint nd_buildings_data_size check (pg_column_size(data) <= 65536);
alter table public.nd_floors    add constraint nd_floors_data_size    check (pg_column_size(data) <= 262144);
alter table public.nd_units     add constraint nd_units_data_size     check (pg_column_size(data) <= 65536);

-- FX9 (H03) identity последователностите не трябват на anon/authenticated (INSERT в identity колона не иска USAGE)
revoke all on sequence public.nd_unit_events_id_seq, public.nd_unit_changes_id_seq,
                       public.nd_plan_files_id_seq, public.nd_project_media_id_seq from public, anon, authenticated;

-- FX10 (H04, F05) помощните функции не са нужни на anon (публичните RPC и политиката са SECURITY DEFINER)
revoke execute on function public.nd_nc_clean(jsonb), public.nd_nc_polygons_ok(jsonb),
                           public.nd_nc_txt(jsonb, text, integer), public.nd_nc_private_path_ok(text, text) from public, anon;

-- FX11 (C15) nd_floor_plan_sig без SECURITY DEFINER: тогава RLS решава – служител вижда, не-служител получава NULL,
--     service_role (BYPASSRLS) и вътрешните извиквания от SECURITY DEFINER функциите (като собственик) работят както досега.
alter function public.nd_floor_plan_sig(text) security invoker;

-- FX12 (E04) пазачът е fail-closed: „доверен“ е само собственикът на таблицата (SECURITY DEFINER/миграции) и service_role.
-- FX15 (E06) статусът на проекта се чете със заключване FOR NO KEY UPDATE → публикуване и редакция не се разминават.
create or replace function public.nd_nc_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  direct boolean := current_user <> 'service_role'
                    and current_user::text <> (select pg_catalog.pg_get_userbyid(c.relowner)::text
                                                 from pg_catalog.pg_class c where c.oid = tg_relid);
  pstatus text;
  locked boolean := false;
begin
  if tg_table_name = 'nd_projects' then
    if tg_op = 'INSERT' then
      if direct then
        new.status := 'draft'; new.slug := null; new.version := 1; new.content_rev := 1;
        new.reviewed_rev := null; new.reviewed_by := null; new.reviewed_at := null;
        new.status_changed_at := null; new.created_by := auth.uid();
      end if;
      return new;
    end if;
    if direct then
      if new.status is distinct from old.status or new.slug is distinct from old.slug then
        raise exception 'Статусът и адресът на проекта се сменят само през projects.publish / projects.archive'
          using errcode = '42501';
      end if;
      if (new.id, new.reviewed_rev, new.reviewed_by, new.reviewed_at, new.status_changed_at, new.created_by, new.created_at)
         is distinct from
         (old.id, old.reviewed_rev, old.reviewed_by, old.reviewed_at, old.status_changed_at, old.created_by, old.created_at) then
        raise exception 'Служебните полета на проекта не се редактират' using errcode = '42501';
      end if;
      if old.status = 'published' and not public.nd_is_admin()
         and (new.data -> 'price_policy') is distinct from (old.data -> 'price_policy') then
        raise exception 'В публикуван проект основата на цената се сменя само от администратор' using errcode = '42501';
      end if;
      new.version := old.version;
      new.content_rev := old.content_rev;
    end if;
    if (new.name, new.data) is distinct from (old.name, old.data) then
      if new.version = old.version then new.version := old.version + 1; end if;
      new.content_rev := old.content_rev + 1;
    end if;
    return new;
  end if;

  if direct then
    select p.status into pstatus from public.nd_projects p where p.id = new.project_id for no key update;
  else
    select p.status into pstatus from public.nd_projects p where p.id = new.project_id;
  end if;
  if direct and pstatus = 'published' and not public.nd_is_admin() then
    locked := true;
  end if;

  if tg_table_name = 'nd_buildings' then
    if tg_op = 'INSERT' then
      if locked then raise exception 'В публикуван проект сграда добавя само администратор' using errcode = '42501'; end if;
      if direct then new.created_by := auth.uid(); end if;
    elsif direct and (new.id, new.project_id, new.created_by, new.created_at) is distinct from (old.id, old.project_id, old.created_by, old.created_at) then
      raise exception 'Сграда не се премества в друг проект' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_table_name = 'nd_floors' then
    if tg_op = 'INSERT' then
      if locked then raise exception 'В публикуван проект етаж добавя само администратор' using errcode = '42501'; end if;
      if direct then new.created_by := auth.uid(); new.plan_rev := 1; end if;
      return new;
    end if;
    if direct and (new.id, new.project_id, new.building_id, new.created_by, new.created_at)
                  is distinct from (old.id, old.project_id, old.building_id, old.created_by, old.created_at) then
      raise exception 'Етаж не се премества в друга сграда или проект' using errcode = '42501';
    end if;
    if direct then new.plan_rev := old.plan_rev; end if;
    if new.plan_rev < old.plan_rev then new.plan_rev := old.plan_rev + 1; end if;   -- монотонно и за доверените пътища
    if (new.data #>> '{plan,private}') is distinct from (old.data #>> '{plan,private}')
       or (new.data -> 'polygons') is distinct from (old.data -> 'polygons') then
      if locked then raise exception 'В публикуван проект планът и полигоните се сменят само от администратор' using errcode = '42501'; end if;
      if new.plan_rev = old.plan_rev then new.plan_rev := old.plan_rev + 1; end if;
    end if;
    if locked and new.level is distinct from old.level then
      raise exception 'В публикуван проект номерът на етажа се сменя само от администратор' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_table_name = 'nd_units' then
    if tg_op = 'INSERT' then
      if locked then raise exception 'В публикуван проект обект добавя само администратор' using errcode = '42501'; end if;
      if direct then
        new.status := 'free'; new.version := 1; new.plan_rev := 1; new.status_changed_at := null;
        new.created_by := auth.uid();
      end if;
      return new;
    end if;
    if direct then
      if new.status is distinct from old.status or new.status_changed_at is distinct from old.status_changed_at then
        raise exception 'Статусът на обекта се сменя само през units.set_status' using errcode = '42501';
      end if;
      if (new.id, new.project_id, new.building_id, new.floor_id, new.created_by, new.created_at)
         is distinct from (old.id, old.project_id, old.building_id, old.floor_id, old.created_by, old.created_at) then
        raise exception 'Обект не се премества в друг етаж, сграда или проект' using errcode = '42501';
      end if;
      new.version := old.version;
      new.plan_rev := old.plan_rev;
    end if;
    if new.plan_rev < old.plan_rev then new.plan_rev := old.plan_rev + 1; end if;
    if locked and (new.code, new.area_total, new.area_net, new.terrace_area, new.price_per_m2, new.price_total,
                   new.price_override, new.price_override_reason, new.data #>> '{plan,private}')
                  is distinct from
                  (old.code, old.area_total, old.area_net, old.terrace_area, old.price_per_m2, old.price_total,
                   old.price_override, old.price_override_reason, old.data #>> '{plan,private}') then
      raise exception 'В публикуван проект код, площ, цена и план се сменят само от администратор' using errcode = '42501';
    end if;
    if (new.data #>> '{plan,private}') is distinct from (old.data #>> '{plan,private}') and new.plan_rev = old.plan_rev then
      new.plan_rev := old.plan_rev + 1;
    end if;
    if new.version = old.version then new.version := old.version + 1; end if;
    return new;
  end if;

  return new;
end
$function$;

-- FX13 (G10, G11) работеща задача винаги има изпълнител; разходът е краен (NaN/Infinity → отказ)
alter table public.nd_jobs add constraint nd_jobs_running_locked check (status <> 'running' or coalesce(length(btrim(locked_by)), 0) > 0);
alter table public.nd_jobs add constraint nd_jobs_cost_finite    check (cost_usd < 1000000 and budget_usd < 1000000);

-- FX14 (D07) историята на площи/цени е одит: не се трие с обекта; записва и код, план и първоначалните стойности
alter table public.nd_unit_changes drop constraint nd_unit_changes_unit_id_fkey;
alter table public.nd_unit_changes add column project_id text;
create or replace function public.nd_units_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r record;
begin
  if tg_op = 'DELETE' then
    insert into public.nd_unit_changes (unit_id, project_id, field, old_value, new_value, by_user, by_email)
    values (old.id, old.project_id, 'deleted', old.code, null, auth.uid(), auth.jwt() ->> 'email');
    update public.nd_projects set content_rev = content_rev + 1 where id = old.project_id;
    if found then perform public.nd_nc_enqueue_plan('floor', old.floor_id); end if;
    return null;
  end if;

  for r in
    select * from (values
      ('code',           case when tg_op = 'UPDATE' then old.code end,                  new.code),
      ('area_total',     case when tg_op = 'UPDATE' then old.area_total::text end,      new.area_total::text),
      ('area_net',       case when tg_op = 'UPDATE' then old.area_net::text end,        new.area_net::text),
      ('terrace_area',   case when tg_op = 'UPDATE' then old.terrace_area::text end,    new.terrace_area::text),
      ('price_per_m2',   case when tg_op = 'UPDATE' then old.price_per_m2::text end,    new.price_per_m2::text),
      ('price_total',    case when tg_op = 'UPDATE' then old.price_total::text end,     new.price_total::text),
      ('price_override', case when tg_op = 'UPDATE' then old.price_override::text end,  new.price_override::text),
      ('price_override_reason', case when tg_op = 'UPDATE' then old.price_override_reason end, new.price_override_reason),
      ('plan',           case when tg_op = 'UPDATE' then old.data #>> '{plan,private}' end, new.data #>> '{plan,private}')
    ) as t(field, o, n)
    where t.o is distinct from t.n
  loop
    insert into public.nd_unit_changes (unit_id, project_id, field, old_value, new_value, by_user, by_email)
    values (new.id, new.project_id, r.field, r.o, r.n, auth.uid(), auth.jwt() ->> 'email');
  end loop;

  if tg_op = 'INSERT' then
    update public.nd_projects set content_rev = content_rev + 1 where id = new.project_id;
    perform public.nd_nc_enqueue_plan('unit', new.id);
    perform public.nd_nc_enqueue_plan('floor', new.floor_id);
    return null;
  end if;

  if (new.code, new.area_total, new.area_net, new.terrace_area, new.price_per_m2, new.price_total,
      new.price_override, new.price_override_reason, new.data)
     is distinct from
     (old.code, old.area_total, old.area_net, old.terrace_area, old.price_per_m2, old.price_total,
      old.price_override, old.price_override_reason, old.data) then
    update public.nd_projects set content_rev = content_rev + 1 where id = new.project_id;
  end if;

  if new.plan_rev <> old.plan_rev or new.status <> old.status then
    perform public.nd_nc_enqueue_plan('unit', new.id);
  end if;
  if new.status <> old.status then
    perform public.nd_nc_enqueue_plan('floor', new.floor_id);
  end if;
  return null;
end
$function$;

commit;
