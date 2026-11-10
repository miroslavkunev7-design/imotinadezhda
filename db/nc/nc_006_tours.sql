-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · nc_006 – индивидуални интериори, 3D разходка и 360° панорами (TASK-010)
-- Прилага се СЛЕД nc_001 + nc_002 + nc_003 + nc_004 (ползва nd_job_claim_id от nc_004). Не зависи от nc_005 (TASK-009).
-- САМО ДОБАВЯ: 5 таблици, функции, 1 тригер върху nd_units (AFTER UPDATE, само при смяна на plan_rev), 1 вид задача.
-- Не променя нито една съществуваща таблица, колона, политика или функция. Обратно: nc_006_tours_down.sql.
--
--   nd_unit_geometry   – версии на проверената геометрия на апартамента (стаи, стени, отвори, височини, ориентация).
--                        След „проверена“ е НЕИЗМЕНЯЕМА; промяна = нова версия. Старата → superseded, зависимите → stale.
--   nd_style_briefs    – версии на стила (по сграда или по апартамент); неизменяеми.
--   nd_scene_versions  – 3D сцена = архитектура (замразено копие) + материали + мебели + светлина + фон + навигация; неизменяема.
--   nd_pano_sets       – набор 360° панорами (по стаи, с посока и преходи) от сцената или качени реални/дизайнерски.
--   nd_tour_versions   – публикувани версии (история за връщане); една публикувана на апартамент.
-- Всеки запис става САМО през RPC на сървъра (/api/tools → service role, след проверка на ролята и входа);
-- служителите четат под RLS (nd_is_staff). Публиката вижда само nd_public_tour() – за свободен апартамент в публикуван проект.
-- Файловете за публиката са само производни (прекодирани, без EXIF) и минават през съществуващия /pano/<обект>/<n>
-- (nd_pano_resolve + nd_project_media вид tour, TASK-007) – за капариран/продаден няма файл.
-- Конфликт на версии: NC409 (не 40001).
-- =====================================================================
begin;

-- ---------- 0. вид задача за изчистване/рендер – съществува (tour_render, nc_001); нов вид няма ----------

-- ---------- 1. Таблици ----------
create table public.nd_unit_geometry (
  id              text primary key default replace((gen_random_uuid())::text, '-', ''),
  project_id      text not null,
  unit_id         text not null,
  version         integer not null check (version >= 1),
  status          text not null default 'draft' check (status in ('draft', 'verified', 'superseded', 'stale')),
  source          text not null check (source in ('plan_manual', 'ifc', 'dxf', 'task009')),
  source_ref      text check (source_ref is null or length(source_ref) <= 300),
  source_plan_rev integer,
  geometry        jsonb not null,
  sha256          text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  validation      jsonb not null default '{}'::jsonb,
  created_by      uuid,
  created_email   text,
  created_at      timestamptz not null default now(),
  verified_by     uuid,
  verified_email  text,
  verified_at     timestamptz,
  ended_at        timestamptz,
  end_reason      text check (end_reason is null or length(end_reason) <= 300),
  unique (unit_id, version),
  unique (id, unit_id),
  foreign key (unit_id, project_id) references public.nd_units(id, project_id) on delete cascade,
  constraint nd_unit_geometry_obj      check (jsonb_typeof(geometry) = 'object' and geometry ->> 'schema' = 'nd.unit_geometry.v1'
                                              and pg_column_size(geometry) <= 262144),
  constraint nd_unit_geometry_valobj   check (jsonb_typeof(validation) = 'object' and pg_column_size(validation) <= 65536),
  constraint nd_unit_geometry_clean    check (public.nd_nc_clean(geometry) and public.nd_nc_clean(validation)),
  constraint nd_unit_geometry_verified check (status <> 'verified' or (verified_at is not null and verified_by is not null))
);
create unique index nd_unit_geometry_one_verified on public.nd_unit_geometry (unit_id) where status = 'verified';
comment on table public.nd_unit_geometry is
  'TASK-010: проверена геометрия на апартамента (вход за интериора). Неизменяема след проверка; източник и версия се пазят. Когато TASK-009 (nc_005) даде геометрия от IFC/DXF, тя се вписва тук със source=task009 и source_ref=<версия на модела>.';

create table public.nd_style_briefs (
  id            text primary key default replace((gen_random_uuid())::text, '-', ''),
  project_id    text not null references public.nd_projects(id) on delete cascade,
  building_id   text,
  unit_id       text,
  version       integer not null check (version >= 1),
  brief         jsonb not null,
  sha256        text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_by    uuid,
  created_email text,
  created_at    timestamptz not null default now(),
  foreign key (building_id, project_id) references public.nd_buildings(id, project_id) on delete cascade,
  foreign key (unit_id, project_id)     references public.nd_units(id, project_id) on delete cascade,
  constraint nd_style_briefs_scope check (building_id is null or unit_id is null),
  constraint nd_style_briefs_obj   check (jsonb_typeof(brief) = 'object' and brief ->> 'schema' = 'nd.style_brief.v1' and pg_column_size(brief) <= 16384),
  constraint nd_style_briefs_clean check (public.nd_nc_clean(brief))
);
create unique index nd_style_briefs_ver on public.nd_style_briefs (project_id, coalesce(building_id, ''), coalesce(unit_id, ''), version);

create table public.nd_scene_versions (
  id              text primary key default replace((gen_random_uuid())::text, '-', ''),
  project_id      text not null,
  unit_id         text not null,
  version         integer not null check (version >= 1),
  geometry_id     text not null,
  style_id        text references public.nd_style_briefs(id),
  status          text not null check (status in ('draft', 'review', 'approved', 'rejected', 'published', 'superseded', 'stale')),
  scene           jsonb not null,
  sha256          text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  issues          jsonb not null default '[]'::jsonb,
  warnings        jsonb not null default '[]'::jsonb,
  idempotency_key text not null unique check (length(idempotency_key) between 8 and 200),
  created_by      uuid,
  created_email   text,
  created_at      timestamptz not null default now(),
  reviewed_by     uuid,
  reviewed_email  text,
  reviewed_at     timestamptz,
  review_note     text check (review_note is null or length(review_note) <= 1000),
  ended_at        timestamptz,
  end_reason      text check (end_reason is null or length(end_reason) <= 300),
  unique (unit_id, version),
  unique (id, unit_id),
  foreign key (unit_id, project_id) references public.nd_units(id, project_id) on delete cascade,
  foreign key (geometry_id, unit_id) references public.nd_unit_geometry(id, unit_id),
  constraint nd_scene_obj   check (jsonb_typeof(scene) = 'object' and scene ->> 'schema' = 'nd.scene.v1' and pg_column_size(scene) <= 1048576
                                   and scene #>> '{inputs,geometry_sha256}' ~ '^[a-f0-9]{64}$'),
  constraint nd_scene_lists check (jsonb_typeof(issues) = 'array' and jsonb_typeof(warnings) = 'array' and pg_column_size(issues) + pg_column_size(warnings) <= 65536),
  constraint nd_scene_clean check (public.nd_nc_clean(scene))
);

create table public.nd_pano_sets (
  id               text primary key default replace((gen_random_uuid())::text, '-', ''),
  project_id       text not null,
  unit_id          text not null,
  version          integer not null check (version >= 1),
  geometry_id      text not null,
  scene_version_id text,
  source           text not null check (source in ('scene_render', 'photo', 'designer_render')),
  quality          text not null check (quality in ('preview', 'final')),
  status           text not null default 'rendering' check (status in ('rendering', 'review', 'published', 'superseded', 'cancelled', 'failed', 'stale')),
  rooms            jsonb not null,
  items            jsonb not null default '{}'::jsonb,
  edit_version     integer not null default 1,
  job_id           uuid references public.nd_jobs(id) on delete set null,
  idempotency_key  text not null unique check (length(idempotency_key) between 8 and 200),
  issues           jsonb not null default '[]'::jsonb,
  validated_at     timestamptz,
  created_by       uuid,
  created_email    text,
  created_at       timestamptz not null default now(),
  ended_at         timestamptz,
  end_reason       text check (end_reason is null or length(end_reason) <= 300),
  unique (unit_id, version),
  unique (id, unit_id),
  foreign key (unit_id, project_id) references public.nd_units(id, project_id) on delete cascade,
  foreign key (geometry_id, unit_id) references public.nd_unit_geometry(id, unit_id),
  foreign key (scene_version_id, unit_id) references public.nd_scene_versions(id, unit_id),
  constraint nd_pano_sets_scene check (source <> 'scene_render' or scene_version_id is not null),
  constraint nd_pano_sets_rooms check (jsonb_typeof(rooms) = 'array' and jsonb_array_length(rooms) between 1 and 30),
  constraint nd_pano_sets_items check (jsonb_typeof(items) = 'object' and pg_column_size(items) <= 786432 and jsonb_typeof(issues) = 'array'),
  constraint nd_pano_sets_clean check (public.nd_nc_clean(items))
);

create table public.nd_tour_versions (
  id               text primary key default replace((gen_random_uuid())::text, '-', ''),
  project_id       text not null,
  unit_id          text not null,
  version          integer not null check (version >= 1),
  geometry_id      text not null,
  scene_version_id text,
  pano_set_id      text,
  viewer           text not null check (length(viewer) between 1 and 40),
  status           text not null check (status in ('published', 'superseded', 'unpublished', 'stale')),
  created_by       uuid,
  created_email    text,
  created_at       timestamptz not null default now(),
  ended_at         timestamptz,
  end_reason       text check (end_reason is null or length(end_reason) <= 300),
  unique (unit_id, version),
  foreign key (unit_id, project_id) references public.nd_units(id, project_id) on delete cascade,
  foreign key (geometry_id, unit_id) references public.nd_unit_geometry(id, unit_id),
  foreign key (scene_version_id, unit_id) references public.nd_scene_versions(id, unit_id),
  foreign key (pano_set_id, unit_id) references public.nd_pano_sets(id, unit_id),
  constraint nd_tour_versions_any check (scene_version_id is not null or pano_set_id is not null)
);
create unique index nd_tour_versions_one_pub on public.nd_tour_versions (unit_id) where status = 'published';

create index nd_unit_geometry_unit_idx on public.nd_unit_geometry (unit_id, version desc);
create index nd_style_briefs_unit_idx  on public.nd_style_briefs (unit_id) where unit_id is not null;
create index nd_style_briefs_bld_idx   on public.nd_style_briefs (building_id) where building_id is not null;
create index nd_scene_versions_unit_idx on public.nd_scene_versions (unit_id, version desc);
create index nd_scene_versions_geom_idx on public.nd_scene_versions (geometry_id);
create index nd_pano_sets_unit_idx      on public.nd_pano_sets (unit_id, version desc);
create index nd_pano_sets_job_idx       on public.nd_pano_sets (job_id) where job_id is not null;
create index nd_tour_versions_unit_idx  on public.nd_tour_versions (unit_id, version desc);

-- ---------- 2. Неизменяемост (втора линия след правата: никой освен RPC-тата не пише) ----------
create function public.nd_tour_immutable()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if tg_table_name = 'nd_unit_geometry' then
    if (new.id, new.project_id, new.unit_id, new.version, new.source, new.source_ref, new.source_plan_rev, new.geometry, new.sha256, new.created_by, new.created_at)
       is distinct from (old.id, old.project_id, old.unit_id, old.version, old.source, old.source_ref, old.source_plan_rev, old.geometry, old.sha256, old.created_by, old.created_at)
       or (old.status <> 'draft' and new.validation is distinct from old.validation) then
      raise exception 'Геометрията е неизменяема – промяна се прави само като нова версия' using errcode = '42501';
    end if;
    if old.status <> 'draft' and new.status = 'draft' then
      raise exception 'Проверена геометрия не се връща в чернова' using errcode = '42501';
    end if;
    if old.status in ('superseded', 'stale') and new.status is distinct from old.status then
      raise exception 'Заменена/остаряла геометрия не се връща – направете нова версия' using errcode = '42501';
    end if;
  elsif tg_table_name = 'nd_style_briefs' then
    raise exception 'Стилът е неизменяем – промяна се прави само като нова версия' using errcode = '42501';
  elsif tg_table_name = 'nd_scene_versions' then
    if (new.id, new.project_id, new.unit_id, new.version, new.geometry_id, new.style_id, new.scene, new.sha256, new.idempotency_key, new.created_by, new.created_at)
       is distinct from (old.id, old.project_id, old.unit_id, old.version, old.geometry_id, old.style_id, old.scene, old.sha256, old.idempotency_key, old.created_by, old.created_at) then
      raise exception 'Сцената е неизменяема – промяна се прави само като нова версия' using errcode = '42501';
    end if;
  elsif tg_table_name = 'nd_pano_sets' then
    if (new.id, new.project_id, new.unit_id, new.version, new.geometry_id, new.scene_version_id, new.source, new.quality, new.idempotency_key, new.created_by, new.created_at)
       is distinct from (old.id, old.project_id, old.unit_id, old.version, old.geometry_id, old.scene_version_id, old.source, old.quality, old.idempotency_key, old.created_by, old.created_at) then
      raise exception 'Основата на набора панорами е неизменяема' using errcode = '42501';
    end if;
    if old.status in ('published', 'superseded') and (new.items, new.rooms) is distinct from (old.items, old.rooms) then
      raise exception 'Публикуван набор не се редактира – направете нов' using errcode = '42501';
    end if;
  elsif tg_table_name = 'nd_tour_versions' then
    if (new.id, new.project_id, new.unit_id, new.version, new.geometry_id, new.scene_version_id, new.pano_set_id, new.viewer, new.created_by, new.created_at)
       is distinct from (old.id, old.project_id, old.unit_id, old.version, old.geometry_id, old.scene_version_id, old.pano_set_id, old.viewer, old.created_by, old.created_at) then
      raise exception 'Публикуваната версия е неизменяема' using errcode = '42501';
    end if;
  end if;
  return new;
end
$function$;
create trigger nd_tour_immutable before update on public.nd_unit_geometry  for each row execute function public.nd_tour_immutable();
create trigger nd_tour_immutable before update on public.nd_style_briefs   for each row execute function public.nd_tour_immutable();
create trigger nd_tour_immutable before update on public.nd_scene_versions for each row execute function public.nd_tour_immutable();
create trigger nd_tour_immutable before update on public.nd_pano_sets      for each row execute function public.nd_tour_immutable();
create trigger nd_tour_immutable before update on public.nd_tour_versions  for each row execute function public.nd_tour_immutable();

-- ---------- 3. Права: само четене за екипа; запис – само RPC (SECURITY DEFINER), изпълними от service role ----------
alter table public.nd_unit_geometry  enable row level security;
alter table public.nd_style_briefs   enable row level security;
alter table public.nd_scene_versions enable row level security;
alter table public.nd_pano_sets      enable row level security;
alter table public.nd_tour_versions  enable row level security;
revoke all on public.nd_unit_geometry, public.nd_style_briefs, public.nd_scene_versions, public.nd_pano_sets, public.nd_tour_versions from public, anon, authenticated;
grant select on public.nd_unit_geometry, public.nd_style_briefs, public.nd_scene_versions, public.nd_pano_sets, public.nd_tour_versions to authenticated;
create policy "nc geometry staff read" on public.nd_unit_geometry  for select to authenticated using ((select public.nd_is_staff()));
create policy "nc style staff read"    on public.nd_style_briefs   for select to authenticated using ((select public.nd_is_staff()));
create policy "nc scene staff read"    on public.nd_scene_versions for select to authenticated using ((select public.nd_is_staff()));
create policy "nc pano staff read"     on public.nd_pano_sets      for select to authenticated using ((select public.nd_is_staff()));
create policy "nc tour staff read"     on public.nd_tour_versions  for select to authenticated using ((select public.nd_is_staff()));

-- ---------- 4. Помощни: остаряване по верига (геометрия → сцени → панорами → публикувано) ----------
create function public.nd_tour_mark_stale(p_unit_id text, p_geometry_id text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  n_scene integer; n_set integer; n_tour integer; n_media integer := 0;
begin
  update public.nd_scene_versions set status = 'stale', ended_at = now(), end_reason = left(p_reason, 300)
   where unit_id = p_unit_id and geometry_id = p_geometry_id and status in ('draft', 'review', 'approved', 'published');
  get diagnostics n_scene = row_count;
  -- работещите задачи за рендер получават отмяна; чакащите/за преглед се отменят веднага
  update public.nd_jobs j set cancel_requested = true,
         status = case when j.status in ('queued', 'review') then 'cancelled' else j.status end,
         finished_at = case when j.status in ('queued', 'review') then now() else j.finished_at end
    from public.nd_pano_sets s
   where s.job_id = j.id and s.unit_id = p_unit_id and s.geometry_id = p_geometry_id and s.status in ('rendering', 'review')
     and j.status in ('queued', 'running', 'review');
  update public.nd_pano_sets set status = 'stale', ended_at = now(), end_reason = left(p_reason, 300)
   where unit_id = p_unit_id and geometry_id = p_geometry_id and status in ('rendering', 'review', 'published');
  get diagnostics n_set = row_count;
  update public.nd_tour_versions set status = 'stale', ended_at = now(), end_reason = left(p_reason, 300)
   where unit_id = p_unit_id and geometry_id = p_geometry_id and status = 'published';
  get diagnostics n_tour = row_count;
  if n_tour > 0 then
    delete from public.nd_project_media where unit_id = p_unit_id and kind = 'tour';
    get diagnostics n_media = row_count;
  end if;
  return jsonb_build_object('scenes', n_scene, 'sets', n_set, 'tours', n_tour, 'media_removed', n_media);
end
$function$;

-- смяна на плана на обекта → геометрията, въведена по този план, вече не е сигурна (stale) → интериорът и разходката също
create function public.nd_tour_units_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  g record;
begin
  for g in select id from public.nd_unit_geometry
            where unit_id = new.id and status in ('verified', 'draft') and source = 'plan_manual'
              and coalesce(source_plan_rev, 0) < new.plan_rev
  loop
    update public.nd_unit_geometry set status = 'stale', ended_at = now(), end_reason = 'Планът на обекта е сменен (plan_rev ' || new.plan_rev || ')'
     where id = g.id;
    perform public.nd_tour_mark_stale(new.id, g.id, 'Планът на обекта е сменен');
  end loop;
  return null;
end
$function$;
create trigger nd_tour_units_after after update on public.nd_units
  for each row when (new.plan_rev is distinct from old.plan_rev) execute function public.nd_tour_units_after();

-- ---------- 5. RPC за сървъра (service role; актьорът идва от проверения токен на служителя) ----------
create function public.nd_tour_geom_save(
  p_unit_id text, p_geometry jsonb, p_sha text, p_source text, p_source_ref text, p_validation jsonb, p_actor uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.nd_units%rowtype;
  g public.nd_unit_geometry%rowtype;
  v integer;
begin
  select * into u from public.nd_units where id = p_unit_id for update;
  if not found then raise exception 'Обектът не е намерен' using errcode = 'P0002'; end if;
  select * into g from public.nd_unit_geometry
   where unit_id = p_unit_id and sha256 = p_sha and status in ('draft', 'verified') and coalesce(source_plan_rev, 0) = u.plan_rev
   order by version desc limit 1;
  if found then
    return jsonb_build_object('id', g.id, 'version', g.version, 'status', g.status, 'sha256', g.sha256, 'project_id', g.project_id, 'existed', true);
  end if;
  select coalesce(max(version), 0) + 1 into v from public.nd_unit_geometry where unit_id = p_unit_id;
  insert into public.nd_unit_geometry (project_id, unit_id, version, status, source, source_ref, source_plan_rev, geometry, sha256, validation, created_by, created_email)
  values (u.project_id, u.id, v, 'draft', p_source, left(p_source_ref, 300), u.plan_rev, p_geometry, p_sha, coalesce(p_validation, '{}'::jsonb), p_actor, left(p_email, 200))
  returning * into g;
  return jsonb_build_object('id', g.id, 'version', g.version, 'status', g.status, 'sha256', g.sha256, 'project_id', g.project_id, 'existed', false);
end
$function$;

create function public.nd_tour_geom_verify(p_id text, p_expected_sha text, p_actor uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  g public.nd_unit_geometry%rowtype;
  u public.nd_units%rowtype;
  old record;
  st jsonb := '{}'::jsonb;
begin
  select * into g from public.nd_unit_geometry where id = p_id;
  if not found then raise exception 'Геометрията не е намерена' using errcode = 'P0002'; end if;
  select * into u from public.nd_units where id = g.unit_id for update;
  select * into g from public.nd_unit_geometry where id = p_id for update;
  if g.status = 'verified' and g.sha256 = p_expected_sha then
    return jsonb_build_object('id', g.id, 'version', g.version, 'status', g.status, 'replayed', true, 'stale', st);
  end if;
  if g.status <> 'draft' then raise exception 'Само чернова се потвърждава (сега: %)', g.status using errcode = 'NC409'; end if;
  if g.sha256 <> p_expected_sha then raise exception 'Геометрията е различна от прегледаната – презаредете' using errcode = 'NC409'; end if;
  if coalesce(g.source_plan_rev, 0) <> u.plan_rev and g.source = 'plan_manual' then
    raise exception 'Планът на обекта е сменен след въвеждането – въведете геометрията отново' using errcode = 'NC409';
  end if;
  if coalesce((g.validation ->> 'ok')::boolean, false) is not true or coalesce(jsonb_array_length(g.validation -> 'blocked'), 1) <> 0 then
    raise exception 'Геометрията има грешки или липси – не може да се потвърди' using errcode = '22023';
  end if;
  for old in select id from public.nd_unit_geometry where unit_id = g.unit_id and status = 'verified' and id <> g.id loop
    update public.nd_unit_geometry set status = 'superseded', ended_at = now(), end_reason = 'Нова проверена версия ' || g.version where id = old.id;
    st := st || jsonb_build_object(old.id, public.nd_tour_mark_stale(g.unit_id, old.id, 'Нова проверена геометрия (версия ' || g.version || ')'));
  end loop;
  update public.nd_unit_geometry set status = 'verified', verified_by = p_actor, verified_email = left(p_email, 200), verified_at = now()
   where id = g.id returning * into g;
  return jsonb_build_object('id', g.id, 'version', g.version, 'status', g.status, 'replayed', false, 'stale', st);
end
$function$;

create function public.nd_tour_style_save(p_project_id text, p_building_id text, p_unit_id text, p_brief jsonb, p_sha text, p_actor uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  b public.nd_style_briefs%rowtype;
  v integer;
begin
  if not exists (select 1 from public.nd_projects where id = p_project_id) then raise exception 'Проектът не е намерен' using errcode = 'P0002'; end if;
  if p_building_id is not null and not exists (select 1 from public.nd_buildings where id = p_building_id and project_id = p_project_id) then
    raise exception 'Сградата не е от този проект' using errcode = 'P0002'; end if;
  if p_unit_id is not null and not exists (select 1 from public.nd_units where id = p_unit_id and project_id = p_project_id) then
    raise exception 'Обектът не е от този проект' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtext('nd_style:' || p_project_id || ':' || coalesce(p_building_id, '') || ':' || coalesce(p_unit_id, '')));
  select * into b from public.nd_style_briefs
   where project_id = p_project_id and building_id is not distinct from p_building_id and unit_id is not distinct from p_unit_id
   order by version desc limit 1;
  if found and b.sha256 = p_sha then
    return jsonb_build_object('id', b.id, 'version', b.version, 'sha256', b.sha256, 'existed', true);
  end if;
  v := coalesce(b.version, 0) + 1;
  insert into public.nd_style_briefs (project_id, building_id, unit_id, version, brief, sha256, created_by, created_email)
  values (p_project_id, p_building_id, p_unit_id, v, p_brief, p_sha, p_actor, left(p_email, 200)) returning * into b;
  return jsonb_build_object('id', b.id, 'version', b.version, 'sha256', b.sha256, 'existed', false);
end
$function$;

create function public.nd_tour_scene_save(
  p_unit_id text, p_geometry_id text, p_style_id text, p_scene jsonb, p_sha text, p_status text, p_issues jsonb, p_warnings jsonb,
  p_idem text, p_actor uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.nd_units%rowtype;
  g public.nd_unit_geometry%rowtype;
  s public.nd_scene_versions%rowtype;
  b public.nd_style_briefs%rowtype;
  v integer;
begin
  select * into s from public.nd_scene_versions where idempotency_key = p_idem;
  if found then
    if s.unit_id <> p_unit_id then raise exception 'Ключът вече е използван за друга сцена' using errcode = '23505'; end if;
    return jsonb_build_object('id', s.id, 'version', s.version, 'status', s.status, 'sha256', s.sha256, 'replayed', true);
  end if;
  select * into u from public.nd_units where id = p_unit_id for update;
  if not found then raise exception 'Обектът не е намерен' using errcode = 'P0002'; end if;
  select * into g from public.nd_unit_geometry where id = p_geometry_id and unit_id = p_unit_id;
  if not found then raise exception 'Геометрията не е намерена' using errcode = 'P0002'; end if;
  if g.status <> 'verified' then raise exception 'Геометрията вече не е актуална (%) – сцената не се записва', g.status using errcode = 'NC409'; end if;
  if p_scene #>> '{inputs,geometry_sha256}' is distinct from g.sha256 then
    raise exception 'Сцената не е построена от тази геометрия' using errcode = 'NC409'; end if;
  if p_style_id is not null then
    select * into b from public.nd_style_briefs where id = p_style_id;
    if not found or b.project_id <> u.project_id or (b.unit_id is not null and b.unit_id <> u.id) or (b.building_id is not null and b.building_id <> u.building_id) then
      raise exception 'Стилът не е за този апартамент, сградата му или проекта' using errcode = '22023'; end if;
    if p_scene #>> '{inputs,style_sha256}' is distinct from b.sha256 then raise exception 'Сцената не е построена от този стил' using errcode = 'NC409'; end if;
  end if;
  if p_status not in ('draft', 'review') then raise exception 'Нова сцена е чернова или за преглед' using errcode = '22023'; end if;
  if p_status = 'review' and coalesce(jsonb_array_length(p_issues), 0) > 0 then raise exception 'Сцена с проблеми не отива за преглед' using errcode = '22023'; end if;
  select coalesce(max(version), 0) + 1 into v from public.nd_scene_versions where unit_id = p_unit_id;
  insert into public.nd_scene_versions (project_id, unit_id, version, geometry_id, style_id, status, scene, sha256, issues, warnings, idempotency_key, created_by, created_email)
  values (u.project_id, u.id, v, g.id, p_style_id, p_status, p_scene, p_sha, coalesce(p_issues, '[]'::jsonb), coalesce(p_warnings, '[]'::jsonb), p_idem, p_actor, left(p_email, 200))
  returning * into s;
  return jsonb_build_object('id', s.id, 'version', s.version, 'status', s.status, 'sha256', s.sha256, 'replayed', false);
end
$function$;

create function public.nd_tour_scene_status(p_id text, p_to text, p_issues jsonb, p_note text, p_actor uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s public.nd_scene_versions%rowtype;
  g public.nd_unit_geometry%rowtype;
begin
  select * into s from public.nd_scene_versions where id = p_id for update;
  if not found then raise exception 'Сцената не е намерена' using errcode = 'P0002'; end if;
  if s.status in ('stale', 'superseded') then raise exception 'Сцената е остаряла (%) – подгответе нова', s.status using errcode = 'NC409'; end if;
  select * into g from public.nd_unit_geometry where id = s.geometry_id;
  if g.status <> 'verified' then raise exception 'Геометрията на сцената вече не е актуална' using errcode = 'NC409'; end if;
  if p_to = s.status and p_to in ('review', 'approved') then return jsonb_build_object('id', s.id, 'status', s.status, 'replayed', true); end if;
  if p_to = 'review' then
    if s.status not in ('draft', 'review', 'approved') then raise exception 'Недопустим преход % → %', s.status, p_to using errcode = 'NC409'; end if;
    if coalesce(jsonb_array_length(p_issues), 0) > 0 then
      update public.nd_scene_versions set issues = p_issues, status = 'draft' where id = s.id returning * into s;
      return jsonb_build_object('id', s.id, 'status', s.status, 'issues', s.issues, 'replayed', false);
    end if;
    update public.nd_scene_versions set status = 'review', issues = '[]'::jsonb where id = s.id returning * into s;
  elsif p_to = 'approved' then
    if s.status <> 'review' then raise exception 'Одобрява се само сцена за преглед (сега: %)', s.status using errcode = 'NC409'; end if;
    update public.nd_scene_versions set status = 'approved', reviewed_by = p_actor, reviewed_email = left(p_email, 200), reviewed_at = now(), review_note = left(p_note, 1000)
     where id = s.id returning * into s;
  elsif p_to = 'rejected' then
    if s.status not in ('draft', 'review', 'approved') then raise exception 'Недопустим преход % → %', s.status, p_to using errcode = 'NC409'; end if;
    update public.nd_scene_versions set status = 'rejected', reviewed_by = p_actor, reviewed_email = left(p_email, 200), reviewed_at = now(), review_note = left(p_note, 1000)
     where id = s.id returning * into s;
  else
    raise exception 'Непознат статус' using errcode = '22023';
  end if;
  return jsonb_build_object('id', s.id, 'status', s.status, 'issues', s.issues, 'replayed', false);
end
$function$;

create function public.nd_tour_set_create(
  p_unit_id text, p_geometry_id text, p_scene_id text, p_source text, p_quality text, p_rooms jsonb, p_items jsonb,
  p_job_id uuid, p_idem text, p_actor uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.nd_units%rowtype;
  g public.nd_unit_geometry%rowtype;
  sc public.nd_scene_versions%rowtype;
  s public.nd_pano_sets%rowtype;
  v integer;
  cancelled jsonb;
begin
  select * into s from public.nd_pano_sets where idempotency_key = p_idem;
  if found then
    if s.unit_id <> p_unit_id then raise exception 'Ключът вече е използван за друг набор' using errcode = '23505'; end if;
    return jsonb_build_object('id', s.id, 'version', s.version, 'status', s.status, 'job_id', s.job_id, 'replayed', true, 'cancelled', '[]'::jsonb);
  end if;
  select * into u from public.nd_units where id = p_unit_id for update;
  if not found then raise exception 'Обектът не е намерен' using errcode = 'P0002'; end if;
  select * into g from public.nd_unit_geometry where id = p_geometry_id and unit_id = p_unit_id;
  if not found or g.status <> 'verified' then raise exception 'Няма актуална проверена геометрия' using errcode = 'NC409'; end if;
  if p_scene_id is not null then
    select * into sc from public.nd_scene_versions where id = p_scene_id and unit_id = p_unit_id;
    if not found then raise exception 'Сцената не е намерена' using errcode = 'P0002'; end if;
    if sc.geometry_id <> g.id then raise exception 'Сцената е за друга версия на геометрията' using errcode = 'NC409'; end if;
    if sc.status not in ('review', 'approved', 'published') then raise exception 'Сцената не е готова за рендер (%)', sc.status using errcode = 'NC409'; end if;
    if p_quality = 'final' and sc.status not in ('approved', 'published') then raise exception 'Окончателен рендер – само от одобрена сцена' using errcode = 'NC409'; end if;
  end if;
  if p_source = 'scene_render' and p_scene_id is null then raise exception 'Рендер от сцена изисква сцена' using errcode = '22023'; end if;
  -- по-старите незавършени заявки за същия апартамент се отменят (остарял отговор от тях се отказва)
  with c as (
    update public.nd_pano_sets set status = 'cancelled', ended_at = now(), end_reason = 'Заменен от по-нова заявка'
     where unit_id = p_unit_id and status = 'rendering' returning id, job_id)
  select coalesce(jsonb_agg(c.id), '[]'::jsonb) into cancelled from c;
  update public.nd_jobs j set cancel_requested = true,
         status = case when j.status in ('queued', 'review') then 'cancelled' else j.status end,
         finished_at = case when j.status in ('queued', 'review') then now() else j.finished_at end
   where j.id in (select x.job_id from public.nd_pano_sets x where x.id in (select jsonb_array_elements_text(cancelled)) and x.job_id is not null)
     and j.status in ('queued', 'running', 'review');
  select coalesce(max(version), 0) + 1 into v from public.nd_pano_sets where unit_id = p_unit_id;
  insert into public.nd_pano_sets (project_id, unit_id, version, geometry_id, scene_version_id, source, quality, status, rooms, items, job_id, idempotency_key, created_by, created_email)
  values (u.project_id, u.id, v, g.id, p_scene_id, p_source, p_quality, 'rendering', p_rooms, coalesce(p_items, '{}'::jsonb), p_job_id, p_idem, p_actor, left(p_email, 200))
  returning * into s;
  return jsonb_build_object('id', s.id, 'version', s.version, 'status', s.status, 'job_id', s.job_id, 'replayed', false, 'cancelled', cancelled);
end
$function$;

-- един файл (стая) готов: само за текущия набор, текущата задача и по-нова ревизия → иначе остарял отговор (NC409)
create function public.nd_tour_set_put(p_set_id text, p_job_id uuid, p_room_id text, p_rev integer, p_item jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s public.nd_pano_sets%rowtype;
  cur jsonb;
  ready integer;
  total integer;
  prev text;
begin
  select * into s from public.nd_pano_sets where id = p_set_id for update;
  if not found then raise exception 'Наборът не е намерен' using errcode = 'P0002'; end if;
  if s.status <> 'rendering' then raise exception 'Остарял отговор: наборът е %', s.status using errcode = 'NC409'; end if;
  if s.job_id is distinct from p_job_id then raise exception 'Остарял отговор: друга задача' using errcode = 'NC409'; end if;
  if not (s.rooms ? p_room_id) then raise exception 'Помещението не е в набора' using errcode = '22023'; end if;
  if p_item is null or jsonb_typeof(p_item) <> 'object' or pg_column_size(p_item) > 65536 then raise exception 'Невалиден запис' using errcode = '22023'; end if;
  cur := s.items -> p_room_id;
  if cur is not null and coalesce((cur ->> 'rev')::integer, 0) >= p_rev then
    raise exception 'Остарял отговор: вече има по-нов файл за %', p_room_id using errcode = 'NC409';
  end if;
  prev := case when cur is not null then cur ->> 'path' end;
  -- посоката/преходите, зададени от човек, остават
  p_item := (coalesce(cur, '{}'::jsonb) - 'status' - 'error_code' - 'message') || p_item
            || case when cur ? 'edited' then jsonb_build_object('yaw_offset', cur -> 'yaw_offset', 'hotspots', cur -> 'hotspots', 'start_yaw', cur -> 'start_yaw', 'edited', true) else '{}'::jsonb end
            || jsonb_build_object('rev', p_rev);
  update public.nd_pano_sets set items = items || jsonb_build_object(p_room_id, p_item), validated_at = null where id = s.id returning * into s;
  select count(*) into ready from jsonb_array_elements_text(s.rooms) r where s.items -> r ->> 'status' = 'ready';
  total := jsonb_array_length(s.rooms);
  return jsonb_build_object('ready', ready, 'total', total, 'all_ready', ready = total, 'prev_path', prev, 'status', s.status);
end
$function$;

create function public.nd_tour_set_finish(p_set_id text, p_to text, p_issues jsonb, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s public.nd_pano_sets%rowtype;
begin
  select * into s from public.nd_pano_sets where id = p_set_id for update;
  if not found then raise exception 'Наборът не е намерен' using errcode = 'P0002'; end if;
  if p_to = 'review' then
    if s.status not in ('rendering', 'review') then raise exception 'Наборът не е в работа (%)', s.status using errcode = 'NC409'; end if;
    if exists (select 1 from jsonb_array_elements_text(s.rooms) r where coalesce(s.items -> r ->> 'status', '') <> 'ready') then
      raise exception 'Не всички помещения имат проверен файл' using errcode = '22023'; end if;
    if coalesce(jsonb_array_length(p_issues), 0) > 0 then
      update public.nd_pano_sets set issues = p_issues, validated_at = null where id = s.id returning * into s;
    else
      update public.nd_pano_sets set status = 'review', issues = '[]'::jsonb, validated_at = now() where id = s.id returning * into s;
    end if;
  elsif p_to in ('failed', 'cancelled') then
    if s.status not in ('rendering', 'review') then return jsonb_build_object('id', s.id, 'status', s.status, 'changed', false); end if;
    update public.nd_pano_sets set status = p_to, ended_at = now(), end_reason = left(p_reason, 300), issues = coalesce(p_issues, issues) where id = s.id returning * into s;
  else
    raise exception 'Непознат статус' using errcode = '22023';
  end if;
  return jsonb_build_object('id', s.id, 'status', s.status, 'validated', s.validated_at is not null, 'issues', s.issues, 'changed', true);
end
$function$;

-- подредба (n на /pano/) и посока/преходи, зададени от човек; версия на редакцията → NC409
create function public.nd_tour_set_edit(p_set_id text, p_expected integer, p_order jsonb, p_items jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  s public.nd_pano_sets%rowtype;
  k text;
  it jsonb;
begin
  select * into s from public.nd_pano_sets where id = p_set_id for update;
  if not found then raise exception 'Наборът не е намерен' using errcode = 'P0002'; end if;
  if s.status not in ('rendering', 'review') then raise exception 'Наборът не се редактира (%)', s.status using errcode = 'NC409'; end if;
  if s.edit_version <> p_expected then raise exception 'Наборът е променен от друг – презаредете' using errcode = 'NC409', detail = s.edit_version::text; end if;
  if p_order is not null then
    if jsonb_typeof(p_order) <> 'array' or jsonb_array_length(p_order) <> jsonb_array_length(s.rooms)
       or exists (select 1 from jsonb_array_elements_text(p_order) r where not (s.rooms ? r))
       or (select count(distinct r) from jsonb_array_elements_text(p_order) r) <> jsonb_array_length(s.rooms) then
      raise exception 'Подредбата трябва да съдържа точно помещенията от набора' using errcode = '22023'; end if;
    s.rooms := p_order;
  end if;
  for k, it in select key, value from jsonb_each(coalesce(p_items, '{}'::jsonb)) loop
    if not (s.rooms ? k) then raise exception 'Помещението % не е в набора', k using errcode = '22023'; end if;
    s.items := s.items || jsonb_build_object(k, coalesce(s.items -> k, '{}'::jsonb) || (it - 'path' - 'src_path' - 'sha256' - 'status' - 'rev' - 'thumb') || jsonb_build_object('edited', true));
  end loop;
  update public.nd_pano_sets set rooms = s.rooms, items = s.items, edit_version = edit_version + 1, validated_at = null,
         status = case when status = 'review' then 'review' else status end
   where id = s.id returning * into s;
  return jsonb_build_object('id', s.id, 'edit_version', s.edit_version, 'status', s.status);
end
$function$;

-- публикуване (и връщане към по-стара версия): атомарно, с NC409 при чужда промяна; файловете към публиката – в nd_project_media (вид tour)
create function public.nd_tour_publish(p_unit_id text, p_set_id text, p_scene_id text, p_expected integer, p_viewer text, p_actor uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.nd_units%rowtype;
  g public.nd_unit_geometry%rowtype;
  s public.nd_pano_sets%rowtype;
  sc public.nd_scene_versions%rowtype;
  cur public.nd_tour_versions%rowtype;
  t public.nd_tour_versions%rowtype;
  curv integer := 0;
  v integer;
  r text;
  n integer := 0;
begin
  select * into u from public.nd_units where id = p_unit_id for update;
  if not found then raise exception 'Обектът не е намерен' using errcode = 'P0002'; end if;
  select * into cur from public.nd_tour_versions where unit_id = u.id and status = 'published';
  if found then curv := cur.version; end if;
  if coalesce(p_expected, -1) <> curv then raise exception 'Публикуваното е променено от друг – презаредете' using errcode = 'NC409', detail = curv::text; end if;
  if p_set_id is null and p_scene_id is null then raise exception 'Няма какво да се публикува' using errcode = '22023'; end if;
  select * into g from public.nd_unit_geometry where unit_id = u.id and status = 'verified';
  if not found then raise exception 'Няма актуална проверена геометрия' using errcode = 'NC409'; end if;
  if p_set_id is not null then
    select * into s from public.nd_pano_sets where id = p_set_id and unit_id = u.id for update;
    if not found then raise exception 'Наборът не е намерен' using errcode = 'P0002'; end if;
    if s.geometry_id <> g.id then raise exception 'Наборът е за стара геометрия' using errcode = 'NC409'; end if;
    if s.status not in ('review', 'published', 'superseded') or s.validated_at is null then raise exception 'Наборът не е проверен (%)', s.status using errcode = 'NC409'; end if;
    if exists (select 1 from jsonb_array_elements_text(s.rooms) x where coalesce(s.items -> x ->> 'status', '') <> 'ready' or coalesce(s.items -> x ->> 'path', '') = '') then
      raise exception 'Не всички панорами са готови' using errcode = '22023'; end if;
  end if;
  if p_scene_id is not null then
    select * into sc from public.nd_scene_versions where id = p_scene_id and unit_id = u.id for update;
    if not found then raise exception 'Сцената не е намерена' using errcode = 'P0002'; end if;
    if sc.geometry_id <> g.id then raise exception 'Сцената е за стара геометрия' using errcode = 'NC409'; end if;
    if sc.status not in ('approved', 'published', 'superseded') or sc.reviewed_at is null then raise exception 'Сцената не е одобрена (%)', sc.status using errcode = 'NC409'; end if;
  end if;
  if p_set_id is not null and p_scene_id is not null and s.scene_version_id is not null and s.scene_version_id <> sc.id then
    raise exception 'Панорамите са рендерирани от друга сцена' using errcode = '22023'; end if;
  -- старото публикувано → история (не се трие)
  if cur.id is not null then
    update public.nd_tour_versions set status = 'superseded', ended_at = now(), end_reason = 'Заменена от нова публикация' where id = cur.id;
  end if;
  update public.nd_pano_sets set status = 'superseded', ended_at = now(), end_reason = 'Заменен от нова публикация'
   where unit_id = u.id and status = 'published' and id is distinct from p_set_id;
  update public.nd_scene_versions set status = 'superseded', ended_at = now(), end_reason = 'Заменена от нова публикация'
   where unit_id = u.id and status = 'published' and id is distinct from p_scene_id;
  if p_set_id is not null then
    update public.nd_pano_sets set status = 'published', ended_at = null, end_reason = null where id = s.id returning * into s;
    update public.nd_jobs set status = 'done', finished_at = now() where id = s.job_id and status = 'review';
  end if;
  if p_scene_id is not null then
    update public.nd_scene_versions set status = 'published', ended_at = null, end_reason = null where id = sc.id;
  end if;
  select coalesce(max(version), 0) + 1 into v from public.nd_tour_versions where unit_id = u.id;
  insert into public.nd_tour_versions (project_id, unit_id, version, geometry_id, scene_version_id, pano_set_id, viewer, status, created_by, created_email)
  values (u.project_id, u.id, v, g.id, p_scene_id, p_set_id, left(coalesce(p_viewer, 'nc-tour@1'), 40), 'published', p_actor, left(p_email, 200))
  returning * into t;
  -- публичните файлове: само производните на този набор, по реда на стаите (n на /pano/<обект>/<n>)
  delete from public.nd_project_media where unit_id = u.id and kind = 'tour';
  if p_set_id is not null then
    for r in select value from jsonb_array_elements_text(s.rooms) loop
      insert into public.nd_project_media (project_id, unit_id, kind, path, title, sort, created_by)
      values (u.project_id, u.id, 'tour', s.items -> r ->> 'path', left(coalesce(s.items -> r ->> 'name', r), 120), n, p_actor);
      n := n + 1;
    end loop;
  end if;
  return jsonb_build_object('tour_version_id', t.id, 'version', t.version, 'previous', curv, 'media', n, 'pano_set_id', p_set_id, 'scene_version_id', p_scene_id);
end
$function$;

create function public.nd_tour_unpublish(p_unit_id text, p_expected integer, p_reason text, p_actor uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.nd_units%rowtype;
  cur public.nd_tour_versions%rowtype;
  n integer;
begin
  select * into u from public.nd_units where id = p_unit_id for update;
  if not found then raise exception 'Обектът не е намерен' using errcode = 'P0002'; end if;
  select * into cur from public.nd_tour_versions where unit_id = u.id and status = 'published';
  if not found then
    if coalesce(p_expected, 0) = 0 then return jsonb_build_object('changed', false, 'version', 0); end if;
    raise exception 'Няма публикувана разходка' using errcode = 'NC409';
  end if;
  if cur.version <> p_expected then raise exception 'Публикуваното е променено от друг – презаредете' using errcode = 'NC409', detail = cur.version::text; end if;
  update public.nd_tour_versions set status = 'unpublished', ended_at = now(), end_reason = left(coalesce(p_reason, 'Свалена от сайта'), 300) where id = cur.id;
  update public.nd_pano_sets set status = 'superseded', ended_at = now(), end_reason = 'Свалена от сайта' where id = cur.pano_set_id and status = 'published';
  update public.nd_scene_versions set status = 'superseded', ended_at = now(), end_reason = 'Свалена от сайта' where id = cur.scene_version_id and status = 'published';
  delete from public.nd_project_media where unit_id = u.id and kind = 'tour';
  get diagnostics n = row_count;
  return jsonb_build_object('changed', true, 'version', cur.version, 'media_removed', n);
end
$function$;

-- ---------- 6. Четене за екипа (authenticated + nd_is_staff) ----------
create function public.nd_tour_state(p_unit_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  u public.nd_units%rowtype;
begin
  if not public.nd_is_staff() then raise exception 'Няма достъп' using errcode = '42501'; end if;
  select * into u from public.nd_units where id = p_unit_id;
  if not found then raise exception 'Обектът не е намерен' using errcode = 'P0002'; end if;
  return jsonb_build_object(
    'unit', jsonb_build_object('id', u.id, 'code', u.code, 'project_id', u.project_id, 'building_id', u.building_id, 'floor_id', u.floor_id, 'status', u.status, 'plan_rev', u.plan_rev,
      'area_total', u.area_total, 'area_net', u.area_net, 'terrace_area', u.terrace_area, 'rooms', u.data -> 'rooms', 'exposure', public.nd_nc_txt(u.data, 'exposure', 60),
      'interior_style', public.nd_nc_txt(u.data, 'interior_style', 80),
      'project_status', (select p.status from public.nd_projects p where p.id = u.project_id)),
    'geometry', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'version', g.version, 'status', g.status, 'source', g.source, 'source_ref', g.source_ref, 'source_plan_rev', g.source_plan_rev,
        'sha256', g.sha256, 'validation', g.validation, 'created_email', g.created_email, 'created_at', g.created_at, 'verified_email', g.verified_email, 'verified_at', g.verified_at,
        'end_reason', g.end_reason, 'geometry', case when g.status in ('draft', 'verified') then g.geometry end) order by g.version desc)
      from public.nd_unit_geometry g where g.unit_id = u.id), '[]'::jsonb),
    'styles', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'scope', case when b.unit_id is not null then 'unit' when b.building_id is not null then 'building' else 'project' end,
        'version', b.version, 'brief', b.brief, 'sha256', b.sha256, 'created_at', b.created_at) order by (b.unit_id is not null) desc, (b.building_id is not null) desc, b.version desc)
      from public.nd_style_briefs b where b.project_id = u.project_id and (b.unit_id = u.id or b.building_id = u.building_id or (b.unit_id is null and b.building_id is null))), '[]'::jsonb),
    'scenes', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'version', s.version, 'status', s.status, 'geometry_id', s.geometry_id, 'style_id', s.style_id, 'sha256', s.sha256,
        'issues', s.issues, 'warnings', s.warnings, 'stats', s.scene -> 'stats', 'style_name', s.scene #>> '{materials,style_name}', 'created_email', s.created_email, 'created_at', s.created_at,
        'reviewed_email', s.reviewed_email, 'reviewed_at', s.reviewed_at, 'end_reason', s.end_reason) order by s.version desc)
      from public.nd_scene_versions s where s.unit_id = u.id), '[]'::jsonb),
    'sets', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'version', x.version, 'status', x.status, 'source', x.source, 'quality', x.quality, 'geometry_id', x.geometry_id,
        'scene_version_id', x.scene_version_id, 'rooms', x.rooms, 'edit_version', x.edit_version, 'job_id', x.job_id, 'issues', x.issues, 'validated_at', x.validated_at,
        'created_email', x.created_email, 'created_at', x.created_at, 'end_reason', x.end_reason,
        'job', (select jsonb_build_object('status', j.status, 'progress', j.progress, 'cancel_requested', j.cancel_requested, 'attempts', j.attempts, 'error', left(j.error, 300)) from public.nd_jobs j where j.id = x.job_id),
        'items', coalesce((select jsonb_object_agg(e.key, e.value - 'path' - 'src_path') from jsonb_each(x.items) e), '{}'::jsonb)) order by x.version desc)
      from public.nd_pano_sets x where x.unit_id = u.id), '[]'::jsonb),
    'tours', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'version', t.version, 'status', t.status, 'geometry_id', t.geometry_id, 'scene_version_id', t.scene_version_id,
        'pano_set_id', t.pano_set_id, 'viewer', t.viewer, 'created_email', t.created_email, 'created_at', t.created_at, 'ended_at', t.ended_at, 'end_reason', t.end_reason) order by t.version desc)
      from public.nd_tour_versions t where t.unit_id = u.id), '[]'::jsonb),
    'media_count', (select count(*) from public.nd_project_media m where m.unit_id = u.id and m.kind = 'tour'));
end
$function$;

create function public.nd_tour_scene_get(p_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  s public.nd_scene_versions%rowtype;
begin
  if not public.nd_is_staff() then raise exception 'Няма достъп' using errcode = '42501'; end if;
  select * into s from public.nd_scene_versions where id = p_id;
  if not found then raise exception 'Сцената не е намерена' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', s.id, 'unit_id', s.unit_id, 'version', s.version, 'status', s.status, 'geometry_id', s.geometry_id, 'style_id', s.style_id,
    'sha256', s.sha256, 'issues', s.issues, 'warnings', s.warnings, 'scene', s.scene);
end
$function$;

-- пътищата към частните файлове – за подпис (екипът ги вижда и без това през правата на хранилището) и за чистене (service role)
create function public.nd_tour_paths(p_set_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  s public.nd_pano_sets%rowtype;
begin
  if coalesce(current_setting('role', true), '') <> 'service_role' and coalesce(auth.jwt() ->> 'role', '') <> 'service_role' and not public.nd_is_staff() then
    raise exception 'Няма достъп' using errcode = '42501'; end if;
  select * into s from public.nd_pano_sets where id = p_set_id;
  if not found then raise exception 'Наборът не е намерен' using errcode = 'P0002'; end if;
  return jsonb_build_object('id', s.id, 'unit_id', s.unit_id, 'project_id', s.project_id, 'status', s.status, 'source', s.source, 'published_media', (select count(*) from public.nd_project_media m where m.unit_id = s.unit_id and m.kind = 'tour' and m.path in (select e.value ->> 'path' from jsonb_each(s.items) e)),
    'items', coalesce((select jsonb_object_agg(e.key, jsonb_build_object('path', e.value ->> 'path', 'src_path', e.value ->> 'src_path')) from jsonb_each(s.items) e), '{}'::jsonb));
end
$function$;

-- ---------- 7. Публично четене: само свободен обект в публикуван проект с публикувана разходка ----------
-- Капариран/продаден → само { locked:true, status } – без мини-карта, без стаи, без сцена, без миниатюри (червеният печат е в интерфейса).
create function public.nd_public_tour(p_unit_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case
    when u.status <> 'free' then jsonb_build_object('unit_id', u.id, 'code', u.code, 'locked', true, 'status', u.status)
    when t.id is null then jsonb_build_object('unit_id', u.id, 'code', u.code, 'locked', false, 'status', u.status, 'tour', null)
    else jsonb_build_object(
      'unit_id', u.id, 'code', u.code, 'locked', false, 'status', u.status,
      'tour', jsonb_build_object(
        'version', t.version, 'published_at', t.created_at, 'viewer', t.viewer,
        'source', s.source, 'quality', s.quality,
        'label', case s.source when 'photo' then 'Реална снимка 360°.' when 'designer_render' then 'Визуализация 360° от дизайнер – примерно обзавеждане.' else 'Рендер 360° от 3D сцената – примерно обзавеждане.' end,
        'north_deg', g.geometry -> 'north_deg',
        'rooms', coalesce((
          select jsonb_agg(jsonb_build_object(
            'n', m.n, 'room_id', it.key, 'name', left(coalesce(it.value ->> 'name', it.key), 60), 'type', it.value ->> 'type',
            'thumb', case when length(it.value ->> 'thumb') <= 60000 and (it.value ->> 'thumb') like 'data:image/jpeg;base64,%' then it.value ->> 'thumb' end,
            'yaw_offset', it.value -> 'yaw_offset', 'start_yaw', it.value -> 'start_yaw', 'node', it.value -> 'node',
            'hotspots', coalesce(it.value -> 'hotspots', '[]'::jsonb), 'w', it.value -> 'w', 'h', it.value -> 'h') order by m.n)
            from (select mm.path, (row_number() over (order by mm.sort, mm.id) - 1)::integer as n from public.nd_project_media mm where mm.unit_id = u.id and mm.kind = 'tour') m
            join lateral (select e.key, e.value from jsonb_each(s.items) e where e.value ->> 'path' = m.path) it on true), '[]'::jsonb),
        'scene', case when sc.id is not null then (sc.scene - 'inputs') || jsonb_build_object('version', sc.version) end,
        'minimap', jsonb_build_object('north_deg', g.geometry -> 'north_deg', 'rooms', coalesce((
            select jsonb_agg(jsonb_build_object('id', r ->> 'id', 'name', left(coalesce(r ->> 'name', r ->> 'id'), 60), 'type', r ->> 'type', 'polygon', r -> 'polygon'))
              from jsonb_array_elements(g.geometry -> 'rooms') r), '[]'::jsonb))))
  end
  from public.nd_units u
  join public.nd_projects p on p.id = u.project_id and p.status = 'published'
  left join public.nd_tour_versions t on t.unit_id = u.id and t.status = 'published'
  left join public.nd_unit_geometry g on g.id = t.geometry_id
  left join public.nd_pano_sets s on s.id = t.pano_set_id
  left join public.nd_scene_versions sc on sc.id = t.scene_version_id
  where u.id = p_unit_id
$function$;

-- ---------- 8. Права за изпълнение ----------
revoke all on function public.nd_tour_immutable() from public, anon, authenticated;
revoke all on function public.nd_tour_mark_stale(text, text, text) from public, anon, authenticated;
revoke all on function public.nd_tour_units_after() from public, anon, authenticated;
revoke all on function public.nd_tour_geom_save(text, jsonb, text, text, text, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function public.nd_tour_geom_verify(text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.nd_tour_style_save(text, text, text, jsonb, text, uuid, text) from public, anon, authenticated;
revoke all on function public.nd_tour_scene_save(text, text, text, jsonb, text, text, jsonb, jsonb, text, uuid, text) from public, anon, authenticated;
revoke all on function public.nd_tour_scene_status(text, text, jsonb, text, uuid, text) from public, anon, authenticated;
revoke all on function public.nd_tour_set_create(text, text, text, text, text, jsonb, jsonb, uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.nd_tour_set_put(text, uuid, text, integer, jsonb) from public, anon, authenticated;
revoke all on function public.nd_tour_set_finish(text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.nd_tour_set_edit(text, integer, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.nd_tour_publish(text, text, text, integer, text, uuid, text) from public, anon, authenticated;
revoke all on function public.nd_tour_unpublish(text, integer, text, uuid) from public, anon, authenticated;
revoke all on function public.nd_tour_state(text) from public, anon;
revoke all on function public.nd_tour_scene_get(text) from public, anon;
revoke all on function public.nd_tour_paths(text) from public, anon;
revoke all on function public.nd_public_tour(text) from public;

grant execute on function public.nd_tour_mark_stale(text, text, text) to service_role;
grant execute on function public.nd_tour_geom_save(text, jsonb, text, text, text, jsonb, uuid, text) to service_role;
grant execute on function public.nd_tour_geom_verify(text, text, uuid, text) to service_role;
grant execute on function public.nd_tour_style_save(text, text, text, jsonb, text, uuid, text) to service_role;
grant execute on function public.nd_tour_scene_save(text, text, text, jsonb, text, text, jsonb, jsonb, text, uuid, text) to service_role;
grant execute on function public.nd_tour_scene_status(text, text, jsonb, text, uuid, text) to service_role;
grant execute on function public.nd_tour_set_create(text, text, text, text, text, jsonb, jsonb, uuid, text, uuid, text) to service_role;
grant execute on function public.nd_tour_set_put(text, uuid, text, integer, jsonb) to service_role;
grant execute on function public.nd_tour_set_finish(text, text, jsonb, text) to service_role;
grant execute on function public.nd_tour_set_edit(text, integer, jsonb, jsonb) to service_role;
grant execute on function public.nd_tour_publish(text, text, text, integer, text, uuid, text) to service_role;
grant execute on function public.nd_tour_unpublish(text, integer, text, uuid) to service_role;
grant execute on function public.nd_tour_state(text) to authenticated, service_role;
grant execute on function public.nd_tour_scene_get(text) to authenticated, service_role;
grant execute on function public.nd_tour_paths(text) to authenticated, service_role;
grant execute on function public.nd_public_tour(text) to anon, authenticated, service_role;

commit;
