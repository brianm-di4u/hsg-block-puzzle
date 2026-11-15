// Council wave 3, batch E: sound (CL-01, S2-06, S5-05, S5-10, S5-11, P-N02, S5-04, S6-25).
// Levels here are as the player hears them: the render hook runs the master gain (Volume x MASTER_SCALE) and the limiter.
const KEY = 'hs-thermal-blocks-v1';
const readSave = t => t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
// Counts the cues that are actually scheduled on the audio clock (the cue log also records cues a muted game never plays).
const countTones = t => t.page.evaluate(() => { window.__tones = 0; const orig = playCue; playCue = (n, o, at) => { window.__tones++; return orig(n, o, at); }; });
const tones = t => t.page.evaluate(() => window.__tones);
const FULL = { volume: 1, musicVol: 1, ambVol: 1 };
const render = (t, name, seconds, opt) => t.page.evaluate(([n, s, o]) => window.__game.audioRender(n, s, false, o), [name, seconds, opt || {}]);
const median = xs => { const s = xs.slice().sort((a, b) => a - b); return s[(s.length - 1) >> 1]; };
async function medianPeak(t, cue, opt, repeats = 7) {
  const ps = [];
  for (let i = 0; i < repeats; i++) ps.push((await render(t, 'cue:' + cue, 2, opt)).peak);
  return { med: median(ps), lo: Math.min(...ps), hi: Math.max(...ps) };
}

export const tests = [
  // ------------------------------------------------------------------ CL-01 and S5-05: the levels as heard, and a balanced default mix
  {
    name: 'CL-01 the render hook goes through the volume control: half the volume is half the level',
    viewports: ['desktop'],
    async run(t) {
      // A click peaks near 0.1, far below the limiter, so the ratio is the volume ratio. Repeats differ by at most 1.5 dB
      // (a factor of 0.84 to 1), so the ratio of two medians must lie between 0.42 and 0.6 whatever the dice say.
      const a = await medianPeak(t, 'click', { volume: 0.7 }), b = await medianPeak(t, 'click', { volume: 0.35 });
      t.log('click median at volume 0.7: ' + a.med + ', at 0.35: ' + b.med);
      t.expect(b.med / a.med > 0.4 && b.med / a.med < 0.62, 'half the volume gives about half the level (' + (b.med / a.med).toFixed(2) + ')');
      const m = await t.page.evaluate(() => ({ scale: MASTER_SCALE, vol: defaultSave().settings.volume }));
      t.expect(m.scale * m.vol > 0.85 && m.scale * m.vol < 1.05, 'the default master gain is near 1 (' + (m.scale * m.vol).toFixed(3) + ')');
    },
  },
  {
    name: 'S5-05 at the default volume the typical cue peaks 0.2 to 0.45 and the order is click < pick < place < clear < win',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      const med = {};
      for (const cue of list.cues) {
        const r = await medianPeak(t, cue, {});
        med[cue] = r.med;
        t.log(cue + ': median ' + r.med + ' (' + r.lo + ' to ' + r.hi + ')');
        if (cue !== 'click') {
          t.expect(r.med >= 0.2 && r.med <= 0.45, cue + ': median peak ' + r.med + ' within 0.2 to 0.45');
          t.expect(r.lo >= 0.2 * 0.841 && r.hi <= 0.45 * 1.189, cue + ': no repeat more than 1.5 dB outside (' + r.lo + ' to ' + r.hi + ')');
        }
      }
      t.expect(med.click < med.pick && med.pick < med.place && med.place < med.clear && med.clear < med.win,
        'click ' + med.click + ' < pick ' + med.pick + ' < place ' + med.place + ' < clear ' + med.clear + ' < win ' + med.win);
    },
  },
  {
    name: 'CL-01 the busiest moment at full volume, with music and ambience at maximum too, stays under 0.95',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      for (const id of list.mix) {
        const r = await render(t, 'mix:' + id, 14, FULL);
        t.log('mix ' + id + ' at maximum: peak ' + r.peak);
        t.expect(r.peak < 0.95, id + ': music + bed + clears + win + place peak ' + r.peak + ' under 0.95');
      }
      for (const cue of list.cues) {
        const r = await medianPeak(t, cue, FULL, 20);
        t.expect(r.hi < 0.95, cue + ' at maximum volume peaks ' + r.hi + ', under 0.95');
      }
    },
  },

  // ------------------------------------------------------------------ S2-06 letting go of a piece away from the board
  {
    name: 'S2-06 a piece dropped off the board sounds the soft invalid cue and says where to drop it; a tap and a cancel stay quiet',
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'setting', 'sound', false);   // the cue log records a cue whether or not it is heard
      await t.game('setState', { board: new Array(81).fill(0), tray: ['o1', 'o1', 'o1'].map(id => ({ id })) });
      const L = await t.game('layout'), b = L.board;
      const drag = async (tx, ty, release = true, slot = 1) => {
        const sl = L.slots[slot], sx = sl.x + sl.w / 2, sy = sl.y + sl.h / 2;
        await t.page.mouse.move(sx, sy); await t.page.mouse.down();
        await t.page.mouse.move((sx + tx) / 2, (sy + ty) / 2, { steps: 5 }); await t.page.mouse.move(tx, ty, { steps: 5 });
        if (release) await t.page.mouse.up();
      };
      const cues = () => t.game('act', 'cues');
      // a tap on a slot is not a drop
      await t.game('act', 'clearCues'); await t.page.mouse.click(L.slots[2].x + L.slots[2].w / 2, L.slots[2].y + L.slots[2].h / 2);
      t.expect(!(await cues()).includes('invalid'), 'a tap on the tray is quiet');
      // a drag released over the board's own cells is a legal placement: no invalid cue
      await t.game('act', 'clearCues'); await t.game('act', 'setting', 'tipsSeen', true);
      await drag(b.gx + 2.5 * b.cell, b.gy + 2.5 * b.cell, true, 0);
      await t.page.waitForFunction(() => window.__game.getState().board.some(Boolean), null, { timeout: 3000 });
      t.expect(!(await cues()).includes('invalid'), 'a good drop does not sound invalid');
      // a drag cancelled by the browser (pointercancel) says nothing
      await t.game('act', 'clearCues');
      await drag(b.gx + b.cell * 4.5, Math.max(10, b.gy - 2 * b.cell), false);
      await t.page.evaluate(() => { const c = document.getElementById('cv'); c.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })); });
      await t.page.mouse.up();
      t.expect(!(await cues()).includes('invalid'), 'a cancelled drag is quiet');
      // let go well above the board: the soft cue and the sentence
      await t.game('act', 'clearCues');
      await t.page.evaluate(() => { document.getElementById('live').textContent = ''; });
      await drag(b.gx + b.cell * 4.5, Math.max(10, b.gy - 2 * b.cell));
      await t.page.waitForFunction(() => window.__game.act('cues').includes('invalid'), null, { timeout: 3000 });
      await t.page.waitForFunction(() => /Drop the piece on the board/.test(document.getElementById('live').textContent), null, { timeout: 3000 });
      t.expect(true, 'the cue sounded and the live region says where to drop');
      t.equal((await t.state()).tray.filter(Boolean).length, 2, 'the piece went back to its slot (only the good drop used one)');
    },
  },

  // ------------------------------------------------------------------ S5-10 the Volume slider previews as it moves; M works everywhere and confirms an unmute
  {
    name: 'S5-10 dragging the Volume slider ticks a click at most every 120 ms',
    async run(t) {
      await t.game('scene', 'settings');
      await t.game('act', 'audio', 'click');
      await t.page.waitForFunction(() => AU.ctx && AU.ctx.state === 'running', null, { timeout: 5000 });
      await countTones(t);
      // ten input events in one burst are one preview, not ten
      await t.page.evaluate(() => { const el = document.getElementById('s-volume'); for (let v = 40; v < 90; v += 5) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } });
      t.equal(await tones(t), 1, 'a burst of ten slider moves sounds one click');
      t.equal((await readSave(t)).settings.volume, 0.85, 'and the volume follows the slider');
      // 120 ms later the next move sounds again (waits for the clock, not for a guess)
      await t.page.evaluate(() => { window.__t0 = performance.now(); });
      await t.page.waitForFunction(() => performance.now() - window.__t0 > 140, null, { timeout: 3000 });
      await t.page.evaluate(() => { const el = document.getElementById('s-volume'); el.value = 30; el.dispatchEvent(new Event('input', { bubbles: true })); });
      t.equal(await tones(t), 2, 'the next move after 120 ms sounds a second click');
    },
  },
  {
    name: 'S5-10 M mutes and unmutes on the title and in Settings, and an unmute is heard',
    async run(t) {
      await t.game('act', 'audio', 'click');
      await t.page.waitForFunction(() => AU.ctx && AU.ctx.state === 'running', null, { timeout: 5000 });
      await countTones(t);
      for (const scene of ['title', 'settings']) {
        await t.game('scene', scene);
        await t.page.keyboard.press('m');
        t.equal((await readSave(t)).settings.sound, false, 'M on ' + scene + ' turns the sound off');
        t.equal(await tones(t), 0, 'muting makes no sound on ' + scene);
        await t.page.keyboard.press('M');
        t.equal((await readSave(t)).settings.sound, true, 'M on ' + scene + ' turns it back on');
        t.expect(await tones(t) > 0, 'unmuting plays a click on ' + scene);
        await t.page.evaluate(() => { window.__tones = 0; });
      }
      // typing in a field is not a shortcut
      await t.game('scene', 'settings');
      await t.page.focus('#s-volume');
      await t.page.keyboard.press('m');
      t.equal((await readSave(t)).settings.sound, true, 'M with the Volume slider focused leaves the sound alone');
    },
  },
];
