// file:// is checked by tools/check-file-url.mjs (the harness blocks non-server URLs by design).
// Visual v2: painted/rendered assets, fallbacks, live water, combo feedback, layout scale (VISUAL-PLAN.md test plan)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.join(HERE, '..');
const EMPTY = () => new Array(81).fill(0);

async function clearBoard(t, rows, extra = {}) { // fill the given rows except column 8, then drop an i-piece down column 8
  await t.seed(9);
  await t.game('newGame', { mode: 'classic' });
  const b = EMPTY();
  for (const r of rows) for (let c = 0; c < 8; c++) b[r * 9 + c] = 1 + ((c + r) % 6);
  b[80] = 3;
  await t.game('setState', Object.assign({ board: b, tray: [{ id: rows.length >= 3 ? 'i3v' : 'i2v' }, { id: 'o1' }, { id: 'o4' }], score: 120, heat: 4 }, extra));
  await t.game('act', 'hideToast');
}

export const tests = [
  {
    name: 'art assets match the manifest and all load',
    async run(t) {
      const man = JSON.parse(fs.readFileSync(path.join(GAME, 'assets', 'manifest.json'), 'utf8'));
      const names = Object.keys(man).sort();
      let a = await t.game('act', 'art');
      t.equal([...a.files].sort(), names, 'ART_FILES lists exactly the packed assets');
      for (const n of names) t.expect(fs.existsSync(path.join(GAME, 'assets', n + '.webp')), 'asset on disk: ' + n);
      await t.game('act', 'loadAllArt');
      await t.page.waitForFunction(() => window.__game.isIdle(), null, { timeout: 15000 });
      a = await t.game('act', 'art');
      t.equal(a.failed, [], 'no asset failed to load');
      t.equal(a.loaded.length, names.length, 'every asset decoded');
      const bytes = names.reduce((n, k) => n + fs.statSync(path.join(GAME, 'assets', k + '.webp')).size, 0);
      t.log('assets ' + names.length + ' files, ' + (bytes / 1024 / 1024).toFixed(2) + ' MB');
      t.expect(bytes < 2.6 * 1024 * 1024, 'total asset download < 2.6 MB');
    },
  },
  {
    name: 'vector fallback with ?art=0',
    url: 'index.html?art=0',
    async run(t) {
      const a = await t.game('act', 'art');
      t.equal([a.on, a.loaded.length], [false, 0], 'no images requested');
      await clearBoard(t, [4, 5]);
      await t.shot('81-art-off');
      await t.checkLayout();
    },
  },
  {
    name: 'live water and its 2D fallback',
    url: 'index.html?gl=force', // the test browser has software WebGL only, which normally gets the still water
    async run(t) {
      await t.seed(4);
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'hideToast');
      await t.waitFrames(3); // WebGL starts on the first game frame
      const a = await t.game('act', 'art');
      t.log('webgl ' + a.gl + ' (software ' + a.software + '), live water ' + a.water);
      t.expect(a.gl, 'WebGL available in the test browser');
      t.equal(a.water, a.gl, 'live water on with WebGL (forced on software WebGL)');
      if (a.water) {
        const disp = await t.page.evaluate(() => getComputedStyle(document.getElementById('water')).display);
        t.equal(disp, 'block', 'water layer shown in play');
        const r = await t.page.evaluate(() => document.getElementById('water').getBoundingClientRect().toJSON());
        const L = await t.game('layout');
        t.expect(Math.abs(r.x - L.board.gx) < 1.5 && Math.abs(r.width - L.board.cell * 9) < 1.5, 'water layer sits exactly in the basin');
      }
      await t.game('act', 'setting', 'effects', 'lite');
      t.equal((await t.game('act', 'art')).water, false, 'lite effects turn the live water off');
      t.equal(await t.page.evaluate(() => getComputedStyle(document.getElementById('water')).display), 'none', 'water layer hidden');
      await t.shot('82-water-lite');
      await t.game('act', 'setting', 'effects', 'full');
      await t.game('scene', 'title');
      await t.waitFrames(2); // the frame loop hides the layer on its next frame, not inside scene()
      t.equal(await t.page.evaluate(() => getComputedStyle(document.getElementById('water')).display), 'none', 'no water layer on the title');
    },
  },
  {
    name: 'no WebGL with ?gl=0',
    url: 'index.html?gl=0',
    async run(t) {
      t.equal((await t.game('act', 'art')).gl, false, 'WebGL not used');
      await clearBoard(t, [4, 5]);
      const r = await t.game('act', 'place', 0, 4, 8);
      t.expect(r.G === 2, 'clear works without WebGL');
      await t.waitForStable();
      await t.shot('83-gl-off');
    },
  },
  {
    name: 'combo banner escalates',
    async run(t) {
      await clearBoard(t, [4, 5]);
      let r = await t.game('act', 'place', 0, 4, 8);
      t.equal(r.G, 2, 'two rows');
      let fx = await t.game('act', 'fxList');
      const ban = fx.find(f => f.type === 'banner');
      t.expect(ban && ban.text === 'Soak!', 'Soak! banner for two groups: ' + JSON.stringify(ban));
      const L = await t.game('layout');
      for (const p of fx.filter(f => f.type === 'popup')) {
        const half = p.text.length * p.size * 0.32;
        t.expect(p.x - half >= L.board.x - 2 && p.x + half <= L.board.x + L.board.size + 2, 'popup inside the board: ' + p.text);
      }
      await t.game('act', 'freezeFx', 260);
      await t.shot('84-combo-double');
      await t.game('act', 'unfreezeFx');
      await t.waitForStable();
      await clearBoard(t, [3, 4, 5], { heat: 11 });
      r = await t.game('act', 'place', 0, 3, 8);
      t.equal(r.G, 6, 'three rows and their three pools');
      fx = await t.game('act', 'fxList');
      const big = fx.find(f => f.type === 'banner');
      t.expect(big && big.text === 'Spring Surge!' && /Boiling/.test(big.sub) && big.level === 5, 'boiling surge banner: ' + JSON.stringify(big));
      await t.game('act', 'freezeFx', 320);
      await t.shot('85-combo-boiling');
      await t.game('act', 'unfreezeFx');
    },
  },
  {
    name: 'tray scale and canvas text size',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      const L = await t.game('layout');
      t.log('tray scale ' + (L.trayScale / L.board.cell).toFixed(2) + ' of a cell (' + L.trayScale.toFixed(1) + ' px)');
      t.expect(L.trayScale >= L.board.cell * (L.land ? 0.55 : 0.7), 'tray pieces are a readable fraction of a cell');
      for (const s of L.slots) t.expect(s.w >= (L.land ? 140 : 110) && s.h >= 100, 'tray slot ≥ 110×100');
      if (t.viewport === 'desktop') { // static check: canvas HUD text is never set below 12 px
        const src = fs.readFileSync(path.join(GAME, 'index.html'), 'utf8');
        const sizes = [...src.matchAll(/^\s+(?:if \([^)]*\) )?\{?\s*text\([^\n]*?,\s*[^,\n]+,\s*[^,\n]+,\s*(\d+(?:\.\d+)?)\s*,/gm)].map(m => +m[1]);
        t.expect(sizes.length >= 6 && Math.min(...sizes) >= 12, 'canvas text sizes ≥ 12 px: ' + Math.min(...sizes));
      }
    },
  },
  {
    name: 'new best ribbon',
    async run(t) {
      await t.seed(5);
      await t.game('newGame', { mode: 'classic' });
      const b = EMPTY();
      for (let i = 0; i < 81; i++) b[i] = ((Math.floor(i / 9) + i) % 2) ? 1 + (i % 6) : 0;
      await t.game('setState', { board: b, tray: [{ id: 'o9' }, null, null], score: 6400, era: 5 });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 5000 });
      const cls = await t.page.getAttribute('#ov-new', 'class');
      t.expect(/hit/.test(cls || ''), 'new best shows the ribbon');
      await t.shot('86-new-best');
    },
  },
  {
    name: 'W6-S6-04 WATER.resize() mid-shake clears transform and WATER.clear() zeroes stale ripples',
    url: 'index.html?gl=force',
    viewports: ['desktop'],
    async run(t) {
      await clearBoard(t, [4, 5]);
      await t.waitFrames(3);
      const r = await t.game('act', 'place', 0, 4, 8);
      t.equal(r.G, 2, 'two rows cleared');
      const mid = await t.page.evaluate(() => {
        // Ensure shake transform is active, then call WATER.resize() mid-shake.
        draw(performance.now() + 20);
        const ripplesBefore = WATER.ripples.length;
        WATER.resize();
        const w = document.getElementById('water');
        const rect = w.getBoundingClientRect();
        return { ripplesBefore, transform: w.style.transform, left: rect.left, gx: LAY.board.gx };
      });
      t.expect(mid.ripplesBefore > 0, 'clear spawned WebGL ripples');
      t.equal(mid.transform, '', 'WATER.resize() clears mid-shake DOM transform');
      t.expect(Math.abs(mid.left - mid.gx) < 1.5, 'water aligns to board.gx after mid-shake resize');
      // Starting a new game (e.g. Daily Soak) must zero all prior-game WebGL ripples.
      await t.game('newGame', { mode: 'daily', date: '2026-11-20' });
      t.equal((await t.game('act', 'art')).ripples, 0, 'newGame() clears stale WebGL ripples');
      // Undoing after a clear must also zero ripples.
      await clearBoard(t, [4, 5]);
      await t.game('act', 'place', 0, 4, 8);
      t.expect((await t.game('act', 'art')).ripples > 0, 'ripples present after clear');
      await t.game('act', 'undo');
      t.equal((await t.game('act', 'art')).ripples, 0, 'doUndo() clears stale WebGL ripples');
    },
  },
  {
    name: 'W6-S6-05 built-in contrastReport WCAG gate across Light and Dark screens',
    viewports: ['desktop'],
    async run(t) {
      // Activates run.mjs's built-in t.contrastReport({ fail: true }) in CI (Wave 2 W2-B03 expands with Warm Bathhouse Dark Mode).
      for (const theme of ['light', 'dark']) {
        await t.game('act', 'setting', 'theme', theme);
        await t.game('scene', 'title');
        const titleRep = await t.contrastReport({ fail: true, selector: '#sc-title .panel *', fallbackBg: [10, 24, 28] });
        t.expect(titleRep.checked > 0, `${theme} title panel checked (${titleRep.checked})`);
        for (const sc of ['settings', 'help', 'cards', 'records', 'trail']) {
          await t.game('scene', sc);
          const rep = await t.contrastReport({ fail: true, fallbackBg: [10, 24, 28] });
          t.expect(rep.checked > 0, `${theme} ${sc} checked (${rep.checked})`);
        }
      }
      await t.game('act', 'setting', 'theme', 'system');
    },
  },
  {
    name: 'W6-S4-01 pre-tile Boiling basin luminance L<=0.11 (WebGL + 2D) and Roaring/Boiling tile color parity',
    url: 'index.html?gl=force',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(11);
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'hideToast');
      await t.waitFrames(3);

      const measure = await t.page.evaluate(() => {
        const relLum = (r, g, b) => {
          const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
        };
        const sampleCvRect = (x, y, w, h) => {
          const d = ctx.getImageData(Math.round(x * DPR), Math.round(y * DPR), Math.max(1, Math.round(w * DPR)), Math.max(1, Math.round(h * DPR))).data;
          let r = 0, g = 0, b = 0, a = 0, n = d.length / 4;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; a += d[i + 3]; }
          return [r / n, g / n, b / n, a / (n * 255)];
        };
        const sampleWaterCenter = () => {
          const gl = WATER.gl, sz = WATER.size;
          const bw = 24, bh = 24, px = new Uint8Array(bw * bh * 4);
          WATER.draw(performance.now());
          gl.readPixels(Math.floor(sz / 2 - bw / 2), Math.floor(sz / 2 - bh / 2), bw, bh, gl.RGBA, gl.UNSIGNED_BYTE, px);
          let r = 0, g = 0, b = 0, n = bw * bh;
          for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
          return [r / n, g / n, b / n];
        };

        // 1. Empty board at 143°F Boiling in WebGL mode: composite #cv over #water at center empty cell (4,4).
        S.board = new Array(81).fill(0);
        S.heat = 12; S.era = 3; S.score = 1200;
        FX.length = 0; WATER.clear(); dirty = true;
        draw(performance.now());
        const b = LAY.board, c = b.cell;
        const wRgb = sampleWaterCenter();
        const cvBoiling = sampleCvRect(b.gx + 4.25 * c, b.gy + 4.25 * c, c * 0.5, c * 0.5);
        const compGl = [0, 1, 2].map(i => cvBoiling[i] * cvBoiling[3] + wRgb[i] * (1 - cvBoiling[3]));
        const lumGlBoiling = relLum(...compGl);

        // 2. Empty board at 143°F Boiling in 2D still fallback (effects='lite').
        SAVE.settings.effects = 'lite'; WATER.refresh(); boardKey = ''; dirty = true;
        draw(performance.now());
        const cv2d = sampleCvRect(b.gx + 4.25 * c, b.gy + 4.25 * c, c * 0.5, c * 0.5);
        const lum2dBoiling = relLum(cv2d[0], cv2d[1], cv2d[2]);
        SAVE.settings.effects = 'full'; WATER.refresh(); boardKey = '';

        // 3. Tile color parity: same placed tiles at (4,4) and (4,5) in Cool Ancient vs Boiling Roaring, plus board vs tray.
        const o1Col = PIECES.o1.color;
        S.board = new Array(81).fill(0);
        S.board[4 * 9 + 4] = o1Col; S.board[4 * 9 + 5] = 5;
        S.tray = [{ id: 'o1' }, { id: 'o1' }, null];
        S.heat = 0; S.era = 0; S.score = 0; dirty = true; draw(performance.now());
        const coolT2 = sampleCvRect(b.gx + 4.32 * c, b.gy + 4.32 * c, c * 0.36, c * 0.36);
        const coolT5 = sampleCvRect(b.gx + 5.32 * c, b.gy + 4.32 * c, c * 0.36, c * 0.36);

        S.heat = 12; S.era = 3; S.score = 1200; dirty = true; draw(performance.now());
        const boilT2 = sampleCvRect(b.gx + 4.32 * c, b.gy + 4.32 * c, c * 0.36, c * 0.36);
        const boilT5 = sampleCvRect(b.gx + 5.32 * c, b.gy + 4.32 * c, c * 0.36, c * 0.36);
        const g0 = slotPieceGeom(0, 0);
        const trayT2 = sampleCvRect(g0.x + g0.s * 0.32, g0.y + g0.s * 0.32, g0.s * 0.36, g0.s * 0.36);

        const maxDiff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
        return {
          lumGlBoiling,
          lum2dBoiling,
          deltaT2: maxDiff(coolT2, boilT2),
          deltaT5: maxDiff(coolT5, boilT5),
          deltaBoardTray: maxDiff(boilT2, trayT2),
        };
      });
      t.log('Boiling luminance: WebGL=' + measure.lumGlBoiling.toFixed(4) + ', 2D=' + measure.lum2dBoiling.toFixed(4) + ', tileDeltas=' + JSON.stringify([measure.deltaT2, measure.deltaT5, measure.deltaBoardTray].map(v => +v.toFixed(2))));
      t.expect(measure.lumGlBoiling <= 0.11, 'WebGL Boiling empty water L <= 0.11 (' + measure.lumGlBoiling.toFixed(4) + ')');
      t.expect(measure.lum2dBoiling <= 0.11, '2D still Boiling empty water L <= 0.11 (' + measure.lum2dBoiling.toFixed(4) + ')');
      t.expect(measure.deltaT2 <= 2, 'Teal tile zero post-tile wash Cool vs Boiling Roaring (' + measure.deltaT2.toFixed(2) + ')');
      t.expect(measure.deltaT5 <= 2, 'Cream Marble tile zero post-tile wash Cool vs Boiling Roaring (' + measure.deltaT5.toFixed(2) + ')');
      t.expect(measure.deltaBoardTray <= 4, 'Board tile matches tray tile in Boiling Roaring (' + measure.deltaBoardTray.toFixed(2) + ')');
    },
  },
  {
    name: 'W6-S4-02 W6-S4-04 W6-S4-05 rim clip, BOARD_PAD & era frame, wispy steam, brass vent collar, ERA_CROP',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'hideToast');
      await t.waitFrames(2);

      const res = await t.page.evaluate(() => {
        const b = LAY.board, c = b.cell;
        // 1. Rim clip: sample brass rim immediately right & below cell (8,8) empty vs tile-5 & tile-7 placed.
        const sampleRim = () => {
          const rx = Math.round((b.gx + 9 * c + 2) * DPR), ry = Math.round((b.gy + 8.5 * c) * DPR);
          const bx = Math.round((b.gx + 8.5 * c) * DPR), by = Math.round((b.gy + 9 * c + 2) * DPR);
          const rPx = [...ctx.getImageData(rx, ry, 4, 4).data];
          const bPx = [...ctx.getImageData(bx, by, 4, 4).data];
          return rPx.concat(bPx);
        };
        S.board = new Array(81).fill(0); S.heat = 0; S.era = 0; dirty = true; draw(performance.now());
        const emptyRim = sampleRim();
        S.board[80] = 5; dirty = true; draw(performance.now());
        const t5Rim = sampleRim();
        S.board[80] = 7; dirty = true; draw(performance.now());
        const t7Rim = sampleRim();
        let rimDelta5 = 0, rimDelta7 = 0;
        for (let i = 0; i < emptyRim.length; i++) {
          rimDelta5 = Math.max(rimDelta5, Math.abs(emptyRim[i] - t5Rim[i]));
          rimDelta7 = Math.max(rimDelta7, Math.abs(emptyRim[i] - t7Rim[i]));
        }

        // 2. Era-keyed boardCache frame patina (gilded vs roaring) and BOARD_PAD >= 34.
        S.era = 2; ensureBoard();
        const fCtx = boardCache.getContext('2d');
        const fpX = Math.round((BOARD_PAD + b.frame * 0.45) * DPR), fpY = Math.round((BOARD_PAD + b.size * 0.25) * DPR);
        const gildedFrame = [...fCtx.getImageData(fpX, fpY, 6, 6).data];
        S.era = 3; ensureBoard();
        const roaringFrame = [...fCtx.getImageData(fpX, fpY, 6, 6).data];
        let frameDiff = 0;
        for (let i = 0; i < gildedFrame.length; i += 4) {
          frameDiff += Math.abs(gildedFrame[i] - roaringFrame[i]) + Math.abs(gildedFrame[i + 1] - roaringFrame[i + 1]) + Math.abs(gildedFrame[i + 2] - roaringFrame[i + 2]);
        }
        frameDiff /= (gildedFrame.length / 4);

        // 3. Wispy steam sprite peak alpha <= 0.35 * 255 (90).
        const st = getSteamSprite(), stData = st.getContext('2d').getImageData(0, 0, st.width, st.height).data;
        let steamMaxAlpha = 0;
        for (let i = 3; i < stData.length; i += 4) if (stData[i] > steamMaxAlpha) steamMaxAlpha = stData[i];

        // 4. Brass Vent collar vs Tufa Stone sprite pixel distinction + spriteCache cap <= 22.
        const spSize = spriteSize(c);
        const sp7 = tileSprite(7, spSize, 0), sp8 = tileSprite(8, spSize, 0);
        for (let code = 1; code <= 6; code++) tileSprite(code, spSize, 0);
        for (let v = 0; v < 4; v++) tileSprite(7, spSize, v);
        const d7 = sp7.c.getContext('2d').getImageData(0, 0, sp7.c.width, sp7.c.height).data;
        const d8 = sp8.c.getContext('2d').getImageData(0, 0, sp8.c.width, sp8.c.height).data;
        let brassPixels = 0, ventDiff = 0;
        for (let i = 0; i < d8.length; i += 4) {
          if (d8[i + 3] > 180 && d8[i] > 150 && d8[i + 1] > 115 && d8[i] - d8[i + 2] > 55) brassPixels++;
          ventDiff += Math.abs(d8[i] - d7[i]) + Math.abs(d8[i + 1] - d7[i + 1]) + Math.abs(d8[i + 2] - d7[i + 2]);
        }
        ventDiff /= (d8.length / 4);

        // 5. ERA_FX.roaring gold+emerald (no magenta) & ERA_CROP coverage + portrait zoom <= 1.15.
        const cropKeys = ['title', ...ERAS.map(e => e.id)];
        const missingCrops = cropKeys.filter(k => !ERA_CROP[k]);
        const maxPortraitZoom = Math.max(...cropKeys.map(k => ERA_CROP[k] ? ERA_CROP[k].port[2] : 99));
        const spireAnchorOk = ['midcentury', 'revival', 'modern'].every(k => ERA_CROP[k].land[1] <= 0.12);

        // 6. fillOver applies ERA_CROP.hero to #ov-hero.
        S.era = 4; fillOver();
        const heroPos = document.getElementById('ov-hero').style.backgroundPosition;

        return {
          boardPad: BOARD_PAD,
          rimDelta5, rimDelta7,
          frameDiff,
          steamMaxAlpha,
          brassPixels, ventDiff,
          spriteCount: spriteCache.size,
          roaringFx: ERA_FX.roaring,
          missingCrops, maxPortraitZoom, spireAnchorOk, heroPos,
        };
      });

      t.expect(res.boardPad >= 34, 'BOARD_PAD >= 34 (' + res.boardPad + ')');
      t.equal(res.rimDelta5, 0, 'tile-5 at (8,8) has zero shadow bleed onto brass rim');
      t.equal(res.rimDelta7, 0, 'tile-7 at (8,8) has zero shadow bleed onto brass rim');
      t.expect(res.frameDiff >= 8, 'era-keyed frame patina differs between Gilded Spa and Roaring (' + res.frameDiff.toFixed(1) + ')');
      t.expect(res.steamMaxAlpha > 15 && res.steamMaxAlpha <= Math.round(0.35 * 255), 'steam sprite peak alpha wispy <= 0.35 (' + res.steamMaxAlpha + '/255)');
      t.expect(res.brassPixels >= 20 && res.ventDiff >= 20, 'Spring Vent has distinct brass drain collar vs Tufa (' + res.brassPixels + ' brass px, diff ' + res.ventDiff.toFixed(1) + ')');
      t.expect(res.spriteCount <= 22, '4 un-rotated Tufa variants + glazes + vent keep spriteCache <= 22 (' + res.spriteCount + ')');
      t.expect(res.roaringFx.flicker === true && !/255,\s*80|240,\s*100|220,\s*70/.test(res.roaringFx.beam), 'Roaring FX uses gold+emerald with flicker: ' + JSON.stringify(res.roaringFx));
      t.equal(res.missingCrops, [], 'ERA_CROP covers title and all 7 eras');
      t.expect(res.maxPortraitZoom <= 1.15, 'ERA_CROP portrait zoom <= 1.15 (' + res.maxPortraitZoom + ')');
      t.expect(res.spireAnchorOk, 'Mid-Century/Revival/Modern desktop crops anchor upper spire (fy <= 0.12)');
      t.expect(res.heroPos && res.heroPos.length > 0, 'fillOver applies ERA_CROP.hero (' + res.heroPos + ')');
    },
  },
  {
    name: 'W6-S4-03 dark bathhouse-glass dual notification channels, Channel 1 serialization, zero overlap & lay-land sync',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      const check = await t.page.evaluate(() => {
        const hit = (a, b) => a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        // Confirm :root.lay-land syncs with LAY.land (CD-WF2-07)
        const layLandSynced = document.documentElement.classList.contains('lay-land') === !!LAY.land;
        // Show Channel 2 (#tip) + Channel 1 (#achtoast) simultaneously, and try firing a Channel 1 #toast while #achtoast is active.
        tipShow('goal');
        SAVE.ach['first-soak'] = null; delete SAVE.ach['first-soak'];
        earn('first-soak');
        const achOn1 = document.getElementById('achtoast').classList.contains('on');
        toast('Era preview', 'Queued behind goal toast on Channel 1.', 4000);
        const toastQueuedWhileAch = !document.getElementById('toast').classList.contains('on');

        const achEl = document.getElementById('achtoast');
        const tipEl = document.getElementById('tip');
        const toastEl = document.getElementById('toast');
        const achCs = getComputedStyle(achEl), tipCs = getComputedStyle(tipEl), tipBefore = getComputedStyle(tipEl, '::before');
        const achR = achEl.getBoundingClientRect().toJSON();
        const tipR = tipEl.getBoundingClientRect().toJSON();
        const slotsOverlapTip = LAY.slots.some(s => hit(tipR, { left: s.x, top: s.y, right: s.x + s.w, bottom: s.y + s.h, width: s.w, height: s.h }));
        const ch1Ch2Overlap = hit(achR, tipR);

        // Clearing #achtoast via clearGoalToasts() should cleanly hand Channel 1 to the queued toast, and leaving scene clears both.
        clearGoalToasts();
        const toastFlushed = toastEl.classList.contains('on') && !achEl.classList.contains('on');
        const toastCs = getComputedStyle(toastEl);
        // Reverse direction: #toast active -> earn() yields #toast cleanly (never both .on simultaneously), then replays after clear.
        delete SAVE.ach['four-at-once'];
        earn('four-at-once');
        const achPreemptedCleanly = achEl.classList.contains('on') && !toastEl.classList.contains('on');
        clearGoalToasts();
        const toastReplayedAfterPreempt = toastEl.classList.contains('on') && !achEl.classList.contains('on');
        showScene('pause');
        const clearedOnPause = !toastEl.classList.contains('on') && !achEl.classList.contains('on');
        showScene('game');

        return {
          layLandSynced,
          achOn1,
          toastQueuedWhileAch,
          toastFlushed,
          achPreemptedCleanly,
          toastReplayedAfterPreempt,
          clearedOnPause,
          achZ: achCs.zIndex,
          achBg: achCs.backgroundColor,
          tipBg: tipCs.backgroundColor,
          toastBg: toastCs.backgroundColor,
          tipBeforeContent: tipBefore.content,
          ch1Ch2Overlap,
          slotsOverlapTip,
        };
      });
      t.equal(check.layLandSynced, true, ':root.lay-land synced with LAY.land');
      t.equal(check.achOn1, true, '#achtoast opens on Channel 1');
      t.equal(check.toastQueuedWhileAch, true, '#toast queues behind active #achtoast (zero Channel 1 overlap)');
      t.equal(check.toastFlushed, true, 'queued #toast flushes cleanly after #achtoast clears');
      t.equal(check.achPreemptedCleanly, true, '#achtoast yields active #toast cleanly (never both .on simultaneously)');
      t.equal(check.toastReplayedAfterPreempt, true, 'yielded #toast replays cleanly after #achtoast clears');
      t.equal(check.clearedOnPause, true, 'leaving game scene clears Channel 1 notifications');
      t.equal(check.achZ, '9', '#achtoast z-index is 9 (< modal z-index 10)');
      t.expect(/rgba?\(8,\s*24,\s*28/.test(check.achBg) && /rgba?\(8,\s*24,\s*28/.test(check.tipBg) && /rgba?\(8,\s*24,\s*28/.test(check.toastBg), 'notifications use dark bathhouse glass: ' + JSON.stringify([check.achBg, check.tipBg, check.toastBg]));
      t.equal(check.tipBeforeContent, 'none', '#tip has no static CSS ::before arrow');
      t.equal(check.ch1Ch2Overlap, false, 'Channel 1 and Channel 2 have 0 px² overlap');
      t.equal(check.slotsOverlapTip, false, '#tip never overlaps tray slots');
    },
  },
];
