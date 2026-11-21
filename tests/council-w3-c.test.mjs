// Council wave 3, batch C: difficulty, progression and records; feedback, teaching and help.
// (S4-04, S4-06, S4-17, S2-02, S2-03, S2-07, S2-16, S2-17, S4-14)
const KEY = 'hs-thermal-blocks-v1';
const empty = () => new Array(81).fill(0);
const setTray = ids => ({ tray: ids.map(id => (id ? { id } : null)) });
const readSave = t => t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const storeAndReload = async (t, save) => {
  await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, save]);
  await t.reload();
  await t.waitFrames(3);
};
const text = (t, sel) => t.page.textContent(sel);

export const tests = [
  // ------------------------------------------------------------------ S4-04 ceremony
  {
    name: 'S4-04 a lost game names the era it reached and quotes that era’s caption',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: new Array(81).fill(1), ...setTray(['o9', 'o9', null]), era: 2, score: 500 });
      await t.game('scene', 'over');
      await t.waitFrames(2);
      const era = await text(t, '#ov-era');
      t.expect(era.startsWith('You reached Gilded Spa (1875–1920). Brick bathhouses rise along Bathhouse Row.'), 'the epitaph names the era: ' + era);
      await t.game('setState', { era: 0 });
      await t.game('scene', 'over');
      t.expect((await text(t, '#ov-era')).startsWith('You reached Ancient Valley (before 1804).'), 'and the first era too');
      await t.shot('S4-04-game-over');
    },
  },
  {
    name: 'S4-04 the Springs win steams the whole floor, hangs “Valley of Vapors”, and waits for it before the card',
    async run(t) {
      await t.game('newGame', { mode: 'springs' });
      await t.game('act', 'setting', 'tipsSeen', true);
      const b = empty(); for (let c = 1; c < 9; c++) b[c] = 1; b[5] = 8;
      await t.game('setState', { board: b, springs: 46, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 0, 0);
      await t.page.waitForFunction(() => window.__game.getState().over, null, { timeout: 3000 });
      const fx = await t.game('act', 'fxTypes');
      t.expect(fx.filter(x => x === 'steam').length >= 36, 'steam on the whole floor, not only the cleared row: ' + fx.filter(x => x === 'steam').length);
      t.expect((await t.game('act', 'fxList')).some(f => f.text === 'Valley of Vapors'), 'the banner is up');
      t.expect(await t.page.evaluate(() => window.__game.getState().scene) === 'game', 'the card has not replaced the board yet');
      await t.page.waitForTimeout(1100);   // only so the picture catches the steam; nothing is asserted after it
      await t.shot('S4-04-springs-win-steam', { wait: false });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 9000 });
      t.expect((await text(t, '#ov-era')).includes('Valley of Vapors'), 'the card repeats the name and its source line');
      t.equal(await text(t, '#ov-title'), 'All 47 springs flowing!', 'the win title');
      await t.shot('S4-04-springs-win');
    },
  },
  {
    name: 'S4-04 reduced motion: the win banner shows and the steam does not',
    reducedMotion: true,
    async run(t) {
      await t.game('newGame', { mode: 'springs' });
      await t.game('act', 'setting', 'tipsSeen', true);
      const b = empty(); for (let c = 1; c < 9; c++) b[c] = 1; b[5] = 8;
      await t.game('setState', { board: b, springs: 46, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 0, 0);
      await t.page.waitForFunction(() => window.__game.getState().over, null, { timeout: 3000 });
      t.expect((await t.game('act', 'fxTypes')).filter(x => x === 'steam').length === 0, 'no steam');
      t.expect((await t.game('act', 'fxList')).some(f => f.text === 'Valley of Vapors'), 'the banner is still there');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 6000 });
    },
  },
  {
    name: 'S4-04 solving the last first-ring puzzle earns the Row Walker title, and the last puzzle completes the Trail',
    async run(t) {
      const levels = await t.game('getLevels');
      const ring1 = levels.filter(l => !l.ring).map(l => l.id), all = levels.map(l => l.id);
      // The real end-of-game path: one stone left in a row that one piece completes.
      const solveLast = async (done, id) => {
        const s = await t.game('act', 'save'); s.trail.done = done; s.trail.stars = {};
        await storeAndReload(t, s);
        await t.game('newGame', { mode: 'trail', level: id });
        const row = empty(); for (let c = 1; c < 8; c++) row[72 + c] = 1; row[72] = 7;
        await t.game('setState', { board: row, queue: [], ...setTray(['o1', null, null]), goal: 'stones', undosUsed: 0, undoStack: [] });
        await t.game('act', 'place', 0, 8, 8);
        await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 6000 });
      };
      const last1 = ring1[ring1.length - 1];
      await solveLast(ring1.slice(0, -1), last1);
      t.equal(await text(t, '#win-title'), 'Row Walker', 'the title replaces the heading');
      t.expect((await text(t, '#win-sub')).includes('every first-ring puzzle is solved'), 'and the line says why: ' + await text(t, '#win-sub'));
      await t.shot('S4-04-trail-title');
      await t.game('scene', 'records');
      t.expect((await text(t, '#rec-stats')).includes('Row Walker'), 'Records shows the title');
      await t.game('scene', 'title');
      t.expect((await text(t, '#trail-sub')).startsWith('Row Walker · '), 'and so does the title screen: ' + await text(t, '#trail-sub'));
      // an ordinary solve says nothing of the kind
      await solveLast(ring1.slice(0, 3), ring1[5]);
      t.expect((await text(t, '#win-title')).endsWith(': solved'), 'an ordinary solve keeps the puzzle heading');
      // the last of all of them completes the Trail
      await solveLast(all.slice(0, -1), all[all.length - 1]);
      t.equal(await text(t, '#win-title'), 'Spring Trail complete', 'the whole Trail');
      t.expect((await text(t, '#win-sub')).includes('every puzzle is solved'), 'says so');
      await t.shot('S4-04-trail-complete');
      // solving a puzzle again does not repeat the ceremony
      await t.game('newGame', { mode: 'trail', level: all[0] });
      const row = empty(); for (let c = 1; c < 8; c++) row[72 + c] = 1; row[72] = 7;
      await t.game('setState', { board: row, queue: [], ...setTray(['o1', null, null]), goal: 'stones', undosUsed: 0, undoStack: [] });
      await t.game('act', 'place', 0, 8, 8);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 6000 });
      t.expect((await text(t, '#win-title')).endsWith(': solved'), 'a replay is an ordinary solve');
    },
  },

  // ------------------------------------------------------------------ S4-06 the Trail in street order, eras by date
  {
    name: 'S4-06 Trail puzzles carry the era of the year on their fact card',
    async run(t) {
      const levels = await t.game('getLevels');
      const era = id => levels.find(l => l.id === id).era;
      // era 2 is 1875-1920, era 3 is 1921-1946, era 5 is 1968-1999 (the era table)
      const byYear = { 'hale-bathhouse': 2, 'maurice-spring-fountain': 2, 'buckstaff-bathhouse': 2, 'fordyce-bathhouse': 2, 'superior-bathhouse': 2,
        'quapaw-bathhouse': 3, 'ozark-bathhouse': 3, 'lamar-bathhouse': 3, 'display-spring': 3, 'grand-promenade': 3, 'thermal-water-cascade': 5 };
      for (const [id, e] of Object.entries(byYear)) t.equal(era(id), e, id + ' era');
    },
  },
  {
    name: 'S4-06 the Trail shows Bathhouse Row as a strip in street order that lights as puzzles are solved; the list keeps its numbers',
    async run(t) {
      await t.game('scene', 'trail');
      const strip = () => t.page.evaluate(() => [...document.querySelectorAll('#row-strip button')].map(b => ({ n: b.textContent, done: b.classList.contains('done'), off: b.disabled, label: b.getAttribute('aria-label') })));
      let s = await strip();
      t.equal(s.map(b => b.n), ['Superior', 'Hale', 'Maurice Spring Fountain', 'Fordyce', 'Quapaw', 'Ozark', 'Buckstaff', 'Lamar'], 'street order, north to south, as in research/backdrop-notes.md');
      t.expect(s.every(b => !b.done && b.off), 'a new player has solved none and only the earlier puzzles are open');
      t.equal(await text(t, '#row-strip .end'), 'N', 'the north end is marked');
      const levels = await t.game('getLevels');
      const save = await t.game('act', 'save'); save.trail.done = ['display-spring', 'hale-bathhouse'];
      await storeAndReload(t, save);
      await t.game('scene', 'trail');
      s = await strip();
      t.equal(s.map(b => b.done), [false, true, false, false, false, false, false, false], 'Hale is lit');
      t.expect(!s[2].off && s[1].label === 'Hale Bathhouse, solved' && s[3].off, 'Maurice is the next one open: ' + JSON.stringify(s.map(b => b.off)));
      const names = await t.page.evaluate(() => [...document.querySelectorAll('#levels button b')].map(b => b.textContent));
      t.equal(names.slice(0, 3), ['1. Display Spring', '2. Hale Bathhouse', '3. Maurice Spring Fountain'], 'the list below is still in Trail order');
      t.equal(names.length, levels.length, 'and still has every puzzle');
      await t.page.click('#row-strip button:nth-of-type(3)');
      await t.page.waitForFunction(() => window.__game.getState().level === 'maurice-spring-fountain', null, { timeout: 4000 });
      await t.game('scene', 'trail');
      await t.shot('S4-06-trail-strip');
    },
  },

  // ------------------------------------------------------------------ S4-17 era postcards
  {
    name: 'S4-17 an era postcard is collected the first time a game reaches the era, and says so once',
    async run(t) {
      const cards = () => t.page.evaluate(() => ({ sub: document.getElementById('cards-era-sub').textContent, open: [...document.querySelectorAll('#cards-era .card')].map(c => !c.classList.contains('locked')), text: document.getElementById('cards-era').textContent }));
      await t.game('scene', 'cards');
      let c = await cards();
      t.expect(c.sub.startsWith('1 of 7 collected'), 'a new player has the first: ' + c.sub);
      t.equal(c.open, [true, false, false, false, false, false, false], 'only Ancient Valley is open');
      t.expect(c.text.includes('Reach 150 points in Classic.'), 'a locked one says Classic opens it');
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: empty(), score: 149, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 0, 0);
      await t.page.waitForFunction(() => document.getElementById('toast').classList.contains('on'), null, { timeout: 3000 });
      t.expect((await text(t, '#toast')).includes('Postcard added to Fact cards.'), 'the arrival toast mentions it: ' + await text(t, '#toast'));
      t.equal((await readSave(t)).eraMax, 1, 'saved');
      await t.game('scene', 'cards');
      c = await cards();
      t.equal(c.open, [true, true, false, false, false, false, false], 'Frontier Springs is open now');
      t.expect(c.text.includes('William Dunbar writes Thomas Jefferson'), 'with its own caption');
      await t.page.evaluate(() => document.getElementById('cards-era').scrollIntoView({ block: 'start' }));
      await t.waitFrames(2);
      await t.shot('S4-17-postcards');
      // a second game that reaches the same era does not announce a postcard again
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'hideToast');
      await t.game('setState', { board: empty(), score: 149, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 0, 0);
      await t.page.waitForFunction(() => document.getElementById('toast').classList.contains('on'), null, { timeout: 3000 });
      t.expect(!/postcard/i.test(await text(t, '#toast')), 'no second announcement: ' + await text(t, '#toast'));
    },
  },
  {
    name: 'S4-17 a save from before keeps every postcard its Classic best scores reached (Springs/Daily bests stay separate)',
    async run(t) {
      const save = await t.game('act', 'save');
      delete save.eraMax; save.best.classic = 2600; save.best.diff.master.classic = 5000; save.best.diff.master.springs = 5000;
      await storeAndReload(t, save);
      await t.game('scene', 'cards');
      const open = await t.page.evaluate(() => [...document.querySelectorAll('#cards-era .card')].map(c => !c.classList.contains('locked')));
      t.equal(open, [true, true, true, true, true, true, true], 'a 5,000-point Master Classic best opens all seven');
      const lower = await t.game('act', 'save'); lower.best.diff.master.classic = 0; lower.best.classic = 900; lower.best.diff.master.springs = 9000; lower.best.daily = { '2026-11-12': 9000 };
      await storeAndReload(t, lower);
      await t.game('scene', 'cards');
      const open2 = await t.page.evaluate(() => [...document.querySelectorAll('#cards-era .card')].map(c => !c.classList.contains('locked')));
      t.equal(open2, [true, true, true, true, false, false, false], 'a 900-point Classic best opens up to Roaring Spa Town; Springs/Daily bests do not unlock Classic postcards');
    },
  },

  // ------------------------------------------------------------------ S2-02 heat is labelled and its first cooling explained
  {
    name: 'S2-02 the first time the water cools it says why, once, and an older save is not told',
    async run(t) {
      const toastOn = () => t.page.evaluate(() => { const e = document.getElementById('toast'); return e.classList.contains('on') ? e.textContent : ''; });
      const dry = async () => {   // a piece that clears nothing on a hot board (above HEAT_SLOW_BELOW=6)
        await t.game('act', 'hideToast');
        await t.game('setState', { board: empty(), heat: 7, dry: 0, ...setTray(['o1', 'o1', 'o1']) });
        await t.game('act', 'place', 0, 4, 4);
      };
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'hideToast');
      await dry();
      t.expect((await toastOn()).startsWith('The water cooled'), 'first cooling is explained: ' + await toastOn());
      t.expect((await text(t, '#toast')).includes('cooler water scores less'), 'in plain words');
      t.equal((await readSave(t)).hints.cool, true, 'and remembered');
      await dry();
      t.equal(await toastOn(), '', 'the second time says nothing');
      await t.reload();
      await t.game('newGame', { mode: 'classic' });
      await dry();
      t.equal(await toastOn(), '', 'and not after a reload either');
      // a save from before the hints
      const save = await t.game('act', 'save'); delete save.hints;
      await storeAndReload(t, save);
      await t.game('newGame', { mode: 'classic' });
      await dry();
      t.equal(await toastOn(), '', 'an older save is never taught what it knows');
      t.equal((await readSave(t)).hints.all, true, 'it reads as all shown');
    },
  },
  {
    name: 'S2-02 the heat meter is labelled on the board at both sizes',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { board: empty(), heat: 4 });
      await t.waitFrames(3);
      await t.shot('S2-02-heat-label');
    },
  },

  // ------------------------------------------------------------------ S2-07 undo says what it is
  {
    name: 'S2-07 the Undo button says how many are left this round, and the first use says it refills',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'hideToast');
      t.expect((await t.page.getAttribute('#b-undo', 'title')).includes('1 left this round') && (await t.page.getAttribute('#b-undo', 'title')).includes('refills with each new tray'), 'the hover title: ' + await t.page.getAttribute('#b-undo', 'title'));
      t.equal(await t.page.getAttribute('#b-undo', 'aria-label'), 'Undo (1 left this round)', 'the screen-reader label');
      await t.game('setState', { board: empty(), ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 4, 4);
      await t.game('act', 'hideToast');
      await t.game('act', 'undo');
      t.expect((await text(t, '#toast')).includes('Undo refills with each new tray.'), 'first use explains: ' + await text(t, '#toast'));
      t.expect((await t.page.getAttribute('#b-undo', 'title')).includes('0 left this round'), 'and the spent button says none is left: ' + await t.page.getAttribute('#b-undo', 'title'));
      await t.game('act', 'hideToast');
      await t.game('setState', { board: empty(), undoLeft: 1, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 4, 4);
      await t.game('act', 'undo');
      t.equal(await t.page.evaluate(() => document.getElementById('toast').classList.contains('on')), false, 'the second use says nothing');
    },
  },

  // ------------------------------------------------------------------ S2-17 honest Classic era & pressure copy (CD-WF1-06 / W6-S3-05)
  {
    name: 'S2-17 the first era change honestly notes higher scores bring trickier pieces once; Help and High/Peak Flow captions match',
    async run(t) {
      const crossing = async () => {
        await t.game('newGame', { mode: 'classic' });
        await t.game('act', 'setting', 'tipsSeen', true);
        await t.game('act', 'hideToast');
        await t.game('setState', { board: empty(), score: 149, ...setTray(['o1', 'o1', 'o1']) });
        await t.game('act', 'place', 0, 0, 0);
        return text(t, '#toast');
      };
      const first = await crossing();
      t.expect(first.startsWith('Frontier Springs · 1804–1874Your score moved the town forward; higher scores also bring trickier pieces. 1804: William Dunbar'), 'first crossing: ' + first);
      t.expect(!/scenery only|plays the same/i.test(first), 'no dishonest scenery-only claim');
      const second = await crossing();
      t.expect(!second.includes('trickier pieces') && second.includes('William Dunbar'), 'the next crossing is just the caption: ' + second);
      await t.game('scene', 'help');
      const helpTxt = await text(t, '#sc-help');
      t.expect(!/scenery only|plays the same|backdrop and its caption only/i.test(helpTxt), 'Help retires dishonest scenery-only copy');
      t.expect(/High Flow \(5,500\)/.test(helpTxt) && /Peak Flow \(8,000\)/.test(helpTxt), 'Help names High Flow and Peak Flow');
      // Verify calm inline High Flow (5,500) and Peak Flow (8,000) captions in Classic without extra toasts.
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { board: empty(), score: 5600, era: 6, ...setTray(['o1', 'o1', 'o1']) });
      let ct = await t.game('act', 'canvasText');
      t.expect(ct.texts.some(x => /High Flow/.test(x.text)), 'High Flow shown inline at 5,500+');
      await t.game('setState', { board: empty(), score: 8100, era: 6, ...setTray(['o1', 'o1', 'o1']) });
      ct = await t.game('act', 'canvasText');
      t.expect(ct.texts.some(x => /Peak Flow/.test(x.text)), 'Peak Flow shown inline at 8,000+');
      const save = await t.game('act', 'save'); delete save.hints; delete save.eraMax;
      await storeAndReload(t, save);
      t.expect(!(await crossing()).includes('trickier pieces'), 'an older save is not told');
    },
  },

  // ------------------------------------------------------------------ S2-03 vents are opened by clearing lines, and the words say so
  {
    name: 'S2-03 nothing says to tap a vent: the title button, Help, the Trail hint and the results say open',
    async run(t) {
      t.equal(await text(t, '#sc-title [data-mode="springs"] span'), 'Open 47 hot-spring vents.', 'the title button');
      const html = await t.page.evaluate(() => document.documentElement.innerHTML);
      t.expect(!/Tap 47|Tap the vents|tap the vent|tap every vent|springs? tapped|Springs tapped/i.test(html), 'no page text asks for a tap on a vent');
      await t.game('scene', 'help');
      t.expect((await text(t, '#sc-help')).includes('Clear a vent\'s row, column or pool to open it'), 'Help says how');
      const levels = await t.game('getLevels');
      t.expect(levels.every(l => !/\btap\b/i.test(l.hint)), 'no Trail hint says tap');
      await t.game('newGame', { mode: 'springs' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('setState', { springs: 12 });
      await t.game('scene', 'over');
      await t.waitFrames(2);
      t.expect((await text(t, '#ov-stats')).includes('Springs opened12 / 47'), 'the results row: ' + await text(t, '#ov-stats'));
    },
  },
  {
    name: 'S2-03 Springs opens with its goal in one line when no tip card is teaching it, and never beside a tip card',
    async run(t) {
      const toastOn = () => t.page.evaluate(() => { const e = document.getElementById('toast'); return e.classList.contains('on') ? e.textContent : ''; });
      await t.game('newGame', { mode: 'springs' });   // a new profile: the tip card teaches it
      t.expect((await t.game('act', 'tips')).visible, 'the tip card is showing');
      t.equal(await toastOn(), '', 'so there is no toast beside it');
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('newGame', { mode: 'springs' });
      t.equal(await toastOn(), 'SpringsOpen all 47 vents: complete a vent’s row, column or pool.', 'otherwise the goal comes as a toast');
      await t.shot('S2-03-springs-start');
    },
  },

  // ------------------------------------------------------------------ S2-16 the daily rule, and a date a person can read
  {
    name: 'S2-16 Daily Soak shows a readable date and says it is the board on this device, one best a day',
    async run(t) {
      const toastOn = () => t.page.evaluate(() => { const e = document.getElementById('toast'); return e.classList.contains('on') ? e.textContent : ''; });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      t.equal(await toastOn(), 'Daily SoakToday’s board on this device, Nov 12. A new one comes at midnight here. One best score per day.', 'the opening toast');   // P-N05: said as the game does it
      await t.game('scene', 'over');
      await t.waitFrames(2);
      t.equal((await text(t, '#ov-sub')).split(' · ').slice(0, 2).join(' · '), 'Daily Soak · Nov 12', 'the results card, not 2026-11-12');
      t.expect((await text(t, '#sc-help')).includes('one best score per day counts'), 'Help says the rule');
      await t.game('newGame', { mode: 'daily', date: '2026-01-05' });
      await t.game('scene', 'over');
      await t.waitFrames(2);
      t.equal((await text(t, '#ov-sub')).split(' · ').slice(0, 2).join(' · '), 'Daily Soak · Jan 5', 'a single-digit day has no zero');
    },
  },

  // ------------------------------------------------------------------ S4-14 the goal is a number in the HUD
  {
    name: 'S4-14 Springs and Trail show their goal beside the score, and Classic does not',
    async run(t) {
      const goal = () => t.page.evaluate(() => { const g = document.getElementById('h-goal'); return g.hidden ? null : [document.getElementById('h-goal-lbl').textContent, document.getElementById('h-goal-num').textContent]; });
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      t.equal(await goal(), null, 'Classic has no goal but score');
      await t.game('newGame', { mode: 'springs' });
      t.equal(await goal(), ['Vents', '0/47'], 'Springs starts at 0 of 47');
      const b = empty(); for (let c = 1; c < 9; c++) b[c] = 1; b[5] = 8;
      await t.game('setState', { board: b, springs: 12, ...setTray(['o1', 'o1', 'o1']) });
      await t.game('act', 'place', 0, 0, 0);
      t.equal(await goal(), ['Vents', '13/47'], 'opening a vent moves it at once');
      await t.shot('S4-14-springs-hud');
      const lv = await t.game('getLevels');
      const of = g => lv.find(l => l.goal === g || l.goal.startsWith(g));
      await t.game('newGame', { mode: 'trail', level: of('stones').id });
      const st = await t.game('getState');
      t.equal(await goal(), ['Tufa left', String(st.board.filter(x => x === 7).length)], 'a tufa puzzle counts the stones left');
      await t.game('newGame', { mode: 'trail', level: of('vents').id });
      t.equal((await goal())[0], 'Vents left', 'a vent puzzle counts the vents left');
      await t.game('newGame', { mode: 'trail', level: of('lines:').id });
      const need = of('lines:').goal.slice(6);
      t.equal(await goal(), ['Groups', '0/' + need], 'a groups puzzle counts to its target');
      await t.shot('S4-14-trail-hud');
      await t.game('newGame', { mode: 'daily' });
      t.equal(await goal(), null, 'Daily Soak goes back to score only');
    },
  },
  {
    name: 'S4-14 the HUD goal fits beside the score in Springs without crowding buttons, and Trail hides inert Score (CD-WF1-03)',
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('newGame', { mode: 'springs' });
      await t.game('setState', { score: 12345, springs: 46 });
      const boxes = await t.page.evaluate(() => ['b-pause', 'h-score', 'h-goal', 'b-undo', 'b-sound'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, l: r.left, r: r.right, w: r.width }; }));
      const order = boxes.map(b => b.id);
      for (let i = 1; i < boxes.length; i++) t.expect(boxes[i].l >= boxes[i - 1].r - 1, order[i - 1] + ' and ' + order[i] + ' do not overlap: ' + JSON.stringify(boxes));
      t.expect(boxes.every(b => b.w > 0) && boxes[4].r <= t.vp.width, 'every piece of the Springs HUD is on screen');
      const lv = await t.game('getLevels');
      await t.game('newGame', { mode: 'trail', level: lv.find(l => l.name === 'Thermal Water Cascade').id });
      t.equal(await t.page.evaluate(() => document.querySelector('#hud .stat.score').hidden), true, 'Trail hides inert Score in #hud');
      const tBoxes = await t.page.evaluate(() => ['b-pause', 'h-goal', 'b-undo', 'b-sound'].map(id => { const r = document.getElementById(id).getBoundingClientRect(); return { id, l: r.left, r: r.right, w: r.width }; }));
      for (let i = 1; i < tBoxes.length; i++) t.expect(tBoxes[i].l >= tBoxes[i - 1].r - 1, 'Trail HUD non-overlapping: ' + JSON.stringify(tBoxes));
      t.expect(tBoxes.every(b => b.w > 0) && tBoxes[3].r <= t.vp.width, 'every piece of the Trail HUD is on screen');
    },
  },
];
