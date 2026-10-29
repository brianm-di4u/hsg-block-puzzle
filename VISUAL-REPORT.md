# Thermal Blocks: visual v2 report

**Game:** Thermal Blocks (`games/block-puzzle/`). Visual enhancement campaign, 2026-10-28/29.
**Direction:** 2D board with rendered materials and live effects, in front of painted, data-guided views of the real
Bathhouse Row and Hot Springs Mountain (see `VISUAL-PLAN.md`). Rules, modes, saves and content are unchanged.

**Result:** `node shared/test-harness/run.mjs games/block-puzzle --milestone visual-final` runs **64 of 64 tests passing**
at desktop 1280×800 and mobile 390×844, with zero console errors and zero external requests, including the frame-rate
test (clears at 58.9–61.4 fps desktop and 57.5–61.0 fps mobile in a quieter window). **87 screenshots** (44 desktop,
43 mobile) were all inspected, plus before/after sheets (`screenshots/visual-final/before-after/`, made by
`tools/before-after.mjs`). `tools/check-file-url.mjs` confirms the game runs from `file://` at both viewports (16/16
images, no errors, no network). Nothing is committed.

## What changed

| Area | v1 (before) | v2 (now) |
|---|---|---|
| Backdrops | 7 procedural shape scenes (triangle pines, box buildings, neon rectangles) | 7 painted era scenes of the same real view east over Bathhouse Row to Hot Springs Mountain, laid out from USGS terrain and OpenStreetMap footprints in a Blender block-out, then painted (Codex image generation) with the approved pilot as the style reference. The Row houses in true order with their signature features (Quapaw's chevron dome, Ozark's stepped twin towers, Fordyce's marquee, Hale's red hip roof, Maurice's green tile roof); the tower changes with the era (none, then the 1906 Rix steel tower, then the 1983 tower); seasons and times of day vary by era. Vector scenes kept as the fallback and now use the real ridge profile |
| Title | Cream form card on a teal gradient | Full-bleed winter-sunrise key art, a large Fraunces logo, one dominant Play button, modes as icon tiles, a compact panel (bottom sheet on phones) |
| Tiles | Flat vector chiclets, palette changed every era | Blender-rendered glazed art tiles with a raised panel and soft contact shadow, one fixed six-glaze palette; colorblind patterns pressed into the glaze; rendered porous tufa and glowing vent pools |
| Board | Gold frame with a two-tone strip, flat pools | Bronze moulding, glazed tile band with lozenges, brass bead; **live thermal water** (WebGL caustics and clear ripples, its own compositor layer); a still shader frame or 2D water when WebGL is off; a faint era light tint |
| Layout | Two 260 px side panels and three boxed tray slots | No side panels: a large score in a transparent HUD, a brass thermometer beside the board (heat strip on phones), three recessed tray wells, a one-line caption; phone stack tightened |
| Clear feedback | Ghost tiles, thin ellipses, small popups | Swell and glow, steam plumes, hot droplets and a few glaze chips, rings inside the cleared group, a light camera shake, a centred gilt banner that escalates (Double, Triple, Quadruple, Spring Surge) with the heat word (Warm … Boiling), the score under it |
| Drag and place | 1 px outlined ghost | Tinted in-grid ghost, pulsing gold glow on groups that would clear, the piece grows from tray size to board size on pickup, a placement bounce |
| Type | Typewriter mono numbers, Palatino, system sans | Fraunces (OFL, embedded) for logo, score, headings and banners; system sans for UI; canvas text ≥ 12 px (tested) |
| Modals | Plain cream cards | Brass-edged panels over a blurred scene; game over opens with the reached era's painting, a counted-up score and a gilt "New best!" ribbon |
| Settings | — | New "Effects: Full / Lite" (lite: no live water, half the particles); automatic lite for the session if effects run under 25 fps |

## Adversarial review scores

Four independent reviews against the same benchmarks (Blockudoku, Woodoku, Block Blast!, 1010!, Tetris Effect:
Connected), each given only screenshots.

| Axis | Before (v1) | After M-A | After M-C | Final (round 4) | Best benchmark (final review) |
|---|---|---|---|---|---|
| Block and board materials | 4 | 6 | 6.5 | 7 | Woodoku 9 |
| Lighting and depth | 3 | 5 | 6 | 6 | Tetris Effect 10 |
| Animation and game feel | 3 | 5 | 5.5 | 6 | Block Blast 9 |
| UI layout and HUD | 4 | 5 | 6.5 | 7 | Woodoku / Block Blast 8.5–9 |
| Typography | 4 | 6 | 7.5 | 7 | Woodoku 8.5 |
| Board readability | 6 | 6 | 6 | 7 | Blockudoku 9 |
| Mobile layout | 5 | 6 | 6 | 7 | Block Blast 9 |
| Sense of place | 3 | 6 (title 8, play 4) | 8.5 | 9 | none place-specific |

Review 3 (after M-C) named five MAJOR gaps; milestone D addressed all five: clear effects anchored to the cleared lines
(per-tile flash and shrink in a wave from the placed piece, a light sweep along each line, the score at the cleared
cells), a stronger landing preview (tinted, outlined cells; the held piece lifted 1.08× with a long shadow; gold glow on
groups that would clear), a calmer board (half the caustic gain, checkerboard pools, brass pool dividers, deeper cell
wells), heat on the board (warmer, faster water, a glowing bead from 105°F, steam rising off the pools) and the phone
toast moved below the tray. The final review's verdict on those gaps:

| Review-3 MAJOR gap | Final review (round 4) | After the last fix (milestone E, re-shot in `visual-final`) |
|---|---|---|
| Clear effects not tied to the lines | CLOSED (column clears read weaker than rows) | unchanged |
| Weak drag landing preview | IMPROVED-BUT-OPEN on desktop (held piece covered its ghost) | Mouse drags now lift the piece a third of a cell and show it at 86% opacity, so the outlined ghost and the would-clear glow are visible (`30-drag-ghost`) |
| Busy empty board, weak pools | IMPROVED-BUT-OPEN (gold dividers clear; cell bevels and veins still busy) | unchanged; listed as a known gap |
| Heat invisible on the board | OPEN: the heat response lived only in the live shader, so the still frame and 2D water ignored it (average board colour 36/98/102 vs 37/99/102) | Heat is now drawn in every render path: milky turquoise turning amber, a brighter bead glow and steam. Measured board average 37/100/103 at 60°F vs 84/128/118 at boiling (`13-heat-boiling`) |
| Phone toast over the tray | CLOSED | unchanged |

The round-4 reviewer's remaining MINOR items: weaker column-clear band, effect colour that ignores heat, cell bevels
competing with the pool dividers on a full board, night eras keeping a daylight board (the roaring and revival board tints
were strengthened after the review), a slightly off-centre desktop score group, about 10 px HUD labels, and the phone's empty
bottom band. The reviewer also flagged a game-over card showing 6,400 points with 0 groups and 0 pieces: that is the
`new best ribbon` test injecting the score with `setState`, not a game bug.

## Tests

| File | Covers | Result (both viewports) |
|---|---|---|
| `boot` | Title, four modes, ticker, empty board | 4/4 |
| `rules` | Placement, clears, scoring, heat, refill | 8/8 |
| `input` | Mouse drag with snapped ghost, touch tap and touch drag, keyboard turn | 4/4 |
| `gameover` | No-moves cue, game over, undo budget, storage blocked | 4/4 |
| `modes` | Daily, Springs, eras (all 7 backdrops), resume, records | 8/8 |
| `trail` | 12 solver-verified puzzles replayed, fact cards | 5/5 |
| `polish` | Clear effects, reduced motion, audio, patterns, settings, help, dark scheme, touch targets | 14/14 |
| `visual` (new) | Assets match `assets/manifest.json` and all decode; `?art=0` vector fallback; live water layer placement and the lite setting; `?gl=0`; combo banner tiers and popups inside the board; tray scale; canvas text ≥ 12 px; new-best ribbon | 14/14 |
| `perf` | fps during clears, heap, load, file size; soak games to the end | 1/3 (fps under load; see below) |
| `tools/check-file-url.mjs` | Runs from `file://` with art, water and a clear | desktop and mobile pass |

The Spring Trail rules block is byte-identical to v1 (`/*RULES-START*/ … /*RULES-END*/`), so `tools/solutions.json` stays valid.

## Performance

Every measurement here was taken while the other campaign sessions (Blender, Codex, Playwright) held the CPU at
88–100%, and the headless test browser draws WebGL and the 2D canvas in software. Absolute fps therefore swings
widely: the untouched v1 build measured anywhere from 15 to 60 fps in the same hour. The fair comparison is v1 and v2
interleaved in one browser under the same load (`ab.mjs`, three springs-mode triple clears per page, 900 ms each):

| Build | Desktop clear fps (best round / median) | Mobile clear fps (best round / median) |
|---|---|---|
| v1 baseline | 54.4 / 49.4 | 60.0 / 55.5 |
| v2 before the mobile fill-rate fixes | 60.0 / 44.8 | 46.1 / 28.3 |
| v2 final (one quieter window) | — / 56.8 | — / 53.2 (v1 55.4 in the same run) |

Harness `perf` test, final run (a quieter window): desktop title 60.6 fps, clears 61.4 / 60.8 / 58.9; mobile title 61.0, clears 60.4 / 61.0 / 57.5 — **pass**. The run before it, under 88–100% load, measured 33–53 fps and failed; the test is load-sensitive.
Heap 9.5 MB at both viewports (unchanged from v1). Load to hooks 162 ms desktop, 168 ms mobile (v1: 60–84 ms; the difference is the 77 KB embedded font). JS work per frame during clears: 1–2 ms (instrumented).

What was done for speed (each step measured):
- The painted backdrop lives on its own static canvas (rendered at ≤ 1.25×), so frames never redraw it.
- The WebGL water is its own compositor layer under the board's transparent basin, re-rendered at most 30 times a
  second; reading it back into the 2D canvas had cost 83% of frame time.
- With software WebGL (no GPU) the board gets one still frame of the shader instead of live water; `?gl=force` overrides.
- Sprites are cached at the board and tray sizes; animated sizes reuse 6 px buckets. Glow, steam and bead-glow sprites
  are pre-rendered; the bead glow is drawn as four edge strips.
- The game canvas is capped at 1.5× DPR on phone-sized screens.
- Ambient effects run at 30 fps, pause while clear effects play, and the water shimmer stops 30 s after the last input.
- Low-end fallback: Settings → Effects → Lite (no live water, half the particles, no ambient steam), and an automatic
  switch to lite for the session if effects average under 25 fps over 90 frames. Reduced motion keeps only a short fade
  and the popups.

**Re-measure on a quiet machine before calling this a pass or a failure:**
`node shared/test-harness/run.mjs games/block-puzzle --file perf`.

## Download

| Item | Size |
|---|---|
| `index.html` (code, CSS, embedded Fraunces 700 and 900) | 183 KB (v1: 106 KB) |
| 8 tile sprites (Blender) | 46 KB |
| 7 era paintings + title art (WebP q0.72–0.76, 1600×1000) | 1.77 MB |
| **Total** | **≈ 2.0 MB** |

First paint needs only `index.html`; the title art and tiles load first, the current era's painting next, the rest when
idle. `isIdle()` waits only for the images the current screen shows.

## Known gaps

- **Frame rate under contention.** The fps test passed in the final run but failed in earlier runs while the machine was
  saturated; it is load-sensitive. Re-measure on a quiet machine. If mobile trails v1 there, the next lever is drawing steam
  and droplets on a smaller offscreen canvas.
- **Round-4 minor items** (listed under Adversarial review scores): column-clear band, heat-tinted effects, cell-bevel noise
  on a full board, HUD label size and centring, the phone's empty bottom band.
- **Live water was only seen in software.** The harness has no GPU, so screenshots show the still shader frame (or the live
  layer forced on with `?gl=force`). Animated caustics, ripples and the heat response need a look on real hardware.
- **Audio and screen reader** are still untested by a person (unchanged from v1).
- **Painting liberties** are listed in `research/backdrop-notes.md` §4: the title art's sunrise sits where a summer sunrise
  would be, not a winter one; frontier cabins, the Victorian facades and 1950s cars are representative; the 1887 hospital is
  omitted and the 1933 hospital appears in the 1920s scene.
- **Fixed tile palette** replaces v1's per-era glazes (the review found per-era recoloring hurt recognition); AC22 in the PRD
  is updated to match.
- The landscape tray wells are taller than most pieces need; a 5-long piece sets the scale.

## New research (sources in `research/backdrop-notes.md`)

- Bathhouse Row north-to-south order confirmed from OpenStreetMap footprints (the shared corpus marks it unverified).
- Hot Springs Mountain Tower ground elevation 1,036 ft (USGS EPQS), top about 1,252 ft.
- A ray-cast skyline from USGS 3DEP (`research/skyline.json`, `tools/skyline.mjs`).
- Row and landmark centroids from OSM (`research/bathhouse-row-osm.json`).
- What each era painting shows and its basis, plus every liberty taken (sun position in the title art, generic
  frontier and Victorian buildings, the omitted 1887 hospital, the 1933 hospital in the 1920s scene).

## Requests for the coordinator

**Shared research (`research/`), not edited here:**
1. Lift the **[UNVERIFIED]** flag on the Bathhouse Row north-to-south order in `bathhouse-row-and-springs.md`: OpenStreetMap
   footprints confirm Superior, Hale, Maurice, Fordyce, Quapaw, Ozark, Buckstaff, Lamar (ODbL; table in
   `games/block-puzzle/research/backdrop-notes.md` §2).
2. Hot Springs Mountain Tower ground elevation: 1,036 ft (USGS EPQS), top about 1,252 ft; replaces the **[inferred]**
   1,000–1,070 ft summit range in `geography-lakes-mountains.md`.
3. OSM centroids for the eight bathhouses, the Arlington, the Medical Arts Building and the Army-Navy Hospital can replace
   the interpolated "est." coordinates (`games/block-puzzle/research/bathhouse-row-osm.json`).

**Harness (`shared/test-harness/`):**
1. A `file://` mode: the runner blocks non-server URLs, so file:// checks live in `tools/check-file-url.mjs` today.
2. A before/after sheet tool (this game has `tools/before-after.mjs`; it would suit every game in the campaign).
3. A perf mode that runs a baseline build interleaved with the current one, since absolute fps is meaningless while
   several sessions share the machine.
4. Optional GPU: the headless browser uses SwiftShader, so WebGL work looks far costlier than on any real device.

**LESSONS.md candidates:** the 3DEP `exportImage` trailer; OSM Overpass needs a User-Agent; WebGL as its own DOM layer
instead of drawImage readback; Write-tool files are CRLF, so normalise before splicing into LF files; a Blender block-out
from real data plus an approved pilot keeps Codex paintings geographically consistent across a set.

**Commit notes:** commit `assets/`, `art-src/art.json`, `art-src/blender/*.py` and `*.blend`, `art-src/geo/row-osm.json`,
`vendor/fraunces-5.3.0/`, `tools/`, `tests/visual.test.mjs` and the new research files. `art-src/*.png` and
`art-src/blender/renders/` are already git-ignored. The 700 KB DEM cache (`art-src/dem/`) was deleted after use because `.gitignore` does not cover it; `tools/skyline.mjs` re-fetches it (and `art-src/blender/backdrop.py` needs it). Consider adding `games/*/art-src/dem/` to `.gitignore`. `benchmarks/` is already ignored.
