// Plays Classic and Springs with a greedy bot at each difficulty and prints what it costs the bot (S3-04).
// Usage: node tools/difficulty-sim.mjs [games per cell, default 60]
// The bot's noise comes from a per-game seed, so the same command prints the same numbers.
import { loadRules } from './rules-node.mjs';

const R = loadRules();
const N = +(process.argv[2] || 60);

function play(mode, diff, seed, cap) {
  let ns = seed; const noise = () => ((ns = (ns * 1103515245 + 12345) >>> 0) / 4294967296);
  const g = R.freshGame(mode); g.rng = 1000 + seed; g.diff = diff; R.setupGame(g, {});
  let n = 0, deadDeals = 0;
  while (!g.over && n < cap) {
    let best = -1e9, m = null;
    g.tray.forEach((t, k) => {
      if (!t) return;
      const p = R.PIECES[t.id];
      for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.wd; c++) {
        if (!R.canPlace(g.board, t.id, r, c)) continue;
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
    const res = R.applyMove(g, m[0], m[1], m[2]);
    n++;
    if (res.newRound && !g.over && g.tray.filter(Boolean).some(t => !R.fitsAnywhere(g.board, t.id))) deadDeals++;
  }
  return { n, score: g.score, won: g.won, over: g.over, springs: g.springs, deadDeals };
}
const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };

export function measure(diffs = ['relaxed', 'standard', 'master'], games = N) {
  const out = [];
  for (const mode of ['classic', 'springs']) for (const diff of diffs) {
    const runs = [];
    for (let i = 0; i < games; i++) runs.push(play(mode, diff, 7 + i, mode === 'classic' ? 1500 : 3000));
    out.push({ mode, diff, games, moves: [q(runs.map(r => r.n), 0.1), q(runs.map(r => r.n), 0.5), q(runs.map(r => r.n), 0.9)],
      score: [q(runs.map(r => r.score), 0.1), q(runs.map(r => r.score), 0.5), q(runs.map(r => r.score), 0.9)],
      won: mode === 'springs' ? runs.filter(r => r.won).length : null, capped: runs.filter(r => !r.over).length,
      cramped: +(runs.reduce((a, r) => a + r.deadDeals, 0) / games).toFixed(2) });
  }
  return out;
}
if (process.argv[1] && process.argv[1].endsWith('difficulty-sim.mjs')) {
  for (const o of measure()) console.log(o.mode.padEnd(7), o.diff.padEnd(9), 'moves p10/p50/p90', o.moves.join('/'), ' score p10/p50/p90', o.score.join('/'),
    o.won === null ? '' : ' won ' + o.won + '/' + o.games, ' capped', o.capped, ' trays dealt with a dead piece per game', o.cramped);
}
