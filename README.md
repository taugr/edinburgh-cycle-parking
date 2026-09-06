# Bike Neuks

<p align="center">
  <img src="./public/icon-192.png" alt="Bike Neuks icon" width="140" />
  <br />
  <a href="https://neuk.bike/">
    <img src="https://img.shields.io/badge/live-Cloudflare%20Pages-0f766e" alt="live app" />
  </a>
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue" alt="license" />
  </a>
  <br />
  Static, mobile-friendly map for finding nearby cycle parking across the UK, Ireland, Spain and Armenia.
</p>

## Features

- Find nearby cycle parking from your current location in the UK, Ireland,
  Spain, or Armenia
- Search from a UK, Irish, Spanish, or Armenian street, postcode, town, or place
- Browse a map-first interface without an app account or backend
- See the official UK National Cycle Network as a default-on, optional map
  layer from zoom 10
- Show nearby OpenStreetMap drinking-water points as a default-off map layer
- Show cycle directions to a selected parking place with CycleStreets
- Build multi-stop cycle routes and compare Quietest, Balanced, and Fastest
  options
- Compare the best three neuks near a route destination, then finish the route
  at the chosen parking place
- Save routes on the current device and export them as GPX files
- See capacity, access, cover, and stand type when mapped
- Share parking places with source-qualified `?parking=` links
- Install the app as a Progressive Web App
- Download an explicit map area for predictable offline parking, cycling-place,
  and National Cycle Network access
- Use the interface in English, Scottish Gaelic, Spanish, or Armenian

## Live app

Open [neuk.bike](https://neuk.bike/). The deployed site currently runs on
Cloudflare Pages, with [neuk-bike.pages.dev](https://neuk-bike.pages.dev/) as
the provider URL and rollback entry point.

The app runs entirely in the browser. It has no backend, server database, paid
API, or server-side personal-location storage.

## Quick start

```bash
pnpm install
pnpm dev
```

Then open the local URL printed by Next.js. The project requires Node.js 20 or
newer and uses pnpm.

## How it works

The generated parking release combines two free sources:

- City of Edinburgh Council public cycle-parking GeoJSON, preferred within
  Edinburgh
- OpenStreetMap `amenity=bicycle_parking` features from sequential Geofabrik
  extracts for the UK, Ireland, Spain, and Armenia, including a separate Canary
  Islands extract

The refresh script normalizes both sources, suppresses likely Edinburgh
duplicates in favour of council records, and writes source-qualified IDs such
as `cec:1234` and `osm:node:98765`. It derives useful display names offline from
OSM streets, junctions, nearby landmarks, and settlements when a source record
only says "Cycle parking". It then creates a content-addressed static release:

```text
public/data/parking/manifest.json
public/data/parking/chunks/12/{x}/{y}.{content-hash}.json
public/data/parking/indexes/point-index.{content-hash}.json
src/data/cycle-parking-report.json
```

The browser first loads the manifest and a 3×3 neighbourhood of zoom-12 chunks
around the current location. Map movement loads additional bounded chunks. A
24-chunk in-memory LRU cache prevents unbounded growth. The point index is only
loaded when a `?parking=` deep link needs it. The full UK-Ireland-Spain-Armenia
dataset is not included in the JavaScript bundle.

The UK National Cycle Network is a separate official Walk Wheel Cycle Trust
snapshot. The browser loads only nearby content-addressed zoom-10 chunks and
keeps them behind a persistent Map layers switch. Traffic-free, on-road,
ferry, and temporarily closed segments are styled distinctly. Numbered routes
use compact repeated shields, while route popups present route type, confirmed
surface, ride quality, and lighting in a compact translated fact grid using the
same icon language as parking details. The layer is not shown outside published
UK coverage and never changes route calculation.

OpenStreetMap drinking-water points share the lazy-loaded cycling-place
release. They stay off by default and appear as blue droplet markers when the
Drinking water switch is enabled in Map layers. Selecting a point shows its
distance and a Directions action without replacing or reranking the nearby
parking list. The layer choice is stored only in the current browser.

If geolocation is unavailable or the requested location is outside the UK,
Ireland, Spain, and Armenia, the app falls back to central Edinburgh and
shows a compact “Showing Edinburgh · Use my location” prompt. GPS and searched
places need no extra status line; the selected search name stays in the search
field. Permission errors appear only after requesting location explicitly.
Only confirmed GPS uses the blue location marker. The dark basemap increases street, path, and label contrast
while preserving route overlays and path patterns.
The map's “Plan a route” button opens destination search in the same map and sheet. The sliders
icon beside Parking opens parking preferences. Route planning is also available
from the existing menu.
Place search uses Photon and OpenStreetMap data. After three characters it
loads suggestions automatically, while Enter and the desktop Search button
remain available as explicit fallbacks. Results are filtered through the same
country-boundary polygons as the parking data.

Directions use the CycleStreets v2 API from the browser. Riders can compare
quietest, balanced, and fastest routes by estimated time and distance before
starting; balanced is selected by default. Add a public API key to `.env.local`
for local development:

```bash
NEXT_PUBLIC_CYCLESTREETS_API_KEY=your_key_here
```

Parking directions and route planning share a compact journey preview. Choose a
destination first; confirmed GPS can supply the start. If GPS is unavailable or
the map is showing a shared/search reference, choose a start or explicitly use
location. The reference location is never silently used as a route origin.
The preview offers route styles, live tracking, directions and saving. Back
returns to parking with the selection and discovery camera preserved; “Resume
route” restores the draft during the current visit. Save a route to retain it
across visits. “Edit route” exposes naming, reordering and up to 30 stops, from
place search or an explicit tap-on-map mode. Changing the destination preserves
start and via points. **Finish at bike parking** appears once the route is ready and
compares up to three neuks near the current destination using route time and
distance, distance from the destination, capacity, cover, access, and stand
type. The original destination remains unchanged until a neuk is confirmed, and
remains available as a one-tap fallback. When route comparison is unavailable,
nearby parking and mapped details still remain selectable. The selected route,
including its stops, geometry, instructions, distance, and duration, is saved
to IndexedDB on the current device. Saved routes can be
reopened and exported or shared as GPX without recalculation. GPX files can also
be reviewed and imported locally; their exact track segments are preserved, but
they do not gain invented route preferences or turn-by-turn directions. Planned
routes can be shared as compact links containing only their stops and route
preference in the URL fragment. Route calculation and place search still
require a connection, and clearing browser site data removes the local route
library.

While riding, the next-turn card shows the distance to the next instruction and
remaining route distance. **Recalculate route** appears when GPS is off-route;
it uses the current position, preserves the selected route style and destination,
and retains via stops not yet passed on the route. Recalculation needs a connection
and keeps the original route if it fails. Stopping or leaving the ride invalidates
pending recalculation results.

**Keep screen on** is optional and applies only during a live ride. It releases
on arrival, stop, or leaving the journey and reacquires when the page becomes
visible again. Wake lock requires browser support and a secure context (HTTPS
or localhost); a plain HTTP LAN address may not support it. **Spoken directions**
uses a device-local voice for the selected language when one is available. It
announces instruction changes, off-route status and arrival, without sending
instructions to a speech service. These options are off by default.

Open the Bike Neuks menu and use **Plan a route** to start a draft or **My
routes** to reopen routes saved on the current device. The normal Nearby sheet
remains dedicated to finding cycle parking and other cycling places.

Armenia routing was verified with a live Yerevan journey that returned route
geometry and Armenian street instructions. The app keeps its existing external
Google Maps action as an alternative.

Street View previews are optional. Add a restricted public browser key:

```bash
NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY=your_embed_key_here
```

These keys are bundled into the static app because there is no backend. Restrict
the Google key to the Maps Embed API and the app's allowed HTTP referrers.

Production builds use PostHog only when `NEXT_PUBLIC_POSTHOG_KEY` is configured.
Analytics are disabled on local and loopback hosts by default.

## Language setting

Open the settings menu to switch between English, Scottish Gaelic
(`Gàidhlig`), Spanish (`Español`), and Armenian (`Հայերեն`). The choice is
stored only in the browser and is reused on the next visit. On a first visit
the app uses the first supported browser language, then falls back to English.

The translated interface, parking-name templates, route instructions, and
number formatting are bundled into the static app. Street and place names,
brand names, source attribution, and licence text stay unchanged. Place search
uses English results for the English interface and local place names for
Gaelic, Spanish, and Armenian. Armenian uses Photon's local-name response
because Photon does not accept `hy` as a response-language value.

## Commands

```bash
pnpm test          # focused Vitest suite
pnpm test:e2e      # desktop and mobile workflows against a static export
pnpm lint
pnpm format
pnpm build         # writes the static site to out/
pnpm deploy:cloudflare # builds and deploys out/ to Cloudflare Pages
pnpm update:data   # refreshes council + OSM data and generated chunks
pnpm update:pois   # refreshes UK-Ireland-Spain-Armenia cycling places
pnpm verify:pois   # verifies POI chunks, hashes, IDs, counts, and coverage
pnpm update:network # refreshes the official UK National Cycle Network
pnpm verify:network # verifies network chunks, hashes, counts, and budgets
```

Install the Playwright browser once before the E2E suite if needed:

```bash
pnpm exec playwright install chromium
```

Offline-area E2E tests use local deterministic OpenFreeMap-shaped fixtures, so
the routine suite does not prefetch from the public provider. To run the
rate-limited real-provider smoke test explicitly:

```bash
OPENFREEMAP_SMOKE=1 pnpm exec playwright test e2e/offline-openfreemap-live.spec.ts
```

## Dataset refresh

The cycling-place release keeps bicycle shops, repair facilities, hire
locations, and drinking-water points in a separate lazy-loaded release under
`public/data/cycling-pois/`. Run `pnpm update:pois` to rebuild the full UK,
Ireland, Spain, and Armenia coverage from the same cached Geofabrik extracts
used by parking. Inputs are processed sequentially, overlapping regional OSM
IDs are deduplicated, and the generated report records per-input checksums,
counts, source timestamps, resource usage, and static-asset budgets. Parking
remains the default and continues to use the independent release described
below.

`pnpm update:network` pages through the official National Cycle Network
FeatureServer, validates its schema and record count, normalizes route
classification, status, surface, ride quality, and lighting, then atomically
replaces
`public/data/cycle-network/`. The generated release contains 37,209 segments in
423 zoom-10 chunks. Its largest asset is about 450 KiB and the measured maximum
compressed 3×3 payload is about 559 KiB. Run `pnpm verify:network` after a
refresh and treat `src/data/cycle-network-report.json` as the current snapshot
report. Do not hand-edit these generated files.

The current cycling-place release contains 66,960 unique OpenStreetMap places
in 8,254 chunks: 4,115 shops, 2,590 repair locations, 8,013 hire locations,
and 53,749 drinking-water points. Its 8,256 generated files contain about 15.3
MiB of JSON; the largest possible initial 3×3 chunk payload is about 79 KiB
compressed. The category totals overlap because one place can explicitly
support more than one service.

`pnpm update:data` performs the complete release pipeline:

1. fetch the current City of Edinburgh Council public GeoJSON;
2. download or reuse the Scotland, Wales, Ireland-and-Northern-Ireland, Canary
   Islands, and Armenia PBFs plus 47 England county and 18 Spain regional PBFs
   from Geofabrik;
3. process each region sequentially so contextual naming stays memory-bounded;
4. extract bicycle-parking nodes, ways, and relations;
5. normalize fields, representative geometry, and descriptive names;
6. deduplicate overlapping county extracts by source-qualified OSM ID;
7. merge likely Edinburgh duplicates with deterministic council priority;
8. download or reuse the England, Scotland, Wales,
   Ireland-and-Northern-Ireland, Spain, Canary Islands, and Armenia Geofabrik
   coverage polygons;
9. replace `public/data/parking/` with a schema-v2 manifest,
   content-addressed chunks, and point index;
10. enforce file, asset, initial-payload, and total-data hard budgets;
11. write the council snapshot and detailed quality report under `src/data/`.

The cached inputs currently occupy about 3.9 GB and are ignored by Git. The
first refresh depends on Geofabrik download speed and bounded retry delays; a
cached parking or cycling-place refresh avoids those downloads. The generated
reports record source
timestamps, per-input SHA-256 checksums and elapsed time, geometry counts,
field completeness, naming-tier counts and samples, discarded features,
cross-region duplicate IDs, council/OSM matches, peak memory, and output-size
budgets.

The current generated release contains 87,667 merged parking points in 4,349
chunks. It includes 1,454 council points and 87,611 unique OSM records, with 216
cross-region OSM duplicates removed and 1,398 likely Edinburgh duplicates
suppressed in favour of council records. The parking release is about 26.7 MiB;
the largest possible initial 3×3 payload is about 483 KiB compressed. Treat
these as a snapshot: `public/data/parking/manifest.json` and
`src/data/cycle-parking-report.json` are the source of truth after a refresh.

Do not hand-edit `src/data/cycle-parking.json`, the report, or generated chunks.
Change the normalizer or merge rules and rerun the refresh.

Sources:

- [City of Edinburgh Council cycle parking](https://www.edinburgh.gov.uk/cycling-walking/cycle-parking)
- [Council Public Bike Parking FeatureServer](https://services-eu1.arcgis.com/FgpikkYuSUOuITxp/arcgis/rest/services/Public_Bike_Parking/FeatureServer/0)
- [Geofabrik England extract and county inputs](https://download.geofabrik.de/europe/united-kingdom/england.html)
- [Geofabrik Scotland extract](https://download.geofabrik.de/europe/united-kingdom/scotland.html)
- [Geofabrik Wales extract](https://download.geofabrik.de/europe/united-kingdom/wales.html)
- [Geofabrik Ireland and Northern Ireland extract](https://download.geofabrik.de/europe/ireland-and-northern-ireland.html)
- [Geofabrik Spain regional extracts](https://download.geofabrik.de/europe/spain.html)
- [Geofabrik Canary Islands extract](https://download.geofabrik.de/africa/canary-islands.html)
- [Geofabrik Armenia extract](https://download.geofabrik.de/asia/armenia.html)

## Offline behaviour

The service worker caches the app shell and previously visited data. For a
predictable trip download, open **Offline areas** from the Bike Neuks menu,
choose **Download this area**, then pan and zoom the highlighted map selection.
The confirmation shows the estimated size and refresh date for each available
dataset. Completed areas are kept in a dedicated cache that survives routine
app updates and can be viewed, updated, or removed from the same panel.

Explicit areas include the bounded OpenFreeMap background through zoom 14,
cycle parking, cycling shops, repair, hire and drinking water, plus National
Cycle Network geometry where that dataset has coverage. The current
OpenFreeMap support is deliberately experimental while Bike Neuks is small and
unpublished; review the provider policy before a public launch or higher-volume
use.

Downloads are stored by the browser on the current device. Each area is capped
at 100 MB, with up to five areas and 500 MB in total. Bike Neuks keeps 20% of
the browser-reported quota free, downloads at most two OpenFreeMap resources at
a time, and limits request starts to about five per second. Downloads never
start or update automatically. Bike Neuks requests persistent storage when
supported, but the browser may still remove site data under storage pressure or
when site data is cleared. It recommends refreshing an area after 30 days and
marks it stale after 90 days, without deleting or disabling it.

If a downloaded background is unavailable, Bike Neuks switches to a simple
local background while continuing to show downloaded cycling data. Live place
search, new CycleStreets route calculation, Street View, and areas that were
not downloaded still need a network connection. Saved routes retain their
existing local geometry and instructions.

## Sharing

Parking links use a stable query such as `/?parking=cec%3A1`. The point index
loads the correct spatial chunk even when the stand is not near the current map
view. Legacy Edinburgh IDs such as `?parking=1` are resolved to their `cec:` ID.

The static build deliberately does not create one HTML page and SVG social
image per parking point. Regular sharing works, but every stand uses the site's
general social preview.

## Mock GPS

On localhost or a loopback host, add mock GPS parameters for browser testing:

```text
/?parking=cec%3A1&mockGps=55.9406042783081,-3.29451047885751,5
/?parking=cec%3A1&mockGpsPath=55.94055,-3.29460,5;55.9406042783081,-3.29451047885751,5&mockGpsStepMs=1000
/?parking=cec%3A1&mockGps=denied
/?parking=cec%3A1&mockGps=unavailable
/?mockGps=40.4168,-3.7038,5
/?mockGps=28.1235,-15.4363,5
/?mockGps=40.1777,44.5126,5
/?mockGps=40.7869,43.8382,5
/?mockGps=null-island
```

Production hosts always use the browser geolocation API.

## Deployment

### Production: Cloudflare Pages

Cloudflare Pages is the production host for this static app.
It can serve the existing `out/` directory directly, adds edge delivery and
compression, and applies the cache and security policy in `public/_headers`.
No Worker runtime, database, paid API, or new application dependency is needed.
The custom domain is [neuk.bike](https://neuk.bike/), and the same deployment
is available at [neuk-bike.pages.dev](https://neuk-bike.pages.dev/).

The existing `neuk-bike` Pages project uses Direct Upload. Successful pushes to
`main` run the GitHub Actions quality checks, rebuild the production export with
the repository's public environment secrets, and deploy `out/` to Cloudflare
with Wrangler. Pull requests run the same quality checks without deploying.

The deployment job requires these GitHub Actions secrets:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`, scoped to Account > Cloudflare Pages > Edit
- `NEXT_PUBLIC_CYCLESTREETS_API_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_POSTHOG_KEY`

The repository also includes `wrangler.jsonc` and a repeatable manual fallback.
Create a new Direct Upload project only when bootstrapping a separate host:

```bash
pnpm exec wrangler pages project create neuk-bike --production-branch main
```

Deploy manually when the automatic workflow is unavailable with:

```bash
pnpm deploy:cloudflare
```

This builds locally with the existing public environment variables and uploads
the unchanged `out/` export. Verify both the generated `pages.dev` URL and
`neuk.bike` after every production deployment. Cloudflare Pages deployment
history and the provider URL provide the rollback path.
See Cloudflare's [static Next.js guide](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/)
and [custom header documentation](https://developers.cloudflare.com/pages/configuration/headers/).

### Previous host: GitHub Pages

GitHub Pages was retired after the Cloudflare custom domain, HTTPS, environment
features, caching, and PWA behaviour were verified. Pull requests run the
GitHub Actions quality checks, and successful pushes to `main` deploy the static
export to the existing Cloudflare Pages Direct Upload project.

## Attribution

Council records:

```text
Copyright City of Edinburgh Council, contains Ordnance Survey data (c) Crown copyright and database right 2026.
```

- [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)

OpenStreetMap-derived records and map/search data:

- Data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
  available under the [Open Database Licence 1.0](https://opendatacommons.org/licenses/odbl/1-0/)
- [Photon](https://photon.komoot.io/)

National Cycle Network:

- [Walk Wheel Cycle Trust National Cycle Network](https://www.arcgis.com/home/item.html?id=5defd254e78745bfb12d0456abc1bcf1),
  available under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/)

Cycle directions:

- [CycleStreets](https://www.cyclestreets.net/)

## License

This project is released under the [MIT License](./LICENSE).
