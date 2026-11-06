# Thermal Blocks refinement, November 2026

**User-directed early closure. Formal release HOLD.**

The user directed testing to end. This report retains the original scoped observations and their limitations. The formal campaign record remains BASE, QUEUED, loop 0. Full qualification, production deployment and production smoke remain unverified. [R41 campaign record](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c/report.json>)

## Source and publication

The fix history integrated into `main` contains `e886e05ea93859ce6daa4b764bfbdfa6ac275f67`, `cb3774568406c70a04b3a64be6eab0454f3e2fdd`. The fix already includes the tracked `index.html`. Its SHA-256 is `7ef078661863049c4ff61afa5172dd5229891c499cb98d941c8018e023fac32b`. No tests were run during this integration.


The historical publication inventory records `5b3c63879937934e3c95a8c29172ce4091defa1a` at commit `5b3c63879937934e3c95a8c29172ce4091defa1a`. The corresponding committed index SHA-256 was `3b1cd1a9f45dbaab91059825f3fc83a7b0059e81b26bf1fc59176f8fb3a30c6d`. Current public response bytes and deployment identity still require verification. [Historical site ref inventory](<C:/Video Game Projects/campaigns/refinement-2026-11/preflight/p0-01-attempt1/stdout.txt>) · [Committed index inventory](<C:/Video Game Projects/campaigns/refinement-2026-11/preflight/p0-11-assessment/stdout.txt>)

- Local `refine/2026-11` at `cb3774568406c70a04b3a64be6eab0454f3e2fdd` in `D:/hsg-campaign/worktrees/block-puzzle/refine-2026-11-hud-20261104`.

## Coverage matrix

The rows record bounded observations by workflow. Formal completion of each applicable workflow and profile is still pending. [Workflow and profile requirements](<C:/Video Game Projects/campaigns/refinement-2026-11/MASTER-PROMPT.md>)

| Workflow | Scoped evidence and remaining work |
| --- | --- |
| WF-01 Build and integrity | Historical preflight retained the exact committed index for the no-build game. Current candidate artifact, budgets and integrity gate remain pending. |
| WF-02 Feature inventory | Complete feature-to-real-input coverage map remains pending. |
| WF-03 Core loop | Classic reached a loss after 16 placements. Sequential Trail used 45 trusted placements to reach earned cards and unlocks, then reloaded progress at 6/12. Daily and Springs remain partial. |
| WF-04 Input | Physical iPad Safari exercised a lifted native tray drag in Classic and checked the resulting board and score. |
| WF-05 Layout | Large-text SCORE caption is visible at the checked widths. |
| WF-06 Mechanics | Independent full rules, seeded shadow models and balance comparisons remain pending. |
| WF-07 Persistence | Scoped two-tab trials exercised stale settings against an earned save. The source fix preserves the newer saved run. |
| WF-08 Audio | Full real-input audio, analyser and recovery evidence remains pending. Human audibility remains unverified. |
| WF-09 Lifecycle | Full lifecycle matrix remains pending. Individual actions are listed in the retained scoped evidence. |
| WF-10 Performance | Hardware-qualified frame cost, throttled load and 30-minute soak remain pending. |
| WF-11 Accessibility | Full keyboard, contrast, scalable text and assistive checks remain pending. |
| WF-12 Content and licensing | Complete help, site controls, claims and licensing audit remains pending. |
| WF-13 Player integration | Scoped local player paths were observed in Chrome and Edge. Current formal workflow, exact production routes and candidate smoke remain pending. |
| WF-14 Visual polish | Large-text SCORE caption is visible at the checked widths. |

## Defect log

| Severity | Recorded defect or finding | Integration status |
| --- | --- | --- |
| S3 | Large text SCORE caption clipped in wide desktop layouts | Integrated source fix `e886e05ea93859ce6daa4b764bfbdfa6ac275f67`. Included in the repository integration. Production deployment remains unverified. |
| S0 | Stale tab setting overwrote saved run | Integrated source fix `cb3774568406c70a04b3a64be6eab0454f3e2fdd`. Included in the repository integration. Production deployment remains unverified. |

The integrated changes affect play as follows. Wide layouts retain the SCORE label, and an older tab changing a setting preserves the newer run. [Local commit and worktree index](<D:/hsg-campaign/platform-support/release-controller/final-report-readiness-031009b8-9c99-4849-87ee-76e539afcebb/REPORT-READINESS.json>)

## Before and after

The selected unchanged baseline had 33 cases per tested size. The SCORE caption recorded six expected RED caption checks, then passed the three checked viewport geometries and an actual placement after the fix. Affected save evidence comprises 22 portable checks, 9 browser checks, 33 original affected desktop checks and two natural two-tab trials. [Evidence 1 · 10463](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-blocks-save-acceptance-ab9c7b18-8129-407d-9623-7d268623c419/review.json>)

## Evidence tiers

- Installed Chrome and Edge basic player observations are scoped E2 desktop evidence. Hardware qualification and broader workflow coverage remain separate. [Desktop scope and profile limits](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c/report.json>)
- The physical iPad Safari lane records 1 completed bounded gameplay run across 1 attempt. The R8 local route returned 200 with body SHA-256 `7ef078661863049c4ff61afa5172dd5229891c499cb98d941c8018e023fac32b`. The last gameplay body SHA-256 was `7ef078661863049c4ff61afa5172dd5229891c499cb98d941c8018e023fac32b` from source commit `cb3774568406c70a04b3a64be6eab0454f3e2fdd`. Physical iPad scope is recorded separately from the Android and WebKit proxy tiers. [Physical iPad route](<D:/hsg-campaign/evidence/refinement-2026-11/ipad-route-verification-r8-9157fa31-c2c2-46ee-a788-e9bb70e3a59e/route-report.json>) · [Physical iPad gameplay](<D:/hsg-campaign/evidence/refinement-2026-11/ipad-final-report-c14434a9-3a6e-49f6-83fa-a1bea341c260/FINAL-REPORT.json>)

## Pending coverage and limitations

- 33 unchanged baseline cases per size. Classic and sequential Trail had scoped actual play. Daily and Springs remained partial.
- Full A1 and A2 Android Chrome workflow evidence, the complete device and mode matrix, all historical save/rollback paths, independent rounds and production smoke remain pending. [R41 campaign record](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c/report.json>)

## Not Covered

No approved exclusions. Pending work is listed above.

## Manual checklist candidates

- Real iPhone Safari, Android handset performance and heat, and audible-output review remain for the end-of-campaign manual checklist. [Manual-checklist requirement](<C:/Video Game Projects/campaigns/refinement-2026-11/MASTER-PROMPT.md>)
