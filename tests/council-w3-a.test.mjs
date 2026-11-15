// Council wave 3, batch A: saves, lifecycle and robustness (S1-03, S3-07, S5-07, S5-09, S6-03, S6-07, S6-16, S6-17, S3-04).
const KEY = 'hs-thermal-blocks-v1';

const empty = () => new Array(81).fill(0);
// a board where one o1 at the top-left corner clears a row
const rowReady = () => { const b = empty(); for (let c = 1; c < 9; c++) b[c] = 1; return b; };
const setTray = ids => ({ tray: ids.map(id => (id ? { id } : null)) });
const readSave = t => t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const storeAndReload = async (t, save) => {
  await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, save]);
  await t.reload();
  await t.waitFrames(3);
};
const vib = t => t.page.evaluate(() => window.__vib.slice());
const clearVib = t => t.page.evaluate(() => { window.__vib.length = 0; });
const recordVibrate = () => { window.__vib = []; Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: p => { window.__vib.push(p); return true; } }); };

export const tests = [
  // ------------------------------------------------------------------ S1-03 haptics
  {
    name: 'S1-03 a drop, a clear and a blocked drop each buzz once, even with the sound off',
    initScript: recordVibrate,
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'sound', false);
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o4']) });
      await clearVib(t);
      // a placement that clears nothing: one short pulse
      let r = await t.game('act', 'place', 2, 4, 4);
      t.expect(r.ok, 'o4 placed');
      t.equal(JSON.stringify(await vib(t)), '[10]', 'a plain drop is a single 10 ms pulse');
      // a placement that clears one group: place pulse, then a clear pulse
      await clearVib(t);
      r = await t.game('act', 'place', 0, 0, 0);
      t.equal(r.G, 1, 'one group cleared');
      t.equal(JSON.stringify(await vib(t)), '[10,[18]]', 'place pulse then one 18 ms clear pulse');
      // an illegal placement: two short pulses
      await clearVib(t);
      r = await t.game('act', 'place', 1, 4, 4);
      t.expect(!r.ok, 'blocked');
      t.equal(JSON.stringify(await vib(t)), '[[12,40,12]]', 'a blocked drop buzzes twice');
    },
  },
  {
    name: 'S1-03 a bigger clear buzzes longer, capped at four pulses',
    initScript: recordVibrate,
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      const board = empty(); for (let r = 0; r < 3; r++) for (let c = 0; c < 9; c++) if (!(r === 0 && c === 0) && !(r === 1 && c === 0) && !(r === 2 && c === 0)) board[r * 9 + c] = 1;
      // column 0 of rows 0-2 is open: an i3v there clears three rows and the left pool column at once
      await t.game('setState', { board, ...setTray(['i3v', 'o1', 'o1']) });
      await clearVib(t);
      const r = await t.game('act', 'place', 0, 0, 0);
      t.expect(r.G >= 3, 'three or more groups cleared (' + r.G + ')');
      const calls = await vib(t);
      const clear = calls[calls.length - 1];
      t.equal(clear.length, 2 * Math.min(4, r.G) - 1, 'pulses follow the group count');
      t.expect(clear.every((v, i) => (i % 2 ? v === 30 : v === 18)), 'pulses of 18 ms with 30 ms gaps');
    },
  },
  {
    name: 'S1-03 Vibration off, or reduced motion, silences the haptics',
    initScript: recordVibrate,
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o4']) });
      await t.game('act', 'setting', 'haptics', false);
      await clearVib(t);
      await t.game('act', 'place', 2, 4, 4);
      t.equal((await vib(t)).length, 0, 'Vibration off: nothing');
      await t.game('act', 'setting', 'haptics', true);
      await t.game('act', 'setting', 'motion', 'reduced');
      await t.game('act', 'place', 0, 0, 0);
      t.equal((await vib(t)).length, 0, 'reduced motion: nothing');
      await t.game('act', 'setting', 'motion', 'full');
      await t.game('act', 'place', 1, 6, 6);
      t.expect((await vib(t)).length > 0, 'full motion and Vibration on: it buzzes again');
    },
  },
  {
    name: 'S1-03 the Vibration switch is in Settings, saved, and hidden where the device cannot vibrate',
    initScript: recordVibrate,
    async run(t) {
      await t.game('scene', 'settings');
      await t.waitFrames(2);
      const box = await t.page.$('#s-haptics');
      t.expect(await box.isVisible(), 'the switch shows');
      t.expect(await box.isChecked(), 'on by default');
      await t.page.uncheck('#s-haptics');
      t.equal((await readSave(t)).settings.haptics, false, 'saved off');
      await t.shot('S1-03-settings');
      await t.checkLayout({ allowScrollY: true });
      await t.reload();
      await t.game('scene', 'settings');
      t.equal(await t.page.isChecked('#s-haptics'), false, 'still off after a reload');
    },
  },
  {
    name: 'S1-03 without navigator.vibrate the switch is hidden and nothing throws',
    initScript: () => { Object.defineProperty(Navigator.prototype, 'vibrate', { configurable: true, value: undefined }); },
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o4']) });
      const r = await t.game('act', 'place', 0, 0, 0);
      t.expect(r.ok && r.G === 1, 'play carries on');
      await t.game('scene', 'settings');
      t.expect(!(await (await t.page.$('#s-haptics')).isVisible()), 'the switch is hidden');
    },
  },
];
