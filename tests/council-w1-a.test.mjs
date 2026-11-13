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
];
