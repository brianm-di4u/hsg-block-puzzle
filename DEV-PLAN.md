# Thermal Blocks: development plan

Single hand-written file `games/block-puzzle/index.html`. Tests in `games/block-puzzle/tests/`, run with
`node shared/test-harness/run.mjs games/block-puzzle --milestone <m>`. Campaign solver:
`node games/block-puzzle/tools/rules-node.mjs` evaluates the `RULES` block of `index.html` in Node, proves
every Spring Trail level solvable (depth-first search over every order and position), measures how often
random play wins, and writes `tools/solutions.json`, which `tests/trail.test.mjs` replays through the real game.
Re-run it whenever a level changes; the trail test fails if `solutions.json` is stale.

## Milestones and tasks

### M1 Foundation
- HTML skeleton, inline tokens (light/dark), layout system (landscape / portrait), canvas at DPR.
- DATA: piece table, eras, tile palettes. RULES: rng, canPlace, findClears, place/turn, scoring.
- Board render (frame, pools, lead, cells, tile sprites with patterns), tray render.
- `window.__game` with seed/getState/setState/isIdle/scene/newGame/act.
- Title screen and game scene; Classic mode playable via hooks.
- Tests: `boot`, `rules` (AC1–AC10 basics).

### M2 Core loop
- Pointer drag with ghost and snap; tap-select/tap-place; keyboard cursor play.
- Clear preview, invalid feedback, tray refill, game over detection, no-moves dimming, summary screen.
- Undo with per-round budget. High scores and storage wrapper. Pause menu.
- Tests: `input` (AC14–AC16), `gameover` (AC11–AC13, AC17).

### M3 Full rules and content
- Daily Soak (date seed, stones, fixed sequence); Springs mode (vents, respawn, 47 win).
- Spring Trail: 12 levels, goals, level select, fact cards, album; solver verification.
- Eras: backgrounds per era, palette swaps, captions; ticker; records screen; resume.
- Tests: `modes` (AC18–AC22, AC30, AC32), `trail-solver` (AC20).

### M4 Polish, audio, accessibility
- Effects: flash, steam curls, ripples, popups, tray deal tween, piece return tween, era toast.
- WebAudio synth and settings; reduced motion; patterns toggle; large text; theme; live region.
- Help screen; settings screen; dark scheme check; mobile touch-target audit.
- Tests: `polish` (AC23–AC29).

### M5 Optimization and release
- Draw-on-change loop, sprite and background caches, measure fps/memory/size.
- Full matrix with `--milestone final`; gallery; REPORT.md.
- Tests: `perf` (AC31).

## `window.__game` hook spec

| Hook | Args | Returns |
|---|---|---|
| `seed(n)` | uint32 | `true` |
| `getState()` | — | copy of `S` plus `fits:[bool,bool,bool]`, `temp` (°F), `eraId`, `ghost` (`{slot,r,c,valid}` or null), `undoMax` |
| `setState(s)` | partial state | `true`; redraws and re-checks game over |
| `isIdle()` | — | bool |
| `scene(name)` | `title`, `game`, `pause`, `over`, `win`, `trail`, `cards`, `records`, `help`, `settings` | `true` |
| `newGame(opts)` | `{mode:'classic'|'daily'|'springs'|'trail', seed?, date?:'YYYY-MM-DD', level?:id}` | state |
| `act('place', slot, r, c)` | slot 0–2, top-left cell | `{ok, cleared, points}` |
| `act('select', slot)` / `act('move', dr, dc)` / `act('confirm')` | keyboard path | state summary |
| `act('undo')` | — | `{ok}` |
| `act('setting', key, value)` | settings key | settings |
| `act('fill', cells, code)` | test helper: set cells to a code | `true` |
| `act('freezeFx', ms)` / `act('unfreezeFx')` | hold effects at `ms` after the latest one started, so a mid-effect screenshot is stable | effect count |
| `act('fxTypes')` / `act('canvasHash')` / `act('save')` / `act('audio', name)` | inspect effects, canvas, save data, audio graph | values |
| `act('hideToast')` | hide the caption toast before a screenshot | `true` |
| `getLevels()` | — | trail level definitions |
| `pieces()` | — | piece table |
| `layout()` | — | `{board:{x,y,size,cell}, slots:[{x,y,w,h}]}` in CSS px |

## Test matrix

Every test runs at desktop (1280×800) and mobile (390×844) unless noted. Screenshot names are the files under
`screenshots/<milestone>/<viewport>/`.

| AC | Test file → test name | Screenshot(s) |
|---|---|---|
| AC1 | `boot.test.mjs` → title screen | `01-title` |
| AC2 | `boot.test.mjs` → empty board | `02-board-empty` |
| AC3 | `rules.test.mjs` → seeded deal | — |
| AC4, AC5 | `rules.test.mjs` → place and reject | `10-placed` |
| AC6, AC7, AC8 | `rules.test.mjs` → clears and multi-clear | `11-before-clear`, `12-after-multi-clear` |
| AC9 | `rules.test.mjs` → heat | `13-heat-boiling` |
| AC10 | `rules.test.mjs` → refill | — |
| AC11, AC12 | `gameover.test.mjs` → no fit ends game | `20-no-moves-dim`, `21-game-over` |
| AC13 | `gameover.test.mjs` → undo budget | — |
| AC14 | `input.test.mjs` → pointer drag (desktop) | `30-drag-ghost` |
| AC15 | `input.test.mjs` → tap select and place (mobile) | `31-tap-ghost` |
| AC16 | `input.test.mjs` → keyboard turn | `32-keyboard-cursor`, `33-pause` |
| AC17 | `gameover.test.mjs` → best persists; storage blocked | — |
| AC18 | `modes.test.mjs` → daily determinism | `40-daily` |
| AC19 | `modes.test.mjs` → springs vents and win | `41-springs`, `42-springs-win` |
| AC20 | `trail.test.mjs` → trail select; every level solvable and unlocks its card (desktop, replays `tools/solutions.json`); mobile trail play and album | `43-trail-select`, `44-trail-level`, `45-trail-win` |
| AC21 | `trail.test.mjs` → album after solving (desktop: 12 cards; mobile: 3 collected, 9 locked) | `46-cards` |
| AC22 | `modes.test.mjs` → each era | `50-era-ancient` … `56-era-modern` |
| AC23 | `polish.test.mjs` → clear fx mid-flight; reduced-motion variant | `60-clear-fx`, `61-clear-reduced` |
| AC24 | `polish.test.mjs` → audio graph created, mute toggles | — |
| AC25 | `polish.test.mjs` → all six patterns visible; patterns off | `62-patterns`, `63-patterns-off` |
| AC26 | `polish.test.mjs` → settings persist | `64-settings` |
| AC27 | `polish.test.mjs` → help | `65-help` |
| AC28 | every test calls `t.checkLayout()`; `polish.test.mjs` measures button sizes on mobile | — |
| AC29 | `polish.test.mjs` → dark scheme (colorScheme: dark) | `66-dark-title`, `67-dark-game`, `68-dark-pause` |
| AC30 | `modes.test.mjs` → resume and records | `47-continue` |
| AC31 | `perf.test.mjs` → performance (fps during clears, memory, load time, file size); soak: full games to the end (desktop; a greedy bot plays Classic, Springs and Daily to game over) | `70-perf`, `71-soak-end` |
| AC32 | `modes.test.mjs` → resume and records | `48-records` |

Every test also fails on any console error or external request (enforced by the harness). Trail loss and
undo-from-loss are covered by `trail.test.mjs` → trail loss offers undo (desktop).

## Defect log

| # | Milestone | Found by | Defect | Fix | Status |
|---|---|---|---|---|---|
| D1 | M1 | screenshot `02-board-empty` | Skylight squares on the left/right frame edges drawn with horizontal dimensions, spilling past the frame | Separate width and height per side | Fixed |
| D2 | M1 | screenshot `01-title` | Steam drawn as stroked sine curves looked like twisted ropes | Steam rebuilt from soft radial puffs (style guide Motif 7) | Fixed |
| D3 | M1 | screenshot review | Ancient tile color 5 (tufa-streak gray) read as a tufa stone | Replaced with derived red novaculite `#9E4E45` | Fixed |
| D4 | M1 | screenshot `02-board-empty` mobile | Large empty bands above and below the board; small tray targets | Tray grows into spare height (up to 200 px) | Fixed |
| D5 | M1 | screenshot review | Landscape info panel had unused space | Added a "Next era" line | Fixed |
| D6 | M2 | test "touch tap select and place" | Tapping a piece created a ghost at the board center, so the first board tap could place at once | Pointer selection no longer creates a ghost; keyboard selection still does | Fixed |
| D7 | M2 | screenshot `33-pause` | Pause buttons stretched to 140 px tall (row flex-basis applied vertically) | `.row.col` with `flex:0 0 auto` | Fixed |
| D8 | M2 | screenshot `33-pause` | Undo count showed 0 while paused | Count no longer depends on the scene | Fixed |
| D9 | M2 | screenshot `20-no-moves-dim` | Thermometer bar grayish at low heat | Blue → amber → red ramp | Fixed |
| D10 | M3 | solver | Ozark and Thermal Water Cascade had no solution; Superior was very hard (0% random win, 600k nodes) | Redesigned all three; solver re-verified | Fixed |
| D11 | M3 | solver | Tufa Terrace solution only found without move ordering | Solver tries ordered search, then an exhaustive unordered search | Fixed |
| D12 | M3 | design review | A lost trail puzzle could only be restarted | "Undo last move" on the trail loss screen; trail keeps its undo stack on a loss | Fixed |
| D13 | M3 | screenshots `41-springs`, `50-…` | Vent steam drawn as a zigzag | Vent steam uses rising puffs | Fixed |
| D14 | M3 | screenshot `45-trail-win` | Level hint toast stayed on top of the win card | Toast hidden on over and win screens | Fixed |
| D15 | M3 | screenshot `44-trail-level` | Trail info panel showed the era name, not the puzzle | Shows puzzle name and "Spring Trail n of 12" | Fixed |
| D16 | M4 | screenshot `60-clear-fx` mobile | Score popup clipped at the board's right edge | Popups clamped inside the board | Fixed |
| D17 | M4 | screenshot `60-clear-fx` | Gilded Spa magnolia band drawn as big white blobs that read as bubbles | Leaves with small cream blossoms | Fixed |
| D18 | M4 | code review | Opening Spring Trail from a win screen made Back return to a dead pause menu | Return target becomes "pause" only from game or pause | Fixed |
| D19 | M5 | soak test | Era thresholds up to 12,000 were out of reach for typical games (bot scores about 15 points a move) | Thresholds 0 / 400 / 1,000 / 2,000 / 3,500 / 5,500 / 8,000 | Fixed |
| D20 | M5 | contrast check | Tray "no room" (4.23:1) and slot numbers (3.70:1) under 4.5:1 over light era skies | Tray fill 90% opaque; selected slot number uses light text (all now ≥ 4.98:1) | Fixed |
