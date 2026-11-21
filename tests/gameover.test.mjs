// M2: no-moves cue, game over summary, undo budget, high scores and blocked storage (AC11–AC13, AC17)
const EMPTY = () => new Array(81).fill(0);
const checker = () => { const b = EMPTY(); for (let i = 0; i < 81; i++) if ((Math.floor(i / 9) + i % 9) % 2 === 0) b[i] = 1 + (i % 6); return b; };

export const tests = [
  {
    name: 'no fit ends game',
    async run(t) {
      await t.seed(8);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: checker(), tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score: 480, heat: 3, bestHeat: 7, groups: 12, placed: 40 });
      await t.game('act', 'hideToast');
      let s = await t.state();
      t.equal(s.fits, [true, false, false], 'only the single tile fits');
      t.equal(s.over, false, 'game continues while one piece fits');
      await t.shot('20-no-moves-dim');
      await t.game('act', 'place', 0, 0, 1);
      s = await t.state();
      t.equal(s.over, true, 'game over when nothing fits');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
      const txt = await t.page.textContent('#sc-over');
      t.expect(/No room left/.test(txt), 'summary title');
      t.expect(/481/.test(txt), 'summary shows score');
      t.expect(/Groups cleared/.test(txt) && /Hottest water/.test(txt), 'summary shows stats');
      t.expect(/New best/.test(txt), 'new best flagged');
      await t.checkLayout();
      await t.shot('21-game-over');
      const u = await t.game('act', 'undo');   // S1-02: a lost game keeps its last move to take back
      t.expect(u.ok, 'the move that ended the game can be undone');
      t.equal((await t.state()).over, false, 'and the game is on again');
    },
  },
  {
    name: 'undo budget',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'setting', 'undo', 1);
      await t.seed(4);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }], score: 0 });
      await t.game('act', 'place', 0, 0, 0);
      let s = await t.state();
      t.equal(s.score, 1, 'scored');
      let u = await t.game('act', 'undo');
      t.expect(u.ok, 'first undo works');
      s = await t.state();
      t.equal(s.score, 0, 'score restored');
      t.equal(s.board[0], 0, 'board restored');
      t.expect(s.tray[0] && s.tray[0].id === 'o1', 'tray restored');
      await t.game('act', 'place', 0, 0, 0);
      u = await t.game('act', 'undo');
      t.expect(!u.ok, 'second undo in the same round refused');
      await t.game('act', 'setting', 'undo', 0);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 4, 4);
      u = await t.game('act', 'undo');
      t.expect(!u.ok, 'undo disabled with setting 0');
      await t.game('act', 'setting', 'undo', 3);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 4, 4); t.expect((await t.game('act', 'undo')).ok, 'undo 1 of 3');
      await t.game('act', 'place', 0, 4, 4); t.expect((await t.game('act', 'undo')).ok, 'undo 2 of 3');
      await t.game('act', 'place', 0, 4, 4); t.expect((await t.game('act', 'undo')).ok, 'undo 3 of 3');
      await t.game('act', 'place', 0, 4, 4); t.expect(!(await t.game('act', 'undo')).ok, 'fourth refused');
      await t.game('act', 'setting', 'undo', 1);
    },
  },
  {
    name: 'best persists and storage can be blocked',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(8);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: checker(), tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score: 777 });
      await t.game('act', 'place', 0, 0, 1);
      await t.page.reload();
      await t.page.waitForFunction(() => !!window.__game);
      const save = await t.game('act', 'save');
      t.equal(save.best.classic, 778, 'best survives reload');
      await t.page.addInitScript(() => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('storage blocked'); } }); });
      await t.page.reload();
      await t.page.waitForFunction(() => !!window.__game);
      await t.game('newGame', { mode: 'classic' });
      const s = await t.state();
      t.equal(s.scene, 'game', 'game runs without storage');
      const L = await t.game('layout');
      t.expect(!!L.board, 'layout ok');
    },
  },
  {
    name: 'W6-P-N02 post-loss undo rolls back provisional SAVE.best and keeps New best! and deltas honest',
    viewports: ['desktop'],
    async run(t) {
      const KEY = 'hs-thermal-blocks-v1';
      // Board filled except a 3-cell horizontal gap at (0,0..2) plus 9 isolated 1-cell holes (1 per row, col, and 3x3 pool) preventing any clear.
      const twoLossBoard = () => {
        const b = new Array(81).fill(1);
        for (const [r, c] of [[0, 0], [0, 1], [0, 2], [0, 8], [1, 4], [2, 2], [3, 1], [4, 5], [5, 7], [6, 0], [7, 3], [8, 6]]) b[r * 9 + c] = 0;
        return b;
      };
      await t.page.evaluate(k => {
        const cur = JSON.parse(localStorage.getItem(k) || '{"v":1}');
        cur.v = 1;
        cur.settings = Object.assign(cur.settings || {}, { tipsSeen: true, undo: 3 });
        cur.best = Object.assign(cur.best || {}, { classic: 500, springs: 0, daily: {} });
        cur.resume = null;
        localStorage.setItem(k, JSON.stringify(cur));
      }, KEY);
      await t.reload();
      await t.seed(8);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: twoLossBoard(), tray: [{ id: 'i3h' }, { id: 'i2h' }, { id: 'o9' }], score: 618, heat: 0, bestHeat: 0, groups: 10, placed: 30, undoLeft: 3 });
      // First losing timeline: place i3h (+3 => 621), beating priorBest 500 by 121.
      const r1 = await t.game('act', 'place', 0, 0, 0);
      t.expect(r1.ok && r1.G === 0, 'i3h placed without clear');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 5000 });
      t.equal((await t.game('act', 'save')).best.classic, 621, 'provisional loss records 621');
      t.equal((await t.page.textContent('#ov-new')).trim(), 'New best!', 'first loss shows New best!');
      // Post-Loss Undo must immediately roll back SAVE.best in memory and localStorage to 500.
      await t.page.click('#b-ovundo');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 5000 });
      const storedAfterUndo = await t.page.evaluate(k => JSON.parse(localStorage.getItem(k)).best.classic, KEY);
      t.equal(storedAfterUndo, 500, 'localStorage best rolled back to priorBest 500 after Post-Loss Undo');
      t.equal((await t.game('act', 'save')).best.classic, 500, 'in-memory SAVE.best rolled back to 500');
      // Alternative losing timeline: place i2h (+2 => 620), still beating true priorBest 500 by 120.
      const r2 = await t.game('act', 'place', 1, 0, 0);
      t.expect(r2.ok && r2.G === 0, 'i2h placed without clear');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 5000 });
      t.equal((await t.page.textContent('#ov-new')).trim(), 'New best!', 'rescued 620 still celebrates New best!');
      t.expect((await t.page.getAttribute('#ov-new', 'class')).includes('hit'), '#ov-new carries .hit class');
      const statsText = await t.page.textContent('#ov-stats');
      t.expect(/Best beaten by\s*120 points/.test(statsText), 'delta compares against true priorBest 500 (+120): ' + statsText);
      t.equal((await t.page.evaluate(k => JSON.parse(localStorage.getItem(k)).best.classic, KEY)), 620, 'final stored best is 620');
      // Second undo + quit must not leave undone 620 poisoned in localStorage.
      await t.page.click('#b-ovundo');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 5000 });
      await t.game('scene', 'title');
      t.equal((await t.page.evaluate(k => JSON.parse(localStorage.getItem(k)).best.classic, KEY)), 500, 'quitting after Post-Loss Undo keeps career best at 500');
    },
  },
  {
    name: 'W6-P-N03 end-wait pause soft-lock guard, pagehide {over:true} guard, and cross-mode Continue hintRound',
    viewports: ['desktop'],
    async run(t) {
      const KEY = 'hs-thermal-blocks-v1';
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.seed(8);
      await t.game('newGame', { mode: 'classic' });
      // Save a live Classic run first, then trigger a losing move and fire pagehide + pause attempts during end-wait.
      await t.game('setState', { board: checker(), tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score: 200, placed: 12, undoLeft: 1 });
      await t.game('act', 'place', 0, 0, 1);
      const duringWait = await t.page.evaluate(k => {
        const pauseDis = document.getElementById('b-pause').disabled;
        const pScene = window.__game.act('pause');
        window.dispatchEvent(new Event('pagehide'));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
        const raw = JSON.parse(localStorage.getItem(k) || 'null');
        return { pauseDis, pScene, resume: raw && raw.resume, over: window.__game.getState().over };
      }, KEY);
      t.equal(duringWait.over, true, 'game is over during end-wait');
      t.equal(duringWait.pauseDis, true, '#b-pause is disabled during end-wait');
      t.equal(duringWait.pScene, 'game', 'pauseGame() is a no-op during end-wait');
      t.equal(duringWait.resume, null, 'pagehide/visibilitychange during end-wait never writes {over:true}');
      // Even if a non-game scene opens while UI.overAt is pending, returning to game still shows #sc-over (no soft-lock).
      await t.game('scene', 'settings');
      await t.page.waitForTimeout(700);
      await t.game('scene', 'game');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
      t.expect(await t.page.isVisible('#sc-over'), 'results modal still opens cleanly after returning from overlay');
      // Cross-mode Continue hintRound independence: Daily Round-1 Hint must not disable Classic Round-1 Hint.
      await t.seed(15);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }], round: 1 });
      await t.game('act', 'place', 0, 4, 4);
      await t.game('scene', 'title');
      await t.game('newGame', { mode: 'daily', date: '2026-11-20' });
      t.equal((await t.game('act', 'hint')).ok, true, 'Daily Round-1 hint succeeds');
      await t.game('scene', 'title');
      await t.page.click('#b-continue');
      t.equal((await t.state()).mode, 'classic', 'continued Classic run');
      t.expect(!(await t.page.isDisabled('#b-hint')), '#b-hint is enabled on resumed Classic run');
      t.equal((await t.game('act', 'hint')).ok, true, 'Classic Round-1 hint succeeds independently');
      // Now that Classic used its Round-1 hint, reloading and continuing keeps Round-1 hint spent.
      await t.reload();
      await t.page.click('#b-continue');
      t.expect(await t.page.isDisabled('#b-hint'), 'spent Classic Round-1 hint stays spent after reload');
      t.equal((await t.game('act', 'hint')).ok, false, 'cannot bypass per-tray hint via reload');
    },
  },
  {
    name: 'W6-S6-02 unified rv>1 write-lock, validResume hardening, 4-mode non-colliding resumes, and z-index:40 critical alerts',
    viewports: ['desktop'],
    async run(t) {
      const KEY = 'hs-thermal-blocks-v1', RUN = 'hs-thermal-blocks-v1-run';
      await t.game('act', 'setting', 'tipsSeen', true);
      // 1. Hardened validResume() rejects {over:true}, all-null trays, invalid diff, and invalid undosUsed with z-index:40 alert.
      await t.seed(10);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 0, 0);
      const validSave = await t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
      for (const [label, mut] of [
        ['over:true', r => { r.over = true; }],
        ['all-null tray', r => { r.tray = [null, null, null]; }],
        ['invalid diff', r => { r.diff = 'nightmare'; }],
        ['negative undosUsed', r => { r.undosUsed = -1; }],
      ]) {
        const bad = JSON.parse(JSON.stringify(validSave));
        mut(bad.resume);
        await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, bad]);
        await t.reload();
        t.expect(!(await t.page.isVisible('#b-continue')), label + ': rejected and Continue hidden');
        const toastInfo = await t.page.evaluate(() => {
          const el = document.getElementById('toast');
          return { on: el.classList.contains('on'), above: el.classList.contains('above'), z: getComputedStyle(el).zIndex, text: el.textContent };
        });
        t.expect(toastInfo.on && toastInfo.above && toastInfo.z === '40' && /Saved game discarded/.test(toastInfo.text), label + ': badResumeToast visible at z-index:40 (' + JSON.stringify(toastInfo) + ')');
      }
      // 2. 4-mode non-colliding resumes + Trail undoStack preserved + deferred clear before Move 1.
      await t.game('act', 'hideToast');
      await t.game('newGame', { mode: 'classic', seed: 11 });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 0, 0);
      await t.game('newGame', { mode: 'springs', seed: 12 });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 1, 1);
      await t.game('newGame', { mode: 'daily', date: '2026-11-20' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 2, 2);
      await t.game('newGame', { mode: 'trail', level: 'hale-bathhouse' });
      let ts = await t.state();
      const o1Idx = ts.tray.findIndex(x => x && x.id === 'o1');
      t.expect((await t.game('act', 'place', o1Idx, 0, 0)).ok, 'placed first Trail piece');
      // Opening another Trail level with resume:true without placing must NOT wipe saved hale-bathhouse.
      await t.game('newGame', { mode: 'trail', level: 'display-spring', resume: true });
      await t.game('scene', 'title');
      await t.reload();
      const slots = await t.page.evaluate(([k, rk]) => ({ save: JSON.parse(localStorage.getItem(k)), run: JSON.parse(localStorage.getItem(rk)) }), [KEY, RUN]);
      t.expect(slots.save.resume && slots.save.resume.mode === 'classic', 'Classic preserved in SAVE.resume');
      t.expect(slots.run && slots.run.springs && slots.run.springs.state.mode === 'springs', 'Springs preserved in RUN_KEY.springs');
      t.expect(slots.run && slots.run.daily && slots.run.daily.key === '2026-11-20', 'Daily preserved in RUN_KEY.daily');
      t.expect(slots.run && slots.run.trail && slots.run.trail.key === 'hale-bathhouse', 'Trail hale-bathhouse preserved across peek at display-spring');
      // Resuming Trail preserves its compact undoStack so pre-reload moves can still be undone.
      await t.game('newGame', { mode: 'trail', level: 'hale-bathhouse', resume: true });
      const undoRes = await t.game('act', 'undo');
      t.equal(undoRes.ok, true, 'Trail undoStack survived reload and undo succeeded');
      t.equal((await t.state()).undosUsed, 1, 'Trail undo increments undosUsed');
      // 3. Protected z-index:40 cross-tab conflict alert survives #b-quit -> showScene('title').
      await t.game('newGame', { mode: 'classic', seed: 20 });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 0, 0);
      await t.page.evaluate(k => {
        const s = JSON.parse(localStorage.getItem(k));
        s.resumeRevision = 'other-tab-rev';
        localStorage.setItem(k, JSON.stringify(s));
      }, KEY);
      await t.page.click('#b-pause');
      await t.page.click('#b-quit');
      const quitToast = await t.page.evaluate(() => {
        const el = document.getElementById('toast');
        return { scene: window.__game.getState().scene, on: el.classList.contains('on'), above: el.classList.contains('above'), z: getComputedStyle(el).zIndex, text: el.textContent };
      });
      t.expect(quitToast.scene === 'title' && quitToast.on && quitToast.above && quitToast.z === '40' && /another tab/.test(quitToast.text), 'cross-tab conflict alert survives #b-quit at z-index:40 (' + JSON.stringify(quitToast) + ')');
      // 4. Unified rv>1 write-lock: RUN_KEY at rv:2 locks BOTH RUN_KEY and STORE_KEY persist() and shows boot notice at z-index:40.
      const baseSave = JSON.stringify({ v: 1, settings: { sound: true, volume: 0.7, tipsSeen: true }, best: { classic: 123, springs: 0, daily: {} }, trail: { done: [], stars: {} }, stats: { games: 1, lines: 2, bestHeat: 1, springs: 0 }, resume: null });
      const futureRun = JSON.stringify({ rv: 2, springs: null, daily: { key: '2026-11-20', state: { future: true } }, trail: null });
      await t.page.evaluate(([k, rk, sv, rn]) => { localStorage.setItem(k, sv); localStorage.setItem(rk, rn); }, [KEY, RUN, baseSave, futureRun]);
      await t.reload();
      await t.page.waitForFunction(() => { const el = document.getElementById('toast'); return el.classList.contains('on') && /not being saved/i.test(el.textContent); }, null, { timeout: 6000 });
      const lockToast = await t.page.evaluate(() => { const el = document.getElementById('toast'); return { above: el.classList.contains('above'), z: getComputedStyle(el).zIndex }; });
      t.expect(lockToast.above && lockToast.z === '40', 'rv>1 boot notice renders at z-index:40');
      await t.game('act', 'setting', 'sound', false);
      await t.game('newGame', { mode: 'classic', seed: 5 });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 0, 0);
      const afterLock = await t.page.evaluate(([k, rk]) => ({ save: localStorage.getItem(k), run: localStorage.getItem(rk) }), [KEY, RUN]);
      t.equal(afterLock.save, baseSave, 'STORE_KEY stayed byte-for-byte untouched while RUN_KEY has rv>1');
      t.equal(afterLock.run, futureRun, 'RUN_KEY stayed byte-for-byte untouched while rv>1');
    },
  },
  {
    name: 'W6-S3-05 monotonic S.refilledRound blocks infinite Piece-3 Undo refills while keeping deterministic seed parity',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'setting', 'undo', 1);
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('newGame', { mode: 'classic', seed: 42 });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], round: 1, refilledRound: 1, undoLeft: 1, rng: 42 });
      // Spend Round 1's single undo.
      t.expect((await t.game('act', 'place', 0, 0, 0)).ok, 'place p1');
      t.expect((await t.game('act', 'undo')).ok, 'spend Round 1 undo');
      t.equal((await t.state()).undoLeft, 0, 'Round 1 undo spent');
      // Place all 3 pieces -> crosses into Round 2, refilling undoLeft once.
      t.expect((await t.game('act', 'place', 0, 0, 0)).ok, 'p1');
      t.expect((await t.game('act', 'place', 1, 0, 2)).ok, 'p2');
      t.expect((await t.game('act', 'place', 2, 0, 4)).ok, 'p3 -> deals Round 2');
      const r2First = await t.state();
      t.equal(r2First.round, 2, 'at Round 2');
      t.equal(r2First.refilledRound, 2, 'refilledRound advanced to 2');
      t.equal(r2First.undoLeft, 1, 'undoLeft refilled once for Round 2');
      const r2TrayFirst = r2First.tray.map(x => x.id);
      // Undo Piece 3 back into Round 1: consumes the Round 2 undo, keeping refilledRound = 2.
      t.expect((await t.game('act', 'undo')).ok, 'undo Piece 3 back into Round 1');
      const backR1 = await t.state();
      t.equal(backR1.round, 1, 'back in Round 1');
      t.equal(backR1.undoLeft, 0, 'undoLeft is 0');
      t.equal(backR1.refilledRound, 2, 'refilledRound stays 2 across Undo');
      // Re-place Piece 3: returns to Round 2 with the exact deterministic tray, and MUST NOT refill undoLeft again!
      t.expect((await t.game('act', 'place', 2, 0, 4)).ok, 're-place Piece 3');
      const r2Again = await t.state();
      t.equal(r2Again.round, 2, 'back at Round 2');
      t.equal(r2Again.tray.map(x => x.id), r2TrayFirst, 'deterministic seed parity preserved on re-deal');
      t.equal(r2Again.undoLeft, 0, 'Piece-3 repeat does NOT refill undoLeft');
      t.equal((await t.game('act', 'undo')).ok, false, 'cannot loop Piece-3 Undo infinitely');
      // Also verify setSetting('undo', 3) after reload with placed > 0 does not refill spent mid-round undo.
      await t.reload();
      await t.game('act', 'resumeSaved', 'classic');
      await t.game('act', 'setting', 'undo', 3);
      t.equal((await t.state()).undoLeft, 0, 'changing Undo setting mid-run after resume does not refill spent Undo');
      // Finishing all 3 pieces of Round 2 reaches Round 3 (> refilledRound 2) and refills cleanly.
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], round: 2, refilledRound: 2, undoLeft: 0 });
      t.expect((await t.game('act', 'place', 0, 0, 0)).ok, 'r2 p1');
      t.expect((await t.game('act', 'place', 1, 0, 2)).ok, 'r2 p2');
      t.expect((await t.game('act', 'place', 2, 0, 4)).ok, 'r2 p3 -> deals Round 3');
      const r3 = await t.state();
      t.equal(r3.round, 3, 'reached Round 3');
      t.equal(r3.refilledRound, 3, 'refilledRound advanced to 3');
      t.equal(r3.undoLeft, 3, 'undoLeft refilled legitimately on Round 3');
      await t.game('act', 'setting', 'undo', 1);
    },
  },
  {
    name: 'W6-S3-06 incremental Loss-Undo ledger credits post-rescue lines, Boiling, Water Cards & updates recent without double-counting',
    viewports: ['desktop'],
    async run(t) {
      const KEY = 'hs-thermal-blocks-v1';
      await t.game('act', 'setting', 'undo', 3);
      await t.game('act', 'setting', 'tipsSeen', true);
      // Seed lifetime stats at 23 groups (2 away from Water's age: 250 years at 25 groups) and 0 Boiling games.
      await t.page.evaluate(k => {
        const sv = JSON.parse(localStorage.getItem(k));
        sv.stats.games = 5;
        sv.stats.lines = 23;
        sv.stats.bestHeat = 6;
        sv.stats.recent.classic = [300];
        sv.goals = { boiled: 0 };
        localStorage.setItem(k, JSON.stringify(sv));
      }, KEY);
      await t.reload();
      await t.game('newGame', { mode: 'classic', seed: 19 });
      // Provisional loss #1: checkerboard where placing o1 at (0,1) leaves i2h and o9 unplaceable, groups=1, score=620, bestHeat=6.
      await t.game('setState', { board: checker(), tray: [{ id: 'o1' }, { id: 'i2h' }, { id: 'o9' }], score: 620, heat: 6, bestHeat: 6, groups: 1, placed: 30, undoLeft: 3 });
      t.expect((await t.game('act', 'place', 0, 0, 1)).ok, 'provisional loss move');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
      const mid = await t.game('act', 'save');
      t.equal(mid.stats.games, 6, 'provisional loss counted 1 game');
      t.equal(mid.stats.lines, 24, 'provisional loss credited initial 1 group (23 -> 24)');
      t.equal(mid.stats.recent.classic, [300, 621], 'provisional loss appended 621 to recent');
      t.equal(mid.goals.boiled, 0, 'not Boiling yet');
      // Click Post-Loss Undo -> rescue the run, clear 2 rows hitting heat=12 (Boiling), then lose at a higher score.
      await t.page.click('#b-ovundo');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 4000 });
      const b2 = checker();
      for (let c = 0; c < 8; c++) { b2[c] = 1; b2[9 + c] = 2; }
      b2[8] = 0; b2[17] = 0;
      await t.game('setState', { board: b2, tray: [{ id: 'i2v' }, { id: 'o9' }, { id: 'o9' }], score: 620, heat: 10, bestHeat: 10, groups: 1, placed: 30, undoLeft: 2 });
      const clr = await t.game('act', 'place', 0, 0, 8);
      t.expect(clr.ok && clr.G >= 2, 'rescued run clears 2+ groups and reaches Boiling');
      const afterClear = await t.state();
      t.equal(afterClear.heat, 12, 'reached 143F Boiling post-undo');
      t.equal(afterClear.over, true, 'o9 pieces cannot fit on remaining checkerboard -> final loss');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
      const fin = await t.game('act', 'save');
      t.equal(fin.stats.games, 6, 'rescued run still counts as ONE game total (zero double-counting)');
      t.equal(fin.stats.lines, 23 + afterClear.groups, 'ALL post-undo groups credited to lifetime lines (' + fin.stats.lines + ')');
      t.equal(fin.stats.bestHeat, 12, 'post-undo Boiling bestHeat recorded');
      t.equal(fin.goals.boiled, 1, 'post-undo Boiling game credited to SAVE.goals.boiled');
      t.equal(fin.stats.recent.classic, [300, afterClear.score], 'recent.classic updated in-place to final rescued score (no duplicate entry)');
      const ovTxt = await t.page.textContent('#ov-stats');
      t.expect(/Water’s age: 250 years/.test(ovTxt), 'Water Card earned post-undo announced on Game Over: ' + ovTxt);
      await t.game('act', 'setting', 'undo', 1);
    },
  },
  {
    name: 'W6-S5-01 interrupt state machine: pause clock offsets & sub-menu audio hold, immediate end-wait skip & no steam stall, single cancellable countUp(), end-cue cancel on undo',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'setting', 'undo', 2);
      await t.game('act', 'audio', 'click');
      await t.page.waitForTimeout(150);

      // 1. Mid-clear Pause records UI.pausedAt, clears UI.sel, freezes & offsets FX/WATER clocks on resume, and keeps AU.kit held across Pause -> Help/Cards/Records.
      await t.game('newGame', { mode: 'classic', seed: 14 });
      const b1 = EMPTY(); for (let c = 0; c < 8; c++) b1[c] = 1; b1[80] = 1;
      await t.game('setState', { board: b1, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], score: 200, heat: 4 });
      await t.game('act', 'select', 1);
      await t.game('act', 'place', 0, 0, 8);
      await t.game('act', 'select', 1);
      const beforePause = await t.page.evaluate(() => ({
        sel: UI.sel,
        fxCount: FX.length,
        t0: FX[0] ? FX[0].t0 : 0,
      }));
      t.equal(beforePause.sel, 1, 'slot selected before pause');
      t.expect(beforePause.fxCount > 0, 'clear FX active before pause');
      await t.game('act', 'pause');
      const whilePaused = await t.page.evaluate(() => ({
        sel: UI.sel,
        pausedAt: UI.pausedAt,
        held: AU.kit ? AU.kit.held : null,
      }));
      t.equal(whilePaused.sel, -1, 'pauseGame() clears UI.sel');
      t.expect(typeof whilePaused.pausedAt === 'number' && whilePaused.pausedAt > 0, 'pauseGame() records UI.pausedAt');
      if (whilePaused.held !== null) t.equal(whilePaused.held, true, 'AU.kit held on Pause');

      // Pause -> Help -> Cards -> Records must keep AU.kit held and UI.pausedAt frozen.
      for (const sub of ['help', 'cards', 'records']) {
        await t.game('scene', sub);
        const subSt = await t.page.evaluate(() => ({ held: AU.kit ? AU.kit.held : null, pausedAt: UI.pausedAt, returnTo: UI.returnTo }));
        t.equal(subSt.returnTo, 'pause', `${sub} preserves returnTo='pause'`);
        t.equal(subSt.pausedAt, whilePaused.pausedAt, `${sub} keeps UI.pausedAt frozen`);
        if (subSt.held !== null) t.equal(subSt.held, true, `AU.kit stays held on Pause -> ${sub}`);
      }
      await t.page.waitForTimeout(260);
      await t.game('scene', 'game');
      const afterResume = await t.page.evaluate(() => ({
        pausedAt: UI.pausedAt,
        fxCount: FX.length,
        t0: FX[0] ? FX[0].t0 : 0,
        held: AU.kit ? AU.kit.held : null,
      }));
      t.equal(afterResume.pausedAt, null, 'resume clears UI.pausedAt');
      t.expect(afterResume.fxCount > 0 && afterResume.t0 >= beforePause.t0 + 200, 'resume offsets FX[].t0 by paused duration');
      if (afterResume.held !== null) t.equal(afterResume.held, false, 'AU.kit releases cleanly on resume');

      // 2. blur & visibilitychange(hidden) clear UI.sel and UI.ghost cleanly.
      await t.game('act', 'select', 1);
      const afterBlur = await t.page.evaluate(() => {
        window.dispatchEvent(new Event('blur'));
        return { sel: UI.sel, ghost: UI.ghost };
      });
      t.equal(afterBlur, { sel: -1, ghost: null }, 'window blur clears UI.sel and UI.ghost');

      // 3. Immediate tap/Enter skip during long Springs win end-wait (2400 ms) opens #sc-over in < 300 ms,
      //    and Escape during end-wait does NOT open #sc-pause.
      await t.game('newGame', { mode: 'springs', seed: 18 });
      const bWin = EMPTY(); for (let c = 0; c < 8; c++) bWin[c] = 1; bWin[4] = 8;
      await t.game('setState', { board: bWin, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], springs: 46, score: 500 });
      const tStart = await t.page.evaluate(() => {
        window.__game.act('place', 0, 0, 8);
        return { over: S.over, overIn: window.__game.getState().overIn, scene: S.scene };
      });
      t.expect(tStart.over && tStart.scene === 'game' && tStart.overIn > 1500, 'Springs win sets ~2400ms ceremony wait (' + tStart.overIn + 'ms)');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).scene, 'game', 'Escape during end-wait does not open Pause');
      const skipMs = await t.page.evaluate(() => new Promise(res => {
        const t0 = performance.now();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        const poll = () => {
          if (S.scene === 'over') res(performance.now() - t0);
          else if (performance.now() - t0 > 1200) res(9999);
          else requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      }));
      t.expect(skipMs < 300, 'Enter immediately skips 2400ms end-wait without waiting for UI.overAt (' + Math.round(skipMs) + 'ms)');

      // 4. Non-skipping clear-loss transitions on UI.overAt (~1050ms) without stalling on 1600ms+ steam FX,
      //    and calls fillOver()/countUp() strictly ONCE with a single cancellable UI.countRaf.
      await t.game('newGame', { mode: 'classic', seed: 22 });
      const bClrLoss = checker();
      for (let c = 0; c < 8; c++) bClrLoss[c] = 1;
      bClrLoss[8] = 0;
      await t.game('setState', { board: bClrLoss, tray: [{ id: 'o1' }, { id: 'o9' }, { id: 'o9' }], score: 900, heat: 6, undoLeft: 2 });
      const overFlow = await t.page.evaluate(() => new Promise(res => {
        let countCalls = 0;
        const origCountUp = countUp;
        countUp = (el, to) => { countCalls++; return origCountUp(el, to); };
        const t0 = performance.now();
        window.__game.act('place', 0, 0, 8);
        // Inject a long-lived 4000ms steam puff to prove showEnd() never stalls on trailing steam FX
        addFx({ type: 'steam', x: 200, y: 200, dur: 4000, h: 80, ph: 0, w: 40 });
        const endCuesBefore = AU.endCues.length, endTimersBefore = UI.endTimers.length;
        const poll = () => {
          if (S.scene === 'over') {
            const elapsed = performance.now() - t0;
            const rafActive = UI.countRaf;
            countUp = origCountUp;
            res({ elapsed, countCalls, rafActive, endCuesBefore, endTimersBefore });
          } else if (performance.now() - t0 > 2600) {
            countUp = origCountUp;
            res({ elapsed: 9999, countCalls, rafActive: UI.countRaf, endCuesBefore, endTimersBefore });
          } else requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      }));
      t.expect(overFlow.elapsed >= 950 && overFlow.elapsed < 1800, 'clear-loss opens at ~1050ms without stalling on 4000ms trailing steam (' + Math.round(overFlow.elapsed) + 'ms)');
      t.equal(overFlow.countCalls, 1, 'showEnd() -> showScene("over") invokes fillOver()/countUp() strictly once (no dual rAF race)');
      t.expect(overFlow.rafActive > 0, 'countUp() stores active cancellable UI.countRaf handle');

      // 5. Post-Loss Undo cancels UI.countRaf, clears UI.endTimers & AU.endCues, and spawns 160ms non-blocking undo-lift FX.
      const undoInfo = await t.page.evaluate(() => {
        const res = doUndo();
        const lift = FX.find(f => f.type === 'undo-lift');
        return { ok: res.ok, countRaf: UI.countRaf, endTimers: UI.endTimers.length, endCues: AU.endCues.length, liftDur: lift ? lift.dur : 0 };
      });
      t.equal(undoInfo.ok, true, 'Post-Loss Undo succeeds');
      t.equal(undoInfo.countRaf, 0, 'doUndo() cancels active UI.countRaf');
      t.equal(undoInfo.endTimers, 0, 'doUndo() cancels pending best/card endTimers');
      t.equal(undoInfo.endCues, 0, 'doUndo() cancels active end-cue GainNodes');
      t.equal(undoInfo.liftDur, 160, 'doUndo() spawns non-blocking 160ms undo-lift reverse flight');
      await t.game('act', 'setting', 'undo', 1);
    },
  },
];
