// Council wave 3, batch A: saves, lifecycle and robustness (S1-03, S3-07, S5-07, S5-09, S6-03, S6-07, S6-16, S6-17, S3-04).
import { loadRules } from '../tools/rules-node.mjs';
import { measure } from '../tools/difficulty-sim.mjs';

const R = loadRules();
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
      // a placement that clears one group: single non-clobbering unified clearing-drop pattern [10, 35, 18] (OQ-WF4-01 / OQ-WF6-03)
      await clearVib(t);
      r = await t.game('act', 'place', 0, 0, 0);
      t.equal(r.G, 1, 'one group cleared');
      t.equal(JSON.stringify(await vib(t)), '[[10,35,18]]', 'unified clearing-drop pattern [10, 35, 18] without clobbering');
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
      t.equal(calls.length, 1, 'single unified clearing-drop vibrate call (OQ-WF4-01 / OQ-WF6-03)');
      const pat = calls[0];
      t.equal(pat.slice(0, 2), [10, 35], 'starts with 10 ms place tap and 35 ms gap');
      const clear = pat.slice(2);
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

  // ------------------------------------------------------------------ S5-09 the first gesture starts the audio, and its cue is not lost
  {
    name: 'S5-09 nothing plays before a gesture, then a click on a dead corner of the title starts the title music',
    async run(t) {
      t.equal(JSON.stringify(await t.game('act', 'audioState')), '{"kit":false}', 'no audio before any gesture');
      if (t.viewport === 'mobile') await t.tap([4, 4]); else await t.page.mouse.click(4, 4);
      await t.page.waitForFunction(() => { const a = window.__game.act('audioState'); return a.kit && a.state === 'running' && a.music === 'title'; }, null, { timeout: 5000 });
      const a = await t.game('act', 'audioState');
      t.expect(a.musicLevel > 0, 'the title music is switched on (' + a.musicLevel + ')');
    },
  },
  {
    name: 'S5-09 a key press also starts the audio',
    viewports: ['desktop'],
    async run(t) {
      await t.page.keyboard.press('Tab');
      await t.page.waitForFunction(() => { const a = window.__game.act('audioState'); return a.kit && a.state === 'running'; }, null, { timeout: 5000 });
    },
  },
  {
    name: 'S5-09 the first click cue starts a beat after the context does; later cues are immediate',
    async run(t) {
      await t.page.click('[data-mode=classic]');
      await t.page.waitForFunction(() => window.__game.act('audioState').kit, null, { timeout: 5000 });
      const first = await t.game('act', 'audioState');
      t.expect(first.lead >= 0.1, 'the first cue was scheduled ' + first.lead + ' s ahead');
      await t.page.waitForFunction(() => { window.__game.act('audio', 'click'); return window.__game.act('audioState').lead < 0.05; }, null, { timeout: 8000 });
      t.expect(true, 'once the clock has run, cues go out at once');
    },
  },

  // ------------------------------------------------------------------ S6-03 a saved run is not thrown away by a slip
  {
    name: 'S6-03 Play Classic over a saved run asks first; keeping it changes nothing, replacing it starts a new game',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o4']) });
      await t.game('act', 'place', 0, 0, 0);
      const kept = (await readSave(t)).resume;
      t.expect(kept && kept.score > 0, 'a run is saved');
      await t.game('scene', 'title');
      await t.page.click('#sc-title [data-mode=classic]');
      t.expect(await t.page.isVisible('#sc-confirm'), 'the question shows');
      const text = await t.page.textContent('#sc-confirm');
      t.expect(text.includes('Your saved Classic run at ' + kept.score + ' points will be replaced.'), 'it names what is at stake (' + text.replace(/\s+/g, ' ') + ')');
      t.equal(await t.page.evaluate(() => document.activeElement.id), 'cf-no', 'the safe answer has the focus');
      await t.shot('S6-03-title-confirm');
      await t.page.click('#cf-no');
      t.expect(!(await t.page.isVisible('#sc-confirm')), 'the card closes');
      t.equal((await t.state()).scene, 'title', 'still on the title');
      t.equal(JSON.stringify((await readSave(t)).resume), JSON.stringify(kept), 'the saved run is untouched');
      await t.page.click('#sc-title [data-mode=classic]');
      await t.page.keyboard.press('Escape');
      t.expect(!(await t.page.isVisible('#sc-confirm')) && (await t.state()).scene === 'title', 'Escape means no');
      t.equal(JSON.stringify((await readSave(t)).resume), JSON.stringify(kept), 'and the run is untouched');
      await t.page.click('#sc-title [data-mode=springs]');
      t.expect(!(await t.page.isVisible('#sc-confirm')), 'CD-WF6-02: switching to Springs preserves Classic without asking');
      let s = await t.state();
      t.expect(s.scene === 'game' && s.mode === 'springs' && s.score === 0, 'Springs starts cleanly in its own slot');
      t.equal(JSON.stringify((await readSave(t)).resume), JSON.stringify(kept), 'Classic resume stays intact across cross-mode switch');
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o4']) });
      await t.game('act', 'place', 0, 0, 0);
      const runStore = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-thermal-blocks-v1-run') || 'null'));
      t.expect(runStore && runStore.springs && runStore.springs.state && runStore.springs.state.score > 0, 'Springs run is stored in its own RUN_KEY sub-slot');
      t.equal(JSON.stringify((await readSave(t)).resume), JSON.stringify(kept), 'Classic resume still untouched after Springs progress');
      await t.game('scene', 'title');
      await t.page.click('#sc-title [data-mode=springs]');
      t.expect(await t.page.isVisible('#sc-confirm'), 'same-mode Springs overwrite still asks');
      t.expect((await t.page.textContent('#sc-confirm')).includes('Your saved Springs run'), 'names the saved Springs run it would replace');
      await t.page.click('#cf-yes');
      s = await t.state();
      t.expect(s.scene === 'game' && s.mode === 'springs' && s.score === 0, 'Yes starts a fresh Springs game');
      t.equal(JSON.stringify((await readSave(t)).resume), JSON.stringify(kept), 'Classic resume still untouched after replacing Springs');
      await t.game('scene', 'title');
      await t.page.click('#sc-title [data-mode=classic]');
      t.expect(await t.page.isVisible('#sc-confirm'), 'same-mode Classic overwrite still asks');
      await t.page.click('#cf-yes');
      s = await t.state();
      t.expect(s.scene === 'game' && s.mode === 'classic' && s.score === 0, 'Yes starts the new Classic game');
      t.equal((await readSave(t)).resume, null, 'the old Classic run is gone');
    },
  },
  {
    name: 'S6-03 with no saved run, or one with nothing placed, Play Classic starts at once',
    async run(t) {
      await t.page.evaluate(k => localStorage.removeItem(k), KEY);
      await t.reload();
      await t.page.click('#sc-title [data-mode=classic]');
      t.expect(!(await t.page.isVisible('#sc-confirm')) && (await t.state()).scene === 'game', 'no question with nothing to lose');
    },
  },
  {
    name: 'S6-03 pause Restart asks when there is progress, and works from the keyboard',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'pause');
      await t.page.click('#b-restart');
      t.expect(!(await t.page.isVisible('#sc-confirm')) && (await t.state()).scene === 'game', 'a game with no piece placed restarts without asking');
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o4']) });
      await t.game('act', 'place', 0, 0, 0);
      const before = await t.state();
      await t.game('act', 'pause');
      await t.page.click('#b-restart');
      t.expect(await t.page.isVisible('#sc-confirm'), 'the question shows');
      t.expect((await t.page.textContent('#cf-body')).includes('You are at ' + before.score.toLocaleString('en-US') + ' points'), 'it says the score at stake');
      await t.page.keyboard.press('Tab');
      t.equal(await t.page.evaluate(() => document.activeElement.id), 'cf-yes', 'Tab moves to the other answer');
      await t.page.keyboard.press('Tab');
      t.equal(await t.page.evaluate(() => document.activeElement.id), 'cf-no', 'and back: focus stays inside the card');
      await t.page.keyboard.press('Escape');
      let s = await t.state();
      t.expect(s.scene === 'pause' && s.score === before.score, 'Escape keeps the game, still paused');
      await t.page.click('#b-restart');
      await t.page.click('#cf-yes');
      s = await t.state();
      t.expect(s.scene === 'game' && s.score === 0 && s.placed === 0, 'Restart starts over');
      await t.shot('S6-03-restart-done');
    },
  },

  // ------------------------------------------------------------------ S6-07 favicon, theme colour and manifest
  {
    name: 'S6-07 the page names its own icon, theme colour and manifest, all inline',
    viewports: ['desktop'],
    async run(t) {
      const h = await t.page.evaluate(() => ({
        theme: document.querySelector('meta[name=theme-color]') && document.querySelector('meta[name=theme-color]').content,
        icon: document.querySelector('link[rel~=icon]') && document.querySelector('link[rel~=icon]').getAttribute('href'),
        manifest: document.querySelector('link[rel=manifest]') && document.querySelector('link[rel=manifest]').getAttribute('href'),
      }));
      t.equal(h.theme, '#131C1E', 'theme-color is the warm bathhouse dark ground of the menus');
      t.expect(h.icon && h.icon.startsWith('data:image/svg+xml,'), 'an inline icon, so no /favicon.ico request');
      t.expect(decodeURIComponent(h.icon.slice('data:image/svg+xml,'.length)).includes('<rect'), 'the icon is a drawing of tiles');
      t.expect(h.manifest && h.manifest.startsWith('data:application/manifest+json,'), 'an inline manifest');
      const m = JSON.parse(decodeURIComponent(h.manifest.slice('data:application/manifest+json,'.length)));
      t.equal(m.name, 'Thermal Blocks', 'the manifest names the game');
      t.equal(m.display, 'standalone', 'and opens full screen from a home-screen icon');
      t.equal(m.theme_color, '#131C1E', 'with the same warm bathhouse theme colour');
      t.expect(m.icons.length > 0 && m.icons[0].src.startsWith('data:image/svg+xml,'), 'and carries the icon');
      const cdp = await t.page.context().newCDPSession(t.page);   // the browser itself reads the manifest without complaint
      const parsed = await cdp.send('Page.getAppManifest');
      t.equal(parsed.errors.length, 0, 'Chromium finds no manifest errors');
      t.expect(JSON.parse(parsed.data).name === 'Thermal Blocks', 'and reads the name from it');
    },
  },

  // ------------------------------------------------------------------ S6-16 M and P outside the board, and the Undo badge
  {
    name: 'S6-16 M mutes and unmutes on the pause card and on the game-over card, not only on the board',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'pause');
      t.equal((await t.state()).scene, 'pause', 'paused');
      await t.page.keyboard.press('m');
      t.equal((await readSave(t)).settings.sound, false, 'M on the pause card turns the sound off');
      t.equal(await t.page.getAttribute('#b-sound', 'aria-pressed'), 'false', 'and the Sound button says so');
      await t.page.keyboard.press('M');
      t.equal((await readSave(t)).settings.sound, true, 'M again turns it back on');
      await t.game('act', 'resume');
      await t.game('setState', { board: new Array(81).fill(1) });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 5000 });
      await t.page.keyboard.press('m');
      t.equal((await readSave(t)).settings.sound, false, 'M on the game-over card mutes too');
    },
  },
  {
    name: 'S6-16 P pauses and resumes, and does nothing on the title or inside a Settings control',
    async run(t) {
      await t.page.keyboard.press('p');
      t.equal((await t.state()).scene, 'title', 'nothing on the title');
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.page.keyboard.press('p');
      t.equal((await t.state()).scene, 'pause', 'P pauses');
      await t.page.keyboard.press('P');
      t.equal((await t.state()).scene, 'game', 'P resumes');
      await t.game('act', 'pause');
      await t.page.click('#sc-pause [data-go=settings]');
      await t.page.focus('#s-undo');
      await t.page.keyboard.press('p');
      t.equal((await t.state()).scene, 'settings', 'typing P in a Settings control does not pause or resume');
    },
  },
  {
    name: 'S6-16 the Undo badge counts the undos that work: 3, still 3 after a drop, 2 after using one',
    async run(t) {
      await t.game('act', 'setting', 'undo', 3);
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      t.equal(await t.page.textContent('#h-undo'), '3', 'three at the start');
      await t.game('setState', { board: new Array(81).fill(0), ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 4, 4);
      t.equal(await t.page.textContent('#h-undo'), '3', 'a drop spends none');
      await t.game('act', 'undo');
      t.equal(await t.page.textContent('#h-undo'), '2', 'one used');
      await t.game('act', 'place', 0, 4, 4);
      await t.game('act', 'undo');
      await t.game('act', 'place', 0, 4, 4);
      await t.game('act', 'undo');
      t.equal(await t.page.textContent('#h-undo'), '0', 'none left after three');
      t.expect(await t.page.isDisabled('#b-undo'), 'and the button is disabled');
    },
  },

  // ------------------------------------------------------------------ S3-04 difficulty
  {
    name: 'S3-04 Standard deals exactly what the game dealt before the option existed',
    node: true,
    async run(t) {
      const seq = (mode, score, diff) => {
        const g = R.freshGame(mode); g.mode = mode; g.score = score; g.rng = 4242;
        if (diff) g.diff = diff;
        const out = []; for (let i = 0; i < 24; i++) out.push(R.pickPiece(g)); return out.join(',');
      };
      // the first eight pieces of each deal, recorded from the wave-2 rules (before difficulty) with the same seed
      t.equal(seq('classic', 2500, 'standard').split(',').slice(0, 8).join(','), 't4a,c3d,o9,j4b,i5h,c3d,c3c,o4', 'Classic at 2,500: Standard is the deal recorded before the option');
      t.equal(seq('springs', 0, 'standard').split(',').slice(0, 8).join(','), 'o4,i3v,v5d,i4v,j4b,c3a,i3v,c3c', 'Springs: Standard is the deal recorded before the option');
      for (const score of [0, 9000]) t.equal(seq('classic', score, 'standard'), seq('classic', score), 'Classic at ' + score + ': Standard equals no setting');
      for (const mode of ['daily', 'trail']) for (const diff of ['relaxed', 'master']) t.equal(seq(mode, 5000, diff), seq(mode, 5000), mode + ' ignores ' + diff);
    },
  },
  {
    name: 'S3-04 Relaxed deals fewer big pieces and more helpers than Standard, and Master the reverse, in every era',
    node: true,
    async run(t) {
      const HARD = ['x5', 'u5a', 'u5b', 'v5a', 'v5b', 'v5c', 'v5d', 'o9', 'r6h', 'r6v', 'i5h', 'i5v'], EASY = ['o1', 'i2h', 'i2v'];
      const share = (mode, score, diff, ids) => { const g = R.freshGame(mode); g.mode = mode; g.score = score; g.diff = diff; g.rng = 99; let k = 0; for (let i = 0; i < 6000; i++) if (ids.includes(R.pickPiece(g))) k++; return k / 6000; };
      // 6000 draws with a fixed seed: the same answer every run, and neighbouring shares differ by far more than the draw noise (a hard-piece gap of 3 points is about 10 standard errors; a helper ratio of 1.3 on a share of 0.006 is about 5)
      for (const [mode, scores] of [['classic', [0, 400, 1000, 2000, 3500, 5500, 8000]], ['springs', [0]]]) for (const score of scores) {
        const h = ['relaxed', 'standard', 'master'].map(d => share(mode, score, d, HARD)), e = ['relaxed', 'standard', 'master'].map(d => share(mode, score, d, EASY));
        t.log(mode + ' ' + score + ': hard ' + h.map(v => v.toFixed(3)).join(' / ') + '; easy ' + e.map(v => v.toFixed(3)).join(' / '));
        t.expect(h[0] + 0.03 < h[1] && h[1] + 0.03 < h[2], mode + ' ' + score + ': big pieces get likelier relaxed -> standard -> master');
        t.expect(e[0] > e[1] * 1.3 && e[1] > e[2] * 1.3, mode + ' ' + score + ': helpers get rarer relaxed -> standard -> master');
      }
    },
  },
  {
    name: 'S3-04 the mercy deal is strongest at Relaxed and thinnest at Master',
    node: true,
    async run(t) {
      const rescued = (diff, score) => {
        let saved = 0;
        for (let seed = 1; seed <= 400; seed++) {
          const g = R.freshGame('classic'); g.rng = seed; g.score = score; g.diff = diff;
          g.board = new Array(81).fill(1); g.board[40] = 0;   // only o1 fits
          R.dealTray(g);
          if (g.tray.some(x => R.fitsAnywhere(g.board, x.id))) saved++;
        }
        return saved;
      };
      for (const score of [0, 8000]) {
        const [a, b, c] = ['relaxed', 'standard', 'master'].map(d => rescued(d, score));
        t.log('rescued of 400 at ' + score + ': relaxed ' + a + ', standard ' + b + ', master ' + c);
        t.expect(a >= b && b >= c, 'at ' + score + ' rescues go relaxed >= standard >= master');
      }
      t.expect(rescued('relaxed', 8000) > rescued('standard', 8000) * 3, 'in the last era Relaxed still rescues several times what Standard does');
      t.expect(rescued('master', 8000) < rescued('standard', 0), 'and Master rescues less late than Standard does early');
    },
  },
  {
    name: 'S3-04 a greedy bot lasts longest at Relaxed and least at Master, and wins Springs more often',
    node: true,
    async run(t) {
      const rows = measure(['relaxed', 'standard', 'master'], 20);
      const get = (mode, diff) => rows.find(r => r.mode === mode && r.diff === diff);
      for (const r of rows) t.log(r.mode + ' ' + r.diff + ': moves p10/p50/p90 ' + r.moves.join('/') + ', score ' + r.score.join('/') + (r.won === null ? '' : ', won ' + r.won + '/' + r.games));
      const m = d => get('classic', d).moves[1];
      t.expect(m('relaxed') > m('standard') * 1.3 && m('standard') > m('master') * 1.15, 'Classic median game length: ' + m('relaxed') + ' > ' + m('standard') + ' > ' + m('master'));
      const w = d => get('springs', d).won;
      t.expect(w('relaxed') >= w('standard') && w('standard') > w('master'), 'Springs wins out of 20: ' + w('relaxed') + ', ' + w('standard') + ', ' + w('master'));
    },
  },
  {
    name: 'S3-04 Difficulty is in Settings; a new Classic or Springs game takes it, Daily Soak and Spring Trail do not',
    async run(t) {
      await t.game('scene', 'settings');
      t.equal(await t.page.inputValue('#s-difficulty'), 'standard', 'Standard by default');
      await t.page.selectOption('#s-difficulty', 'master');
      t.equal((await readSave(t)).settings.difficulty, 'master', 'saved');
      await t.shot('S3-04-settings');
      await t.checkLayout({ allowScrollY: true });
      await t.reload();
      await t.game('scene', 'settings');
      t.equal(await t.page.inputValue('#s-difficulty'), 'master', 'kept after a reload');
      await t.game('newGame', { mode: 'classic' });
      let s = await t.state();
      t.equal(s.diff, 'master', 'a new Classic game is Master');
      t.expect(/Classic · Master/.test(await t.page.textContent('#h-mode')) || t.viewport === 'mobile', 'the header says so');
      await t.game('newGame', { mode: 'springs' });
      t.equal((await t.state()).diff, 'master', 'Springs too');
      await t.game('newGame', { mode: 'daily' });
      t.equal((await t.state()).diff, 'standard', 'Daily Soak is the same for everyone');
      await t.game('newGame', { mode: 'trail', level: 'display-spring' });
      t.equal((await t.state()).diff, 'standard', 'and so is Spring Trail');
      await t.game('act', 'setting', 'difficulty', 'relaxed');
      await t.game('newGame', { mode: 'classic' });
      t.equal((await t.state()).diff, 'relaxed', 'changing it changes the next game');
      await t.game('act', 'setting', 'difficulty', 'banana');   // a damaged save: fall back to Standard
      await t.game('newGame', { mode: 'classic' });
      t.equal((await t.state()).diff, 'standard', 'an unknown value deals Standard');
    },
  },
  {
    name: 'S3-04 each difficulty keeps its own best; Standard keeps the old save slots',
    async run(t) {
      const lose = async (diff, score) => {
        await t.game('act', 'setting', 'difficulty', diff);
        await t.game('newGame', { mode: 'classic' });
        await t.game('act', 'setting', 'tipsSeen', true);
        await t.game('setState', { score, board: new Array(81).fill(1) });
        await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 5000 });
      };
      await lose('standard', 300);
      await lose('master', 900);
      await lose('relaxed', 150);
      const save = await readSave(t);
      t.equal(save.best.classic, 300, 'Standard best is in the old slot');
      t.equal(save.best.diff.master.classic, 900, 'Master best is its own');
      t.equal(save.best.diff.relaxed.classic, 150, 'Relaxed best is its own');
      await lose('master', 400);   // below the Master best: no new best, and the best shown is the Master one
      t.equal((await t.page.textContent('#ov-new')).trim(), 'Best: 900', 'the game-over card compares with the Master best');
      t.equal((await readSave(t)).best.diff.master.classic, 900, 'a lower score changes nothing');
      await lose('relaxed', 700);
      t.equal((await t.page.textContent('#ov-new')).trim(), 'New best!', 'but a Relaxed 700 beats the Relaxed 150');
      await t.game('scene', 'records');
      const rec = await t.page.textContent('#rec-stats');
      t.expect(/Classic best\s*300/.test(rec) && /Classic best, Master\s*900/.test(rec) && /Classic best, Relaxed\s*700/.test(rec), 'Records lists all three (' + rec.replace(/\s+/g, ' ').slice(0, 160) + ')');
      await t.shot('S3-04-records');
    },
  },
  {
    name: 'S3-04 a saved run keeps its difficulty, and the Continue button names it',
    async run(t) {
      await t.game('act', 'setting', 'difficulty', 'master');
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: new Array(81).fill(0), ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 4, 4);
      await t.game('act', 'setting', 'difficulty', 'relaxed');
      await t.reload();
      const label = (await t.page.textContent('#b-continue')).replace(/\s+/g, ' ').trim();
      t.expect(/^Continue Classic · Master · \d+$/.test(label), 'Continue says Master (' + label + ')');
      await t.page.click('#b-continue');
      t.equal((await t.state()).diff, 'master', 'the run is still Master although the setting is Relaxed');
    },
  },
  {
    name: 'S3-04 a save from before difficulty loads as Standard with every best intact',
    async run(t) {
      await storeAndReload(t, { v: 1, settings: { sound: true, volume: 0.7, undo: 3 }, best: { classic: 1234, springs: 55, daily: { '2026-11-01': 300 } }, trail: { done: ['display-spring'], stars: {} }, stats: { games: 20, lines: 100, bestHeat: 9, springs: 12 }, resume: null });
      const s = await t.game('act', 'save');
      t.equal(s.settings.difficulty, 'standard', 'Standard');
      t.equal(s.best.classic, 1234, 'Classic best kept'); t.equal(s.best.springs, 55, 'Springs best kept'); t.equal(s.settings.undo, 3, 'undos kept');
      t.equal(JSON.stringify(s.best.diff), '{"relaxed":{"classic":0,"springs":0},"master":{"classic":0,"springs":0}}', 'the other difficulties start empty');
      await t.game('newGame', { mode: 'classic' });
      t.equal((await t.state()).diff, 'standard', 'a new game is Standard');
      t.equal((await t.state()).best, 1234, 'and shows the old best');
    },
  },
];
