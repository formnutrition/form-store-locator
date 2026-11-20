# Form store locator

A replacement for the Stockist widget on the Form store locator page. It is its own site, hosted on Vercel. The WordPress page only gets a short snippet that loads it.

The map is the thing customers see. The admin (at `/admin`) is where locations are added, edited, imported and exported. Locations live in Supabase, not in this git repo.

## What customers get

- The same layout as the current widget: a list on the left (300px) and a map on the right (600px tall) on desktop. Under 700px wide, the map sits on top and the list follows.
- Search box, placeholder “Type a postcode or address…”, with Google address suggestions.
- Results in kilometres, nearest first, each with a pin, the distance, the name, the address and a Directions link.
- The Form pin, and black numbered clusters when the map is zoomed out.
- On a phone it asks for the person’s location.
- It opens centred on the UK and Ireland.

## One-time setup

You do not need to create anything in this repo by hand. Someone technical (or the hosting screens) fills in the environment variables below, runs one SQL file, then deploys.

### 1. Supabase — use a new project

Create a **new** Supabase project named something like `form-store-locator`, in **London (eu-west-2)** if it is offered, otherwise Ireland (eu-west-1).

Do not add this table to the landers project (or QM3, or nutrition). Those projects already hold other data, and the secret key for a project can read and write every table in it. A separate project keeps a mistake here from touching landing pages or anything else. 831 store rows are tiny.

In the new project, open the SQL editor and run the whole of:

`supabase/migrations/20261120120000_stores.sql`

That creates the `stores` table and turns on row level security. Anyone using the public (anon) key can only read stores that are marked visible. There is no permission to add, edit or delete with that key. This app writes with the service role key, which stays on the server.

Cost: the Free plan is enough (the database allowance is 500 MB; this table is well under 1 MB). Free projects do pause after a week with no traffic. The store page is visited often enough that this should stay awake. If it ever pauses, open the Supabase dashboard and restore it, or move the project to the Pro plan (about $25 a month) so it never sleeps.

### 2. Google

Use two keys. Neither belongs in git.

| Variable | Where it is used | What to enable | How to restrict it |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_GOOGLE_MAPS_KEY` | The map in the browser | Maps JavaScript API, Places API | HTTP referrers: the Vercel domain and `http://localhost:3000/*` |
| `GOOGLE_MAPS_SERVER_KEY` | Placing addresses on the map, on the server | Geocoding API | IP addresses if you can, otherwise a separate key you can disable |

The map runs inside a frame on the Vercel site, so Google checks the **Vercel** address, not formnutrition.com. A key that only allows formnutrition.com will show a blank map. Add the Vercel domain, for example `https://your-project.vercel.app/*`. Preview deploys need `https://*.vercel.app/*` as well if you want the map on those.

### 3. Admin sign-in

| Variable | What it is |
| --- | --- |
| `ADMIN_PASSWORD` | The password for `/admin` |
| `AUTH_SECRET` | A long random string that signs the login cookie. Make one with `openssl rand -base64 32` |

The cookie is httpOnly (JavaScript on the page cannot read it) and lasts 7 days. `/admin` sends “do not index” to search engines.

### 4. Supabase variables

| Variable | What it is |
| --- | --- |
| `SUPABASE_URL` | Project URL, like `https://xxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | The service_role secret, or the newer secret key that starts with `sb_secret_` |

Do not create `NEXT_PUBLIC_SUPABASE_URL` or put the service key anywhere the browser can see. The public map asks this app for the store list. It never talks to Supabase itself.

Copy `.env.example` to `.env.local` for a laptop. On Vercel, add the same names under Settings → Environment Variables, for Production and Preview, and mark the secret ones Sensitive.

## Deploy on Vercel

1. Import this GitHub repo as a new Vercel project (do not attach it to the landers project).
2. Add the environment variables above.
3. Deploy. The project is set to run in London (`lhr1`), next to a London database.
4. The site URL is the one you paste into WordPress.

Vercel’s free or existing team plan is enough. There is no extra app server to run.

## Snippet for WordPress

On https://formnutrition.com/store-locator/, replace the Stockist block with this. Change the domain to the Vercel URL.

```html
<div id="form-store-locator">Loading store locator…</div>
<script async src="https://YOUR-VERCEL-DOMAIN/embed.js"></script>
```

The script does not load the map until the locator is near the screen, so it does not slow the rest of the page. The map itself sits in a frame. That keeps the shop theme from restyling it, and it is also why the theme’s “hide every iframe” rule does not blank it: the snippet forces this one frame to stay visible. A frame is more reliable than a shadow root here, because Google’s map and address suggestions expect a real page. On a phone the frame grows to fit the list instead of trapping it in a tiny box.

The theme currently contains this, which would hide a normal frame:

```css
iframe:not([class*="richpanel"]) { display: none !important; }
```

You can leave that rule in place. You do not need to edit it.

## Load the stores

The file `data/stores-uk-ie.csv` is the Stockist export (831 UK, Ireland and Channel Islands stores). Nine rows had a blank country but a London postcode; those are saved as England. The original file is unchanged.

After the env vars and the SQL are in place:

```bash
npm install
npm run import:stores
```

That calls Google once per address and writes the rows into Supabase. It remembers lookups in `data/.geocode-cache.json` (that file is not committed), so a second run does not pay for the same address again. A full first run is a few hundred paid lookups (Geocoding is about $5 per 1,000).

Check the file without writing anything:

```bash
npm run import:stores -- --dry-run
```

To import a newer export later, save it as a CSV and either:

- upload it on `/admin` with **Bulk import**, or
- run `npm run import:stores -- --csv path/to/new-file.csv`

Bulk import and the script both understand the Stockist columns: Stockist ID, Name, Address line 1, Address line 2, City, State/Province, Postal code, Country, Phone, Website, Email, Logo URL, Notes, Priority, Visible.

Rows with the same Stockist ID are updated. A changed address is placed on the map again. An unchanged address keeps its pin, so re-importing the same file is cheap. **Bulk export** downloads the same columns.

The admin upload sends the file in small batches so a long list does not time out. The command above is the easier way to do the very first 831.

Adding or editing one location also places the address on the map as you save.

## How fast the public map updates

The store list is cached for about a minute. Saving in the admin clears that cache, so a change usually shows on the next page load straight away and is never more than a couple of minutes behind. The WordPress page itself does not have to be edited again.

Until Supabase is connected, the site falls back to `data/seed-stores.json` so you can look at the layout. Those coordinates are postcode centres from a free lookup, not Google, and the admin will refuse to save. Run the import above before going live. Treat that file as a preview, not as the list customers should rely on.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Run it on your laptop at http://localhost:3000 |
| `npm test` | Check the CSV, distances, login cookie, and the database rules |
| `npm run import:stores` | Geocode a CSV and save it to Supabase |
| `npx tsx scripts/build-preview-seed.mjs` | Rebuild the preview file without Google. Not for production. |

## Not done from here

This repo does not create the Supabase project and does not run the SQL against a live database. That is a separate step, on purpose.

A Google browser key was not available while this was built, so the map in local screenshots uses OpenStreetMap tiles as a stand-in. With `NEXT_PUBLIC_GOOGLE_MAPS_KEY` set, customers get Google Maps and address suggestions. The OpenStreetMap stand-in is only used when that key is missing.
