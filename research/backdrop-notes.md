# Thermal Blocks v2: backdrop research

How the painted era backdrops were made accurate, what is sourced, what is artistic, and the known errors.
New research for the visual pass (2026-10-28/29). Facts reused from the shared corpus cite their corpus file.

## 1. The view

The initial Blender elevation guide (`art-src/blender/backdrop.py`) modeled one east-facing reference view from the lower east slope of West Mountain, above the west side of Central Avenue, looking east across Bathhouse Row to Hot Springs Mountain; the final shipped painted WebP vistas (`assets/era-*.webp` and `assets/title-hero.webp`) adapt that terrain and Row order into picturesque hill views highlighting Maurice, Fordyce, Quapaw, the 1933 Army & Navy General Hospital spire, and north-valley Arlington Hotel cues (detailed per painting in §3 and §4).

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

## 3. What each shipped painting actually shows, and its basis

The initial Blender elevation guide (`art-src/blender/backdrop.py`) established the USGS terrain profile and Bathhouse Row N→S order; the final 8 shipped WebP paintings (`assets/era-*.webp` and `assets/title-hero.webp`) translate that layout into elevated picturesque hill vistas overlooking Central Avenue and Bathhouse Row (notably the Maurice, Fordyce, Quapaw, and neighboring Row rooflines) toward Hot Springs Mountain, the 1933 Army & Navy General Hospital spire on the east ridge, and the 1924 Arlington Resort Hotel rising at the north valley edge where visible. In runtime, `ERA_CROP` (`index.html`) frames each painting per viewport (keeping the 1933 hospital spire clear on desktop and dialing portrait zoom to `1.04×–1.08×` so ground-level human-scale cues stay legible), and the 0-KB Era Postcard Lightbox (`#sc-lightbox`) lets players inspect every unlocked painting unobstructed.

| Era | Shipped painting (`assets/*.webp`) | Basis & honest notes |
|---|---|---|
| Ancient (before 1804) | Forested creek valley, open hot springs, travertine tufa terraces with algae, rising steam plumes; no buildings or tower (`era-ancient.webp`; also reused across Springs' 3-Act Valley of Vapors progression) | Tufa, algae, steam: `geography-lakes-mountains.md` (Wikipedia HSNP; NPS); "Valley of Vapors" nickname (npshistory, via the corpus) |
| Frontier (1804–1874) | Timber cabins, wooden plank bath sheds, and a steaming wooden flume over spring pools along the creek and dirt road; no tower (`era-frontier.webp`) | Era id and range: `timeline.json`. Building forms are representative of the frontier bathing period rather than measured specific structures |
| Gilded Spa (1875–1920) | Victorian wooden bathhouses with verandas and turrets, strolling visitors along Central Avenue, and the slender open-steel 1906 Rix tower on the ridge; first Army-Navy Hospital (1887) is omitted in favor of forest (`era-gilded-spa.webp`) | "1880–1888: larger Victorian bathhouses"; 1912–1923 brick replaced wood: `bathhouse-row-and-springs.md` (NPS). Rix tower 1906, about 165 ft: `other-attractions.md` |
| Roaring (1921–1946) | Brick Bathhouse Row at night (Maurice, Fordyce, Quapaw and neighboring facades) with warm lit windows and subtle neon glow, 1924 Arlington Hotel / streetlamp cues toward the north end, Rix lattice tower, and the 1933 Army & Navy General Hospital spire on the east hill (`era-roaring.webp`) | Superior's green neon and Maurice's orange neon: `bathhouse-row-and-springs.md` (EOA; Wikipedia). Row brick facades finished 1923; present Arlington dates from 1924; present Army & Navy Hospital dates from 1933 (`downtown-and-landmarks.md`) |
| Midcentury (1947–1967) | Sunlit summer midday along Bathhouse Row (Maurice, Fordyce, Quapaw prominent) with pastel 1950s cruisers on Central Avenue, the 1933 Army & Navy Hospital, and the Rix lattice tower; modern Maurice rooftop chillers are absent (`era-midcentury.webp`) | Rix tower stood until 1971 or 1975 (conflict kept in `other-attractions.md`); modern rooftop cooling chillers were not yet installed |
| Revival (1968–1999) | Autumn dusk over Bathhouse Row and the 1933 hospital ridge with the current 1983 Mountain Tower lit; **note:** the shipped painting depicts warm lit evening windows across the Row rather than darkened shuttered bathhouses (modern Maurice chillers are absent) (`era-revival.webp`) | Historical bathhouse closures (1962–1985) and 1989 Fordyce reopening are carried truthfully in the Era Postcard caption (`ERAS[5].cap`); current tower opened June 3, 1983 |
| Modern (2000–2026) | Golden-hour restored Bathhouse Row (Maurice, Fordyce, Quapaw, strolling pedestrians, modern Maurice rooftop chillers/HVAC visible), 1933 hospital ridge, 1924 Arlington Hotel silhouette to the north, and the current Mountain Tower (`era-modern.webp`) | Current adaptive reuses (brewery, hotel, visitor center, spa, cultural center): `bathhouse-row-and-springs.md` |
| Title (today) | Winter sunrise over Bathhouse Row (including modern Maurice rooftop chillers), thick rising cold-air steam, bare oaks, green pines, and the current Mountain Tower (`title-hero.webp`) | Steam is most visible in cold winter air (general knowledge); artistic sunrise composition |

Facade features used as painter references (all from `bathhouse-row-and-springs.md`): Superior's flat parapet and
green tile medallions; Hale's red tile hipped roof; Maurice's green tile roof; Fordyce's cream brick, low red hip roof
and copper-and-glass marquee; Quapaw's chevron-mosaic tiled dome with copper cupola; Ozark's twin towers stepping in
three tiers with red tile caps; Buckstaff's columns and seven bays; Lamar's plain flat parapet.

## 4. Known errors and liberties (say so rather than hide them)

- **Shipped vistas vs. initial Blender elevation guide.** While the Blender guide (`art-src/blender/backdrop.py`) placed the Arlington Resort Hotel and Medical Arts Building north of the camera frustum, the final shipped painted vistas pull in picturesque landmark cues along Central Avenue (highlighting Maurice, Fordyce, Quapaw, the 1933 Army & Navy General Hospital spire, and north-valley Arlington Hotel cues in later eras) rather than strict photogrammetric projections.
- **Revival evening windows (`era-revival.webp`).** The initial brief asked for darkened shuttered windows to evoke the 1962–1985 closures, whereas the shipped autumn-dusk painting renders warm lit windows across the Row. Rather than falsify the notes, we document the painted warmth here and keep the historical closure timeline truthful in `ERAS[5].cap`.
- **Modern Maurice rooftop chillers.** Contemporary rooftop HVAC/chiller units behind/atop the Maurice appear in `era-modern.webp` and `title-hero.webp` (today's Row) and are properly absent in `era-midcentury.webp` and `era-revival.webp`.
- **Sun position in the title art.** The sun rises at the left (north-east) of a view facing east. That matches a
  summer sunrise; a winter sunrise would be south of east, at the right. Kept for composition; noted here.
- **Painted details are not measured.** Window counts, tree positions, strolling pedestrians, the Victorian facades of the Gilded Spa era,
  the frontier cabins/flume, and the 1950s cars are artistic. Terrain elevation and N→S Row order follow USGS 3DEP and OSM.
- **Hospital chronology.** The 1933 Army & Navy General Hospital building appears in `era-roaring.webp` (covering 1921–1946) even though it replaced the 1887 first Army-Navy Hospital in 1933; `era-gilded-spa.webp` omits the 1887 hospital in favor of a forested hill.
- **The Rix tower** is drawn as a generic slender lattice; no measured drawing was found.

## 5. Facts worth adding to the shared `research/` (not edited here)

1. The Bathhouse Row north-to-south order is confirmed by OpenStreetMap footprints (table in §2); the
   **[UNVERIFIED]** flag in `bathhouse-row-and-springs.md` can be lifted, citing OSM (ODbL).
2. Hot Springs Mountain Tower ground elevation: 1,036 ft (USGS EPQS at 34.51723, −93.04611), so the tower top is
   about 1,252 ft. This replaces the **[inferred]** summit range (1,000–1,070 ft) in `geography-lakes-mountains.md`.
3. Bathhouse Row centroids from OSM (table in §2) can replace the interpolated "est." coordinates in the landmarks table.
4. The 3DEP `exportImage` trailer gotcha (§1) for any game that builds terrain.
