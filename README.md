# Building network

Internal map of every building carrying a Focus Media screen. Next.js on Vercel,
Supabase for the database and image storage, Google Maps for the map and address
matching.

Two accounts, `viewer` and `editor`. Viewers can browse, filter and export.
Editors can also add, edit and delete buildings and images.

## Getting it running

**1. Install**

```bash
npm install
cp .env.example .env.local
```

**2. Supabase**

Create a project, then in the SQL editor run `supabase/schema.sql` followed by
`supabase/storage.sql`.

From Project Settings → API, copy the project URL into `SUPABASE_URL` and the
**service role** key into `SUPABASE_SERVICE_ROLE_KEY`. Not the anon key. The
browser never talks to Supabase directly, so the anon key is not used at all.

Note that the free tier pauses a project after seven days without a request. If
the app looks empty after a quiet fortnight, resume it from the Supabase
dashboard.

**3. Google Maps**

In Google Cloud Console, create a project, attach a billing account, and enable
**Maps JavaScript API**, **Places API** and **Geocoding API**. Billing has to be
attached even though this volume sits inside the free monthly credit.

Create two API keys:

- One for the browser → `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY`. This ships to the
  browser and cannot be hidden, so restrict it by HTTP referrer to your Vercel
  domain and `localhost`, and by API to Maps JavaScript and Places. Without that
  restriction anyone can lift it from the page and spend your quota.
- One for the server → `GOOGLE_MAPS_SERVER_KEY`. Used only for resolving
  addresses during CSV import. Restrict it by API to Places and Geocoding.

**4. Accounts**

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Put that in `SESSION_SECRET`, then generate the two password hashes:

```bash
npm run hash -- "the viewer password"
npm run hash -- "the editor password"
```

Paste them into `VIEWER_PASSWORD_HASH` and `EDITOR_PASSWORD_HASH`.

**5. Run**

```bash
npm run dev
```

For Vercel, add every variable from `.env.example` under Project Settings →
Environment Variables, then add the deployed domain to the browser key's
referrer restrictions.

## How the pieces fit

**Auth.** The login form posts to `/api/auth/login`, which compares the password
against the bcrypt hash in the environment and sets a signed, httpOnly session
cookie carrying the role. Middleware redirects anyone without a valid cookie to
the login page.

The cookie is convenience, not the security boundary. Every route that writes
calls `requireEditor()` first, so a viewer who forges a request by hand still
gets a 403. Hiding a button in the UI is not a permission check.

**Place IDs.** Google Autocomplete is what makes `152`, `156` and `152-156` all
resolve to the same building. The place ID it returns is stored server-side and
never sent to the browser, along with the coordinates it resolves to. You never
type coordinates; they exist so the map can draw 145 pins without making 145 API
calls on every load.

**Images.** Stored in a private Supabase bucket, served through short-lived
signed URLs. Uploads are downscaled to 1600px and converted to WebP before they
are stored, which keeps a 20-image building around 3 MB instead of 80 MB and
sidesteps the iPhone HEIC problem, since the browser converts on the way in.

**Deleting.** Permanent, and it takes the building's images with it. The
confirmation asks you to type the building name rather than click OK twice,
because two dialogs in a row train you to click through both without reading.

## Layout

```
┌──────────────────────────────────────────────────────────┐
│  Focus Media · Building network      viewer  Upload  Out │
├────────────┬─────────────────────────────┬───────────────┤
│            │                             │               │
│  Filters   │            Map              │  Building     │
│            │                             │  details      │
│            │                             │               │
└────────────┴─────────────────────────────┴───────────────┘
```

Built for landscape iPad and up. In portrait the two panels become overlays over
a full-width map.

## Where things live

```
supabase/schema.sql        tables, indexes, constraints
supabase/storage.sql       the private image bucket
src/lib/session.ts         session token, Edge-safe
src/lib/auth.ts            credential check and route guards
src/lib/supabase.ts        service-role database client
src/lib/types.ts           shared types, incl. what the browser is allowed to see
src/middleware.ts          redirects anyone without a session to the login
```
