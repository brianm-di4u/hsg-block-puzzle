// M4: clear effects, reduced motion, audio, patterns, settings, help, dark scheme, touch targets (AC23–AC29)
const EMPTY = () => new Array(81).fill(0);

async function clearSetup(t) {
  await t.seed(6);
  await t.game('newGame', { mode: 'classic' });
  const b = EMPTY();
  for (let c = 0; c < 8; c++) { b[3 * 9 + c] = 1 + (c % 6); b[4 * 9 + c] = 1 + ((c + 2) % 6); }
  for (let r = 0; r < 9; r++) if (r !== 3 && r !== 4) b[r * 9 + 8] = 3;
  b[0] = 2;
  await t.game('setState', { board: b, tray: [{ id: 'i2v' }, { id: 'o1' }, { id: 'o4' }], score: 1100, heat: 6, era: 2 });
  await t.game('act', 'hideToast');
}

export const tests = [
  {
    name: 'clear effects',
    async run(t) {
      await clearSetup(t);
      const r = await t.game('act', 'place', 0, 3, 8);
      t.expect(r.G >= 3, 'two rows and a column clear at once (G=' + r.G + ')');
      const types = await t.game('act', 'fxTypes');
      for (const k of ['flash', 'ripple', 'steam', 'popup', 'shake']) t.expect(types.includes(k), 'effect ' + k);
      await t.game('act', 'freezeFx', 280);
      await t.shot('60-clear-fx');
      await t.game('act', 'unfreezeFx');
      await t.waitForStable();
      t.equal((await t.game('act', 'fxTypes')).length, 0, 'effects finish');
    },
  },
  {
    name: 'reduced motion clear',
    reducedMotion: true,
    async run(t) {
      await clearSetup(t);
      await t.game('act', 'place', 0, 3, 8);
      const types = await t.game('act', 'fxTypes');
      t.expect(types.includes('flash') && types.includes('popup'), 'flash and popup remain');
      t.expect(!types.includes('steam') && !types.includes('ripple') && !types.includes('shake'), 'no particles, ripples or shake: ' + types.join(','));
      await t.game('act', 'freezeFx', 60);
      await t.shot('61-clear-reduced');
      await t.game('act', 'unfreezeFx');
    },
  },
  {
    name: 'audio',
    viewports: ['desktop'],
    async run(t) {
      await t.page.mouse.click(10, 10);
      let a = await t.game('act', 'audio', 'clear');
      t.expect(a.ctx, 'AudioContext created');
      t.expect(Math.abs(a.gain - 0.7 * 0.6) < 0.01, 'default volume applied: ' + a.gain);
      for (const n of ['place', 'invalid', 'deal', 'undo', 'vent', 'era', 'over', 'win', 'bonus', 'pick']) await t.game('act', 'audio', n);
      await t.game('act', 'setting', 'sound', false);
      a = await t.game('act', 'audio', 'place');
      t.equal(a.gain, 0, 'muted');
      await t.game('act', 'setting', 'sound', true);
      await t.game('act', 'setting', 'volume', 0.5);
      a = await t.game('act', 'audio', 'place');
      t.expect(Math.abs(a.gain - 0.3) < 0.01, 'volume 50%');
      await t.game('newGame', { mode: 'classic' });
      await t.page.focus('#cv');
      await t.page.keyboard.press('m');
      t.equal((await t.game('act', 'save')).settings.sound, false, 'M mutes');
      t.equal(await t.page.getAttribute('#b-sound', 'aria-pressed'), 'false', 'sound button reflects mute');
    },
  },
  {
    name: 'patterns',
    async run(t) {
      await t.seed(1);
      await t.game('newGame', { mode: 'classic' });
      const b = EMPTY();
      for (let k = 0; k < 6; k++) { b[1 * 9 + k + 1] = k + 1; b[2 * 9 + k + 1] = k + 1; }
      b[5 * 9 + 2] = 7; b[5 * 9 + 4] = 8;
      await t.game('setState', { board: b, tray: [{ id: 'x5' }, { id: 'u5a' }, { id: 'v5b' }], era: 3, score: 2100 });
      await t.game('act', 'hideToast');
      await t.shot('62-patterns');
      const h1 = await t.game('act', 'canvasHash');
      await t.game('act', 'setting', 'patterns', false);
      await t.shot('63-patterns-off');
      const h2 = await t.game('act', 'canvasHash');
      t.expect(h1 !== h2, 'patterns toggle changes the tiles');
      await t.game('act', 'setting', 'patterns', true);
    },
  },
  {
    name: 'settings persist',
    async run(t) {
      await t.game('scene', 'settings');
      await t.page.click('#s-patterns');
      await t.page.selectOption('#s-motion', 'reduced');
      await t.page.selectOption('#s-undo', '3');
      await t.page.click('#s-big');
      await t.page.selectOption('#s-theme', 'dark');
      await t.checkLayout();
      await t.shot('64-settings');
      const fs = await t.page.evaluate(() => getComputedStyle(document.body).fontSize);
      t.equal(fs, '20px', 'large text applied');
      await t.page.reload();
      await t.page.waitForFunction(() => !!window.__game);
      const s = (await t.game('act', 'save')).settings;
      t.equal([s.patterns, s.motion, s.undo, s.bigText, s.theme], [false, 'reduced', 3, true, 'dark'], 'settings survive reload');
      const bg = await t.page.evaluate(() => getComputedStyle(document.querySelector('#sc-title .panel')).backgroundColor);
      t.equal(bg, 'rgb(31, 28, 46)', 'dark theme applied from setting');
      const g = await t.game('newGame', { mode: 'classic' });
      t.equal(g.undoLeft, 3, 'undo setting used by new games');
    },
  },
  {
    name: 'help',
    async run(t) {
      await t.game('scene', 'help');
      const txt = await t.page.textContent('#sc-help');
      for (const k of ['row', 'column', '3×3', 'Pieces never rotate', 'heat', 'Daily Soak', 'Springs', 'Spring Trail', 'Keyboard', 'Undo']) t.expect(txt.includes(k), 'help mentions ' + k);
      await t.checkLayout();
      await t.shot('65-help');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).scene, 'title', 'Escape backs out of help');
    },
  },
  {
    name: 'dark scheme',
    colorScheme: 'dark',
    async run(t) {
      const bg = await t.page.evaluate(() => getComputedStyle(document.querySelector('#sc-title .panel')).backgroundColor);
      t.equal(bg, 'rgb(31, 28, 46)', 'dark panel');
      await t.checkLayout();
      await t.shot('66-dark-title');
      await t.seed(12);
      await t.game('newGame', { mode: 'springs' });
      await t.game('act', 'hideToast');
      await t.shot('67-dark-game');
      await t.game('scene', 'pause');
      await t.shot('68-dark-pause');
    },
  },
  {
    name: 'touch targets',
    viewports: ['mobile'],
    async run(t) {
      const check = async where => {
        const small = await t.page.$$eval('button, select, input', els => els.filter(e => e.offsetParent && getComputedStyle(e).visibility !== 'hidden')
          .map(e => { const r = e.getBoundingClientRect(); return { id: e.id || e.textContent.trim().slice(0, 20), w: r.width, h: r.height, type: e.type }; })
          .filter(b => (b.type === 'checkbox' ? b.w < 24 : (b.w < 44 || b.h < 44))));
        t.equal(small, [], 'controls ≥ 44 px on ' + where);
      };
      await check('title');
      await t.game('newGame', { mode: 'classic' });
      await check('game');
      for (const sc of ['pause', 'settings', 'trail', 'records', 'help']) { await t.game('scene', sc); await check(sc); }
    },
  },
];
