// Council wave 3, batch D: feedback, teaching and help.
// (S1-07, S1-15, S2-05, S2-12, S4-01)
const empty = () => new Array(81).fill(0);
const setTray = ids => ({ tray: ids.map(id => (id ? { id } : null)) });
const slotCenter = (L, k) => { const s = L.slots[k]; return [s.x + s.w / 2, s.y + s.h / 2]; };
const calm = async t => { await t.game('act', 'setting', 'tipsSeen', true); };

export const tests = [
  // ------------------------------------------------------------------ S1-07 a phone on its side
  {
    name: 'S1-07 on a phone held sideways the board and the tray pieces are bigger, and a finger carries the piece 40 px up',
    viewports: ['mobile'],
    async run(t) {
      await t.page.setViewportSize({ width: 844, height: 390 });
      await t.game('newGame', { mode: 'classic' });
      await calm(t);
      await t.game('setState', { board: empty(), ...setTray(['o1', 'i2h', 'o4']) });
      await t.waitFrames(3);
      const L = await t.game('layout'), b = L.board;
      t.expect(L.land, 'the layout is the landscape one');
      // before S1-07 these were 27.1 px cells and 16.25 px tray pieces
      t.expect(b.cell >= 29, 'cells are at least 29 px: ' + b.cell);
      t.expect(L.trayScale >= 22, 'tray pieces are drawn at 22 px or more: ' + L.trayScale);
      t.expect(b.y + b.size <= 390 - 28, 'the board leaves room for the caption row under it');
      for (const sl of L.slots) t.expect(sl.y + sl.h <= b.y + b.size + 1, 'a tray slot stays beside the board');
      await t.checkLayout();
      await t.shot('S1-07-landscape');
      // a finger: the one-cell piece rides at least 40 px above the fingertip
      const cdp = await t.page.context().newCDPSession(t.page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0 }] });
      const [ax, ay] = slotCenter(L, 0), ex = b.gx + 4.5 * b.cell, ey = b.gy + 6 * b.cell;
      await touch('touchStart', ax, ay);
      for (let i = 1; i <= 10; i++) await touch('touchMove', ax + (ex - ax) * i / 10, ay + (ey - ay) * i / 10);
      await t.waitFrames(3);
      const body = await t.game('act', 'dragBody');
      t.expect(body && body.id === 'o1', 'the piece is being carried');
      const gap = ey - (body.y + body.s);
      t.expect(gap >= 39.5, 'the piece sits 40 px above the fingertip: ' + gap);
      await touch('touchEnd', ex, ey);
    },
  },
  {
    name: 'S1-07 a portrait phone keeps its layout and its 3/4-cell lift',
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await calm(t);
      await t.game('setState', { board: empty(), ...setTray(['o1', 'i2h', 'o4']) });
      const L = await t.game('layout'), b = L.board;
      t.expect(!L.land, 'portrait');
      const cdp = await t.page.context().newCDPSession(t.page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0 }] });
      const [ax, ay] = slotCenter(L, 0), ex = b.gx + 4.5 * b.cell, ey = b.gy + 6 * b.cell;
      await touch('touchStart', ax, ay);
      for (let i = 1; i <= 10; i++) await touch('touchMove', ax + (ex - ax) * i / 10, ay + (ey - ay) * i / 10);
      await t.waitFrames(3);
      const body = await t.game('act', 'dragBody');
      t.expect(Math.abs((ey - (body.y + body.s)) - b.cell * 0.75) < 1, 'the lift is still three quarters of a cell: ' + (ey - (body.y + body.s)));
      await touch('touchEnd', ex, ey);
    },
  },
];
