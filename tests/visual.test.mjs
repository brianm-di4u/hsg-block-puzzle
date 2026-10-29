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
      t.expect(ban && ban.text === 'Double!', 'Double! banner: ' + JSON.stringify(ban));
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
];
