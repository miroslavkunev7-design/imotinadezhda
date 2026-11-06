-- Settings CMS layer (new tables only; applied remotely 2026-11-06)
-- See api/cms.js + mobile/cms-overrides.js

create table if not exists public.cms_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  schema_version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cms_components (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.cms_pages(id) on delete cascade,
  component_key text not null,
  type text not null default 'block',
  sort_order int not null default 0,
  rect jsonb not null default '{}'::jsonb,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page_id, component_key)
);

create table if not exists public.cms_assets (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  url text,
  mime text,
  bytes int,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cms_archives (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('property', 'client')),
  entity_id text not null,
  archived_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  unique (entity_type, entity_id)
);

create table if not exists public.cms_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
