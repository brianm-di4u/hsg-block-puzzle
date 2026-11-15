// Council wave 3, follow-up pass after verification (S4-14, S2-12, S6-16, S5-10, S4-04, S4-01).
const KEY = 'hs-thermal-blocks-v1';
const readSave = t => t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);

// The painted extent of every piece of HUD text (a Range over the text node, not the element box, which can be wider or narrower
// than its glyphs) and of every button, so a figure that prints over its neighbour or under a button shows up.
const hudExtents = t => t.page.evaluate(() => {
  const out = { stats: [], buttons: [] };
  for (const st of document.querySelectorAll('#hud .stat:not([hidden])')) {
    const texts = [];
    for (const el of st.querySelectorAll('.lbl, .num')) {
      if (!el.getClientRects().length) continue;
      const r = document.createRange(); r.selectNodeContents(el);
      const b = r.getBoundingClientRect();
      texts.push({ text: el.textContent, l: b.left, r: b.right });
    }
    out.stats.push({ texts, l: Math.min(...texts.map(x => x.l)), r: Math.max(...texts.map(x => x.r)), name: texts.map(x => x.text).join(' ') });
  }
  for (const el of document.querySelectorAll('#hud button')) {
    const b = el.getBoundingClientRect();
    if (b.width > 0) out.buttons.push({ id: el.id, l: b.left, r: b.right });
  }
  return out;
});
// Each stat is a column (label over figure), so two stats collide when their columns share any horizontal ground; no column may share any with a button.
function assertClear(t, ex, where) {
  const fmt = x => '"' + x.name + '" (' + x.l.toFixed(0) + ' to ' + x.r.toFixed(0) + ')';
  for (let i = 0; i < ex.stats.length; i++) for (let j = i + 1; j < ex.stats.length; j++) {
    const a = ex.stats[i], b = ex.stats[j];
    t.expect(a.r <= b.l + 0.5 || b.r <= a.l + 0.5, where + ': ' + fmt(a) + ' does not run into ' + fmt(b));
  }
  for (const a of ex.stats) for (const b of ex.buttons) t.expect(a.r <= b.l + 0.5 || a.l >= b.r - 0.5, where + ': ' + fmt(a) + ' does not run under ' + b.id + ' (' + b.l.toFixed(0) + ' to ' + b.r.toFixed(0) + ')');
}

export const tests = [
  // ------------------------------------------------------------------ S4-14 and S2-12: the phone HUD holds big figures and the Hint button
  {
    name: 'S4-14 S2-12 on a phone a four-digit score, best and the goal figure never print over each other or under a button',
    viewports: ['mobile'],
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      const lv = await t.game('getLevels');
      await t.page.evaluate(k => { const v = JSON.parse(localStorage.getItem(k)); v.best = { ...(v.best || {}), classic: 9999, springs: 9999 }; localStorage.setItem(k, JSON.stringify(v)); }, KEY);
      await t.page.reload();
      await t.waitFrames(3);
      await t.game('act', 'setting', 'tipsSeen', true);
      for (const w of [390, 375, 360]) {
        await t.page.setViewportSize({ width: w, height: 844 });
        for (const [mode, score, shown] of [['classic', 8888, '8,888'], ['springs', 8888, '8,888'], ['trail', 8888, '8,888'], ['classic', 12345, '12,345'], ['springs', 12345, '12,345']]) {
          await t.game('newGame', mode === 'trail' ? { mode, level: lv.find(l => l.name === 'Thermal Water Cascade').id } : { mode });
          await t.game('setState', mode === 'springs' ? { score, springs: 46 } : { score });
          await t.waitFrames(2);
          const ex = await hudExtents(t);
          t.expect(ex.stats.some(x => x.texts.some(y => y.text === shown)), 'the score ' + shown + ' is showing in ' + mode);
          if (mode === 'classic' && score < 10000) t.expect(ex.stats.some(x => x.texts.some(y => y.text === '9,999')), 'the four-digit best is showing in Classic');
          if (mode === 'springs') t.expect(ex.stats.some(x => x.texts.some(y => y.text === '46/47')), 'the Springs goal is showing');
          if (w === 390 && mode !== 'trail') await t.shot('S4-14-' + mode + '-hud-' + w);
          assertClear(t, ex, mode + ' at ' + w);
          const doc = await t.page.evaluate(() => document.documentElement.scrollWidth);
          t.expect(doc <= w, 'no sideways scroll at ' + w + ': ' + doc);
        }
      }
      await t.page.setViewportSize({ width: 390, height: 844 });
    },
  },

  // ------------------------------------------------------------------ S6-16 and S5-10: M and the Sound checkbox agree
  {
    name: 'S6-16 S5-10 pressing M on Settings moves the Sound checkbox, and M works with a checkbox or the slider focused',
    async run(t) {
      await t.game('act', 'setting', 'sound', true);
      await t.game('scene', 'settings');
      const box = () => t.page.evaluate(() => document.getElementById('s-sound').checked);
      t.equal(await box(), true, 'Sound starts ticked');
      await t.page.keyboard.press('m');
      t.equal((await readSave(t)).settings.sound, false, 'M mutes');
      t.equal(await box(), false, 'and the Sound checkbox clears');
      await t.page.keyboard.press('m');
      t.equal(await box(), true, 'M again ticks it');
      await t.page.focus('#s-music');
      await t.page.keyboard.press('m');
      t.equal((await readSave(t)).settings.sound, false, 'M mutes with the Music checkbox focused');
      t.equal(await box(), false, 'and the Sound checkbox follows');
      await t.page.focus('#s-volume');
      await t.page.keyboard.press('M');
      t.equal((await readSave(t)).settings.sound, true, 'M unmutes with the Volume slider focused');
      t.equal(await box(), true, 'and the Sound checkbox follows');
      await t.page.focus('#s-difficulty');
      await t.page.keyboard.press('m');
      t.equal((await readSave(t)).settings.sound, true, 'a select keeps its letters: M there only picks an option');
      await t.game('scene', 'title');
      // a hidden select keeps focus until the next frame, and a select takes M as a letter
      await t.page.waitForFunction(() => document.activeElement.id !== 's-difficulty');
      await t.page.keyboard.press('m');
      await t.game('scene', 'settings');
      t.equal(await box(), false, 'muted from the title, Settings opens with Sound clear');
    },
  },

  // ------------------------------------------------------------------ S4-04, S4-01: words
  {
    name: 'S4-04 S4-01 no line says the Cascade is on the Row, and the first ticker line does not tell anyone to touch 143F water',
    viewports: ['desktop'],
    async run(t) {
      const w = await t.game('act', 'words');
      t.expect(!w.ticker.some(l => /hold your hand/i.test(l)), 'no ticker line says to hold a hand to the water');
      t.expect(w.ticker[0].includes('143°F'), 'the first line still gives the 143°F fact: ' + w.ticker[0]);
      const page = await t.page.evaluate(() => document.documentElement.outerHTML);
      t.expect(!/last on the Row/.test(page), 'nothing in the game says a puzzle was "the last on the Row"');
    },
  },
];
