-- Adds real file storage on top of 0001-0003. Run this after them.
--
-- The `documents` table already had a `storage_path` column from
-- 0001_init.sql, anticipating this; it just wasn't being used yet.
-- Uploads were metadata-only (file name, category, size), which is why
-- nothing could actually be opened or downloaded before this migration.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- Storage isolation follows the same convention as everywhere else in
-- this app: the first folder segment of the object path is the
-- organization_id, and current_organization_id() (defined in
-- 0001_init.sql) resolves the caller's own organization. Uploads must be
-- written to {organizationId}/{ownerType}/{ownerId}/{filename} for this
-- to work -- see the upload code in DocumentsPanel.tsx.

create policy "org members can read their documents"
on storage.objects for select
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = current_organization_id()::text
);

create policy "org members can upload their documents"
on storage.objects for insert
with check (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = current_organization_id()::text
);

create policy "org members can delete their documents"
on storage.objects for delete
using (
  bucket_id = 'documents'
  and (storage.foldername(name))[1] = current_organization_id()::text
);
