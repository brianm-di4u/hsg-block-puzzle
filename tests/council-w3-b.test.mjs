// Council wave 3, batch B: controls, rules and play; difficulty, progression and records.
// (S1-06, S1-10, S6-14, P-N03, S6-05, S6-10, P-N01, S1-01, S3-12, S3-15)
// S1-10 is already done by an earlier wave (the Undo button is disabled while there is nothing to undo) and has no test here.
import { loadRules } from '../tools/rules-node.mjs';

const R = loadRules();
const KEY = 'hs-thermal-blocks-v1';
const empty = () => new Array(81).fill(0);
const setTray = ids => ({ tray: ids.map(id => (id ? { id } : null)) });
const readSave = t => t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const storeAndReload = async (t, save) => {
  await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, save]);
  await t.reload();
  await t.waitFrames(3);
};
const slotCenter = (L, k) => { const s = L.slots[k]; return [s.x + s.w / 2, s.y + s.h / 2]; };

// An independent check that a tray can be played out in some order: no budget, no shortcuts.
function playable(board, ids) {
  const go = (b, left) => {
    if (!left.length) return true;
    for (let i = 0; i < left.length; i++) {
      const p = R.PIECES[left[i]], rest = left.filter((_, j) => j !== i);
      for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.wd; c++) {
        if (!R.canPlace(b, p.id, r, c)) continue;
        const nb = b.slice();
        for (const [dr, dc] of p.cells) nb[(r + dr) * 9 + c + dc] = 1;
        for (const gr of R.findClears(nb)) for (const x of gr.cells) nb[x] = 0;
        if (go(nb, rest)) return true;
      }
    }
    return false;
  };
  return go(board, ids);
}

// The greedy bot of tools/difficulty-sim.mjs, seeded, returning what the test needs from one game.
function botGame(mode, seed, onMove) {
  let ns = 7 + seed; const noise = () => ((ns = (ns * 1103515245 + 12345) >>> 0) / 4294967296);
  const g = R.freshGame(mode); g.rng = 1000 + seed; R.setupGame(g, {});
  let n = 0;
  while (!g.over && n < 1500) {
    let best = -1e9, m = null;
    g.tray.forEach((tr, k) => {
      if (!tr) return;
      const p = R.PIECES[tr.id];
      for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.wd; c++) {
        if (!R.canPlace(g.board, tr.id, r, c)) continue;
        const b = g.board.slice();
        for (const [dr, dc] of p.cells) b[(r + dr) * 9 + c + dc] = 1;
        let contact = 0, holes = 0;
        for (const [dr, dc] of p.cells) for (const [a, d] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr + a, cc = c + dc + d;
          if (rr < 0 || rr > 8 || cc < 0 || cc > 8 || (b[rr * 9 + cc] && !p.cells.some(([x, y]) => x === dr + a && y === dc + d))) contact++;
        }
        for (let i = 0; i < 81; i++) if (!b[i]) {
          const rr = Math.floor(i / 9), cc = i % 9;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, d]) => { const x = rr + a, y = cc + d; return x < 0 || x > 8 || y < 0 || y > 8 || b[x * 9 + y]; })) holes++;
        }
        const s = R.findClears(b).length * 1000 + contact * 3 - holes * 25 + noise();
        if (s > best) { best = s; m = [k, r, c]; }
      }
    });
    if (!m) break;
    if (onMove) onMove(g, 'before');
    const res = R.applyMove(g, m[0], m[1], m[2]);
    n++;
    if (onMove) onMove(g, 'after', res);
  }
  return { g, n };
}

export const tests = [
  // ------------------------------------------------------------------ S1-06 the carried piece is where the ghost lands
  {
    name: 'S1-06 a piece dragged with the mouse is painted exactly where it will land',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: empty(), ...setTray(['t4a', 'o1', 'i2h']) });
      const L = await t.game('layout'), b = L.board, pc = (await t.game('pieces')).t4a;
      const [sx, sy] = slotCenter(L, 0);
      // the pointer that puts the piece's top-left exactly on cell (r 5, c 4)
      const tx = b.gx + 4 * b.cell + pc.wd * b.cell / 2, ty = b.gy + 5 * b.cell + pc.h * b.cell / 2;
      await t.page.mouse.move(sx, sy);
      await t.page.mouse.down();
      await t.page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 6 });
      await t.page.mouse.move(tx, ty, { steps: 6 });
      const s = await t.state(), body = await t.game('act', 'dragBody');
      t.expect(s.ghost && s.ghost.r === 5 && s.ghost.c === 4, 'the ghost is at row 5, column 4: ' + JSON.stringify(s.ghost));
      t.expect(body && body.id === 't4a', 'a piece is being carried');
      t.expect(Math.abs(body.x - (b.gx + 4 * b.cell)) < 0.5, 'the body is not shifted sideways: ' + body.x + ' vs ' + (b.gx + 4 * b.cell));
      t.expect(Math.abs(body.y - (b.gy + 5 * b.cell)) < 0.5, 'the body is not lifted off its cells: ' + body.y + ' vs ' + (b.gy + 5 * b.cell));
      t.expect(Math.abs(body.s - b.cell) < 0.5, 'the body is drawn at the size of the cells it covers');
      await t.game('act', 'freezeFx');
      await t.shot('S1-06-drag');
      await t.game('act', 'unfreezeFx');
      await t.page.mouse.up();
      t.equal((await t.state()).board[5 * 9 + 4] > 0, true, 'and it lands there');
    },
  },
  {
    name: 'S1-06 a piece dragged with a finger is painted where it will land too',
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: empty(), ...setTray(['t4a', 'o1', 'i2h']) });
      const L = await t.game('layout'), b = L.board, cell = b.cell, pc = (await t.game('pieces')).t4a;
      const cdp = await t.page.context().newCDPSession(t.page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 0 }] });
      const [ax, ay] = slotCenter(L, 0);
      const ex = b.gx + 3 * cell + pc.wd * cell / 2, ey = b.gy + 2 * cell + pc.h * cell + cell * 0.75;
      await touch('touchStart', ax, ay);
      for (let i = 1; i <= 10; i++) await touch('touchMove', ax + (ex - ax) * i / 10, ay + (ey - ay) * i / 10);
      await t.waitFrames(3);
      const s = await t.state(), body = await t.game('act', 'dragBody');
      t.expect(s.ghost && s.ghost.r === 2 && s.ghost.c === 3, 'the ghost is at row 2, column 3: ' + JSON.stringify(s.ghost));
      t.expect(Math.abs(body.x - (b.gx + 3 * cell)) < 0.5 && Math.abs(body.y - (b.gy + 2 * cell)) < 0.5, 'the body sits on the ghost: ' + body.x + ',' + body.y);
      await touch('touchEnd', ex, ey);
    },
  },

];
