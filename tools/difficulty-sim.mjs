// Plays Classic, Springs and Daily Soak with a greedy bot and prints length, score, 143°F Boiling,
// Springs overshoot, and Daily clean-vs-messy RNG parity telemetry (S3-04, WF-1/WF-3/WF-6 W6-S6-05).
// Usage: node tools/difficulty-sim.mjs [games per cell, default 60]
// The bot's noise comes from a per-game seed, so the same command prints the same numbers.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRules } from './rules-node.mjs';

const R = loadRules();
const N = +(process.argv[2] || 60);

function pickMove(g, noise, sloppy = false) {
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
      const clears = R.findClears(b).length;
      const s = sloppy
        ? (-clears * 1000 - contact * 4 + holes * 35 + noise())
        : (clears * 1000 + contact * 3 - holes * 25 + noise());
      if (s > best) { best = s; m = [k, r, c]; }
    }
  });
  return m;
}

function play(mode, diff, seed, cap) {
  let ns = seed; const noise = () => ((ns = (ns * 1103515245 + 12345) >>> 0) / 4294967296);
  const g = R.freshGame(mode);
  g.rng = 1000 + seed;
  g.diff = mode === 'daily' ? 'standard' : diff;
  R.setupGame(g, {});
  let n = 0, deadDeals = 0, boilMoves = 0;
  while (!g.over && n < cap) {
    const m = pickMove(g, noise, false);
    if (!m) break;
    const res = R.applyMove(g, m[0], m[1], m[2]);
    n++;
    if (g.heat >= 12) boilMoves++;
    if (res.newRound && !g.over && g.tray.filter(Boolean).some(t => !R.fitsAnywhere(g.board, t.id))) deadDeals++;
  }
  return {
    n,
    score: g.score,
    won: g.won,
    over: g.over,
    springs: g.springs,
    overshoot: mode === 'springs' && g.won && g.springs > 47,
    deadDeals,
    boiled: g.bestHeat >= 12,
    boilMoves,
  };
}

const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };

function summarize(mode, diff, runs) {
  const games = runs.length;
  const totalMoves = runs.reduce((a, r) => a + r.n, 0);
  const boilGames = runs.filter(r => r.boiled).length;
  const boilMoves = runs.reduce((a, r) => a + r.boilMoves, 0);
  return {
    mode,
    diff,
    games,
    moves: [q(runs.map(r => r.n), 0.1), q(runs.map(r => r.n), 0.5), q(runs.map(r => r.n), 0.9)],
    score: [q(runs.map(r => r.score), 0.1), q(runs.map(r => r.score), 0.5), q(runs.map(r => r.score), 0.9)],
    won: mode === 'springs' ? runs.filter(r => r.won).length : null,
    capped: runs.filter(r => !r.over).length,
    cramped: +(runs.reduce((a, r) => a + r.deadDeals, 0) / Math.max(1, games)).toFixed(2),
    boilGames,
    boilGamePct: +((boilGames * 100) / Math.max(1, games)).toFixed(1),
    boilMovePct: +((boilMoves * 100) / Math.max(1, totalMoves)).toFixed(2),
    overshootWins: mode === 'springs' ? runs.filter(r => r.overshoot).length : null,
  };
}

// Shared-date Daily Soak parity check: compares dealt trays for a disciplined (greedy) player vs. a messy player
// starting from the same seed across `dates` simulated dates for up to `rounds` rounds (CD-WF1-05 / W6-S3-03).
export function measureDailyParity(dates = 40, rounds = 20) {
  let diverged = 0;
  let firstRoundSum = 0;
  for (let i = 0; i < dates; i++) {
    const seed = 7 + i;
    const runSeq = (sloppy) => {
      let ns = seed + (sloppy ? 999 : 0);
      const noise = () => ((ns = (ns * 1103515245 + 12345) >>> 0) / 4294967296);
      const g = R.freshGame('daily');
      g.rng = 1000 + seed;
      g.diff = 'standard';
      R.setupGame(g, {});
      const trays = [g.tray.map(t => (t ? t.id : null)).join(',')];
      while (!g.over && g.round < rounds) {
        const m = pickMove(g, noise, sloppy);
        if (!m) break;
        const res = R.applyMove(g, m[0], m[1], m[2]);
        if (res.newRound) trays.push(g.tray.map(t => (t ? t.id : null)).join(','));
      }
      return trays;
    };
    const clean = runSeq(false), messy = runSeq(true);
    const len = Math.min(clean.length, messy.length);
    for (let r = 0; r < len; r++) {
      if (clean[r] !== messy[r]) { diverged++; firstRoundSum += r + 1; break; }
    }
  }
  return {
    dates,
    rounds,
    diverged,
    divergencePct: +((diverged * 100) / Math.max(1, dates)).toFixed(1),
    avgFirstRound: diverged ? +(firstRoundSum / diverged).toFixed(1) : null,
  };
}

export function measure(diffs = ['relaxed', 'standard', 'master'], games = N, { includeDaily = false } = {}) {
  const out = [];
  for (const mode of ['classic', 'springs']) for (const diff of diffs) {
    const runs = [];
    for (let i = 0; i < games; i++) runs.push(play(mode, diff, 7 + i, mode === 'classic' ? 1500 : 3000));
    out.push(summarize(mode, diff, runs));
  }
  if (includeDaily) {
    const runs = [];
    for (let i = 0; i < games; i++) runs.push(play('daily', 'standard', 7 + i, 1500));
    out.push(summarize('daily', 'standard', runs));
  }
  return out;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  for (const o of measure(['relaxed', 'standard', 'master'], N, { includeDaily: true })) {
    console.log(
      o.mode.padEnd(7),
      o.diff.padEnd(9),
      'moves p10/p50/p90', o.moves.join('/'),
      ' score p10/p50/p90', o.score.join('/'),
      o.won === null ? '' : ' won ' + o.won + '/' + o.games + ' (>47:' + o.overshootWins + ')',
      ' capped', o.capped,
      ' dead/g', o.cramped,
      ' boil', `${o.boilGames}/${o.games}(${o.boilGamePct}%)`,
      'boilMoves', `${o.boilMovePct}%`
    );
  }
  const parity = measureDailyParity(Math.min(N, 60), 20);
  console.log(
    'daily'.padEnd(7),
    'parity'.padEnd(9),
    `clean-vs-messy (${parity.dates} dates x ${parity.rounds} rounds): diverged ${parity.diverged}/${parity.dates} (${parity.divergencePct}%)` +
    (parity.avgFirstRound ? ` avg round ${parity.avgFirstRound}` : '')
  );
}
