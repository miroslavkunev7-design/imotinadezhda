-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · ОБРАТЕН скрипт САМО за nc_005 (CAD/BIM и 3D модели, TASK-009)
-- Маха само обектите от nc_005_cad_models.sql. Проекти, сгради, обекти и задачи (nd_jobs) остават непокътнати.
-- ВНИМАНИЕ: изтрива редовете в nd_models (кой файл е коя версия и кое е публикувано). Преди изпълнение – export на nd_models.
-- Файловете в storage (projects/…/private/derived/models/…) и оригиналните CAD/BIM файлове НЕ се трият.
-- След него: /model/<сграда> връща 404, models.* връщат „Липсва миграцията nc_005“ (503), cad.inspect продължава да създава задача.
-- Изпълнява се ПРЕДИ nc_004_import_down.sql и nc_001_down.sql (nd_models сочи към nd_jobs и nd_buildings).
-- Без CASCADE: ако нещо друго зависи от тези обекти, скриптът спира цял и не променя нищо.
-- =====================================================================
begin;

drop trigger if exists nd_models_job_sync on public.nd_jobs;
drop function if exists public.nd_public_models(text);
drop function if exists public.nd_model_resolve(text, text);
drop function if exists public.nd_model_unpublish(text, integer);
drop function if exists public.nd_model_publish(uuid, text, integer, boolean);
drop function if exists public.nd_cad_job_touch(uuid, jsonb);
drop function if exists public.nd_job_fail_final(uuid, text, text, jsonb);
drop function if exists public.nd_model_register(uuid, text, jsonb, jsonb);
drop table if exists public.nd_models;
drop function if exists public.nd_models_job_sync();
drop function if exists public.nd_models_guard();

commit;
