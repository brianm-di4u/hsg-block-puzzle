# Code-sample survey (Thermal Blocks)

Surveyed 2026-10-28 with WebSearch and WebFetch. **No sample code was downloaded** into
`reference-samples/`. Every piece of `index.html` is written for this game; the only adapted code is
the public-domain mulberry32 PRNG (attributed in a code comment where it lands).

Many open-source 9×9 and 8×8 block-placement projects are explicit clones of commercial titles.
Per `shared/SESSION-BRIEF.md`, code from clones is never borrowed, so those projects were read
for general ideas only and are marked reference-only whatever their license.

| # | Project | URL | License | Version / commit | Verdict |
|---|---|---|---|---|---|
| 1 | block-blast (ZLouisMiguel) | https://github.com/ZLouisMiguel/block-blast | **None shown** (README: "a clone for educational purposes") | 44 commits on the page; hash not shown | Reference only: no license, and a clone of a commercial app |
| 2 | Mondrian Blocks Logic Puzzle (lgwarda) | https://github.com/lgwarda/mondrian-blocks-logic-puzzle | MIT (`LICENSE.txt`) | 6 commits; hash not shown | Ideas only (canvas grid + mouse/touch placement); nothing copied |
| 3 | bryc/code: PRNGs.md (mulberry32) | https://github.com/bryc/code/blob/master/jshash/PRNGs.md | Public domain (file says "License: Public domain"); mulberry32 itself from Tommy Ettinger's 2017 public-domain dedication | master, viewed 2026-10-28 | **Adapted**: the 6-line `mulberry32` function in `index.html` (comment marks it) |
| 4 | ZzFX (Frank Force) | https://github.com/KilledByAPixel/ZzFX | MIT | ZzFXMicro v1.4.0; 488 commits on master | Ideas only: parameterized one-shot sounds (frequency, slide, envelope, noise). Our synth uses live WebAudio nodes instead of precomputed buffers; no code copied |
| 5 | MDN: Pointer events and `setPointerCapture` | https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events | MDN code samples CC0 | live docs, 2026-10-28 | Ideas only: one pointer pipeline for mouse, pen and touch, with capture during drags |

## Notes per sample

### 1. block-blast (ZLouisMiguel)
- **Does well:** a tidy vanilla split of concerns (`blocks.js` shape table, `gameFunctions.js` grid
  rules and drawing, `script.js` loop and state, a modal for game over). Ghost preview on valid spots,
  combo scoring and tray regeneration are listed as features.
- **Does badly:** no license; tied to a commercial game's look and rules; DOM drag-and-drop with no
  keyboard path listed; no seeded RNG, so no daily puzzle or reproducible tests.
- **Takeaway:** keep the shape table as plain data, separate from the grid rules.

### 2. Mondrian Blocks Logic Puzzle (lgwarda)
- **Does well:** canvas grid plus mouse and touch placement in one small script; MIT licensed.
- **Does badly:** an 8×8 fit-everything puzzle with no line clearing; the README says nothing about
  snapping or keyboard play.
- **Takeaway:** hand-designed puzzles with a fixed piece list are a good fit for a campaign; we verify
  each one is solvable with a solver test.

### 3. mulberry32 (bryc / Tommy Ettinger)
- **Does well:** a 32-bit state, tiny and fast, good enough statistics for game dealing; the state is a
  single integer, so it serializes into the save and test snapshots.
- **Does badly:** fails some heavy statistical batteries (PractRand at 1 GB). Irrelevant for dealing pieces.
- **Takeaway:** used as-is for all randomness (deals, Daily layout, vent spawns).

### 4. ZzFX
- **Does well:** a whole sound vocabulary from a few numbers; sounds can be cached.
- **Does badly:** sample-by-sample JS generation costs CPU on each new sound; minified code is hard to read.
- **Takeaway:** a small `sfx(name)` table of oscillator and noise-burst recipes with envelopes, built on
  WebAudio nodes.

### 5. MDN Pointer events
- **Does well:** one event model for mouse and touch, `setPointerCapture` keeps the drag even when the
  finger leaves the canvas, `touch-action: none` stops page scrolling during a drag.
- **Takeaway:** the whole input layer is pointer events plus keyboard; no separate touch handlers.

## Side-by-side: what becomes the foundation

| Concern | Chosen approach | Comes from |
|---|---|---|
| Piece data | Plain table of cell offsets per piece id, no rotation, each orientation its own id | Sample 1's separation idea; our own original piece set |
| Rules | Pure functions over an 81-entry array: `canPlace`, `place`, `findClears`, `anyFit` | Our design (MECHANICS.md) |
| Input | Pointer events + capture; drag with lift offset on touch; tap-select then tap-place; keyboard cursor | Sample 5 |
| Randomness | mulberry32 with the state stored in the game state | Sample 3 |
| Audio | WebAudio node recipes with envelopes | Sample 4 (idea) |
| Campaign | Fixed piece lists on hand-made boards, solver-verified | Sample 2 (idea) |
