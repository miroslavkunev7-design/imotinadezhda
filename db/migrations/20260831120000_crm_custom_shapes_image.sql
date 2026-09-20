-- Собствени форми: пазим и оригиналната снимка, за да може формата да се
-- постави като елемент „със снимката, както е качена“ (напр. карта на град).
alter table public.crm_custom_shapes
  add column if not exists image_url text,
  add column if not exists keep_image boolean not null default false;
