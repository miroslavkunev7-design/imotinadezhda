-- ============================================================
-- Автоматизация №8: Генериране на Договори
-- Автоматично попълване на документи от шаблони + подпис по линк.
-- Безопасна миграция: само IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ---------- Шаблони ----------
alter table public.contract_templates add column if not exists code text;
alter table public.contract_templates add column if not exists category text not null default 'sale';
alter table public.contract_templates add column if not exists version int not null default 1;
alter table public.contract_templates add column if not exists placeholders jsonb not null default '[]'::jsonb;
alter table public.contract_templates add column if not exists requires_signature boolean not null default true;
alter table public.contract_templates add column if not exists is_default boolean not null default false;
alter table public.contract_templates add column if not exists auto_trigger text not null default 'none'; -- none|deposit|deal|rental|viewing
alter table public.contract_templates add column if not exists notes text;
alter table public.contract_templates add column if not exists sort_order int not null default 100;
alter table public.contract_templates add column if not exists generated_count int not null default 0;

create unique index if not exists contract_templates_code_uidx on public.contract_templates (code) where code is not null;

-- ---------- Генерирани документи ----------
alter table public.generated_contracts add column if not exists doc_number text;
alter table public.generated_contracts add column if not exists template_version int;
alter table public.generated_contracts add column if not exists variables jsonb not null default '{}'::jsonb;
alter table public.generated_contracts add column if not exists missing_fields jsonb not null default '[]'::jsonb;
alter table public.generated_contracts add column if not exists ai_used boolean not null default false;
alter table public.generated_contracts add column if not exists amount numeric;
alter table public.generated_contracts add column if not exists currency text default 'EUR';
alter table public.generated_contracts add column if not exists signer_name text;
alter table public.generated_contracts add column if not exists signer_email text;
alter table public.generated_contracts add column if not exists signer_phone text;
alter table public.generated_contracts add column if not exists share_token text;
alter table public.generated_contracts add column if not exists sent_at timestamptz;
alter table public.generated_contracts add column if not exists viewed_at timestamptz;
alter table public.generated_contracts add column if not exists signed_at timestamptz;
alter table public.generated_contracts add column if not exists signature_name text;
alter table public.generated_contracts add column if not exists signature_ip text;
alter table public.generated_contracts add column if not exists declined_at timestamptz;
alter table public.generated_contracts add column if not exists decline_reason text;
alter table public.generated_contracts add column if not exists expires_at timestamptz;
alter table public.generated_contracts add column if not exists lead_id uuid references public.leads(id) on delete set null;
alter table public.generated_contracts add column if not exists source text not null default 'manual'; -- manual|automation|ai
alter table public.generated_contracts add column if not exists last_error text;

create unique index if not exists generated_contracts_doc_number_uidx on public.generated_contracts (doc_number) where doc_number is not null;
create unique index if not exists generated_contracts_share_token_uidx on public.generated_contracts (share_token) where share_token is not null;
create index if not exists generated_contracts_status_idx on public.generated_contracts (status, created_at desc);
create index if not exists generated_contracts_client_idx on public.generated_contracts (client_id, created_at desc);

-- ---------- Опашка за автоматично генериране ----------
create table if not exists public.contract_queue (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  template_id uuid references public.contract_templates(id) on delete cascade,
  template_code text,
  client_id uuid references public.clients(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  dedupe_key text not null,
  variables jsonb not null default '{}'::jsonb,
  status text not null default 'pending',           -- pending|done|error|skipped
  attempts int not null default 0,
  last_error text,
  contract_id uuid references public.generated_contracts(id) on delete set null,
  auto_send boolean not null default false,
  processed_at timestamptz,
  requested_by text default 'automation',
  unique (dedupe_key)
);

create index if not exists contract_queue_status_idx on public.contract_queue (status, created_at);

grant select, insert, update, delete on public.contract_queue to authenticated;
grant all on public.contract_queue to service_role;
alter table public.contract_queue enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contract_queue' and policyname='contract_queue_auth_all') then
    create policy contract_queue_auth_all on public.contract_queue for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Лог на събитията по документ ----------
create table if not exists public.contract_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  contract_id uuid references public.generated_contracts(id) on delete cascade,
  template_id uuid references public.contract_templates(id) on delete set null,
  action text not null,                             -- generate|render|ai_fill|send|view|sign|decline|void|error|queue
  status text not null default 'ok',                -- ok|error|skipped
  message text,
  meta jsonb,
  duration_ms int,
  actor text default 'automation'
);

create index if not exists contract_events_created_idx on public.contract_events (created_at desc);
create index if not exists contract_events_contract_idx on public.contract_events (contract_id, created_at desc);

grant select, insert on public.contract_events to authenticated;
grant all on public.contract_events to service_role;
alter table public.contract_events enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contract_events' and policyname='contract_events_auth_all') then
    create policy contract_events_auth_all on public.contract_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Брояч за номера на документи ----------
create table if not exists public.contract_counters (
  year int primary key,
  last_number int not null default 0
);

grant select on public.contract_counters to authenticated;
grant all on public.contract_counters to service_role;
alter table public.contract_counters enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='contract_counters' and policyname='contract_counters_auth_read') then
    create policy contract_counters_auth_read on public.contract_counters for select to authenticated using (true);
  end if;
end $$;

create or replace function public.next_contract_number(_prefix text default 'ИН')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  _y int := extract(year from now())::int;
  _n int;
begin
  insert into public.contract_counters (year, last_number) values (_y, 1)
  on conflict (year) do update set last_number = public.contract_counters.last_number + 1
  returning last_number into _n;
  return _prefix || '-' || _y::text || '-' || lpad(_n::text, 4, '0');
end $$;

grant execute on function public.next_contract_number(text) to authenticated, service_role;

-- ---------- Настройки на автоматизацията ----------
insert into public.automation_settings (key, value) values
  ('contracts', '{"enabled": true, "ai_enabled": true, "batch_size": 10, "auto_send": false, "retry_limit": 3, "expire_days": 14, "lease_seconds": 300, "number_prefix": "ИН"}'::jsonb)
on conflict (key) do nothing;

-- ---------- Стартови шаблони ----------
insert into public.contract_templates (code, name, contract_type, category, is_active, is_default, requires_signature, auto_trigger, sort_order, template_content)
select 'deposit_receipt', 'Разписка за депозит', 'deposit', 'deposit', true, true, true, 'deposit', 10,
$tpl$РАЗПИСКА ЗА ПОЛУЧЕН ДЕПОЗИТ № {{doc_number}}

гр. {{city}}, {{today}}

Долуподписаният {{agency_name}}, представляван от {{broker_name}}, получи от
{{client_name}}, ЕГН/ЛНЧ {{client_egn}}, адрес {{client_address}}, тел. {{client_phone}},
сумата от {{amount}} {{currency}} ({{amount_words}}) като ДЕПОЗИТ за резервация на имот:

{{property_title}}
Адрес: {{property_address}}
Площ: {{property_area}} кв.м / Цена: {{property_price}} {{currency}}

Условия:
1. Депозитът резервира имота за срок от {{reserve_days}} дни.
2. При сключване на предварителен договор депозитът се приспада от продажната цена.
3. При отказ от страна на купувача депозитът не се възстановява.

Получил: ____________________        Платил: ____________________
   {{broker_name}}                        {{client_name}}$tpl$
where not exists (select 1 from public.contract_templates where code = 'deposit_receipt');

insert into public.contract_templates (code, name, contract_type, category, is_active, is_default, requires_signature, auto_trigger, sort_order, template_content)
select 'preliminary_sale', 'Предварителен договор за продажба', 'preliminary', 'sale', true, true, true, 'deal', 20,
$tpl$ПРЕДВАРИТЕЛЕН ДОГОВОР ЗА ПОКУПКО-ПРОДАЖБА НА НЕДВИЖИМ ИМОТ № {{doc_number}}

Днес, {{today}}, в гр. {{city}}, между:

ПРОДАВАЧ: {{seller_name}}, ЕГН {{seller_egn}}, адрес {{seller_address}}
КУПУВАЧ: {{client_name}}, ЕГН {{client_egn}}, адрес {{client_address}}

се сключи следният договор:

I. ПРЕДМЕТ
1. Продавачът се задължава да продаде на Купувача следния недвижим имот:
{{property_title}}, {{property_address}}, площ {{property_area}} кв.м{{#if property_cadastral}}, идентификатор {{property_cadastral}}{{/if}}.

II. ЦЕНА И НАЧИН НА ПЛАЩАНЕ
2. Продажната цена е {{property_price}} {{currency}} ({{price_words}}).
3. Платен депозит: {{amount}} {{currency}}, приспада се от цената.
4. Остатъкът се заплаща при подписване на нотариалния акт.

III. СРОКОВЕ
5. Нотариалният акт се подписва до {{deadline}}.

IV. ОТГОВОРНОСТ
6. При виновно неизпълнение неизправната страна дължи неустойка в размер на депозита.

ПРОДАВАЧ: ____________________        КУПУВАЧ: ____________________$tpl$
where not exists (select 1 from public.contract_templates where code = 'preliminary_sale');

insert into public.contract_templates (code, name, contract_type, category, is_active, is_default, requires_signature, auto_trigger, sort_order, template_content)
select 'brokerage', 'Договор за посредничество', 'brokerage', 'service', true, true, true, 'none', 30,
$tpl$ДОГОВОР ЗА ПОСРЕДНИЧЕСТВО № {{doc_number}}

Днес, {{today}}, в гр. {{city}}, между {{agency_name}} („Посредник"), представляван от {{broker_name}},
и {{client_name}}, ЕГН {{client_egn}}, тел. {{client_phone}}, e-mail {{client_email}} („Възложител"),
се сключи договор за посредничество при {{service_type}} на недвижим имот.

1. Посредникът се задължава да извършва оглед, реклама, подбор и организация на сделката.
2. Възнаграждението е {{commission}}% от продажната цена, дължимо при сключване на сделката.
3. Срок на договора: {{term_months}} месеца от датата на подписване.
4. Възложителят декларира верността на предоставените данни за имота.

ПОСРЕДНИК: ____________________        ВЪЗЛОЖИТЕЛ: ____________________$tpl$
where not exists (select 1 from public.contract_templates where code = 'brokerage');

insert into public.contract_templates (code, name, contract_type, category, is_active, is_default, requires_signature, auto_trigger, sort_order, template_content)
select 'rental', 'Договор за наем', 'rental', 'rental', true, true, true, 'rental', 40,
$tpl$ДОГОВОР ЗА НАЕМ НА НЕДВИЖИМ ИМОТ № {{doc_number}}

Днес, {{today}}, в гр. {{city}}, между:
НАЕМОДАТЕЛ: {{seller_name}}, ЕГН {{seller_egn}}, адрес {{seller_address}}
НАЕМАТЕЛ: {{client_name}}, ЕГН {{client_egn}}, тел. {{client_phone}}

1. Наемодателят предоставя за възмездно ползване имот: {{property_title}}, {{property_address}}, {{property_area}} кв.м.
2. Месечен наем: {{amount}} {{currency}}, платим до {{pay_day}}-о число на текущия месец.
3. Депозит: {{deposit}} {{currency}}, възстановим при предаване на имота без щети.
4. Срок: {{term_months}} месеца, считано от {{start_date}}.
5. Консумативите са за сметка на Наемателя.

НАЕМОДАТЕЛ: ____________________        НАЕМАТЕЛ: ____________________$tpl$
where not exists (select 1 from public.contract_templates where code = 'rental');

insert into public.contract_templates (code, name, contract_type, category, is_active, is_default, requires_signature, auto_trigger, sort_order, template_content)
select 'exclusive', 'Договор за ексклузивно представителство', 'exclusive', 'service', true, false, true, 'none', 50,
$tpl$ДОГОВОР ЗА ЕКСКЛУЗИВНО ПРЕДСТАВИТЕЛСТВО № {{doc_number}}

Днес, {{today}}, в гр. {{city}}, {{client_name}}, ЕГН {{client_egn}} („Собственик"), възлага на
{{agency_name}} („Агенция") изключителното право да предлага за {{service_type}} имот:
{{property_title}}, {{property_address}}, {{property_area}} кв.м, при начална цена {{property_price}} {{currency}}.

1. Срок на изключителните права: {{term_months}} месеца.
2. Възнаграждение: {{commission}}% от постигнатата цена.
3. Собственикът се задължава да не предлага имота чрез други посредници през срока на договора.
4. Агенцията се задължава да отчита извършените огледи и маркетингови действия ежемесечно.

СОБСТВЕНИК: ____________________        АГЕНЦИЯ: ____________________$tpl$
where not exists (select 1 from public.contract_templates where code = 'exclusive');