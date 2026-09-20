-- ============================================================
-- Автоматизация №5: Follow-Up Автоматизация
-- Последващи контакти (drip последователности) + реактивация на стари клиенти.
-- Безопасна миграция: само IF NOT EXISTS / ADD COLUMN IF NOT EXISTS.
-- ============================================================

-- ---------- Допълнителни полета по лийда ----------
alter table public.leads add column if not exists followup_opt_out boolean not null default false;
alter table public.leads add column if not exists followup_count int not null default 0;
alter table public.leads add column if not exists last_followup_at timestamptz;
alter table public.leads add column if not exists last_activity_at timestamptz;
alter table public.leads add column if not exists reactivated_at timestamptz;

-- ---------- Последователности ----------
create table if not exists public.followup_sequences (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null,
  description text,
  trigger_type text not null default 'no_response',  -- no_response|after_send|qualified_no_action|after_viewing|dormant|manual
  lead_type text,                                    -- null = за всички
  target_status text,                                -- null = за всички статуси
  channel text not null default 'email',
  ai_personalize boolean not null default true,
  stop_on_reply boolean not null default true,
  dormant_days int not null default 90,              -- за trigger_type = dormant
  quiet_start int not null default 21,                -- час, след който не се изпраща
  quiet_end int not null default 8,                   -- час, преди който не се изпраща
  is_active boolean not null default true,
  priority int not null default 100
);

create index if not exists followup_sequences_active_idx on public.followup_sequences (is_active, trigger_type);

grant select, insert, update, delete on public.followup_sequences to authenticated;
grant all on public.followup_sequences to service_role;
alter table public.followup_sequences enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='followup_sequences' and policyname='followup_sequences_auth_all') then
    create policy followup_sequences_auth_all on public.followup_sequences for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Стъпки в последователността ----------
create table if not exists public.followup_steps (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  sequence_id uuid not null references public.followup_sequences(id) on delete cascade,
  step_no int not null,
  delay_hours int not null default 24,
  channel text not null default 'email',
  subject text,
  body text not null,
  is_active boolean not null default true,
  unique (sequence_id, step_no)
);

create index if not exists followup_steps_seq_idx on public.followup_steps (sequence_id, step_no);

grant select, insert, update, delete on public.followup_steps to authenticated;
grant all on public.followup_steps to service_role;
alter table public.followup_steps enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='followup_steps' and policyname='followup_steps_auth_all') then
    create policy followup_steps_auth_all on public.followup_steps for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Записвания (enrollment) ----------
create table if not exists public.followup_enrollments (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_id uuid not null references public.followup_sequences(id) on delete cascade,
  status text not null default 'active',             -- active|completed|stopped|paused
  current_step int not null default 0,
  next_run_at timestamptz not null default now(),
  stop_reason text,
  reason text,                                       -- защо е записан
  completed_at timestamptz,
  unique (lead_id, sequence_id)
);

create index if not exists followup_enrollments_due_idx on public.followup_enrollments (status, next_run_at);
create index if not exists followup_enrollments_lead_idx on public.followup_enrollments (lead_id);

grant select, insert, update, delete on public.followup_enrollments to authenticated;
grant all on public.followup_enrollments to service_role;
alter table public.followup_enrollments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='followup_enrollments' and policyname='followup_enrollments_auth_all') then
    create policy followup_enrollments_auth_all on public.followup_enrollments for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Изпратени follow-up съобщения ----------
create table if not exists public.followup_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  enrollment_id uuid references public.followup_enrollments(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_id uuid references public.followup_sequences(id) on delete set null,
  step_id uuid references public.followup_steps(id) on delete set null,
  step_no int not null default 1,
  channel text not null default 'email',
  subject text,
  body text,
  status text not null default 'pending',            -- pending|sent|failed|manual|skipped
  error text,
  token text unique,
  ai_used boolean not null default false,
  model text,
  scheduled_at timestamptz not null default now(),
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz
);

create index if not exists followup_messages_lead_idx on public.followup_messages (lead_id, created_at desc);
create index if not exists followup_messages_status_idx on public.followup_messages (status, scheduled_at);

grant select, insert, update, delete on public.followup_messages to authenticated;
grant all on public.followup_messages to service_role;
alter table public.followup_messages enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='followup_messages' and policyname='followup_messages_auth_all') then
    create policy followup_messages_auth_all on public.followup_messages for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Състояние на фоновите задачи (lock + circuit breaker) ----------
create table if not exists public.automation_jobs (
  key text primary key,
  locked_until timestamptz,
  last_run_at timestamptz,
  paused boolean not null default false,
  paused_reason text,
  paused_at timestamptz,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.automation_jobs to authenticated;
grant all on public.automation_jobs to service_role;
alter table public.automation_jobs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='automation_jobs' and policyname='automation_jobs_auth_all') then
    create policy automation_jobs_auth_all on public.automation_jobs for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Атомарно заемане на lease (single-flight)
create or replace function public.claim_automation_job(_key text, _lease_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean := false;
begin
  insert into public.automation_jobs (key, locked_until, updated_at)
  values (_key, now() + make_interval(secs => _lease_seconds), now())
  on conflict (key) do update
    set locked_until = now() + make_interval(secs => _lease_seconds),
        updated_at = now()
    where public.automation_jobs.locked_until is null
       or public.automation_jobs.locked_until < now()
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

revoke all on function public.claim_automation_job(text, int) from public, anon;
grant execute on function public.claim_automation_job(text, int) to service_role, authenticated;

-- ---------- Настройки ----------
insert into public.automation_settings (key, value) values
  ('followup', '{"enabled": true, "ai_enabled": true, "batch_size": 25, "max_steps": 5, "min_hours_between": 20, "stop_on_reply": true, "auto_enroll_no_response": true, "auto_enroll_after_send": true, "auto_enroll_dormant": true, "dormant_days": 90, "reactivation_limit_per_run": 10, "lease_seconds": 300}'::jsonb)
on conflict (key) do nothing;

-- ---------- Стартови последователности ----------
insert into public.followup_sequences (name, description, trigger_type, lead_type, channel, dormant_days, priority)
select 'Няма отговор — купувач', 'Три меки напомняния след запитване без отговор.', 'no_response', 'buyer', 'email', 90, 10
where not exists (select 1 from public.followup_sequences where name = 'Няма отговор — купувач');

insert into public.followup_sequences (name, description, trigger_type, lead_type, channel, dormant_days, priority)
select 'След изпратени имоти', 'Проверка на интереса след разпратен подбор от имоти.', 'after_send', null, 'email', 90, 20
where not exists (select 1 from public.followup_sequences where name = 'След изпратени имоти');

insert into public.followup_sequences (name, description, trigger_type, lead_type, channel, dormant_days, priority)
select 'Реактивация на стари клиенти', 'Връщане на контакти без активност над 90 дни.', 'dormant', null, 'email', 90, 30
where not exists (select 1 from public.followup_sequences where name = 'Реактивация на стари клиенти');

-- Стъпки: няма отговор
insert into public.followup_steps (sequence_id, step_no, delay_hours, channel, subject, body)
select s.id, v.step_no, v.delay_hours, 'email', v.subject, v.body
from public.followup_sequences s,
(values
  (1, 24, 'Успяхте ли да прегледате предложенията, {{name}}?',
   E'Здравейте, {{name}},\n\nПишем Ви отново във връзка със запитването Ви към „Имоти Надежда“. Ако все още търсите имот, мога да Ви изпратя актуален подбор и да организирам оглед в удобен за Вас час.\n\nДостатъчно е да отговорите на този имейл с една дума.\n\nПоздрави,\nЕкип „Имоти Надежда“'),
  (2, 72, 'Имаме нови оферти за Вас, {{name}}',
   E'Здравейте, {{name}},\n\nВ последните дни получихме нови оферти, които може да съвпаднат с търсенето Ви. Ако желаете да Ви изпратя подбора — само напишете „да“.\n\nПоздрави,\nЕкип „Имоти Надежда“'),
  (3, 168, 'Да оставим ли търсенето отворено?',
   E'Здравейте, {{name}},\n\nЗа да не Ви притесняваме напразно: да продължим ли да следим пазара за Вас, или да затворим търсенето засега?\n\nПоздрави,\nЕкип „Имоти Надежда“')
) as v(step_no, delay_hours, subject, body)
where s.name = 'Няма отговор — купувач'
  and not exists (select 1 from public.followup_steps fs where fs.sequence_id = s.id and fs.step_no = v.step_no);

-- Стъпки: след изпратени имоти
insert into public.followup_steps (sequence_id, step_no, delay_hours, channel, subject, body)
select s.id, v.step_no, v.delay_hours, 'email', v.subject, v.body
from public.followup_sequences s,
(values
  (1, 48, 'Как Ви се струват изпратените имоти?',
   E'Здравейте, {{name}},\n\nИнтересува ме дали някой от изпратените имоти Ви допада. Ако да — организирам оглед веднага. Ако не — уточнете ми критериите и ще прецизирам подбора.\n\nПоздрави,\nЕкип „Имоти Надежда“'),
  (2, 120, 'Да организираме ли оглед, {{name}}?',
   E'Здравейте, {{name}},\n\nМога да запазя час за оглед на избраните имоти този или следващия уикенд. Кой вариант Ви е удобен?\n\nПоздрави,\nЕкип „Имоти Надежда“')
) as v(step_no, delay_hours, subject, body)
where s.name = 'След изпратени имоти'
  and not exists (select 1 from public.followup_steps fs where fs.sequence_id = s.id and fs.step_no = v.step_no);

-- Стъпки: реактивация
insert into public.followup_steps (sequence_id, step_no, delay_hours, channel, subject, body)
select s.id, v.step_no, v.delay_hours, 'email', v.subject, v.body
from public.followup_sequences s,
(values
  (1, 0, 'Пазарът се промени — да погледнем ли отново?',
   E'Здравейте, {{name}},\n\nМина известно време от последния ни разговор. Пазарът в региона се промени и се появиха нови възможности.\n\nАко търсенето Ви е още актуално, ще Ви изпратя кратък подбор — отговорете само с „да“.\n\nПоздрави,\nЕкип „Имоти Надежда“'),
  (2, 336, 'Последна проверка по Вашата заявка',
   E'Здравейте, {{name}},\n\nПроверявам за последно дали да продължим да следим пазара за Вас. Ако не отговорите, ще затворим заявката, за да не Ви безпокоим.\n\nПоздрави,\nЕкип „Имоти Надежда“')
) as v(step_no, delay_hours, subject, body)
where s.name = 'Реактивация на стари клиенти'
  and not exists (select 1 from public.followup_steps fs where fs.sequence_id = s.id and fs.step_no = v.step_no);
