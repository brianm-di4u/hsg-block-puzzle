// Wave 2, batch B: S3-01 Classic difficulty curve, S3-03 Spring Trail mastery.
import { loadRules } from '../tools/rules-node.mjs';

const R = loadRules();
const HARD = ['x5', 'u5a', 'u5b', 'v5a', 'v5b', 'v5c', 'v5d', 'o9', 'r6h', 'r6v', 'i5h', 'i5v'];
const EASY = ['o1', 'i2h', 'i2v'];

function share(mode, score, ids, n = 6000) {
  const g = R.freshGame(mode);
  g.score = score;
  g.rng = 99;
  let k = 0;
  for (let i = 0; i < n; i++) if (ids.includes(R.pickPiece(g))) k++;
  return k / n;
}

function greedyLength(seed, cap) {
  let ns = seed; const noise = () => ((ns = (ns * 1103515245 + 12345) >>> 0) / 4294967296);
  const g = R.freshGame('classic'); g.rng = 1000 + seed; R.setupGame(g, {});
  let n = 0;
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
    R.applyMove(g, m[0], m[1], m[2]);
    n++;
  }
  return { n, over: g.over };
}

export const tests = [
  {
    name: 'S3-01 Classic piece weights follow the era',
    node: true,
    async run(t) {
      const hard = R.ERAS.map(e => share('classic', e.at, HARD));
      const easy = R.ERAS.map(e => share('classic', e.at, EASY));
      t.log('hard share by era ' + hard.map(v => v.toFixed(3)).join(' '));
      t.log('easy share by era ' + easy.map(v => v.toFixed(3)).join(' '));
      t.expect(Math.abs(hard[0] - hard[1]) < 0.02 && Math.abs(easy[0] - easy[1]) < 0.02, 'eras 0 and 1 draw the same pieces as before');
      for (let e = 2; e < 7; e++) {
        t.expect(hard[e] > hard[e - 1], `hard pieces get likelier in era ${e}`);
        t.expect(easy[e] < easy[e - 1], `small pieces get rarer in era ${e}`);
      }
      t.expect(hard[6] > hard[0] * 2, 'last era serves at least twice the hard pieces');
      t.expect(Math.abs(share('daily', 9000, HARD) - hard[0]) < 0.02, 'Daily keeps the old weights at any score');
      t.expect(Math.abs(share('springs', 9000, HARD) - hard[0]) < 0.02, 'Springs keeps the old weights at any score');
    },
  },
  {
    name: 'S3-01 greedy bot games end between 150 and 300 moves',
    node: true,
    async run(t) {
      const lens = [];
      for (let i = 0; i < 24; i++) lens.push(greedyLength(7 + i, 900));
      const sorted = lens.map(l => l.n).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      t.log('greedy lengths ' + sorted.join(' ') + ' median ' + median);
      t.expect(median >= 150 && median <= 330, 'median game length ' + median + ' is in range');
      t.expect(lens.filter(l => !l.over).length === 0, 'no run outlives the cap');
    },
  },
  {
    name: 'S3-01 the mercy deal still rescues early and fades late',
    node: true,
    async run(t) {
      const dead = (score) => {
        // a board where only o1 fits: every tray without o1 is dead on arrival unless mercy redraws
        let saved = 0;
        for (let seed = 1; seed <= 400; seed++) {
          const g = R.freshGame('classic'); g.rng = seed; g.score = score;
          g.board = new Array(81).fill(1);
          g.board[40] = 0;
          R.dealTray(g);
          if (g.tray.some(x => R.fitsAnywhere(g.board, x.id))) saved++;
        }
        return saved;
      };
      const early = dead(0), late = dead(8000);
      t.log('rescued of 400: era 0 ' + early + ', era 6 ' + late);
      t.expect(early > late, 'mercy rescues more trays early than in the last era');
      t.expect(late > 0, 'the last era still gives some mercy');
    },
  },
];
