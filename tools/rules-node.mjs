// Loads the pure DATA + RULES block of index.html into Node, so tools and tests run the game's own rules.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));

export function loadRules(htmlPath = path.join(HERE, '..', 'index.html')) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const a = html.indexOf('/*RULES-START*/'), b = html.indexOf('/*RULES-END*/');
  if (a < 0 || b < 0) throw new Error('RULES markers not found');
  const src = html.slice(a, b);
  // eslint-disable-next-line no-new-func
  return new Function(src + '\nreturn { ERAS, PIECES, PIECE_IDS, LEVELS, parseLevel, canPlace, fitsAnywhere, findClears, applyMove, freshGame, setupGame, goalMet, count };')();
}

// Depth-first search over every placement order and position. Returns the winning move list or null.
// Trays are dealt from the level's fixed list, so the search space is the player's real choices.
export function solveLevel(R, level, { limit = 2e6, ordered = true } = {}) {
  const g0 = R.setupGame(Object.assign(R.freshGame('trail'), { rng: 1 }), { level: level.id });
  const seen = new Set();
  let nodes = 0;
  const clone = g => ({ ...g, board: g.board.slice(), tray: g.tray.map(t => (t ? { ...t } : null)), queue: g.queue.slice(), undoStack: [] });
  function dfs(g, path) {
    if (g.won) return path;
    if (g.over || ++nodes > limit) return null;
    const key = g.board.join('') + '|' + g.tray.map(t => (t ? t.id : '-')).sort().join(',') + '|' + g.queue.length + '|' + g.groups;
    if (seen.has(key)) return null;
    seen.add(key);
    // Move ordering only (the search stays complete): clears first, then moves near goal cells.
    const goalBoxes = new Set();
    g.board.forEach((v, i) => { if (v === 7 || v === 8) goalBoxes.add(Math.floor(i / 27) * 3 + Math.floor((i % 9) / 3)); });
    const moves = [], tried = new Set();
    for (let k = 0; k < 3; k++) {
      const t = g.tray[k];
      if (!t || tried.has(t.id)) continue;
      tried.add(t.id);
      const p = R.PIECES[t.id];
      for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.wd; c++) {
        if (!R.canPlace(g.board, t.id, r, c)) continue;
        const h = clone(g);
        const res = R.applyMove(h, k, r, c);
        let pr = res.G * 100 + res.stones * 10 + res.vents * 10;
        for (const [dr, dc] of p.cells) if (goalBoxes.has(Math.floor((r + dr) / 3) * 3 + Math.floor((c + dc) / 3))) pr++;
        moves.push({ pr, h, m: [t.id, r, c] });
      }
    }
    if (ordered) moves.sort((a, b) => b.pr - a.pr);
    for (const { h, m } of moves) {
      const res = dfs(h, path.concat([m]));
      if (res) return res;
    }
    return null;
  }
  const sol = dfs(g0, []);
  return { solution: sol, nodes, exhausted: nodes <= limit };
}

// Rough difficulty: share of random legal playouts that reach the goal.
export function randomWinRate(R, level, tries = 400) {
  let wins = 0, s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
  for (let i = 0; i < tries; i++) {
    const g = R.setupGame(Object.assign(R.freshGame('trail'), { rng: 1 }), { level: level.id });
    while (!g.over) {
      const moves = [];
      g.tray.forEach((t, k) => { if (!t) return; const p = R.PIECES[t.id]; for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.wd; c++) if (R.canPlace(g.board, t.id, r, c)) moves.push([k, r, c]); });
      if (!moves.length) break;
      const m = moves[Math.floor(rnd() * moves.length)];
      R.applyMove(g, m[0], m[1], m[2]);
    }
    if (g.won) wins++;
  }
  return wins / tries;
}

export function levelKey(L) { return JSON.stringify([L.board, L.pieces, L.goal]); }

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const R = loadRules();
  const out = {};
  let bad = 0;
  for (const L of R.LEVELS) {
    const t0 = Date.now();
    let r = solveLevel(R, L, { limit: 3e5, ordered: true });
    if (!r.solution) r = solveLevel(R, L, { limit: 3e6, ordered: false });
    const rate = randomWinRate(R, L);
    console.log(`${r.solution ? 'SOLVABLE' : 'NO SOLUTION'}  ${L.id.padEnd(26)} pieces ${String(L.pieces.length).padStart(2)}  nodes ${String(r.nodes).padStart(7)}  random-win ${(rate * 100).toFixed(1).padStart(5)}%  ${Date.now() - t0} ms`);
    if (r.solution) console.log('    ' + r.solution.map(([id, rr, c]) => `${id}@${rr},${c}`).join('  '));
    else bad++;
    out[L.id] = { key: levelKey(L), solution: r.solution, randomWin: rate };
  }
  fs.writeFileSync(path.join(HERE, 'solutions.json'), JSON.stringify(out, null, 1));
  process.exit(bad ? 1 : 0);
}
