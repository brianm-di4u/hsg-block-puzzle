// Council wave 3, batch C: difficulty, progression and records; feedback, teaching and help.
// (S4-04, S4-06, S4-17, S2-02, S2-03, S2-07, S2-16, S2-17, S4-14)
const KEY = 'hs-thermal-blocks-v1';
const empty = () => new Array(81).fill(0);
const setTray = ids => ({ tray: ids.map(id => (id ? { id } : null)) });
const readSave = t => t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const storeAndReload = async (t, save) => {
  await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, save]);
  await t.reload();
  await t.waitFrames(3);
};
const text = (t, sel) => t.page.textContent(sel);

export const tests = [
  // ------------------------------------------------------------------ S4-04 ceremony
  {
    name: 'S4-04 a lost game names the era it reached and quotes that era’s caption',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: new Array(81).fill(1), ...setTray(['o9', 'o9', null]), era: 2, score: 500 });
      await t.game('scene', 'over');
      await t.waitFrames(2);
      const era = await text(t, '#ov-era');
      t.expect(era.startsWith('You reached Gilded Spa (1875–1920). Brick bathhouses rise along Bathhouse Row.'), 'the epitaph names the era: ' + era);
      await t.game('setState', { era: 0 });
      await t.game('scene', 'over');
      t.expect((await text(t, '#ov-era')).startsWith('You reached Ancient Valley (before 1804).'), 'and the first era too');
      await t.shot('S4-04-game-over');
    },
  },
  {
    name: 'S4-04 the Springs win steams the whole floor, hangs “Valley of Vapors”, and waits for it before the card',
    async run(t) {
      await t.game('newGame', { mode: 'springs' });
      await t.game('act', 'setting', 'tipsSeen', true);
      const b = empty(); for (let c = 1; c < 9; c++) b[c] = 1; b[5] = 8;
      await t.game('setState', { board: b, springs: 46, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 0, 0);
      await t.page.waitForFunction(() => window.__game.getState().over, null, { timeout: 3000 });
      const fx = await t.game('act', 'fxTypes');
      t.expect(fx.filter(x => x === 'steam').length >= 36, 'steam on the whole floor, not only the cleared row: ' + fx.filter(x => x === 'steam').length);
      t.expect((await t.game('act', 'fxList')).some(f => f.text === 'Valley of Vapors'), 'the banner is up');
      t.expect(await t.page.evaluate(() => window.__game.getState().scene) === 'game', 'the card has not replaced the board yet');
      await t.page.waitForTimeout(1100);   // only so the picture catches the steam; nothing is asserted after it
      await t.shot('S4-04-springs-win-steam', { wait: false });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 9000 });
      t.expect((await text(t, '#ov-era')).includes('Valley of Vapors'), 'the card repeats the name and its source line');
      t.equal(await text(t, '#ov-title'), 'All 47 springs flowing!', 'the win title');
      await t.shot('S4-04-springs-win');
    },
  },
  {
    name: 'S4-04 reduced motion: the win banner shows and the steam does not',
    reducedMotion: true,
    async run(t) {
      await t.game('newGame', { mode: 'springs' });
      await t.game('act', 'setting', 'tipsSeen', true);
      const b = empty(); for (let c = 1; c < 9; c++) b[c] = 1; b[5] = 8;
      await t.game('setState', { board: b, springs: 46, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 0, 0);
      await t.page.waitForFunction(() => window.__game.getState().over, null, { timeout: 3000 });
      t.expect((await t.game('act', 'fxTypes')).filter(x => x === 'steam').length === 0, 'no steam');
      t.expect((await t.game('act', 'fxList')).some(f => f.text === 'Valley of Vapors'), 'the banner is still there');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 6000 });
    },
  },
  {
    name: 'S4-04 solving the last first-ring puzzle earns the Row Walker title, and the last puzzle completes the Trail',
    async run(t) {
      const levels = await t.game('getLevels');
      const ring1 = levels.filter(l => !l.ring).map(l => l.id), all = levels.map(l => l.id);
      // The real end-of-game path: one stone left in a row that one piece completes.
      const solveLast = async (done, id) => {
        const s = await t.game('act', 'save'); s.trail.done = done; s.trail.stars = {};
        await storeAndReload(t, s);
        await t.game('newGame', { mode: 'trail', level: id });
        const row = empty(); for (let c = 1; c < 8; c++) row[72 + c] = 1; row[72] = 7;
        await t.game('setState', { board: row, queue: [], ...setTray(['o1', null, null]), goal: 'stones', undosUsed: 0, undoStack: [] });
        await t.game('act', 'place', 0, 8, 8);
        await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 6000 });
      };
      const last1 = ring1[ring1.length - 1];
      await solveLast(ring1.slice(0, -1), last1);
      t.equal(await text(t, '#win-title'), 'Row Walker', 'the title replaces the heading');
      t.expect((await text(t, '#win-sub')).includes('every first-ring puzzle is solved'), 'and the line says why: ' + await text(t, '#win-sub'));
      await t.shot('S4-04-trail-title');
      await t.game('scene', 'records');
      t.expect((await text(t, '#rec-stats')).includes('Row Walker'), 'Records shows the title');
      await t.game('scene', 'title');
      t.expect((await text(t, '#trail-sub')).startsWith('Row Walker · '), 'and so does the title screen: ' + await text(t, '#trail-sub'));
      // an ordinary solve says nothing of the kind
      await solveLast(ring1.slice(0, 3), ring1[5]);
      t.expect((await text(t, '#win-title')).endsWith(': solved'), 'an ordinary solve keeps the puzzle heading');
      // the last of all of them completes the Trail
      await solveLast(all.slice(0, -1), all[all.length - 1]);
      t.equal(await text(t, '#win-title'), 'Spring Trail complete', 'the whole Trail');
      t.expect((await text(t, '#win-sub')).includes('every puzzle is solved'), 'says so');
      await t.shot('S4-04-trail-complete');
      // solving a puzzle again does not repeat the ceremony
      await t.game('newGame', { mode: 'trail', level: all[0] });
      const row = empty(); for (let c = 1; c < 8; c++) row[72 + c] = 1; row[72] = 7;
      await t.game('setState', { board: row, queue: [], ...setTray(['o1', null, null]), goal: 'stones', undosUsed: 0, undoStack: [] });
      await t.game('act', 'place', 0, 8, 8);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 6000 });
      t.expect((await text(t, '#win-title')).endsWith(': solved'), 'a replay is an ordinary solve');
    },
  },
];
