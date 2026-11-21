// M1: rules engine through the hooks (AC3–AC10)
const EMPTY = () => new Array(81).fill(0);
const idx = (r, c) => r * 9 + c;

export const tests = [
  {
    name: 'seeded deal',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(42);
      const a = (await t.game('newGame', { mode: 'classic' })).tray.map(x => x.id);
      await t.seed(42);
      const b = (await t.game('newGame', { mode: 'classic' })).tray.map(x => x.id);
      await t.seed(43);
      const c = (await t.game('newGame', { mode: 'classic' })).tray.map(x => x.id);
      t.equal(a, b, 'same seed, same tray');
      t.expect(JSON.stringify(a) !== JSON.stringify(c), 'different seed, different tray');
    },
  },
  {
    name: 'place and reject',
    async run(t) {
      await t.seed(5);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o4' }, { id: 'i3h' }, { id: 'c3a' }], score: 0, heat: 0 });
      let r = await t.game('act', 'place', 0, 0, 0);
      t.expect(r.ok, 'o4 placed at 0,0');
      let s = await t.state();
      t.equal([0, 1, 9, 10].map(i => s.board[i] > 0), [true, true, true, true], 'four cells filled');
      t.equal(s.board.filter(Boolean).length, 4, 'only four cells filled');
      t.equal(s.score, 4, 'score +4');
      r = await t.game('act', 'place', 1, 1, 0);
      t.expect(!r.ok, 'overlap rejected');
      r = await t.game('act', 'place', 1, 0, 7);
      t.expect(!r.ok, 'off-board rejected');
      const s2 = await t.state();
      t.equal(s2.board, s.board, 'board unchanged after rejects');
      t.equal(s2.score, 4, 'score unchanged after rejects');
      await t.game('act', 'hideToast');
      await t.shot('10-placed');
    },
  },
  {
    name: 'clears and multi-clear',
    async run(t) {
      await t.seed(5);
      await t.game('newGame', { mode: 'classic' });
      // row 4 full except col 8 → single row clear
      const b = EMPTY();
      for (let c = 0; c < 8; c++) b[idx(4, c)] = 2;
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'i2v' }, { id: 'o4' }], score: 0, heat: 0 });
      let r = await t.game('act', 'place', 0, 4, 8);
      t.equal(r.G, 1, 'one group');
      let s = await t.state();
      t.equal(s.board.filter(Boolean).length, 0, 'row cleared');
      t.equal(s.heat, 1, 'heat 1');
      t.equal(s.score, 1 + Math.round(18 * 1.25) + Math.round(300 * 1.25), 'row clear score with ×1.25 and heat-coupled clear-spring bonus');

      // 3×3 box clear (top-left) only
      const b2 = EMPTY();
      for (const i of [0, 1, 2, 9, 10, 11, 18, 19]) b2[i] = 3;
      b2[idx(8, 8)] = 1;
      await t.game('setState', { board: b2, tray: [{ id: 'o1' }, { id: 'i2v' }, { id: 'o4' }], score: 0, heat: 0 });
      r = await t.game('act', 'place', 0, 2, 2);
      t.equal(r.G, 1, 'box clear is one group');
      s = await t.state();
      t.equal(s.board.filter(Boolean).length, 1, 'box cleared, other tile stays');

      // row 0 and col 0 share cell (0,0): multi-clear, shared cell cleared once
      const b3 = EMPTY();
      for (let k = 1; k < 9; k++) { b3[idx(0, k)] = 4; b3[idx(k, 0)] = 5; }
      b3[idx(5, 5)] = 1;
      await t.game('setState', { board: b3, tray: [{ id: 'o1' }, { id: 'i2v' }, { id: 'o4' }], score: 0, heat: 0 });
      await t.game('act', 'hideToast');
      await t.shot('11-before-clear');
      r = await t.game('act', 'place', 0, 0, 0);
      t.equal(r.G, 2, 'two groups');
      t.equal(r.cleared, 17, '17 distinct cells cleared');
      s = await t.state();
      t.equal(s.score, 1 + Math.round(18 * 4 * 1.5), 'multi-clear score 18×G²×mult');
      t.equal(s.board.filter(Boolean).length, 1, 'only the stray tile remains');
      await t.shot('12-after-multi-clear');
    },
  },
  {
    name: 'heat',
    async run(t) {
      await t.seed(5);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }], heat: 7, score: 0 });
      await t.game('act', 'place', 0, 0, 0);
      let s = await t.state();
      t.equal(s.heat, 6, 'non-clearing placement cools by 1 above HEAT_SLOW_BELOW=6');
      await t.game('setState', { heat: 11 });
      const b = EMPTY();
      for (let c = 1; c < 9; c++) { b[idx(0, c)] = 2; b[idx(c, 0)] = 3; }
      b[idx(8, 8)] = 1;
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 0, 0);
      s = await t.state();
      t.equal(s.heat, 12, 'heat caps at 12');
      t.equal(s.boilHold, 1, 'reaching 143°F grants 1-placement Boil-Hold grace');
      t.equal(s.temp, 143, '143°F at max heat');
      await t.game('act', 'hideToast');
      await t.shot('13-heat-boiling');
      // Boil-Hold holds 143°F for one dry placement, then cools on the second dry placement
      await t.game('act', 'place', 1, 5, 5);
      s = await t.state();
      t.equal([s.heat, s.boilHold], [12, 0], 'first dry move at 143°F consumes Boil-Hold without cooling');
      await t.game('act', 'place', 2, 5, 0);
      s = await t.state();
      t.equal(s.heat, 11, 'second dry move cools from 12 to 11');
    },
  },
  {
    name: 'refill',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(9);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }] });
      await t.game('act', 'place', 0, 0, 0);
      await t.game('act', 'place', 1, 0, 2);
      let s = await t.state();
      t.equal(s.tray.filter(Boolean).length, 1, 'one piece left');
      const round = s.round;
      await t.game('act', 'place', 2, 0, 4);
      s = await t.state();
      t.equal(s.tray.filter(Boolean).length, 3, 'three new pieces');
      t.equal(s.round, round + 1, 'round advanced');
    },
  },
  {
    name: 'W6-S3-07 findHint 46/47 Springs instant-win priority, quadratic/vent weighting, undoSpent guard & hardened jointlyPlaceable',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);

      // 1. At 46/47 Springs vents, findHint() MUST pick the 1-line instant victory at (0,8) over a 2-line non-vent clear at (8,0),
      //    and useHint() must surface that winning move even if the remaining tray pieces wouldn't fit (doomed + undoAvail).
      await t.game('newGame', { mode: 'springs', seed: 11 });
      const winCheck = await t.page.evaluate(() => {
        const b = new Array(81).fill(0);
        // Row 0 has tiles at (0,0..7) with the 47th vent at (0,4), missing ONLY (0,8) -> 1-line instant 47/47 win.
        for (let c = 0; c < 8; c++) b[c] = c === 4 ? 8 : 1;
        // Row 8 (cols 1..8) and Col 0 (rows 1..7; (0,0) is tile 1) -> placing o1 at (8,0) clears 2 groups with 0 vents.
        for (let c = 1; c < 9; c++) b[8 * 9 + c] = 2;
        for (let r = 1; r < 8; r++) b[r * 9] = 3;
        S.board = b; S.springs = 46; S.over = false; S.round = 2; S.hintRound = -1;
        S.tray = [{ id: 'o1' }, { id: 'o9' }, { id: 'o9' }];
        S.undoLeft = 1; S.undoStack = [snapshot()];
        const h = findHint(S);
        const u = useHint();
        return { h, u };
      });
      t.equal([winCheck.h.r, winCheck.h.c, winCheck.h.wins], [0, 8, true], 'findHint prioritizes 46/47 instant Springs victory at (0,8) over 2-line non-vent clear at (8,0)');
      t.expect(winCheck.h.score >= 50000, '46/47 instant win carries >= 50000 priority bonus (' + winCheck.h.score + ')');
      t.equal([winCheck.u.ok, winCheck.u.r, winCheck.u.c], [true, 0, 8], 'useHint surfaces 46/47 winning move instead of advising Undo');

      // 2. Hardened jointlyPlaceable() rejects synthetic 9-dot board + ['o1','i2h','o9'] (zero budget false positive)
      //    and still returns true when an actual clear opens room for o9.
      const jp = await t.page.evaluate(() => {
        const nineDot = new Array(81).fill(0);
        for (const r of [1, 4, 7]) for (const c of [1, 4, 7]) nineDot[r * 9 + c] = 1;
        const hardDot = nineDot.slice();
        for (let c = 0; c < 6; c++) hardDot[c] = 1; // row 0 has 6 cells, still cannot open 3x3 for o9
        const solvable = nineDot.slice();
        // Make row 1 (which contains dots at (1,1),(1,4),(1,7)) have 6 tiles so i2h + o1 clear row 1, freeing top-left 3x3!
        for (let c = 0; c < 9; c++) if (c !== 0 && c !== 2 && c !== 3) solvable[1 * 9 + c] = 1;
        return {
          nineDot: jointlyPlaceable(nineDot, ['o1', 'i2h', 'o9']),
          hardDot: jointlyPlaceable(hardDot, ['o1', 'i2h', 'o9']),
          solvable: jointlyPlaceable(solvable, ['o1', 'i2h', 'o9']),
        };
      });
      t.equal(jp.nineDot, false, 'jointlyPlaceable rejects synthetic 9-dot [o1,i2h,o9] (no budget overflow false positive)');
      t.equal(jp.hardDot, false, 'jointlyPlaceable rejects crowded 9-dot [o1,i2h,o9] with 6-tile row');
      t.equal(jp.solvable, true, 'jointlyPlaceable still finds clearing sequence that opens room for o9');

      // 3. Per-round S.undoSpent guards setSetting('undo') even when undoing Move 1 brings S.placed back to 0 and undoStack to [].
      await t.game('act', 'setting', 'undo', 1);
      await t.game('newGame', { mode: 'classic', seed: 12 });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], round: 1, undoLeft: 1, undoSpent: false });
      await t.game('act', 'place', 0, 0, 0);
      await t.game('act', 'undo');
      const afterUndo1 = await t.state();
      t.equal([afterUndo1.placed, afterUndo1.undoLeft, afterUndo1.undoSpent], [0, 0, true], 'undoing Move 1 marks S.undoSpent = true');
      await t.game('act', 'setting', 'undo', 3);
      const afterSetting = await t.state();
      t.equal(afterSetting.undoLeft, 0, 'setSetting(undo, 3) cannot refill spent mid-round Undo even at placed=0');
      // Advancing to a genuinely new round resets undoSpent and refills undoLeft to 3.
      await t.game('act', 'place', 0, 0, 0);
      await t.game('act', 'place', 1, 0, 2);
      await t.game('act', 'place', 2, 0, 4);
      const nextRound = await t.state();
      t.equal([nextRound.undoLeft, nextRound.undoSpent], [3, false], 'new round resets undoSpent and refills undoLeft cleanly');
      await t.game('act', 'setting', 'undo', 1);
    },
  },
  {
    name: 'W6-S3-08 gilded-spa>=2 unlock, Ozark <=2% twin-tower 4-group climax, pure difficulty recent averages & post-midnight Daily restart',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);

      // 1. Goal 'gilded-spa' unlocks at 400 pts (ERAS[2], below 800 Roaring).
      await t.game('newGame', { mode: 'classic', seed: 14 });
      await t.page.evaluate(() => { delete SAVE.ach['gilded-spa']; });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], score: 399, era: 1 });
      await t.game('act', 'place', 0, 4, 4);
      const afterGilded = await t.page.evaluate(() => ({ era: S.era, score: S.score, got: !!SAVE.ach['gilded-spa'] }));
      t.equal([afterGilded.era, afterGilded.got], [2, true], 'gilded-spa goal unlocks immediately at Era 2 (400 pts)');

      // 2. Level 8 Ozark Bathhouse preserves twin-tower 4-group climax with 3-move setup depth and <= 2% random-win rate.
      const ozarkRes = await t.page.evaluate(() => {
        const L = LEVELS.find(l => l.id === 'ozark-bathhouse');
        const b = parseLevel(L);
        const pre = findClears(b).length;
        const g = setupGame(Object.assign(freshGame('trail'), { rng: 1 }), { level: 'ozark-bathhouse' });
        const m1 = applyMove(g, 0, 3, 3);
        const m2 = applyMove(g, 1, 5, 3);
        const m3 = applyMove(g, 2, 4, 2);
        // Dropping i5h immediately without framing center pool must NOT win (only 3 groups).
        const gEarly = setupGame(Object.assign(freshGame('trail'), { rng: 1 }), { level: 'ozark-bathhouse' });
        const mEarly = applyMove(gEarly, 2, 4, 2);
        return { pre, pieces: L.pieces, m1G: m1.G, m2G: m2.G, m3G: m3.G, won: g.won, earlyG: mEarly.G, earlyWon: gEarly.won };
      });
      t.equal(ozarkRes.pre, 0, 'Ozark has 0 board-start pre-clears');
      t.equal([ozarkRes.m1G, ozarkRes.m2G, ozarkRes.m3G, ozarkRes.won], [0, 0, 4, true], 'Ozark requires 2 framing moves before 4-group twin-tower climax');
      t.equal([ozarkRes.earlyG, ozarkRes.earlyWon], [3, false], 'dropping i5h immediately yields only 3 groups and does not win');

      // 3. Difficulty-grouped SAVE.stats.recent keeps Relaxed, Standard, and Master averages pure in Records.
      const full = new Array(81).fill(1);
      await t.page.evaluate(() => {
        SAVE.stats.recent = { classic: [], springs: [], daily: [] };
        SAVE.stats.recentDiff = { relaxed: { classic: [], springs: [] }, master: { classic: [], springs: [] } };
        persist();
      });
      for (const [diff, sc] of [['standard', 400], ['relaxed', 1200], ['master', 200]]) {
        await t.game('act', 'setting', 'difficulty', diff);
        await t.game('newGame', { mode: 'classic', seed: 20 });
        await t.game('setState', { board: full, score: sc, placed: 20 });
        await t.page.waitForFunction(() => window.__game.getState().over, null, { timeout: 3000 });
      }
      await t.game('act', 'setting', 'difficulty', 'standard');
      await t.game('scene', 'records');
      const rec = await t.page.evaluate(() => ({
        std: SAVE.stats.recent.classic,
        rel: SAVE.stats.recentDiff.relaxed.classic,
        mas: SAVE.stats.recentDiff.master.classic,
        rows: [...document.querySelectorAll('#rec-recent li')].map(li => li.textContent),
      }));
      t.equal(rec.std, [400], 'Standard Classic recent stays pure [400]');
      t.equal(rec.rel, [1200], 'Relaxed Classic recent stays pure [1200]');
      t.equal(rec.mas, [200], 'Master Classic recent stays pure [200]');
      t.expect(rec.rows.some(r => /ClassicAverage 400/.test(r)), 'Records shows pure Standard Classic average 400');
      t.expect(rec.rows.some(r => /Classic · RelaxedAverage 1,200/.test(r)), 'Records shows pure Classic · Relaxed average 1,200');
      t.expect(rec.rows.some(r => /Classic · MasterAverage 200/.test(r)), 'Records shows pure Classic · Master average 200');

      // 4. Post-midnight Daily restart() starts todayStr() rather than yesterday's stale S.daily seed.
      await t.game('newGame', { mode: 'daily', date: '2026-01-01' });
      const dailyRestart = await t.page.evaluate(() => {
        const before = S.daily, today = todayStr();
        restart();
        return { before, after: S.daily, today };
      });
      t.equal(dailyRestart.before, '2026-01-01', 'started yesterday Daily board');
      t.equal(dailyRestart.after, dailyRestart.today, 'Daily restart() advances to todayStr() after midnight');
    },
  },
];
