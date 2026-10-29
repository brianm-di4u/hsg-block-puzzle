# Thermal Blocks v2: backdrop research

How the painted era backdrops were made accurate, what is sourced, what is artistic, and the known errors.
New research for the visual pass (2026-10-28/29). Facts reused from the shared corpus cite their corpus file.

## 1. The view

All eight paintings show one real view: from the lower east slope of West Mountain, above the west side of
Central Avenue, looking east across Bathhouse Row to Hot Springs Mountain.

| Item | Value | Source |
|---|---|---|
| Camera (Blender guide) | 34.5134 N, 93.0556 W; eye 55 m above ground (ground ≈ 219 m); azimuth 90°; 74° horizontal field of view | `art-src/blender/backdrop.py` (game design) |
| Terrain | USGS 3DEP 1/3 arc-second DEM, bbox 93.090–92.970 W, 34.470–34.560 N, 480×360 samples | `tools/skyline.mjs`; USGS National Map ImageServer (public domain) |
| DEM check | Five USGS EPQS point queries agree with the sampled DEM within ±21 ft | `tools/skyline.mjs` session log; EPQS `epqs.nationalmap.gov/v1` |
| Hot Springs Mountain Tower | 34.51723, −93.04611; ground 1,036 ft (EPQS, 1 m lidar); 216 ft tall | Coordinates and height: `research/other-attractions.md` (Wikipedia: Hot Springs Mountain Tower); ground: EPQS query 2026-10-28 |
| Tower sits on the summit | The DEM's local high point (1,039 ft) is about 170 m north of the tower coordinate, on the same summit ridge; the tower's own ground is 1,036 ft | EPQS + DEM (this pass) |
| Skyline profile | Ray-cast panorama, three depth bands, from a street-side viewpoint | `research/skyline.json` (used by the vector fallback backdrop) |

A note for anyone reusing the 3DEP `exportImage` call: with `format=bip` the service appends a 21,600-byte trailer
after the W×H floats. Read only W×H×4 bytes, or the raster is misaligned by several rows (we first got a tower
ground of 908 ft instead of 1,036 ft).

## 2. Bathhouse Row order, confirmed

`research/bathhouse-row-and-springs.md` lists the north-to-south order as **[UNVERIFIED]**. OpenStreetMap footprints
(centroid latitudes, ODbL, Overpass query 2026-10-29) confirm it:

| N→S | Bathhouse (OSM name) | OSM way | Centroid lat, lon |
|---|---|---|---|
| 1 | Superior Bathhouse Brewery | way/1002548146 | 34.51488, −93.05331 |
| 2 | Hotel Hale | way/1002531001 | 34.51458, −93.05343 |
| 3 | Maurice Bathhouse | way/1213679525 | 34.51413, −93.05340 |
| 4 | Fordyce Bathhouse Vistor Center (sic) | way/999352516 | 34.51375, −93.05352 |
| 5 | Quapaw Baths & Spa | way/1002546215 | 34.51326, −93.05351 |
| 6 | Ozark Bathhouse | way/1213679527 | 34.51278, −93.05360 |
| 7 | Buckstaff Bathhouse | way/999348743 | 34.51247, −93.05354 |
| 8 | Lamar Bathhouse | way/1213679526 | 34.51216, −93.05366 |

Also in the query: Arlington Resort Hotel & Spa (34.51703, −93.05294), Medical Arts Building (34.51652, −93.05400),
Army-Navy Hospital (34.51224, −93.05259, on the hill east of the south end of the Row), Administration Building
(34.51193, −93.05360). Full footprints: `research/bathhouse-row-osm.json`.

## 3. What each painting shows, and its basis

| Era | Shows | Basis |
|---|---|---|
| Ancient (before 1804) | Forest, open creek, tufa terraces with algae, many steam plumes; no buildings or tower | Tufa, algae, steam: `geography-lakes-mountains.md` (Wikipedia HSNP; NPS); "Valley of Vapors" nickname (npshistory, via the corpus) |
| Frontier (1804–1874) | Log cabins and plank bath sheds over spring pools along the creek and a dirt road; no tower | Era id and range: `timeline.json`. Building forms are generic for the period, not specific structures |
| Gilded Spa (1875–1920) | Victorian wooden bathhouses with verandas and turrets; an open steel lattice tower (the 1906 Rix tower) | "1880–1888: larger Victorian bathhouses"; 1912–1923 brick replaced wood: `bathhouse-row-and-springs.md` (NPS). Rix tower 1906, about 165 ft: `other-attractions.md`. Individual Victorian facades are representative, not specific |
| Roaring (1921–1946) | Today's Row at night, warm windows, neon glow on two facades (no letters); Rix tower; Army and Navy Hospital | Superior's green neon script and the Maurice's orange neon sign: `bathhouse-row-and-springs.md` (EOA; Wikipedia). The hospital building shown dates from 1933 (`downtown-and-landmarks.md`, Army & Navy Hospital HD: "1887; 1933"); the Row was complete in 1923 |
| Midcentury (1947–1967) | The Row at summer midday, pastel 1950s cars; Rix tower | Rix tower stood until 1971 or 1975 (conflict kept in `other-attractions.md`) |
| Revival (1968–1999) | Autumn dusk, several Row windows dark (closures 1962–1985); the current tower lit | Closures: `bathhouse-row-and-springs.md`; current tower opened June 3, 1983 |
| Modern (2000–2026) | Golden hour, restored Row, current tower | Current uses (brewery, hotel, cultural center, visitor center): `bathhouse-row-and-springs.md` |
| Title (today) | Winter sunrise, thick steam, bare oaks and green pines | Steam is most visible in cold air (general knowledge); artistic |

Facade features requested from the painter (all from `bathhouse-row-and-springs.md`): Superior's flat parapet and
green tile medallions; Hale's red tile hipped roof; Maurice's green tile roof; Fordyce's cream brick, low red hip roof
and copper-and-glass marquee; Quapaw's chevron-mosaic tiled dome with copper cupola; Ozark's twin towers stepping in
three tiers with red tile caps; Buckstaff's columns and seven bays; Lamar's plain flat parapet.

## 4. Known errors and liberties (say so rather than hide them)

- **Sun position in the title art.** The sun rises at the left (north-east) of a view facing east. That matches a
  summer sunrise; a winter sunrise would be south of east, at the right. Kept for composition; noted here.
- **Painted details are not measured.** Window counts, tree positions, the Victorian facades of the Gilded Spa era,
  the frontier cabins and the 1950s cars are artistic. Silhouettes, order and positions follow the Blender guide.
- **The Arlington Hotel and the Medical Arts Building** stand north of the Row (left of this view) and are mostly
  outside the frame; they are not shown.
- **Hospital in the Roaring era** appears from 1921 although the present building is from 1933.
- **The Gilded Spa painting omits the first Army-Navy Hospital** (1887, the first joint Army-Navy general hospital: `hot-springs-national-park.md`, EOA); the hill is drawn as forest.
- **The Rix tower** is drawn as a generic slender lattice; no measured drawing was found.

## 5. Facts worth adding to the shared `research/` (not edited here)

1. The Bathhouse Row north-to-south order is confirmed by OpenStreetMap footprints (table in §2); the
   **[UNVERIFIED]** flag in `bathhouse-row-and-springs.md` can be lifted, citing OSM (ODbL).
2. Hot Springs Mountain Tower ground elevation: 1,036 ft (USGS EPQS at 34.51723, −93.04611), so the tower top is
   about 1,252 ft. This replaces the **[inferred]** summit range (1,000–1,070 ft) in `geography-lakes-mountains.md`.
3. Bathhouse Row centroids from OSM (table in §2) can replace the interpolated "est." coordinates in the landmarks table.
4. The 3DEP `exportImage` trailer gotcha (§1) for any game that builds terrain.
