// M2: pointer drag, touch drag (default) and tap-select/tap-place (setting), keyboard play (AC14–AC16)
const EMPTY = () => new Array(81).fill(0);

async function setup(t, tray) {
  await t.seed(3);
  await t.game('newGame', { mode: 'classic' });
  await t.game('setState', { board: EMPTY(), tray, score: 0, heat: 0 });
  await t.game('act', 'hideToast');
  return t.game('layout');
}
function cellCenter(L, r, c) { const b = L.board; return [b.gx + (c + 0.5) * b.cell, b.gy + (r + 0.5) * b.cell]; }
function slotCenter(L, k) { const s = L.slots[k]; return [s.x + s.w / 2, s.y + s.h / 2]; }

export const tests = [
  {
    name: 'pointer drag places with snapped ghost',
    viewports: ['desktop'],
    async run(t) {
      const L = await setup(t, [{ id: 't4a' }, { id: 'o1' }, { id: 'i2h' }]);
      const [sx, sy] = slotCenter(L, 0);
      // t4a is 3 wide × 2 tall; to land its top-left at (5,4) the pointer goes to the piece's center there
      const b = L.board, tx = b.gx + (4 + 1.5) * b.cell + 6, ty = b.gy + (5 + 1) * b.cell - 7;
      await t.page.mouse.move(sx, sy);
      await t.page.mouse.down();
      for (let k = 1; k <= 12; k++) await t.page.mouse.move(sx + (tx - sx) * k / 12, sy + (ty - sy) * k / 12);
      const s = await t.state();
      t.expect(s.ghost && s.ghost.valid && s.ghost.r === 5 && s.ghost.c === 4, 'ghost snapped to 5,4: ' + JSON.stringify(s.ghost));
      await t.game('act', 'freezeFx');
      await t.shot('30-drag-ghost');
      await t.game('act', 'unfreezeFx');
      await t.page.mouse.up();
      const s2 = await t.state();
      t.equal([45 + 4, 45 + 5, 45 + 6, 54 + 5].map(i => s2.board[i] > 0), [true, true, true, true], 't4a placed at 5,4');
      t.equal(s2.tray[0], null, 'slot 1 used');
      // a drop off the board returns the piece
      const [ax, ay] = slotCenter(L, 1);
      await t.page.mouse.move(ax, ay); await t.page.mouse.down();
      await t.page.mouse.move(ax - 300, ay + 10, { steps: 6 }); await t.page.mouse.move(ax - 900, ay + 10, { steps: 6 });
      await t.page.mouse.up();
      const s3 = await t.state();
      t.expect(s3.tray[1] && s3.tray[1].id === 'o1', 'piece returned to tray');
      // click-select then click-place
      const [bx, by] = slotCenter(L, 2);
      await t.page.mouse.click(bx, by);
      const [cx, cy] = cellCenter(L, 0, 0);
      await t.page.mouse.move(cx, cy);
      await t.page.mouse.click(cx, cy);
      const s4 = await t.state();
      t.expect(s4.board[0] > 0 && s4.board[1] > 0, 'click-select then click-place puts i2h at 0,0');
      await t.checkLayout();
    },
  },
  {
    name: 'touch drag is the default',
    viewports: ['mobile'],
    async run(t) {
      const L = await setup(t, [{ id: 'i5v' }, { id: 'o1' }, { id: 'i2h' }]);
      const b = L.board, cell = b.cell;
      const cdp = await t.page.context().newCDPSession(t.page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      // the finger point that puts a w×h piece's top-left at (r, c): the piece floats with its bottom 3/4 cell above the finger
      const fingerFor = (w, h, r, c) => [b.gx + c * cell + w * cell / 2, b.gy + r * cell + h * cell + cell * 0.75];
      async function drag(k, [ex, ey], mid) {
        const [ax, ay] = slotCenter(L, k);
        await touch('touchStart', ax, ay);
        for (let i = 1; i <= 10; i++) await touch('touchMove', ax + (ex - ax) * i / 10, ay + (ey - ay) * i / 10);
        if (mid) await mid();
        await touch('touchEnd', ex, ey);
      }
      // a tap on a tray piece hints at dragging instead of selecting; a board tap does nothing
      const [sx, sy] = slotCenter(L, 1);
      await t.page.touchscreen.tap(sx, sy);
      let s = await t.state();
      t.equal(s.sel, -1, 'tray tap does not select');
      t.expect(await t.page.evaluate(() => document.getElementById('toast').classList.contains('on')), 'drag hint shown');
      await t.game('act', 'hideToast');
      const [cx, cy] = cellCenter(L, 4, 4);
      await t.page.touchscreen.tap(cx, cy); await t.page.touchscreen.tap(cx, cy);
      s = await t.state();
      t.equal(s.board.filter(Boolean).length, 0, 'board taps place nothing');
      // a tall piece stays clear of the finger and lands where its ghost shows
      await drag(0, fingerFor(1, 5, 1, 2), async () => {
        await t.page.evaluate(() => new Promise(r => requestAnimationFrame(() => r()))); // pointermoves arrive once per frame
        const m = await t.state();
        t.expect(m.ghost && m.ghost.valid && m.ghost.r === 1 && m.ghost.c === 2, 'i5v ghost at 1,2 above the finger: ' + JSON.stringify(m.ghost));
        await t.game('act', 'freezeFx');
        await t.shot('34-touch-drag');
        await t.game('act', 'unfreezeFx');
      });
      s = await t.state();
      t.equal([1, 2, 3, 4, 5].map(r => s.board[r * 9 + 2] > 0), [true, true, true, true, true], 'i5v placed at 1,2');
      // snap assist: a drop 0.4 cell off an open spot, next to a blocked one, takes the open spot
      const board = EMPTY(); board[2 * 9 + 3] = 1;
      await t.game('setState', { board, tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }] });
      await drag(0, fingerFor(1, 1, 2, 3.4));
      s = await t.state();
      t.expect(s.tray[0] === null && s.board[2 * 9 + 4] > 0, 'o1 snapped to the open cell 2,4');
      // a small overhang past the board edge is pulled back in
      await drag(2, fingerFor(2, 1, 6, -0.55));
      s = await t.state();
      t.expect(s.tray[2] === null && s.board[54] > 0 && s.board[55] > 0, 'i2h hanging off the left edge lands at 6,0');
      await t.checkLayout();
    },
  },
  {
    name: 'touch tap select and place',
    viewports: ['mobile'],
    async run(t) {
      const L = await setup(t, [{ id: 'o4' }, { id: 'o1' }, { id: 'i3v' }]);
      await t.game('act', 'setting', 'tapPlace', true);
      const [sx, sy] = slotCenter(L, 0);
      await t.page.touchscreen.tap(sx, sy);
      let s = await t.state();
      t.equal(s.sel, 0, 'slot 1 selected by tap');
      const [cx, cy] = cellCenter(L, 3, 3);
      await t.page.touchscreen.tap(cx, cy);
      s = await t.state();
      t.expect(s.ghost && s.ghost.valid, 'first tap shows ghost');
      t.equal(s.board.filter(Boolean).length, 0, 'nothing placed yet');
      await t.shot('31-tap-ghost');
      await t.page.touchscreen.tap(cx, cy);
      s = await t.state();
      t.equal(s.board.filter(Boolean).length, 4, 'second tap on ghost places the piece');
      // real touch drag with lift
      const [ax, ay] = slotCenter(L, 2);
      const tgt = cellCenter(L, 6, 7);
      const cdp = await t.page.context().newCDPSession(t.page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await touch('touchStart', ax, ay);
      const lift = L.board.cell * (3 / 2 + 0.75); // i3v is 3 tall: half its height plus 3/4 cell
      const ex = tgt[0], ey = tgt[1] + lift;
      for (let k = 1; k <= 10; k++) await touch('touchMove', ax + (ex - ax) * k / 10, ay + (ey - ay) * k / 10);
      s = await t.state();
      t.expect(s.ghost && s.ghost.valid, 'touch drag shows a valid ghost above the finger: ' + JSON.stringify(s.ghost));
      await touch('touchEnd', ex, ey);
      s = await t.state();
      t.equal(s.tray[2], null, 'i3v placed by touch drag');
      await t.checkLayout();
    },
  },
  {
    name: 'keyboard turn and pause',
    async run(t) {
      await setup(t, [{ id: 'l4a' }, { id: 'o1' }, { id: 'i2v' }]);
      await t.page.focus('#cv');
      await t.page.keyboard.press('1');
      let s = await t.state();
      t.equal(s.sel, 0, 'key 1 selects slot 1');
      await t.page.keyboard.press('ArrowLeft'); await t.page.keyboard.press('ArrowLeft');
      await t.page.keyboard.press('ArrowDown');
      s = await t.state();
      t.expect(s.ghost && s.ghost.valid, 'ghost follows arrows');
      await t.shot('32-keyboard-cursor');
      const g = s.ghost;
      await t.page.keyboard.press('Enter');
      s = await t.state();
      t.equal(s.board[g.r * 9 + g.c] > 0, true, 'Enter placed the piece at the ghost');
      t.equal(s.tray[0], null, 'slot 1 used');
      await t.page.keyboard.press('Tab');
      s = await t.state();
      t.equal(s.sel, 1, 'Tab cycles to the next piece');
      await t.page.keyboard.press('Escape');
      await t.page.keyboard.press('Escape');
      s = await t.state();
      t.equal(s.scene, 'pause', 'Escape twice: cancel, then pause');
      await t.checkLayout();
      await t.shot('33-pause');
      await t.page.keyboard.press('Escape');
      s = await t.state();
      t.equal(s.scene, 'game', 'Escape resumes');
    },
  },
];
