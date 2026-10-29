// M1: boot, title screen, empty board (AC1, AC2)
export const tests = [
  {
    name: 'title screen',
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title', 'starts on title');
      const modes = await t.page.$$eval('#sc-title [data-mode], #sc-title [data-go="trail"]', els => els.filter(e => e.offsetParent).length);
      t.equal(modes, 4, 'four mode buttons visible');
      const ticker = await t.page.textContent('#ticker');
      t.expect(ticker && ticker.length > 20, 'ticker has a fact');
      t.expect(t.loadMs < 2000, 'loads in under 2 s (' + t.loadMs + ' ms)');
      await t.checkLayout();
      await t.shot('01-title');
    },
  },
  {
    name: 'empty board',
    async run(t) {
      await t.seed(11);
      await t.game('newGame', { mode: 'classic' });
      const s = await t.state();
      t.equal(s.scene, 'game', 'in game');
      t.equal(s.board.filter(Boolean).length, 0, 'board empty');
      t.equal(s.tray.filter(Boolean).length, 3, 'three pieces dealt');
      const L = await t.game('layout');
      t.expect(L.board.x >= 0 && L.board.y >= 0 && L.board.x + L.board.size <= t.vp.width && L.board.y + L.board.size <= t.vp.height, 'board fully on screen');
      for (const sl of L.slots) t.expect(sl.x >= 0 && sl.y >= 0 && sl.x + sl.w <= t.vp.width && sl.y + sl.h <= t.vp.height, 'tray slot on screen');
      if (t.viewport === 'mobile') for (const sl of L.slots) t.expect(sl.w >= 44 && sl.h >= 44, 'tray slot ≥ 44 px');
      await t.game('act', 'hideToast');
      await t.checkLayout();
      await t.shot('02-board-empty');
    },
  },
];
