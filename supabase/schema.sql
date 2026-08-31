-- Focus Media building network map
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- buildings
-- ---------------------------------------------------------------------------

create table if not exists buildings (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  address       text        not null,

  -- Resolved from Google Places on create/import. Never entered by hand,
  -- never sent to the browser.
  place_id      text,
  lat           double precision not null,
  lng           double precision not null,

  levels        integer     not null check (levels > 0),
  building_type text        not null check (building_type in ('Apartment', 'Office', 'Shop', 'Hotel')),
  postcode      text        not null,
  suburb        text        not null,
  status        text        not null check (status in ('Signed', 'Installed')),
  screen_count  integer     not null default 0 check (screen_count >= 0),
  notes         text        not null default '',

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Names must be unique because bulk image upload identifies a building by the
-- first half of the filename. Case- and whitespace-insensitive so that
-- "The Yarra" and "the  yarra" collide rather than quietly coexisting.
create unique index if not exists buildings_name_key
  on buildings (lower(regexp_replace(name, '\s+', ' ', 'g')));

-- One building per Google place. Partial so that manually pinned buildings
-- without a place_id don't collide on null.
create unique index if not exists buildings_place_id_key
  on buildings (place_id) where place_id is not null;

create index if not exists buildings_status_idx        on buildings (status);
create index if not exists buildings_postcode_idx      on buildings (postcode);
create index if not exists buildings_building_type_idx on buildings (building_type);

-- ---------------------------------------------------------------------------
-- building_images
-- ---------------------------------------------------------------------------

create table if not exists building_images (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid        not null references buildings(id) on delete cascade,

  -- Path within the `building-images` storage bucket. The bucket is private;
  -- the app hands out short-lived signed URLs.
  storage_path text        not null unique,

  -- Defaults to the second half of the uploaded filename. Editable.
  caption      text        not null default '',

  created_at   timestamptz not null default now()
);

create index if not exists building_images_building_id_idx
  on building_images (building_id, created_at);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists buildings_set_updated_at on buildings;
create trigger buildings_set_updated_at
  before update on buildings
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- The browser never talks to Supabase directly. Every read and write goes
-- through a Next.js route handler using the service role key, which checks the
-- session cookie first. RLS is enabled with no policies so that if the anon key
-- ever leaks, it grants nothing.

alter table buildings       enable row level security;
alter table building_images enable row level security;
