# Thermal Blocks: build report

**Game:** Thermal Blocks (`games/block-puzzle/`), an original 9×9 block-placement puzzle on a Hot Springs
bathhouse tile floor. Wave 1, built 2026-10-28.

**Final result:** `node shared/test-harness/run.mjs games/block-puzzle --milestone final` runs
**50 of 50 tests passing**. The tests cover desktop 1280×800 and mobile 390×844, with zero console errors
and zero external requests. They produce **75 screenshots** (38 desktop, 37 mobile), and every one was opened and inspected.

## What was built

| Area | Delivered |
|---|---|
| Format | One hand-written `index.html`: 106 KB, 1,804 lines, no network. Canvas 2D art drawn in code, WebAudio synthesis, system fonts |
| Core rules | 9×9 board, three-piece trays, 40 original pieces (each orientation is a separate piece, so no rotation), row/column/3×3 clears, multi-clear `18 × G²` scoring, a heat multiplier up to ×4 (60°F → 143°F, then "Boiling"), a +300 clear-spring bonus, a mercy deal, and game over when no piece fits |
| Modes | **Classic** (endless, 7 era backgrounds); **Daily Soak** (seeded by date: 8 tufa stones and a fixed piece sequence that does not depend on where you play); **Springs** (spring vents tapped by clearing their group, respawning up to 6, 47 taps to win); **Spring Trail** (12 hand-designed puzzles named for real places, each unlocking a sourced fact card) |
| Input | Pointer drag with a snapped ghost and a preview of the groups it would clear, with the piece lifted above the finger on touch. Tap a piece, tap the board to preview, tap again to place. Mouse click-select / click-place. Full keyboard play (`1 2 3`, Tab/Q/E, arrows, Enter/Space, U or Ctrl+Z, M, Esc) |
| Feedback | Algae-green flash, steam puffs, ripple rings, score and multiplier popups, screen shake on big clears, tray deal and return animations, vent steam, era toasts with sourced captions, dimmed "no room" pieces |
| Undo | Snapshot undo with a per-round budget (setting 0/1/3, default 1). Unlimited in Spring Trail, including "Undo last move" from a lost puzzle |
| Screens | Title (emblem, Continue, 4 modes, sourced fact ticker), pause, game over / win summary, Spring Trail level select, fact card album, records (with the "water's age" counter toward 4,400 years), how to play, settings |
| Persistence | `localStorage` (all wrapped in try/catch; tested with storage throwing): settings, bests, daily bests by date, trail progress, lifetime stats, and an in-progress Classic/Springs game to resume |
| Accessibility | Colorblind patterns on all six tile colors (on by default), reduced motion (system/full/reduced), large text, light/dark menu theme (follows the system by default), an ARIA live region narrating every turn, ≥ 44 px controls, ≥ 4.5:1 text contrast |
| Hot Springs content | 7 eras from `research/timeline.json`, 11 sourced ticker facts, 12 sourced fact cards, a 143°F heat scale, the 47-springs goal (hedged with 43 / "about four dozen"), the 4,400-year water age, tufa/algae/steam colors from the style guide. All listed with sources in `research/town-content.md` |

### Files

| File | Purpose |
|---|---|
| `index.html` | The game |
| `research/town-content.md` | Every place, fact, color and caption used, with sources |
| `SAMPLES.md` | Code-sample survey (5 samples, licenses, verdicts). Only the public-domain mulberry32 PRNG was adapted |
| `MECHANICS.md`, `PRD.md`, `DEV-PLAN.md` | Foundation, requirements (32 numbered acceptance criteria), plan, test matrix and defect log (20 defects, all fixed) |
| `tests/*.test.mjs` | 8 test files: boot, rules, input, gameover, modes, trail, polish, perf |
| `tools/rules-node.mjs` | Loads the game's own `RULES` block into Node; a depth-first solver proves every trail level solvable and measures random-play win rates; writes `tools/solutions.json` |
| `tools/solutions.json` | Solver solutions, which `tests/trail.test.mjs` replays through the real game. The test fails if a level changes and this file is stale |

## Acceptance criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| AC1 | Title screen, 4 modes, ticker, no errors | Met | boot → `01-title` |
| AC2 | Board drawn, all cells visible | Met | boot → `02-board-empty` |
| AC3 | Seeded deals reproducible | Met | rules → seeded deal |
| AC4 | Placement fills cells, +cells score | Met | rules → `10-placed` |
| AC5 | Invalid placement rejected, state unchanged | Met | rules → place and reject |
| AC6 | Row/column clear scores 18 × mult | Met | rules → clears |
| AC7 | 3×3 pool clear | Met | rules → clears |
| AC8 | Multi-clear `18 × 4 × mult`, shared cell once | Met | rules → `12-after-multi-clear` |
| AC9 | Heat rises, cools, caps at 143°F | Met | rules → `13-heat-boiling` |
| AC10 | Refill after third piece | Met | rules → refill |
| AC11 | Game over and summary | Met | gameover → `21-game-over` |
| AC12 | No-moves cue | Met | gameover → `20-no-moves-dim` |
| AC13 | Undo restores state; budget enforced; 0 disables | Met | gameover → undo budget; trail → loss undo |
| AC14 | Real pointer drag with snapped ghost | Met | input → `30-drag-ghost` |
| AC15 | Touch tap-select / tap-place, plus a real touch drag | Met | input → `31-tap-ghost` |
| AC16 | Full keyboard turn; Esc pauses | Met | input → `32-keyboard-cursor`, `33-pause` |
| AC17 | Bests persist; runs without storage | Met | gameover → storage blocked |
| AC18 | Daily identical per date, differs across dates | Met | modes → `40-daily` |
| AC19 | Springs vents, respawn, 47 wins | Met | modes → `41-springs`, `42-springs-win` |
| AC20 | 12 solvable trail levels; win unlocks card and next level | Met | trail → all 12 replayed and won; `43`–`45` |
| AC21 | Album shows unlocked cards with sources; locked hidden | Met | trail → `46-cards` |
| AC22 | Eras switch background, glazes and caption | Met | modes → `50`–`56` |
| AC23 | Clear effects; reduced-motion variant | Met | polish → `60-clear-fx`, `61-clear-reduced` |
| AC24 | WebAudio sounds, mute, volume, no errors | **Partial** | Audio graph, gain, mute and volume are verified automatically, and all 11 sounds run without errors. Nobody has listened to them (headless test browser) |
| AC25 | Distinct pattern per color; toggle | Met | polish → `62-patterns`, `63-patterns-off` |
| AC26 | Settings persist and apply | Met | polish → `64-settings` |
| AC27 | Help explains rules, scoring, controls, modes | Met | polish → `65-help` |
| AC28 | No overflow; targets ≥ 44 px on mobile | Met | `checkLayout` in most tests; polish → touch targets on 7 screens |
| AC29 | Dark scheme legible | Met | polish → `66`–`68` (menus switch to dark tokens; the game canvas uses era scenes in both schemes by design) |
| AC30 | Resume after reload | Met | modes → `47-continue` |
| AC31 | ≥ 55 fps during clears; ≤ 2 MB; ≤ 2 s load | Met | perf → 60.3–62.1 fps, 106 KB, 60–84 ms to hooks |
| AC32 | Records with water's-age line | Met | modes → `48-records` |

The ARIA live region narrates every turn, but no one has checked it with an actual screen reader. The PRD
does not make that an acceptance criterion; it is listed below as a gap.

## Test results (final)

```
50/50 passed · screenshots in games\block-puzzle\screenshots\final
performance: index.html 105.7 KB; load 60 ms (desktop) / 84 ms (mobile)
performance: fps title 60.5, during clears 61.1 / 60.5 / 60.4, heap 9.5 MB (desktop)
performance: fps title 60.6, during clears 62.1 / 60.5 / 60.7, heap 9.5 MB (mobile)
soak (greedy bot, each mode played to game over, no errors):
  classic 140 moves → 1,753 (Gilded Spa) · springs 62 moves, 17 taps → 1,953 · daily 242 moves → 3,484 (Roaring)
```

Milestone runs: m1 12/12, m2 20/20, m3 33/33, m4 49/49, final 50/50. The gallery at
`screenshots/index.html` is regenerated by every run and is current.

**Spring Trail solver** (`node games/block-puzzle/tools/rules-node.mjs`): all 12 levels solvable. The share of
random legal playouts that win runs from 74% (Ozark, a deliberate breather) to 0% for the planning puzzles
(Hale, Fordyce, Superior, Quapaw, Grand Promenade, Thermal Water Cascade), so random play almost never solves them.

## Performance

| Metric | Budget | Measured |
|---|---|---|
| File size | ≤ 2 MB | 106 KB |
| Time to interactive (hooks ready) | ≤ 2 s | 60–84 ms |
| Frame rate during multi-clear effects | 60 fps | 60.3–62.1 fps |
| JS heap | — | 9.5 MB |
| Idle cost | near zero | The loop redraws only when something changed, effects are alive, the title steam animates or vents steam (all off under reduced motion). Backgrounds, the board base and tile sprites are cached offscreen |

## Known gaps

- **Audio not heard by a person.** Sounds are verified only as WebAudio graphs. Levels and timbre deserve a listen.
- **Screen reader not tested.** The live region text is written for screen readers but hasn't been tried with NVDA or VoiceOver.
- **Springs balance.** The soak bot taps 13–31 springs before it runs out of room, so 47 is a stretch goal. That
  is intended, but human playtesting may show it should be 30 or so, or that vents should respawn faster.
- **Era thresholds** (0 / 400 / 1,000 / 2,000 / 3,500 / 5,500 / 8,000) were tuned against a simple greedy
  bot (about 15 points a move), not against people.
- **Large text** scales DOM text only. Canvas text scales with the viewport but ignores the setting.
- **Daily Soak** has no share or leaderboard (out of scope: no network).
- Every hex color is an estimate inherited from `shared/design` (see its caveats).

## Harness requests

1. **Expose the screenshot directory (or milestone) on `t`.** `t.shot` always waits for `isIdle()`, so a mid-animation
   shot needs a workaround. This game added a `freezeFx` hook that makes `isIdle()` true while effects are held.
   A `t.shot(name, { waitStable: false })` option would remove that need.
2. **A contact-sheet tool.** Inspecting 75 screenshots one by one is slow and burns the image budget. I built labeled
   2×2 and 4×1 sheets with Playwright `setContent` in my scratchpad. Python Pillow is not installed on this machine.
   A `shared/test-harness/sheets.mjs` that writes `screenshots/<milestone>/sheets/*.png` would help every game.
3. **Node-side rule tests.** Tests that need no browser (the trail solver) currently live in `tools/`. A harness mode
   that runs plain `*.node.mjs` checks would let them sit in the matrix with a pass/fail line.
4. **Lesson for `LESSONS.md`:** large Python heredocs in Git Bash break on unbalanced apostrophes in the embedded
   text. Write edit scripts to a file, or use the Edit tool.

## Notes for the coordinating session

- Nothing was committed. All changes are inside `games/block-puzzle/`; `reference-samples/` stayed empty (no code downloaded).
- Commit `tools/solutions.json` along with the levels. The trail test reads it, and it must be regenerated
  (`node games/block-puzzle/tools/rules-node.mjs`, about 20 s) whenever a level changes.
- The screenshot folders `m1`–`m5` are earlier milestone runs kept for the gallery; `final` is authoritative.
