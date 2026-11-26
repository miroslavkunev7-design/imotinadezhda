-- Лимит / изразходвани задачи на агентите в чата на Тед (CRM): „Безплатни агенти“, „Real ChatGPT“, „Агенти n8n“.
-- Една задача = едно изпратено съобщение, на което агентът е отговорил (Real ChatGPT: една отворена заявка).
-- Безплатните се броят на ден (лимитът на Gemini се подновява всеки ден), другите – на календарен месец.
create table if not exists public.nd_agent_limits (
  agent text primary key check (agent in ('free', 'chatgpt', 'n8n')),
  lim int not null default 0,               -- 0 = без лимит
  per text not null default 'month' check (per in ('day', 'month')),
  note text
);
insert into public.nd_agent_limits (agent, lim, per, note) values
  ('free', 500, 'day', 'Gemini Flash Lite безплатно: 500 заявки на ден'),
  ('chatgpt', 0, 'month', 'вашият ChatGPT план – лимитът се следи в самия ChatGPT'),
  ('n8n', 2500, 'month', 'изпълнения в n8n Cloud за месеца според плана')
on conflict (agent) do nothing;

create table if not exists public.nd_agent_usage (
  agent text not null references public.nd_agent_limits (agent),
  period date not null,                     -- ден или първо число на месеца (Europe/Sofia)
  used int not null default 0,
  primary key (agent, period)
);
alter table public.nd_agent_limits enable row level security;
alter table public.nd_agent_usage enable row level security;
drop policy if exists "nd staff read" on public.nd_agent_limits;
create policy "nd staff read" on public.nd_agent_limits for select to authenticated using (nd_is_staff());
drop policy if exists "nd staff read" on public.nd_agent_usage;
create policy "nd staff read" on public.nd_agent_usage for select to authenticated using (nd_is_staff());
grant select on public.nd_agent_limits, public.nd_agent_usage to authenticated;
grant all on public.nd_agent_limits, public.nd_agent_usage to service_role;

create or replace function public.nd_agent_period(p_per text)
returns date language sql stable as $$
  select case when p_per = 'day' then (now() at time zone 'Europe/Sofia')::date
              else date_trunc('month', now() at time zone 'Europe/Sofia')::date end
$$;

-- всички агенти: {free:{limit,used,per}, chatgpt:{…}, n8n:{…}} – само за екипа
create or replace function public.nd_agent_stats()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not nd_is_staff() then '{}'::jsonb else coalesce(jsonb_object_agg(l.agent, jsonb_build_object(
    'limit', l.lim, 'per', l.per,
    'used', coalesce((select u.used from nd_agent_usage u where u.agent = l.agent and u.period = nd_agent_period(l.per)), 0))), '{}'::jsonb) end
  from nd_agent_limits l
$$;

-- +1 задача за агента; връща новото обобщение
create or replace function public.nd_agent_use(p_agent text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_per text;
begin
  if not nd_is_staff() then return '{}'::jsonb; end if;
  select per into v_per from nd_agent_limits where agent = p_agent;
  if v_per is null then return nd_agent_stats(); end if;
  insert into nd_agent_usage (agent, period, used) values (p_agent, nd_agent_period(v_per), 1)
    on conflict (agent, period) do update set used = nd_agent_usage.used + 1;
  return nd_agent_stats();
end $$;

revoke all on function public.nd_agent_stats() from public, anon;
revoke all on function public.nd_agent_use(text) from public, anon;
grant execute on function public.nd_agent_stats() to authenticated;
grant execute on function public.nd_agent_use(text) to authenticated;
