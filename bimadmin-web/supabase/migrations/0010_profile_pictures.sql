-- Adds profile picture support. Run after 0001-0009.
--
-- Unlike the `documents` bucket (private, signed URLs), avatars are a
-- public bucket. That's deliberate: an avatar is shown constantly across
-- the UI, and generating a fresh signed URL on every render would be
-- both slow and wasteful. The tradeoff is that anyone with the exact URL
-- can view an avatar, which is normal for profile pictures and why the
-- path uses the user's uuid rather than anything guessable like a name.
--
-- Write access is still restricted to the owner: the first folder
-- segment must match the caller's own auth.uid(), so nobody can
-- overwrite someone else's picture.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "anyone can view avatars"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "users can upload their own avatar"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can replace their own avatar"
on storage.objects for update
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users can delete their own avatar"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- profiles.avatar_color already exists from 0001 and stays as the
-- fallback when someone has no picture uploaded.
alter table profiles add column if not exists avatar_url text;
