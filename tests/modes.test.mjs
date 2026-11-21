// M3: Daily Soak, Springs, eras, resume, records + WF-7 W2-B04 exclusive 4-mode worlds & economy/heat regressions
import { loadRules } from '../tools/rules-node.mjs';
const R = loadRules();
const EMPTY = () => new Array(81).fill(0);
const ERA_IDS = ['ancient', 'frontier', 'gilded-spa', 'roaring', 'midcentury', 'revival', 'modern'];
const ERA_AT = [0, 150, 400, 800, 1500, 2500, 4000];   // backdrop steps (P-N03); were 0, 400, 1000, 2000, 3500, 5500, 8000

export const tests = [
  {
    name: 'daily determinism',
    async run(t) {
      const a = await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
      const b = await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
      const c = await t.game('newGame', { mode: 'daily', date: '2026-10-29' });
      t.equal(a.board, b.board, 'same date, same stones');
      t.equal(a.tray, b.tray, 'same date, same pieces');
      t.equal(a.board.filter(v => v === 7).length, 8, 'eight tufa stones');
      t.expect(JSON.stringify(a.board) !== JSON.stringify(c.board), 'another date, other stones');
      // the piece sequence does not depend on where you play (no mercy redraws in Daily)
      const seqA = [], seqB = [];
      for (const [seq, offset] of [[seqA, 0], [seqB, 3]]) {
        await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
        await t.game('setState', { board: EMPTY() });
        for (let round = 0; round < 3; round++) {
          const s = await t.state();
          seq.push(...s.tray.map(x => x.id));
          for (let k = 0; k < 3; k++) {
            const st = await t.state();
            const id = st.tray[k].id;
            // place each piece somewhere legal, starting from a different corner per run
            let placed = false;
            for (let r = offset; r < 9 && !placed; r++) for (let cc = 0; cc < 9 && !placed; cc++) placed = (await t.game('act', 'place', k, r, cc)).ok;
            t.expect(placed, 'placed ' + id);
          }
        }
      }
      t.equal(seqA, seqB, 'same daily piece sequence regardless of placements');
      await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
      await t.game('act', 'hideToast');
      await t.checkLayout();
      await t.shot('40-daily');
    },
  },
  {
    name: 'springs vents',
    async run(t) {
      await t.seed(21);
      let s = await t.game('newGame', { mode: 'springs' });
      t.equal(s.board.filter(v => v === 8).length, 4, 'starts with four vents');
      await t.game('act', 'hideToast');
      await t.shot('41-springs');
      // a vent clears only with its group
      const b = EMPTY();
      b[4 * 9 + 0] = 8; for (let c = 1; c < 8; c++) b[4 * 9 + c] = 3; b[0] = 8;
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }], springs: 0, heat: 0, score: 0 });
      await t.game('act', 'place', 0, 1, 1);
      s = await t.state();
      t.equal(s.springs, 0, 'no tap without a clear');
      const r = await t.game('act', 'place', 1, 4, 8);
      s = await t.state();
      t.equal(s.springs, 1, 'clearing the row taps its vent');
      t.equal(s.board[0], 8, 'other vent untouched');
      t.equal(s.heat, 2, 'clearing a vent adds +1 clear heat and +1 vent heat');
      t.equal(r.points, 1 + Math.round(18 * 1.5) + Math.round(40 * 1.5), 'vent tap scores 40 × multiplier (1.5× at heat 2)');
      // respawn: new tray adds one vent while fewer than 6
      const b2 = EMPTY(); [0, 10, 20, 30, 40].forEach(i => { b2[i] = 8; });
      await t.game('setState', { board: b2, tray: [null, null, { id: 'o1' }] });
      await t.game('act', 'place', 2, 8, 8);
      s = await t.state();
      t.equal(s.board.filter(v => v === 8).length, 6, 'a vent bubbles up with the new tray');
      await t.game('setState', { tray: [null, null, { id: 'o1' }] });
      await t.game('act', 'place', 2, 8, 6);
      s = await t.state();
      t.equal(s.board.filter(v => v === 8).length, 6, 'capped at six vents');
      // 47th tap wins
      const b3 = EMPTY(); b3[8 * 9 + 0] = 8; for (let c = 1; c < 8; c++) b3[8 * 9 + c] = 2;
      await t.game('setState', { board: b3, tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'o4' }], springs: 46, score: 5200, era: 4 });
      await t.game('act', 'place', 0, 8, 8);
      s = await t.state();
      t.expect(s.won && s.over, 'won at 47 taps');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
      const txt = await t.page.textContent('#sc-over');
      t.expect(/All 47 springs flowing/.test(txt), 'win title');
      await t.checkLayout();
      await t.shot('42-springs-win');
    },
  },
  {
    name: 'eras',
    async run(t) {
      await t.seed(2);
      await t.game('newGame', { mode: 'classic' });
      // crossing a threshold switches era and shows the caption
      const b = EMPTY(); for (let c = 0; c < 8; c++) b[c] = 1;
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'o4' }], score: 0, era: 0 });   // Clear Spring at heat 1: +399, crosses frontier (150) without leaping past gilded-spa (400)
      await t.game('act', 'place', 0, 0, 8);
      let s = await t.state();
      t.equal(s.eraId, 'frontier', 'score 150+ reaches the frontier era');
      const toast = await t.page.textContent('#toast');
      t.expect(/boiling springs/.test(toast), 'frontier caption shown');
      for (let i = 0; i < 7; i++) {
        const board = EMPTY();
        [10, 11, 12, 20, 30, 31, 40, 41, 42, 50, 60, 61, 62, 63, 70, 74].forEach((x, k) => { board[x] = 1 + (k % 6); });
        board[76] = 7; board[24] = 8;
        await t.game('setState', { board, tray: [{ id: 't4a' }, { id: 'o1' }, { id: 'l4b' }], score: ERA_AT[i] + 20, era: i, heat: i * 2 });
        s = await t.state();
        t.equal(s.eraId, ERA_IDS[i], 'era ' + ERA_IDS[i]);
        await t.game('act', 'hideToast');
        await t.shot('5' + i + '-era-' + ERA_IDS[i]);
      }
    },
  },
  {
    name: 'resume and records',
    async run(t) {
      await t.seed(30);
      await t.game('newGame', { mode: 'classic' });
      const first = (await t.state()).tray[0].id;
      let ok = false;
      for (let r = 0; r < 9 && !ok; r++) ok = (await t.game('act', 'place', 0, r, 0)).ok;
      const before = await t.state();
      t.expect(ok && before.tray[0] === null, 'placed ' + first);
      await t.page.reload();
      await t.page.waitForFunction(() => !!window.__game);
      const vis = await t.page.isVisible('#b-continue');
      t.expect(vis, 'Continue offered on the title screen');
      await t.checkLayout();
      await t.shot('47-continue');
      await t.page.click('#b-continue');
      const after = await t.state();
      t.equal(after.scene, 'game', 'resumed into the game');
      t.equal(after.board, before.board, 'board restored');
      t.equal(after.tray, before.tray, 'tray restored');
      t.equal(after.score, before.score, 'score restored');
      await t.game('scene', 'records');
      const txt = await t.page.textContent('#sc-records');
      t.expect(/Water’s age/.test(txt) && /4,400/.test(txt), 'water age line');
      await t.checkLayout();
      await t.shot('48-records');
    },
  },
  {
    name: 'W6-S1-01 exclusive 4-mode worlds: Springs 3-Act Valley of Vapors, Daily Era of the Day, Classic-only Postcards/Era Goals, Trail Master',
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      // 1. Springs stays locked to Valley of Vapors (era-ancient) at high score, progresses Acts I->II->III, never climbs eras or earns Classic Era Goals
      await t.game('newGame', { mode: 'springs' });
      const bAct = EMPTY(); for (let c = 1; c < 9; c++) bAct[c] = 1; bAct[4] = 8; bAct[80] = 2;
      await t.game('setState', { board: bAct, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], springs: 19, score: 5000, era: 0, heat: 0 });
      await t.game('act', 'place', 0, 0, 0);
      let s = await t.state();
      t.equal(s.eraId, 'ancient', 'Springs remains locked to Valley of Vapors backdrop even above 5,000 pts');
      t.equal(s.springs, 20, '20th vent enters Act II');
      const actToast = await t.page.textContent('#toast');
      t.expect(/Rising Vapors|Act II/.test(actToast), 'Act II transition toast fires: ' + actToast);
      const spText = await t.game('act', 'canvasText');
      t.expect(!spText.texts.some(x => /next era/i.test(x.text)), 'Springs canvas omits Classic "next era" copy');
      const goalsAfterSp = (await t.game('act', 'goals')).earned;
      t.expect(!goalsAfterSp['gilded-spa'] && !goalsAfterSp['modern-spa-city'], 'Springs never unlocks Classic Era Goals');
      t.equal((await t.game('act', 'save')).eraMax, 0, 'Springs never advances Classic eraMax postcards');
      // Springs win clamps at 47/47 even on multi-vent final clear, zero phantom refill, bespoke prose & Act reached row
      const bWin = EMPTY(); for (let c = 1; c < 9; c++) bWin[c] = 1; bWin[2] = 8; bWin[4] = 8; bWin[6] = 8;
      await t.game('setState', { board: bWin, tray: [null, null, { id: 'o1' }], springs: 45, score: 6200, heat: 2 });
      const roundBefore = (await t.state()).round;
      await t.game('act', 'place', 2, 0, 0);
      s = await t.state();
      t.expect(s.won && s.over, 'multi-vent clear from 45 wins Springs');
      t.equal(s.springs, 47, 'Springs counter clamped strictly to 47/47 on 3-vent final clear');
      t.equal(s.round, roundBefore, 'zero phantom tray deal on winning placement');
      t.expect(s.tray.every(x => x === null), 'winning slot stays empty (no refill after win)');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 5000 });
      const ovEraSp = await t.page.textContent('#ov-era');
      const ovStatsSp = await t.page.textContent('#ov-stats');
      t.expect(/All 47 thermal springs are flowing across the Valley of Vapors/.test(ovEraSp), 'bespoke 47-springs victory prose: ' + ovEraSp);
      t.expect(/Act reached/.test(ovStatsSp) && !/Era reached/.test(ovStatsSp) && !/To /.test(ovStatsSp), 'Springs results show Act reached and zero Era reached/To next era rows: ' + ovStatsSp);

      // 2. Daily Soak locks to date-seeded Era of the Day, fixed 1 undo regardless of Settings, Pure Soak badge + Daily par
      await t.game('act', 'setting', 'undo', 3);
      const d1 = await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      const d2 = await t.game('newGame', { mode: 'daily', date: '2026-11-13' });
      t.equal(d1.era, R.dateSeed('2026-11-12') % R.ERAS.length, 'Daily Nov 12 selects deterministic Era of the Day');
      t.equal(d2.era, R.dateSeed('2026-11-13') % R.ERAS.length, 'Daily Nov 13 selects deterministic Era of the Day');
      t.expect(d1.era !== d2.era, 'consecutive dates rotate Era of the Day');
      t.equal(d2.undoLeft, 1, 'Daily fixes undoLeft to 1 even when Settings undo is 3');
      // Daily stays locked to its Era of the Day at score 6000 and shows Era of the Day + Daily par + Pure Soak badge
      // Checkerboard with 1 empty cell in a 3x3-blocked pattern: 0 pre-clears, o1 fits at (0,0), o9 never fits anywhere -> immediate clean game over.
      const full = EMPTY();
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if ((r + c) % 2 === 1) full[r * 9 + c] = 1;
      await t.game('setState', { board: full.slice(), tray: [{ id: 'o1' }, { id: 'o9' }, { id: 'o9' }], score: 6000, placed: 10, undosUsed: 0, hintsUsed: 0 });
      await t.game('act', 'place', 0, 0, 0);
      s = await t.state();
      t.equal(s.era, d2.era, 'Daily never climbs out of its date-seeded Era of the Day');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
      const ovEraD = await t.page.textContent('#ov-era');
      const ovStatsD = await t.page.textContent('#ov-stats');
      t.expect(ovEraD.startsWith('Era of the Day: '), 'Daily results header names Era of the Day: ' + ovEraD);
      t.expect(/Era of the Day/.test(ovStatsD) && /Silver \(5,500\+\)/.test(ovStatsD) && /Pure Soak/.test(ovStatsD) && !/Era reached/.test(ovStatsD), 'Daily results show Era of the Day, Silver par, Pure Soak badge, and no Era reached: ' + ovStatsD);

      // Using a hint forfeits the Pure Soak badge
      await t.game('newGame', { mode: 'daily', date: '2026-11-14' });
      await t.game('setState', { board: full.slice(), tray: [{ id: 'o1' }, { id: 'o9' }, { id: 'o9' }], score: 2600, placed: 10, undosUsed: 0, hintsUsed: 0 });
      const hr = await t.game('act', 'hint');
      t.expect(hr.ok, 'Daily hint works');
      await t.game('act', 'place', 0, 0, 0);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
      const ovStatsD2 = await t.page.textContent('#ov-stats');
      t.expect(/Bronze \(2,500\+\)/.test(ovStatsD2) && !/Pure Soak/.test(ovStatsD2), 'Daily forfeits Pure Soak when a hint is used: ' + ovStatsD2);

      // 3. Spring Trail honest 12+12 copy & persistent Trail Master title on all 24 solves (no 4th album section)
      await t.game('scene', 'trail');
      const trailIntro = await t.page.textContent('#trail-intro');
      t.expect(/12 Bathhouse Row/.test(trailIntro) && /12 Spring Science/.test(trailIntro), 'Trail intro accurately describes 12 Bathhouse Row + 12 Spring Science: ' + trailIntro);
      const levels = await t.game('getLevels');
      const save = await t.game('act', 'save');
      save.trail.done = levels.map(l => l.id);
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), ['hs-thermal-blocks-v1', save]);
      await t.reload();
      await t.game('scene', 'title');
      t.expect((await t.page.textContent('#trail-sub')).startsWith('Trail Master · '), 'Title screen displays persistent Trail Master title');
      await t.game('scene', 'records');
      t.expect((await t.page.textContent('#rec-stats')).includes('Trail Master'), 'Records displays persistent Trail Master title');
      await t.game('scene', 'cards');
      const albumSections = await t.page.evaluate(() => document.querySelectorAll('#sc-cards .cards').length);
      t.equal(albumSections, 3, 'Fact cards retains strictly 3 album sections (no 4th section)');
    },
  },
  {
    name: 'W6-S3-02 Springs 47-vent economy: spawnVent before dealTray, shuffled retry, >=2 floor, Act III cap 7, 47 clamp',
    node: true,
    async run(t) {
      // 1. Multi-vent final clear clamps springs at 47 and performs zero phantom deal/spawn
      const gWin = R.freshGame('springs');
      gWin.springs = 45; gWin.round = 30;
      for (let c = 1; c < 9; c++) gWin.board[c] = 1;
      gWin.board[2] = 8; gWin.board[5] = 8; gWin.board[7] = 8;
      gWin.tray = [null, null, { id: 'o1' }];
      const rWin = R.applyMove(gWin, 2, 0, 0);
      t.expect(rWin.ok && gWin.won && gWin.over, 'wins at >=47');
      t.equal(gWin.springs, 47, 'clamped to 47');
      t.equal(rWin.newRound, false, 'no phantom tray deal');
      t.equal(rWin.ventsSpawned.length, 0, 'no phantom vent spawn');

      // 2. Round refill enforces >=2 active-vent floor and caps at min(cap, 47 - g.springs)
      const gFloor = R.freshGame('springs'); gFloor.rng = 42; gFloor.springs = 10; gFloor.tray = [null, null, { id: 'o1' }];
      const rFloor = R.applyMove(gFloor, 2, 4, 4);
      t.expect(rFloor.newRound && R.count(gFloor.board, 8) >= 2, '0 active vents refills to >=2 active vents');

      const gNear = R.freshGame('springs'); gNear.rng = 42; gNear.springs = 45; gNear.tray = [null, null, { id: 'o1' }];
      R.applyMove(gNear, 2, 4, 4);
      t.expect(R.count(gNear.board, 8) <= 2, 'near-win cap min(7, 47-45) = 2 prevents excess spawns (' + R.count(gNear.board, 8) + ')');

      // 3. Act III raises active vent cap to 7 and spawns up to 2 vents/round
      const gAct3 = R.freshGame('springs'); gAct3.rng = 77; gAct3.springs = 38;
      [0, 10, 20, 30, 40].forEach(i => { gAct3.board[i] = 8; });
      gAct3.tray = [null, null, { id: 'o1' }];
      const rAct3 = R.applyMove(gAct3, 2, 8, 8);
      t.equal(R.count(gAct3.board, 8), 7, 'Act III spawns 2 vents up to cap 7 (5 -> 7)');
      t.equal(rAct3.ventsSpawned.length, 2, 'reported both spawned vent indices');

      // 4. Shuffled-empty retry spawns without silent drop when 14 of 17 empty cells would accidentally complete a row/col
      const retryBoard = new Array(81).fill(1);
      for (let r = 0; r < 9; r++) retryBoard[r * 9 + 8] = 0; // col 8 empty; rows 0,1,3,4,6,7 each complete if filled at (r,8)
      for (const [r, c] of [[2, 0], [2, 3], [2, 6], [5, 1], [5, 4], [5, 7], [8, 2], [8, 5]]) retryBoard[r * 9 + c] = 0; // cols 0..7 each complete if filled
      t.equal(R.findClears(retryBoard).length, 0, 'retry fixture has zero pre-clears');
      let drops = 0;
      for (let seed = 1; seed <= 30; seed++) {
        const gRetry = R.freshGame('springs'); gRetry.rng = seed; gRetry.springs = 10; gRetry.board = retryBoard.slice();
        const vi = R.spawnVent(gRetry, 6);
        if (vi < 0 || ![2 * 9 + 8, 5 * 9 + 8, 8 * 9 + 8].includes(vi) || gRetry.board[vi] !== 8) drops++;
      }
      t.equal(drops, 0, 'shuffled-empty retry succeeds 30/30 across seeds on 82%-unsafe board (0 silent drops)');
    },
  },
  {
    name: 'W6-S3-03 & W6-S3-04 Daily 8-Tufa sweep, Tufa +20×mult, Clear Spring 300×mult banner, chain heat & Boil-Hold',
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      // 1. Daily 8-Tufa sweep bonus (+150, +1 heat) + Tufa +20×mult + popup
      await t.game('newGame', { mode: 'daily', date: '2026-11-15' });
      const b = EMPTY();
      for (let c = 1; c < 9; c++) b[c] = 1;
      b[4] = 7; // last remaining tufa stone on the board
      b[80] = 2; // stray tile so no Clear Spring bonus mixes in
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], heat: 0, score: 0, tufaSwept: false });
      const r = await t.game('act', 'place', 0, 0, 0);
      const s = await t.state();
      t.equal(s.heat, 2, '1 group clear + 1 sweep heat -> heat 2 (×1.5)');
      t.equal(s.tufaSwept, true, 'tufaSwept flag set once');
      t.equal(r.points, 1 + Math.round(18 * 1.5) + Math.round(20 * 1.5) + 150, 'Tufa +20×mult plus +150 8-Tufa sweep bonus');
      const fx = await t.game('act', 'fxList');
      t.expect(fx.some(f => /8-Tufa Cleared! \+150/.test(f.text)), '8-Tufa Cleared! popup displayed');

      // 2. Clear Spring bonus coupled to 300×mult with composed banner subtitle
      await t.game('newGame', { mode: 'classic' });
      const bCs = EMPTY(); for (let c = 1; c < 9; c++) bCs[c] = 1;
      await t.game('setState', { board: bCs, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], heat: 7, score: 0 }); // clear -> heat 8 (×3.0), bonus = 900
      const rCs = await t.game('act', 'place', 0, 0, 0);
      t.equal(rCs.points, 1 + Math.round(18 * 3) + Math.round(300 * 3), 'Clear Spring scales with heat multiplier (300 × 3 = 900)');
      const ban = (await t.game('act', 'fxList')).find(f => f.type === 'banner' && f.text === 'Clear Spring!');
      t.expect(ban && /\+900/.test(ban.sub) && /1 group/.test(ban.sub) && /×3/.test(ban.sub), 'Clear Spring banner shows composed bonus + groups + mult: ' + JSON.stringify(ban));

      // 3. Back-to-back cool clear warmth (< 6 only) + Boil-Hold canvas label
      await t.game('newGame', { mode: 'classic' });
      const b1 = EMPTY(); for (let c = 1; c < 9; c++) { b1[c] = 1; b1[9 + c] = 1; } b1[80] = 2;
      await t.game('setState', { board: b1, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], heat: 0, clearRun: 0 });
      await t.game('act', 'place', 0, 0, 0);
      let st = await t.state();
      t.equal([st.heat, st.clearRun], [1, 1], 'first clear heats 0 -> 1');
      await t.game('act', 'place', 1, 1, 0);
      st = await t.state();
      t.equal([st.heat, st.clearRun], [3, 2], 'back-to-back clear while cool (< 4) adds +1 chain warmth (1 -> 3)');
      await t.game('setState', { heat: 12, boilHold: 1 });
      const ct = await t.game('act', 'canvasText');
      t.expect(ct.texts.some(x => (ct.land ? x.text === 'Boil-Hold' : /Hold/.test(x.text))), 'Boil-Hold state surfaced on canvas readout');
    },
  },
];
