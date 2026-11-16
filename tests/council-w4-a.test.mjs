// Council wave 4, batch A: saves, lifecycle and robustness (C4-01, S2-23).
const KEY = 'hs-thermal-blocks-v1';
const RUN = 'hs-thermal-blocks-v1-run';

// A save that is otherwise valid but says it comes from a newer version of the game, with progress that must survive the visit.
const newerSave = () => JSON.stringify({ v: 2, settings: { sound: false, volume: 0.3, undo: 3, tipsSeen: true, difficulty: 'master', futureSetting: 'x' },
  best: { classic: 4321, springs: 77, daily: {} }, trail: { done: ['a'], stars: { a: 3 } }, stats: { games: 9, lines: 40, bestHeat: 5, springs: 1 }, resume: null, future: { keep: true } });
const seedStorage = (t, key, raw) => t.page.evaluate(([k, r]) => { localStorage.setItem(k, r); }, [key, raw]);
const readRaw = (t, key) => t.page.evaluate(k => localStorage.getItem(k), key);
const toastText = t => t.page.evaluate(() => { const el = document.getElementById('toast'); return el.classList.contains('on') ? el.textContent : ''; });
const toastWords = (t, re) => t.page.waitForFunction(r => { const el = document.getElementById('toast'); return el.classList.contains('on') && new RegExp(r).test(el.textContent); }, re.source, { timeout: 15000 });

// Play the way a visit that would normally save does: change settings, start a game, place pieces with the hint, start another, go to the title.
async function busyVisit(t) {
  await t.game('act', 'setting', 'sound', true);
  await t.game('act', 'setting', 'volume', 0.5);
  await t.game('newGame', { mode: 'classic', seed: 5 });
  for (let n = 0; n < 3; n++) {
    const h = await t.game('act', 'hint');
    if (h.ok) await t.game('act', 'place', h.slot, h.r, h.c);
  }
  await t.game('newGame', { mode: 'springs', seed: 6 });
  const h = await t.game('act', 'hint');
  if (h.ok) await t.game('act', 'place', h.slot, h.r, h.c);
  await t.game('scene', 'title');
}

export const tests = [
  {
    name: 'C4-01 a save from a newer version is left byte for byte as it was after a visit that would normally save',
    async run(t) {
      const raw = newerSave();
      await seedStorage(t, KEY, raw);
      await t.reload();
      await t.game('act', 'setting', 'tipsSeen', true);
      await busyVisit(t);
      const sv = await t.game('act', 'save');
      t.equal(sv.best.classic, 0, 'the game plays from defaults in memory (the newer best is not loaded)');
      t.equal(sv.settings.volume, 0.5, 'a changed setting still takes effect for this visit');
      t.equal(await readRaw(t, KEY), raw, 'the newer save is exactly the bytes it was');
      t.expect(await readRaw(t, RUN) === null, 'no run slot was written either');
      await t.reload();
      t.equal(await readRaw(t, KEY), raw, 'and still the same after a second visit that only opens the game');
    },
  },
  {
    name: 'C4-01 the player is told once that this visit is not being saved',
    async run(t) {
      await seedStorage(t, KEY, newerSave());
      await t.reload();
      await toastWords(t, /not being saved/i);
      const text = await toastText(t);
      t.expect(/newer version of the game/.test(text), 'the toast says why: ' + text);
      await t.shot('C4-01-newer-save-notice');
      await t.game('act', 'hideToast');
      await busyVisit(t);
      await t.game('act', 'setting', 'sound', false);
      await t.page.waitForTimeout(0);
      t.expect(!/not being saved/i.test(await toastText(t)), 'the notice does not come back later in the visit');
    },
  },
  {
    name: 'C4-01 a run slot from a newer version is not overwritten or cleared by Trail or Daily play',
    async run(t) {
      const run = JSON.stringify({ rv: 2, mode: 'daily', key: '2026-01-01', state: { future: true } });
      await seedStorage(t, RUN, run);
      await t.reload();
      await t.game('newGame', { mode: 'daily' });
      const h = await t.game('act', 'hint');
      if (h.ok) await t.game('act', 'place', h.slot, h.r, h.c);
      const lv = await t.game('getLevels');
      await t.game('newGame', { mode: 'trail', level: lv[0].id });
      t.equal(await readRaw(t, RUN), run, 'the newer run slot is the same bytes');
      await toastWords(t, /not being saved/i);
    },
  },
  {
    name: 'C4-01 a damaged or wrong-shaped save is still repaired, and an ordinary save still saves',
    async run(t) {
      await seedStorage(t, KEY, '{"v":1,"settings":{"volume":"loud"},"best":{"classic":"x"},"resume":5,"stats":');
      await t.reload();
      await t.game('act', 'setting', 'volume', 0.4);
      const after = JSON.parse(await readRaw(t, KEY));
      t.equal(after.v, 1, 'a damaged save is written over as before');
      t.equal(after.settings.volume, 0.4, 'the repaired save holds the change');
      t.expect(!/not being saved/i.test(await toastText(t)), 'no newer-version notice for a damaged save');
      await seedStorage(t, KEY, JSON.stringify({ v: 1, settings: { volume: 0.2 }, best: { classic: 50 } }));
      await t.reload();
      await t.game('act', 'setting', 'volume', 0.6);
      const ok = JSON.parse(await readRaw(t, KEY));
      t.equal(ok.settings.volume, 0.6, 'a current save is written as before');
      t.equal(ok.best.classic, 50, 'with its best kept');
    },
  },
  {
    name: 'S2-23 with storage blocked the game says once that progress cannot be saved',
    initScript: () => { Storage.prototype.setItem = function () { throw new Error('blocked'); }; Storage.prototype.getItem = function () { throw new Error('blocked'); }; },
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'setting', 'sound', false);
      await toastWords(t, /cannot be saved/i);
      t.expect(/browser/.test(await toastText(t)), 'the toast names the browser: ' + await toastText(t));
      await t.shot('S2-23-storage-blocked-notice');
      await t.game('act', 'hideToast');
      await t.game('act', 'setting', 'sound', true);
      await t.game('newGame', { mode: 'classic', seed: 3 });
      t.expect(!/cannot be saved/i.test(await toastText(t)), 'it is not repeated');
    },
  },
];

// ---------------------------------------------------------------------- C4-04 and C4-06: the HUD holds its figures at every width, phone and desktop
// The painted extent of every piece of HUD text (a Range over the text node, not the element box) and of every button.
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
    if (texts.length) out.stats.push({ texts, l: Math.min(...texts.map(x => x.l)), r: Math.max(...texts.map(x => x.r)), name: texts.map(x => x.text).join(' ') });
  }
  for (const el of document.querySelectorAll('#hud button')) {
    const b = el.getBoundingClientRect();
    if (b.width > 0) out.buttons.push({ id: el.id, l: b.left, r: b.right });
  }
  const mode = document.getElementById('h-mode');
  if (mode && mode.getClientRects().length) { const b = mode.getBoundingClientRect(); out.mode = { l: b.left, r: b.right }; }   // the element box: its text is clipped to it
  return out;
});
// Each stat is a column (label over figure): no two share horizontal ground, and none shares any with a button or the mode name.
function assertClear(t, ex, where) {
  const fmt = x => '"' + x.name + '" (' + x.l.toFixed(0) + ' to ' + x.r.toFixed(0) + ')';
  for (let i = 0; i < ex.stats.length; i++) for (let j = i + 1; j < ex.stats.length; j++) {
    const a = ex.stats[i], b = ex.stats[j];
    t.expect(a.r <= b.l + 0.5 || b.r <= a.l + 0.5, where + ': ' + fmt(a) + ' does not run into ' + fmt(b));
  }
  for (const a of ex.stats) for (const b of ex.buttons) t.expect(a.r <= b.l + 0.5 || a.l >= b.r - 0.5, where + ': ' + fmt(a) + ' does not run under ' + b.id + ' (' + b.l.toFixed(0) + ' to ' + b.r.toFixed(0) + ')');
  if (ex.mode) for (const b of ex.buttons) t.expect(ex.mode.r <= b.l + 0.5 || ex.mode.l >= b.r - 0.5, where + ': the mode name does not run under ' + b.id);
  const edge = Math.min(...ex.stats.map(x => x.l), ...ex.buttons.map(x => x.l)), far = Math.max(...ex.stats.map(x => x.r), ...ex.buttons.map(x => x.r));
  t.expect(edge >= -0.5, where + ': nothing is cut off at the left (' + edge.toFixed(0) + ')');
  return far;
}
// Every mode shows its widest figures: Classic with a big score and best, Springs and Trail with the goal beside the score.
async function sweepHud(t, w, h, scores, label) {
  await t.page.setViewportSize({ width: w, height: h });
  const lv = await t.game('getLevels');
  for (const [mode, score, shown] of scores) {
    await t.game('newGame', mode === 'trail' ? { mode, level: lv.find(l => l.name === 'Thermal Water Cascade').id } : { mode });
    await t.game('setState', mode === 'springs' ? { score, springs: 46 } : { score });
    await t.waitFrames(2);
    const ex = await hudExtents(t);
    t.expect(ex.stats.some(x => x.texts.some(y => y.text === shown)), label + ' ' + w + 'x' + h + ': the score ' + shown + ' is showing in ' + mode);
    const far = assertClear(t, ex, label + ' ' + mode + ' ' + score + ' at ' + w + 'x' + h);
    t.expect(far <= w + 0.5, label + ' ' + mode + ' at ' + w + 'x' + h + ': nothing runs off the right edge (' + far.toFixed(0) + ')');
    const doc = await t.page.evaluate(() => document.documentElement.scrollWidth);
    t.expect(doc <= w, label + ' ' + w + 'x' + h + ': no sideways scroll: ' + doc);
  }
}
const HUD_SCORES = [['classic', 1234, '1,234'], ['classic', 12345, '12,345'], ['springs', 99, '99'], ['springs', 999, '999'], ['springs', 8888, '8,888'], ['springs', 12345, '12,345'], ['trail', 8888, '8,888']];
const setBests = async t => {
  await t.game('act', 'setting', 'tipsSeen', true);
  await t.page.evaluate(k => { const v = JSON.parse(localStorage.getItem(k)); v.best = { ...(v.best || {}), classic: 99999, springs: 9999 }; v.settings = { ...v.settings, tipsSeen: true }; localStorage.setItem(k, JSON.stringify(v)); }, KEY);
  await t.reload();
  await t.game('act', 'setting', 'tipsSeen', true);
};

tests.push(
  {
    name: 'C4-04 phone HUD: score, best, goal and buttons stay apart from 320 to 640 px portrait',
    viewports: ['mobile'],
    async run(t) {
      await setBests(t);
      for (const w of [320, 360, 375, 390, 414, 521, 540, 568, 600, 640]) await sweepHud(t, w, 844, HUD_SCORES, 'portrait');
      await t.page.setViewportSize({ width: 521, height: 844 });
      await t.game('newGame', { mode: 'springs' }); await t.game('setState', { score: 999, springs: 46 }); await t.waitFrames(2);
      await t.shot('C4-04-springs-521');
      await t.page.setViewportSize({ width: 390, height: 844 });
    },
  },
  {
    name: 'C4-04 phone HUD: the same holds on a phone on its side (568 to 844 wide, under 430 high)',
    viewports: ['mobile'],
    async run(t) {
      await setBests(t);
      for (const [w, h] of [[568, 320], [640, 360], [667, 375], [740, 360], [844, 390], [932, 430]]) await sweepHud(t, w, h, HUD_SCORES, 'landscape');
      await t.page.setViewportSize({ width: 568, height: 320 });
      await t.game('newGame', { mode: 'springs' }); await t.game('setState', { score: 1234, springs: 46 }); await t.waitFrames(2);
      await t.shot('C4-04-springs-568x320');
      await t.page.setViewportSize({ width: 390, height: 844 });
    },
  },
  {
    name: 'C4-06 desktop HUD: score, best, goal and buttons stay apart at 1280 and 1024 px, as the figures grow',
    viewports: ['desktop'],
    async run(t) {
      await setBests(t);
      for (const [w, h] of [[1280, 800], [1024, 768], [900, 700], [768, 1024], [700, 900]]) await sweepHud(t, w, h, HUD_SCORES, 'desktop');
      await t.page.setViewportSize({ width: 1280, height: 800 });
      await t.game('newGame', { mode: 'springs' }); await t.game('setState', { score: 12345, springs: 46 }); await t.waitFrames(2);
      await t.shot('C4-06-springs-hud-1280');
    },
  },
);

// ---------------------------------------------------------------------- C4-06: the text the canvas prints (heat label, goal line) can be read and checked
const canvasText = t => t.game('act', 'canvasText');
const find = (c, re) => c.texts.find(x => re.test(x.text));

tests.push(
  {
    name: 'C4-06 the heat label on the canvas reads the temperature, in 12 px or more, inside its strip',
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('newGame', { mode: 'classic', seed: 4 });
      await t.game('setState', { heat: 6 });
      let c = await canvasText(t);
      t.expect(c.texts.length > 3, 'the canvas printed text: ' + c.texts.length + ' pieces');
      const label = c.land ? find(c, /^102°$/) : find(c, /^Heat 102°F$/);
      t.expect(label, 'the heat reading 102 degrees is on the canvas (' + (c.land ? 'beside the board' : 'in the strip') + '): ' + c.texts.map(x => x.text).join(' | '));
      if (c.land) t.expect(find(c, /^HEAT$/), 'the word HEAT is above the reading');
      else t.expect(label.x + label.width <= c.info.x + c.info.w - 14, 'the heat label stays left of the era name');
      for (const x of c.texts.filter(x => /°|HEAT|Heat|×/.test(x.text))) t.expect(x.size >= 12, 'heat text "' + x.text + '" is 12 px or more: ' + x.size);
      await t.game('setState', { heat: 12 });
      c = await canvasText(t);
      t.expect(c.land ? find(c, /^143°$/) : find(c, /^Heat Boiling$/), 'boiling water is labelled');
      await t.game('setState', { heat: 0 });
      c = await canvasText(t);
      t.expect(c.land ? find(c, /^60°$/) : find(c, /^Heat 60°F$/), 'cold water reads 60 degrees');
    },
  },
  {
    name: 'C4-06 the goal line on the canvas names the goal of each mode and fits its strip',
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('newGame', { mode: 'springs', seed: 4 });
      await t.game('setState', { springs: 12 });
      let c = await canvasText(t);
      let g = find(c, /Springs opened 12 \/ 47/);
      t.expect(g, 'Springs prints its count: ' + c.texts.map(x => x.text).join(' | '));
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      c = await canvasText(t);
      g = find(c, /Daily Soak · Nov 12/);
      t.expect(g, 'the Daily goal line names the day: ' + c.texts.map(x => x.text).join(' | '));
      if (!c.land) t.expect(g.x + g.width <= c.info.x + c.info.w - 14 + 0.5 && g.size >= 12, 'the Daily line fits its strip at 12 px or more: ' + g.size + ' px, right edge ' + (g.x + g.width).toFixed(0) + ' of ' + (c.info.x + c.info.w - 14).toFixed(0));
      await t.game('newGame', { mode: 'classic', seed: 4 });
      await t.game('setState', { groups: 7 });
      c = await canvasText(t);
      t.expect(find(c, /Lines 7/), 'Classic prints its lines: ' + c.texts.map(x => x.text).join(' | '));
      const lv = await t.game('getLevels');
      await t.game('newGame', { mode: 'trail', level: lv.find(l => l.name === 'Thermal Water Cascade').id });
      c = await canvasText(t);
      g = find(c, /piece/);
      t.expect(g && /left|done/.test(g.text), 'the Trail goal line counts what is left: ' + (g && g.text));
      if (!c.land) t.expect(g.x + g.width <= c.info.x + c.info.w - 14 + 0.5, 'the Trail line fits its strip');
    },
  },
);

// ---------------------------------------------------------------------- S1-08: after a click on a HUD button, the keys play the board
tests.push(
  {
    name: 'S1-08 after clicking Sound with the mouse, the arrows and Enter place a piece instead of pressing Sound again',
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'setting', 'sound', true);
      await t.game('newGame', { mode: 'classic', seed: 11 });
      const before = await t.state();
      await t.page.click('#b-sound');
      t.equal((await t.game('act', 'save')).settings.sound, false, 'the click turned Sound off');
      t.equal(await t.page.evaluate(() => document.activeElement && document.activeElement.id), 'cv', 'the board has the keyboard again');
      await t.page.keyboard.press('ArrowDown');
      await t.page.keyboard.press('ArrowRight');
      await t.page.keyboard.press('Enter');
      const after = await t.state();
      t.equal(after.placed, before.placed + 1, 'Enter placed the piece');
      t.equal((await t.game('act', 'save')).settings.sound, false, 'Enter did not press Sound a second time');
    },
  },
  {
    name: 'S1-08 after Pause and Resume with the mouse, the keys place a piece',
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('newGame', { mode: 'classic', seed: 12 });
      const before = await t.state();
      await t.page.click('#b-pause');
      await t.page.click('#b-resume');
      t.equal(await t.page.evaluate(() => document.activeElement && document.activeElement.id), 'cv', 'the board has the keyboard again');
      await t.page.keyboard.press('ArrowDown');
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).placed, before.placed + 1, 'Enter placed the piece');
    },
  },
);

// ---------------------------------------------------------------------- S4-10: Settings in the bathhouse's own materials
tests.push(
  {
    name: 'S4-10 Settings has brass toggles, enamel pills and leaded-glass corners, and they still work',
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      for (const scheme of ['light', 'dark']) {
        await t.game('act', 'setting', 'theme', scheme);
        t.equal(await t.page.evaluate(() => document.documentElement.classList.contains('theme-dark')), scheme === 'dark', scheme + ': the menu theme is applied');
        await t.game('scene', 'settings');
        await t.waitForAnimations();
        const info = await t.page.evaluate(() => {
          const cb = document.getElementById('s-music'), sel = document.getElementById('s-difficulty'), panel = document.querySelector('#sc-settings .panel');
          const cs = getComputedStyle(cb), ss = getComputedStyle(sel), ps = getComputedStyle(panel), knob = getComputedStyle(cb, '::before');
          const r = cb.getBoundingClientRect(), pr = sel.getBoundingClientRect();
          return { cbAppearance: cs.appearance, cbRadius: parseFloat(cs.borderTopLeftRadius), cbW: r.width, cbH: r.height, checked: cb.checked, knob: knob.transform, knobContent: knob.content,
            selAppearance: ss.appearance, selRadius: parseFloat(ss.borderTopLeftRadius), selH: pr.height, selBorder: ss.borderTopColor, panelImg: ps.backgroundImage, panelBgSize: ps.backgroundSize,
            rowH: cb.closest('.set').getBoundingClientRect().height };
        });
        t.equal(info.cbAppearance, 'none', scheme + ': the checkbox is drawn by the game, not the system');
        t.expect(info.cbRadius >= info.cbH / 2 - 0.5 && info.cbW > info.cbH * 1.5, scheme + ': the checkbox is a pill-shaped toggle ' + info.cbW + 'x' + info.cbH);
        t.expect(info.knobContent !== 'none', scheme + ': the toggle has a knob');
        t.equal(info.selAppearance, 'none', scheme + ': the select is drawn by the game');
        t.expect(info.selRadius >= info.selH / 2 - 0.5 && info.selH >= 44, scheme + ': the select is an enamel pill at least 44 px tall: ' + info.selH);
        t.expect(info.rowH >= 44, scheme + ': the row is a touch target at least 44 px tall: ' + info.rowH);
        t.equal((info.panelImg.match(/data:image\/svg\+xml/g) || []).length, 4, scheme + ': the card has four corner diamonds');
        // The knob slides when the switch changes, and the switch still changes the setting (by its label too).
        const before = (await t.game('act', 'save')).settings.music;
        await t.page.click('#s-music');
        t.equal((await t.game('act', 'save')).settings.music, !before, scheme + ': clicking the toggle changes Music');
        const moved = await t.page.evaluate(() => getComputedStyle(document.getElementById('s-music'), '::before').transform);
        t.expect(moved !== info.knob, scheme + ': the knob moved with the switch (' + info.knob + ' to ' + moved + ')');
        await t.page.click('#sc-settings .set:has(#s-music) span');
        t.equal((await t.game('act', 'save')).settings.music, before, scheme + ': clicking the label changes it back');
        await t.page.focus('#s-music'); await t.page.keyboard.press('Tab');
        await t.page.focus('#s-music');
        const ring = await t.page.evaluate(() => getComputedStyle(document.getElementById('s-music')).outlineStyle);
        t.expect(ring !== 'none', scheme + ': a focused toggle shows a focus ring');
        await t.checkLayout();
        await t.shot('S4-10-settings-' + scheme);
      }
      await t.game('act', 'setting', 'theme', 'light');
      await t.game('scene', 'title');
      await t.game('newGame', { mode: 'classic', seed: 2 });
      await t.game('act', 'pause');
      await t.waitForAnimations();
      await t.shot('S4-10-pause');
    },
  },
);

// ---------------------------------------------------------------------- C4-05: nothing the speakers get passes 0.95, however loud the moment
tests.push(
  {
    name: 'C4-05 the soft ceiling leaves quiet sound alone and holds the loudest under 0.95',
    viewports: ['desktop'],
    async run(t) {
      // The ceiling alone (its curve is the same on every machine, so this cannot fail by luck): a sine through it, rendered offline.
      const peakThrough = amp => t.page.evaluate(async a => {
        const oc = new OfflineAudioContext(1, 22050, 44100);
        const o = oc.createOscillator(), g = oc.createGain(), lim = makeLimiter(oc);
        o.frequency.value = 220; g.gain.value = a;
        o.connect(g); g.connect(lim.output); lim.output.connect(oc.destination); o.start();
        const d = (await oc.startRendering()).getChannelData(0);
        let m = 0; for (let i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
        return m;
      }, amp);
      const quiet = await peakThrough(0.5);
      t.expect(Math.abs(quiet - 0.5) < 0.01, 'a sine of 0.5 comes out at 0.5: ' + quiet.toFixed(3));
      for (const amp of [0.9, 1.0, 2.0, 5.0]) {
        const out = await peakThrough(amp);
        t.expect(out <= 0.941, 'a sine of ' + amp + ' is held at ' + out.toFixed(3) + ' (under 0.95)');
      }
      t.expect((await peakThrough(0.8)) > (await peakThrough(0.5)), 'louder in is still louder out');
      // The whole chain, as the player hears it: the live tap after the last node stays under 0.95 on the busiest mixes at maximum volume.
      const list = await t.game('audioList');
      for (const id of list.mix) {
        const r = await t.page.evaluate(([n, o]) => window.__game.audioRender(n, 14, false, o), ['mix:' + id, { volume: 1, musicVol: 1, ambVol: 1 }]);
        t.expect(r.peak <= 0.941, id + ': the busiest mix at maximum peaks ' + r.peak + ' (under 0.95)');
      }
      const m = await t.page.evaluate(() => ({ scale: MASTER_SCALE, vol: defaultSave().settings.volume }));
      t.equal(m.scale, 1.25, 'MASTER_SCALE stays 1.25: at 1.15 the pick and invalid cues fall under 0.2');
    },
  },
  {
    name: 'C4-05 the live chain ends in the ceiling: the last node before the speakers is the one probes read',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'audio', 'click');
      await t.page.waitForFunction(() => AU.ctx && AU.ctx.state === 'running', null, { timeout: 8000 });
      const info = await t.page.evaluate(() => ({ type: AU.limiter.constructor.name, curve: AU.limiter.curve ? AU.limiter.curve.length : 0 }));
      t.equal(info.type, 'WaveShaperNode', 'AU.limiter is the ceiling');
      t.equal(info.curve, 2049, 'with its curve');
    },
  },
);
