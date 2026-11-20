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
];
