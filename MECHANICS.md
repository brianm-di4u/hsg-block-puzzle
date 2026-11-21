# Thermal Blocks: core mechanics foundation

This is the technical foundation that `index.html` implements. It draws on the ideas in `SAMPLES.md`;
everything except the mulberry32 PRNG is original code.

## 1. Architecture

One hand-written `index.html`: inline CSS, inline script, no network. The script has these sections,
in this order:

| Section | Contents |
|---|---|
| `DATA` | Era table (`ERAS`, decoupled `PRESSURE_AT`, `SPRINGS_ACTS`), 40-piece table, 24 campaign levels (inside the RULES markers); 12 Place Cards, 8 Water Cards, 14 ticker lines, `ERA_CROP` / `ERA_WATER` / `TILE_HEX` |
| `RULES` (pure) | `rand`, `canPlace`, `fitsAnywhere`, `findClears`, `dealTray`, `spawnVent`, `goalMet`, `checkEnd`, `applyMove` (full turn + scoring + Boil-Hold + Daily sweep), `setupGame`, `bestMove` (Hint solver). No DOM. Delimited by `/*RULES-START*/ … /*RULES-END*/` so `tools/rules-node.mjs` evaluates the exact code in Node (solver & difficulty sim) |
| `STATE & SAVE` | Single state object `S`, undo snapshots & rollback `ledger`, monotonic multi-tab `SAVE MERGE CORE` (`SAVE_STORE`), per-mode non-colliding `RUN_KEY` sub-slots |
| `AUDIO` | Procedural WebAudio SFX (`sfx`), generative era-adaptive music engine (`SCORES`), continuous bathhouse ambience (`SCENES`), shared procedural `ConvolverNode` hall reverb (`-14 dB` send), Pause/tab-visibility hold |
| `RENDER` | WebGL 1.0 `#water` caustic shader (`ERA_WATER` + 4-tier 2D fallback), `<= 2` LRU painted backdrops, `<= 22` sprite cache (2 mip tiers + 3 un-rotated Tufa variants), `128×128` 9-slice bead glow, pooled `FX[]` (`MAX_FX = 180`), Trail Up Next queue |
| `INPUT` | Pointer Events (bezel-aware mobile landscape lift, strict 40/40 Tap-to-Place confirmation), keyboard (boundary-releasing `#cv` Tab, `aria-modal` Tab traps, `Ctrl/Cmd+Z` / `U` Post-Loss Undo), gamepad (`gamepadconnected`-gated), DOM wiring |
| `SCENES` | Title, game, pause, over, win, trail (3-stage Accordion + swipeable SVG skyline), cards (`All (27)` + 0-KB Lightbox), records (aquifer bar + interactive calendar + goal progress), help, settings, confirm |
| `HOOKS` | `window.__game` |

## 2. Game loop and timing

- A `requestAnimationFrame` loop draws only when something changed or an effect is alive
  (`dirty` flag plus live effects). Behind any modal overlay (`pause`, `settings`, `help`, `cards`, `records`, `trail`, `over`, `win`, `lightbox`, `confirm`) or hidden tab, both `#water` and `#cv` stop completely (`0` GPU/2D draws). Active play enters uniform idle sleep 30 s after the last input.
- Rules are turn-based and resolve synchronously when a piece is dropped. Animations (clear flash,
  steam, ripples, popups, piece return, tray deal) are purely visual. The state is already final
  when they start, which keeps tests deterministic.
- Effects use real time (`performance.now()` deltas, capped at 50 ms) with pause-clock rebasing (`resumePauseClocks()`). `isIdle()` is true when no effect, tween, count-up, UI settle, art decode or drag is alive.
- With reduced motion (`system` honoring OS or explicit `reduced`), effects shorten to calm fades, particles skip, and CSS transitions/animations disable (`motion-full` overrides OS reduced motion).

## 3. State model (one serializable object)

```js
S = {
  v: 1,
  scene: 'title',            // title | game | pause | over | win | trail | cards | records | help | settings
  mode: 'classic',           // classic | daily | springs | trail
  diff: 'standard',          // relaxed | standard | master (classic & springs)
  board: Array(81),          // 0 empty; 1..6 glazed tile color; 7 tufa stone; 8 spring vent
  tray: [ {id:'L4a', color:3} | null, ... ],   // three slots; null = used
  queue: [],                 // trail: remaining piece ids (fixed list); daily: unused
  score: 0, heat: 0, bestHeat: 0, clearRun: 0, boilHold: 0,
  groups: 0, lines: 0, placed: 0, bestG: 0, cooled: 0,
  ptsPlace: 0, ptsClear: 0, ptsBonus: 0,       // exact score breakdown (ptsPlace + ptsClear + ptsBonus === score)
  round: 1, refilledRound: 1, undoLeft: 1, undosUsed: 0, hintsUsed: 0, hintRound: -1,
  undoStack: [],             // snapshots (without undoStack) for undo & Post-Loss Undo
  era: 0, springs: 0, act: 1, tufaSwept: false, // era index; vents opened & Act (springs); 8-tufa sweep (daily)
  level: null, goal: null,   // trail level id & goal ('stones' | 'vents' | 'stones+vents' | 'lines:N')
  daily: null,               // 'YYYY-MM-DD' for daily mode
  priorBest: 0, bestCommitted: false, provBest: null,
  ledger: null,              // end-of-run save commit ledger for exact Post-Loss Undo rollback
  over: false, won: false,
  rng: 123456789,            // mulberry32 state (uint32)
  seed: 1
}
```

Cell codes: `0` empty, `1–6` tile colors (each with a fixed glaze and pressed pattern), `7` tufa stone (pre-filled, clears like a tile, +20 × heat),
`8` spring vent (pre-filled, clears like a tile, opens a spring for +40 × heat and +1 heat).

## 4. Rules engine

- **Pieces** are lists of `[row, col]` offsets normalized to a top-left of `0,0` (40 shapes). No rotation; every
  orientation is its own id. Each piece id has a fixed color (1–6), so a shape is recognizable.
- `canPlace(board, piece, r, c)`: every offset lands inside 9×9 on a `0` cell.
- `findClears(board)`: returns the full rows, columns and 3×3 boxes (any non-zero cell counts as full).
  Overlapping groups share cells; a cell is cleared once.
- **Turn resolution order (`applyMove`)**:
  `place → count cells → findClears → score → clear cells → update heat (with Boil-Hold) → update Classic era / Springs act → check goalMet (immediate Trail/Springs 47-vent win BEFORE spawning/dealing) → if tray empty: dealTray + spawnVent (Springs, strictly on empty cells) → checkEnd (!anyFit)`.
- **Scoring** (all integer, strictly accounted in `ptsPlace + ptsClear + ptsBonus === score`):
  - placement: +1 per cell placed;
  - clears: `18 × G²` for `G` groups at once, times the heat multiplier;
  - **tufa stones**: +20 × multiplier per tufa stone cleared (Daily Soak adds +150 bonus and +1 heat when all 8 opening tufa dissolve);
  - **spring vents**: +40 × multiplier per vent opened (and `springs += 1`, `+1` heat);
  - **clear spring**: board fully empty after a clear: +300 × multiplier.
- **Heat & 143°F Boil-Hold**: clearing `G` groups raises heat by `G` (plus +1 per opened vent and +1 on Daily's 8-tufa sweep, max 12); a placement that clears nothing lowers heat by 1, except when already at `heat === 12` with `boilHold > 0`, which consumes the 1-placement Boil-Hold grace before cooling. Multiplier `= 1 + heat × 0.25` (applied after the heat rise), up to ×4 at 143°F ("Boiling").
- **Temperature display**: `round(60 + heat × 83 / 12)` °F, so heat 12 shows `143°F` (average spring temperature, NPS).
- **Decoupled Classic Eras & Pressure**: Classic eras climb at `0 / 150 / 400 / 800 / 1,500 / 2,500 / 4,000` points while piece-pool difficulty pressure stays decoupled on `PRESSURE_AT` (`0..8,000`, `High Flow` at `5,500`, `Peak Flow` at `8,000`).
- **Deal**: weighted random from the piece table (weights in DATA). Classic and Springs use a *mercy
  deal* (ensuring a complete 3-piece playable sequence whenever possible). Daily draws from its own board-independent date-seeded stream with round-based escalation (`0%` divergence across players on the same date, Bronze `2,500` / Silver `5,000` / Gold `8,000` par milestones).
- **Game over**: after a turn, no remaining tray piece fits anywhere (or Trail runs out of pieces before meeting its goal).
- **Undo & Post-Loss Undo**: snapshot before each placement (stack of up to 3 in Classic/Daily/Springs; deep stack in Trail). Undo restores the snapshot including RNG and tray, spends one undo from that round's budget (setting: 0, 1 or 3; Trail: unlimited), and when invoked from Game Over (**Post-Loss Undo**) rolls back committed stats, bests, daily scores, recent history, and earned goals via `S.ledger`.
- **Springs mode (3-Act surge)**: uses `era-ancient.webp` across Act I (`0–19`), Act II (`20–35`), and Act III (`36–47`). Starts with 4 vents; after each tray refill, spawns Act-scaled vents on random empty cells (up to 6 on board, never spawning after the 47th open). Opening 47 vents wins immediately (`47/47`).
- **Spring Trail (24 levels, 3-stage Accordion)**: board, tufa stones, vents, and fixed `pieces` list come from `LEVELS` (12 Ring 1 Bathhouse Row + 12 Ring 2 Spring Science Mastery; all 24 DFS-verified in `tools/solutions.json` with `findClears(parseLevel(L)).length === 0`). Goals: `stones`, `vents`, `stones+vents`, or `lines:N`. Unlocking follows a forgiving 3-stage Accordion: `#1–#3` linear → `#4–#9` open Bathhouse Row Promenade once `#3` is solved → `#10–#12` Park Finale once any 4 of 6 Promenade puzzles are solved → Ring 2 opens at Ring 1 complete + 18★ in a rolling 3-puzzle window (`unsolvedBefore < 3`). Stars: `0` undos = 3★, `1–2` = 2★, `3+` = 1★.

## 5. RNG (seeded)

mulberry32 (public domain, bryc/Tommy Ettinger), with its state kept in `S.rng` so it survives save/load,
undo and `setState`. `seed(n)` sets `S.rng = n >>> 0`. Daily seed: deterministic hash of local date `YYYY-MM-DD`, which also selects the date-seeded Era of the Day (`ERAS[dateSeed % 7]`).

## 6. Input

All input goes through Pointer Events on the canvas (`touch-action: none`, `setPointerCapture`), keyboard, and optional gamepad (`gamepadconnected`-gated).

| Action | Mouse | Touch | Keyboard |
|---|---|---|---|
| Pick a piece | press on a tray piece | touch a tray piece (swells; a plain tap hops it and hints "drag") | `1` `2` `3`, `Q`/`E`, or boundary-releasing `Tab` on `#cv` |
| Move | drag; ghost snaps via shared `resolveSnapTarget()` | drag; floats ¾ cell above finger (on short landscape phones, preserves ≥40 px lift across Rows 0–6 with smooth bezel taper below `VH - 48`) | arrow keys move the ghost |
| Place | release over a valid spot, or click while selected | release where the finger lifts. With **Tap to place** on: tap-select, tap board for ghost, second tap confirming the identical resolved origin (all 40/40 shapes including 10 concave pieces) or an occupied ghost cell places | `Enter` / `Space` |
| Cancel | release off-board / originating slot, or right-click | release off-board / originating slot | `Esc` (with nothing selected: pause; closes modal/Lightbox) |
| Undo / Hint | HUD Undo / Hint buttons | HUD Undo / Hint buttons | `U` or `(Ctrl\|Cmd)+Z` (works on Game Over too); `H` for Hint (non-Trail) |
| Mute / Pause | HUD buttons | HUD buttons | `M` mutes anywhere; `P` pauses/resumes |

Drag snapping (`resolveSnapTarget()`): shared across drag, mouse click-select, and touch Tap-to-Place — a piece hanging up to `0.6` cell past the board edge pulls in, and the closest valid neighbouring spot within `0.75` cell wins over a blocked cell. Every `aria-modal="true"` dialog (including `#sc-lightbox` and `#sc-confirm`) traps `Tab` / `Shift+Tab` and marks `#cv`, `#hud`, and background overlays `inert`.

## 7. Rendering

Canvas 2D at capped `devicePixelRatio` (`<= 2` desktop, `<= 1.5` mobile), WebGL 1.0 `#water` layer, plus accessible DOM HUD/menus/Lightbox.

| Layer | Drawn | Cache / Budget |
|---|---|---|
| 1. Era background (`#bg`) | Painted WebP vistas framed via `ERA_CROP` (retaining previous painting during async `decode()`), `?art=0` Bathhouse Row + `SKYLINE` fallback | Demand-driven LRU keeping `<= 2` decoded `1600×1000` backdrops in VRAM |
| 2. Thermal water (`#water`) | Live WebGL 1.0 caustics + clear shockwave ripples driven by `ERA_WATER` (`L <= 0.11` Boiling cap), or 4-tier quantized 2D still water | Capped `<= 512px` mobile / `<= 640px` desktop; `WATER.clear()` / `WATER.resize()` reset cleanly; `0` draws while paused/modal/idle |
| 3. Board frame & pools | Bronze moulding, glazed border + grout + Fordyce lozenges + era/act patina, `128×128` 9-slice brass bead glow, nine pools & lead came lines | Offscreen `boardCache` per size/era/act |
| 4. Cells | Fixed 6-glaze Blender WebP tiles (`100%` un-veiled), 4 un-rotated travertine Tufa variants, glowing vents | Pre-warmed strictly on 2 mip tiers (`board.cell`, `trayScale`) = `<= 22` offscreen canvases; `0` mid-clear allocations |
| 5. Ghost & Hint | Translucent piece + shared `drawClearPreview()` group highlights (coral-crimson invalid wash) | Live |
| 6. Tray & Up Next | Three recessed tray slots (center-pivoted deal/press swells, mutation-memoized fit dims) + Trail Up Next queue | Live |
| 7. Effects & Drag | Pooled `FX[]` (`MAX_FX = 180`: ripples, beams, steam, era-tuned shards, Frontier splinters, travertine dust, popups, banners) + 90 ms eased touch lift & blur-free silhouette shadow | Live |

## 8. Audio

A lazily created `AudioContext` (on first user gesture) drives three independent buses:
- **SFX (`sfx`)**: procedural recipes for `place`, `clear` (heat-scaled chime + steam), `vent`, `invalid`, `deal`, `undo`, `era`, `over`, `win`, `trailStar`, `click`, `step`, `pick`, `pause`, `resume`.
- **Generative Music (`SCORES`)**: era-adaptive harmonic & melodic generator routed through a shared procedural `ConvolverNode` bathhouse hall reverb (`-14 dB` send).
- **Ambience (`SCENES`)**: continuous layered thermal spring wash, ripples, drips, and steam vents keyed to era and heat.
Pause and hidden-tab events ramp smoothly and hold/suspend audio without glitches; Settings supports live music/ambience auditioning from Pause.

## 9. Save format

- Primary profile: `localStorage['hs-thermal-blocks-v1']` managed by `SAVE MERGE CORE` (`SAVE_STORE`, monotonic multi-tab merge protecting newer preferences, cumulative stats, bests, and active run generations; every access wrapped in try/catch):

```js
{ v:1,
  settings:{ sound:true, volume:0.7, sfx:true, music:true, musicVol:0.55, ambience:true, ambVol:0.5,
             motion:'system', patterns:true, undo:1, difficulty:'standard', tapPlace:false,
             haptics:true, bigText:false, theme:'system', effects:'auto', traySide:'right', tipsSeen:false },
  best:{ classic:0, springs:0, daily:{ '2026-10-28': 812 }, diff:{ relaxed:{classic:0,springs:0}, master:{classic:0,springs:0} } },
  trail:{ done:['display-spring', ...], stars:{ 'display-spring': 3 } },
  stats:{ games:0, lines:0, bestHeat:0, springs:0, bestCombo:0, longest:0, recent:{ classic:[], springs:[], daily:[] } },
  eraMax: 0, ach:{}, played:[], goals:{ boiled:0 }, hints:{},
  resume: null | S }    // Classic active run (monotonic generation/revision guarded)
```

- Independent per-mode run slots: `localStorage['hs-thermal-blocks-run-v1']` stores non-colliding active runs for `daily:<YYYY-MM-DD>`, `springs:springs`, and `trail:<level-id>` so switching modes never clobbers another mode's progress.

## 10. Test hooks (`window.__game`)

| Hook | Behavior |
|---|---|
| `seed(n)` | set RNG state |
| `getState()` | deep copy of `S` plus derived fields: `fits`, `temp`, `eraId`, `ghost`, `sel`, `undoCount`, `settings`, `best`, `overIn` |
| `setState(s)` | merge a crafted state, sync gauges/caches, re-run game-over check |
| `isIdle()` | no effects, tweens, count-ups, UI settles, art decodes, or drags alive |
| `scene(name)` | show a scene |
| `newGame({mode, level, seed, date, resume})` | start or resume a game |
| `act(name, ...args)` | `place`, `select`, `move`, `confirm`, `undo`, `hint`, `hintState`, `pause`, `resume`, `setting`, `fill`, `canvasText`, `freezeFx`, `unfreezeFx`, `fxTypes`, `clearFx`, `shakes`, `fxList`, `art`, `loadAllArt`, `perf`, `canvasHash`, `toast`, `hideToast`, `save`, `tips`, `goals`, `input`, `resumeSaved`, `audio`, `audioState`, `cues`, `heardCues`, `clearCues`, `dragBody`, `infoLine`, `doomed`, `words` |
| `audioList()` / `audioRender(...)` | deterministic offline WebAudio cue & music rendering for audio tests |
| `getLevels()` | all 24 Spring Trail level definitions |
| `pieces()` | the 40-piece table |
| `layout()` | board, tray, info strip, and scale rectangles in CSS pixels |
