// Council wave 4, batch B: controls, rules and play; difficulty, progression and records; feedback, teaching and help.
const EMPTY = () => new Array(81).fill(0);
const checker = () => { const b = EMPTY(); for (let i = 0; i < 81; i++) if ((Math.floor(i / 9) + i % 9) % 2 === 0) b[i] = 1 + (i % 6); return b; };
const BOTH = ['desktop', 'mobile'];

// A Classic game one move from the end: only the single tile fits, and placing it clears nothing.
async function lastMove(t, extra = {}) {
  await t.seed(8);
  await t.game('newGame', { mode: 'classic' });
  await t.game('setState', { board: checker(), tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score: 480, heat: 3, bestHeat: 7, groups: 12, placed: 40, undoLeft: 3, ...extra });
  await t.game('act', 'hideToast');
}
const waitScene = (t, name) => t.page.waitForFunction(n => window.__game.getState().scene === n, name, { timeout: 8000 });

export const tests = [
  {
    name: 'S1-02 the move that ends a Classic game can be taken back from the results card, and the game still counts once',
    viewports: BOTH,
    async run(t) {
      await lastMove(t);
      const before = await t.game('act', 'save');
      await t.game('act', 'place', 0, 0, 1);
      await waitScene(t, 'over');
      t.expect(await t.page.isVisible('#b-ovundo'), 'the results card offers Undo last move');
      await t.shot('S1-02-results-undo');
      const mid = await t.game('act', 'save');
      t.equal([mid.best.classic, mid.stats.games], [481, before.stats.games + 1], 'the ending recorded the game and the best');
      await t.page.click('#b-ovundo');
      await waitScene(t, 'game');
      const s = await t.state();
      t.equal([s.over, s.score, s.tray.filter(Boolean).length], [false, 480, 3], 'back in the game, one move earlier');
      const after = await t.game('act', 'save');
      t.equal(after.stats.games, mid.stats.games, 'the finished game stays counted');
      t.equal(s.undoLeft, 2, 'the undo counts against the round');
      await t.game('act', 'place', 0, 0, 1);
      await waitScene(t, 'over');
      const again = await t.game('act', 'save');
      t.equal([again.stats.games, again.best.classic], [before.stats.games + 1, 481], 'finishing the same game again counts one game, not two');
    },
  },
  {
    name: 'S1-02 Undo works during the pause before the results card, from the button and the U key',
    viewports: BOTH,
    async run(t) {
      await lastMove(t);
      const r = await t.page.evaluate(() => { const g = window.__game; g.act('place', 0, 0, 1); const s = g.getState(); const u = g.act('undo'); return { over: s.over, scene: s.scene, ok: u.ok, now: g.getState().over }; });
      t.equal([r.over, r.scene, r.ok, r.now], [true, 'game', true, false], 'the board is over but still showing, and Undo takes it back');
      await t.game('act', 'place', 0, 0, 1);
      await t.page.keyboard.press('u');
      await waitScene(t, 'game');
      t.equal((await t.state()).over, false, 'U during the pause takes it back');
      await t.game('act', 'place', 0, 0, 1);
      await t.game('act', 'freezeFx', 0);
      await t.page.keyboard.press('KeyU');
      await t.page.waitForFunction(() => !window.__game.getState().over, null, { timeout: 4000 });
      await t.game('act', 'unfreezeFx');
    },
  },
  {
    name: 'S1-02 with no undos left there is no Undo on the results card',
    viewports: BOTH,
    async run(t) {
      await t.game('act', 'setting', 'undo', 0);
      await lastMove(t, { undoLeft: 0 });
      await t.game('act', 'place', 0, 0, 1);
      await waitScene(t, 'over');
      t.expect(!(await t.page.isVisible('#b-ovundo')), 'no Undo button');
      t.expect(!(await t.game('act', 'undo')).ok, 'and the undo refuses');
      await t.game('act', 'setting', 'undo', 3);
    },
  },
  {
    name: 'S1-02 a Daily loss can be taken back too',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(8);
      await t.game('newGame', { mode: 'daily' });
      await t.game('setState', { board: checker(), tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score: 100, placed: 40, undoLeft: 3 });
      await t.game('act', 'place', 0, 0, 1);
      await waitScene(t, 'over');
      t.expect(await t.page.isVisible('#b-ovundo'), 'a Daily loss offers Undo');
      await t.page.click('#b-ovundo');
      await waitScene(t, 'game');
      t.equal((await t.state()).over, false, 'the Daily is playable again');
    },
  },
  {
    name: 'S1-02 a last piece that clears nothing shows the results card in 450 ms or less; a tap or Enter skips the wait',
    viewports: BOTH,
    async run(t) {
      await lastMove(t);
      const r = await t.page.evaluate(() => { const g = window.__game; g.act('place', 0, 0, 1); return g.getState().overIn; });
      t.expect(r > 0 && r <= 450, 'the card is due within 450 ms, not 1000: ' + r);
      await waitScene(t, 'over');
      await t.game('act', 'undo');
      await t.game('act', 'place', 0, 0, 1);
      await t.game('act', 'freezeFx', 0);
      await t.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
      t.equal((await t.state()).scene, 'game', 'with the effects held, the card waits');
      await t.page.keyboard.press('Enter');
      await waitScene(t, 'over');
      await t.game('act', 'unfreezeFx');
      await t.game('act', 'undo');
      await t.game('act', 'place', 0, 0, 1);
      await t.game('act', 'freezeFx', 0);
      await t.page.mouse.click(t.vp.width / 2, 200);
      await waitScene(t, 'over');
      await t.game('act', 'unfreezeFx');
    },
  },
];

// A board one cell short of a full top row: the single tile at (0,8) clears that row and nothing else.
async function oneGroup(t) {
  await t.seed(8);
  await t.game('newGame', { mode: 'classic' });
  const b = EMPTY(); for (let c = 0; c < 8; c++) b[c] = 1;
  await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], score: 0, heat: 3, placed: 5 });
  await t.game('act', 'hideToast');
}

tests.push(
  {
    name: 'S1-11 a single-group clear gives a short, small shake; a plain drop gives none; a double keeps its bigger one',
    viewports: BOTH,
    async run(t) {
      await oneGroup(t);
      const none = await t.page.evaluate(() => { const g = window.__game; g.act('place', 1, 4, 4); return g.act('shakes'); });
      t.equal(none, [], 'a drop that clears nothing does not shake');
      const one = await t.page.evaluate(() => { const g = window.__game; const r = g.act('place', 0, 0, 8); return { G: r.G, shakes: g.act('shakes') }; });
      t.equal(one.G, 1, 'one group cleared');
      t.equal(one.shakes, [{ dur: 120, amp: 1.5 }], 'a 120 ms shake with amp 1.5');
      await t.game('newGame', { mode: 'classic' });
      const b = EMPTY(); for (let c = 0; c < 8; c++) { b[c] = 1; b[9 + c] = 1; }
      await t.game('setState', { board: b, tray: [{ id: 'i2v' }, { id: 'o1' }, { id: 'o1' }], score: 0, heat: 3, placed: 5 });
      const two = await t.page.evaluate(() => { const g = window.__game; const r = g.act('place', 0, 0, 8); return { G: r.G, shakes: g.act('shakes') }; });
      t.equal(two.G, 2, 'two groups cleared');
      t.equal(two.shakes, [{ dur: 300, amp: 5.6 }], 'the double-clear shake is as it was');
    },
  },
  {
    name: 'S1-11 reduced motion: a single-group clear does not shake',
    viewports: ['desktop'],
    reducedMotion: true,
    async run(t) {
      await oneGroup(t);
      const r = await t.page.evaluate(() => { const g = window.__game; g.act('place', 0, 0, 8); return g.act('shakes'); });
      t.equal(r, [], 'no shake');
    },
  },
);

tests.push({
  name: 'P-N05 Daily Soak says it is today’s board on this device and shows the date, in the menu, the opening toast and Help',
  viewports: BOTH,
  async run(t) {
    await t.game('act', 'setting', 'tipsSeen', true);
    await t.game('scene', 'title');
    const today = await t.page.evaluate(() => { const d = new Date(); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); });
    const sub = (await t.page.textContent('#daily-sub')).replace(/ /g, ' ');
    t.equal(sub, 'Today’s board on this device · ' + today, 'the menu line, with the date');
    t.expect(await t.page.evaluate(() => { const e = document.getElementById('daily-sub'); return e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().right <= innerWidth; }), 'the line fits its button');
    await t.shot('P-N05-title');
    await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
    const toast = await t.page.evaluate(() => document.getElementById('toast').textContent);
    t.expect(toast.includes('Today’s board on this device, Nov 12') && toast.includes('midnight'), 'the opening toast: ' + toast);
    const help = await t.page.evaluate(() => document.getElementById('sc-help').textContent);
    t.expect(help.includes('on this device') && help.includes('your midnight'), 'Help says the same');
    for (const old of [sub, toast, help]) t.expect(!/for everyone today|everyone gets/i.test(old), 'nothing still promises one board for everyone');
  },
});

tests.push(
  {
    name: 'S4-12 the combo banner uses the town’s words and keeps the count of groups in the line under it',
    viewports: BOTH,
    async run(t) {
      const WORDS = { 2: 'Soak!', 3: 'Steam!', 4: 'Cascade!' };
      // two rows at once
      await t.game('newGame', { mode: 'classic' });
      let b = EMPTY(); for (let c = 0; c < 8; c++) { b[c] = 1; b[9 + c] = 1; } b[72] = 1;   // a stray tile, so the board is not left empty (that is the Clear Spring bonus)
      await t.game('setState', { board: b, tray: [{ id: 'i2v' }, { id: 'o1' }, { id: 'o1' }], score: 0, heat: 3, placed: 5 });
      let r = await t.game('act', 'place', 0, 0, 8);
      let ban = (await t.game('act', 'fxList')).find(f => f.type === 'banner');
      t.equal([r.G, ban && ban.text], [2, WORDS[2]], 'two groups read Soak!');
      t.expect(/^2 groups/.test(ban.sub), 'the line under it says how many: ' + ban.sub);
      // two rows and the pool they close with the third row's end: three groups; with more of the third row filled, a second pool: four
      for (const [groups, from] of [[3, 6], [4, 3]]) {
        await t.game('newGame', { mode: 'classic' });
        b = EMPTY(); for (let c = 0; c < 8; c++) { b[c] = 1; b[9 + c] = 1; } for (let c = from; c < 8; c++) b[18 + c] = 1; b[72] = 1;
        await t.game('setState', { board: b, tray: [{ id: 'i3v' }, { id: 'o1' }, { id: 'o1' }], score: 0, heat: 3, placed: 5 });
        r = await t.game('act', 'place', 0, 0, 8);
        ban = (await t.game('act', 'fxList')).find(f => f.type === 'banner');
        t.equal([r.G, ban && ban.text], [groups, WORDS[groups]], groups + ' groups read ' + WORDS[groups]);
        t.expect(ban.sub.startsWith(groups + ' groups'), 'and the count is there: ' + ban.sub);
        if (groups === 4) { await t.game('act', 'freezeFx', 320); await t.shot('S4-12-cascade'); await t.game('act', 'unfreezeFx'); }
      }
      const src = await t.page.evaluate(() => document.documentElement.innerHTML);
      t.expect(!/'Double!'|'Triple!'|'Quadruple!'/.test(src), 'the generic words are gone from the game');
    },
  },
  {
    name: 'S4-12 each era tints the clear’s ripple and band; the Roaring era flickers and the Frontier era splinters planks',
    viewports: BOTH,
    async run(t) {
      await t.game('act', 'setting', 'effects', 'full');
      const seen = {};
      for (const [era, id] of [[0, 'ancient'], [1, 'frontier'], [2, 'gilded-spa'], [3, 'roaring'], [4, 'midcentury'], [5, 'revival'], [6, 'modern']]) {
        await t.game('newGame', { mode: 'classic' });
        const bd = EMPTY(); for (let c = 0; c < 8; c++) bd[c] = 1;
        await t.game('setState', { board: bd, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], score: 0, heat: 3, placed: 5, era });
        t.equal((await t.state()).eraId, id, 'era ' + id);
        const fx = await t.page.evaluate(() => { const real = Math.random; Math.random = () => 0.1; try { window.__game.act('place', 0, 0, 8); return window.__game.act('clearFx'); } finally { Math.random = real; } });
        if (id === 'frontier' || id === 'roaring') { await t.game('act', 'freezeFx', 260); await t.shot('S4-12-clear-' + id); await t.game('act', 'unfreezeFx'); }
        const rip = fx.find(f => f.type === 'ripple'), beam = fx.find(f => f.type === 'beam'), shards = fx.filter(f => f.type === 'shard');
        t.expect(rip && beam && shards.length > 0, id + ': a ripple, a band and shards came up');
        seen[id] = { rip: rip.tint, beam: beam.tint, flicker: rip.flicker, plank: shards.every(s => s.plank), anyPlank: shards.some(s => s.plank) };
      }
      t.equal(new Set(Object.values(seen).map(v => v.rip)).size, 7, 'seven different ripple tints');
      t.equal(Object.keys(seen).filter(k => seen[k].flicker), ['roaring'], 'only the Roaring era flickers');
      t.equal(Object.keys(seen).filter(k => seen[k].anyPlank), ['frontier'], 'only the Frontier era splinters planks');
      t.equal([seen.ancient.rip, seen.ancient.beam], ['190,250,240', '255,236,170'], 'the first era keeps the colours it always had');
    },
  },
);
