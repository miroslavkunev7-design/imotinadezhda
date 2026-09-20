alter table public.property_matches alter column client_id drop not null;
alter table public.property_matches add column if not exists lead_id uuid;
alter table public.property_matches add column if not exists grade text;
alter table public.property_matches add column if not exists breakdown jsonb not null default '{}'::jsonb;
alter table public.property_matches add column if not exists reasons text[] not null default '{}';
alter table public.property_matches add column if not exists mismatches text[] not null default '{}';
alter table public.property_matches add column if not exists source text not null default 'lead';
alter table public.property_matches add column if not exists send_id uuid;
alter table public.property_matches add column if not exists sent_at timestamptz;
alter table public.property_matches add column if not exists responded_at timestamptz;
alter table public.property_matches add column if not exists feedback text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='property_matches_property_id_fkey') then
    alter table public.property_matches
      add constraint property_matches_property_id_fkey
      foreign key (property_id) references public.properties(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='property_matches_client_id_fkey') then
    alter table public.property_matches
      add constraint property_matches_client_id_fkey
      foreign key (client_id) references public.clients(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='property_matches_lead_id_fkey') then
    alter table public.property_matches
      add constraint property_matches_lead_id_fkey
      foreign key (lead_id) references public.leads(id) on delete cascade;
  end if;
end $$;

create unique index if not exists property_matches_lead_property_uidx
  on public.property_matches (lead_id, property_id) where lead_id is not null;
create index if not exists property_matches_property_idx on public.property_matches (property_id, score desc);
create index if not exists property_matches_status_idx on public.property_matches (status, created_at desc);