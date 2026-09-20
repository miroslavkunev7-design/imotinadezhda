-- ============================================================
-- Автоматизация №16: AI Асистент 24/7 (омниканален чатбот)
-- Сайт + Viber + WhatsApp + Messenger, единна инбокс + анализи.
-- Безопасна миграция: само IF NOT EXISTS.
-- ============================================================

-- ---------- Канали ----------
create table if not exists public.bot_channels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  code text not null unique,                       -- web|viber|whatsapp|messenger
  name text not null,
  is_active boolean not null default true,
  auto_reply boolean not null default true,
  greeting text,
  handoff_keywords text[] not null default array['брокер','човек','оператор','жалба','адвокат'],
  quiet_hours_start int not null default 0,
  quiet_hours_end int not null default 0,
  webhook_secret text,
  notes text
);

grant select, insert, update, delete on public.bot_channels to authenticated;
grant all on public.bot_channels to service_role;
alter table public.bot_channels enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bot_channels' and policyname='bot_channels_auth_all') then
    create policy bot_channels_auth_all on public.bot_channels for all to authenticated using (true) with check (true);
  end if;
end $$;

insert into public.bot_channels (code, name, greeting) values
  ('web', 'Сайт (чат уиджет)', 'Здравейте! Аз съм Надежда — вашият виртуален консултант. Как мога да помогна?'),
  ('viber', 'Viber', 'Здравейте! Пишете ми за имоти, огледи и цени — на разположение съм 24/7.'),
  ('whatsapp', 'WhatsApp', 'Здравейте! Как мога да помогна с търсенето на имот?'),
  ('messenger', 'Facebook Messenger', 'Здравейте! Пишете ми за имоти, огледи и цени.')
on conflict (code) do nothing;

-- ---------- Разговори ----------
create table if not exists public.bot_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  channel_code text not null default 'web',
  external_user_id text,                            -- ID от Viber/WA/Messenger или visitor token
  display_name text,
  contact_phone text,
  contact_email text,
  property_id uuid,
  lead_id uuid,
  client_id uuid,
  status text not null default 'open',              -- open|bot|handoff|closed
  intent text,                                      -- buy|rent|sell|valuation|legal|other
  language text not null default 'bg',
  last_message_at timestamptz,
  last_bot_at timestamptz,
  messages_count int not null default 0,
  bot_messages_count int not null default 0,
  handoff_at timestamptz,
  handoff_reason text,
  assigned_to uuid,
  satisfaction int,                                  -- 1..5
  ai_summary text,
  tags text[] not null default '{}',
  unique (channel_code, external_user_id)
);

create index if not exists bot_conversations_status_idx on public.bot_conversations (status, last_message_at desc);
create index if not exists bot_conversations_channel_idx on public.bot_conversations (channel_code, created_at desc);

grant select, insert, update, delete on public.bot_conversations to authenticated;
grant all on public.bot_conversations to service_role;
alter table public.bot_conversations enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bot_conversations' and policyname='bot_conversations_auth_all') then
    create policy bot_conversations_auth_all on public.bot_conversations for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Съобщения ----------
create table if not exists public.bot_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid not null references public.bot_conversations(id) on delete cascade,
  channel_code text not null default 'web',
  direction text not null default 'in',             -- in|out
  role text not null default 'user',                -- user|assistant|agent|system
  content text not null,
  attachments jsonb not null default '[]'::jsonb,
  ai_used boolean not null default false,
  model text,
  tokens int,
  latency_ms int,
  delivered boolean not null default true,
  error text
);

create index if not exists bot_messages_conv_idx on public.bot_messages (conversation_id, created_at);

grant select, insert, update, delete on public.bot_messages to authenticated;
grant all on public.bot_messages to service_role;
alter table public.bot_messages enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bot_messages' and policyname='bot_messages_auth_all') then
    create policy bot_messages_auth_all on public.bot_messages for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- База знания (FAQ) ----------
create table if not exists public.bot_knowledge (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  question text not null,
  answer text not null,
  keywords text[] not null default '{}',
  category text default 'general',
  is_active boolean not null default true,
  hits int not null default 0
);

grant select, insert, update, delete on public.bot_knowledge to authenticated;
grant select on public.bot_knowledge to anon;
grant all on public.bot_knowledge to service_role;
alter table public.bot_knowledge enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bot_knowledge' and policyname='bot_knowledge_auth_all') then
    create policy bot_knowledge_auth_all on public.bot_knowledge for all to authenticated using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bot_knowledge' and policyname='bot_knowledge_anon_read') then
    create policy bot_knowledge_anon_read on public.bot_knowledge for select to anon using (is_active);
  end if;
end $$;

insert into public.bot_knowledge (question, answer, keywords, category) values
  ('Каква е комисионната при покупка?', 'Комисионната се договаря индивидуално и се уточнява преди подписване на договор за посредничество. Свържете се с нас за конкретна оферта.', array['комисион','такса','процент'], 'fees'),
  ('Работно време?', 'Офисът работи от понеделник до петък, 09:00–18:00 ч. AI асистентът е на разположение 24/7.', array['работно','време','час','отворено'], 'general'),
  ('Как да насроча оглед?', 'Изпратете ми желания имот, дата и час — ще подготвя заявка за оглед и брокер ще потвърди.', array['оглед','посещение','визита'], 'viewings'),
  ('Правите ли оценка на имот?', 'Да, извършваме безплатна пазарна оценка. Нужни са адрес, площ, етаж и състояние на имота.', array['оценка','цена','колко струва'], 'valuation')
on conflict do nothing;

-- ---------- Събития / журнал ----------
create table if not exists public.bot_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  conversation_id uuid,
  channel_code text,
  event_type text not null,                        -- inbound|outbound|handoff|lead_created|error|webhook
  payload jsonb not null default '{}'::jsonb,
  message text
);

create index if not exists bot_events_created_idx on public.bot_events (created_at desc);

grant select, insert on public.bot_events to authenticated;
grant all on public.bot_events to service_role;
alter table public.bot_events enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='bot_events' and policyname='bot_events_auth_all') then
    create policy bot_events_auth_all on public.bot_events for all to authenticated using (true) with check (true);
  end if;
end $$;

-- ---------- Настройки ----------
insert into public.automation_settings (key, value)
select 'bot_24_7', jsonb_build_object(
  'enabled', true,
  'ai_enabled', true,
  'handoff_after_messages', 12,
  'capture_lead', true,
  'summary_enabled', true
)
where exists (select 1 from information_schema.tables where table_schema='public' and table_name='automation_settings')
  and not exists (select 1 from public.automation_settings where key = 'bot_24_7');
