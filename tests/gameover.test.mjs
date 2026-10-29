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
      const u = await t.game('act', 'undo');
      t.expect(!u.ok, 'no undo after game over');
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
];
