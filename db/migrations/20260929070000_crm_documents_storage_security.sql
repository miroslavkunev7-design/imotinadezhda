-- Restrict CRM document metadata and private Storage objects to CRM staff.
-- The application also enforces assertCrmAccess() in every document server function.

alter table public.document_items
  add column if not exists deal_id uuid references public.deals(id) on delete cascade;
alter table public.document_requests
  add column if not exists deal_id uuid references public.deals(id) on delete cascade;
alter table public.client_documents
  add column if not exists storage_path text;
create index if not exists document_items_deal_idx on public.document_items (deal_id);
create index if not exists document_requests_deal_idx on public.document_requests (deal_id);
create index if not exists client_documents_storage_path_idx
  on public.client_documents (storage_path)
  where storage_path is not null;

update storage.buckets
set public = false,
    file_size_limit = 104857600,
    allowed_mime_types = array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/heic',
      'image/heif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
where id = 'crm-documents';

drop policy if exists "crm reads requirements" on public.document_requirements;
drop policy if exists "crm writes requirements" on public.document_requirements;
drop policy if exists document_requirements_staff_all on public.document_requirements;
create policy document_requirements_staff_all
on public.document_requirements
for all
to authenticated
using (public.is_crm_staff((select auth.uid())))
with check (public.is_crm_staff((select auth.uid())));

drop policy if exists "crm manages documents" on public.document_items;
drop policy if exists document_items_staff_all on public.document_items;
create policy document_items_staff_all
on public.document_items
for all
to authenticated
using (public.is_crm_staff((select auth.uid())))
with check (public.is_crm_staff((select auth.uid())));

drop policy if exists "crm manages doc requests" on public.document_requests;
drop policy if exists document_requests_staff_all on public.document_requests;
create policy document_requests_staff_all
on public.document_requests
for all
to authenticated
using (public.is_crm_staff((select auth.uid())))
with check (public.is_crm_staff((select auth.uid())));

drop policy if exists "crm reads doc events" on public.document_events;
drop policy if exists document_events_staff_select on public.document_events;
drop policy if exists document_events_staff_insert on public.document_events;
create policy document_events_staff_select
on public.document_events
for select
to authenticated
using (public.is_crm_staff((select auth.uid())));
create policy document_events_staff_insert
on public.document_events
for insert
to authenticated
with check (public.is_crm_staff((select auth.uid())));

drop policy if exists "crm-documents staff select" on storage.objects;
drop policy if exists "crm-documents staff insert" on storage.objects;
drop policy if exists "crm-documents staff update" on storage.objects;
drop policy if exists "crm-documents staff delete" on storage.objects;

create policy "crm-documents staff select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'crm-documents'
  and public.is_crm_staff((select auth.uid()))
);

create policy "crm-documents staff insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'crm-documents'
  and public.is_crm_staff((select auth.uid()))
);

create policy "crm-documents staff update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'crm-documents'
  and public.is_crm_staff((select auth.uid()))
)
with check (
  bucket_id = 'crm-documents'
  and public.is_crm_staff((select auth.uid()))
);

create policy "crm-documents staff delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'crm-documents'
  and public.is_crm_staff((select auth.uid()))
);
