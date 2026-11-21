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
      await t.waitForStable();
      await t.waitFrames(3);
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
  {
    name: 'W6-S6-01 4x-CPU mobile frame budget (<10 ms), 0 mid-clear/drag sprite allocs (<=22), 64 KB beadGlow & water cap',
    async run(t) {
      await t.seed(77);
      await t.game('newGame', { mode: 'springs' });
      await t.game('act', 'hideToast');
      await t.waitForStable();
      await t.waitFrames(4);

      const bootPerf = await t.game('act', 'perf');
      t.log(`boot perf: ${JSON.stringify(bootPerf)}`);
      t.expect(bootPerf.spriteCount >= 16 && bootPerf.spriteCount <= 22, `post-boot spriteCache in [16, 22] (got ${bootPerf.spriteCount})`);
      t.expect(bootPerf.beadGlowBytes > 0 && bootPerf.beadGlowBytes <= 65536, `9-slice beadGlow <= 64 KB (got ${bootPerf.beadGlowBytes} B, ${bootPerf.beadGlowDims.join('x')})`);
      const waterCap = t.viewport === 'mobile' ? 512 : 640;
      t.expect(bootPerf.waterSize <= waterCap, `#water backing store <= ${waterCap}px on ${t.viewport} (got ${bootPerf.waterSize}px)`);

      const unthrottled = await t.frameCost(600);
      t.expect(unthrottled.frames > 0 && Number.isFinite(unthrottled.taskMs), 'unthrottled frameCost valid');
      t.expect(unthrottled.taskMs < 16.67, `unthrottled taskMs < 16.67 ms (${unthrottled.taskMs} ms)`);

      // Prepare heavy 3-row + 1-col + vent clear under 4x mobile CPU throttle
      const b = EMPTY();
      for (let c = 0; c < 8; c++) for (const r of [0, 4, 8]) b[r * 9 + c] = 1 + ((c + r) % 6);
      for (let r = 0; r < 9; r++) if (![0, 4, 8].includes(r) && r !== 2) b[r * 9 + 8] = 2;
      b[2 * 9 + 3] = 8;
      // Add Tufa stones too so all 4 un-rotated Tufa variants are exercised
      b[1 * 9 + 1] = 7; b[1 * 9 + 2] = 7; b[1 * 9 + 3] = 7; b[1 * 9 + 4] = 7;
      await t.game('setState', { board: b, tray: [{ id: 'i5v' }, { id: 'o1' }, { id: 'o9' }], heat: 12 });
      await t.waitFrames(2);

      let clearCost = null, dragCost = null;
      const beforeClear = await t.game('act', 'perf');
      try {
        await t.cpuThrottle(4);
        await t.game('act', 'place', 1, 0, 8);
        clearCost = await t.frameCost(800);
        const afterClear = await t.game('act', 'perf');
        t.log(`4x-cpu 3-row clear: ${JSON.stringify(clearCost)}, spriteAllocs +${afterClear.spriteAllocs - beforeClear.spriteAllocs}, sprites=${afterClear.spriteCount}`);
        t.expect(clearCost.frames > 0 && Number.isFinite(clearCost.taskMs), '4x-cpu clear frameCost valid');
        t.expect(clearCost.taskMs < 10, `4x-cpu 3-row clear taskMs < 10 ms (got ${clearCost.taskMs} ms)`);
        t.equal(afterClear.spriteAllocs - beforeClear.spriteAllocs, 0, '0 mid-clear offscreen canvas allocations');
        t.expect(afterClear.spriteCount <= 22, `spriteCache <= 22 after clear (${afterClear.spriteCount})`);

        // Active o9 (9-cell) drag across board under 4x CPU throttle (verifies blur-free silhouette drag shadow)
        await t.page.evaluate(() => {
          const b0 = LAY.board;
          UI.drag = { slot: 2, x: b0.gx + b0.cell * 4.5, y: b0.gy + b0.cell * 4.5, sx: 0, sy: 0, moved: true, touch: false, id: 1, t1: performance.now() - 200 };
          UI.ghost = dragGhost(UI.drag);
          dirty = true;
        });
        const beforeDrag = await t.game('act', 'perf');
        // Sweep pointer position smoothly during measurement window
        const dragSweep = t.page.evaluate(() => new Promise(res => {
          const b0 = LAY.board, start = performance.now();
          const step = now => {
            const p = (now - start) / 700;
            if (p >= 1 || !UI.drag) { res(); return; }
            UI.drag.x = b0.gx + b0.cell * (2 + 5 * (0.5 + 0.5 * Math.sin(p * Math.PI * 2)));
            UI.drag.y = b0.gy + b0.cell * (2 + 5 * (0.5 + 0.5 * Math.cos(p * Math.PI * 2)));
            UI.ghost = dragGhost(UI.drag);
            dirty = true;
            requestAnimationFrame(step);
          };
          requestAnimationFrame(step);
        }));
        [dragCost] = await Promise.all([t.frameCost(700), dragSweep]);
        const afterDrag = await t.game('act', 'perf');
        await t.page.evaluate(() => cancelDrag({ animate: false }));
        t.log(`4x-cpu o9 drag: ${JSON.stringify(dragCost)}, spriteAllocs +${afterDrag.spriteAllocs - beforeDrag.spriteAllocs}`);
        t.expect(dragCost.frames > 0 && Number.isFinite(dragCost.taskMs), '4x-cpu o9 drag frameCost valid');
        t.expect(dragCost.taskMs < 10, `4x-cpu o9 drag taskMs < 10 ms (got ${dragCost.taskMs} ms)`);
        t.equal(afterDrag.spriteAllocs - beforeDrag.spriteAllocs, 0, '0 mid-drag offscreen canvas allocations');
        t.expect(afterDrag.spriteCount <= 22, `spriteCache <= 22 after drag (${afterDrag.spriteCount})`);
      } finally {
        await t.cpuThrottle(1);
      }
    },
  },
  {
    name: 'W6-S6-01 VRAM <=2 LRU backdrops, 0 modal/idle GPU draws, slider zero-thrash, MAX_FX=180, reversible autoLite & rv>1 write-lock',
    url: 'index.html?gl=force',
    async run(t) {
      await t.seed(19);
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'hideToast');
      await t.waitForStable();
      await t.waitFrames(3);

      // 1. <=2 LRU resident decoded backdrops across all 7 eras AND after loadAllArt
      for (let era = 0; era < 7; era++) {
        await t.game('setState', { era });
        await t.waitFrames(2);
        await t.page.waitForFunction(() => window.__game.isIdle(), null, { timeout: 10000 });
        const p = await t.game('act', 'perf');
        t.expect(p.residentBackdropCount <= 2, `era ${era}: resident backdrops <= 2 (got ${p.residentBackdropCount}: ${p.residentBackdrops.join(',')})`);
      }
      await t.game('act', 'loadAllArt');
      await t.page.waitForFunction(() => window.__game.isIdle(), null, { timeout: 15000 });
      const artAll = await t.game('act', 'art');
      t.equal(artAll.loaded.length, artAll.files.length, 'loadAllArt still decodes & verifies all 16 assets');
      t.expect(artAll.residentBackdropCount <= 2, `post-loadAllArt resident backdrops <= 2 (got ${artAll.residentBackdropCount})`);

      // 2. Modal freeze (0 GPU/2D draws behind Pause, Settings, Help, Cards, Records, Trail, Over, Win) & Volume slider zero-thrash
      const b = EMPTY(); b[40] = 8;
      await t.game('setState', { board: b, heat: 12, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }] });
      await t.waitFrames(3);
      await t.game('act', 'pause');
      await t.waitFrames(3);
      const pPause0 = await t.game('act', 'perf');
      await t.page.waitForTimeout(300);
      const pPause1 = await t.game('act', 'perf');
      t.equal(pPause1.draws - pPause0.draws, 0, '0 2D draws behind Pause modal');
      t.equal(pPause1.waterDraws - pPause0.waterDraws, 0, '0 WebGL draws behind Pause modal');

      // Pause -> Settings: drag Volume slider 16 times -> 0 #cv reallocs, 0 spriteCache wipes/allocs, 0 modal redraws
      await t.game('scene', 'settings');
      await t.waitFrames(3);
      const pSet0 = await t.game('act', 'perf');
      await t.page.evaluate(() => {
        const el = document.getElementById('s-volume');
        for (let k = 0; k < 16; k++) {
          el.value = String((k * 7) % 101);
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      await t.page.waitForTimeout(300);
      const pSet1 = await t.game('act', 'perf');
      t.equal(pSet1.canvasReallocs - pSet0.canvasReallocs, 0, '0 #cv reallocations while dragging Volume slider 16x');
      t.equal(pSet1.spriteAllocs - pSet0.spriteAllocs, 0, '0 spriteCache reallocations while dragging Volume slider 16x');
      t.expect(pSet1.spriteCount >= 16 && pSet1.spriteCount <= 22, `spriteCache intact after Volume slider (${pSet1.spriteCount})`);
      t.equal(pSet1.draws - pSet0.draws, 0, '0 2D draws behind Settings modal during Volume drag');
      t.equal(pSet1.waterDraws - pSet0.waterDraws, 0, '0 WebGL draws behind Settings modal during Volume drag');

      // Verify 0 draws behind Help, Cards, Records, Trail, Over, and Win
      for (const sc of ['help', 'cards', 'records', 'trail', 'over']) {
        await t.game('scene', sc);
        await t.waitFrames(3);
        const a0 = await t.game('act', 'perf');
        await t.page.waitForTimeout(220);
        const a1 = await t.game('act', 'perf');
        t.equal(a1.draws - a0.draws, 0, `0 2D draws behind ${sc} modal`);
        t.equal(a1.waterDraws - a0.waterDraws, 0, `0 WebGL draws behind ${sc} modal`);
      }

      // 3. Uniform 30s idle sleep across Title, Boiling Classic, and Springs vents
      await t.game('scene', 'title');
      await t.page.evaluate(() => { UI.lastInput = performance.now() - 31000; });
      await t.waitFrames(3);
      const ti0 = await t.game('act', 'perf');
      await t.page.waitForTimeout(250);
      const ti1 = await t.game('act', 'perf');
      t.equal(ti1.draws - ti0.draws, 0, '0 2D draws on Title after 30s idle');

      await t.game('newGame', { mode: 'springs' });
      await t.game('setState', { board: b, heat: 12, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }] });
      await t.page.evaluate(() => { UI.lastInput = performance.now() - 31000; });
      await t.waitFrames(3);
      const gi0 = await t.game('act', 'perf');
      await t.page.waitForTimeout(250);
      const gi1 = await t.game('act', 'perf');
      t.equal(gi1.draws - gi0.draws, 0, '0 2D draws on Springs/Boiling board after 30s idle');
      t.equal(gi1.waterDraws - gi0.waterDraws, 0, '0 WebGL draws on Springs/Boiling board after 30s idle');

      // 4. MAX_FX = 180 cap with tertiary-only eviction preserving primary feedback & >=36 winSteam() puffs
      const fxCheck = await t.page.evaluate(() => {
        FX.length = 0;
        addFx({ type: 'flash', cells: [{ i: 0, code: 1 }], dur: 2000 });
        addFx({ type: 'banner', text: 'Cascade!', sub: '4 groups', level: 4, dur: 2000 });
        for (let k = 0; k < 220; k++) {
          addFx({ type: k % 3 === 0 ? 'steam' : k % 3 === 1 ? 'drop' : 'shard', code: 1, x: 100, y: 100, vx: 1, vy: -1, r: 2, s: 6, rot: 0, vr: 1, h: 40, w: 20, ph: 0, dur: 2000 });
        }
        const afterFloodLen = FX.length;
        const primaryKept = FX.some(f => f.type === 'flash') && FX.some(f => f.type === 'banner');
        winSteam();
        const afterWinLen = FX.length;
        const winSteamCount = FX.filter(f => f.type === 'steam' && f.keep).length;
        const valleyKept = FX.some(f => f.type === 'popup' && f.text === 'Valley of Vapors');
        FX.length = 0;
        return { afterFloodLen, primaryKept, afterWinLen, winSteamCount, valleyKept, maxFx: MAX_FX };
      });
      t.equal(fxCheck.maxFx, 180, 'MAX_FX locked at 180 (CD-WF6-05)');
      t.expect(fxCheck.afterFloodLen <= 180 && fxCheck.afterWinLen <= 180, `FX[] capped <= 180 (${fxCheck.afterFloodLen} / ${fxCheck.afterWinLen})`);
      t.expect(fxCheck.primaryKept, 'primary flash & banner survive tertiary particle flood');
      t.expect(fxCheck.winSteamCount >= 36 && fxCheck.valleyKept, `winSteam preserves >=36 floor puffs & Valley of Vapors (${fxCheck.winSteamCount})`);

      // 5. Reversible PERF.autoLite: requires 2 consecutive slow 60-frame windows (>38 ms), resets on Effects: Full
      const autoLiteCheck = await t.page.evaluate(() => {
        FX.length = 0;
        addFx({ type: 'flash', cells: [{ i: 0, code: 1 }], dur: 10000 });
        PERF.autoLite = false; resetPerfWatch();
        let clk = performance.now() + 1000;
        lastFrame = clk;
        const feed = (frames, dt) => { for (let i = 0; i < frames; i++) { clk += dt; watchFrame(clk); } };
        feed(60, 45); // window 1 slow -> should NOT latch yet
        const after1 = { autoLite: PERF.autoLite, slow: PERF.slowWindows };
        feed(60, 16); // healthy window -> resets slowWindows to 0
        const afterGood = { autoLite: PERF.autoLite, slow: PERF.slowWindows };
        feed(60, 45); // consecutive slow window 1
        feed(60, 45); // consecutive slow window 2 -> latches
        const after2 = { autoLite: PERF.autoLite, slow: PERF.slowWindows };
        setSetting('effects', 'full'); // immediately resets autoLite
        const afterReset = { autoLite: PERF.autoLite, slow: PERF.slowWindows };
        FX.length = 0;
        return { after1, afterGood, after2, afterReset };
      });
      t.equal(autoLiteCheck.after1, { autoLite: false, slow: 1 }, '1 slow 60-frame window does not latch autoLite');
      t.equal(autoLiteCheck.afterGood, { autoLite: false, slow: 0 }, 'healthy window resets slowWindows counter');
      t.equal(autoLiteCheck.after2.autoLite, true, '2 consecutive slow 60-frame windows (>38 ms) latch autoLite');
      t.equal(autoLiteCheck.afterReset, { autoLite: false, slow: 0 }, 'Effects: Full immediately resets PERF.autoLite');

      // 6. rv > 1 persist() write-lock verification (CD-WF6-02 / wf-6/CONTRACT.md Section 6)
      if (t.viewport === 'desktop') {
        const sentinel = JSON.stringify({ v: 1, settings: { sound: true, volume: 0.7, motion: 'system', patterns: true, undo: 1, difficulty: 'standard', bigText: false, theme: 'system', effects: 'full', traySide: 'right', tapPlace: false, haptics: true, sfx: true, music: true, musicVol: 0.5, ambience: true, ambVol: 0.5, tipsSeen: true } });
        await t.page.evaluate(([s]) => {
          localStorage.setItem('hs-thermal-blocks-v1', s);
          localStorage.setItem('hs-thermal-blocks-v1-run', JSON.stringify({ rv: 2, daily: { rev: 1, state: {} } }));
        }, [sentinel]);
        await t.reload();
        await t.waitFrames(3);
        const lockCheck = await t.page.evaluate(() => {
          const locked = savesLocked();
          window.__game.act('setting', 'sound', false);
          return { locked, raw: localStorage.getItem('hs-thermal-blocks-v1') };
        });
        t.equal(lockCheck.locked, true, 'rv > 1 RUN_KEY engages unified savesLocked()');
        t.equal(lockCheck.raw, sentinel, 'persist() does not overwrite v:1 STORE_KEY when RUN_KEY has rv > 1');
      }
    },
  },
];
