alter table public.crm_custom_shapes
  add column if not exists image_url text,
  add column if not exists keep_image boolean not null default false;