-- Part B: cinematic property video jobs (additive only — no CRM wipe)
-- Applied via Supabase migration ai_video_tables

create extension if not exists pgcrypto;

create table if not exists public.ai_video_skill_registry (
  skill_key text primary key,
  label_bg text not null,
  tool_name text not null,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.ai_video_skill_registry (skill_key, label_bg, tool_name, enabled, config)
values (
  'property_cinematic_video',
  'Видео за имот',
  'cinematic_property_video',
  false,
  jsonb_build_object(
    'min_photos', 4,
    'max_photos', 10,
    'default_mode', 'REAL_PROPERTY',
    'budget_usd', 15
  )
)
on conflict (skill_key) do nothing;

create table if not exists public.ai_video_jobs (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null,
  skill_key text not null default 'property_cinematic_video'
    references public.ai_video_skill_registry (skill_key),
  status text not null default 'queued'
    check (status in (
      'queued','planning','prep','clipping','assembling','qa','ready','failed','cancelled'
    )),
  mode text not null default 'REAL_PROPERTY'
    check (mode in ('REAL_PROPERTY','PROJECT_VISUALIZATION')),
  actor_user_id uuid not null,
  actor_email text,
  property_id uuid,
  session_id text,
  progress jsonb not null default '{}'::jsonb,
  result jsonb not null default '{}'::jsonb,
  error text,
  cost_usd numeric(10,4) not null default 0,
  budget_usd numeric(10,2) not null default 15,
  photo_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (idempotency_key)
);

create index if not exists ai_video_jobs_actor_idx on public.ai_video_jobs (actor_user_id, created_at desc);
create index if not exists ai_video_jobs_status_idx on public.ai_video_jobs (status);

create table if not exists public.ai_video_scenes (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_video_jobs (id) on delete cascade,
  idx int not null,
  kind text not null,
  prompt_key text,
  status text not null default 'pending',
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (job_id, idx)
);

create table if not exists public.ai_video_attempts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_video_jobs (id) on delete cascade,
  scene_id uuid references public.ai_video_scenes (id) on delete set null,
  provider text not null,
  model text,
  request_id text,
  status text not null default 'submitted',
  request jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  cost_usd numeric(10,4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists ai_video_attempts_request_idx on public.ai_video_attempts (provider, request_id);

create table if not exists public.ai_video_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_video_jobs (id) on delete cascade,
  kind text not null
    check (kind in ('source_photo','ref_frame','clip','audio','final_mp4','thumb','other')),
  storage_path text not null,
  mime text,
  bytes bigint,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_video_assets_job_idx on public.ai_video_assets (job_id, kind);

create table if not exists public.ai_video_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.ai_video_jobs (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_video_outbox (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.ai_video_jobs (id) on delete cascade,
  topic text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','sent','failed','dead')),
  attempts int not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);

create index if not exists ai_video_outbox_poll_idx
  on public.ai_video_outbox (status, next_attempt_at)
  where status = 'pending';

-- RLS: staff only (nd_is_staff); service role bypasses for n8n/media worker
alter table public.ai_video_skill_registry enable row level security;
alter table public.ai_video_jobs enable row level security;
alter table public.ai_video_scenes enable row level security;
alter table public.ai_video_attempts enable row level security;
alter table public.ai_video_assets enable row level security;
alter table public.ai_video_events enable row level security;
alter table public.ai_video_outbox enable row level security;

drop policy if exists ai_video_registry_staff on public.ai_video_skill_registry;
create policy ai_video_registry_staff on public.ai_video_skill_registry
  for select to authenticated using (public.nd_is_staff());

drop policy if exists ai_video_jobs_staff_select on public.ai_video_jobs;
create policy ai_video_jobs_staff_select on public.ai_video_jobs
  for select to authenticated using (public.nd_is_staff() and actor_user_id = auth.uid());

drop policy if exists ai_video_jobs_staff_insert on public.ai_video_jobs;
create policy ai_video_jobs_staff_insert on public.ai_video_jobs
  for insert to authenticated with check (public.nd_is_staff() and actor_user_id = auth.uid());

drop policy if exists ai_video_jobs_staff_update on public.ai_video_jobs;
create policy ai_video_jobs_staff_update on public.ai_video_jobs
  for update to authenticated using (public.nd_is_staff() and actor_user_id = auth.uid());

drop policy if exists ai_video_scenes_staff on public.ai_video_scenes;
create policy ai_video_scenes_staff on public.ai_video_scenes
  for all to authenticated using (
    public.nd_is_staff() and exists (
      select 1 from public.ai_video_jobs j where j.id = job_id and j.actor_user_id = auth.uid()
    )
  );

drop policy if exists ai_video_attempts_staff on public.ai_video_attempts;
create policy ai_video_attempts_staff on public.ai_video_attempts
  for select to authenticated using (
    public.nd_is_staff() and exists (
      select 1 from public.ai_video_jobs j where j.id = job_id and j.actor_user_id = auth.uid()
    )
  );

drop policy if exists ai_video_assets_staff on public.ai_video_assets;
create policy ai_video_assets_staff on public.ai_video_assets
  for all to authenticated using (
    public.nd_is_staff() and exists (
      select 1 from public.ai_video_jobs j where j.id = job_id and j.actor_user_id = auth.uid()
    )
  );

drop policy if exists ai_video_events_staff on public.ai_video_events;
create policy ai_video_events_staff on public.ai_video_events
  for select to authenticated using (
    public.nd_is_staff() and (
      job_id is null or exists (
        select 1 from public.ai_video_jobs j where j.id = job_id and j.actor_user_id = auth.uid()
      )
    )
  );

-- outbox is server/n8n only (service role); no authenticated policies on purpose
