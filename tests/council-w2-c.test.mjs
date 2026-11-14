// Wave 2, batch C: S3-02 return loop (daily streak, calendar, goals), S2-01 first-run teaching.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOL = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'tools', 'solutions.json'), 'utf8'));
const KEY = 'hs-thermal-blocks-v1';
const GOAL_IDS = ['first-soak', 'four-at-once', 'boiling', 'bathhouse-regular', 'gilded-spa', 'modern-spa-city', 'clear-spring', 'every-spring', 'steady-hand', 'three-days', 'week-at-springs', 'four-thousand-years'];

const storeAndReload = async (t, save) => {
  await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, save]);
  await t.reload();
  await t.waitFrames(3);
};
const readSave = t => t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
// A save as the wave-1 game wrote it: no daily, goals or tipsSeen fields.
const oldSave = () => ({
  v: 1, settings: { sound: true, volume: 0.7, sfx: true, music: true, musicVol: 0.5, ambience: true, ambVol: 0.5, motion: 'system', patterns: true, undo: 1, bigText: false, theme: 'system', effects: 'full', tapPlace: false },
  best: { classic: 1234, springs: 55, daily: { '2026-11-01': 300, '2026-11-02': 450 } }, trail: { done: ['display-spring', 'hale-bathhouse'], stars: { 'hale-bathhouse': 2 } },
  stats: { games: 20, lines: 100, bestHeat: 9, springs: 12 }, resume: null,
});
const words = s => s.trim().split(/\s+/).length;
const empty = () => new Array(81).fill(0);
const today = t => t.page.evaluate(() => todayStr());
const ago = (t, n) => t.page.evaluate(k => addDays(todayStr(), -k), n);
const goals = t => t.game('act', 'goals');
const tips = t => t.game('act', 'tips');
const place = async (t, id, r, c) => t.game('act', 'place', (await t.state()).tray.findIndex(x => x && x.id === id), r, c);
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rectOf = (t, sel) => t.page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, sel);
const setTray = ids => ({ tray: ids.map(id => ({ id })) });
const full = () => new Array(81).fill(1);
// a board where a single o1 at the top-left corner clears a row only
const rowReady = () => { const b = empty(); for (let c = 1; c < 9; c++) b[c] = 1; return b; };
async function playSolution(t, id) {
  await t.game('newGame', { mode: 'trail', level: id });
  for (const [pid, r, c] of SOL[id].solution) {
    const s = await t.state();
    const res = await t.game('act', 'place', s.tray.findIndex(x => x && x.id === pid), r, c);
    t.expect(res.ok, id + ': ' + pid + ' legal');
  }
  await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 5000 });
}
async function endWithFullBoard(t, extra = {}) {   // a board with no room ends the game, so endGame runs
  await t.game('setState', { board: full(), ...extra });
  await t.page.waitForFunction(() => window.__game.getState().over, null, { timeout: 3000 });
}

export const tests = [
  {
    name: 'S2-01 a new player sees the goal in one short line, then how to move, away from the board and HUD',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      const a = await tips(t);
      t.equal(a.cur, 'goal', 'the goal comes first');
      t.expect(a.visible, 'the tip card shows');
      t.expect(/Fill a row, column or 3×3 pool/.test(a.text), 'it says the goal (' + a.text + ')');
      t.expect(words(a.text) <= 12, 'twelve words or fewer');
      t.expect(/Skip tips/.test(await t.page.textContent('#tip')), 'Skip tips is on the card');
      const live = await t.page.evaluate(() => new Promise(r => setTimeout(() => r(document.getElementById('live').textContent), 200)));
      t.expect(/Fill a row/.test(live), 'the live region announces the tip (' + live + ')');
      const card = await rectOf(t, '#tip'), lay = await t.game('layout');
      const bd = { x: lay.board.x, y: lay.board.y, w: lay.board.size, h: lay.board.size };
      t.expect(!hit(card, bd), 'the card does not cover the board');
      for (const s of lay.slots) t.expect(!hit(card, s), 'the card does not cover a tray slot');
      t.expect(!hit(card, lay.info), 'the card does not cover the heat meter');
      for (const sel of ['#hud .stat.score', '#hud .stat.best', '#b-pause', '#b-undo', '#b-sound']) t.expect(!hit(card, await rectOf(t, sel)), 'the card does not cover ' + sel);
      t.expect(card.x >= 0 && card.y >= 0 && card.x + card.w <= t.vp.width && card.y + card.h <= t.vp.height, 'the card is on screen');
      t.expect((await rectOf(t, '#tip-skip')).h >= 44 - 1, 'Skip tips is a touch-sized target');
      await t.shot('S2-01-tip-goal');
      await t.game('act', 'select', 0);
      const b = await tips(t);
      t.equal(b.cur, 'verb', 'picking a piece moves on to how to place it');
      t.expect(words(b.text) <= 12, 'the second line is twelve words or fewer (' + b.text + ')');
      await t.shot('S2-01-tip-verb');
    },
  },
  {
    name: 'S2-01 the move tip uses the words of the input in use',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'select', 0);
      const seen = {};
      for (const kind of ['mouse', 'touch', 'key']) { await t.game('act', 'input', kind); seen[kind] = (await tips(t)).text; t.expect(words(seen[kind]) <= 12, kind + ' line is twelve words or fewer'); }
      t.expect(/Drag a piece/.test(seen.mouse), 'mouse: drag (' + seen.mouse + ')');
      t.expect(/Touch a piece and drag/.test(seen.touch), 'touch: touch and drag (' + seen.touch + ')');
      t.expect(/1, 2 or 3/.test(seen.key) && /Enter/.test(seen.key), 'keyboard: keys (' + seen.key + ')');
      await t.game('act', 'setting', 'tapPlace', true);
      await t.game('act', 'input', 'touch');
      t.expect(/tap the board/i.test((await tips(t)).text), 'tap-to-place players get tap words');
      await t.page.keyboard.press('1');
      t.equal(await t.page.evaluate(() => UI.input), 'key', 'a key press switches the wording to the keyboard');
    },
  },
  {
    name: 'S2-01 tips never block play, name the rule and the heat in play, and end by themselves',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      t.expect((await place(t, (await t.state()).tray[0].id, 0, 0)).ok, 'a piece can be placed while the tip shows');
      let a = await tips(t);
      t.equal(a.cur, null, 'placing the first piece clears the how-to-move tip');
      await t.game('setState', { board: empty() });
      await place(t, (await t.state()).tray.find(x => x).id, 0, 0);
      a = await tips(t);
      t.equal(a.cur, 'rule', 'the second placement brings the rule that ends a game');
      t.expect(/never turn/.test(a.text) && words(a.text) <= 12, 'the rule line: ' + a.text);
      await t.shot('S2-01-tip-rule');
      // the first clear explains the thermometer
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o1']) });
      const r = await place(t, 'o1', 0, 0);
      t.expect(r.G >= 1, 'a row cleared');
      a = await tips(t);
      t.equal(a.cur, 'heat', 'the first clear explains heat');
      t.expect(/heats the water/.test(a.text) && words(a.text) <= 12, 'the heat line: ' + a.text);
      await t.shot('S2-01-tip-heat');
      t.equal((await readSave(t)).settings.tipsSeen, false, 'not marked seen while tips are still running');
      // keep placing: the tips end after fourteen placements and are remembered
      for (let i = 0; i < 14; i++) {
        await t.game('setState', { board: empty() });
        const s = await t.state();
        if (!s.tray.some(x => x)) break;
        await place(t, s.tray.find(x => x).id, 0, 0);
        if (!(await tips(t)).on) break;
      }
      a = await tips(t);
      t.equal(a.on, false, 'tips are over');
      t.equal((await readSave(t)).settings.tipsSeen, true, 'and remembered in the settings');
    },
  },
  {
    name: 'S2-01 Skip tips ends them at once and a reload brings none back',
    async run(t) {
      await t.game('newGame', { mode: 'daily' });
      t.expect((await tips(t)).visible, 'tips show in the Daily Soak');
      await t.page.click('#tip-skip');
      const a = await tips(t);
      t.expect(!a.visible && !a.on, 'the card is gone');
      t.equal((await readSave(t)).settings.tipsSeen, true, 'saved as seen');
      await t.reload();
      await t.game('newGame', { mode: 'classic' });
      t.equal((await tips(t)).on, false, 'no tips after a reload');
    },
  },
  {
    name: 'S2-01 Springs gets its own goal line, and Spring Trail keeps its own hint instead of tips',
    async run(t) {
      await t.game('newGame', { mode: 'springs' });
      const a = await tips(t);
      t.expect(/vent/.test(a.text) && words(a.text) <= 12, 'Springs goal: ' + a.text);
      await t.game('newGame', { mode: 'trail', level: 'display-spring' });
      t.equal((await tips(t)).on, false, 'Trail runs no tips');
      t.expect(/./.test(await t.page.textContent('#toast')), 'the level hint toast still shows');
    },
  },
  {
    name: 'S2-01 tips can be replayed from Settings and from Help, and an older save is not a newcomer',
    async run(t) {
      await storeAndReload(t, oldSave());
      t.equal((await t.game('act', 'save')).settings.tipsSeen, true, 'a save from before tips counts as seen');
      await t.game('newGame', { mode: 'classic' });
      t.equal((await tips(t)).on, false, 'no first-run tips for an older save');
      await t.game('scene', 'settings');
      t.expect(await t.page.isVisible('#b-tips'), 'Settings has Show tips again');
      await t.page.click('#b-tips');
      t.equal((await readSave(t)).settings.tipsSeen, false, 'replay clears the seen flag');
      await t.game('newGame', { mode: 'classic' });
      t.equal((await tips(t)).cur, 'goal', 'tips show again in the next game');
      await t.page.click('#tip-skip');
      await t.game('scene', 'help');
      await t.page.click('#b-tips-help');
      t.equal((await readSave(t)).settings.tipsSeen, false, 'Help replays them too');
      const s = await readSave(t);
      t.equal(s.best.classic, 1234, 'nothing else in the old save changed');
      t.equal(s.trail.done.length, 2, 'trail progress kept');
    },
  },
  {
    name: 'S2-01 the goal is also on the pause card and the tip has no motion',
    reducedMotion: true,
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      t.equal(await t.page.evaluate(() => getComputedStyle(document.getElementById('tip')).animationName), 'none', 'the tip card does not animate');
      await t.game('act', 'pause');
      t.expect(/Goal: fill a row, column or 3×3 pool/.test(await t.page.textContent('#pause-goal')), 'pause card states the goal');
      await t.checkLayout();
      await t.shot('S2-01-pause-goal');
    },
  },
  {
    name: 'S2-01 tips hide behind other screens and come back',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'pause');
      await t.page.waitForTimeout(80);
      t.expect(!(await tips(t)).visible, 'hidden while paused');
      await t.game('act', 'resume');
      await t.page.waitForTimeout(80);
      t.expect((await tips(t)).visible, 'back after resume');
    },
  },

  // ------------------------------------------------------------------------------------------ S3-02
  {
    name: 'S3-02 the first clear earns First Soak with a toast, a cue, a saved date, and does not repeat',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      t.equal(Object.keys((await goals(t)).earned).length, 0, 'a new player has no goals yet');
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o1']) });
      await place(t, 'o1', 0, 0);
      const g = await goals(t);
      t.equal(g.earned['first-soak'], await today(t), 'First Soak saved with today’s date');
      t.expect(await t.page.isVisible('#achtoast'), 'a goal toast shows');
      t.expect(/First Soak/.test(await t.page.textContent('#achtoast')), 'it names the goal');
      t.equal(await t.page.evaluate(() => getComputedStyle(document.getElementById('achtoast')).pointerEvents), 'none', 'the toast cannot block a tap');
      const lay = await t.game('layout'), toast = await rectOf(t, '#achtoast');
      t.expect(toast.x >= 0 && toast.x + toast.w <= t.vp.width, 'the toast fits the screen');
      await t.shot('S3-02-goal-toast');
      const before = JSON.stringify((await goals(t)).earned);
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o1']) });
      await place(t, 'o1', 0, 0);
      t.equal(JSON.stringify((await goals(t)).earned), before, 'a goal already earned keeps its record');
      t.equal((await readSave(t)).ach['first-soak'], await today(t), 'in localStorage');
      await t.reload();
      t.equal((await goals(t)).earned['first-soak'], await today(t), 'and after a reload');
      t.expect(lay.board.size > 0, 'layout read');
    },
  },
  {
    name: 'S3-02 four at once, Boiling and Clear Spring are earned by the play that does them',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      const b = empty();
      for (let c = 2; c < 9; c++) b[c] = 1;
      for (let r = 1; r < 9; r++) { b[r * 9] = 1; b[r * 9 + 1] = 1; }
      b[1 * 9 + 2] = 1; b[2 * 9 + 2] = 1; b[80] = 1;
      await t.game('setState', { board: b, heat: 9, ...setTray(['i2h', 'o1', 'o1']) });
      const r = await place(t, 'i2h', 0, 0);
      t.equal(r.G, 4, 'one piece cleared four groups');
      const g = (await goals(t)).earned;
      t.expect(g['four-at-once'] && g['boiling'], 'Four at Once and Boiling Point earned');
      t.expect(!g['clear-spring'], 'the board was not empty, so no Clear Spring yet');
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o1']) });
      const r2 = await place(t, 'o1', 0, 0);
      t.expect(r2.ok && r2.points > 300, 'the floor emptied (' + JSON.stringify(r2) + ')');
      t.expect((await goals(t)).earned['clear-spring'], 'Clear Spring earned');
    },
  },
  {
    name: 'S3-02 reaching the Gilded Spa and Modern Spa City eras earns their goals',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { score: 1999, board: empty(), ...setTray(['o1', 'o1', 'o1']) });
      await place(t, 'o1', 4, 4);
      let g = (await goals(t)).earned;
      t.expect(g['gilded-spa'] && !g['modern-spa-city'], 'Gilded Spa at score 2,000');
      await t.game('setState', { score: 7999, board: empty(), ...setTray(['o1', 'o1', 'o1']) });
      await place(t, 'o1', 4, 4);
      g = (await goals(t)).earned;
      t.expect(g['modern-spa-city'], 'Modern Spa City at score 8,000');
    },
  },
  {
    name: 'S3-02 game-end goals: ten Boiling games, the 440th group, tapping all 47 springs, a no-undo trail puzzle',
    async run(t) {
      const save = oldSave();
      save.goals = { boiled: 9 }; save.stats.lines = 439;
      await storeAndReload(t, save);
      await t.game('newGame', { mode: 'classic' });
      await endWithFullBoard(t, { bestHeat: 12, groups: 1 });
      const g = (await goals(t)).earned;
      t.expect(g['bathhouse-regular'], 'the tenth Boiling game earns Bathhouse Regular');
      t.expect(g['four-thousand-years'], 'the 440th group earns Four Thousand Years');
      const s = await readSave(t);
      t.equal(s.goals.boiled, 10, 'the Boiling count is saved');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 5000 });
      t.expect(/Goals earned/.test(await t.page.textContent('#ov-stats')), 'the results screen lists what was earned');
      await t.shot('S3-02-results-goals');
      await t.game('newGame', { mode: 'springs' });
      const b = empty(); for (let c = 1; c < 9; c++) b[c] = 1; b[5] = 8;
      await t.game('setState', { board: b, springs: 46, ...setTray(['o1', 'o1', 'o1']) });
      const r = await place(t, 'o1', 0, 0);
      t.expect(r.ok, 'placed');
      await t.page.waitForFunction(() => window.__game.getState().over, null, { timeout: 3000 });
      t.expect((await goals(t)).earned['every-spring'], 'winning Springs earns Every Spring Flowing');
      await playSolution(t, 'hale-bathhouse');
      t.expect((await goals(t)).earned['steady-hand'], 'a three-star Trail win earns Steady Hand');
    },
  },
  {
    name: 'S3-02 a Daily Soak streak counts consecutive days, earns its goals, and shows on the title and in Records',
    async run(t) {
      const save = oldSave(); save.best.daily = {};
      for (let k = 1; k <= 5; k++) save.best.daily[await ago(t, k)] = 100 * k;
      await storeAndReload(t, save);
      t.equal((await goals(t)).streak, 5, 'five days ending yesterday count as a five-day streak');
      await t.game('scene', 'title');
      t.expect(/5-day streak · play today to keep it/.test(await t.page.textContent('#daily-sub')), 'the Daily button says so: ' + await t.page.textContent('#daily-sub'));
      await t.game('newGame', { mode: 'daily' });
      await endWithFullBoard(t, { score: 321 });
      const g = await goals(t);
      t.equal(g.streak, 6, 'finishing today makes six');
      t.expect(g.earned['three-days'] && !g.earned['week-at-springs'], 'Three Days Running earned, the week not yet');
      t.equal((await readSave(t)).daily.longest, 6, 'the longest streak is saved');
      t.expect((await readSave(t)).daily.played.includes(await today(t)), 'today is in the played list');
      await t.game('scene', 'title');
      t.expect(/6-day streak · Today’s best: 321/.test(await t.page.textContent('#daily-sub')), 'title: ' + await t.page.textContent('#daily-sub'));
      await t.game('scene', 'records');
      t.expect(/Streak: 6 days/.test(await t.page.textContent('#rec-streak')), 'Records shows the streak');
      t.equal(await t.page.locator('#rec-cal i').count(), 30, 'a 30-day calendar');
      t.equal(await t.page.locator('#rec-cal i.on').count(), 6, 'six days marked');
      t.equal(await t.page.locator('#rec-cal i.today').count(), 1, 'today is outlined');
      t.expect(/6 of the last 30/.test(await t.page.getAttribute('#rec-cal', 'aria-label')), 'the calendar has a text label');
    },
  },
  {
    name: 'S3-02 a missed day resets the streak but keeps the longest',
    async run(t) {
      const save = oldSave(); save.best.daily = {};
      for (const k of [3, 4, 5, 6]) save.best.daily[await ago(t, k)] = 50;
      await storeAndReload(t, save);
      t.equal((await goals(t)).streak, 0, 'a gap of two days ends the streak');
      t.equal((await goals(t)).longest, 4, 'the best run of four days is kept');
      await t.game('scene', 'title');
      t.expect(!/streak/.test(await t.page.textContent('#daily-sub')), 'the Daily button shows no streak');
    },
  },
  {
    name: 'S3-02 Records lists the twelve goals, earned and locked, and fits both screens',
    async run(t) {
      const save = oldSave(); save.ach = { 'first-soak': await today(t), 'boiling': await today(t) };
      await storeAndReload(t, save);
      await t.game('scene', 'records');
      t.equal(await t.page.locator('#rec-goals li').count(), 12, 'twelve goals listed');
      t.equal(await t.page.locator('#rec-goals li.got').count(), 2, 'two earned');
      t.expect(/Goals · 2 of 12/.test(await t.page.textContent('#rec-goals-h')), 'the heading counts them');
      t.expect(/Locked\. Reach the Gilded Spa era/.test(await t.page.textContent('#rec-goals')), 'a locked goal shows its condition in plain words');
      const stats = await t.page.textContent('#rec-stats');
      t.expect(/Best Daily Soak\s*450/.test(stats) && /Daily Soaks played\s*2/.test(stats), 'the personal bests include the Daily Soak');
      t.expect(/Classic best\s*1,234/.test(stats), 'older records are all still there');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-02-records-top');
      await t.page.evaluate(() => document.querySelector('#sc-records .panel').scrollTo(0, 99999));
      await t.shot('S3-02-records-goals');
      const small = await t.page.evaluate(() => [...document.querySelectorAll('#sc-records button')].map(b => b.getBoundingClientRect().height));
      t.expect(small.every(h => h >= 43), 'Back stays a touch target');
    },
  },
  {
    name: 'S3-02 the save round trip: a pre-wave save keeps everything, a damaged return-loop block falls back',
    async run(t) {
      await storeAndReload(t, oldSave());
      const s = await t.game('act', 'save');
      t.equal(s.best.classic, 1234, 'classic best kept');
      t.equal(s.best.springs, 55, 'springs best kept');
      t.equal(Object.keys(s.best.daily).length, 2, 'daily bests kept');
      t.equal(s.trail.stars['hale-bathhouse'], 2, 'trail stars kept');
      t.equal(s.stats.games, 20, 'stats kept');
      t.equal(s.daily.longest, 0, 'new fields get defaults');
      t.equal(s.goals.boiled, 0, 'goal counters default to zero');
      await t.game('scene', 'records');
      t.expect(/Daily Soaks played\s*2/.test(await t.page.textContent('#rec-stats')), 'old daily scores count as played days');
      const bad = oldSave(); bad.daily = 'x'; bad.ach = { a: 'nope', 'first-soak': '2026-11-13' }; bad.goals = { boiled: -4 }; bad.settings.tipsSeen = 'maybe';
      await storeAndReload(t, bad);
      const d = await t.game('act', 'save');
      t.equal(d.daily.played.length, 0, 'damaged daily history is dropped');
      t.equal(Object.keys(d.ach).join(), 'first-soak', 'only well-formed goals survive');
      t.equal(d.goals.boiled, 0, 'a negative counter falls back');
      t.equal(d.settings.tipsSeen, false, 'a damaged flag falls back to the default');
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: rowReady(), ...setTray(['o1', 'o1', 'o1']) });
      t.expect((await place(t, 'o1', 0, 0)).ok, 'the game still plays');
      t.expect(Object.keys((await readSave(t)).ach).length >= 1, 'and writes a valid save');
      t.equal((await readSave(t)).ach['first-soak'], '2026-11-13', 'an earned goal is not overwritten');
    },
  },
  {
    name: 'S3-02 the goal cue is in the cue list and plays',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      t.expect(list.cues.includes('ach'), 'ach is a listed cue');
      const r = await t.page.evaluate(() => window.__game.audioRender('cue:ach', 2, false));
      t.log('ach cue peak ' + r.peak + ', rms ' + r.rmsDb + ' dB');
      t.expect(r.peak >= 0.2 && r.peak <= 0.45, 'peak within 0.2 to 0.45 (' + r.peak + ')');
      const ok = await t.game('act', 'audio', 'ach');
      t.expect(ok.ctx, 'the cue plays on the live context without error');
    },
  },
];
