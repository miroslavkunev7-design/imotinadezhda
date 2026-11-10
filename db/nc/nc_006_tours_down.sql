-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · ОБРАТЕН скрипт САМО за nc_006 (интериори, 3D разходка, 360°, TASK-010)
-- Маха само обектите от nc_006_tours.sql: тригера върху nd_units, функциите и 5-те таблици.
-- ВНИМАНИЕ: таблиците се трият заедно с данните им (геометрии, стилове, сцени, набори, история на публикуванията).
-- Преди сваляне в живата база: първо ВРЪЩАНЕ (rollback) без триене – tour.unpublish за всеки апартамент или
-- публикуване на предишна версия; този скрипт е последната стъпка. Файловете в storage (private/tours/…) не се пипат.
-- Редовете в nd_project_media (вид tour), записани от tour.publish, остават – махат се с tour.unpublish преди скрипта
-- (иначе /pano/ продължава да отваря последните публикувани панорами, както при ръчно зададена медия от TASK-007).
-- =====================================================================
begin;
drop trigger if exists nd_tour_units_after on public.nd_units;
drop function if exists public.nd_public_tour(text);
drop function if exists public.nd_tour_paths(text);
drop function if exists public.nd_tour_scene_get(text);
drop function if exists public.nd_tour_state(text);
drop function if exists public.nd_tour_unpublish(text, integer, text, uuid);
drop function if exists public.nd_tour_publish(text, text, text, integer, text, uuid, text);
drop function if exists public.nd_tour_set_edit(text, integer, jsonb, jsonb);
drop function if exists public.nd_tour_set_finish(text, text, jsonb, text);
drop function if exists public.nd_tour_set_put(text, uuid, text, integer, jsonb);
drop function if exists public.nd_tour_set_create(text, text, text, text, text, jsonb, jsonb, uuid, text, uuid, text);
drop function if exists public.nd_tour_scene_status(text, text, jsonb, text, uuid, text);
drop function if exists public.nd_tour_scene_save(text, text, text, jsonb, text, text, jsonb, jsonb, text, uuid, text);
drop function if exists public.nd_tour_style_save(text, text, text, jsonb, text, uuid, text);
drop function if exists public.nd_tour_geom_verify(text, text, uuid, text);
drop function if exists public.nd_tour_geom_save(text, jsonb, text, text, text, jsonb, uuid, text);
drop table if exists public.nd_tour_versions;
drop table if exists public.nd_pano_sets;
drop table if exists public.nd_scene_versions;
drop table if exists public.nd_style_briefs;
drop table if exists public.nd_unit_geometry;
drop function if exists public.nd_tour_units_after();
drop function if exists public.nd_tour_mark_stale(text, text, text);
drop function if exists public.nd_tour_immutable();
commit;
