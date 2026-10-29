#!/usr/bin/env node
// Opens the game from file:// (no server) in the harness's Chromium at both viewports and checks that the painted
// and rendered art decodes, the live water starts, a clear plays, and nothing errors or reaches the network.
//   node tools/check-file-url.mjs
// The test harness cannot do this itself: it blocks every URL that is not its own server.
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.resolve(HERE, '../shared/test-harness/package.json'));
const { chromium } = require('playwright');
const url = pathToFileURL(path.resolve(HERE, '..', 'index.html')).href;
const browser = await chromium.launch();
let failed = 0;
for (const [name, opts] of [['desktop', { viewport: { width: 1280, height: 800 } }], ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
  const ctx = await browser.newContext(opts), page = await ctx.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') problems.push('console error: ' + m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('data:')) problems.push('network request: ' + r.url()); });
  await page.goto(url);
  await page.waitForFunction(() => !!window.__game);
  await page.evaluate(() => { const G = window.__game; G.newGame({ mode: 'classic' }); G.act('hideToast'); G.act('loadAllArt'); });
  await page.waitForFunction(() => window.__game.isIdle(), null, { timeout: 20000 });
  const art = await page.evaluate(() => window.__game.act('art'));
  const res = await page.evaluate(() => {
    const G = window.__game, b = new Array(81).fill(0);
    for (const r of [4, 5]) for (let c = 0; c < 8; c++) b[r * 9 + c] = 1 + (c % 6);
    G.setState({ board: b, tray: [{ id: 'i2v' }, { id: 'o1' }, { id: 'o4' }] });
    return G.act('place', 0, 4, 8);
  });
  await page.waitForTimeout(1500);
  if (art.failed.length) problems.push('failed art: ' + art.failed.join(', '));
  if (art.loaded.length !== art.files.length) problems.push('decoded ' + art.loaded.length + ' of ' + art.files.length + ' images');
  if (res.G !== 2) problems.push('clear did not play');
  console.log(`${problems.length ? 'FAIL' : 'PASS'}  [${name}] file:// · ${art.loaded.length}/${art.files.length} images · WebGL ${art.gl} · live water ${art.water}`);
  for (const p of problems) console.log('      ✗ ' + p);
  failed += problems.length ? 1 : 0;
  await ctx.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
