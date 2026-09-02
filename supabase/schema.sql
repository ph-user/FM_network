-- Focus Media building network map
-- Run this in the Supabase SQL editor, or via `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- buildings
-- ---------------------------------------------------------------------------

create table if not exists buildings (
  -- The client's own building id from their existing records, not
  -- generated here. Supplied on creation (manual entry or CSV import),
  -- never changed after. Plain short codes, not UUIDs -- hence text.
  id            text primary key,

  -- City is the top-level split -- Melbourne and Sydney are far enough
  -- apart that showing both on one map at once is useless. The map always
  -- renders exactly one city (default Melbourne); city is the switch, not
  -- an optional filter like the rest.
  city          text        not null check (city in ('Melbourne', 'Sydney')),

  name          text        not null,
  address       text        not null,

  -- Resolved from Google on create/import (lat/lng and the canonical
  -- address text), same as everywhere else. Suburb is the exception: it's
  -- taken verbatim from the client's own CSV/form input, not overridden by
  -- geocoding, since their suburb naming/grouping is the source of truth.
  place_id      text,
  lat           double precision not null,
  lng           double precision not null,
  suburb        text        not null,

  -- A building can be more than one type at once (e.g. an office with a
  -- supermarket at ground level) -- array, not a single value. Every
  -- element must be one of the allowed types, and it can't be empty.
  building_type text[]      not null check (
                               building_type <@ array['Apartment', 'Office', 'Badminton Centre', 'Hotel', 'Golf Course', 'Supermarket']::text[]
                               and array_length(building_type, 1) > 0
                             ),

  -- Level, screen count, population and notes are "could-have" on upload --
  -- nullable (screen count still defaults to 0 rather than null, since 0
  -- screens is a meaningful default and null isn't).
  levels        integer     check (levels is null or levels > 0),
  screen_count  integer     not null default 0 check (screen_count >= 0),
  population    integer     check (population is null or population >= 0),
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

create index if not exists buildings_city_idx          on buildings (city);
create index if not exists buildings_suburb_idx        on buildings (suburb);
create index if not exists buildings_building_type_idx on buildings using gin (building_type);

-- ---------------------------------------------------------------------------
-- building_images
-- ---------------------------------------------------------------------------

create table if not exists building_images (
  id           uuid primary key default gen_random_uuid(),
  building_id  text        not null references buildings(id) on delete cascade,

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
