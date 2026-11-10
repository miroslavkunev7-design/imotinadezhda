-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · ОБРАТЕН скрипт към nc_001 + nc_002 + nc_003 + nc_004
-- ЧЕРНОВА. Премахва САМО обектите, добавени от nc_001_new_construction.sql, nc_002_jobs_rpc.sql, nc_003_hardening.sql и nc_004_import.sql.
-- ВНИМАНИЕ: изтрива данните в новите таблици. Преди изпълнение – export.
-- Файловете в storage (projects/…) не се трият от този скрипт.
-- Без CASCADE: ако нещо друго зависи от тези обекти, скриптът спира цял и не променя нищо.
-- =====================================================================
begin;

drop policy if exists "nd public project files" on storage.objects;

-- обектите от nc_004 (импорт, TASK-006) – ако ги няма, „if exists“ ги прескача
drop function if exists public.nd_import_apply(uuid, text, integer, jsonb);
drop function if exists public.nd_import_job_done(uuid, jsonb);
drop function if exists public.nd_import_job_begin(uuid, text);
drop function if exists public.nd_job_claim_id(uuid, text[], text);

-- обектите от nc_003 (втвърдяване)
drop policy if exists "nd nc no staff write insert" on storage.objects;
drop policy if exists "nd nc no staff write update" on storage.objects;
drop policy if exists "nd nc no staff write delete" on storage.objects;
drop function if exists public.nd_nc_storage_write_ok(text, text);
drop trigger if exists nd_plan_files_check on public.nd_plan_files;
drop function if exists public.nd_plan_files_check();
drop function if exists public.nd_floor_plan_input(text);

-- функциите от nc_002 (връщат типа nd_jobs → махат се преди таблицата)
drop function if exists public.nd_job_cancel(uuid);
drop function if exists public.nd_job_finish(uuid, text, text, jsonb, text, numeric);
drop function if exists public.nd_job_yield(uuid, text, jsonb);
drop function if exists public.nd_job_heartbeat(uuid, text, jsonb);
drop function if exists public.nd_job_claim(text[], text);
drop function if exists public.nd_job_create(text, text, text, jsonb);

drop function if exists public.nd_is_public_project_file(text);
drop function if exists public.nd_pano_resolve(text, integer);
drop function if exists public.nd_plan_resolve(text, text);
drop function if exists public.nd_public_projects();
drop function if exists public.nd_public_project(text);
drop function if exists public.nd_project_set_status(text, text, integer, text);
drop function if exists public.nd_project_mark_reviewed(text, integer);
drop function if exists public.nd_unit_set_status(text, text, integer, uuid, text, text, text);

drop table if exists public.nd_project_media;
drop table if exists public.nd_plan_files;
drop table if exists public.nd_jobs;
drop table if exists public.nd_job_kinds;
drop table if exists public.nd_unit_changes;
drop table if exists public.nd_unit_events;
drop table if exists public.nd_units;
drop table if exists public.nd_floors;
drop table if exists public.nd_buildings;
drop table if exists public.nd_projects;

drop function if exists public.nd_projects_after();
drop function if exists public.nd_struct_after();
drop function if exists public.nd_units_after();
drop function if exists public.nd_nc_enqueue_plan(text, text);
drop function if exists public.nd_floor_plan_sig(text);
drop function if exists public.nd_units_price();
drop function if exists public.nd_nc_guard();
drop function if exists public.nd_nc_private_path_ok(text, text);
drop function if exists public.nd_nc_txt(jsonb, text, integer);
drop function if exists public.nd_nc_polygons_ok(jsonb);
drop function if exists public.nd_nc_clean(jsonb);

commit;
