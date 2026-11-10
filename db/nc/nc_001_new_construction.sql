-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · схема v2 (след независимата проверка)
-- ЧЕРНОВА (TASK-002). НЕ Е ПРИЛАГАНА. Прилага се в TASK-007 след одобрение.
-- Цел: Supabase проект hyvwfsmjbaynozceookv (Postgres 17.6), schema public.
-- Само ДОБАВЯ нови обекти. Не променя nd_properties и никоя съществуваща
-- таблица, функция, policy или trigger. Обратен скрипт: nc_001_down.sql.
-- Използва съществуващите: nd_is_staff(), nd_is_admin(), nd_touch().
--
-- Какво е различно от v1 (номерата са от REVIEW_TASK-002):
--   S1  правата са по КОЛОНИ: служителят изобщо няма право да пише status/version/slug/id-та;
--       пазачът вече не се изключва с настройка, а гледа кой изпълнява (current_user)
--   S2  съставни външни ключове проект ↔ сграда ↔ етаж ↔ обект; преместване е забранено
--   S3  историята на статусите не се трие с обекта (RESTRICT)
--   S4  цена > 0; ръчна цена само с причина; история на площи и цени (nd_unit_changes)
--   S5  смяна на основата на цената преизчислява обектите
--   S6/S7 задачите се създават само през nd_job_create(); няма INSERT за служители
--   S8  производните на плановете са в nd_plan_files (пише само service role), вързани
--       за версията на плана и статуса → остарял или подменен файл не се сервира никога
--   S9  „проверено“ е вързано за съдържанието (content_rev = reviewed_rev)
--   S10/S12 публичната медия е в nd_project_media (пише само админ); навън излизат само изброени полета
--   S11 пътят се проверява по сегменти, не с LIKE
--   S13 create table / create function без „if not exists“ / „or replace“ → при заварен обект спира шумно
--   S14 search_path = '' ; S15 индекс по building_id
-- Предложения, които чакат решение на собственика: матрицата роли → преходи (R3),
-- кой редактира публикуван проект (R2), 3D модел без вътрешни стени (R4).
-- =====================================================================
begin;

-- ---------- 0. Помощни проверки (без достъп до таблици) ----------------
-- В модула НЕ се пази инвеститор / строител / строителна фирма / изпълнител – на никое ниво в JSON.
create function public.nd_nc_clean(j jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  with recursive w(v) as (
    select j
    union all
    select c.value
      from w,
           lateral (
             select e.value from jsonb_each(case when jsonb_typeof(w.v) = 'object' then w.v else '{}'::jsonb end) e
             union all
             select a.value from jsonb_array_elements(case when jsonb_typeof(w.v) = 'array' then w.v else '[]'::jsonb end) a
           ) c
  )
  select not exists (
    select 1
      from w,
           lateral jsonb_object_keys(case when jsonb_typeof(w.v) = 'object' then w.v else '{}'::jsonb end) k
     where k ~* '^(investors?|builders?|contractors?|developers?|construction[_ ]?company)$'
        or k ~ '^([Ии]нвеститор(и)?|[Сс]троител(и)?|[Ии]зпълнител(и)?|[Сс]троителна[_ ]фирма)$')
$function$;

-- Полигоните на етажа: [{unit_code: "A3-02", points: [[x,y],[x,y],[x,y],…]}] и нищо друго.
create function public.nd_nc_polygons_ok(j jsonb)
returns boolean
language plpgsql
immutable
set search_path = ''
as $function$
declare
  e jsonb;
  pt jsonb;
begin
  if j is null then return true; end if;
  if jsonb_typeof(j) <> 'array' or jsonb_array_length(j) > 400 then return false; end if;
  for e in select value from jsonb_array_elements(j) loop
    if jsonb_typeof(e) <> 'object' then return false; end if;
    if (select count(*) from jsonb_object_keys(e) k where k not in ('unit_code', 'points')) > 0 then return false; end if;
    if coalesce(jsonb_typeof(e -> 'unit_code'), '') <> 'string' or length(e ->> 'unit_code') > 20 then return false; end if;
    if coalesce(jsonb_typeof(e -> 'points'), '') <> 'array' then return false; end if;
    if jsonb_array_length(e -> 'points') < 3 or jsonb_array_length(e -> 'points') > 200 then return false; end if;
    for pt in select value from jsonb_array_elements(e -> 'points') loop
      if jsonb_typeof(pt) <> 'array' or jsonb_array_length(pt) <> 2 then return false; end if;
      if jsonb_typeof(pt -> 0) <> 'number' or jsonb_typeof(pt -> 1) <> 'number' then return false; end if;
    end loop;
  end loop;
  return true;
end
$function$;

-- Текст от JSON само ако стойността е низ (вложен обект никога не излиза като текст).
create function public.nd_nc_txt(j jsonb, k text, n integer)
returns text
language sql
immutable
set search_path = ''
as $function$
  select case when jsonb_typeof(j -> k) = 'string' then left(j ->> k, n) end
$function$;

-- Частен път на оригинален план: projects/<същия проект>/private/…
create function public.nd_nc_private_path_ok(p text, project_id text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select p is null or (
        length(p) <= 300
    and split_part(p, '/', 1) = 'projects'
    and split_part(p, '/', 2) = project_id
    and split_part(p, '/', 3) = 'private'
    and split_part(p, '/', 4) in ('plans', 'units', 'cad', 'imports')
    and p !~ '(\.\.|%|\\|//)')
$function$;

-- ---------- 1. Таблици ------------------------------------------------
create table public.nd_projects (
  id                text primary key default replace((gen_random_uuid())::text, '-', ''),
  slug              text unique,
  name              text,
  status            text not null default 'draft'
                    check (status in ('draft', 'published', 'archived')),
  version           integer not null default 1,
  content_rev       integer not null default 1,
  reviewed_rev      integer,
  reviewed_by       uuid,
  reviewed_at       timestamptz,
  status_changed_at timestamptz,
  data              jsonb not null default '{}'::jsonb,
  created_by        uuid default auth.uid(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint nd_projects_id_fmt     check (id ~ '^[a-z0-9]{8,40}$'),
  constraint nd_projects_data_obj   check (jsonb_typeof(data) = 'object'),
  constraint nd_projects_data_clean check (public.nd_nc_clean(data)),
  constraint nd_projects_pub_slug   check (status <> 'published' or slug is not null)
);
comment on table public.nd_projects is
  'Ново строителство: проект. status/slug/version/content_rev/reviewed_* се сменят само през RPC. Без инвеститор/строител/изпълнител.';
comment on column public.nd_projects.content_rev is
  'Расте при всяка промяна на съдържанието (проект, сграда, етаж, обект). Публикува се само когато reviewed_rev = content_rev.';

create table public.nd_buildings (
  id          text primary key default replace((gen_random_uuid())::text, '-', ''),
  project_id  text not null references public.nd_projects(id) on delete cascade,
  name        text,
  sort        integer not null default 0,
  data        jsonb not null default '{}'::jsonb,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, project_id),
  constraint nd_buildings_data_obj   check (jsonb_typeof(data) = 'object'),
  constraint nd_buildings_data_clean check (public.nd_nc_clean(data))
);

create table public.nd_floors (
  id          text primary key default replace((gen_random_uuid())::text, '-', ''),
  project_id  text not null,
  building_id text not null,
  level       integer not null check (level between -5 and 200),
  label       text,
  plan_rev    integer not null default 1,
  data        jsonb not null default '{}'::jsonb,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (building_id, level),
  unique (id, building_id),
  unique (id, project_id),
  foreign key (building_id, project_id) references public.nd_buildings(id, project_id) on delete cascade,
  constraint nd_floors_data_obj   check (jsonb_typeof(data) = 'object'),
  constraint nd_floors_data_clean check (public.nd_nc_clean(data)),
  constraint nd_floors_polygons   check (public.nd_nc_polygons_ok(data -> 'polygons')),
  constraint nd_floors_plan_path  check (public.nd_nc_private_path_ok(data #>> '{plan,private}', project_id))
);
comment on column public.nd_floors.level is '-1 = гараж, 0 = партер, 1..n = етажи';
comment on column public.nd_floors.plan_rev is 'Расте при смяна на оригиналния план или на полигоните. Производната важи само за своя plan_rev.';

create table public.nd_units (
  id                    text primary key default replace((gen_random_uuid())::text, '-', ''),
  project_id            text not null,
  building_id           text not null,
  floor_id              text not null,
  code                  text not null,
  status                text not null default 'free'
                        check (status in ('free', 'reserved', 'sold')),
  version               integer not null default 1,
  plan_rev              integer not null default 1,
  status_changed_at     timestamptz,
  area_total            numeric check (area_total is null or (area_total > 0 and area_total < 100000 and area_total = round(area_total, 2))),
  area_net              numeric check (area_net is null or (area_net > 0 and area_net < 100000 and area_net = round(area_net, 2))),
  terrace_area          numeric check (terrace_area is null or (terrace_area >= 0 and terrace_area < 100000 and terrace_area = round(terrace_area, 2))),
  price_per_m2          numeric check (price_per_m2 is null or (price_per_m2 > 0 and price_per_m2 < 10000000 and price_per_m2 = round(price_per_m2, 2))),
  price_total           numeric check (price_total is null or (price_total > 0 and price_total < 100000000000 and price_total = round(price_total, 2))),
  price_override        boolean not null default false,
  price_override_reason text check (price_override_reason is null or length(price_override_reason) <= 500),
  currency              text not null default 'EUR' check (currency = 'EUR'),
  data                  jsonb not null default '{}'::jsonb,
  created_by            uuid default auth.uid(),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (project_id, code),
  unique (id, project_id),
  foreign key (building_id, project_id) references public.nd_buildings(id, project_id) on delete cascade,
  foreign key (floor_id, building_id)   references public.nd_floors(id, building_id) on delete cascade,
  constraint nd_units_code_fmt      check (code ~ '^[A-Za-zА-Яа-я0-9][A-Za-zА-Яа-я0-9._ -]{0,19}$'
                                           and lower(code) not in ('public', 'private', 'derived', 'plans', 'units', 'cad', 'imports', 'tours')),
  constraint nd_units_net_le_total  check (area_net is null or area_total is null or area_net <= area_total),
  constraint nd_units_override      check (not price_override
                                           or (price_total is not null and length(btrim(coalesce(price_override_reason, ''))) >= 3)),
  constraint nd_units_data_obj      check (jsonb_typeof(data) = 'object'),
  constraint nd_units_data_clean    check (public.nd_nc_clean(data)),
  constraint nd_units_plan_path     check (public.nd_nc_private_path_ok(data #>> '{plan,private}', project_id))
);
comment on column public.nd_units.status is
  'free=Свободен, reserved=Капариран, sold=Продаден (трите статуса от одобрените референции). Сменя се САМО през nd_unit_set_status().';
comment on column public.nd_units.price_total is
  'Изчислява се: площ × цена на м² (закръглено до цяло евро). Ръчна стойност само с price_override + причина.';

-- История на статусите. НЕ се трие заедно с обекта (обект с история се архивира, не се трие).
create table public.nd_unit_events (
  id          bigint generated always as identity primary key,
  unit_id     text not null references public.nd_units(id) on delete restrict,
  event_id    uuid not null unique,
  from_status text check (from_status in ('free', 'reserved', 'sold')),
  to_status   text not null check (to_status in ('free', 'reserved', 'sold')),
  by_user     uuid,
  by_email    text,
  note        text,
  client_id   text,   -- връзка към CRM клиент (nd_clients.id) – по избор; сделките не се променят оттук
  deal_id     text,   -- връзка към CRM сделка (nd_deals.id) – по избор
  at          timestamptz not null default now()
);

-- История на площи и цени (TASK-007, подточка 2).
create table public.nd_unit_changes (
  id         bigint generated always as identity primary key,
  unit_id    text not null references public.nd_units(id) on delete cascade,
  field      text not null,
  old_value  text,
  new_value  text,
  by_user    uuid,
  by_email   text,
  at         timestamptz not null default now()
);

-- Видове задачи: праг за „спрял изпълнител“, брой опити, кой може да ги пуска, бюджет.
-- budget_usd = 0 означава: изпълнителят няма право на платен разход за този вид, докато администратор не зададе сума.
create table public.nd_job_kinds (
  kind         text primary key,
  heavy        boolean not null default false,   -- изисква външен изпълнител (не върви във Vercel функция)
  admin_only   boolean not null default false,
  max_attempts integer not null default 3 check (max_attempts between 1 and 5),
  max_chunks   integer not null default 200 check (max_chunks between 1 and 2000),
  stale_secs   integer not null default 180 check (stale_secs between 60 and 86400),
  budget_usd   numeric not null default 0 check (budget_usd >= 0 and budget_usd <= 100)
);
insert into public.nd_job_kinds (kind, heavy, admin_only, max_attempts, max_chunks, stale_secs) values
  ('import',          false, false, 3, 200, 180),
  ('plan_derivative', false, false, 3, 50,  180),
  ('cad_inspect',     true,  true,  3, 1,   900),
  ('cad_convert',     true,  true,  2, 1,   3600),
  ('tour_render',     true,  true,  2, 1,   7200);

create table public.nd_jobs (
  id               uuid primary key default gen_random_uuid(),
  kind             text not null references public.nd_job_kinds(kind),
  idempotency_key  text not null unique check (length(idempotency_key) between 8 and 200),
  status           text not null default 'queued'
                   check (status in ('queued', 'running', 'review', 'done', 'failed', 'cancelled')),
  project_id       text references public.nd_projects(id) on delete set null,
  input            jsonb not null default '{}'::jsonb,
  progress         jsonb not null default '{}'::jsonb,
  result           jsonb not null default '{}'::jsonb,
  error            text,
  attempts         integer not null default 0,
  max_attempts     integer not null default 3,
  chunks           integer not null default 0,
  crash_count      integer not null default 0,
  next_attempt_at  timestamptz not null default now(),
  locked_by        text,
  locked_at        timestamptz,
  heartbeat_at     timestamptz,
  cancel_requested boolean not null default false,
  actor_kind       text not null default 'user' check (actor_kind in ('user', 'system')),
  actor_user_id    uuid,
  actor_email      text,
  cost_usd         numeric not null default 0 check (cost_usd >= 0),
  budget_usd       numeric not null default 0 check (budget_usd >= 0),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  finished_at      timestamptz,
  constraint nd_jobs_actor check (actor_kind = 'system' or actor_user_id is not null)
);

-- Производни на плановете (с воден знак за свободен, с печат за капариран/продаден, етажен план).
-- Пише САМО изпълнителят (service role). Служител не може да я промени → не може да насочи публиката към оригинал.
-- sig: за обект = '<plan_rev>:<status>'; за етаж = nd_floor_plan_sig(). Сервира се само ред, чийто sig съвпада със сегашния.
create table public.nd_plan_files (
  id         bigint generated always as identity primary key,
  project_id text not null references public.nd_projects(id) on delete cascade,
  unit_id    text,
  floor_id   text,
  kind       text not null check (kind in ('unit_wm', 'unit_stamp', 'floor')),
  sig        text not null check (length(sig) between 3 and 80),
  path       text not null unique,
  mime       text not null check (mime in ('image/jpeg', 'image/png')),
  stamped    boolean not null check (stamped),   -- пикселите са реално обработени; „върнат оригинал“ не може да се запише
  job_id     uuid,
  created_at timestamptz not null default now(),
  foreign key (unit_id, project_id)  references public.nd_units(id, project_id) on delete cascade,
  foreign key (floor_id, project_id) references public.nd_floors(id, project_id) on delete cascade,
  constraint nd_plan_files_target check ((unit_id is not null) <> (floor_id is not null)),
  constraint nd_plan_files_kind   check ((kind = 'floor') = (floor_id is not null)),
  constraint nd_plan_files_path   check (length(path) <= 300
                                         and split_part(path, '/', 1) = 'projects'
                                         and split_part(path, '/', 2) = project_id
                                         and split_part(path, '/', 3) = 'private'
                                         and split_part(path, '/', 4) = 'derived'
                                         and split_part(path, '/', 5) ~ '^[A-Za-z0-9._-]{5,120}\.(jpg|png)$'
                                         and split_part(path, '/', 6) = '')
);
create unique index nd_plan_files_unit_uq  on public.nd_plan_files (unit_id, kind, sig) where unit_id is not null;
create unique index nd_plan_files_floor_uq on public.nd_plan_files (floor_id, sig) where floor_id is not null;

-- Публична медия на проект. Пише само администратор (предложение R2/S12).
--   cover / gallery / file / model → projects/<id>/public/…  (видими през storage, докато проектът е публикуван)
--   tour (панорами на обект)       → projects/<id>/private/tours/… (само през /pano/, със статус при всяко отваряне)
create table public.nd_project_media (
  id          bigint generated always as identity primary key,
  project_id  text not null references public.nd_projects(id) on delete cascade,
  building_id text,
  unit_id     text,
  kind        text not null check (kind in ('cover', 'gallery', 'file', 'model', 'tour')),
  path        text not null unique,
  title       text check (title is null or length(title) <= 120),
  sort        integer not null default 0,
  created_by  uuid default auth.uid(),
  created_at  timestamptz not null default now(),
  foreign key (building_id, project_id) references public.nd_buildings(id, project_id) on delete cascade,
  foreign key (unit_id, project_id)     references public.nd_units(id, project_id) on delete cascade,
  constraint nd_project_media_model check ((kind = 'model') = (building_id is not null)),
  constraint nd_project_media_tour  check ((kind = 'tour') = (unit_id is not null)),
  constraint nd_project_media_path  check (length(path) <= 300
                                           and split_part(path, '/', 1) = 'projects'
                                           and split_part(path, '/', 2) = project_id
                                           and path !~ '(\.\.|%|\\|//)'
                                           and case when kind = 'tour'
                                                    then split_part(path, '/', 3) = 'private' and split_part(path, '/', 4) = 'tours'
                                                    else split_part(path, '/', 3) = 'public' and path !~ '/private/' end)
);
create unique index nd_project_media_cover_uq on public.nd_project_media (project_id) where kind = 'cover';

create index nd_buildings_project_idx     on public.nd_buildings (project_id, sort);
create index nd_floors_project_idx        on public.nd_floors (project_id);
create index nd_units_project_idx         on public.nd_units (project_id, status);
create index nd_units_floor_idx           on public.nd_units (floor_id);
create index nd_units_building_idx        on public.nd_units (building_id);
create index nd_unit_events_unit_idx      on public.nd_unit_events (unit_id, at desc);
create index nd_unit_changes_unit_idx     on public.nd_unit_changes (unit_id, at desc);
create index nd_jobs_queue_idx            on public.nd_jobs (status, next_attempt_at);
create index nd_jobs_project_idx          on public.nd_jobs (project_id, created_at desc);
create index nd_plan_files_project_idx    on public.nd_plan_files (project_id);
create index nd_project_media_project_idx on public.nd_project_media (project_id, kind, sort);
create index nd_project_media_bld_idx     on public.nd_project_media (building_id) where building_id is not null;
create index nd_project_media_unit_idx    on public.nd_project_media (unit_id) where unit_id is not null;

-- ---------- 2. Тригери -------------------------------------------------
create trigger nd_touch before update on public.nd_projects  for each row execute function public.nd_touch();
create trigger nd_touch before update on public.nd_buildings for each row execute function public.nd_touch();
create trigger nd_touch before update on public.nd_floors    for each row execute function public.nd_touch();
create trigger nd_touch before update on public.nd_units     for each row execute function public.nd_touch();
create trigger nd_touch before update on public.nd_jobs      for each row execute function public.nd_touch();

-- Пазач (втора линия след правата по колони).
-- „Пряко“ = заявка от PostgREST под ролята на служителя. RPC-тата (SECURITY DEFINER) и изпълнителят
-- (service_role) не са „пряко“. Няма настройка, с която пазачът да се изключи.
-- Предложение R2: в ПУБЛИКУВАН проект само администратор добавя сгради/етажи/обекти и мени площи, цени,
-- кодове, планове и основата на цената. Описание и останалите полета – всеки служител.
create function public.nd_nc_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  direct boolean := current_user in ('authenticated', 'anon');
  pstatus text;
  locked boolean := false;   -- публикуван проект и не е администратор
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

  -- сграда / етаж / обект: проектът и неговото състояние
  select p.status into pstatus from public.nd_projects p where p.id = new.project_id;
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

create trigger nd_nc_guard before insert or update on public.nd_projects  for each row execute function public.nd_nc_guard();
create trigger nd_nc_guard before insert or update on public.nd_buildings for each row execute function public.nd_nc_guard();
create trigger nd_nc_guard before insert or update on public.nd_floors    for each row execute function public.nd_nc_guard();
create trigger nd_nc_guard before insert or update on public.nd_units     for each row execute function public.nd_nc_guard();

-- Обща цена: изчислява се от данните, не се въвежда на ръка (освен price_override + причина).
-- Основа по проект: data->'price_policy'->>'basis' = 'total' (по подразбиране) | 'net'.
-- При липсваща площ или цена/м² резултатът е NULL – нищо не се измисля.
create function public.nd_units_price()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  basis text;
  base_area numeric;
begin
  if new.price_override then
    return new;
  end if;
  select coalesce(public.nd_nc_txt(p.data -> 'price_policy', 'basis', 10), 'total') into basis
    from public.nd_projects p where p.id = new.project_id;
  base_area := case when basis = 'net' then new.area_net else new.area_total end;
  if base_area is null or new.price_per_m2 is null then
    new.price_total := null;
  else
    new.price_total := round(base_area * new.price_per_m2, 0);
  end if;
  return new;
end
$function$;

create trigger nd_units_price before insert or update on public.nd_units
  for each row execute function public.nd_units_price();

-- Подпис на етажния план: зависи от плана/полигоните и от статуса на всеки обект на етажа.
create function public.nd_floor_plan_sig(p_floor_id text)
returns text
language sql
stable
security definer
set search_path = ''
as $function$
  select f.plan_rev::text || ':' || md5(coalesce((
           select string_agg(u.id || '=' || u.status, ',' order by u.id)
             from public.nd_units u where u.floor_id = f.id), ''))
    from public.nd_floors f
   where f.id = p_floor_id
$function$;

-- Заявка за нова производна – в СЪЩАТА транзакция, в която се е сменил статусът или планът.
create function public.nd_nc_enqueue_plan(p_scope text, p_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  u public.nd_units%rowtype;
  f public.nd_floors%rowtype;
  s text;
begin
  if p_scope = 'unit' then
    select * into u from public.nd_units where id = p_id;
    if not found or (u.data #>> '{plan,private}') is null then return; end if;
    s := u.plan_rev::text || ':' || u.status;
    insert into public.nd_jobs (kind, idempotency_key, project_id, input, actor_kind, actor_user_id, max_attempts)
    values ('plan_derivative', 'pd:u:' || u.id || ':' || s, u.project_id,
            jsonb_build_object('scope', 'unit', 'unit_id', u.id, 'sig', s, 'status', u.status), 'system', auth.uid(), 3)
    on conflict (idempotency_key) do nothing;
  elsif p_scope = 'floor' then
    select * into f from public.nd_floors where id = p_id;
    if not found or (f.data #>> '{plan,private}') is null then return; end if;
    s := public.nd_floor_plan_sig(f.id);
    insert into public.nd_jobs (kind, idempotency_key, project_id, input, actor_kind, actor_user_id, max_attempts)
    values ('plan_derivative', 'pd:f:' || f.id || ':' || s, f.project_id,
            jsonb_build_object('scope', 'floor', 'floor_id', f.id, 'sig', s), 'system', auth.uid(), 3)
    on conflict (idempotency_key) do nothing;
  end if;
end
$function$;

-- След промяна на обект: история на площи/цени, content_rev на проекта, заявки за производни.
create function public.nd_units_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  r record;
begin
  if tg_op = 'DELETE' then
    update public.nd_projects set content_rev = content_rev + 1 where id = old.project_id;
    if found then perform public.nd_nc_enqueue_plan('floor', old.floor_id); end if;
    return null;
  end if;

  if tg_op = 'INSERT' then
    update public.nd_projects set content_rev = content_rev + 1 where id = new.project_id;
    perform public.nd_nc_enqueue_plan('unit', new.id);
    perform public.nd_nc_enqueue_plan('floor', new.floor_id);
    return null;
  end if;

  for r in
    select * from (values
      ('area_total',     old.area_total::text,     new.area_total::text),
      ('area_net',       old.area_net::text,       new.area_net::text),
      ('terrace_area',   old.terrace_area::text,   new.terrace_area::text),
      ('price_per_m2',   old.price_per_m2::text,   new.price_per_m2::text),
      ('price_total',    old.price_total::text,    new.price_total::text),
      ('price_override', old.price_override::text, new.price_override::text),
      ('price_override_reason', old.price_override_reason, new.price_override_reason)
    ) as t(field, o, n)
    where t.o is distinct from t.n
  loop
    insert into public.nd_unit_changes (unit_id, field, old_value, new_value, by_user, by_email)
    values (new.id, r.field, r.o, r.n, auth.uid(), auth.jwt() ->> 'email');
  end loop;

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

create trigger nd_units_after after insert or update or delete on public.nd_units
  for each row execute function public.nd_units_after();

-- След промяна на сграда / етаж: content_rev на проекта; при нов план/полигони – заявка за етажна производна.
create function public.nd_struct_after()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'DELETE' then
    update public.nd_projects set content_rev = content_rev + 1 where id = old.project_id;
    return null;
  end if;
  if tg_op = 'INSERT' or to_jsonb(new) - 'updated_at' - 'plan_rev' is distinct from to_jsonb(old) - 'updated_at' - 'plan_rev' then
    update public.nd_projects set content_rev = content_rev + 1 where id = new.project_id;
  end if;
  if tg_table_name = 'nd_floors' then
    if tg_op = 'INSERT' then
      perform public.nd_nc_enqueue_plan('floor', new.id);
    elsif new.plan_rev <> old.plan_rev then
      perform public.nd_nc_enqueue_plan('floor', new.id);
    end if;
  end if;
  return null;
end
$function$;

create trigger nd_struct_after after insert or update or delete on public.nd_buildings
  for each row execute function public.nd_struct_after();
create trigger nd_struct_after after insert or update or delete on public.nd_floors
  for each row execute function public.nd_struct_after();

-- Смяна на основата на цената (total ↔ net) → обектите без ръчна цена се преизчисляват веднага.
-- Изпълнява се с правата на този, който е сменил основата (пазачът важи и тук).
create function public.nd_projects_after()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if public.nd_nc_txt(new.data -> 'price_policy', 'basis', 10) is distinct from public.nd_nc_txt(old.data -> 'price_policy', 'basis', 10) then
    update public.nd_units set price_per_m2 = price_per_m2
     where project_id = new.id and not price_override;
  end if;
  return null;
end
$function$;

create trigger nd_projects_after after update of data on public.nd_projects
  for each row execute function public.nd_projects_after();

-- ---------- 3. RLS и права по колони -----------------------------------
alter table public.nd_projects      enable row level security;
alter table public.nd_buildings     enable row level security;
alter table public.nd_floors        enable row level security;
alter table public.nd_units         enable row level security;
alter table public.nd_unit_events   enable row level security;
alter table public.nd_unit_changes  enable row level security;
alter table public.nd_job_kinds     enable row level security;
alter table public.nd_jobs          enable row level security;
alter table public.nd_plan_files    enable row level security;
alter table public.nd_project_media enable row level security;

revoke all on public.nd_projects, public.nd_buildings, public.nd_floors, public.nd_units,
              public.nd_unit_events, public.nd_unit_changes, public.nd_job_kinds, public.nd_jobs,
              public.nd_plan_files, public.nd_project_media
  from public, anon, authenticated;

-- четене: целият екип (RLS: nd_is_staff)
grant select on public.nd_projects, public.nd_buildings, public.nd_floors, public.nd_units,
                public.nd_unit_events, public.nd_unit_changes, public.nd_job_kinds, public.nd_jobs,
                public.nd_plan_files, public.nd_project_media
  to authenticated;

-- запис: само изброените колони. НЯМА: id, status, slug, version, content_rev, reviewed_*, plan_rev, връзки след създаване.
grant insert (name, data), update (name, data) on public.nd_projects to authenticated;
grant insert (project_id, name, sort, data), update (name, sort, data) on public.nd_buildings to authenticated;
grant insert (project_id, building_id, level, label, data), update (level, label, data) on public.nd_floors to authenticated;
grant insert (project_id, building_id, floor_id, code, area_total, area_net, terrace_area, price_per_m2, price_total,
              price_override, price_override_reason, data),
      update (code, area_total, area_net, terrace_area, price_per_m2, price_total, price_override, price_override_reason, data)
  on public.nd_units to authenticated;
grant delete on public.nd_projects, public.nd_buildings, public.nd_floors, public.nd_units to authenticated;
grant insert (project_id, building_id, unit_id, kind, path, title, sort), update (title, sort), delete
  on public.nd_project_media to authenticated;
grant update (budget_usd) on public.nd_job_kinds to authenticated;
-- nd_unit_events, nd_unit_changes, nd_jobs, nd_plan_files: без запис за служители (само RPC / service role).

create policy "nc projects staff read"   on public.nd_projects for select to authenticated using ((select public.nd_is_staff()));
create policy "nc projects staff insert" on public.nd_projects for insert to authenticated with check ((select public.nd_is_staff()));
create policy "nc projects staff update" on public.nd_projects for update to authenticated using ((select public.nd_is_staff())) with check ((select public.nd_is_staff()));
create policy "nc projects admin delete" on public.nd_projects for delete to authenticated using ((select public.nd_is_admin()));

create policy "nc buildings staff read"   on public.nd_buildings for select to authenticated using ((select public.nd_is_staff()));
create policy "nc buildings staff insert" on public.nd_buildings for insert to authenticated with check ((select public.nd_is_staff()));
create policy "nc buildings staff update" on public.nd_buildings for update to authenticated using ((select public.nd_is_staff())) with check ((select public.nd_is_staff()));
create policy "nc buildings admin delete" on public.nd_buildings for delete to authenticated using ((select public.nd_is_admin()));

create policy "nc floors staff read"   on public.nd_floors for select to authenticated using ((select public.nd_is_staff()));
create policy "nc floors staff insert" on public.nd_floors for insert to authenticated with check ((select public.nd_is_staff()));
create policy "nc floors staff update" on public.nd_floors for update to authenticated using ((select public.nd_is_staff())) with check ((select public.nd_is_staff()));
create policy "nc floors admin delete" on public.nd_floors for delete to authenticated using ((select public.nd_is_admin()));

create policy "nc units staff read"   on public.nd_units for select to authenticated using ((select public.nd_is_staff()));
create policy "nc units staff insert" on public.nd_units for insert to authenticated with check ((select public.nd_is_staff()));
create policy "nc units staff update" on public.nd_units for update to authenticated using ((select public.nd_is_staff())) with check ((select public.nd_is_staff()));
create policy "nc units admin delete" on public.nd_units for delete to authenticated using ((select public.nd_is_admin()));

create policy "nc unit events staff read"  on public.nd_unit_events  for select to authenticated using ((select public.nd_is_staff()));
create policy "nc unit changes staff read" on public.nd_unit_changes for select to authenticated using ((select public.nd_is_staff()));
create policy "nc jobs staff read"         on public.nd_jobs         for select to authenticated using ((select public.nd_is_staff()));
create policy "nc plan files staff read"   on public.nd_plan_files   for select to authenticated using ((select public.nd_is_staff()));

create policy "nc job kinds staff read"   on public.nd_job_kinds for select to authenticated using ((select public.nd_is_staff()));
create policy "nc job kinds admin update" on public.nd_job_kinds for update to authenticated using ((select public.nd_is_admin())) with check ((select public.nd_is_admin()));

create policy "nc media staff read"   on public.nd_project_media for select to authenticated using ((select public.nd_is_staff()));
create policy "nc media admin insert" on public.nd_project_media for insert to authenticated with check ((select public.nd_is_admin()));
create policy "nc media admin update" on public.nd_project_media for update to authenticated using ((select public.nd_is_admin())) with check ((select public.nd_is_admin()));
create policy "nc media admin delete" on public.nd_project_media for delete to authenticated using ((select public.nd_is_admin()));

-- ---------- 4. RPC: смяна на статус (единствената точка) ---------------
-- Матрицата роли → преходи е ПРЕДЛОЖЕНИЕ (R3) и чака потвърждение:
--   брокер: free→reserved
--   админ:  горното + →sold + всяко връщане назад (задължителна причина)
-- p_event_id е по избор: ако липсва, се извежда от (обект, нов статус, очаквана версия) → повторът е безопасен.
-- Грешки (SQLSTATE → HTTP в /api/tools): 42501→403, P0002→404, NC409→409, 23505→409, 22023→400
-- ВНИМАНИЕ: за конфликт на версии НЕ се ползва 40001 – PostgREST повтаря такива транзакции автоматично и заявката увисва
-- (установено при живата проверка на 10.11.2026). Затова кодът е NC409.
create function public.nd_unit_set_status(
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
  eid := coalesce(p_event_id, md5('nc:' || p_unit_id || ':' || p_to || ':' || p_expected_version::text)::uuid);

  -- повторена заявка със същия event_id: връща същия резултат, не променя нищо
  select * into ev from public.nd_unit_events where event_id = eid;
  if found then
    if ev.unit_id <> p_unit_id or ev.to_status <> p_to then
      raise exception 'event_id вече е използван за друга промяна' using errcode = '23505';
    end if;
    select * into u from public.nd_units where id = p_unit_id;
    return jsonb_build_object('ok', true, 'replayed', true, 'unit_id', u.id, 'code', u.code,
      'status', u.status, 'version', u.version, 'event_id', eid, 'floor_id', u.floor_id);
  end if;

  select * into u from public.nd_units where id = p_unit_id for update;
  if not found then
    raise exception 'Обектът не е намерен' using errcode = 'P0002';
  end if;
  if u.version <> p_expected_version then
    raise exception 'Променен е от друг – презаредете' using errcode = 'NC409', detail = u.version::text;
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

  -- Производните не се „нулират“ на ръка: те важат само за подпис '<plan_rev>:<status>'.
  -- След този UPDATE старата производна вече не съвпада → публиката не получава план (fail-closed),
  -- а тригерът nd_units_after записва заявка за новата в същата транзакция.
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

-- ---------- 5. RPC: проверка, публикуване, архивиране (само админ) -----
-- „Проверено“ важи за конкретно съдържание: всяка следваща промяна вдига content_rev и отметката вече не важи.
create function public.nd_project_mark_reviewed(p_id text, p_expected_content_rev integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  p public.nd_projects%rowtype;
begin
  if not public.nd_is_admin() then
    raise exception 'Само администратор отбелязва проект като проверен' using errcode = '42501';
  end if;
  select * into p from public.nd_projects where id = p_id for update;
  if not found then
    raise exception 'Проектът не е намерен' using errcode = 'P0002';
  end if;
  if p_expected_content_rev is null or p.content_rev <> p_expected_content_rev then
    raise exception 'Съдържанието е променено след прегледа – презаредете' using errcode = 'NC409', detail = p.content_rev::text;
  end if;
  update public.nd_projects
     set reviewed_rev = content_rev, reviewed_by = auth.uid(), reviewed_at = now()
   where id = p.id
   returning * into p;
  return jsonb_build_object('ok', true, 'id', p.id, 'content_rev', p.content_rev, 'reviewed_rev', p.reviewed_rev);
end
$function$;

create function public.nd_project_set_status(
  p_id text,
  p_to text,
  p_expected_version integer,
  p_slug text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  p public.nd_projects%rowtype;
  issues jsonb := '[]'::jsonb;
  n integer;
  new_slug text;
begin
  if not public.nd_is_admin() then
    raise exception 'Само администратор публикува или архивира проект' using errcode = '42501';
  end if;
  if p_to is null or p_to not in ('draft', 'published', 'archived') then
    raise exception 'Невалиден статус' using errcode = '22023';
  end if;
  select * into p from public.nd_projects where id = p_id for update;
  if not found then
    raise exception 'Проектът не е намерен' using errcode = 'P0002';
  end if;
  if p_expected_version is null or p.version <> p_expected_version then
    raise exception 'Променен е от друг – презаредете' using errcode = 'NC409', detail = p.version::text;
  end if;

  new_slug := p.slug;
  if p_to = 'published' then
    -- публикува се само проверена чернова: липсващите данни се връщат като списък, не се измислят
    if coalesce(btrim(public.nd_nc_txt(p.data, 'title', 200)), '') = '' then issues := issues || '["липсва заглавие"]'::jsonb; end if;
    select count(*) into n from public.nd_buildings where project_id = p.id;
    if n = 0 then issues := issues || '["няма сграда"]'::jsonb; end if;
    select count(*) into n from public.nd_units where project_id = p.id;
    if n = 0 then issues := issues || '["няма обекти"]'::jsonb; end if;
    select count(*) into n from public.nd_units where project_id = p.id and (area_total is null or price_total is null);
    if n > 0 then issues := issues || to_jsonb(format('%s обекта без площ или цена', n)); end if;
    if p.reviewed_rev is null or p.reviewed_rev <> p.content_rev then
      issues := issues || '["съдържанието не е отбелязано като проверено (или е променено след прегледа)"]'::jsonb;
    end if;
    if jsonb_array_length(issues) > 0 then
      return jsonb_build_object('ok', false, 'issues', issues);
    end if;
    new_slug := coalesce(nullif(btrim(p_slug), ''), p.slug);
    if new_slug is null or new_slug !~ '^[a-z0-9][a-z0-9-]{2,60}$' then
      raise exception 'Невалиден адрес (slug)' using errcode = '22023';
    end if;
  end if;

  update public.nd_projects
     set status = p_to, slug = new_slug, version = version + 1, status_changed_at = now()
   where id = p.id
   returning * into p;

  return jsonb_build_object('ok', true, 'id', p.id, 'status', p.status, 'slug', p.slug, 'version', p.version);
end
$function$;

-- ---------- 6. Публично четене (само през SECURITY DEFINER) ------------
-- Връща само изброените полета, а вложените стойности – само от очаквания тип.
-- Никога: вътрешни бележки, пътища към планове, история, връзки към клиенти. При sold: без цена.
create function public.nd_public_project(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug,
    'title', public.nd_nc_txt(p.data, 'title', 200),
    'city', public.nd_nc_txt(p.data, 'city', 80),
    'hood', public.nd_nc_txt(p.data, 'hood', 80),
    'address', public.nd_nc_txt(p.data, 'address', 200),
    'description', public.nd_nc_txt(p.data, 'description', 6000),
    'stage', public.nd_nc_txt(p.data, 'stage', 80),
    'expected_completion', public.nd_nc_txt(p.data, 'expected_completion', 40),
    'advantages', coalesce((
      select jsonb_agg(left(v #>> '{}', 200))
        from jsonb_array_elements(case when jsonb_typeof(p.data -> 'advantages') = 'array' then p.data -> 'advantages' else '[]'::jsonb end) v
       where jsonb_typeof(v) = 'string'), '[]'::jsonb),
    'cover', (select m.path from public.nd_project_media m where m.project_id = p.id and m.kind = 'cover' limit 1),
    'gallery', coalesce((select jsonb_agg(m.path order by m.sort, m.id)
                           from public.nd_project_media m where m.project_id = p.id and m.kind = 'gallery'), '[]'::jsonb),
    'files', coalesce((select jsonb_agg(jsonb_build_object('path', m.path, 'title', m.title) order by m.sort, m.id)
                         from public.nd_project_media m where m.project_id = p.id and m.kind = 'file'), '[]'::jsonb),
    'updated_at', p.updated_at,
    'buildings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', left(b.name, 120),
        'model', (select jsonb_agg(m.path order by m.sort, m.id)
                    from public.nd_project_media m where m.building_id = b.id and m.kind = 'model'),
        'floors', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', f.id, 'level', f.level, 'label', left(f.label, 60),
            -- етажният план се сервира от /plan/floor/<id>, само ако производната е за сегашните статуси
            'has_plan', exists (select 1 from public.nd_plan_files pf
                                 where pf.floor_id = f.id and pf.kind = 'floor' and pf.sig = public.nd_floor_plan_sig(f.id)),
            'polygons', coalesce((
              select jsonb_agg(jsonb_build_object('unit_code', e ->> 'unit_code', 'points', e -> 'points'))
                from jsonb_array_elements(coalesce(f.data -> 'polygons', '[]'::jsonb)) e), '[]'::jsonb)
          ) order by f.level desc)
          from public.nd_floors f where f.building_id = b.id), '[]'::jsonb)) order by b.sort, b.name)
      from public.nd_buildings b where b.project_id = p.id), '[]'::jsonb),
    'units', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id, 'code', u.code, 'building_id', u.building_id, 'floor_id', u.floor_id,
        'status', u.status,
        'rooms', case when jsonb_typeof(u.data -> 'rooms') = 'number' then u.data -> 'rooms' end,
        'beds',  case when jsonb_typeof(u.data -> 'beds')  = 'number' then u.data -> 'beds' end,
        'baths', case when jsonb_typeof(u.data -> 'baths') = 'number' then u.data -> 'baths' end,
        'exposure', public.nd_nc_txt(u.data, 'exposure', 60),
        'area_total', u.area_total, 'area_net', u.area_net, 'terrace_area', u.terrace_area,
        'price_per_m2', case when u.status = 'sold' then null else u.price_per_m2 end,
        'price_total',  case when u.status = 'sold' then null else u.price_total end,
        -- планът не се връща като път: /plan/unit/<id> проверява статуса при всяко отваряне
        'has_plan', exists (select 1 from public.nd_plan_files pf
                             where pf.unit_id = u.id
                               and pf.kind = case when u.status = 'free' then 'unit_wm' else 'unit_stamp' end
                               and pf.sig = u.plan_rev::text || ':' || u.status),
        'plan_kind', case when u.status = 'free' then 'plan' else 'stamped' end,
        -- панорамите са само за свободни обекти и се отварят през /pano/<unit_id>/<n>
        'tour_count', case when u.status = 'free'
                           then (select count(*) from public.nd_project_media m where m.unit_id = u.id and m.kind = 'tour')
                           else 0 end
      ) order by u.code)
      from public.nd_units u where u.project_id = p.id), '[]'::jsonb))
  from public.nd_projects p
  where p.slug = p_slug and p.status = 'published'
$function$;

create function public.nd_public_projects()
returns setof jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug,
    'title', public.nd_nc_txt(p.data, 'title', 200), 'city', public.nd_nc_txt(p.data, 'city', 80),
    'hood', public.nd_nc_txt(p.data, 'hood', 80), 'stage', public.nd_nc_txt(p.data, 'stage', 80),
    'cover', (select m.path from public.nd_project_media m where m.project_id = p.id and m.kind = 'cover' limit 1),
    'units_total', (select count(*) from public.nd_units u where u.project_id = p.id),
    'units_free',  (select count(*) from public.nd_units u where u.project_id = p.id and u.status = 'free'),
    'updated_at', p.updated_at)
  from public.nd_projects p
  where p.status = 'published'
  order by p.updated_at desc
  limit 200
$function$;

-- ---------- 7. Планове и панорами: решението е в базата ------------------
-- Вика се от /api/tools?plan=… и ?pano=… със service role при ВСЯКО отваряне.
-- Връща път само ако: проектът е публикуван И има производна точно за сегашния план и статус.
-- Иначе NULL → 404. Кодът после издава подписан линк за 60 секунди и пренасочва към него.
create function public.nd_plan_resolve(p_scope text, p_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select case p_scope
    when 'unit' then (
      select jsonb_build_object('path', pf.path, 'mime', pf.mime, 'kind', pf.kind, 'status', u.status)
        from public.nd_units u
        join public.nd_projects p on p.id = u.project_id and p.status = 'published'
        join public.nd_plan_files pf
          on pf.unit_id = u.id
         and pf.kind = case when u.status = 'free' then 'unit_wm' else 'unit_stamp' end
         and pf.sig = u.plan_rev::text || ':' || u.status
       where u.id = p_id
       order by pf.id desc
       limit 1)
    when 'floor' then (
      select jsonb_build_object('path', pf.path, 'mime', pf.mime, 'kind', pf.kind)
        from public.nd_floors f
        join public.nd_projects p on p.id = f.project_id and p.status = 'published'
        join public.nd_plan_files pf
          on pf.floor_id = f.id and pf.kind = 'floor' and pf.sig = public.nd_floor_plan_sig(f.id)
       where f.id = p_id
       order by pf.id desc
       limit 1)
  end
$function$;

create function public.nd_pano_resolve(p_unit_id text, p_n integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select jsonb_build_object('path', m.path)
    from public.nd_units u
    join public.nd_projects p on p.id = u.project_id and p.status = 'published'
    join public.nd_project_media m on m.unit_id = u.id and m.kind = 'tour'
   where u.id = p_unit_id and u.status = 'free'
   order by m.sort, m.id
   offset greatest(coalesce(p_n, 0), 0)
   limit 1
$function$;

-- ---------- 8. Storage: публични файлове на проект ----------------------
-- Подредба в bucket nd-files (съществуващ, private):
--   projects/<project_id>/private/...  → НИКОГА публично през storage: оригинални планове, импорти, CAD,
--                                        производните (derived/) и панорамите (tours/).
--   projects/<project_id>/public/...   → корица, галерия, брошура, 3D модел; публично САМО ако проектът е
--                                        публикуван И файлът е вписан в nd_project_media (пише само админ).
-- Екипът вече има достъп до целия bucket през съществуващите "nd files staff *" политики.
create function public.nd_is_public_project_file(obj_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select split_part(obj_name, '/', 1) = 'projects'
     and split_part(obj_name, '/', 3) = 'public'
     and obj_name !~ '/private/'
     and exists (
       select 1
         from public.nd_project_media m
         join public.nd_projects p on p.id = m.project_id
        where m.path = obj_name
          and m.kind in ('cover', 'gallery', 'file', 'model')
          and p.status = 'published')
$function$;

create policy "nd public project files" on storage.objects for select to anon, authenticated
  using (bucket_id = 'nd-files'
         and split_part(name, '/', 1) = 'projects'
         and split_part(name, '/', 3) = 'public'
         and public.nd_is_public_project_file(name));

-- ---------- 9. Права за изпълнение -------------------------------------
revoke all on function public.nd_nc_guard()        from public, anon, authenticated;
revoke all on function public.nd_units_price()     from public, anon, authenticated;
revoke all on function public.nd_units_after()     from public, anon, authenticated;
revoke all on function public.nd_struct_after()    from public, anon, authenticated;
revoke all on function public.nd_projects_after()  from public, anon, authenticated;
revoke all on function public.nd_nc_enqueue_plan(text, text) from public, anon, authenticated;
revoke all on function public.nd_floor_plan_sig(text)        from public, anon, authenticated;
revoke all on function public.nd_plan_resolve(text, text)    from public, anon, authenticated;
revoke all on function public.nd_pano_resolve(text, integer) from public, anon, authenticated;
revoke all on function public.nd_unit_set_status(text, text, integer, uuid, text, text, text) from public, anon;
revoke all on function public.nd_project_set_status(text, text, integer, text) from public, anon;
revoke all on function public.nd_project_mark_reviewed(text, integer) from public, anon;

grant execute on function public.nd_unit_set_status(text, text, integer, uuid, text, text, text) to authenticated;
grant execute on function public.nd_project_set_status(text, text, integer, text) to authenticated;
grant execute on function public.nd_project_mark_reviewed(text, integer) to authenticated;
grant execute on function public.nd_floor_plan_sig(text)        to authenticated, service_role;
grant execute on function public.nd_plan_resolve(text, text)    to service_role;
grant execute on function public.nd_pano_resolve(text, integer) to service_role;
grant execute on function public.nd_public_project(text)        to anon, authenticated;
grant execute on function public.nd_public_projects()           to anon, authenticated;
grant execute on function public.nd_is_public_project_file(text) to anon, authenticated;
-- помощните проверки (без достъп до таблици) се викат от ограниченията и от тригерите
grant execute on function public.nd_nc_clean(jsonb), public.nd_nc_polygons_ok(jsonb),
                          public.nd_nc_txt(jsonb, text, integer), public.nd_nc_private_path_ok(text, text)
  to anon, authenticated, service_role;

commit;
