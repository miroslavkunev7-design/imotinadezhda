-- ============================================================
-- Автоматизация №9: Управление на Документи
-- Събиране (заявки към клиенти), проследяване, срокове, AI проверка.
-- Безопасна миграция: само IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ---------- Bucket за документи (частен) ----------
insert into storage.buckets (id, name, public)
values ('crm-documents', 'crm-documents', false)
on conflict (id) do nothing;

-- ---------- Изисквани документи (чеклисти) ----------
create table if not exists public.document_requirements (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  scope text not null default 'client',          -- client | property | deal
  category text not null default 'sale',         -- sale | rent | mortgage | identity | property
  is_required boolean not null default true,
  ai_check boolean not null default true,
  valid_months int,                              -- срок на валидност (напр. данъчна оценка)
  accepted_types text not null default 'pdf,jpg,jpeg,png,heic,docx',
  sort_order int not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Проследявани файлове ----------
create table if not exists public.document_items (
  id uuid primary key default gen_random_uuid(),
  requirement_code text,
  scope text not null default 'client',
  client_id uuid references public.clients(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  title text not null,
  doc_type text not null default 'other',
  file_name text not null,
  storage_path text,
  file_url text,
  file_size bigint,
  mime_type text,
  checksum text,
  status text not null default 'uploaded',        -- uploaded | in_review | approved | rejected | expired
  source text not null default 'crm',             -- crm | client_link | import | scanner
  version int not null default 1,
  issued_at date,
  expires_at date,
  ai_status text not null default 'pending',       -- pending | ok | warning | failed | skipped
  ai_summary text,
  ai_fields jsonb not null default '{}'::jsonb,
  ai_confidence numeric(5,2),
  rejected_reason text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  uploaded_by uuid references auth.users(id) on delete set null,
  external_source_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_items_client_idx on public.document_items (client_id);
create index if not exists document_items_property_idx on public.document_items (property_id);
create index if not exists document_items_status_idx on public.document_items (status);
create index if not exists document_items_expires_idx on public.document_items (expires_at);
create unique index if not exists document_items_external_uidx on public.document_items (external_source_id) where external_source_id is not null;

-- ---------- Заявки за събиране на документи ----------
create table if not exists public.document_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  requirement_code text,
  requirement_name text not null,
  scope text not null default 'client',
  status text not null default 'pending',          -- pending | uploaded | approved | rejected | cancelled | expired
  share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  due_at timestamptz,
  reminders_sent int not null default 0,
  last_reminder_at timestamptz,
  next_reminder_at timestamptz,
  document_id uuid references public.document_items(id) on delete set null,
  message text,
  attempts int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists document_requests_status_idx on public.document_requests (status);
create index if not exists document_requests_client_idx on public.document_requests (client_id);
create index if not exists document_requests_reminder_idx on public.document_requests (next_reminder_at);

-- ---------- Одит лог ----------
create table if not exists public.document_events (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references public.document_items(id) on delete cascade,
  request_id uuid references public.document_requests(id) on delete cascade,
  action text not null,
  status text not null default 'ok',
  message text,
  meta jsonb,
  duration_ms int,
  actor text not null default 'automation',
  created_at timestamptz not null default now()
);

create index if not exists document_events_created_idx on public.document_events (created_at desc);

-- ---------- Права (Data API) ----------
grant select, insert, update, delete on public.document_requirements to authenticated;
grant select, insert, update, delete on public.document_items to authenticated;
grant select, insert, update, delete on public.document_requests to authenticated;
grant select, insert on public.document_events to authenticated;
grant all on public.document_requirements to service_role;
grant all on public.document_items to service_role;
grant all on public.document_requests to service_role;
grant all on public.document_events to service_role;

alter table public.document_requirements enable row level security;
alter table public.document_items enable row level security;
alter table public.document_requests enable row level security;
alter table public.document_events enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'document_requirements' and policyname = 'crm reads requirements') then
    create policy "crm reads requirements" on public.document_requirements for select to authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'document_requirements' and policyname = 'crm writes requirements') then
    create policy "crm writes requirements" on public.document_requirements for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'document_items' and policyname = 'crm manages documents') then
    create policy "crm manages documents" on public.document_items for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'document_requests' and policyname = 'crm manages doc requests') then
    create policy "crm manages doc requests" on public.document_requests for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename = 'document_events' and policyname = 'crm reads doc events') then
    create policy "crm reads doc events" on public.document_events for select to authenticated using (true);
  end if;
end $$;

-- ---------- Настройки ----------
insert into public.automation_settings (key, value)
values ('documents', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'batch_size', 10,
  'lease_seconds', 300,
  'due_days', 7,
  'reminder_days', 3,
  'max_reminders', 3,
  'expiry_warning_days', 30,
  'max_file_mb', 25,
  'auto_approve_confidence', 0
))
on conflict (key) do nothing;

-- ---------- Стандартни български документи ----------
insert into public.document_requirements (code, name, description, scope, category, is_required, valid_months, sort_order) values
  ('id_card',        'Лична карта',                      'Двустранно копие на лична карта на страната по сделката.', 'client',   'identity', true,  null, 10),
  ('notary_act',     'Нотариален акт',                   'Документ за собственост на имота.',                        'property', 'sale',     true,  null, 20),
  ('sketch',         'Скица на имота',                    'Актуална скица от кадастъра.',                            'property', 'sale',     true,  6,    30),
  ('tax_assessment', 'Данъчна оценка',                    'Удостоверение за данъчна оценка на имота.',               'property', 'sale',     true,  6,    40),
  ('encumbrance',    'Удостоверение за тежести',          'Справка от Имотен регистър за липса на тежести.',          'property', 'sale',     true,  6,    50),
  ('heirs_cert',     'Удостоверение за наследници',        'Необходимо при наследствен имот.',                        'property', 'sale',     false, 6,    60),
  ('marital_status', 'Удостоверение за семейно положение', 'При продажба от съпрузи или деклариране на режим.',       'client',   'sale',     false, 6,    70),
  ('income_proof',   'Доказване на доход',                'Служебна бележка или НАП справка за кредит.',              'client',   'mortgage', false, 3,    80),
  ('bank_approval',  'Банково одобрение',                 'Писмо за одобрен ипотечен кредит.',                        'client',   'mortgage', false, 3,    90),
  ('rent_contract',  'Договор за наем',                   'Подписан договор за наем.',                                'deal',     'rent',     false, null, 100),
  ('utility_bills',  'Сметки за консумативи',             'Последни платени сметки (вода, ток, ТЕЦ).',                'property', 'rent',     false, 3,    110),
  ('condo_cert',     'Удостоверение за етажна собственост','Липса на задължения към входа.',                          'property', 'sale',     false, 3,    120)
on conflict (code) do nothing;
