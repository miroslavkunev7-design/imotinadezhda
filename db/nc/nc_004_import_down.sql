-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · ОБРАТЕН скрипт САМО за nc_004 (импорт, TASK-006)
-- Маха само 4-те функции от nc_004_import.sql. Данните (проекти, обекти, задачи) остават непокътнати.
-- След него imports.apply връща „Липсва миграцията за импорт (nc_004)“ (503) и нищо не записва;
-- jobs.status минава на резервния nd_job_claim. Файловете в storage не се пипат.
-- =====================================================================
begin;
drop function if exists public.nd_import_apply(uuid, text, integer, jsonb);
drop function if exists public.nd_import_job_done(uuid, jsonb);
drop function if exists public.nd_import_job_begin(uuid, text);
drop function if exists public.nd_job_claim_id(uuid, text[], text);
commit;
