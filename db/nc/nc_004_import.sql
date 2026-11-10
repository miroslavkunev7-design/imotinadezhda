-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · nc_004 – импорт на проектен пакет (TASK-006)
-- САМО ДОБАВЯ 4 функции. Не променя нито една таблица, политика, тригер или съществуваща функция.
-- Прилага се СЛЕД nc_001 + nc_002 + nc_003. Обратно: nc_004_import_down.sql (или nc_001_down.sql за целия модул).
--
--   nd_job_claim_id(id, kinds, worker)   – изпълнителят (service role) взима ТОЧНО тази задача (jobs.status придвижва своята задача);
--                                           същата логика за спрял изпълнител като nd_job_claim (nc_003, FX3).
--   nd_import_apply(job, project, rev, payload) – SECURITY INVOKER: записът става с правата на служителя (RLS, права по колони,
--                                           пазачът nd_nc_guard – напр. брокер не добавя обекти в публикуван проект) в ЕДНА транзакция:
--                                           или се записва всичко, или нищо. Статус на обект не се подава (новите са free по пазача).
--   nd_import_job_begin / nd_import_job_done – SECURITY DEFINER помощници: заключват задачата, проверяват автор/админ и
--                                           я преместват review → done в същата транзакция. done приема само извикване от
--                                           nd_import_apply в същата транзакция (транзакционна променлива nd.import_job).
-- Конфликт на версии: NC409 (не 40001 – PostgREST повтаря 40001 сам и заявката увисва).
-- =====================================================================
begin;

create function public.nd_job_claim_id(
  p_id uuid,
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
   where x.id = p_id
     and k.kind = x.kind
     and x.status = 'running'
     and x.kind = any (p_kinds)
     and coalesce(x.heartbeat_at, x.locked_at) < now() - make_interval(secs => k.stale_secs);

  select * into j
    from public.nd_jobs
   where id = p_id
     and status = 'queued'
     and kind = any (p_kinds)
     and next_attempt_at <= now()
     and not cancel_requested
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

create function public.nd_import_job_begin(p_job_id uuid, p_project_id text)
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
  select * into j from public.nd_jobs where id = p_job_id for update;
  if not found or j.kind <> 'import' then
    raise exception 'Задачата за импорт не е намерена' using errcode = 'P0002';
  end if;
  if j.project_id is distinct from p_project_id then
    raise exception 'Задачата е за друг проект' using errcode = '42501';
  end if;
  if j.actor_user_id is distinct from auth.uid() and not public.nd_is_admin() then
    raise exception 'Само авторът на импорта или администратор записва черновата' using errcode = '42501';
  end if;
  if j.status = 'done' then
    return jsonb_build_object('replay', true, 'applied', j.result -> 'applied');
  end if;
  if j.status <> 'review' or j.cancel_requested then
    raise exception 'Импортът не чака преглед (%)', j.status using errcode = 'NC409';
  end if;
  perform set_config('nd.import_job', p_job_id::text, true);
  return jsonb_build_object('replay', false);
end
$function$;

create function public.nd_import_job_done(p_job_id uuid, p_receipt jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if coalesce(current_setting('nd.import_job', true), '') <> p_job_id::text then
    raise exception 'Отбелязването е възможно само от nd_import_apply' using errcode = '42501';
  end if;
  if p_receipt is null or jsonb_typeof(p_receipt) <> 'object' or pg_column_size(p_receipt) > 65536
     or not public.nd_nc_clean(p_receipt) then
    raise exception 'Невалидна разписка' using errcode = '22023';
  end if;
  update public.nd_jobs
     set status = 'done', finished_at = now(), result = result || jsonb_build_object('applied', p_receipt)
   where id = p_job_id and status = 'review';
  if not found then
    raise exception 'Импортът не чака преглед' using errcode = 'NC409';
  end if;
  perform set_config('nd.import_job', '', true);
end
$function$;

create function public.nd_import_apply(
  p_job_id uuid,
  p_project_id text,
  p_expected_content_rev integer,
  p_payload jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  b jsonb;
  p public.nd_projects%rowtype;
  x jsonb;
  nid text;
  bid text;
  fid text;
  n integer;
  brefs text[] := '{}'; bids text[] := '{}';
  frefs text[] := '{}'; fids text[] := '{}'; fbids text[] := '{}';
  umap jsonb := '{}'::jsonb;
  nb integer := 0; nf integer := 0; nu integer := 0; uu integer := 0; uf integer := 0;
  proj_upd boolean := false;
  receipt jsonb;
begin
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or p_expected_content_rev is null then
    raise exception 'Невалидни данни за импорт' using errcode = '22023';
  end if;
  b := public.nd_import_job_begin(p_job_id, p_project_id);
  if (b ->> 'replay')::boolean then
    return jsonb_build_object('replayed', true) || coalesce(b -> 'applied', '{}'::jsonb);
  end if;

  -- проектът: заключване + сверка на версията на съдържанието от момента на анализа
  select * into p from public.nd_projects where id = p_project_id for update;
  if not found then
    raise exception 'Проектът не е намерен' using errcode = 'P0002';
  end if;
  if p.content_rev <> p_expected_content_rev then
    raise exception 'Проектът е променен след анализа – пуснете анализа отново' using errcode = 'NC409', detail = p.content_rev::text;
  end if;

  if jsonb_typeof(p_payload -> 'project') = 'object' then
    update public.nd_projects
       set name = coalesce(public.nd_nc_txt(p_payload -> 'project', 'name', 200), name),
           data = data || coalesce(p_payload #> '{project,data}', '{}'::jsonb)
     where id = p_project_id;
    proj_upd := true;
  end if;

  -- сгради (само разрешените колони; пазачът/RLS важат)
  for x in select value from jsonb_array_elements(coalesce(p_payload -> 'buildings', '[]'::jsonb)) loop
    insert into public.nd_buildings (project_id, name, sort, data)
    values (p_project_id, x ->> 'name', coalesce((x ->> 'sort')::integer, 0), coalesce(x -> 'data', '{}'::jsonb))
    returning id into nid;
    brefs := brefs || (x ->> 'ref'); bids := bids || nid; nb := nb + 1;
  end loop;

  -- етажи
  for x in select value from jsonb_array_elements(coalesce(p_payload -> 'floors', '[]'::jsonb)) loop
    bid := coalesce(x ->> 'building_id', bids[array_position(brefs, x ->> 'building_ref')]);
    if bid is null then
      raise exception 'Етаж без сграда в черновата' using errcode = '22023';
    end if;
    insert into public.nd_floors (project_id, building_id, level, label, data)
    values (p_project_id, bid, (x ->> 'level')::integer, x ->> 'label', coalesce(x -> 'data', '{}'::jsonb))
    returning id into nid;
    frefs := frefs || (x ->> 'ref'); fids := fids || nid; fbids := fbids || bid; nf := nf + 1;
  end loop;

  -- план към съществуващ етаж (само ако етажът не е пипан след анализа)
  for x in select value from jsonb_array_elements(coalesce(p_payload -> 'floors_update', '[]'::jsonb)) loop
    update public.nd_floors f
       set data = jsonb_set(f.data, '{plan}', coalesce(f.data -> 'plan', '{}'::jsonb) || jsonb_build_object('private', x ->> 'plan_private'))
     where f.id = x ->> 'id' and f.project_id = p_project_id and f.updated_at = (x ->> 'expected_updated_at')::timestamptz;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'Етажът е променен след анализа – пуснете анализа отново' using errcode = 'NC409';
    end if;
    uf := uf + 1;
  end loop;

  -- нови обекти: една заявка; статусът не се подава (пазачът го прави free)
  if exists (select 1 from jsonb_array_elements(coalesce(p_payload -> 'units', '[]'::jsonb)) v
              where coalesce(v.value ->> 'floor_id', fids[array_position(frefs, v.value ->> 'floor_ref')]) is null) then
    raise exception 'Обект без етаж в черновата' using errcode = '22023';
  end if;
  with src as (
    select v.value as v,
           coalesce(v.value ->> 'floor_id', fids[array_position(frefs, v.value ->> 'floor_ref')]) as fid
      from jsonb_array_elements(coalesce(p_payload -> 'units', '[]'::jsonb)) v
  ), res as (
    select s.v, s.fid, f.building_id as bid
      from src s join public.nd_floors f on f.id = s.fid and f.project_id = p_project_id
  ), ins as (
    insert into public.nd_units (project_id, building_id, floor_id, code, area_total, area_net, terrace_area, price_per_m2,
                                 price_total, price_override, price_override_reason, data)
    select p_project_id, r.bid, r.fid, r.v ->> 'code',
           (r.v ->> 'area_total')::numeric, (r.v ->> 'area_net')::numeric, (r.v ->> 'terrace_area')::numeric, (r.v ->> 'price_per_m2')::numeric,
           case when coalesce((r.v ->> 'price_override')::boolean, false) then (r.v ->> 'price_total')::numeric end,
           coalesce((r.v ->> 'price_override')::boolean, false),
           case when coalesce((r.v ->> 'price_override')::boolean, false) then r.v ->> 'price_override_reason' end,
           coalesce(r.v -> 'data', '{}'::jsonb) || jsonb_build_object('import', coalesce(r.v #> '{data,import}', '{}'::jsonb) || jsonb_build_object('ref', r.v ->> 'ref'))
      from res r
    returning id, data #>> '{import,ref}' as ref
  )
  select coalesce(jsonb_object_agg(ref, id), '{}'::jsonb), count(*) into umap, nu from ins;
  if nu <> jsonb_array_length(coalesce(p_payload -> 'units', '[]'::jsonb)) then
    raise exception 'Обект с етаж от друг проект' using errcode = '22023';
  end if;

  -- обновяване на съществуващи обекти: само подадените колони, само при същата версия
  for x in select value from jsonb_array_elements(coalesce(p_payload -> 'units_update', '[]'::jsonb)) loop
    update public.nd_units u
       set area_total   = case when (x -> 'set') ? 'area_total'   then (x #>> '{set,area_total}')::numeric   else u.area_total end,
           area_net     = case when (x -> 'set') ? 'area_net'     then (x #>> '{set,area_net}')::numeric     else u.area_net end,
           terrace_area = case when (x -> 'set') ? 'terrace_area' then (x #>> '{set,terrace_area}')::numeric else u.terrace_area end,
           price_per_m2 = case when (x -> 'set') ? 'price_per_m2' then (x #>> '{set,price_per_m2}')::numeric else u.price_per_m2 end,
           price_override = case when (x -> 'set') ? 'price_override' then (x #>> '{set,price_override}')::boolean else u.price_override end,
           price_total  = case when coalesce((x #>> '{set,price_override}')::boolean, false) then (x #>> '{set,price_total}')::numeric else u.price_total end,
           price_override_reason = case when (x -> 'set') ? 'price_override' then x #>> '{set,price_override_reason}' else u.price_override_reason end,
           data = u.data || coalesce(x -> 'data_patch', '{}'::jsonb)
     where u.id = x ->> 'id' and u.project_id = p_project_id and u.version = (x ->> 'expected_version')::integer;
    get diagnostics n = row_count;
    if n = 0 then
      raise exception 'Обект е променен след анализа – пуснете анализа отново' using errcode = 'NC409';
    end if;
    uu := uu + 1;
  end loop;

  receipt := jsonb_build_object('project_id', p_project_id, 'job_id', p_job_id,
               'created', jsonb_build_object('buildings', nb, 'floors', nf, 'units', nu),
               'updated', jsonb_build_object('units', uu, 'floors', uf, 'project', proj_upd),
               'at', now());
  perform public.nd_import_job_done(p_job_id, receipt);
  return receipt || jsonb_build_object('replayed', false,
           'refs', jsonb_build_object('units', umap,
                                      'buildings', (select coalesce(jsonb_object_agg(r, i), '{}'::jsonb) from unnest(brefs, bids) t(r, i)),
                                      'floors', (select coalesce(jsonb_object_agg(r, i), '{}'::jsonb) from unnest(frefs, fids) t(r, i))));
end
$function$;

revoke all on function public.nd_job_claim_id(uuid, text[], text) from public, anon, authenticated;
grant execute on function public.nd_job_claim_id(uuid, text[], text) to service_role;
revoke all on function public.nd_import_job_begin(uuid, text) from public, anon;
revoke all on function public.nd_import_job_done(uuid, jsonb) from public, anon;
revoke all on function public.nd_import_apply(uuid, text, integer, jsonb) from public, anon;
grant execute on function public.nd_import_job_begin(uuid, text) to authenticated;
grant execute on function public.nd_import_job_done(uuid, jsonb) to authenticated;
grant execute on function public.nd_import_apply(uuid, text, integer, jsonb) to authenticated;

commit;
