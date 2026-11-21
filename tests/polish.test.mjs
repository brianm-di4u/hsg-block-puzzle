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
      const scale = await t.page.evaluate(() => MASTER_SCALE);   // the master gain is Volume x MASTER_SCALE (wave 3 CL-01 raised it from 0.6)
      t.expect(Math.abs(a.gain - 0.7 * scale) < 0.01, 'default volume applied: ' + a.gain);
      for (const n of ['place', 'invalid', 'deal', 'undo', 'vent', 'era', 'over', 'win', 'bonus', 'pick']) await t.game('act', 'audio', n);
      await t.game('act', 'setting', 'sound', false);
      a = await t.game('act', 'audio', 'place');
      t.equal(a.gain, 0, 'muted');
      await t.game('act', 'setting', 'sound', true);
      await t.game('act', 'setting', 'volume', 0.5);
      a = await t.game('act', 'audio', 'place');
      t.expect(Math.abs(a.gain - 0.5 * scale) < 0.01, 'volume 50%');
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
      t.equal(bg, 'rgb(24, 35, 38)', 'dark theme applied from setting');
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
      t.equal(bg, 'rgb(24, 35, 38)', 'dark panel');
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
  {
    name: 'W6-S1-03 winter Title ambience (7 scenes intact), activeHarmony() live transposition, ceramic-brass Settings clicks & doUndo() audio sync',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'audio', 'click');
      await t.page.waitForFunction(() => AU.ctx && AU.ctx.state === 'running', null, { timeout: 5000 }).catch(() => {});

      // 1. Title uses bath-ancient with season:'winter' (no winter birds, heat=0, inten=0) while preserving 7 ambience scenes for S5-02.
      await t.game('scene', 'title');
      const titleSt = await t.game('act', 'audioState');
      const list = await t.game('audioList');
      t.equal(list.ambience.length, 7, 'ambience keeps exactly 7 scenes (CD-WF4-04 / S5-02)');
      t.equal(titleSt.amb, 'bath-ancient', 'Title uses bath-ancient');
      t.equal(titleSt.season, 'winter', 'Title applies season:winter modifier');
      t.equal([titleSt.heat, titleSt.inten], [0, 0], 'Title enforces calm heat=0 and inten=0 (CD-WF6-04)');

      // Verify winter modifier actually suppresses summer bird spots in bath-ancient.
      const birdCheck = await t.page.evaluate(() => {
        const sc = SCENES['bath-ancient'];
        const birdSpot = sc.spots.find(sp => sp.make === 'bird');
        return { hasBird: !!birdSpot, noWinter: !!(birdSpot && birdSpot.noWinter) };
      });
      t.equal(birdCheck, { hasBird: true, noWinter: true }, 'bath-ancient bird spot is gated by noWinter');

      // 2. activeHarmony() transposes live clear chimes to active score key (roaring Bb -> 466.2 Hz) when music is playing,
      //    and returns null offline (AU.kit === null) or when music is muted (preserving S5-04 A=440 / S5-14 E=330).
      await t.game('newGame', { mode: 'classic' });
      await t.game('setState', { era: 3, score: 900, heat: 0 });
      await t.game('scene', 'game');
      const harm = await t.page.evaluate(() => {
        const liveRoaring = activeHarmony();
        const mutedBefore = SAVE.settings.music;
        SAVE.settings.music = false;
        const mutedH = activeHarmony();
        SAVE.settings.music = mutedBefore;
        const keepKit = AU.kit;
        AU.kit = null;
        const offlineH = activeHarmony();
        AU.kit = keepKit;
        return {
          livePc: liveRoaring ? liveRoaring.pc : null,
          liveClearRoot: liveRoaring ? +liveRoaring.tonicNear(69).toFixed(1) : null,
          mutedH,
          offlineH,
        };
      });
      t.equal(harm.livePc, 10, 'Roaring (key 58 = Bb) resolves to Bb major-pentatonic pitch class 10');
      t.expect(Math.abs(harm.liveClearRoot - 466.2) < 0.5, 'Roaring live clear root transposes to Bb4 (~466.2 Hz): ' + harm.liveClearRoot);
      t.equal(harm.mutedH, null, 'activeHarmony() returns null when music is muted');
      t.equal(harm.offlineH, null, 'activeHarmony() returns null offline (AU.kit === null)');

      // 3. Glazed-ceramic/antique-brass click wired across Settings & Confirm controls (no bare 660 Hz triangle).
      const clickTone = await t.page.evaluate(() => {
        const out = [], keep = { ...AU }, realTone = tone, oc = new OfflineAudioContext(2, 4410, 22050);
        tone = (f, tt, dur, type = 'sine', vol = 0.25) => { out.push({ f, dur, type, vol }); return realTone(f, tt, dur, type, vol); };
        Object.assign(AU, { ctx: oc, master: oc.createGain(), noise: makeNoiseBuffer(oc), kit: null });
        try { JIT = { f: 1, g: 1, o: 0, pan: 0 }; playCue('click', { dir: 1 }, 0.01); } finally { tone = realTone; Object.assign(AU, keep); }
        return out;
      });
      t.expect(clickTone.length >= 2 && clickTone[0].type === 'sine' && clickTone[0].f !== 660, 'click uses ceramic+brass sine overtones instead of bare 660 Hz triangle');

      await t.game('scene', 'settings');
      await t.game('act', 'clearCues');
      await t.page.selectOption('#s-theme', 'dark');
      await t.page.click('#s-patterns');
      await t.page.selectOption('#s-theme', 'system');
      await t.page.click('#s-patterns');
      const settingsClicks = (await t.game('act', 'cues')).filter(c => c === 'click').length;
      t.expect(settingsClicks >= 4, 'Settings selects and toggles emit ceramic/brass click feedback (' + settingsClicks + ')');

      // 4. doUndo() across era & heat boundary immediately syncs era music, ambience, and heat level.
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      const b = EMPTY(); for (let c = 0; c < 8; c++) b[c] = 1; b[80] = 1; // keep 1 tile so Clear Spring +300 doesn't leap past Frontier to Gilded Spa
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], score: 145, era: 0, heat: 0, undoLeft: 1 });
      await t.game('scene', 'game');
      await t.game('act', 'place', 0, 0, 8); // clears row 0 -> jumps score >= 150 (era 1 Frontier) & raises heat >= 1
      const afterPlace = await t.game('act', 'audioState');
      t.equal([afterPlace.music, afterPlace.amb], ['frontier', 'bath-frontier'], 'crossing into Frontier switches music & ambience');
      t.expect(afterPlace.heat > 0, 'clear raised ambience heat (' + afterPlace.heat + ')');
      await t.game('act', 'undo');
      const afterUndo = await t.game('act', 'audioState');
      t.equal([afterUndo.music, afterUndo.amb], ['ancient', 'bath-ancient'], 'doUndo() reverts music & ambience back to Ancient Valley');
      t.equal(afterUndo.heat, 0, 'doUndo() reverts ambience heat back to 0');
    },
  },
];
