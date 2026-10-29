# Thermal Blocks: visual enhancement plan (v2)

Baseline: `screenshots/visual-before/` (50/50 tests). Benchmarks: Blockudoku, Woodoku, Block Blast!, 1010! (store
screenshots) and Tetris Effect: Connected (Steam) in `benchmarks/` (git-ignored, review only).

## Baseline review (independent adversarial reviewer, before any change)

| Axis | Ours | Best benchmark |
|---|---|---|
| Block and board materials | 4 | Woodoku 9 |
| Lighting and depth | 3 | Tetris Effect 10 (in genre: Woodoku 8) |
| Animation and game feel | 3 | Block Blast 9 |
| UI layout and HUD | 4 | Block Blast 9 |
| Typography | 4 | Woodoku 9 |
| Board readability | 6 | Blockudoku 9 |
| Mobile layout | 5 | Block Blast / Woodoku 9 |
| Sense of place | 3 | none place-specific; Woodoku journey scenes 7 |

Top gaps, in the reviewer's order: clear effects look like a rendering bug (ghost tiles and thin ellipses, popups
clipped); giant mostly empty side panels and tray boxes; tray pieces lost in their slots; backgrounds are generic shapes
rather than Hot Springs; stray neon rectangles read as debug boxes; flat chiclet tiles with no lighting model; weak drag
preview; web-app header with no score hierarchy; three unrelated type families and 9 px text; a title screen that is a
settings form; dead space on mobile; translucent panels over busy art; muddy palette that changes every era; tufa reads
as a scribble; busy frame; no celebration on new best; inconsistent dark theme.

## Direction: 2D board, rendered materials, a real place behind it

The board stays a flat, crisp 2D grid: in this genre readability is the product, and every benchmark is a top-down 2D
board. Depth comes from rendered materials, light and effects, not a 3D camera.

- **Blocks:** glazed ceramic tiles rendered in Blender (Cycles: beveled body, glossy clear-coat glaze, soft contact
  shadow baked in). One fixed, saturated six-color palette tuned against the water, so pieces are learned once. Eras
  change the frame and backdrop, not the tiles. Colorblind patterns are drawn on top in code as pressed-in glaze marks.
- **Board:** a bathhouse pool basin. Blender-rendered frame (marble rim, brass inlay, glazed tile border after the Row's
  tile work), and **live thermal water** in the cells: a small WebGL fragment shader (procedural caustics, no textures, so
  it works under `file://`) that ripples when groups clear. Canvas 2D fallback: a cached painted water gradient.
- **Backdrop:** the real view east from Central Avenue: Bathhouse Row in front, Hot Springs Mountain behind with the
  Mountain Tower on the summit, North Mountain to the left. Geometry comes from USGS 3DEP elevation (public domain) and
  OpenStreetMap footprints (ODbL); Blender renders a composition guide from the true viewpoint; Codex paints each era
  over that guide, so silhouettes stay accurate while the finish is painterly. Steam drifts over it in code.
- **Eras = time travel in the same view.** Ancient: forested valley, steam, no buildings. Frontier (1804–1874): log and
  plank bath huts along the open creek. Gilded Spa (1875–1920): Victorian wooden bathhouses, Woolman's wooden tower (1877)
  or the steel Rix tower (1906). Roaring (1921–1946): today's brick Row at night with neon, Rix tower. Midcentury: Row by day,
  motor-hotel pastel light. Revival (1968–1999): the 1983 216-ft tower at dusk. Modern: golden hour, restored Row, tower.
- **Juice:** additive flash, tiles popping into glazed shards and steam puffs (sprite steam made procedurally at boot),
  ring shockwaves on the water, a centered, outlined score pop, a combo banner that escalates with heat and with how many
  groups clear at once (Warm, Hot, Steaming, Scalding, Boiling), a soft camera nudge, and a placement squash.
  Reduced motion keeps a short flash and the popup only (as today).
- **Layout:** no side panels. A big display score above the board, best score small beside it; heat becomes a slim
  brass thermometer along the board's edge; the tray is an open shelf of three pieces at full readable size. Mobile:
  score, board, tray, nothing wasted.
- **Type:** one display face (Fraunces, OFL, embedded as a base64 WOFF2 subset) for logo, score and headings; system sans
  for UI text; no monospace numbers. Minimum 12 px desktop / 13 px mobile for canvas text.
- **Title:** full-bleed painted hero of the Row and the mountain, a large logo, one dominant Play button, modes as
  secondary buttons.

## Asset list

| Asset | Tool | Count | Size target |
|---|---|---|---|
| Era backdrops (painted over the Blender guide) | Codex image generation | 7 + 1 title hero | 1600×1000 WebP q0.8, ≈ 120–200 KB each |
| Composition guide renders (terrain, tower, Row massing) | Blender (`art-src/blender/backdrop.blend`) | 1–3 | review only |
| Glazed tile sprites: 6 colors, tufa, vent, empty well | Blender Cycles (`art-src/blender/tiles.blend`) | 9 | 160 px each, one atlas ≈ 120 KB |
| Board frame | Blender | 1 | 1024 px with transparent centre ≈ 150 KB |
| Water | WebGL fragment shader, inline | 1 | 0 KB |
| Steam puffs, sparks, shards | procedural canvas sprites at boot | — | 0 KB |
| Display font | Fraunces (OFL) from npm `@fontsource/fraunces`, Latin subset | 1 | ≈ 40 KB base64 |

Total download goal: ≤ 2.5 MB, first paint from `index.html` alone (vector fallback art), assets streamed in by
priority: tiles and frame, then the current era backdrop, then the rest when idle.

## Research additions (`research/`)

- `skyline.json` + `tools/skyline.mjs`: ray-cast panorama from USGS 3DEP 1/3 arc-second terrain, checked against USGS EPQS
  point elevations (within ~20 ft); Mountain Tower at 34.51723, −93.04611, ground ≈ 1,036 ft (EPQS), 216 ft tall.
- Bathhouse Row footprints and order from OpenStreetMap (ODbL, attribution in SAMPLES.md and the credits screen).
- Tower history by era (Woolman wooden tower 1877; Rix steel tower 1906–1971/75; current tower 1983) from the shared corpus.
- Facade features per bathhouse (Quapaw chevron dome, Ozark twin stepped towers, Fordyce lozenge brick and marquee, Hale
  red hip roof, Buckstaff seven bays, Superior paterae, Lamar flat parapet) from `research/bathhouse-row-and-springs.md`.

## Performance plan

- Keep render-on-demand for the 2D canvas. Water shader runs at display rate only while visible and animating, capped to
  30 fps when idle (ambient shimmer), full rate during clears; paused when the tab is hidden; off under reduced motion.
- All sprites cached per size/DPR as today; the backdrop is drawn once per resize into a cached layer.
- Budgets: ≥ 55 fps during multi-clears at both viewports in the harness; heap ≤ 40 MB; hooks ready ≤ 300 ms;
  first meaningful paint without waiting for images.
- Fallbacks: `?gl=0` or no WebGL → 2D water; `?art=0` or image failure → current vector art; a "Effects: full / lite"
  setting (lite = no shader, fewer particles), auto-lite if measured fps < 40 for 2 s.

## Test plan

- All 50 existing tests keep passing (layout hooks `layout()` keep the same shape; drag lift stays `cell × 1.6`).
- New `tests/visual.test.mjs`: assets listed in `assets/manifest.json` all load (no 404), `isIdle()` false while loading,
  `?art=0` and `?gl=0` fallbacks render without errors, WebGL water present when supported, combo banner levels, score
  popup stays inside the board, tray piece scale ≥ 0.8 of a board cell on mobile, no text under 12 px in the canvas HUD.
- `file://` check: load `index.html` via `file://` in the harness browser and confirm the board draws with zero errors.
- Screenshots at both viewports for every era, every FX stage, title, modals; adversarial review after each milestone.

## Milestones

1. **M-A Layout and juice (code only).** New HUD and tray layout, fixed palette, new clear and combo FX, drag feel.
2. **M-B Materials.** Blender tiles and frame, WebGL water with ripples, embedded font.
3. **M-C Place.** DEM/OSM-guided painted era backdrops and title hero, steam layers, title redesign.
4. **M-D Polish and performance.** Modals and celebration, dark theme alignment, fps/memory pass, fallbacks, final review.
