# Thermal Blocks: core mechanics foundation

This is the technical foundation that `index.html` implements. It draws on the ideas in `SAMPLES.md`;
everything except the mulberry32 PRNG is original code.

## 1. Architecture

One hand-written `index.html`: inline CSS, inline script, no network. The script has these sections,
in this order:

| Section | Contents |
|---|---|
| `DATA` | Era table, piece table, campaign levels (inside the RULES markers); fact cards, ticker lines, tile palettes (after them) |
| `RULES` (pure) | `rand`, `canPlace`, `fitsAnywhere`, `findClears`, `dealTray`, `spawnVent`, `goalMet`, `checkEnd`, `applyMove` (one full turn including scoring), `setupGame`. No DOM. Delimited by `/*RULES-START*/ … /*RULES-END*/` so `tools/rules-node.mjs` evaluates the same code in Node (campaign solver) |
| `STATE` | The single state object `S`, snapshots for undo, save/load |
| `AUDIO` | WebAudio synth `sfx(name, opts)` |
| `RENDER` | Canvas layers, sprite caches, effects |
| `INPUT` | Pointer events, keyboard, DOM menu wiring |
| `SCENES` | Title, game, pause, over/win, trail, cards, records, help, settings |
| `HOOKS` | `window.__game` |

## 2. Game loop and timing

- A `requestAnimationFrame` loop draws only when something changed or an effect is alive
  (`dirty` flag plus live effects), so an idle board costs almost nothing.
- Rules are turn-based and resolve synchronously when a piece is dropped. Animations (clear flash,
  steam, ripples, popups, piece return, tray deal) are purely visual. The state is already final
  when they start, which keeps tests deterministic.
- Effects use real time (`performance.now()` deltas, capped at 50 ms). `isIdle()` is true when no
  effect, tween or drag is alive.
- With reduced motion, effects are shortened to a 150 ms fade and particles are skipped.

## 3. State model (one serializable object)

```js
S = {
  v: 1,
  scene: 'title',            // title | game | pause | over | win | trail | cards | records | help | settings
  mode: 'classic',           // classic | daily | springs | trail
  board: Array(81),          // 0 empty; 1..6 glazed tile color; 7 tufa stone; 8 spring vent
  tray: [ {id:'L4a', color:3} | null, ... ],   // three slots; null = used
  queue: [],                 // trail: remaining piece ids (fixed list); daily: unused
  score: 0, heat: 0, bestHeat: 0, groups: 0, lines: 0, placed: 0,
  round: 1, undoLeft: 1, undoStack: [],        // snapshots (without undoStack) for undo
  era: 0, springs: 0,        // era index; vents tapped (springs mode)
  level: null,               // trail level id
  daily: null,               // 'YYYY-MM-DD' for daily mode
  over: false, won: false,
  rng: 123456789,            // mulberry32 state (uint32)
  seed: 1
}
```

Cell codes: `0` empty, `1–6` tile colors (each also has a pattern), `7` tufa stone (pre-filled, clears like a tile),
`8` spring vent (pre-filled, clears like a tile, scores a tap).

## 4. Rules engine

- **Pieces** are lists of `[row, col]` offsets normalized to a top-left of `0,0`. No rotation; every
  orientation is its own id. Each piece id has a fixed color (1–6), so a shape is recognizable.
- `canPlace(board, piece, r, c)`: every offset lands inside 9×9 on a `0` cell.
- `findClears(board)`: returns the full rows, columns and 3×3 boxes (any non-zero cell counts as full).
  Overlapping groups share cells; a cell is cleared once.
- **Turn**: place → count cells → find clears → score → clear cells → update heat → if the tray is
  empty, deal a new tray → spawn vents (springs) → check win → check game over (`!anyFit`).
- **Scoring** (all integer):
  - placement: +1 per cell placed;
  - clears: `18 × G²` for `G` groups at once, times the heat multiplier;
  - heat: clearing raises heat by `G` (max 12); a placement that clears nothing lowers it by 1;
    multiplier `= 1 + heat × 0.25` (applied after the heat rise, so the first clear already gets a boost), up to ×4 at 143°F;
  - **clear spring**: board fully empty after a clear: +300;
  - **vent tap**: +40 × multiplier per vent cleared (and `springs += 1`).
- **Temperature display**: `round(60 + heat × 83 / 12)` °F, so heat 12 shows 143°F (average spring temperature, NPS).
  At 12 the meter reads "Boiling".
- **Deal**: weighted random from the piece table (weights in DATA). Classic and Springs use a *mercy
  deal*: if none of the three new pieces fits, the slot with the biggest piece is redrawn up to 12 times
  until one fits. Daily draws from its own seeded stream with no mercy, so every player gets the same pieces.
- **Game over**: after a turn, no remaining tray piece fits anywhere.
- **Undo**: snapshot before each placement (stack of up to 3). Undo restores the snapshot including RNG and
  tray, then spends one undo from that round's budget (setting: 0, 1 or 3; trail mode: unlimited).
  No undo after game over, except in trail mode: a lost puzzle keeps its stack and the loss screen offers
  "Undo last move".
- **Springs mode**: starts with 4 vents; after each new tray, one vent appears on a random empty cell while
  fewer than 6 are on the board. 47 taps win the mode.
- **Trail mode**: board, tufa stones, vents and the exact piece list come from the level. Trays are dealt in
  list order. Goals: `stones` (clear every tufa stone), `vents` (tap every vent) or `lines:N` (clear N
  groups). Win as soon as the goal is met; lose if the pieces run out or none fits.

## 5. RNG (seeded)

mulberry32 (public domain, bryc/Tommy Ettinger), with its state kept in `S.rng` so it survives save/load,
undo and `setState`. `seed(n)` sets `S.rng = n >>> 0`. Daily seed: the local date as `YYYYMMDD`.

## 6. Input

All input goes through Pointer Events on the canvas (`touch-action: none`, `setPointerCapture`) plus the keyboard.

| Action | Mouse | Touch | Keyboard |
|---|---|---|---|
| Pick a piece | press on a tray piece | touch a tray piece (it swells; a plain tap hops it and hints "drag") | `1` `2` `3`, or `Tab` / `Q` `E` to cycle |
| Move | drag; ghost snaps to the nearest cells | drag; the piece floats with its bottom edge ¾ cell above the finger, whatever its height | arrow keys move the ghost |
| Place | release over a valid spot | release where the finger lifts. With the **Tap to place** setting on (off by default): tap-select, then tap the board (first tap shows the ghost, second tap on the ghost confirms) | `Enter` / `Space` |
| Cancel | release off-board, or right-click | release off-board | `Esc` (with nothing selected: pause) |

Drag snapping: a piece hanging up to 0.6 cell past the board edge is pulled back in. If the nearest spot is
blocked, the closest open neighbouring spot within ¾ cell is used instead.
| Undo | Undo button | Undo button | `U` or `Ctrl+Z` |
| Mute | sound button | sound button | `M` |

The ghost shows a translucent piece where it would land, and highlights rows, columns and boxes it would
complete. On mouse, hovering the board with a selected piece shows the ghost; a click places it.

## 7. Rendering

Canvas 2D at `devicePixelRatio` (max 2), plus DOM for the HUD, menus and overlays (real buttons, so they
are accessible).

| Layer | Drawn | Cache |
|---|---|---|
| 1. Era background | sky gradient, era silhouettes, steam | offscreen canvas per era and size |
| 2. Board frame and pools | brass frame with a skylight border of small squares, nine pools in two tints, lead came lines, grout | offscreen canvas per size |
| 3. Cells | glazed tiles, tufa stones, vents | sprite per (era, color, size) |
| 4. Ghost and clear preview | translucent piece and highlighted groups | live |
| 5. Tray | three slots with pieces at 55–60% scale; pieces that cannot fit are dimmed and labeled | live |
| 6. Effects | algae flash, steam curls, ripple rings, score popups, drifting steam | live |
| 7. Dragged piece | full size, with a shadow | live |

Layout is computed from the viewport: landscape puts the stats column left of the board and the tray right;
portrait stacks the HUD, heat bar, board and tray.

## 8. Audio

A lazily created `AudioContext` (on the first gesture). Each sound is a short recipe of oscillators and
filtered noise with gain envelopes: `place`, `clear` (steam hiss plus a chime that rises with heat),
`vent`, `invalid`, `deal`, `undo`, `era`, `over`, `win`, `click`. Master volume and mute are settings.

## 9. Save format

`localStorage['hs-thermal-blocks-v1']`, every access in try/catch (the game runs without storage):

```js
{ v:1,
  settings:{ sound:true, volume:0.7, motion:'system', patterns:true, undo:1, bigText:false, theme:'system' },
  best:{ classic:0, springs:0, daily:{ '2026-10-28': 812 } },
  trail:{ done:['display-spring', ...] },
  stats:{ games:0, lines:0, bestHeat:0, springs:0 },
  resume: null | S }    // in-progress classic/springs game, saved after every turn
```

## 10. Test hooks (`window.__game`)

| Hook | Behavior |
|---|---|
| `seed(n)` | set RNG state |
| `getState()` | deep copy of `S` plus derived fields: `fits` (per tray slot), `temp`, `eraId`, `ghost` |
| `setState(s)` | merge a crafted state, redraw, re-run the game-over check |
| `isIdle()` | no effects, tweens or drags alive |
| `scene(name)` | show a scene |
| `newGame({mode, level, seed, date})` | start a game |
| `act(name, ...args)` | `place(slot, r, c)`, `select(slot)`, `move(dr, dc)`, `confirm()`, `undo()`, `pause()`, `resume()`, `setting(k, v)`, plus test helpers (`fill`, `freezeFx`, `unfreezeFx`, `fxTypes`, `canvasHash`, `save`, `audio`, `hideToast`, `resumeSaved`). Drags, taps and keys are tested with real Playwright input, not hooks |
| `getLevels()` | campaign level data for the solver test |
| `pieces()` | the piece table |
| `layout()` | board and tray rectangles in CSS pixels, so tests can drive real pointer events |
