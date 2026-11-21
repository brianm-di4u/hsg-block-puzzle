// Council wave 1, batch A: stability, saves and lifecycle, screens and layout.
const KEY = 'hs-thermal-blocks-v1';

// Play one placement so the game writes a real resume slot, then return the stored save object.
async function realSave(t) {
  await t.seed(30);
  await t.game('newGame', { mode: 'classic' });
  let ok = false;
  for (let r = 0; r < 9 && !ok; r++) ok = (await t.game('act', 'place', 0, r, 0)).ok;
  t.expect(ok, 'placed a piece');
  return t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
}
async function storeAndReload(t, save) {
  await t.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(save)]);
  await t.reload();
  await t.waitFrames(3);
}
async function rafCount(t, ms = 300) {
  return t.page.evaluate(ms => new Promise(res => { let n = 0; const end = performance.now() + ms; const f = () => { n++; if (performance.now() < end) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); }), ms);
}
async function titleAlive(t, label) {
  const s = await t.state();
  t.equal(s.scene, 'title', label + ': on the title');
  t.expect((await rafCount(t)) > 5, label + ': frames keep running');
  t.expect(!(await t.page.isVisible('#b-continue')), label + ': no Continue for a bad slot');
  t.equal((await t.game('act', 'save')).resume, null, label + ': slot cleared');
  t.expect(/Saved game discarded/.test(await t.page.textContent('#toast')), label + ': player is told');
  await t.game('newGame', { mode: 'classic' });
  t.equal((await t.state()).scene, 'game', label + ': a new game starts');
}

export const tests = [
  {
    name: 'S6-01 resume slot with a missing field does not brick boot',
    async run(t) {
      const save = await realSave(t);
      for (const field of ['score', 'mode', 'board', 'tray']) {
        const bad = JSON.parse(JSON.stringify(save));
        delete bad.resume[field];
        await storeAndReload(t, bad);
        await titleAlive(t, 'missing ' + field);
      }
      const unknownPiece = JSON.parse(JSON.stringify(save));
      unknownPiece.resume.tray[0] = { id: 'zzz' };
      await storeAndReload(t, unknownPiece);
      await titleAlive(t, 'unknown piece id');
    },
  },
  {
    name: 'S6-01 a real resume slot still loads',
    async run(t) {
      const save = await realSave(t);
      await storeAndReload(t, save);
      t.expect(await t.page.isVisible('#b-continue'), 'Continue offered');
      await t.page.click('#b-continue');
      const s = await t.state();
      t.equal(s.scene, 'game', 'resumed');
      t.equal(s.score, save.resume.score, 'score kept');
    },
  },
  {
    name: 'S6-02 a throwing draw does not freeze the canvas',
    async run(t) {
      await t.seed(5);
      await t.game('newGame', { mode: 'classic' });
      await t.page.evaluate(() => { S.tray = [{ id: 'zzz' }, { id: 'zzz' }, null]; dirty = true; });
      await t.waitFrames(10);
      t.expect((await rafCount(t)) > 5, 'frames keep running after the draw threw');
      t.equal((await t.state()).scene, 'title', 'back on the title after repeated failures');
      t.expect(/Something went wrong/.test(await t.page.textContent('#toast')), 'player is told');
      await t.game('newGame', { mode: 'classic' });
      t.equal((await t.state()).scene, 'game', 'a new game starts and draws');
    },
  },
  {
    name: 'S6-02 uncaught errors and rejected promises show a message',
    allowConsoleErrors: true,
    async run(t) {
      await t.page.evaluate(() => { setTimeout(() => { throw new Error('probe'); }, 0); });
      await t.page.waitForTimeout(200);
      t.expect(/Something went wrong/.test(await t.page.textContent('#toast')), 'error toast shown');
      await t.reload();
      await t.page.evaluate(() => { Promise.reject(new Error('probe')); });
      await t.page.waitForTimeout(200);
      t.expect(/Something went wrong/.test(await t.page.textContent('#toast')), 'rejection toast shown');
    },
  },
  {
    name: 'S6-06 undo budget of 1 allows one undo per round',
    viewports: ['desktop'],
    async run(t) {
      const EMPTY = () => new Array(81).fill(0);
      await t.game('act', 'setting', 'undo', 1);
      await t.seed(4);
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], score: 0 });
      await t.game('act', 'place', 0, 0, 0);
      await t.game('act', 'place', 1, 0, 1);
      await t.game('act', 'place', 2, 0, 2);
      t.equal((await t.state()).undoCount, 1, 'badge shows one');
      t.expect((await t.game('act', 'undo')).ok, 'first undo works');
      t.equal((await t.state()).undoCount, 0, 'badge shows none');
      t.expect(!(await t.game('act', 'undo')).ok, 'second undo refused');
      t.expect(!(await t.game('act', 'undo')).ok, 'third undo refused');
      await t.game('act', 'setting', 'undo', 1);
    },
  },
  {
    name: 'S6-08 pagehide saves the run and a restored WebGL context brings the water back',
    async run(t) {
      await t.seed(30);
      await t.game('newGame', { mode: 'classic' });
      await t.waitFrames(3);
      let ok = false;
      for (let r = 0; r < 9 && !ok; r++) ok = (await t.game('act', 'place', 0, r, 0)).ok;
      // a change that only a hide-time save would store
      await t.page.evaluate(() => { S.score = 4321; window.dispatchEvent(new Event('pagehide')); });
      const stored = await t.page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
      t.equal(stored && stored.resume && stored.resume.score, 4321, 'pagehide wrote the run');
      const art = await t.game('act', 'art');
      if (!art.gl) { t.log('no WebGL in this browser; restore check skipped'); return; }
      const lost = await t.page.evaluate(() => { const x = document.getElementById('water').getContext('webgl').getExtension('WEBGL_lose_context'); if (!x) return false; window.__lose = x; x.loseContext(); return true; });
      if (!lost) { t.log('WEBGL_lose_context unavailable; restore check skipped'); return; }
      await t.page.waitForFunction(() => !window.__game.act('art').gl);
      await t.page.evaluate(() => window.__lose.restoreContext());
      await t.page.waitForFunction(() => window.__game.act('art').gl, null, { timeout: 5000 }).catch(() => {});
      t.expect((await t.game('act', 'art')).gl, 'WebGL water is set up again after the context is restored');
    },
  },
  {
    name: 'S6-11 corrupt resume content that does not throw is rejected',
    async run(t) {
      const save = await realSave(t);
      const cases = {
        'ten-cell board': r => { r.board = r.board.slice(0, 10); },
        'string cells': r => { r.board = r.board.map(String); },
        'cell out of range': r => { r.board[3] = 9; },
        'fractional cell': r => { r.board[3] = 1.5; },
        'string score': r => { r.score = 'lots'; },
        'negative score': r => { r.score = -5; },
        'unknown mode': r => { r.mode = ''; },
        'trail mode': r => { r.mode = 'trail'; },
        'heat out of range': r => { r.heat = 99; },
        'era out of range': r => { r.era = 99; },
        'bad queue id': r => { r.queue = ['nope']; },
        'string undoLeft': r => { r.undoLeft = 'x'; },
      };
      for (const [name, mutate] of Object.entries(cases)) {
        const bad = JSON.parse(JSON.stringify(save));
        mutate(bad.resume);
        await storeAndReload(t, bad);
        await titleAlive(t, name);
      }
    },
  },
  {
    name: 'S6-11 a real Springs resume slot still loads',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(12);
      await t.game('newGame', { mode: 'springs' });
      let ok = false;
      for (let r = 0; r < 9 && !ok; r++) for (let c = 0; c < 9 && !ok; c++) ok = (await t.game('act', 'place', 0, r, c)).ok;
      t.expect(ok, 'placed a piece');
      await t.reload();
      t.expect(await t.page.isVisible('#b-continue'), 'Continue offered for Springs');
      t.expect(/Springs/.test(await t.page.textContent('#b-continue')), 'names Springs');
    },
  },
  {
    name: 'P-N04 a resume slot from another schema version is discarded',
    async run(t) {
      const save = await realSave(t);
      t.equal(save.resume.v, 1, 'real slots carry schema version 1');
      for (const [name, v] of [['newer version', 2], ['no version', undefined]]) {
        const bad = JSON.parse(JSON.stringify(save));
        if (v === undefined) delete bad.resume.v; else bad.resume.v = v;
        await storeAndReload(t, bad);
        await titleAlive(t, name);
      }
    },
  },
  {
    name: 'S6-09 Trail puzzle and Daily run survive a reload',
    async run(t) {
      const placeAny = async () => {
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) if ((await t.game('act', 'place', 0, r, c)).ok) return true;
        return false;
      };
      // Trail
      await t.game('newGame', { mode: 'trail', level: 'display-spring' });
      const fresh = await t.state();
      t.expect(await placeAny(), 'placed a trail piece');
      const before = await t.state();
      await t.reload();
      await t.page.click('#sc-title [data-go="trail"]');
      t.expect(/In progress/.test(await t.page.textContent('#levels')), 'Trail list offers the run');
      await t.page.click('#levels button:nth-child(1)');
      let after = await t.state();
      t.equal(after.scene, 'game', 'trail run opened');
      t.equal(after.level, 'display-spring', 'same puzzle');
      t.equal(after.board, before.board, 'trail board restored');
      t.equal(after.tray, before.tray, 'trail tray restored');
      t.expect(JSON.stringify(after.board) !== JSON.stringify(fresh.board), 'differs from a fresh start');
      // an explicit restart starts over
      await t.game('newGame', { mode: 'trail', level: 'display-spring' });
      t.equal((await t.state()).board, fresh.board, 'newGame without resume starts fresh');
      await t.reload();
      await t.page.click('#sc-title [data-go="trail"]');
      t.expect(!/In progress/.test(await t.page.textContent('#levels')), 'restart cleared the saved run');
      // Daily
      await t.page.click('#sc-title [data-back], #sc-trail [data-back]').catch(() => {});
      await t.game('newGame', { mode: 'daily' });
      t.expect(await placeAny(), 'placed a daily piece');
      const daily = await t.state();
      await t.reload();
      t.expect(/Run in progress/.test(await t.page.textContent('#daily-sub')), 'Daily offers the run');
      await t.page.click('#sc-title [data-mode="daily"]');
      after = await t.state();
      t.equal(after.mode, 'daily', 'daily opened');
      t.equal(after.board, daily.board, 'daily board restored');
      t.equal(after.score, daily.score, 'daily score restored');
      const classic = await t.game('act', 'save');
      t.equal(classic.resume, null, 'Classic slot untouched');
    },
  },
  {
    name: 'S4-23 W6-S6-03 audio suspends cleanly on hidden/pagehide, resumes on visible non-pause scenes, and stays suspended on Pause return',
    viewports: ['desktop'],
    async run(t) {
      // Real user gesture unlocks WebAudio cleanly — never silently skip when suspended (W6-S6-03 / wf-6 §6 #7).
      await t.page.mouse.click(4, 4);
      await t.page.waitForFunction(() => AU.ctx && AU.ctx.state === 'running', null, { timeout: 5000 });
      const state = () => t.page.evaluate(() => AU.ctx && AU.ctx.state);
      t.equal(await state(), 'running', 'AudioContext running on Title after gesture');
      const setHidden = h => t.page.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);
      // 1. Hide on Title -> stops 40 Hz scheduler & suspends after ramp; visible on Title -> resumes cleanly (CD-WF6-04).
      await setHidden(true);
      await t.page.waitForFunction(() => AU.ctx.state === 'suspended', null, { timeout: 3000 });
      const hiddenSt = await t.game('act', 'audioState');
      t.equal(hiddenSt.state, 'suspended', 'suspended while hidden');
      t.equal(hiddenSt.timerOn, false, '40 Hz scheduler stopped while hidden');
      await setHidden(false);
      await t.page.waitForFunction(() => AU.ctx.state === 'running', null, { timeout: 3000 });
      const titleBack = await t.game('act', 'audioState');
      t.equal(titleBack.state, 'running', 'Title audio resumes cleanly when tab returns');
      t.equal(titleBack.held, false, 'Title kit released on return');
      // 2. Pause-only tab-return hold: returning to tab while S.scene === "pause" MUST NOT spuriously resume AU.ctx (CD-WF6-04).
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'pause');
      t.equal((await t.game('act', 'audioState')).timerOn, false, '40 Hz scheduler stopped while paused');
      await setHidden(true);
      await t.page.waitForFunction(() => AU.ctx.state === 'suspended', null, { timeout: 3000 });
      await setHidden(false);
      await t.page.waitForTimeout(250);
      t.equal(await state(), 'suspended', 'stays suspended when returning to tab while paused');
      t.equal((await t.game('act', 'audioState')).held, true, 'kit stays held on pause return');
      // 3. Repro 4 (W6-S5-02): Resuming from suspended Pause wakes AudioContext, restores AU.smooth >= 0.85, and plays heard 'resume' SFX.
      await t.game('act', 'clearCues');
      await t.page.click('#b-resume');
      await t.page.waitForFunction(() => AU.ctx.state === 'running' && AU.smooth && AU.smooth.gain.value >= 0.85, null, { timeout: 3000 });
      const resumedSt = await t.game('act', 'audioState');
      const resumeCues = await t.game('act', 'cues');
      const resumeHeard = await t.game('act', 'heardCues');
      t.equal(resumedSt.state, 'running', 'resuming from Pause wakes AudioContext');
      t.equal(resumedSt.held, false, 'kit released after resume');
      t.equal(resumedSt.timerOn, true, 'scheduler restarted after resume');
      t.expect(resumedSt.smooth >= 0.85, 'AU.smooth restored after Pause resume (' + resumedSt.smooth.toFixed(4) + ')');
      t.expect(resumeCues.includes('resume') && resumeHeard.includes('resume'), 'Repro 4: resume SFX actually heard after suspended Pause return (' + JSON.stringify({ cues: resumeCues, heard: resumeHeard }) + ')');
      // 4. Repro 1 (W6-S6-03): Quick <45ms Pause hide/return (cancelling suspendTimer before suspend()) -> Resume restores AU.smooth >= 0.85.
      await t.game('act', 'pause');
      await setHidden(true);
      await t.page.waitForTimeout(15);
      await setHidden(false);
      await t.page.click('#b-resume');
      await t.page.waitForFunction(() => AU.ctx.state === 'running' && AU.smooth && AU.smooth.gain.value >= 0.85, null, { timeout: 3000 });
      const quickSt = await t.game('act', 'audioState');
      t.expect(quickSt.state === 'running' && !quickSt.held && quickSt.timerOn && quickSt.smooth >= 0.85, 'Repro 1: quick <45ms Pause hide/return -> Resume restores AU.smooth >= 0.85 (' + JSON.stringify({ state: quickSt.state, held: quickSt.held, timerOn: quickSt.timerOn, smooth: +quickSt.smooth.toFixed(4) }) + ')');
      // 5. Repro 2 (W6-S6-03): >100ms Pause hide/return -> Help -> Close -> Resume restores AU.smooth >= 0.85.
      await t.game('act', 'pause');
      await setHidden(true);
      await t.page.waitForFunction(() => AU.ctx.state === 'suspended', null, { timeout: 3000 });
      await setHidden(false);
      await t.page.waitForTimeout(120);
      await t.page.click('#sc-pause [data-go="help"]');
      await t.page.click('#sc-help [data-close]');
      await t.page.click('#b-resume');
      await t.page.waitForFunction(() => AU.ctx.state === 'running' && AU.smooth && AU.smooth.gain.value >= 0.85, null, { timeout: 3000 });
      const subSt = await t.game('act', 'audioState');
      t.expect(subSt.state === 'running' && !subSt.held && subSt.timerOn && subSt.smooth >= 0.85, 'Repro 2: Pause hide/return -> Help -> Close -> Resume restores AU.smooth >= 0.85 (' + JSON.stringify({ state: subSt.state, held: subSt.held, timerOn: subSt.timerOn, smooth: +subSt.smooth.toFixed(4) }) + ')');
      // 6. Repro 3 (W6-S6-03): pagehide cleanly suspends; both pageshow bfcache return and gesture click return restore AU.smooth >= 0.85, held=false, timerOn=true.
      await t.page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await t.page.waitForFunction(() => AU.ctx.state === 'suspended', null, { timeout: 3000 });
      t.equal((await t.game('act', 'audioState')).timerOn, false, 'pagehide stops scheduler and suspends audio');
      await t.page.evaluate(() => window.dispatchEvent(new Event('pageshow')));
      await t.page.waitForFunction(() => AU.ctx.state === 'running' && AU.smooth && AU.smooth.gain.value >= 0.85, null, { timeout: 3000 });
      const bfSt = await t.game('act', 'audioState');
      t.expect(bfSt.state === 'running' && !bfSt.held && bfSt.timerOn && bfSt.smooth >= 0.85, 'Repro 3A: pageshow bfcache return restores AU.smooth >= 0.85 & scheduler (' + JSON.stringify({ state: bfSt.state, held: bfSt.held, timerOn: bfSt.timerOn, smooth: +bfSt.smooth.toFixed(4) }) + ')');
      await t.page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
      await t.page.waitForFunction(() => AU.ctx.state === 'suspended', null, { timeout: 3000 });
      await t.page.mouse.click(4, 4);
      await t.page.waitForFunction(() => AU.ctx.state === 'running' && AU.smooth && AU.smooth.gain.value >= 0.85, null, { timeout: 3000 });
      const gestSt = await t.game('act', 'audioState');
      t.expect(gestSt.state === 'running' && !gestSt.held && gestSt.timerOn && gestSt.smooth >= 0.85, 'Repro 3B: pagehide -> gesture return restores AU.smooth >= 0.85, held=false & timerOn=true (' + JSON.stringify({ state: gestSt.state, held: gestSt.held, timerOn: gestSt.timerOn, smooth: +gestSt.smooth.toFixed(4) }) + ')');
    },
  },
  {
    name: 'S6-04 canvas layout keeps clear of left, right and bottom insets',
    async run(t) {
      await t.seed(3);
      await t.game('newGame', { mode: 'classic' });
      const before = await t.game('layout');
      // stand-in for env(safe-area-inset-*) on a notched phone in landscape
      await t.page.addStyleTag({ content: '#inset{padding:0 44px 21px 48px !important}' });
      await t.page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await t.waitFrames(3);
      const L = await t.game('layout');
      const { width: W, height: H } = t.vp;
      const edges = [['board', L.board.x, L.board.x + L.board.size, L.board.y + L.board.size], ...L.slots.map((s, i) => ['slot ' + i, s.x, s.x + s.w, s.y + s.h])];
      for (const [name, left, right, bottom] of edges) {
        t.expect(left >= 48 - 0.5, name + ' clear of the left inset (' + left + ')');
        t.expect(right <= W - 44 + 0.5, name + ' clear of the right inset (' + right + ' of ' + W + ')');
        t.expect(bottom <= H - 21 + 0.5, name + ' clear of the bottom inset (' + bottom + ' of ' + H + ')');
      }
      t.expect(before.board.size > 0 && L.board.size > 0, 'board still has a size');
    },
  },
];
