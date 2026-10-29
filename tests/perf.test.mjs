// M5: frame rate during clear effects, memory, load time, file size (AC31)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EMPTY = () => new Array(81).fill(0);

export const tests = [
  {
    name: 'performance',
    async run(t) {
      const bytes = fs.statSync(path.join(HERE, '..', 'index.html')).size;
      t.log('index.html ' + (bytes / 1024).toFixed(1) + ' KB; load ' + t.loadMs + ' ms');
      t.expect(bytes <= 2 * 1024 * 1024, 'file ≤ 2 MB');
      t.expect(t.loadMs <= 2000, 'interactive ≤ 2 s');
      const titleFps = await t.fps(1000);
      await t.seed(77);
      await t.game('newGame', { mode: 'springs' });
      await t.game('act', 'hideToast');
      const fpsList = [];
      for (let k = 0; k < 3; k++) {
        const b = EMPTY();
        for (let c = 0; c < 8; c++) for (const r of [0, 4, 8]) b[r * 9 + c] = 1 + ((c + r) % 6);
        for (let r = 0; r < 9; r++) if (![0, 4, 8].includes(r) && r !== 2) b[r * 9 + 8] = 2;
        b[2 * 9 + 3] = 8;
        await t.game('setState', { board: b, tray: [{ id: 'i5v' }, { id: 'o1' }, { id: 'o1' }], heat: 8 });
        await t.game('act', 'place', 1, 0, 8);
        fpsList.push(await t.fps(900));
      }
      const fps = Math.min(...fpsList);
      const mem = await t.memoryMB();
      t.log(`fps title ${titleFps}, during clears ${fpsList.join(' / ')}, heap ${mem} MB`);
      t.expect(fps >= 55, 'fps ≥ 55 during clear effects (' + fps + ')');
      t.expect(mem === null || mem < 40, 'heap < 40 MB (' + mem + ')');
      await t.waitForStable();
      await t.shot('70-perf');
    },
  },
  {
    name: 'soak: full games to the end',
    viewports: ['desktop'],
    async run(t) {
      // Greedy in-page player: prefers placements that clear. Plays Classic, Springs and Daily to game over.
      for (const [mode, seed] of [['classic', 101], ['springs', 202], ['daily', 0]]) {
        await t.seed(seed);
        await t.game('newGame', mode === 'daily' ? { mode, date: '2026-10-28' } : { mode });
        const res = await t.page.evaluate(() => {
          const G = window.__game, P = G.pieces();
          let moves = 0;
          while (moves < 1500) {
            const s = G.getState();
            if (s.over) break;
            let best = null;
            s.tray.forEach((tr, k) => {
              if (!tr) return;
              const p = P[tr.id];
              for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.wd; c++) {
                if (!p.cells.every(([dr, dc]) => !s.board[(r + dr) * 9 + c + dc])) continue;
                const b = s.board.slice(); for (const [dr, dc] of p.cells) b[(r + dr) * 9 + c + dc] = 1;
                let full = 0;
                for (let i = 0; i < 9; i++) {
                  if ([0, 1, 2, 3, 4, 5, 6, 7, 8].every(j => b[i * 9 + j])) full++;
                  if ([0, 1, 2, 3, 4, 5, 6, 7, 8].every(j => b[j * 9 + i])) full++;
                  if ([0, 1, 2, 3, 4, 5, 6, 7, 8].every(j => b[(Math.floor(i / 3) * 3 + Math.floor(j / 3)) * 9 + (i % 3) * 3 + j % 3])) full++;
                }
                // compactness: reward contact with walls/tiles, punish single-cell holes
                let contact = 0, holes = 0;
                for (const [dr, dc] of p.cells) for (const [a, d] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                  const rr = r + dr + a, cc = c + dc + d;
                  if (rr < 0 || rr > 8 || cc < 0 || cc > 8 || (b[rr * 9 + cc] && !p.cells.some(([x, y]) => x === dr + a && y === dc + d))) contact++;
                }
                for (let i = 0; i < 81; i++) if (!b[i]) {
                  const rr = Math.floor(i / 9), cc = i % 9;
                  if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, d]) => { const x = rr + a, y = cc + d; return x < 0 || x > 8 || y < 0 || y > 8 || b[x * 9 + y]; })) holes++;
                }
                const sc = full * 1000 + contact * 3 - holes * 25 + Math.random();
                if (!best || sc > best.sc) best = { sc, k, r, c };
              }
            });
            if (!best) break;
            G.act('place', best.k, best.r, best.c);
            moves++;
          }
          const s = G.getState();
          return { moves, over: s.over, won: s.won, score: s.score, era: s.eraId, groups: s.groups, springs: s.springs };
        });
        t.log(mode + ': ' + JSON.stringify(res));
        if (!res.over) { t.log(mode + ': still alive after 1500 moves'); continue; }
        await t.page.waitForFunction(() => ['over', 'win'].includes(window.__game.getState().scene), null, { timeout: 5000 }).catch(() => t.fail(mode + ': no end screen'));
      }
      await t.shot('71-soak-end');
    },
  },
];
