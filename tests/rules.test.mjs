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
      t.equal(s.score, 1 + Math.round(18 * 1.25) + 300, 'row clear score with ×1.25 and clear-spring bonus');

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
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }], heat: 5, score: 0 });
      await t.game('act', 'place', 0, 0, 0);
      let s = await t.state();
      t.equal(s.heat, 4, 'non-clearing placement cools by 1');
      await t.game('setState', { heat: 11 });
      const b = EMPTY();
      for (let c = 1; c < 9; c++) { b[idx(0, c)] = 2; b[idx(c, 0)] = 3; }
      b[idx(8, 8)] = 1;
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }] });
      await t.game('act', 'place', 0, 0, 0);
      s = await t.state();
      t.equal(s.heat, 12, 'heat caps at 12');
      t.equal(s.temp, 143, '143°F at max heat');
      await t.game('act', 'hideToast');
      await t.shot('13-heat-boiling');
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
];
