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

  // ------------------------------------------------------------------ S3-07 records trend
  {
    name: 'S3-07 Records shows the last ten scores per mode with an average, the biggest clear and the longest game',
    async run(t) {
      await t.page.evaluate(k => localStorage.removeItem(k), KEY);
      await t.reload();
      await t.game('scene', 'records');
      let txt = await t.page.textContent('#sc-records');
      t.expect(/Classic\s*No finished games yet/.test(txt), 'an empty history says so');
      t.expect(/Longest game \(pieces placed\)\s*0/.test(txt) && /Biggest clear \(groups at once\)\s*0/.test(txt), 'both new rows show');
      const full = new Array(81).fill(1);
      for (let i = 1; i <= 12; i++) {
        await t.game('newGame', { mode: 'classic' });
        await t.game('act', 'setting', 'tipsSeen', true);
        await t.game('setState', { score: i * 100, placed: 10 + i, bestG: i === 5 ? 4 : 1, board: full });
        await t.page.waitForFunction(() => window.__game.getState().over, null, { timeout: 3000 });
      }
      const save = await readSave(t);
      t.equal(JSON.stringify(save.stats.recent.classic), JSON.stringify([300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]), 'ten kept, oldest dropped');
      t.equal(save.stats.bestCombo, 4, 'biggest clear'); t.equal(save.stats.longest, 22, 'longest game');
      await t.game('scene', 'records');
      txt = await t.page.textContent('#rec-recent');
      t.expect(/Average 750 over the last 10 games\. Newest first: 1,200, 1,100,/.test(txt), 'average and newest-first list (' + txt.slice(0, 120) + ')');
      t.expect(/Springs\s*No finished games yet/.test(txt), 'other modes stay empty');
      t.expect(/Biggest clear \(groups at once\)\s*4/.test(await t.page.textContent('#rec-stats')), 'the biggest clear shows');
      await t.shot('S3-07-records');
      await t.checkLayout({ allowScrollY: true });
      await t.reload();
      await t.game('scene', 'records');
      t.expect(/Newest first: 1,200/.test(await t.page.textContent('#rec-recent')), 'the history survives a reload');
    },
  },
  {
    name: 'S3-07 a save from before the history existed keeps everything and starts the history empty',
    async run(t) {
      await storeAndReload(t, { v: 1, settings: { sound: true, volume: 0.7 }, best: { classic: 1234, springs: 55, daily: { '2026-11-01': 300 } }, trail: { done: ['display-spring'], stars: {} }, stats: { games: 20, lines: 100, bestHeat: 9, springs: 12 }, resume: null });
      await t.game('scene', 'records');
      const txt = await t.page.textContent('#sc-records');
      t.expect(/Classic best\s*1,234/.test(txt) && /Games played\s*20/.test(txt), 'old records show');
      t.expect(/Classic\s*No finished games yet/.test(txt), 'history starts empty');
    },
  },

  // ------------------------------------------------------------------ S5-07 cues for heat tiers, no-room, new best, fact card, pause, resume
  {
    name: 'S5-07 the six new cues are listed and each stays inside the cue range',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      for (const cue of ['heat', 'warn', 'best', 'card', 'pause', 'resume']) {
        t.expect(list.cues.includes(cue), cue + ' is a listed cue');
        const peaks = [];
        for (let i = 0; i < 5; i++) peaks.push((await t.page.evaluate(n => window.__game.audioRender(n, 2, false), 'cue:' + cue)).peak);
        peaks.sort((a, b) => a - b);
        t.log(cue + ' peaks ' + peaks.join(', '));
        t.expect(peaks[2] >= 0.2 && peaks[2] <= 0.45, cue + ': median peak ' + peaks[2] + ' is within 0.2 to 0.45');
      }
    },
  },
  {
    name: 'S5-07 crossing a heat tier sounds the heat cue; a clear inside a tier does not',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'setting', 'sound', false);   // the cue log records the cue whether or not it is heard
      await t.game('setState', { board: rowReady(), heat: 4, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'clearCues');
      await t.game('act', 'place', 0, 0, 0);   // heat 4 -> 5 = 90 F, "Warm"
      await t.page.waitForFunction(() => window.__game.act('cues').includes('heat'), null, { timeout: 3000 });
      await t.game('setState', { board: rowReady(), heat: 5, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'clearCues');
      await t.game('act', 'place', 0, 0, 0);   // heat 5 -> 6 = 97 F, still "Warm"
      await t.page.waitForFunction(() => window.__game.act('cues').includes('clear'), null, { timeout: 3000 });
      await t.page.waitForTimeout(700);        // an absence check: the heat cue would follow the clear by 180 ms
      t.expect(!(await t.game('act', 'cues')).includes('heat'), 'no heat cue inside a tier');
    },
  },
  {
    name: 'S5-07 a piece that no longer fits sounds the warning; a placement that leaves everything fitting does not',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      // one 3x3 hole in the top-left corner and gaps elsewhere in every row, column and pool, so nothing is complete
      const holed = () => { const b = new Array(81).fill(1); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) b[r * 9 + c] = 0; for (let k = 3; k < 9; k++) b[k * 9 + k] = 0; for (const [r, c] of [[0, 3], [0, 6], [3, 0], [6, 0], [4, 7], [7, 4]]) b[r * 9 + c] = 0; return b; };
      await t.game('setState', { board: holed(), ...setTray(['o1', 'o1', 'o9']) });
      t.equal(JSON.stringify((await t.state()).fits), '[true,true,true]', 'everything fits to begin with');
      await t.game('act', 'clearCues');
      const r = await t.game('act', 'place', 0, 1, 1);
      t.expect(r.ok && r.G === 0, 'o1 dropped in the middle of the hole');
      t.equal(JSON.stringify((await t.state()).fits), '[null,true,false]', 'the big piece has lost its room');
      await t.page.waitForFunction(() => window.__game.act('cues').includes('warn'), null, { timeout: 3000 });
      await t.game('setState', { board: new Array(81).fill(0), ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'clearCues');
      await t.game('act', 'place', 0, 4, 4);
      await t.page.waitForFunction(() => window.__game.act('cues').includes('place'), null, { timeout: 3000 });
      await t.page.waitForTimeout(500);
      t.expect(!(await t.game('act', 'cues')).includes('warn'), 'no warning on an open board');
    },
  },
  {
    name: 'S5-07 a new best sounds after the game-over cue; a score that does not beat the best does not',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'clearCues');
      await t.game('setState', { score: 500, board: new Array(81).fill(1) });
      await t.page.waitForFunction(() => { const c = window.__game.act('cues'); return c.includes('over') && c.includes('best'); }, null, { timeout: 6000 });
      const cues = await t.game('act', 'cues');
      t.expect(cues.indexOf('best') > cues.indexOf('over'), 'best follows over');
      await t.game('newGame', { mode: 'classic' });   // the best is now 500
      await t.game('act', 'clearCues');
      await t.game('setState', { score: 100, board: new Array(81).fill(1) });
      await t.page.waitForFunction(() => window.__game.act('cues').includes('over'), null, { timeout: 3000 });
      await t.page.waitForTimeout(1900);               // an absence check: the best cue comes 1.5 s after the end
      t.expect(!(await t.game('act', 'cues')).includes('best'), 'no best cue for a lower score');
    },
  },
  {
    name: 'S5-07 collecting a Trail fact card sounds the card cue once; replaying the puzzle does not',
    async run(t) {
      const SOL = JSON.parse((await import('node:fs')).readFileSync(new URL('../tools/solutions.json', import.meta.url), 'utf8'));
      const solve = async () => {
        await t.game('newGame', { mode: 'trail', level: 'display-spring' });
        await t.game('act', 'setting', 'tipsSeen', true);
        await t.game('act', 'clearCues');
        for (const [pid, r, c] of SOL['display-spring'].solution) {
          const s = await t.state();
          await t.game('act', 'place', s.tray.findIndex(x => x && x.id === pid), r, c);
        }
      };
      await solve();
      await t.page.waitForFunction(() => window.__game.act('cues').includes('card'), null, { timeout: 6000 });
      const first = await t.game('act', 'cues');
      t.expect(first.indexOf('card') > first.indexOf('win'), 'the card follows the win cue');
      await solve();
      await t.page.waitForFunction(() => window.__game.act('cues').includes('win'), null, { timeout: 3000 });
      await t.page.waitForTimeout(1700);
      t.expect(!(await t.game('act', 'cues')).includes('card'), 'a card already collected is silent');
    },
  },
  {
    name: 'S5-07 Pause and Resume each have their own cue, from the button and from Escape',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'clearCues');
      await t.page.click('#b-pause');
      t.equal(JSON.stringify(await t.game('act', 'cues')), '["pause"]', 'the Pause button sounds pause, not the generic click');
      await t.game('act', 'clearCues');
      await t.page.click('#b-resume');
      t.equal(JSON.stringify(await t.game('act', 'cues')), '["resume"]', 'Resume sounds resume');
      await t.page.keyboard.press('Escape');
      await t.page.keyboard.press('Escape');
      t.equal(JSON.stringify(await t.game('act', 'cues')), '["resume","pause","resume"]', 'Escape pauses and resumes with the same cues');
    },
  },
];
