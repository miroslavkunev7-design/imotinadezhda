-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · nc_005 – CAD/BIM проверка и 3D модели на сгради (TASK-009)
-- САМО ДОБАВЯ: 1 таблица (nd_models), 9 функции, 1 тригер върху nd_models и 1 тригер върху nd_jobs
-- (действа само за вид cad_convert). Не променя съществуваща таблица, функция, политика или ред в nd_job_kinds.
-- Прилага се СЛЕД nc_001 + nc_002 + nc_003 + nc_004. Обратно: nc_005_cad_models_down.sql (ПРЕДИ nc_004_import_down / nc_001_down).
--
--   nd_models                      – версии на 3D модела на сграда. Всяка версия е неизменима (файл + хеш + отчет + съответствие).
--                                    Пише САМО изпълнителят (service role, през nd_model_register). Служителите четат (RLS: nd_is_staff).
--                                    Най-много ЕДНА публикувана версия на сграда; старата става „retired“ и остава за връщане назад.
--   nd_model_register(job, worker, model, result)   – service role: записва версията и премества задачата running → review в ЕДНА
--                                    транзакция. Задача, която вече не е заключена от този изпълнител (остаряла), не записва нищо (42501).
--   nd_job_fail_final(job, worker, error, result)   – service role: окончателен неуспех без нов опит (повреден/неподдържан файл).
--   nd_cad_job_touch(job, patch)   – service role: бележка в напредъка на ЧАКАЩА тежка задача (кога е повикан изпълнителят).
--   nd_model_publish(job, building, expected_published, rollback) – само администратор: публикува проверената версия; предишната
--                                    публикувана става retired. По-стара версия върху по-нова – само с rollback=true. Разминаване → NC409.
--   nd_model_unpublish(building, expected_published) – само администратор: сваля модела от публичния сайт (версията остава).
--   nd_model_resolve(building, what) – service role, при ВСЯКО отваряне на /model/<сграда>: път само ако проектът е публикуван
--                                    И има публикувана версия. Иначе NULL → 404.
--   nd_public_models(slug)         – публично: за коя сграда има публикуван модел (версия, размер, вид точност). Без пътища.
-- Конфликт на версии: NC409 (не 40001 – PostgREST повтаря 40001 сам и заявката увисва).
-- Файловете са в projects/<проект>/private/derived/models/<задача>/… – там служител не пише (nc_003, FX1) и публиката не чете.
-- =====================================================================
begin;

-- ---------- 1. Таблица ----------------------------------------------------
create table public.nd_models (
  id             uuid primary key default gen_random_uuid(),
  project_id     text not null,
  building_id    text not null,
  version        integer not null check (version >= 1),
  job_id         uuid not null unique references public.nd_jobs(id) on delete restrict,
  status         text not null default 'review' check (status in ('review', 'published', 'retired', 'rejected')),
  -- exact = пряка конверсия от авторитетен BIM/CAD източник, минала контролните проверки;
  -- verified = мрежов източник (GLB) с проверени от човек контролни размери; conceptual = без авторитетно потвърждение.
  fidelity       text not null check (fidelity in ('exact', 'verified', 'conceptual')),
  source_format  text not null check (source_format in ('ifc', 'dxf', 'dwg', 'glb', 'gltf')),
  source_sha256  text not null check (source_sha256 ~ '^[a-f0-9]{64}$'),
  source_bytes   bigint not null check (source_bytes > 0),
  glb_path       text not null unique,
  glb_sha256     text not null check (glb_sha256 ~ '^[a-f0-9]{64}$'),
  glb_bytes      bigint not null check (glb_bytes between 20 and 67108864),
  poster_path    text unique,
  stats          jsonb not null default '{}'::jsonb,
  report         jsonb not null default '{}'::jsonb,
  mapping        jsonb not null default '{}'::jsonb,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  published_by   uuid,
  published_at   timestamptz,
  retired_at     timestamptz,
  foreign key (building_id, project_id) references public.nd_buildings(id, project_id) on delete cascade,
  constraint nd_models_building_version unique (building_id, version),
  constraint nd_models_json check (jsonb_typeof(stats) = 'object' and jsonb_typeof(report) = 'object' and jsonb_typeof(mapping) = 'object'
                                   and pg_column_size(stats) <= 16384 and pg_column_size(report) <= 262144 and pg_column_size(mapping) <= 524288
                                   and public.nd_nc_clean(report) and public.nd_nc_clean(mapping) and public.nd_nc_clean(stats)),
  constraint nd_models_glb_path check (length(glb_path) <= 300
                                       and split_part(glb_path, '/', 1) = 'projects'
                                       and split_part(glb_path, '/', 2) = project_id
                                       and split_part(glb_path, '/', 3) = 'private'
                                       and split_part(glb_path, '/', 4) = 'derived'
                                       and split_part(glb_path, '/', 5) = 'models'
                                       and split_part(glb_path, '/', 6) = job_id::text
                                       and split_part(glb_path, '/', 7) ~ '^[a-z0-9][a-z0-9._-]{0,60}\.glb$'
                                       and split_part(glb_path, '/', 8) = ''),
  constraint nd_models_poster_path check (poster_path is null or (length(poster_path) <= 300
                                       and split_part(poster_path, '/', 1) = 'projects'
                                       and split_part(poster_path, '/', 2) = project_id
                                       and split_part(poster_path, '/', 3) = 'private'
                                       and split_part(poster_path, '/', 4) = 'derived'
                                       and split_part(poster_path, '/', 5) = 'models'
                                       and split_part(poster_path, '/', 6) = job_id::text
                                       and split_part(poster_path, '/', 7) ~ '^[a-z0-9][a-z0-9._-]{0,60}\.jpg$'
                                       and split_part(poster_path, '/', 8) = '')),
  constraint nd_models_published check ((status = 'published') <= (published_at is not null))
);
create unique index nd_models_published_uq on public.nd_models (building_id) where status = 'published';
create index nd_models_project_idx on public.nd_models (project_id, building_id, version desc);

-- ---------- 2. Пазач: версията е неизменима ----------------------------------
create function public.nd_models_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  direct boolean := current_user <> 'service_role'
                    and current_user::text <> (select pg_catalog.pg_get_userbyid(c.relowner)::text
                                                 from pg_catalog.pg_class c where c.oid = tg_relid);
  j public.nd_jobs%rowtype;
begin
  if direct then
    raise exception 'Версиите на модела се записват само от изпълнителя и се публикуват през models.publish' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    select * into j from public.nd_jobs where id = new.job_id;
    if not found or j.kind <> 'cad_convert' or j.project_id is distinct from new.project_id
       or (j.input ->> 'building_id') is distinct from new.building_id then
      raise exception 'Моделът не отговаря на задачата си' using errcode = '22023';
    end if;
    -- номерът на версията се дава тук (заключване на сградата → двама изпълнители не взимат един номер)
    perform 1 from public.nd_buildings where id = new.building_id and project_id = new.project_id for update;
    if not found then
      raise exception 'Сградата не е намерена' using errcode = 'P0002';
    end if;
    new.version := coalesce((select max(m.version) from public.nd_models m where m.building_id = new.building_id), 0) + 1;
    new.status := 'review'; new.published_at := null; new.published_by := null; new.retired_at := null;
    new.created_at := now(); new.created_by := j.actor_user_id;
    return new;
  end if;
  if (new.id, new.project_id, new.building_id, new.version, new.job_id, new.fidelity, new.source_format, new.source_sha256,
      new.source_bytes, new.glb_path, new.glb_sha256, new.glb_bytes, new.poster_path, new.stats, new.report, new.mapping,
      new.created_by, new.created_at)
     is distinct from
     (old.id, old.project_id, old.building_id, old.version, old.job_id, old.fidelity, old.source_format, old.source_sha256,
      old.source_bytes, old.glb_path, old.glb_sha256, old.glb_bytes, old.poster_path, old.stats, old.report, old.mapping,
      old.created_by, old.created_at) then
    raise exception 'Версията на модела е неизменима – нов файл означава нова версия' using errcode = '42501';
  end if;
  if new.status is distinct from old.status
     and not ((old.status = 'review' and new.status in ('published', 'rejected'))
              or (old.status = 'published' and new.status = 'retired')
              or (old.status = 'retired' and new.status = 'published')) then
    raise exception 'Непозволен преход на модела: % → %', old.status, new.status using errcode = '22023';
  end if;
  return new;
end
$function$;
create trigger nd_models_guard before insert or update on public.nd_models
  for each row execute function public.nd_models_guard();

-- Отменена задача за конверсия → моделът ѝ, който чака преглед, става „rejected“ (не може да се публикува).
create function public.nd_models_job_sync()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.kind = 'cad_convert' and new.status in ('cancelled', 'failed') and old.status is distinct from new.status then
    update public.nd_models set status = 'rejected' where job_id = new.id and status = 'review';
  end if;
  return null;
end
$function$;
create trigger nd_models_job_sync after update of status on public.nd_jobs
  for each row when (new.kind = 'cad_convert') execute function public.nd_models_job_sync();

-- ---------- 3. RLS и права --------------------------------------------------
alter table public.nd_models enable row level security;
revoke all on public.nd_models from public, anon, authenticated;
grant select on public.nd_models to authenticated;
create policy "nc models staff read" on public.nd_models for select to authenticated using ((select public.nd_is_staff()));
-- без INSERT/UPDATE/DELETE за служители: само RPC по-долу и service role.

-- ---------- 4. Изпълнителят (service role) -----------------------------------
create function public.nd_model_register(
  p_job_id uuid,
  p_worker text,
  p_model jsonb,
  p_result jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  j public.nd_jobs%rowtype;
  m public.nd_models%rowtype;
begin
  select * into j from public.nd_jobs where id = p_job_id for update;
  if not found or j.kind <> 'cad_convert' then
    raise exception 'Задачата за модел не е намерена' using errcode = 'P0002';
  end if;
  -- повтор на същото отчитане (същата задача вече има версия) → същият отговор, без втори запис
  select * into m from public.nd_models where job_id = p_job_id;
  if found then
    return jsonb_build_object('ok', true, 'replayed', true, 'model_id', m.id, 'version', m.version, 'status', m.status, 'job_status', j.status);
  end if;
  if j.status <> 'running' or j.locked_by is distinct from left(p_worker, 120) then
    raise exception 'Задачата не е заключена от този изпълнител' using errcode = '42501';
  end if;
  if j.cancel_requested then
    update public.nd_jobs
       set status = 'cancelled', locked_by = null, locked_at = null, heartbeat_at = null, finished_at = now()
     where id = p_job_id;
    return jsonb_build_object('ok', true, 'cancelled', true, 'job_status', 'cancelled');
  end if;
  if p_model is null or jsonb_typeof(p_model) <> 'object' or p_result is null or jsonb_typeof(p_result) <> 'object'
     or pg_column_size(p_result) > 65536 or not public.nd_nc_clean(p_result) then
    raise exception 'Невалидни данни за модела' using errcode = '22023';
  end if;

  insert into public.nd_models (project_id, building_id, version, job_id, fidelity, source_format, source_sha256, source_bytes,
                                glb_path, glb_sha256, glb_bytes, poster_path, stats, report, mapping)
  values (j.project_id, j.input ->> 'building_id', 1, j.id,
          p_model ->> 'fidelity', p_model ->> 'source_format', p_model ->> 'source_sha256', (p_model ->> 'source_bytes')::bigint,
          p_model ->> 'glb_path', p_model ->> 'glb_sha256', (p_model ->> 'glb_bytes')::bigint, p_model ->> 'poster_path',
          coalesce(p_model -> 'stats', '{}'::jsonb), coalesce(p_model -> 'report', '{}'::jsonb), coalesce(p_model -> 'mapping', '{}'::jsonb))
  returning * into m;

  update public.nd_jobs
     set status = 'review',
         result = p_result || jsonb_build_object('model_id', m.id, 'model_version', m.version, 'building_id', m.building_id),
         error = null, locked_by = null, locked_at = null, heartbeat_at = null, finished_at = now()
   where id = p_job_id;
  return jsonb_build_object('ok', true, 'replayed', false, 'model_id', m.id, 'version', m.version, 'status', m.status, 'job_status', 'review');
end
$function$;

create function public.nd_job_fail_final(
  p_id uuid,
  p_worker text,
  p_error text,
  p_result jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  j public.nd_jobs%rowtype;
begin
  select * into j from public.nd_jobs where id = p_id for update;
  if not found or j.kind not in ('cad_inspect', 'cad_convert') then
    raise exception 'Задачата не е намерена' using errcode = 'P0002';
  end if;
  if j.status <> 'running' or j.locked_by is distinct from left(p_worker, 120) then
    raise exception 'Задачата не е заключена от този изпълнител' using errcode = '42501';
  end if;
  if p_result is not null and (jsonb_typeof(p_result) <> 'object' or pg_column_size(p_result) > 65536 or not public.nd_nc_clean(p_result)) then
    raise exception 'Невалиден резултат' using errcode = '22023';
  end if;
  update public.nd_jobs
     set status = case when j.cancel_requested then 'cancelled' else 'failed' end,
         error = left(p_error, 2000), result = coalesce(p_result, result),
         locked_by = null, locked_at = null, heartbeat_at = null, finished_at = now()
   where id = p_id
   returning * into j;
  return jsonb_build_object('ok', true, 'id', j.id, 'status', j.status);
end
$function$;

create function public.nd_cad_job_touch(p_id uuid, p_patch jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' or pg_column_size(p_patch) > 2048 then
    raise exception 'Невалидна бележка' using errcode = '22023';
  end if;
  update public.nd_jobs
     set progress = progress || p_patch
   where id = p_id and kind in ('cad_inspect', 'cad_convert') and status = 'queued';
  return found;
end
$function$;

-- ---------- 5. Публикуване (само администратор, след човешки преглед) ----------
create function public.nd_model_publish(
  p_job_id uuid,
  p_building_id text,
  p_expected_published integer default null,
  p_rollback boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  m public.nd_models%rowtype;
  cur public.nd_models%rowtype;
  j public.nd_jobs%rowtype;
  prev integer := 0;
begin
  if not public.nd_is_admin() then
    raise exception 'Модел се публикува само от администратор' using errcode = '42501';
  end if;
  select * into m from public.nd_models where job_id = p_job_id;
  if not found then
    raise exception 'За тази задача няма готов модел' using errcode = 'P0002';
  end if;
  if m.building_id is distinct from p_building_id then
    raise exception 'Моделът е за друга сграда' using errcode = '42501';
  end if;
  -- едно публикуване наведнъж за сградата
  perform 1 from public.nd_buildings where id = m.building_id for update;
  select * into m from public.nd_models where id = m.id for update;
  select * into cur from public.nd_models where building_id = m.building_id and status = 'published';
  if found then prev := cur.version; end if;

  if m.status = 'published' then
    return jsonb_build_object('ok', true, 'replayed', true, 'building_id', m.building_id, 'model_public', true,
                              'version', m.version, 'previous_version', null);
  end if;
  if m.status = 'rejected' then
    raise exception 'Моделът е отхвърлен (задачата е отменена или неуспешна) – пуснете нова конверсия' using errcode = 'NC409';
  end if;
  select * into j from public.nd_jobs where id = p_job_id for update;
  if j.status not in ('review', 'done') then
    raise exception 'Задачата не чака преглед (%)', j.status using errcode = 'NC409';
  end if;
  if p_expected_published is not null and p_expected_published <> prev then
    raise exception 'Публикуваният модел е сменен от друг – презаредете' using errcode = 'NC409', detail = prev::text;
  end if;
  if prev > m.version and not coalesce(p_rollback, false) then
    raise exception 'Вече е публикувана по-нова версия (v%) – за връщане към v% подайте rollback', prev, m.version
      using errcode = 'NC409', detail = prev::text;
  end if;

  if prev > 0 then
    update public.nd_models set status = 'retired', retired_at = now() where id = cur.id;
  end if;
  update public.nd_models
     set status = 'published', published_at = now(), published_by = auth.uid(), retired_at = null
   where id = m.id
   returning * into m;
  if j.status = 'review' then
    update public.nd_jobs
       set status = 'done', finished_at = now(),
           result = result || jsonb_build_object('published', jsonb_build_object('version', m.version, 'at', now(), 'by', auth.uid()))
     where id = j.id;
  end if;
  return jsonb_build_object('ok', true, 'replayed', false, 'building_id', m.building_id, 'model_public', true,
                            'version', m.version, 'previous_version', nullif(prev, 0));
end
$function$;

create function public.nd_model_unpublish(
  p_building_id text,
  p_expected_published integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  cur public.nd_models%rowtype;
begin
  if not public.nd_is_admin() then
    raise exception 'Модел се сваля само от администратор' using errcode = '42501';
  end if;
  perform 1 from public.nd_buildings where id = p_building_id for update;
  if not found then
    raise exception 'Сградата не е намерена' using errcode = 'P0002';
  end if;
  select * into cur from public.nd_models where building_id = p_building_id and status = 'published' for update;
  if not found then
    if coalesce(p_expected_published, 0) <> 0 then
      raise exception 'Публикуваният модел е сменен от друг – презаредете' using errcode = 'NC409', detail = '0';
    end if;
    return jsonb_build_object('ok', true, 'changed', false, 'building_id', p_building_id, 'model_public', false, 'previous_version', null);
  end if;
  if p_expected_published is null or p_expected_published <> cur.version then
    raise exception 'Публикуваният модел е сменен от друг – презаредете' using errcode = 'NC409', detail = cur.version::text;
  end if;
  update public.nd_models set status = 'retired', retired_at = now() where id = cur.id;
  return jsonb_build_object('ok', true, 'changed', true, 'building_id', p_building_id, 'model_public', false, 'previous_version', cur.version);
end
$function$;

-- ---------- 6. Публично отваряне: решението е в базата ------------------------
-- Вика се от /api/tools?model=<сграда> със service role при ВСЯКО отваряне. Кодът после издава подписан адрес за 60 секунди.
create function public.nd_model_resolve(p_building_id text, p_what text default 'glb')
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object('path', case when p_what = 'poster' then m.poster_path else m.glb_path end,
                            'version', m.version, 'sha256', m.glb_sha256, 'bytes', m.glb_bytes)
    from public.nd_models m
    join public.nd_projects p on p.id = m.project_id and p.status = 'published'
   where m.building_id = p_building_id and m.status = 'published'
     and (p_what is distinct from 'poster' or m.poster_path is not null)
   limit 1
$function$;

-- За публичната страница на проекта: кои сгради имат публикуван модел. Само изброените полета, без пътища и без отчети.
create function public.nd_public_models(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(jsonb_object_agg(m.building_id, jsonb_build_object(
           'version', m.version, 'bytes', m.glb_bytes, 'fidelity', m.fidelity, 'poster', m.poster_path is not null,
           'units', case when jsonb_typeof(m.stats -> 'units_mapped') = 'number' then m.stats -> 'units_mapped' else '0'::jsonb end,
           'floors', case when jsonb_typeof(m.stats -> 'floors_mapped') = 'number' then m.stats -> 'floors_mapped' else '0'::jsonb end,
           'triangles', case when jsonb_typeof(m.stats -> 'triangles') = 'number' then m.stats -> 'triangles' else null end,
           'published_at', m.published_at)), '{}'::jsonb)
    from public.nd_models m
    join public.nd_projects p on p.id = m.project_id
   where p.slug = p_slug and p.status = 'published' and m.status = 'published'
$function$;

-- ---------- 7. Права за изпълнение --------------------------------------------
revoke all on function public.nd_models_guard()    from public, anon, authenticated;
revoke all on function public.nd_models_job_sync() from public, anon, authenticated;
revoke all on function public.nd_model_register(uuid, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.nd_job_fail_final(uuid, text, text, jsonb)  from public, anon, authenticated;
revoke all on function public.nd_cad_job_touch(uuid, jsonb)               from public, anon, authenticated;
revoke all on function public.nd_model_resolve(text, text)                from public, anon, authenticated;
revoke all on function public.nd_model_publish(uuid, text, integer, boolean) from public, anon;
revoke all on function public.nd_model_unpublish(text, integer)              from public, anon;
revoke all on function public.nd_public_models(text)                         from public;

grant execute on function public.nd_model_register(uuid, text, jsonb, jsonb) to service_role;
grant execute on function public.nd_job_fail_final(uuid, text, text, jsonb)  to service_role;
grant execute on function public.nd_cad_job_touch(uuid, jsonb)               to service_role;
grant execute on function public.nd_model_resolve(text, text)                to service_role;
grant execute on function public.nd_model_publish(uuid, text, integer, boolean) to authenticated;
grant execute on function public.nd_model_unpublish(text, integer)              to authenticated;
grant execute on function public.nd_public_models(text)                         to anon, authenticated;

commit;
