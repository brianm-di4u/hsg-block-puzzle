// Council wave 4, batch C: sound; layout and accessibility; world, words and ceremony.
const BOTH = ['desktop', 'mobile'];

// Plays one cue on a throwaway offline graph and returns every tone it asked for as { f, vol, type }.
const tonesOf = (t, cue, o = {}) => t.page.evaluate(([name, opts]) => {
  const out = [], keep = { ...AU }, realTone = tone, oc = new OfflineAudioContext(2, 4410, 22050);
  tone = (f, tt, dur, type = 'sine', vol = 0.25) => { out.push({ f, t: tt, vol, type }); return realTone(f, tt, dur, type, vol); };
  Object.assign(AU, { ctx: oc, master: oc.createGain(), noise: makeNoiseBuffer(oc), kit: null });
  try { JIT = { f: 1, g: 1, o: 0, pan: 0 }; playCue(name, opts, 0.01); } finally { tone = realTone; Object.assign(AU, keep); }
  return out;
}, [cue, o]);

export const tests = [
  {
    name: 'S5-13 the deal ticks sit an octave under the clear chimes, so a placement that clears does not blur them',
    viewports: ['desktop'],
    async run(t) {
      const deal = await tonesOf(t, 'deal'), clear = await tonesOf(t, 'clear', { G: 1, heat: 0, run: 1 });
      const lowestChime = Math.min(...clear.filter(x => x.type === 'sine').map(x => x.f));
      const body = deal.filter(x => x.vol >= 0.1);
      t.equal(body.length, 3, 'three deal ticks carry the sound');
      t.expect(body.every(x => x.f < 300), 'every loud deal tone is under 300 Hz: ' + body.map(x => x.f).join(', '));
      t.expect(Math.max(...body.map(x => x.f)) * 1.4 < lowestChime, 'the loudest deal tone is more than a fourth under the lowest chime (' + lowestChime + ' Hz)');
      t.expect(deal.filter(x => x.vol < 0.1).every(x => x.vol <= 0.07), 'what sits higher is quiet');
    },
  },
  {
    name: 'S5-13 a blocked move sounds and buzzes once in 250 ms; the next one after that is heard',
    viewports: BOTH,
    async run(t) {
      await t.page.mouse.click(10, 10);
      await t.game('act', 'clearCues');
      const first = await t.page.evaluate(() => {
        window.__buzz = 0; navigator.vibrate = () => { window.__buzz++; return true; };
        window.__t0 = performance.now();
        for (let i = 0; i < 4; i++) window.__game.act('audio', 'invalid');
        return { heard: window.__game.act('heardCues').filter(c => c === 'invalid').length, asked: window.__game.act('cues').filter(c => c === 'invalid').length, buzz: window.__buzz };
      });
      t.equal(first.asked, 4, 'every blocked move is still asked for');
      t.equal([first.heard, first.buzz], [1, 1], 'four in a row make one sound and one buzz');
      await t.page.waitForFunction(() => performance.now() - window.__t0 > 300, null, { timeout: 3000 });
      await t.game('act', 'audio', 'invalid');
      t.equal((await t.game('act', 'heardCues')).filter(c => c === 'invalid').length, 2, 'a later blocked move is heard');
    },
  },
  {
    name: 'S5-14 the first touch of the title on bare ground plays the three-note motif once; a button\'s own click does not',
    viewports: BOTH,
    async run(t) {
      t.equal(await t.game('act', 'cues'), [], 'nothing has sounded yet');
      const box = await t.page.evaluate(() => { const r = document.querySelector('[data-mode="classic"]').getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
      t.expect(box[2] > 0, 'the title has its Play button');
      await t.page.mouse.click(4, 4);
      await t.page.waitForFunction(() => window.__game.act('heardCues').includes('motif'), null, { timeout: 3000 });
      await t.page.mouse.click(4, 4);
      await t.page.mouse.click(6, 6);
      t.equal((await t.game('act', 'cues')).filter(c => c === 'motif').length, 1, 'once per visit');
    },
  },
  {
    name: 'S5-14 starting with a button leaves the title silent of the motif',
    viewports: ['desktop'],
    async run(t) {
      await t.page.click('[data-mode="classic"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 5000 });
      t.expect(!(await t.game('act', 'cues')).includes('motif'), 'no motif over a button press');
      t.expect((await t.game('act', 'cues')).includes('click'), 'the click is there');
    },
  },
  {
    name: 'S5-14 the motif is root, fifth and octave in soft sines with an echo; the era cue opens with it and the win cue ends on it',
    viewports: ['desktop'],
    async run(t) {
      const m = await tonesOf(t, 'motif');
      t.equal(m.map(x => +(x.f / m[0].f).toFixed(3)), [1, 1.498, 2], 'ratios 0, 7 and 12 semitones');
      t.expect(m.every(x => x.type === 'sine' && x.vol <= 0.3), 'soft sines');
      const era = (await tonesOf(t, 'era')).filter(x => x.vol >= 0.2).map(x => +(x.f / m[0].f).toFixed(3));
      t.equal(era.slice(0, 3), [1, 1.498, 2], 'the era cue starts with the motif');
      const win = await tonesOf(t, 'win');
      const tail = win.filter(x => x.t > 0.5 && x.vol === 0.09).map(x => +(x.f / m[0].f).toFixed(3));
      t.equal(tail, [1, 1.498, 2], 'the win cue ends on it, softer than the run');
      const r = await t.page.evaluate(() => window.__game.audioRender('cue:motif', 4, false));
      t.expect(r.peak >= 0.03 && r.peak <= 0.5, 'audible and soft: peak ' + r.peak);
      t.expect(r.secs[2] > 0.0003, 'the echo is still heard between two and three seconds, long after the last note ends: ' + r.secs.join(' '));
      const w = await t.page.evaluate(() => window.__game.audioRender('cue:win', 4, false, { volume: 1 }));
      t.expect(w.peak <= 0.95, 'the win cue at full volume stays under 0.95: ' + w.peak);
    },
  },

  {
    name: 'S1-13 tray pieces on a wide screen are 0.75 of a board cell and every piece still sits inside its well',
    viewports: ['desktop'],
    async run(t) {
      await t.seed(4);
      await t.game('newGame', { mode: 'classic' });
      const geo = () => t.page.evaluate(() => {
        const L = window.__game.layout(), cell = LAY.board.cell, bad = [];
        for (const id of Object.keys(PIECES)) {
          S.tray = [{ id }, null, null];
          const g = slotPieceGeom(0), sl = L.slots[0], p = PIECES[id];
          if (g.x < sl.x + 8 - 0.01 || g.x + p.wd * g.s > sl.x + sl.w - 8 + 0.01 || g.y < sl.y || g.y + p.h * g.s > sl.y + sl.h) bad.push(id);
        }
        return { land: L.land, ratio: L.trayScale / cell, cell, bad, n: Object.keys(PIECES).length, slotH: L.slots[0].h };
      });
      for (const [w, h] of [[1280, 800], [1024, 700]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.page.waitForFunction(([vw]) => window.__game.layout().land && LAY.W + INS.l + INS.r === vw, [w], { timeout: 5000 });
        const g = await geo();
        t.expect(g.land, w + 'x' + h + ' is a wide layout');
        t.expect(Math.abs(g.ratio - 0.75) < 0.005, w + 'x' + h + ': the tray scale is 0.75 of a cell, not 0.62 (' + g.ratio.toFixed(3) + ')');
        t.equal(g.bad, [], w + 'x' + h + ': all ' + g.n + ' pieces sit inside the well');
        t.expect(1 / g.ratio < 1.4, 'a piece grows by less than 40 percent when picked up (' + (1 / g.ratio).toFixed(2) + ')');
        if (w === 1280) { await t.seed(4); await t.game('newGame', { mode: 'classic' }); await t.shot('S1-13-tray'); }
      }
      await t.page.setViewportSize({ width: 844, height: 390 });
      await t.page.waitForFunction(() => window.__game.layout().land && LAY.short, null, { timeout: 5000 });
      const short = await geo();
      t.expect(short.ratio > 0.62 && short.ratio <= 0.9 + 1e-6, 'a phone on its side keeps its own scale (' + short.ratio.toFixed(2) + ')');
      await t.page.setViewportSize({ width: 1280, height: 800 });
    },
  },
  {
    name: 'S1-13 a phone in portrait keeps its tray scale of 0.9 of a cell at most',
    viewports: ['mobile'],
    async run(t) {
      await t.game('newGame', { mode: 'classic' });
      const r = await t.page.evaluate(() => ({ land: LAY.land, ratio: LAY.trayScale / LAY.board.cell }));
      t.expect(!r.land && r.ratio <= 0.9 + 1e-6 && r.ratio > 0.5, 'portrait ratio ' + r.ratio.toFixed(2));
      await t.shot('S1-13-tray');
    },
  },
];
