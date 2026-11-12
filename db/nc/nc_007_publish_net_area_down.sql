-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · ОБРАТЕН скрипт САМО за nc_007
-- Връща nd_project_set_status точно както е в nc_001 (публикуване само с обща площ).
-- Вече публикуваните проекти остават публикувани; за сваляне: nd_project_set_status(id,'draft',версия).
-- =====================================================================
begin;
create or replace function public.nd_project_set_status(
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
commit;
