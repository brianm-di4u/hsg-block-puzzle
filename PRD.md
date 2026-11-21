# Thermal Blocks: product requirements

## 1. Vision

A calm, juicy 9×9 block-placement puzzle set on a bathhouse tile floor in Hot Springs, Arkansas.
You lay glazed tiles into nine thermal pools. Full rows, columns and pools release steam. Clearing again
and again heats the water toward 143°F, the springs' average temperature. As your score climbs, the
town behind the board moves through its seven eras, from the Valley of Vapors to the modern Spa City.

**Pillars**
1. **Readable calm.** Big, clear board; no timers in the core modes; every move is a considered choice.
2. **Satisfying release.** Every clear gets steam, a ripple, a chime and a score popup; chains heat the water.
3. **A sense of place.** Real spring science and real places, sourced, shown lightly: era backdrops,
   ticker lines and collectible fact cards. No lectures during play.
4. **Play anywhere, any way.** Mouse, touch and keyboard each play the whole game.

**Original identity.** Genre game, not a copy: own name, own piece set (each orientation a separate
piece, fixed color per shape), own scoring (heat multiplier, clear spring bonus), own modes (Springs,
Spring Trail) and own art. No other product's name, look or text appears.

## 2. Target players

Casual puzzle players on phones and laptops, 10 to 70 years old. Sessions of 3–15 minutes. Visitors and
residents who enjoy local history; nothing assumes prior knowledge.

## 3. Modes

| Mode | Summary | Ends |
|---|---|---|
| **Classic** | Endless, Relaxed / Standard / Master difficulty. Three pieces a round with a mercy deal. Exclusive owner of the 7-era Bathhouse Row climb (`0` to `4,000` points) and Era Postcards; difficulty pressure stays decoupled up through `5,500` (High Flow) and `8,000` (Peak Flow). | No piece fits |
| **Daily Soak** | Seeded by the local date under a date-seeded **Era of the Day** (`ERAS[dateSeed % 7]`). Starts with 8 opening tufa stones (+150 bonus and +1 heat when all 8 dissolve), uses round-based escalation, awards Bronze (`2,500`) / Silver (`5,000`) / Gold (`8,000`) par milestones, and deals board-independent identical trays for every player on that date. One best score per date; finishing with 0 undos and 0 hints earns the **Pure Soak** badge. | No piece fits |
| **Springs** | Dedicated 3-Act Valley of Vapors geothermal surge (Act I Opening Basin `0–19`, Act II Thermal Rise `20–35`, Act III Final 10 `36–47`). Spring vents sit on the board; clear the row, column or 3×3 pool a vent is in to **open** it (+40 × heat and +1 heat). New vents bubble up each round (Act-scaled, up to 6). **Open 47 vents** to win (displaying exact `47/47`). | 47 opened (win) or no fit |
| **Spring Trail** | **24 hand-designed, DFS-solver-verified puzzles** across two rings: **Ring 1** (12 Bathhouse Row landmarks, unlocking each place's fact card and earning the `Row Walker` title) and **Ring 2** (12 Spring Science Mastery boards combining tufa, vents and multi-clear cascades, earning `Trail Master`). Uses a forgiving 3-stage Accordion funnel (`#1–#3` linear → `#4–#9` open Bathhouse Row Promenade → `#10–#12` Park Finale at 4/6 Row solves → Ring 2 at Ring 1 complete + 18★ in a rolling 3-puzzle window) with 3-star Undo mastery (`0` undos = 3★, `1–2` = 2★, `3+` = 1★) and an Up Next piece queue. | Goal met (win), or pieces run out / no fit (retry) |

## 4. Complete rules

1. The board is 9×9 and starts empty, except for tufa stones (Daily, Trail) and spring vents (Springs, Trail).
2. Each round deals three pieces into the tray. Pieces never rotate.
3. A piece may be placed on any empty cells it fully fits inside the board. Pieces can be placed in any order.
4. After a placement, every full row, column and 3×3 pool clears at once. Tufa stones and vents clear
   like tiles. A cell shared by two groups is cleared once.
5. When all three tray pieces are placed, three new ones are dealt (Trail: the next three from its fixed list).
6. The game ends when none of the remaining tray pieces fits anywhere on the board (or in Trail/Springs, immediately when the win goal is met).
7. **Scoring:** +1 per cell placed; clearing `G` groups at once scores `18 × G²` × heat multiplier;
   each dissolved tufa stone scores +20 × heat multiplier (Daily awards +150 bonus and +1 heat for sweeping all 8 opening tufa);
   each opened spring vent scores +40 × heat multiplier and adds +1 heat; emptying the whole board with a clear scores a +300 × heat multiplier "clear spring" bonus.
8. **Heat & 143°F Boil-Hold:** clearing `G` groups raises heat by `G` (plus +1 per opened vent and +1 on Daily's 8-tufa sweep, max 12); a non-clearing placement lowers heat by 1, except at peak `143°F` (`heat === 12`) where **Boil-Hold** preserves Boiling for 1 non-clearing placement before cooling. Multiplier = `1 + 0.25 × heat` (×1 to ×4). The meter shows `60°F + heat × 83/12`, reaching `143°F` at max ("Boiling").
9. **Undo & Hint:** before each placement the game takes a snapshot. Undo restores it (including **Post-Loss Undo** from Game Over whenever undo budget remains, rolling back committed records via the run ledger). Budget per round: 1 by default (settings: 0, 1, 3); Trail: unlimited (stars reflect undos used). Classic, Daily and Springs also offer 1 free **Hint** per tray (`H` or Hint button); Hint is intentionally hidden in Spring Trail to protect pure spatial deduction.
10. **Mercy deal** (Classic, Springs): if none of a new tray's pieces fits (or no complete 3-piece order exists), redraw until playable. Daily uses a board-independent seeded stream so every player sees the exact same pieces.
11. **Decoupled Eras & Pressure** (Classic): visual eras advance at `0` ancient, `150` frontier, `400` gilded-spa, `800` roaring, `1,500` midcentury, `2,500` revival, `4,000` modern so casual runs discover Bathhouse Row's history; the difficulty piece-pressure ramp remains decoupled at `0..8,000` (`High Flow` at `5,500`, `Peak Flow` at `8,000`).

## 5. Hot Springs content map

Full sourcing in `research/town-content.md` and `research/backdrop-notes.md`.

| Where | Content |
|---|---|
| Title screen | Logo with steam; interactive rotating spring-fact ticker (14 distinct sourced lines; click/Enter cycles, pauses on hover/focus/reduced motion); zero-height unlock counts (`N/27` cards, `N/12` goals) with unread antique-brass pips |
| Background | 7 era scenes in Classic (`0..4,000`), dedicated 3-Act Valley of Vapors progression in Springs, date-seeded Era of the Day in Daily Soak, and historical-year era backdrops in Spring Trail |
| Era arrival & Postcards | Concise in-play era cues plus preserved sourced historical captions on the 7 Era Postcards; clicking any collected Postcard or Game Over hero opens the 0-KB full-bleed Lightbox |
| Heat meter | 143°F average temperature; "Boiling" after Dunbar's 1804 "boiling springs" with 1-placement Boil-Hold grace |
| Springs mode | "47 springs" target across 3 acts, with the 43 / "about four dozen" hedge in the help text |
| Records screen | Elevated 4,400-year groundwater aquifer bar (lifetime groups × 10 years toward the USGS figure), interactive 30-day Daily Soak calendar, recent averages, and numeric progress tallies on locked Goals |
| Fact cards album | Lean **27-card** collection with sticky `All (27)` filter bar: 12 Bathhouse Row Place Cards (inline-SVG landmark crests), 7 Era Postcards (frosted locked teasers + Lightbox), and 8 distinct Water Cards |
| Spring Trail | 12 Bathhouse Row landmark boards (Ring 1 Place Cards) + 12 Spring Science Mastery boards (Ring 2 distinct sourced facts), swipeable inline-SVG Bathhouse Row skyline and mini 9×9 board previews |
| Tufa stones, vents, pools | Travertine tufa (4 lighting-safe un-rotated variants), glowing vents, algae and steam colors from the style guide |

## 6. Screens and UX flow

```
Title ─┬─ Classic / Daily Soak / Springs ──► Game ──► Pause (resume, restart, trail*, settings, help, save & menu)
       │                                        └──► Game over / Win summary ──► again | undo* | trail* | cards* | lightbox* | menu
       ├─ Spring Trail ──► swipeable SVG skyline + 24-board grid ──► Game (trail) ──► Win: card/fact ──► next | replay 3★ | trail
       ├─ Fact cards (All 27 + category filters + 0-KB Lightbox)  ├─ Records (aquifer + interactive cal + goals)  ├─ How to play  └─ Settings (4 sections)
       └─ Continue (smart latest Classic/Springs resume; Daily & Trail auto-resume per mode without colliding)
```

- **Game HUD:** score + live multiplier badge, best, mode label (tappable in Trail to re-read the level hint), heat meter, era/act caption, Hint button (hidden in Trail), Undo button with count and coach pulse, Pause button, Sound toggle; Springs: vents opened `N/47`; Trail: goal progress, solved count, Up Next queue (no score/heat chrome).
- **Game over / summary:** clickable Era hero banner (opens 0-KB Lightbox), animated final score, "New best!" ribbon when earned, point breakdown, mode-specific coaching tip (or Trail `L.hint`), clickable links straight to freshly earned Era Postcards / Water Cards, Post-Loss Undo button whenever undo remains, Try/Play again, Spring Trail shortcut (in Trail), and Menu.
- **No-moves feedback:** tray pieces that cannot fit are dimmed with a "no room" mark, and Undo/Hint pulse gently when a tray is doomed so the end never surprises.

## 7. Art direction

Visual v2 (2026-10-29) replaced the v1 vector art and Wave 3–4 hardened framing, rendering, and VRAM budgets; see `VISUAL-PLAN.md`, `VISUAL-REPORT.md`, and `research/backdrop-notes.md`.

- **Backdrops:** 8 shipped painted WebP vistas (7 eras + Title winter sunrise) overlooking Central Avenue and Bathhouse Row toward Hot Springs Mountain and its tower, framed per era via `ERA_CROP` (keeping the 1933 Army & Navy Hospital spire clear on desktop and dialing portrait zoom to `1.04×–1.08×` so street-level human-scale cues stay legible) and inspectable full-bleed in the 0-KB Era Postcard Lightbox (`#sc-lightbox`). Demand-driven LRU streaming keeps `<= 2` decoded backdrops resident in VRAM. Procedural Bathhouse Row rooflines + `research/skyline.json` tower remain as the `?art=0` fallback.
- **Board:** a bronze moulding with glazed cream tile band, ceramic grout, Fordyce lozenges, era/act patinas, a brass bead (9-slice `128×128` glow), and nine pools of live thermal water (WebGL 1.0 caustics driven by `ERA_WATER` with `L <= 0.11` Boiling luminance cap and 4-tier 2D fallback when WebGL is off or Lite/Reduced Motion is active).
- **Tiles:** 8 Blender-rendered `160×160` WebP glazed art tiles (fixed six-glaze palette: terra cotta, amber, cobalt, green, cream, violet — never veiled by era tints) plus porous travertine tufa (4 lighting-safe un-rotated variants) and sunken glowing vents. Pre-warmed across strictly 2 mip tiers (`<= 22` offscreen canvases permanently). Pressed-in patterns are on by default for colorblind play.
- **Clears:** swell and glow, era-tuned steam plumes, water ripples, droplets, glaze chips (with ~30% Frontier timber splinters and travertine dust on tufa clears), turquoise vent-emergence ripples, and a centred escalating banner (`Soak`, `Steam`, `Cascade`, `Spring Surge`) with heat word (`Warm`, `Hot`, `Steaming`, `Scalding`, `Boiling`).
- **Type:** Fraunces (OFL, embedded WOFF2) for the logo, score, headings and banners; system sans for UI text; no text under 12 px.
- **Layout:** no side panels. Transparent HUD; brass thermometer beside the board (landscape) or heat strip above it (portrait); three recessed tray wells with left/right tray-side preference.

## 8. Audio direction

Synthesized WebAudio throughout, zero external audio assets:
- **Tactile SFX:** clay/ceramic placement taps, heat-pitched rising steam hiss and clear chimes (pitch-scaled with combo & heat), vent bubbling pops, tufa stone crumble, invalid thud, era arrival bell, gentle descending game-over cadence, Trail star chimes, and bright win arpeggios.
- **Generative Music & Ambience (adopted):** procedural era-adaptive generative WebAudio music (`SCORES`, shifting harmony and instrumentation across all 7 eras and Springs acts) routed through a shared procedural `ConvolverNode` bathhouse hall reverb (`-14 dB` send), layered with continuous thermal water & bathhouse ambience (`SCENES`).
- **Controls & Lifecycle:** master Sound toggle (`M`) and Volume slider (default 70%) plus independent SFX, Music (toggle + volume), and Ambience (toggle + volume) controls in Settings; live Pause/Settings audio auditioning and clean fade-out/suspend on Pause or background tab visibility.

## 9. Accessibility

- Full keyboard play (§MECHANICS 6); visible focus rings; `Esc` always backs out.
- Text contrast ≥ 4.5:1 in both themes (tokens are pre-checked; HUD text sits on solid panels).
- Colorblind-safe: patterns on every tile color, on by default; clears are signaled by shape and motion too.
- `prefers-reduced-motion` honored by default (setting: system / reduced / full).
- Large-text setting scales all DOM text by 125%; the canvas scales with the viewport.
- A polite ARIA live region announces placements, clears, score and game over.

## 10. Mobile and touch

- Portrait layout: HUD, heat bar, board (full width minus 16 px), tray below.
- Touch targets ≥ 44 px; tray slots are at least 110 × 100 px on a 390 px wide phone.
- Drag is the touch default: dragged pieces float clear above the finger and snap forgivingly. Tap-select then
  tap-place is an opt-in "Tap to place" setting (off by default), after testers found two-tap placement fiddly.
- No page scrolling or zoom during play (`touch-action: none` on the canvas).

## 11. Performance budgets

60 fps on a mid-range laptop (`taskMs < 10 ms` under 4× mobile CPU throttling); idle CPU/GPU zero behind modal overlays or after 30 s idle (`0` WebGL/2D redraws behind Pause/menus/hidden tab); `<= 2` decoded backdrops resident in VRAM (`<= 25 MB` target mobile raster VRAM); `<= 22` cached offscreen tile sprites with `0` mid-clear canvas allocations; HTML ≤ 2 MB, images ≤ 2.6 MB (16 WebPs, 2.30 MB) loaded by priority; interactive in ≤ 2 s; zero external network requests.

## 12. Save / load

Settings, difficulty/mode bests, daily scores and streak calendar, Trail completions and 3-star ratings, earned goals, eraMax, recent histories, and lifetime stats go to `localStorage['hs-thermal-blocks-v1']` via a monotonic multi-tab merge core (try/catch; game works without storage). Classic resumes live in `SAVE.resume`, while Daily Soak, Springs, and per-level Spring Trail runs persist in non-colliding sub-slots under `localStorage['hs-thermal-blocks-run-v1']`.

## 13. Acceptance criteria

| # | Feature | Criterion |
|---|---|---|
| AC1 | Load | The title screen shows the logo, four mode buttons, menu links (with `N/27` cards and `N/12` goals tallies) and the interactive ticker, with no console errors and no network requests |
| AC2 | Board | The 9×9 board draws with nine pool boxes and lead lines; all 81 cells are visible and unclipped at both viewports |
| AC3 | Deal | A new game deals three pieces; with the same seed, the same pieces are dealt |
| AC4 | Placement | A piece placed on empty in-bounds cells fills exactly those cells and adds +cells to the score |
| AC5 | Invalid | A placement over a filled cell or off the board is rejected and the state is unchanged |
| AC6 | Row/col clear | A full row or column clears and scores `18 × multiplier` |
| AC7 | Box clear | A full 3×3 pool clears |
| AC8 | Multi-clear | Two groups at once score `18 × 4 × multiplier` and clear their shared cell once |
| AC9 | Heat | Heat rises by groups cleared (+1 per opened vent, +1 on Daily 8-tufa sweep), holds 1 non-clearing move at 143°F (Boil-Hold), otherwise falls by 1, caps at 12 = 143°F |
| AC10 | Refill | After the third piece is placed, a new tray of three is dealt |
| AC11 | Game over | When no tray piece fits, the game ends and the summary shows clickable Era hero, score, best, breakdown, lines, best heat, and Post-Loss Undo when available |
| AC12 | No-moves cue | Tray pieces that cannot fit are dimmed while the game continues, and Undo/Hint coach gently when doomed |
| AC13 | Undo | Undo restores the board, score and tray (including Post-Loss Undo with ledger rollback); the per-round budget is enforced; setting 0 disables it |
| AC14 | Drag | A real pointer drag from a tray slot to the board places the piece with a snapped ghost |
| AC15 | Tap-place | Touch, with the Tap to place setting on: tap a piece, tap the board (ghost appears), tap again on the resolved ghost target to place |
| AC16 | Keyboard | A full turn can be played with 1/2/3, boundary-releasing Tab, arrows and Enter; modal dialogs trap Tab; Esc backs out |
| AC17 | High score | Bests persist across reloads and merge monotonically across tabs via localStorage; the game still runs if storage throws |
| AC18 | Daily | The daily layout, Era of the Day and board-independent pieces are identical for the same date and differ for another date |
| AC19 | Springs | Vents clear only with their group, count opened vents across 3 acts, respawn up to 6, and opening 47 wins (`47/47`) |
| AC20 | Trail | 24 solver-verified levels across Ring 1 (Bathhouse Row) and Ring 2 (Spring Science) with 3-stage Accordion unlocking, rolling-3 Ring 2 window, swipeable SVG skyline, mini previews, 3-star rating, Ring 1 Place Cards and Ring 2 facts |
| AC21 | Fact cards | Lean 27-card album defaults to `All (27)` with category filter pills, SVG Place Card crests, 8 distinct Water Cards, and 7 Era Postcards opening the 0-KB Lightbox |
| AC22 | Eras | Crossing Classic score thresholds (`0..4,000`, decoupled from `0..8,000` pressure) switches the backdrop, music and ambience; tile glazes stay fixed |
| AC23 | Clear FX | Clears show flash, steam, ripples and era/tufa/vent particles; reduced motion replaces them with a short fade |
| AC24 | Audio | Synthesized SFX, generative era music (with hall reverb) and bathhouse ambience play through WebAudio after a gesture; independent toggles/volumes work; zero errors without audio |
| AC25 | Patterns | Every tile color has a distinct pattern; the setting can hide them |
| AC26 | Settings | Difficulty, sound/SFX/music/ambience, motion, patterns, undo, tap-to-place, haptics, large text, theme, effects and tray side persist and take effect |
| AC27 | Help | How-to-play explains rules, scoring, controls, modes and sources |
| AC28 | Layout | No horizontal overflow; controls on-screen; touch targets ≥ 44 px on mobile (including swipeable skyline and 5-col calendar) |
| AC29 | Dark scheme | Under dark and light color schemes all menus meet WCAG ≥ 4.5:1 text contrast |
| AC30 | Resume | Leaving Classic, Springs, Daily Soak, or any Trail board preserves independent non-colliding resumes |
| AC31 | Performance | ≥ 55 fps (`taskMs < 10 ms` at 4× CPU throttle); `<= 2` LRU backdrops; `<= 22` sprites; `0` paused-modal draws; index.html ≤ 2 MB and assets ≤ 2.6 MB; load ≤ 2 s; a lite path without WebGL |
| AC32 | Records | Records displays the elevated 4,400-year groundwater aquifer bar, interactive 30-day calendar with date bests, recent averages, bests and numeric progress tallies on Goals |

## 14. Out of scope

Online leaderboards or sharing; accounts; piece rotation; hold/swap slot; countdown timers; ads or purchases;
fire or flood hazard modes; localization beyond English; external network dependencies or third-party trackers.
