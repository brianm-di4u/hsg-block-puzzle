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

  // ------------------------------------------------------------------ S6-14 a second finger leaves the first finger's drag alone
  {
    name: 'S6-14 a second finger, on a piece or off the board, does not change the drag in hand',
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: empty(), ...setTray(['t4a', 'o1', 'i2h']) });
      const L = await t.game('layout'), b = L.board, cell = b.cell, pc = (await t.game('pieces')).t4a;
      const cdp = await t.page.context().newCDPSession(t.page);
      const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
      const [ax, ay] = slotCenter(L, 0), [bx, by] = slotCenter(L, 1);
      const ex = b.gx + 3 * cell + pc.wd * cell / 2, ey = b.gy + 3 * cell + pc.h * cell + cell * 0.75;
      await touch('touchStart', [{ x: ax, y: ay, id: 0 }]);
      for (let i = 1; i <= 10; i++) await touch('touchMove', [{ x: ax + (ex - ax) * i / 10, y: ay + (ey - ay) * i / 10, id: 0 }]);
      await t.waitFrames(3);
      const before = await t.state(), body0 = await t.game('act', 'dragBody');
      t.expect(before.ghost && body0 && body0.id === 't4a', 'the first finger is carrying the T piece with a ghost');
      // a second finger lands on another tray piece
      await touch('touchStart', [{ x: ex, y: ey, id: 0 }, { x: bx, y: by, id: 1 }]);
      await t.waitFrames(3);
      let body = await t.game('act', 'dragBody');
      t.expect(body && body.id === 't4a', 'still carrying the T piece after a second finger on the tray');
      // and a third lands off the board and off the tray, where a tap would clear the selection and the ghost
      await touch('touchStart', [{ x: ex, y: ey, id: 0 }, { x: bx, y: by, id: 1 }, { x: 8, y: b.gy / 2, id: 2 }]);
      await t.waitFrames(3);
      body = await t.game('act', 'dragBody');
      const after = await t.state();
      t.expect(body && body.id === 't4a', 'still carrying the T piece after a finger off the board');
      t.equal(after.ghost, before.ghost, 'the ghost did not change');
      await touch('touchEnd', []);
      const end = await t.state();
      t.expect(end.board.some(v => v > 0), 'letting go places the piece the first finger carried');
      t.equal(end.tray[0], null, 'the T piece is the one that left the tray');
      t.expect(end.tray[1] && end.tray[1].id === 'o1' && end.tray[2] && end.tray[2].id === 'i2h', 'the other two are still there');
    },
  },

  // ------------------------------------------------------------------ P-N03 the era backdrops arrive in a casual game
  {
    name: 'P-N03 the first era change comes at 150 points and the pressure ramp did not move',
    node: true,
    async run(t) {
      t.equal(R.ERAS.map(e => e.at), [0, 150, 400, 800, 1500, 2500, 4000], 'backdrop thresholds');
      // the weights the dealer uses depend on score only through the pressure steps (400, 1,000, 2,000, 3,500, 5,500, 8,000):
      // the same seed draws the same pieces at 0, at the new era steps below 1,000, and at 999
      const seq = score => { const g = R.freshGame('classic'); g.rng = 77; g.score = score; return Array.from({ length: 200 }, () => R.pickPiece(g)).join(','); };
      t.equal(seq(150), seq(0), 'the first new backdrop step (150) deals as before');
      t.equal(seq(800), seq(0), 'the 800 backdrop step deals as before');
      t.equal(seq(999), seq(0), 'up to the old 1,000 step the deal is unchanged');
      t.expect(seq(1000) !== seq(0), 'at 1,000 the pressure ramp still steps up');
      t.expect(seq(8000) !== seq(5500), 'and at 8,000 it still steps up');
    },
  },
  {
    name: 'P-N03 a first-ten-minutes score of 150 shows the Frontier backdrop and its caption',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: empty(), ...setTray(['o1', 'o1', 'o1']), score: 148, era: 0 });
      await t.game('act', 'place', 0, 4, 4);
      t.equal((await t.state()).eraId, 'ancient', '149 is still the Ancient Valley');
      await t.game('act', 'place', 1, 0, 0);
      const s = await t.state();
      t.equal(s.score, 150, 'score 150');
      t.equal(s.eraId, 'frontier', 'the Frontier Springs backdrop');
      t.expect(await t.page.evaluate(() => document.getElementById('toast').textContent.includes('Frontier Springs')), 'the era caption is shown');
    },
  },

  // ------------------------------------------------------------------ S6-05 undoing a Trail loss does not count a second game
  {
    name: 'S6-05 a Trail loss that is undone and lost again counts one game, not two',
    async run(t) {
      await t.game('newGame', { mode: 'trail', level: 'hale-bathhouse' });
      await t.game('act', 'setting', 'tipsSeen', true);
      // a checkerboard of open cells: a single fits anywhere and clears nothing, and two five-in-a-row pieces then have no room
      const board = empty().map((_, i) => ((Math.floor(i / 9) + i % 9) % 2 === 0 ? 1 : 0));
      await t.game('setState', { board, ...setTray(['o1', 'i5h', 'i5h']), queue: [], goal: 'lines:99', undoStack: [] });
      const g0 = (await t.game('act', 'save')).stats;
      let r = await t.game('act', 'place', 0, 0, 1);
      t.expect(r.ok, 'the single is placed');
      let s = await t.state();
      t.expect(s.over && !s.won, 'the puzzle is lost');
      const g1 = (await t.game('act', 'save')).stats;
      t.equal(g1.games, g0.games + 1, 'the loss counts one game');
      t.expect((await t.game('act', 'undo')).ok, 'undo is offered after a Trail loss');
      r = await t.game('act', 'place', 0, 0, 1);
      t.expect((await t.state()).over, 'lost again');
      const g2 = (await t.game('act', 'save')).stats;
      t.equal(g2.games, g1.games, 'losing again after the undo does not count another game');
      t.equal(g2.lines, g1.lines, 'nor its groups');
      t.equal(g2.recent.classic.length, g1.recent.classic.length, 'nor a recent score');
      // a different run does count
      await t.game('newGame', { mode: 'trail', level: 'hale-bathhouse' });
      await t.game('setState', { board, ...setTray(['o1', 'i5h', 'i5h']), queue: [], goal: 'lines:99', undoStack: [] });
      await t.game('act', 'place', 0, 0, 1);
      t.equal((await t.game('act', 'save')).stats.games, g1.games + 1, 'a new puzzle attempt counts as a game');
    },
  },

  // ------------------------------------------------------------------ S6-10 the title card fits a landscape phone
  {
    name: 'S6-10 the title card fits whole on landscape phones, with nothing cut off',
    viewports: ['desktop'],
    async run(t) {
      for (const [w, h] of [[844, 390], [740, 360], [667, 375]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.reload();
        await t.waitFrames(3);
        await t.waitForAnimations();
        const r = await t.page.evaluate(() => {
          const panel = document.querySelector('#sc-title .panel'), p = panel.getBoundingClientRect();
          const last = [...panel.querySelectorAll('button')].pop().getBoundingClientRect();
          return { top: p.top, bottom: p.bottom, h: innerHeight, scrolls: panel.scrollHeight > panel.clientHeight + 1, lastBottom: last.bottom, ticker: getComputedStyle(document.getElementById('ticker')).display };
        });
        t.expect(r.bottom <= r.h && r.top >= 0, w + 'x' + h + ': the panel is inside the screen (' + Math.round(r.top) + ' to ' + Math.round(r.bottom) + ' of ' + r.h + ')');
        t.expect(!r.scrolls, w + 'x' + h + ': the panel does not need to scroll');
        t.expect(r.lastBottom <= r.h, w + 'x' + h + ': the last button is on screen');
        t.equal(r.ticker, 'none', w + 'x' + h + ': the ticker sentence, which cannot fit, is hidden rather than cut');
        if (w === 844) await t.shot('S6-10-title-landscape');
      }
      await t.page.setViewportSize({ width: 1280, height: 800 });
      await t.reload();
      t.expect(await t.page.evaluate(() => getComputedStyle(document.getElementById('ticker')).display !== 'none'), 'the ticker is still there on a desktop');
    },
  },

  // ------------------------------------------------------------------ P-N01 / W6-S3-04 heat calibration (OQ-WF1-02)
  {
    name: 'P-N01 cool/warm water below 6 needs two dry placements to lose a step; hot water loses one; 143°F holds once',
    node: true,
    async run(t) {
      const dry = (heat, boilHold = 0) => {
        const g = R.freshGame('classic'); g.board = empty(); g.tray = [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }]; g.heat = heat; g.boilHold = boilHold; g.rng = 5;
        const out = [];
        for (let k = 0; k < 2; k++) { R.applyMove(g, k, 4, 3 * k + 1); out.push(g.heat); }
        return { out, g };
      };
      t.equal(dry(5).out, [5, 4], 'below HEAT_SLOW_BELOW=6 the first dry placement holds, the second cools');
      t.equal(dry(0).out, [0, 0], 'at 0 it stays at 0');
      t.equal(dry(8).out, [7, 6], 'above 6 every dry placement cools one step');
      t.equal(dry(6).out, [5, 5], 'at 6 the first dry placement cools to 5, then slow-cooling waits for a second');
      t.equal(dry(12, 1).out, [12, 11], 'at 143°F Boiling, Boil-Hold absorbs one dry placement before cooling');
      // a clear in between resets the count
      const g = R.freshGame('classic'); g.board = empty(); for (let c = 1; c < 9; c++) g.board[c] = 1;
      g.tray = [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }]; g.heat = 2; g.rng = 5;
      R.applyMove(g, 0, 4, 4);
      t.equal([g.heat, g.dry], [2, 1], 'one dry placement is waiting');
      const res = R.applyMove(g, 1, 0, 0);
      t.expect(res.G === 1 && g.heat === 3 && g.dry === 0, 'a clear heats the water and starts the count again: heat ' + g.heat + ' dry ' + g.dry);
      t.equal(g.cooled | 0, 0, 'nothing has cooled yet');
    },
  },
  {
    name: 'P-N01 a good greedy player spends most of a game in warm water and reaches Boiling as a rare payoff (<5% moves)',
    node: true,
    async run(t) {
      const hist = new Array(13).fill(0); let moves = 0;
      for (let seed = 0; seed < 10; seed++) botGame('classic', seed, (g, when) => { if (when === 'before') { hist[g.heat]++; moves++; } });
      const share = f => hist.reduce((a, v, h) => a + (f(h) ? v : 0), 0) / moves;
      t.log('moves ' + moves + ': heat 0 ' + (100 * share(h => h === 0)).toFixed(1) + '%, 3+ ' + (100 * share(h => h >= 3)).toFixed(1) + '%, 6+ ' + (100 * share(h => h >= 6)).toFixed(1) + '%, 12 ' + (100 * share(h => h === 12)).toFixed(1) + '%');
      t.expect(share(h => h === 0) < 0.2, 'heat 0 on under a fifth of moves');
      t.expect(share(h => h >= 3) > 0.5, 'water spends over half of moves Warm or hotter (heat 3+)');
      t.expect(share(h => h >= 6) > 0.08, 'the glowing bead (heat 6+) is regularly reached');
      t.expect(share(h => h === 12) < 0.05, 'boiling stays a rare reward (<5% of moves per OQ-WF1-02)');
    },
  },

  // ------------------------------------------------------------------ S1-01 / W6-S3-03 no forced loss at deal (Classic/Springs) & 100% parity (Daily)
  {
    name: 'S1-01 a tray that cannot be placed in full is redrawn in Classic and Springs',
    node: true,
    async run(t) {
      // five open cells in a row: only straight pieces one tile tall go in, so about half of all trays cannot be played out
      const board = new Array(81).fill(1);
      for (const i of [0, 1, 2, 3, 4]) board[i] = 0;
      for (const mode of ['classic', 'springs']) {
        let bad = 0, plain = 0;
        for (let seed = 1; seed <= 300; seed++) {
          const g = R.freshGame(mode); g.rng = seed; g.board = board.slice(); g.score = 0;
          R.dealTray(g);
          if (!playable(g.board, g.tray.map(x => x.id))) bad++;
          const h = R.freshGame(mode); h.rng = seed; const raw = [0, 1, 2].map(() => R.pickPiece(h).toString());
          if (!playable(board, raw)) plain++;
        }
        t.log(mode + ': trays with no way to place all three, of 300 deals: ' + plain + ' as drawn, ' + bad + ' as dealt');
        t.expect(plain > 100, mode + ': the test board really does produce forced losses as drawn (' + plain + ')');
        t.expect(bad <= plain * 0.1, mode + ': as dealt, at most a tenth of those remain (' + bad + ' of ' + plain + ')');
      }
    },
  },
  {
    name: 'S1-01 / CD-WF1-05 Daily Soak deals 100% board-independent identical trays with <=1 giant in early/mid rounds',
    node: true,
    async run(t) {
      const cramped = new Array(81).fill(1);
      for (const i of [0, 1, 2, 3, 4]) cramped[i] = 0;
      let diverged = 0, multiGiant = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const g = R.freshGame('daily'); g.rng = seed; g.board = cramped.slice();
        const e = R.freshGame('daily'); e.rng = seed;
        R.dealTray(g); R.dealTray(e);
        if (g.tray.map(x => x.id).join() !== e.tray.map(x => x.id).join() || g.rng !== e.rng) diverged++;
        if (g.tray.filter(x => R.PIECES[x.id].n >= 5).length > 1) multiGiant++;
      }
      t.equal(diverged, 0, 'cramped and open Daily boards receive 100% identical trays and RNG state');
      t.equal(multiGiant, 0, 'early/mid Daily trays cap giant (>=5-cell) pieces deterministically without inspecting the board');
    },
  },
  {
    name: 'S1-01 a greedy game rarely meets a forced-loss deal, and the dealer never makes a tray worse',
    node: true,
    async run(t) {
      let deals = 0, bad = 0;
      for (let seed = 0; seed < 6; seed++) botGame('classic', seed, (g, when, res) => { if (when === 'after' && res.newRound && !g.over) { deals++; if (!playable(g.board, g.tray.map(x => x.id))) bad++; } });
      t.log(bad + ' forced-loss deals in ' + deals);
      t.expect(deals > 500, 'enough deals were looked at (' + deals + ')');
      t.expect(bad / deals < 0.003, 'under 0.3% of deals are forced losses (the unguarded dealer gave 0.5% with this bot)');
    },
  },

  // ------------------------------------------------------------------ S3-12 why the score came
  {
    name: 'S3-12 the points from placing, clearing and bonuses always add up to the score',
    node: true,
    async run(t) {
      for (const mode of ['classic', 'springs']) for (let seed = 0; seed < 3; seed++) {
        const { g } = botGame(mode, seed);
        t.equal(g.ptsPlace + g.ptsClear + g.ptsBonus, g.score, mode + ' ' + seed + ': ' + g.ptsPlace + ' + ' + g.ptsClear + ' + ' + g.ptsBonus + ' = ' + g.score);
        t.expect(g.ptsClear > g.ptsPlace, mode + ' ' + seed + ': clears are where the points are');
      }
      const g = R.freshGame('classic'); g.board = empty(); g.board[40] = 1; g.tray = [{ id: 'o1' }, null, null]; g.rng = 3;
      for (let c = 0; c < 9; c++) if (c !== 4) g.board[36 + c] = 1;
      g.board[40] = 0;
      const res = R.applyMove(g, 0, 4, 4);
      t.expect(res.G >= 1 && g.ptsPlace === 1 && g.ptsClear === res.clearPts, 'one placed tile is one point and the clear is counted apart');
    },
  },
  {
    name: 'S3-12 the score popup says how many groups and what the heat multiplies, and the game-over card shows where the points came from',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      const board = empty(); for (let c = 1; c < 9; c++) board[c] = 1;
      board[40] = 1;
      await t.game('setState', { board, ...setTray(['o1', 'o1', 'o4']), heat: 0 });
      const r = await t.game('act', 'place', 0, 0, 0);
      t.equal(r.G, 1, 'one group cleared');
      const pops = await t.game('act', 'fxList');
      t.expect(pops.some(p => p.type === 'popup' && p.text === '1 group · heat ×1.25'), 'the popup explains itself: ' + JSON.stringify(pops.map(p => p.text)));
      t.expect(pops.some(p => p.type === 'popup' && /^\+\d+$/.test(p.text)), 'and the number is still there');
      await t.game('act', 'freezeFx', 600);
      await t.shot('S3-12-popup');
      // end the game and read the card
      await t.game('setState', { board: new Array(81).fill(1), ...setTray(['o9', 'o9', null]) });
      await t.game('act', 'unfreezeFx');
      await t.game('scene', 'over');
      await t.waitFrames(3);
      const rows = await t.page.evaluate(() => [...document.querySelectorAll('#ov-stats dt')].map(d => [d.textContent, d.nextElementSibling.textContent]));
      const get = k => (rows.find(x => x[0] === k) || [])[1];
      const score = (await t.state()).score;
      const num = s => +String(s).replace(/,/g, '');
      t.expect(get('Points from clears') !== undefined && get('Points from placing') !== undefined, 'the card has both rows: ' + JSON.stringify(rows));
      t.equal(num(get('Points from clears')) + num(get('Points from placing')), score, 'and they add up to the score ' + score);
      const tip = await t.page.textContent('#ov-tip');
      t.expect(tip.length > 20, 'there is a line on what to try next: ' + tip);
      await t.shot('S3-12-game-over');
    },
  },
  {
    name: 'S3-12 the tip follows how the game went',
    async run(t) {
      const tipFor = async over => {
        await t.game('newGame', { mode: 'classic' });
        await t.game('act', 'setting', 'tipsSeen', true);
        await t.game('setState', { board: new Array(81).fill(1), ...setTray(['o9', 'o9', null]), ...over });
        await t.game('scene', 'over');
        await t.waitFrames(2);
        return t.page.textContent('#ov-tip');
      };
      t.expect((await tipFor({ placed: 3, groups: 0 })).startsWith('Early losses'), 'a very short game: keep the board open');
      t.expect((await tipFor({ placed: 40, groups: 6, bestG: 1, cooled: 0 })).includes('2 at once scores 72'), 'only single clears: try for two at once');
      const cool = await tipFor({ placed: 40, groups: 6, bestG: 2, cooled: 9, bestHeat: 3 });
      t.expect(cool.includes('cooled 9 times'), 'the water kept cooling: ' + cool);
      t.expect((await tipFor({ placed: 40, groups: 0, bestG: 0 })).startsWith('Nothing cleared'), 'no clears at all');
    },
  },

  // ------------------------------------------------------------------ S3-15 fact cards from every mode
  {
    name: 'S3-15 Water cards are collected by clearing groups and by Daily Soak streaks, in any mode',
    async run(t) {
      await t.game('scene', 'cards');
      const open = () => t.page.evaluate(() => [...document.querySelectorAll('#cards-water .card')].map(c => !c.classList.contains('locked')));
      t.equal(await open(), new Array(8).fill(false), 'a new player has none, and sees what each one needs');
      t.expect((await t.page.textContent('#cards-water')).includes('Clear 25 groups in total, in any mode.'), 'the condition is in plain words');
      const save = await t.game('act', 'save');
      save.stats.lines = 120;
      save.daily = { ...save.daily, longest: 3 };
      await storeAndReload(t, save);
      await t.game('scene', 'cards');
      t.equal(await open(), [true, true, true, false, false, false, true, false], '120 groups and a 3-day streak open four cards');
      t.expect((await t.page.textContent('#cards-water-sub')).startsWith('4 of 8 collected'), 'the count says so');
      t.expect((await t.page.textContent('#cards-water')).includes('Tufa is the white-to-tan rock'), 'an open card shows its sourced line');
      await t.page.evaluate(() => document.getElementById('cards-water').scrollIntoView({ block: 'start' }));
      await t.waitFrames(2);
      await t.shot('S3-15-cards');
    },
  },
  {
    name: 'S3-15 the game-over card announces a Water card the moment a game earns it',
    async run(t) {
      const save = await t.game('act', 'save');
      save.stats.lines = 24;
      await storeAndReload(t, save);
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      const board = empty(); for (let c = 1; c < 9; c++) board[c] = 1;
      await t.game('setState', { board, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'clearCues');
      await t.game('act', 'place', 0, 0, 0);
      await t.game('setState', { board: new Array(81).fill(1), ...setTray(['o9', 'o9', null]) });
      t.equal((await t.game('act', 'save')).stats.lines, 25, 'the game counted its group: 25 in all');
      await t.game('scene', 'over');
      await t.waitFrames(2);
      const rows = await t.page.evaluate(() => [...document.querySelectorAll('#ov-stats dt')].map(d => [d.textContent, d.nextElementSibling.textContent]));
      t.expect(rows.some(r => r[0] === 'Fact card collected' && r[1] === 'Water’s age: 250 years'), 'the card is announced: ' + JSON.stringify(rows));
      await t.page.waitForFunction(() => window.__game.act('cues').includes('card'), null, { timeout: 5000 });
      // a second game that earns nothing new says nothing
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: new Array(81).fill(1), ...setTray(['o9', 'o9', null]) });
      await t.game('scene', 'over');
      await t.waitFrames(2);
      const rows2 = await t.page.evaluate(() => [...document.querySelectorAll('#ov-stats dt')].map(d => d.textContent));
      t.expect(!rows2.includes('Fact card collected'), 'and a game that earns none does not repeat it');
    },
  },
];
