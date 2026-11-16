// Council wave 4, batch B: controls, rules and play; difficulty, progression and records; feedback, teaching and help.
const EMPTY = () => new Array(81).fill(0);
const checker = () => { const b = EMPTY(); for (let i = 0; i < 81; i++) if ((Math.floor(i / 9) + i % 9) % 2 === 0) b[i] = 1 + (i % 6); return b; };
const BOTH = ['desktop', 'mobile'];

// A Classic game one move from the end: only the single tile fits, and placing it clears nothing.
async function lastMove(t, extra = {}) {
  await t.seed(8);
  await t.game('newGame', { mode: 'classic' });
  await t.game('setState', { board: checker(), tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score: 480, heat: 3, bestHeat: 7, groups: 12, placed: 40, undoLeft: 3, ...extra });
  await t.game('act', 'hideToast');
}
const waitScene = (t, name) => t.page.waitForFunction(n => window.__game.getState().scene === n, name, { timeout: 8000 });

export const tests = [
  {
    name: 'S1-02 the move that ends a Classic game can be taken back from the results card, and the game still counts once',
    viewports: BOTH,
    async run(t) {
      await lastMove(t);
      const before = await t.game('act', 'save');
      await t.game('act', 'place', 0, 0, 1);
      await waitScene(t, 'over');
      t.expect(await t.page.isVisible('#b-ovundo'), 'the results card offers Undo last move');
      await t.shot('S1-02-results-undo');
      const mid = await t.game('act', 'save');
      t.equal([mid.best.classic, mid.stats.games], [481, before.stats.games + 1], 'the ending recorded the game and the best');
      await t.page.click('#b-ovundo');
      await waitScene(t, 'game');
      const s = await t.state();
      t.equal([s.over, s.score, s.tray.filter(Boolean).length], [false, 480, 3], 'back in the game, one move earlier');
      const after = await t.game('act', 'save');
      t.equal(after.stats.games, mid.stats.games, 'the finished game stays counted');
      t.equal(s.undoLeft, 2, 'the undo counts against the round');
      await t.game('act', 'place', 0, 0, 1);
      await waitScene(t, 'over');
      const again = await t.game('act', 'save');
      t.equal([again.stats.games, again.best.classic], [before.stats.games + 1, 481], 'finishing the same game again counts one game, not two');
    },
  },
  {
    name: 'S1-02 Undo works during the pause before the results card, from the button and the U key',
    viewports: BOTH,
    async run(t) {
      await lastMove(t);
      const r = await t.page.evaluate(() => { const g = window.__game; g.act('place', 0, 0, 1); const s = g.getState(); const u = g.act('undo'); return { over: s.over, scene: s.scene, ok: u.ok, now: g.getState().over }; });
      t.equal([r.over, r.scene, r.ok, r.now], [true, 'game', true, false], 'the board is over but still showing, and Undo takes it back');
      await t.game('act', 'place', 0, 0, 1);
      await t.page.keyboard.press('u');
      await waitScene(t, 'game');
      t.equal((await t.state()).over, false, 'U during the pause takes it back');
      await t.game('act', 'place', 0, 0, 1);
      await t.game('act', 'freezeFx', 0);
      await t.page.keyboard.press('KeyU');
      await t.page.waitForFunction(() => !window.__game.getState().over, null, { timeout: 4000 });
      await t.game('act', 'unfreezeFx');
    },
  },
  {
    name: 'S1-02 with no undos left there is no Undo on the results card',
    viewports: BOTH,
    async run(t) {
      await t.game('act', 'setting', 'undo', 0);
      await lastMove(t, { undoLeft: 0 });
      await t.game('act', 'place', 0, 0, 1);
      await waitScene(t, 'over');
      t.expect(!(await t.page.isVisible('#b-ovundo')), 'no Undo button');
      t.expect(!(await t.game('act', 'undo')).ok, 'and the undo refuses');
      await t.game('act', 'setting', 'undo', 3);
    },
  },
  {
    name: 'S1-02 a Daily loss can be taken back too',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(8);
      await t.game('newGame', { mode: 'daily' });
      await t.game('setState', { board: checker(), tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score: 100, placed: 40, undoLeft: 3 });
      await t.game('act', 'place', 0, 0, 1);
      await waitScene(t, 'over');
      t.expect(await t.page.isVisible('#b-ovundo'), 'a Daily loss offers Undo');
      await t.page.click('#b-ovundo');
      await waitScene(t, 'game');
      t.equal((await t.state()).over, false, 'the Daily is playable again');
    },
  },
  {
    name: 'S1-02 a last piece that clears nothing shows the results card in 450 ms or less; a tap or Enter skips the wait',
    viewports: BOTH,
    async run(t) {
      await lastMove(t);
      const r = await t.page.evaluate(() => { const g = window.__game; g.act('place', 0, 0, 1); return g.getState().overIn; });
      t.expect(r > 0 && r <= 450, 'the card is due within 450 ms, not 1000: ' + r);
      await waitScene(t, 'over');
      await t.game('act', 'undo');
      await t.game('act', 'place', 0, 0, 1);
      await t.game('act', 'freezeFx', 0);
      await t.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      t.equal((await t.state()).scene, 'game', 'with the effects held, the card waits');
      await t.page.keyboard.press('Enter');
      await waitScene(t, 'over');
      await t.game('act', 'unfreezeFx');
      await t.game('act', 'undo');
      await t.game('act', 'place', 0, 0, 1);
      await t.game('act', 'freezeFx', 0);
      await t.page.mouse.click(t.vp.width / 2, 200);
      await waitScene(t, 'over');
      await t.game('act', 'unfreezeFx');
    },
  },
];

// A board one cell short of a full top row: the single tile at (0,8) clears that row and nothing else.
async function oneGroup(t) {
  await t.seed(8);
  await t.game('newGame', { mode: 'classic' });
  const b = EMPTY(); for (let c = 0; c < 8; c++) b[c] = 1;
  await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], score: 0, heat: 3, placed: 5 });
  await t.game('act', 'hideToast');
}

tests.push(
  {
    name: 'S1-11 a single-group clear gives a short, small shake; a plain drop gives none; a double keeps its bigger one',
    viewports: BOTH,
    async run(t) {
      await oneGroup(t);
      const none = await t.page.evaluate(() => { const g = window.__game; g.act('place', 1, 4, 4); return g.act('shakes'); });
      t.equal(none, [], 'a drop that clears nothing does not shake');
      const one = await t.page.evaluate(() => { const g = window.__game; const r = g.act('place', 0, 0, 8); return { G: r.G, shakes: g.act('shakes') }; });
      t.equal(one.G, 1, 'one group cleared');
      t.equal(one.shakes, [{ dur: 120, amp: 1.5 }], 'a 120 ms shake with amp 1.5');
      await t.game('newGame', { mode: 'classic' });
      const b = EMPTY(); for (let c = 0; c < 8; c++) { b[c] = 1; b[9 + c] = 1; }
      await t.game('setState', { board: b, tray: [{ id: 'i2v' }, { id: 'o1' }, { id: 'o1' }], score: 0, heat: 3, placed: 5 });
      const two = await t.page.evaluate(() => { const g = window.__game; const r = g.act('place', 0, 0, 8); return { G: r.G, shakes: g.act('shakes') }; });
      t.equal(two.G, 2, 'two groups cleared');
      t.equal(two.shakes, [{ dur: 300, amp: 5.6 }], 'the double-clear shake is as it was');
    },
  },
  {
    name: 'S1-11 reduced motion: a single-group clear does not shake',
    viewports: ['desktop'],
    reducedMotion: true,
    async run(t) {
      await oneGroup(t);
      const r = await t.page.evaluate(() => { const g = window.__game; g.act('place', 0, 0, 8); return g.act('shakes'); });
      t.equal(r, [], 'no shake');
    },
  },
);
