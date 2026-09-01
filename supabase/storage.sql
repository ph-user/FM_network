-- Private bucket for building images. Run after schema.sql.
--
-- The bucket is not public. The app hands out short-lived signed URLs, and
-- every read and write goes through the service role key from a Next.js
-- route, so no storage policies are needed for the anon/authenticated roles.

insert into storage.buckets (id, name, public)
values ('building-images', 'building-images', false)
on conflict (id) do nothing;
