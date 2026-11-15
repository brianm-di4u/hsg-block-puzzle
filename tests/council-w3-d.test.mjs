// Council wave 3, batch D: feedback, teaching and help.
// (S1-07, S1-15, S2-05, S2-12, S4-01)
import { loadRules } from '../tools/rules-node.mjs';

const R = loadRules();
const empty = () => new Array(81).fill(0);
const setTray = ids => ({ tray: ids.map(id => (id ? { id } : null)) });
const slotCenter = (L, k) => { const s = L.slots[k]; return [s.x + s.w / 2, s.y + s.h / 2]; };
const calm = async t => { await t.game('act', 'setting', 'tipsSeen', true); };

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
const fits = (board, id) => { const p = R.PIECES[id]; for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.wd; c++) if (R.canPlace(board, id, r, c)) return true; return false; };
// The first (seeded, so always the same) board and tray where one placement leaves two pieces that each fit but cannot both be placed.
function doomedScenario() {
  const ids = Object.keys(R.PIECES);
  for (let seed = 1; seed < 4000; seed++) {
    let ns = seed * 7919; const rnd = () => ((ns = (ns * 1103515245 + 12345) >>> 0) / 4294967296);
    const board = new Array(81).fill(0).map(() => (rnd() < 0.62 ? 1 : 0));
    if (R.findClears(board).length) continue;
    const tray = [0, 1, 2].map(() => ids[Math.floor(rnd() * ids.length)]);
    if (!tray.every(id => fits(board, id)) || !playable(board, tray)) continue;
    for (let slot = 0; slot < 3; slot++) {
      const p = R.PIECES[tray[slot]], rest = tray.filter((_, k) => k !== slot);
      for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.wd; c++) {
        if (!R.canPlace(board, p.id, r, c)) continue;
        const nb = board.slice();
        for (const [dr, dc] of p.cells) nb[(r + dr) * 9 + c + dc] = p.color;
        const probe = nb.map(v => (v ? 1 : 0));
        for (const gr of R.findClears(probe)) for (const x of gr.cells) { nb[x] = 0; probe[x] = 0; }
        if (rest.every(id => fits(probe, id)) && !playable(probe, rest)) return { before: board, ids: tray, slot, r, c, after: nb, rest };
      }
    }
  }
  throw new Error('no doomed scenario found');
}

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

  // ------------------------------------------------------------------ S2-05 the phone play screen
  {
    name: 'S2-05 a portrait phone: a taller tray, bigger pieces, and a 14 px line that names the mode',
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await calm(t);
      await t.game('setState', { board: empty(), ...setTray(['t4a', 'o1', 'i5h']) });
      await t.waitFrames(3);
      const L = await t.game('layout');
      t.expect(!L.land, 'portrait');
      // before S2-05: slots 166 px high, pieces at 30.9 px, 158 px of empty backdrop under the tray
      t.expect(L.slots[0].h >= 200, 'the tray slots are at least 200 px high: ' + L.slots[0].h);
      t.expect(L.trayScale >= 34, 'tray pieces are at least 34 px: ' + L.trayScale);
      const gap = 844 - (L.slots[0].y + L.slots[0].h);
      t.expect(gap < 110, 'less than 110 px of empty screen under the tray: ' + gap);
      t.expect(L.info.h >= 56, 'the info strip has room for its three rows');
      t.equal(await t.game('act', 'infoLine'), 'Classic · Lines 0', 'the strip names the mode the HUD hides on a phone');
      await t.game('newGame', { mode: 'springs' });
      t.expect((await t.game('act', 'infoLine')).startsWith('Springs opened 0 / 47'), 'Springs already says its name');
      await t.game('newGame', { mode: 'daily' });
      t.expect((await t.game('act', 'infoLine')).startsWith('Daily Soak · '), 'Daily Soak too');
      await t.game('newGame', { mode: 'trail', level: 'hale-bathhouse' });
      t.expect((await t.game('act', 'infoLine')).startsWith('Spring Trail · '), 'a Trail puzzle names Spring Trail: ' + await t.game('act', 'infoLine'));
      await calm(t);
      await t.game('newGame', { mode: 'trail', level: 'quapaw-bathhouse' });
      await t.shot('S2-05-phone-trail');
      await t.game('newGame', { mode: 'classic' });
      await calm(t);
      await t.waitFrames(3);
      await t.checkLayout();
      await t.shot('S2-05-phone-play');
    },
  },
  {
    name: 'S2-05 on a desktop-sized window the HUD names the mode, so the line does not repeat it',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      t.equal(await t.game('act', 'infoLine'), 'Lines 0', 'no prefix when the HUD shows the mode');
      t.expect(await t.page.isVisible('#h-mode'), 'the HUD mode name is showing');
    },
  },

  // ------------------------------------------------------------------ S1-15 a tray that cannot all be placed says so
  {
    name: 'S1-15 a tray whose pieces fit one by one but not all together warns, and says so to a screen reader',
    async run(t) {
      const sc = doomedScenario();
      await t.game('newGame', { mode: 'classic' });
      await calm(t);
      await t.game('setState', { board: sc.before, ...setTray(sc.ids) });
      t.equal(await t.game('act', 'doomed'), false, 'a tray that can be played out has no warning');
      await t.game('act', 'clearCues');
      await t.game('act', 'place', sc.slot, sc.r, sc.c);
      t.equal(await t.game('act', 'doomed'), true, 'after that placement the two pieces left cannot both be placed');
      await t.page.waitForFunction(() => window.__game.act('cues').includes('warn'), null, { timeout: 3000 });
      await t.page.waitForFunction(() => document.getElementById('live').textContent.includes('Not all of these pieces will fit'), null, { timeout: 3000 });
      await t.waitFrames(3);
      await t.shot('S1-15-doomed-tray');
    },
  },
  {
    name: 'S1-15 no warning for a tray that can be played out, a single piece, or a piece with no room',
    viewports: ['desktop'],
    async run(t) {
      const sc = doomedScenario();
      await t.game('newGame', { mode: 'classic' });
      await calm(t);
      await t.game('setState', { board: empty(), ...setTray(['o1', 'i2h', 'o4']) });
      t.equal(await t.game('act', 'doomed'), false, 'an empty board');
      await t.game('setState', { board: sc.after, ...setTray([sc.rest[0], null, null]) });
      t.equal(await t.game('act', 'doomed'), false, 'one piece left');
      await t.game('setState', { board: sc.after, ...setTray(sc.rest.map(id => id)) });
      t.equal(await t.game('act', 'doomed'), true, 'the same board with both of its pieces is doomed');
      const full = new Array(81).fill(1); full[0] = 0;
      await t.game('setState', { board: full, ...setTray(['o1', 'o9', null]) });
      t.equal(await t.game('act', 'doomed'), false, 'a piece with no room is already flagged as such, not doomed');
    },
  },
];
