// M1: boot, title screen, empty board (AC1, AC2)
export const tests = [
  {
    name: 'title screen',
    async run(t) {
      const s = await t.state();
      t.equal(s.scene, 'title', 'starts on title');
      const modes = await t.page.$$eval('#sc-title [data-mode], #sc-title [data-go="trail"]', els => els.filter(e => e.offsetParent).length);
      t.equal(modes, 4, 'four mode buttons visible');
      const ticker = await t.page.textContent('#ticker');
      t.expect(ticker && ticker.length > 20, 'ticker has a fact');
      t.expect(t.loadMs < 2000, 'loads in under 2 s (' + t.loadMs + ' ms)');
      await t.checkLayout();
      await t.shot('01-title');
    },
  },
  {
    name: 'empty board',
    async run(t) {
      await t.seed(11);
      await t.game('newGame', { mode: 'classic' });
      const s = await t.state();
      t.equal(s.scene, 'game', 'in game');
      t.equal(s.board.filter(Boolean).length, 0, 'board empty');
      t.equal(s.tray.filter(Boolean).length, 3, 'three pieces dealt');
      const L = await t.game('layout');
      t.expect(L.board.x >= 0 && L.board.y >= 0 && L.board.x + L.board.size <= t.vp.width && L.board.y + L.board.size <= t.vp.height, 'board fully on screen');
      for (const sl of L.slots) t.expect(sl.x >= 0 && sl.y >= 0 && sl.x + sl.w <= t.vp.width && sl.y + sl.h <= t.vp.height, 'tray slot on screen');
      if (t.viewport === 'mobile') for (const sl of L.slots) t.expect(sl.w >= 44 && sl.h >= 44, 'tray slot ≥ 44 px');
      await t.game('act', 'hideToast');
      await t.checkLayout();
      await t.shot('02-board-empty');
    },
  },
  {
    name: 'W6-S6-06 PWA theme-color sync, off-Title/hidden/reducedMotion ticker shutdown, rr() guard, 34px board shadow & cold-boot warmSprites()',
    viewports: ['desktop'],
    async run(t) {
      await t.page.waitForFunction(() => window.__game.isIdle() && spriteCache.size >= 19, null, { timeout: 8000 });

      // 1. Cold-boot warmSprites() race cure: all 19 canonical sprites built once from decoded WebPs (0 fallback builds).
      const warmCheck = await t.page.evaluate(() => {
        const keys = [...spriteCache.keys()];
        return {
          size: spriteCache.size,
          allocs: PERF.spriteAllocs,
          artOn: ART.on,
          fallbackKeys: keys.filter(k => k.includes('|false')),
          allRealArt: keys.length >= 19 && keys.every(k => k.includes('|true')),
        };
      });
      t.equal(warmCheck.size, 19, 'cold boot warms strictly 19 canonical sprites (' + warmCheck.size + ')');
      t.equal(warmCheck.allocs, 19, 'zero wasted procedural fallback sprite builds during cold boot (allocs=' + warmCheck.allocs + ')');
      t.equal(warmCheck.fallbackKeys.length, 0, 'zero fallback |false sprite keys after cold boot');
      t.equal(warmCheck.allRealArt, true, 'all 19 warmed sprites use decoded WebP tile art');

      // 2. PWA theme-color & manifest sync (zero #14121F indigo; Light #F2EFE8 <-> Dark #131C1E <-> System dual media).
      const readThemeMeta = () => t.page.evaluate(() => {
        const metas = [...document.querySelectorAll('meta[name=theme-color]')].map(m => ({ id: m.id, content: m.content, media: m.getAttribute('media') }));
        const href = document.querySelector('link[rel=manifest]').getAttribute('href');
        const man = JSON.parse(decodeURIComponent(href.slice('data:application/manifest+json,'.length)));
        return { metas, bg: man.background_color, tc: man.theme_color, raw: href };
      });
      const sysMeta = await readThemeMeta();
      t.expect(!/14121F/i.test(JSON.stringify(sysMeta)), 'zero legacy cold-indigo #14121F anywhere in PWA head metadata');
      t.equal(sysMeta.metas.length, 2, 'system default provides dark + light prefers-color-scheme theme-color tags');
      t.equal(sysMeta.metas[0].content, '#131C1E', 'dark theme-color is warm night travertine #131C1E');
      t.equal(sysMeta.metas[1].content, '#F2EFE8', 'light theme-color is warm bathhouse cream #F2EFE8');
      t.equal(sysMeta.bg, '#131C1E', 'manifest background_color matches warm night travertine');

      await t.game('act', 'setting', 'theme', 'light');
      const lightMeta = await readThemeMeta();
      t.equal(lightMeta.metas[0].content, '#F2EFE8', 'Light theme syncs primary meta[name=theme-color] to #F2EFE8');
      t.equal(lightMeta.bg, '#F2EFE8', 'Light theme syncs manifest background_color to #F2EFE8');
      t.equal(lightMeta.tc, '#F2EFE8', 'Light theme syncs manifest theme_color to #F2EFE8');

      await t.game('act', 'setting', 'theme', 'dark');
      const darkMeta = await readThemeMeta();
      t.equal(darkMeta.metas[0].content, '#131C1E', 'Dark theme syncs primary meta[name=theme-color] to #131C1E');
      t.equal(darkMeta.bg, '#131C1E', 'Dark theme syncs manifest background_color to #131C1E');

      await t.game('act', 'setting', 'theme', 'system');
      const restoredMeta = await readThemeMeta();
      t.equal(restoredMeta.metas[0].media, '(prefers-color-scheme: dark)', 'System theme restores dark media query');
      t.equal(restoredMeta.metas[1].media, '(prefers-color-scheme: light)', 'System theme restores light media query');

      // 3. Off-Title, reducedMotion & hover/focus Title ticker shutdown (no eternal 8s interval).
      const tk = await t.page.evaluate(() => {
        showScene('title');
        const onTitle = !!tickerInterval;
        $('ticker').dispatchEvent(new MouseEvent('mouseenter'));
        const onHover = !!tickerInterval;
        $('ticker').dispatchEvent(new MouseEvent('mouseleave'));
        const afterLeave = !!tickerInterval;
        setSetting('motion', 'reduced');
        const onReduced = !!tickerInterval;
        setSetting('motion', 'full');
        const onFull = !!tickerInterval;
        newGame({ mode: 'classic', seed: 4 });
        const inGame = !!tickerInterval;
        showScene('settings');
        const inSettings = !!tickerInterval;
        showScene('title');
        const backTitle = !!tickerInterval;
        setSetting('motion', 'system');
        return { onTitle, onHover, afterLeave, onReduced, onFull, inGame, inSettings, backTitle };
      });
      t.equal(tk.onTitle, true, 'ticker interval runs on visible Title screen');
      t.equal(tk.onHover, false, 'ticker interval shuts down on hover (WCAG 2.2.2)');
      t.equal(tk.afterLeave, true, 'ticker interval resumes when hover ends');
      t.equal(tk.onReduced, false, 'ticker interval shuts down under reducedMotion()');
      t.equal(tk.onFull, true, 'ticker interval resumes under Motion: Full');
      t.equal(tk.inGame, false, 'ticker interval shuts down completely during gameplay');
      t.equal(tk.inSettings, false, 'ticker interval stays shut down on secondary screens');
      t.equal(tk.backTitle, true, 'ticker interval restarts cleanly upon returning to Title');

      // 4. Negative-width / oversized-radius rr() guard + unclipped 34px boardCache drop shadow.
      const geom = await t.page.evaluate(() => {
        const c = document.createElement('canvas'); c.width = 40; c.height = 40;
        const g = c.getContext('2d');
        g.fillStyle = '#fff';
        let threw = false;
        try {
          rr(g, 10, 10, -6, -6, 8); g.fill();
          rr(g, 10, 10, 0, 10, 4); g.fill();
          rr(g, 10, 10, 10, -2, 3); g.fill();
        } catch (e) { threw = true; }
        const negAlpha = g.getImageData(0, 0, 40, 40).data.some((v, i) => i % 4 === 3 && v > 0);
        try {
          rr(g, 10, 10, 6, 6, 30); g.fill(); // oversized radius clamped cleanly to w/2
          rr(g, 20, 20, 6, 6, -5); g.fill(); // negative radius clamped cleanly to 0
        } catch (e) { threw = true; }
        const validAlpha = g.getImageData(12, 12, 2, 2).data[3];
        newGame({ mode: 'classic', seed: 4 });
        ensureBoard();
        const bg = boardCache.getContext('2d');
        const bw = boardCache.width, bh = boardCache.height;
        const botRow = bg.getImageData(0, bh - 1, bw, 1).data;
        const rightCol = bg.getImageData(bw - 1, 0, 1, bh).data;
        let maxEdgeA = 0;
        for (let i = 3; i < botRow.length; i += 4) if (botRow[i] > maxEdgeA) maxEdgeA = botRow[i];
        for (let i = 3; i < rightCol.length; i += 4) if (rightCol[i] > maxEdgeA) maxEdgeA = rightCol[i];
        return { threw, negAlpha, validAlpha, pad: BOARD_PAD, maxEdgeA };
      });
      t.equal(geom.threw, false, 'rr() never throws on negative widths, zero sizes, or out-of-range radii');
      t.equal(geom.negAlpha, false, 'rr() paints zero pixels for negative/zero dimensions (no arcTo bow-tie artifacts)');
      t.expect(geom.validAlpha > 200, 'rr() still paints cleanly when radius is clamped from >w/2');
      t.expect(geom.pad >= 34, 'BOARD_PAD >= 34 px (' + geom.pad + ')');
      t.equal(geom.maxEdgeA, 0, 'boardCache bottom/right outer edge feathers cleanly to alpha 0 (zero shadow clipping)');
    },
  },
];
