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
