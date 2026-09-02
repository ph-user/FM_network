# Building network — project context

Internal map of every building carrying a Focus Media screen. Next.js on Vercel,
Supabase for database and image storage, Google Maps for the map and address
matching.

Read this before making changes. It records decisions already settled with the
client so they don't get relitigated or accidentally reversed.

## What this is and is not

It is a sales tool. Someone from the team sits down with a client, opens this on
a laptop or a landscape iPad, and shows them the network: where the buildings
are, what kind they are, how many screens are in them, photos of the screens in
place.

It is not a CRM. No contacts, no deals, no pipeline stages. Pipedrive owns that
and the two do not sync. Do not add contact fields.

Screens are not records. `screen_count` is a plain number the editor maintains
by hand. Do not model individual screens.

## Users

Two fixed accounts, `viewer` and `editor`. No registration, no password reset,
no user table. Passwords are bcrypt hashes in environment variables.

The role comes from which account you log in as. There is no role switcher.

Viewers browse, filter and export CSV. Editors additionally add, edit and delete
buildings and images.

**The security boundary is server-side.** Middleware redirects for convenience,
but every write route calls `requireEditor()` first. A viewer forging a request
by hand must get a 403. Never rely on a hidden button.

## Data model

Buildings only, plus images attached to buildings. Two cities -- Melbourne
and Sydney -- covered by one network.

```
buildings:  id, city, name, address, place_id, lat, lng, suburb,
            building_type, levels, screen_count, population, notes
images:     id, building_id, storage_path, caption
```

Every field on upload (CSV or the "Add building" form) is either **must-have**
or **could-have**:

- Must-have: `city`, `id`, `name`, `building_type` ("Type"), `suburb`,
  `address`. A row/form missing any of these is invalid and can't be saved.
- Could-have: `levels` ("Level"), `screen_count` ("Screen"), `population`,
  `notes` ("Note"). Nullable in the DB (except `screen_count`, which defaults
  to 0 -- 0 screens is a meaningful value, null isn't). Left blank when not
  supplied.

(There used to be a `status` field, Signed/Installed, driving green/yellow
marker colours, and a `postcode` field with its own filter. Both are gone
now -- the client dropped status without naming a replacement, and postcode
was superseded by city + suburb as the geography filters. If either comes up
again, it's a deliberate reintroduction, not a bug.)

- `building_type` is one of Apartment, Office, Shop, Hotel.
- `city` is one of Melbourne, Sydney. Drives which buildings the map can even
  show -- see Layout.
- `notes` is free text and is where anything unstructured goes. Resist adding
  new columns; the client asked for a notes field precisely to avoid them.
- `name` must be unique, enforced case- and whitespace-insensitively. Bulk image
  upload identifies a building by name, so duplicates break it. If a building
  has no real name, the address is used as the name.
- `id` is the client's own building id from their existing records -- **not**
  server-generated. `text`, not `uuid` (their ids are plain short codes).
  Always caller-supplied: required in the "Add building" form and required in
  every CSV row. Never changes after creation. CSV import matches purely by
  id -- a row whose id matches an existing building updates it; any other id
  creates a new building with that exact id.
- `suburb` is taken **exactly as typed** in the CSV/form -- unlike address, it
  is not overridden by geocoding. The client's own suburb naming/grouping is
  the source of truth, since it may not match Google's canonical suburb for
  the same address.

### place_id, lat, lng

`place_id` is **server-side only** and must never appear in an API response or
the CSV export. `toClientBuilding()` in `src/lib/types.ts` strips it. Keep using
it rather than returning rows directly.

Coordinates are resolved automatically from the place ID on create and import.
The user never types or sees them. They are stored so the map can draw ~150 pins
without making ~150 Places calls on load.

## Address matching

This is the requirement the client cared most about. On Google Maps, typing
`152`, `156` or `152-156 Swanston St` all lead to the same result. The app must
behave the same way.

Solved by using **Places Autocomplete (New)** everywhere an address is entered,
and storing the place ID it returns. Both Places API and Places API (New) are
enabled on the Cloud project; build against the new one.

CSV import has no dropdown, so each row's address is resolved server-side via
the Places API before anything is written, then a review screen is shown.

This resolves `address`, `lat` and `lng` only -- not `suburb`. See Data model.

## Deletes

Permanent. Soft delete was considered and rejected as unnecessary at this scale.

Deleting a building cascades to its images in Postgres, and the code must also
remove the files from storage, otherwise orphaned objects accumulate.

Confirmation requires **typing the building name**, not clicking OK twice. Two
sequential dialogs train people to click through both without reading.

## Layout

Single page. Filters left, map centre, info panel right. Upload is a button in
the header that opens a modal.

Built for **landscape iPad (1024px) and up**, which is how it gets shown to
clients. Portrait is a fallback where the two panels become overlays.

The selected building is reflected in the URL as a query param so links are
shareable. So is the selected city (`?city=`) -- see Filters.

## Filters

**City is a live switch, not a filter.** Melbourne and Sydney are too far
apart to usefully show on one map at once, so the map always renders exactly
one city -- Melbourne by default, with a Melbourne/Sydney toggle at the top
of the filters panel. Switching is immediate (no Apply needed, unlike
everything else below) and resets the other filters and the selected
building. Persisted in the URL as `?city=`.

Within the selected city, the rest are all AND-combined. Filters are edited
as a draft; nothing changes on the map until **Apply filters** is clicked.
This was a deliberate client request, overriding the map-updates-instantly
behaviour this doc originally called for. The match count next to Apply
stays live against the draft as a preview of what Apply will do. Export CSV
exports whatever is currently applied (i.e. matches what's on the map), not
the unapplied draft.

- Building name: free text, separate field from address (client asked for
  these to be two distinct searches, not one combined box)
- Address: free text, separate field from name, same reasoning
- Type: checkboxes
- Level: min/max
- Suburb: multi-select, options drawn from suburbs present in the selected
  city's data (replaced the old postcode filter -- see Data model)
- Within X km of an address: Places Autocomplete (New) plus radius, circle
  drawn on the map once applied

Under 300 buildings, so load them all once and filter in the browser. No
clustering, no viewport fetching, no loading spinners.

## Markers

Single colour (ink) for every marker -- there used to be a green/yellow split
by status; status is gone (see Data model) and nothing replaced it as a
marker colour yet. If the client wants markers colour-coded by something
else (type? city, once both are ever shown together?), that's a real design
question to ask them, not to guess at.

Gold `#CF9300` is the Focus Media brand colour, used **as an accent only**
(focus rings, the selected marker) -- a halo drawn around the selected pin,
not the pin's own border/glyph colour. Primary buttons are ink.

## Images

Attached to buildings, not to screens. There is no field for where in the
building a screen sits; that lives in the image caption.

Uploads are downscaled to 1600px on the long edge and converted to WebP in the
browser before upload. This keeps a 20-image building around 3 MB instead of
80 MB, and sidesteps iPhone HEIC files that some browsers will not display.

Stored in a private Supabase bucket, served via short-lived signed URLs. Never
public, never stored as bytes in Postgres.

Caption defaults to the second half of the filename and is editable.

Expect 1 to 20 images per building, typically 4 to 8.

## Bulk image upload

Filenames follow `Building Name-Caption.jpg`. **Split on the last hyphen**, so
building names containing hyphens (`152-156 Swanston St-Lobby.jpg`) still work.
Captions must not contain hyphens.

Matching is: strip extension, split on last hyphen, normalise whitespace and
case, match the first half against building names. Unmatched images go to an
Unassigned group that the user assigns by hand; the caption is still parsed.

Nothing uploads until the unassigned count is zero and the user confirms.

## CSV

Columns, in this order, for both import and export -- matching the client's
own spreadsheet headers, not this app's internal field names (`Type` is
`building_type`, `Level` is `levels`, `Screen` is `screen_count`, `Note` is
`notes`):

```
City, Id, Name, Type, Suburb, Address, Level, Screen, Population, Note
```

No lat, lng or place_id. City, Id, Name, Type, Suburb and Address are
must-have; the rest are could-have (see Data model). Id is always the
client's own building id (never server-generated). Matching an existing id
updates that building; any other id creates a new one with it.

Import flow: resolve every address, then show a review screen splitting rows
into new / update / unresolved / ambiguous (pick from candidates or fix
inline) / invalid. Rows sharing an id or a name with another row in the same
file are flagged and excluded until fixed. Nothing is written until the user
confirms.

New buildings can only be created through the upload modal, by manual entry or
CSV. Not from the map, not from the image uploader.

## Environment

See `.env.example`. Two Google Maps keys on purpose: the browser key is referrer
restricted because it ships to the client, the server key is secret and has no
application restriction because Vercel has no fixed outbound IP.

`VIEWER_PASSWORD_HASH` / `EDITOR_PASSWORD_HASH` are base64, not a raw bcrypt
hash — a raw hash contains `$2b$12$...`, and Next.js's `.env` loader
(dotenv-expand) silently mangles it by reading `$2b`/`$12` as variable
references. Always generate these with `npm run hash`, never paste one in by
hand. See `src/lib/auth.ts`.

Supabase free tier pauses a project after seven days of no requests.

`src/lib/types.ts`'s `BuildingRow`/`BuildingImageRow` must stay `type`, not
`interface`. Supabase's client needs every Row/Insert/Update shape to
structurally satisfy `Record<string, unknown>`, and TypeScript only allows
that for object type aliases -- an interface silently degrades every
`.insert()`/`.update()` call to argument type `never`, with no error at the
`Database` type itself. Cost real time to track down once; don't reintroduce
it when adding a table.

### A note on this file and Next.js 16

Next.js 16's dev/build startup can auto-manage `AGENTS.md` and `CLAUDE.md` with
its own notice block when it detects an AI coding agent and neither file
already carries that block. Early in this project that resulted in this file
being wiped down to a bare `@AGENTS.md` import once. `AGENTS.md` now
permanently hosts that block, so the generator should no-op on both files going
forward — but if this file ever looks suspiciously short again, that's why.

## Status

Done: schema, storage bucket, auth, session handling, middleware (now
`src/proxy.ts`, per Next 16's rename), login page, app shell, map with markers
loaded from the database, filter panel with Apply, CSV export, info panel with
inline editing (including address re-resolution through Places Autocomplete,
same as everywhere else), per-building image upload/caption/delete, building
delete with the type-the-name confirmation, the Upload modal (manual entry +
CSV import with the full review screen: new/update/ambiguous/unresolved/
duplicate-in-file, editable inline, nothing written until confirmed) and bulk
image upload with filename matching.

Every item on the original roadmap is now built. Parsing lives in
`src/lib/image.ts` (`parseBulkFilename`); matching is the same
`normalizeName` used by CSV import's existing-building lookup, so both stay
consistent with the DB's own case/whitespace-insensitive uniqueness index.
Unassigned images block the upload button until every one is assigned or
removed, matching CLAUDE.md exactly. One rough edge worth knowing: the info
panel's image gallery only fetches on mount, so images uploaded here for
whatever building happens to be currently selected won't show until
reselected -- `UploadControl` deselects on completion specifically to force
that refresh, but it's a workaround, not a proper fix.

CSV import resolves addresses via the **Geocoding API**, not Places
Autocomplete, despite CLAUDE.md's Address matching section pointing at
Autocomplete for everywhere else. Autocomplete is built to suggest
completions and returns several even for a complete, well-formed address
(partial matches, nearby businesses at the same number) -- tried it first,
and it marked nearly every row "ambiguous" even for exact addresses.
Geocoding returns one result for a well-formed address and several only when
genuinely ambiguous, which is what that review-screen bucket actually means.
It's also the one API the README/.env.example has the client enable that
nothing else in the app used -- the tell that it was meant for this. See
`src/lib/places.ts`. Results are biased (not restricted) to `region=au`,
since every address in this project is Melbourne/Australia.

Nothing left on the original roadmap. Deployed to Vercel, connected to a
GitHub repo for auto-deploy on push. Still on the shared `DEMO_MAP_ID` rather
than a real one, and the Vercel domain's referrer restriction on the Google
Maps browser key needs updating by hand if that domain ever changes.

Since then, at the client's request: buildings now split across two cities
(Melbourne and Sydney, city as a live map switch -- see Layout/Filters);
`status` (and its green/yellow marker colours) is gone; `postcode` is gone,
replaced by suburb as a direct client-supplied field (not geocoded) plus the
city split; `population` was added. All existing buildings were deleted as
part of this change, at the client's explicit instruction, to make way for a
fresh import in the new column format -- see Data model and CSV. Markers are
now a single colour; nothing has replaced status as a way to colour-code them
yet (flagged as an open question above, under Markers).

## Working style

The client prefers plain conversational language, no em-dashes, and being asked
before assumptions get baked in. When a decision here conflicts with a new
request, say so rather than silently picking one.
