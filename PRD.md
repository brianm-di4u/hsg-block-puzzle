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
| **Classic** | Endless. Three pieces a round with a mercy deal. Score raises the era. | No piece fits |
| **Daily Soak** | Seeded by the local date: the same tufa stones and the same piece sequence for everyone that day. One best score per date. | No piece fits |
| **Springs** | Spring vents sit on the board. Clear the row, column or pool a vent is in to tap it (+40 × heat). New vents bubble up each round (up to 6). Tap 47 to win. | 47 taps (win) or no fit |
| **Spring Trail** | 12 hand-designed puzzles named for Hot Springs places, each with a fixed piece list and a goal. Winning unlocks that place's fact card. Unlimited undo and restart. | Goal met (win), or pieces run out / no fit (retry) |

## 4. Complete rules

1. The board is 9×9 and starts empty, except for tufa stones (Daily, Trail) and spring vents (Springs, Trail).
2. Each round deals three pieces into the tray. Pieces never rotate.
3. A piece may be placed on any empty cells it fully fits inside the board. Pieces can be placed in any order.
4. After a placement, every full row, column and 3×3 pool clears at once. Tufa stones and vents clear
   like tiles. A cell shared by two groups is cleared once.
5. When all three tray pieces are placed, three new ones are dealt (Trail: the next three from its list).
6. The game ends when none of the remaining tray pieces fits anywhere on the board.
7. **Scoring:** +1 per cell placed; clearing `G` groups at once scores `18 × G²` × heat multiplier;
   emptying the whole board with a clear scores a +300 "clear spring" bonus; each vent tapped scores +40 × heat multiplier.
8. **Heat:** clearing `G` groups raises heat by `G` (max 12); a placement that clears nothing lowers heat by 1.
   Multiplier = 1 + 0.25 × heat (×1 to ×4). The meter shows 60°F + heat × 83/12, reaching 143°F at max ("Boiling").
9. **Undo:** before each placement the game takes a snapshot. Undo restores it. Budget per round: 1 by
   default (settings: 0, 1, 3); Trail: unlimited. No undo after the game ends.
10. **Mercy deal** (Classic, Springs): if none of a new tray's pieces fits, redraw the largest up to 12 times.
11. **Eras** (Classic, Springs, Daily): 0 ancient, 400 frontier, 1,000 gilded-spa, 2,000 roaring,
    3,500 midcentury, 5,500 revival, 8,000 modern (tuned with the soak-test bot: about 15 points a move).

## 5. Hot Springs content map

Full sourcing in `research/town-content.md`.

| Where | Content |
|---|---|
| Title screen | Logo with steam; rotating spring-fact ticker (11 sourced lines) |
| Background | 7 era scenes by score, using the era ids and palettes |
| Era arrival toast | One sourced caption per era |
| Heat meter | 143°F average temperature; "Boiling" after Dunbar's 1804 "boiling springs" |
| Springs mode | "47 springs" target, with the 43 / "about four dozen" hedge in the help text |
| Records screen | "Water's age": lifetime lines × 10 years toward the 4,400-year USGS figure |
| Spring Trail | 12 places, 12 fact cards with sources |
| Tufa stones, vents, pools | Tufa, algae and steam colors from the style guide |

## 6. Screens and UX flow

```
Title ─┬─ Classic / Daily Soak / Springs ──► Game ──► Pause (resume, restart, settings, help, quit)
       │                                        └──► Game over / Win summary ──► again | menu
       ├─ Spring Trail ──► level grid ──► Game (trail) ──► Win: fact card ──► next | trail
       ├─ Fact cards (album)          ├─ Records          ├─ How to play          └─ Settings
       └─ Continue (when a Classic/Springs game was left in progress)
```

- **Game HUD:** score, best, mode label, heat meter, era name, undo button with count, pause button,
  sound button; Springs: taps out of 47; Trail: goal progress and pieces left.
- **Game over / summary:** big final score, "New best!" when earned, lines, best heat (°F), pieces placed,
  era reached, Springs taps; buttons Play again and Menu.
- **No-moves feedback:** tray pieces that cannot fit are dimmed with a "no room" mark, so the end never surprises.

## 7. Art direction

- **Palette:** `thermal-water` for the board everywhere; the era palette (`ERA_PALETTE`) for backgrounds and
  tile glazes; UI chrome from the default light theme, or dark (deco-neon based) under `prefers-color-scheme: dark`
  or the Theme setting.
- **Board:** brass frame with a skylight border of small squares (style guide Motif 4); nine pools in two tints of
  pool blue; lead-came lines `#2A2A2A` between pools; empty cells read as wet tile with a faint ripple highlight.
- **Tiles:** rounded glazed squares with a top highlight, bevel and shadow; each color carries a pattern
  (dot, bars, chevron, lozenge, wave, cross) for colorblind play.
- **Tufa stones:** gray lobed blocks with lighter rims and dark damp streaks. **Vents:** a small pool in a tufa ring
  with a steam wisp.
- **Clears:** cells flash algae green, steam curls rise, ripple rings spread, popups show points and "×2.5".
- **Type:** Victorian serif for titles, system sans for UI, mono for numbers.

## 8. Audio direction

Soft and watery, all synthesized: clay tap on place, rising steam hiss plus a chime on clears (pitch rises
with heat), bubbling blips for vents, a dull thud for invalid drops, a bell for a new era, a gentle descending
phrase at game over, a bright arpeggio on wins. Default volume 70%, mute toggle.

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
- Dragged pieces float above the finger; tap-select then tap-place as an alternative.
- No page scrolling or zoom during play (`touch-action: none` on the canvas).

## 11. Performance budgets

60 fps on a mid-range laptop during clears; idle CPU near zero (draw on change); HTML ≤ 2 MB (target ≤ 150 KB);
interactive in ≤ 2 s; zero network requests.

## 12. Save / load

Settings, bests, daily scores, trail progress, lifetime stats and an in-progress Classic/Springs game go to
`localStorage` (try/catch, game works without it).

## 13. Acceptance criteria

| # | Feature | Criterion |
|---|---|---|
| AC1 | Load | The title screen shows the logo, four mode buttons, menu links and the ticker, with no console errors and no network requests |
| AC2 | Board | The 9×9 board draws with nine pool boxes and lead lines; all 81 cells are visible and unclipped at both viewports |
| AC3 | Deal | A new game deals three pieces; with the same seed, the same pieces are dealt |
| AC4 | Placement | A piece placed on empty in-bounds cells fills exactly those cells and adds +cells to the score |
| AC5 | Invalid | A placement over a filled cell or off the board is rejected and the state is unchanged |
| AC6 | Row/col clear | A full row or column clears and scores `18 × multiplier` |
| AC7 | Box clear | A full 3×3 pool clears |
| AC8 | Multi-clear | Two groups at once score `18 × 4 × multiplier` and clear their shared cell once |
| AC9 | Heat | Heat rises by groups cleared, falls by 1 on a non-clearing placement, caps at 12 = 143°F |
| AC10 | Refill | After the third piece is placed, a new tray of three is dealt |
| AC11 | Game over | When no tray piece fits, the game ends and the summary shows score, best, lines, best heat |
| AC12 | No-moves cue | Tray pieces that cannot fit are dimmed while the game continues |
| AC13 | Undo | Undo restores the board, score and tray; the per-round budget is enforced; setting 0 disables it |
| AC14 | Drag | A real pointer drag from a tray slot to the board places the piece with a snapped ghost |
| AC15 | Tap-place | Touch: tap a piece, tap the board (ghost appears), tap again to place |
| AC16 | Keyboard | A full turn can be played with 1/2/3, arrows and Enter; Esc pauses |
| AC17 | High score | Bests persist across reloads via localStorage; the game still runs if storage throws |
| AC18 | Daily | The daily layout and pieces are identical for the same date and differ for another date |
| AC19 | Springs | Vents clear only with their group, count taps, respawn up to 6, and 47 taps win |
| AC20 | Trail | 12 levels; each is solvable (solver-verified); winning unlocks its fact card; the next level unlocks |
| AC21 | Fact cards | The album shows unlocked cards with place, year, facts and source; locked ones are hidden |
| AC22 | Eras | Crossing each score threshold switches background and tile palette and shows the caption |
| AC23 | Clear FX | Clears show flash, steam and ripples; reduced motion replaces them with a short fade |
| AC24 | Audio | Sounds play through WebAudio after a gesture; mute and volume work; no errors without audio |
| AC25 | Patterns | Every tile color has a distinct pattern; the setting can hide them |
| AC26 | Settings | Sound, volume, motion, patterns, undo, large text and theme persist and take effect |
| AC27 | Help | How-to-play explains rules, scoring, controls and modes |
| AC28 | Layout | No horizontal overflow; controls on-screen; touch targets ≥ 44 px on mobile |
| AC29 | Dark scheme | Under dark color scheme the menus use the dark tokens and remain legible |
| AC30 | Resume | Leaving a Classic game and returning offers Continue and restores it exactly |
| AC31 | Performance | ≥ 55 fps during clear effects in the test browser; file ≤ 2 MB; load ≤ 2 s |
| AC32 | Records | The records screen shows bests, lifetime stats and the water's-age line |

## 14. Out of scope

Online leaderboards or sharing; accounts; rotation mode; hold slot; ads or purchases; music tracks
(only sound effects); more than 12 trail levels; fire or flood hazard modes; localization beyond English.
