-- =====================================================================
-- ИМОТИ НАДЕЖДА · Ново строителство · задачи (jobs) v2 – създаване и RPC за изпълнителя
-- ЧЕРНОВА (TASK-002). НЕ Е ПРИЛАГАНА. Прилага се в TASK-006/007 след одобрение (след nc_001).
-- Служител създава задача САМО през nd_job_create() (S7). Изпълнителят (worker) работи със
-- service role. Разлики от v1: J1 – „спрелите“ се връщат само за видовете на този изпълнител,
-- с праг по вид; J2 – nd_job_yield() пуска задачата след парче, без да харчи опит;
-- J3 – спирането на изпълнител се брои отделно (crash_count), не като опит.
-- =====================================================================
begin;

-- Създаване от екипа. Статусът, опитите, резултатът и бюджетът НЕ идват от клиента.
-- Тежките видове (CAD, 3D, обиколка) – само администратор. Повтор със същия ключ връща същата задача.
create function public.nd_job_create(
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
  if k.admin_only and not public.nd_is_admin() then
    raise exception 'Този вид задача се пуска само от администратор' using errcode = '42501';
  end if;
  if p_key is null or p_key !~ '^[A-Za-z0-9:._-]{8,200}$' or p_key like 'pd:%' then
    raise exception 'Невалиден ключ за повторяемост' using errcode = '22023';
  end if;
  if p_input is null or jsonb_typeof(p_input) <> 'object' or pg_column_size(p_input) > 65536
     or not public.nd_nc_clean(p_input) then
    raise exception 'Невалидни входни данни' using errcode = '22023';
  end if;
  if p_project_id is not null and not exists (select 1 from public.nd_projects where id = p_project_id) then
    raise exception 'Проектът не е намерен' using errcode = 'P0002';
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

-- Взима една чакаща задача. SKIP LOCKED: двама изпълнители не взимат една и съща.
-- Задача със спрял пулс се връща в опашката – само ако е от видовете на ТОЗИ изпълнител
-- и е минал прагът за нейния вид. Третото спиране я приключва като неуспешна.
create function public.nd_job_claim(
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
     set status = case when x.crash_count + 1 >= 3 then 'failed' else 'queued' end,
         error = case when x.crash_count + 1 >= 3 then 'Изпълнителят спря 3 пъти' else x.error end,
         finished_at = case when x.crash_count + 1 >= 3 then now() else null end,
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

-- Пулс + напредък. Връща true, ако е поискана отмяна или задачата вече не е на този изпълнител (спри и изчисти).
create function public.nd_job_heartbeat(
  p_id uuid,
  p_worker text,
  p_progress jsonb default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  c boolean;
begin
  update public.nd_jobs
     set heartbeat_at = now(),
         progress = coalesce(p_progress, progress)
   where id = p_id and status = 'running' and locked_by = left(p_worker, 120)
   returning cancel_requested into c;
  if not found then
    return true;
  end if;
  return c;
end
$function$;

-- Край на едно парче: задачата се връща в опашката веднага и БЕЗ разход на опит (J2).
-- Така дълга работа върви на парчета, които се побират във времето на една функция.
create function public.nd_job_yield(
  p_id uuid,
  p_worker text,
  p_progress jsonb default null
)
returns public.nd_jobs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  j public.nd_jobs%rowtype;
  lim integer;
begin
  select * into j from public.nd_jobs where id = p_id for update;
  if not found or j.status <> 'running' or j.locked_by is distinct from left(p_worker, 120) then
    raise exception 'Задачата не е заключена от този изпълнител' using errcode = '42501';
  end if;
  select max_chunks into lim from public.nd_job_kinds where kind = j.kind;
  if j.cancel_requested then
    update public.nd_jobs
       set status = 'cancelled', locked_by = null, locked_at = null, heartbeat_at = null, finished_at = now(),
           progress = coalesce(p_progress, progress)
     where id = p_id returning * into j;
  elsif j.chunks + 1 > coalesce(lim, 200) then
    update public.nd_jobs
       set status = 'failed', error = 'Твърде много парчета', locked_by = null, locked_at = null,
           heartbeat_at = null, finished_at = now(), progress = coalesce(p_progress, progress)
     where id = p_id returning * into j;
  else
    update public.nd_jobs
       set status = 'queued', attempts = greatest(attempts - 1, 0), chunks = chunks + 1,
           next_attempt_at = now(), locked_by = null, locked_at = null, heartbeat_at = null,
           progress = coalesce(p_progress, progress)
     where id = p_id returning * into j;
  end if;
  return j;
end
$function$;

-- Край: done | review (чака човешка проверка) | failed | cancelled.
-- При failed с оставащи опити задачата се връща в опашката с нарастващо изчакване.
-- Разход над бюджета на задачата я приключва като неуспешна (без нов опит).
create function public.nd_job_finish(
  p_id uuid,
  p_worker text,
  p_status text,
  p_result jsonb default null,
  p_error text default null,
  p_cost_usd numeric default 0
)
returns public.nd_jobs
language plpgsql
security definer
set search_path = ''
as $function$
declare
  j public.nd_jobs%rowtype;
  cost numeric;
begin
  if p_status not in ('done', 'review', 'failed', 'cancelled') then
    raise exception 'Невалиден краен статус' using errcode = '22023';
  end if;
  if coalesce(p_cost_usd, 0) < 0 then
    raise exception 'Невалиден разход' using errcode = '22023';
  end if;
  select * into j from public.nd_jobs where id = p_id for update;
  if not found or j.status <> 'running' or j.locked_by is distinct from left(p_worker, 120) then
    raise exception 'Задачата не е заключена от този изпълнител' using errcode = '42501';
  end if;
  cost := j.cost_usd + coalesce(p_cost_usd, 0);

  if cost > j.budget_usd then
    update public.nd_jobs
       set status = 'failed', error = 'Надхвърлен бюджет за задачата', cost_usd = cost,
           locked_by = null, locked_at = null, heartbeat_at = null, finished_at = now()
     where id = p_id returning * into j;
  elsif p_status = 'failed' and j.attempts < j.max_attempts and not j.cancel_requested then
    update public.nd_jobs
       set status = 'queued', error = left(p_error, 2000), locked_by = null, locked_at = null, heartbeat_at = null,
           next_attempt_at = now() + make_interval(secs => least(900, 30 * power(2, j.attempts)::integer)),
           cost_usd = cost
     where id = p_id returning * into j;
  else
    update public.nd_jobs
       set status = case when j.cancel_requested and p_status <> 'done' then 'cancelled' else p_status end,
           result = coalesce(p_result, result), error = left(p_error, 2000),
           locked_by = null, locked_at = null, heartbeat_at = null, finished_at = now(),
           cost_usd = cost
     where id = p_id returning * into j;
  end if;
  return j;
end
$function$;

-- Отмяна от екипа: чакаща задача се отменя веднага; работеща получава флаг и спира при следващия пулс.
create function public.nd_job_cancel(p_id uuid)
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
  if j.actor_user_id is distinct from auth.uid() and not public.nd_is_admin() then
    raise exception 'Само авторът или администратор отменя задача' using errcode = '42501';
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

revoke all on function public.nd_job_create(text, text, text, jsonb) from public, anon;
revoke all on function public.nd_job_claim(text[], text) from public, anon, authenticated;
revoke all on function public.nd_job_heartbeat(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.nd_job_yield(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.nd_job_finish(uuid, text, text, jsonb, text, numeric) from public, anon, authenticated;
revoke all on function public.nd_job_cancel(uuid) from public, anon;
grant execute on function public.nd_job_create(text, text, text, jsonb) to authenticated;
grant execute on function public.nd_job_claim(text[], text) to service_role;
grant execute on function public.nd_job_heartbeat(uuid, text, jsonb) to service_role;
grant execute on function public.nd_job_yield(uuid, text, jsonb) to service_role;
grant execute on function public.nd_job_finish(uuid, text, text, jsonb, text, numeric) to service_role;
grant execute on function public.nd_job_cancel(uuid) to authenticated;

commit;
