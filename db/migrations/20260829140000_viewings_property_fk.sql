-- Връзка (FK) между огледите и имотите, за да работят вградените заявки
-- viewings -> properties в PostgREST.

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'viewings_property_id_fkey') then
    alter table public.viewings
      add constraint viewings_property_id_fkey
      foreign key (property_id) references public.properties(id) on delete set null;
  end if;
end $$;

create index if not exists viewings_property_idx on public.viewings (property_id);
