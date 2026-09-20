-- ============================================================
-- Автоматизация №10: Управление на Сделки
-- Пайплайн от заявка до нотариус: етапи, задачи, рискове, комисиони.
-- Безопасна миграция: само IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ---------- Етапи на пайплайна ----------
create table if not exists public.deal_stages (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  position int not null default 100,
  probability int not null default 50,          -- % шанс за приключване
  target_days int not null default 7,           -- нормален престой в етапа
  required_docs text[] not null default '{}',   -- кодове от document_requirements
  task_templates jsonb not null default '[]'::jsonb, -- [{"title":"…","days":2}]
  is_final boolean not null default false,
  is_won boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Сделки ----------
create table if not exists public.deals (
  id uuid primary key default gen_random_uuid(),
  deal_number text unique,
  title text not null,
  deal_type text not null default 'sale',        -- sale | rent
  client_id uuid references public.clients(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  owner_id uuid references public.owners(id) on delete set null,
  broker_id uuid references public.brokers(id) on delete set null,
  stage_code text not null default 'reserved',
  status text not null default 'active',         -- active | won | lost | paused
  price numeric(14,2),
  agreed_price numeric(14,2),
  currency text not null default 'EUR',
  deposit_amount numeric(14,2),
  deposit_paid_at date,
  commission_percent numeric(5,2) default 3,
  commission_amount numeric(14,2),
  commission_paid boolean not null default false,
  mortgage_needed boolean not null default false,
  mortgage_bank text,
  mortgage_approved_at date,
  preliminary_contract_at date,
  notary_id text,
  notary_name text,
  notary_office text,
  notary_at timestamptz,
  notary_confirmed boolean not null default false,
  deed_number text,
  closed_at timestamptz,
  lost_reason text,
  probability int not null default 50,
  expected_close_at date,
  risk_level text not null default 'low',        -- low | medium | high
  risk_note text,
  ai_summary text,
  ai_next_step text,
  ai_updated_at timestamptz,
  stage_entered_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists deals_stage_idx on public.deals (stage_code);
create index if not exists deals_status_idx on public.deals (status);
create index if not exists deals_client_idx on public.deals (client_id);
create index if not exists deals_property_idx on public.deals (property_id);
create index if not exists deals_notary_idx on public.deals (notary_at);

-- ---------- Задачи по сделката ----------
create table if not exists public.deal_tasks (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  stage_code text,
  title text not null,
  description text,
  status text not null default 'open',           -- open | done | skipped
  due_at timestamptz,
  done_at timestamptz,
  assigned_to uuid references auth.users(id) on delete set null,
  auto_generated boolean not null default false,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists deal_tasks_deal_idx on public.deal_tasks (deal_id);
create index if not exists deal_tasks_status_idx on public.deal_tasks (status);

-- ---------- История / одит ----------
create table if not exists public.deal_events (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid references public.deals(id) on delete cascade,
  action text not null,
  from_stage text,
  to_stage text,
  status text not null default 'ok',
  message text,
  meta jsonb,
  duration_ms int,
  actor text not null default 'automation',
  created_at timestamptz not null default now()
);

create index if not exists deal_events_deal_idx on public.deal_events (deal_id, created_at desc);

-- ---------- Брояч на номера ----------
create table if not exists public.deal_counters (
  year int primary key,
  last_value int not null default 0
);

create or replace function public.next_deal_number(_prefix text default 'СД')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  y int := extract(year from now());
  v int;
begin
  insert into public.deal_counters (year, last_value) values (y, 1)
  on conflict (year) do update set last_value = public.deal_counters.last_value + 1
  returning last_value into v;
  return _prefix || '-' || y::text || '-' || lpad(v::text, 4, '0');
end $$;

-- ---------- Права ----------
grant select, insert, update, delete on public.deal_stages to authenticated;
grant select, insert, update, delete on public.deals to authenticated;
grant select, insert, update, delete on public.deal_tasks to authenticated;
grant select, insert on public.deal_events to authenticated;
grant select on public.deal_counters to authenticated;
grant all on public.deal_stages to service_role;
grant all on public.deals to service_role;
grant all on public.deal_tasks to service_role;
grant all on public.deal_events to service_role;
grant all on public.deal_counters to service_role;

alter table public.deal_stages enable row level security;
alter table public.deals enable row level security;
alter table public.deal_tasks enable row level security;
alter table public.deal_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'deal_stages' and policyname = 'crm manages deal stages') then
    create policy "crm manages deal stages" on public.deal_stages for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'deals' and policyname = 'crm manages deals') then
    create policy "crm manages deals" on public.deals for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'deal_tasks' and policyname = 'crm manages deal tasks') then
    create policy "crm manages deal tasks" on public.deal_tasks for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'deal_events' and policyname = 'crm reads deal events') then
    create policy "crm reads deal events" on public.deal_events for select to authenticated using (true);
  end if;
end $$;

-- ---------- Настройки ----------
insert into public.automation_settings (key, value)
values ('deals', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'batch_size', 10,
  'lease_seconds', 300,
  'number_prefix', 'СД',
  'default_commission', 3,
  'stall_days', 10,
  'notary_reminder_days', 3,
  'task_reminder_days', 1,
  'auto_tasks', true
))
on conflict (key) do nothing;

-- ---------- Етапи до нотариус ----------
insert into public.deal_stages (code, name, description, position, probability, target_days, required_docs, task_templates) values
  ('reserved',    'Резервация',            'Клиентът е избрал имота, договаряме условия.',            10, 20, 5,  '{}',                                                    '[{"title":"Потвърди условията с купувача","days":1},{"title":"Съгласувай цената със собственика","days":2}]'::jsonb),
  ('deposit',     'Депозит',               'Приет депозит и подписана разписка.',                     20, 40, 5,  '{"id_card"}',                                           '[{"title":"Издай разписка за депозит","days":1},{"title":"Провери самоличност на страните","days":1}]'::jsonb),
  ('preliminary', 'Предварителен договор', 'Подписан предварителен договор за покупко-продажба.',      30, 55, 10, '{"notary_act","sketch"}',                               '[{"title":"Изготви предварителен договор","days":2},{"title":"Насрочи подписване","days":3}]'::jsonb),
  ('financing',   'Финансиране',           'Ипотечен кредит и банково одобрение.',                    40, 65, 20, '{"income_proof","bank_approval"}',                      '[{"title":"Подай документи в банката","days":3},{"title":"Следи оценката на имота","days":7}]'::jsonb),
  ('documents',   'Събиране на документи', 'Данъчна оценка, скица, удостоверение за тежести.',        50, 75, 15, '{"tax_assessment","encumbrance","condo_cert"}',          '[{"title":"Заяви данъчна оценка","days":3},{"title":"Заяви удостоверение за тежести","days":3},{"title":"Провери етажна собственост","days":5}]'::jsonb),
  ('notary_prep', 'Подготовка за нотариус','Избран нотариус, изготвен проект на нотариален акт.',     60, 85, 7,  '{}',                                                    '[{"title":"Запази час при нотариус","days":2},{"title":"Изпрати документи на нотариуса","days":2},{"title":"Потвърди сумата и начина на плащане","days":3}]'::jsonb),
  ('notary',      'Нотариус',              'Ден на изповядване на сделката.',                         70, 95, 3,  '{}',                                                    '[{"title":"Напомни на страните за часа","days":1},{"title":"Провери готовността на плащането","days":1}]'::jsonb),
  ('completed',   'Приключена',            'Сделката е изповядана и комисионата е фактурирана.',      80, 100, 5, '{}',                                                    '[{"title":"Фактурирай комисионата","days":2},{"title":"Архивирай документите","days":5}]'::jsonb),
  ('lost',        'Отпаднала',             'Сделката не се е случила.',                               90, 0,  0,  '{}',                                                    '[]'::jsonb)
on conflict (code) do nothing;

update public.deal_stages set is_final = true, is_won = true where code = 'completed';
update public.deal_stages set is_final = true, is_won = false where code = 'lost';
