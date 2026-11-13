// Council wave 2, batch A: music, ambience and cue variation (S5-01, S5-02, S5-03).
const KEY = 'hs-thermal-blocks-v1';
const MUSIC = { peakLo: 0.06, peakHi: 0.16, rmsLo: -40, rmsHi: -28 };
const AMB = { peakHi: 0.07, rmsLo: -52, rmsHi: -38 };

const render = (t, name, seconds) => t.page.evaluate(([n, s]) => window.__game.audioRender(n, s, false), [name, seconds]);
async function audioState(t) { return t.game('act', 'audioState'); }
async function startAudio(t) {
  await t.game('act', 'audio', 'click');
  await t.page.waitForTimeout(300);
  const s = await audioState(t);
  return s.kit && s.state === 'running' ? s : null;
}
const setHidden = (t, h) => t.page.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, h);

export const tests = [
  {
    name: 'S5-01 every music piece renders inside the mix limits and has form and variation',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      t.expect(list.music.length >= 10, 'a title piece, seven eras, a win and a game-over piece (' + list.music.join(', ') + ')');
      for (const need of ['title', 'win', 'over', 'ancient', 'modern']) t.expect(list.music.includes(need), 'has ' + need);
      for (const name of list.music) {
        const r = await render(t, name, 60);
        t.log(name + ': peak ' + r.peak + ', rms ' + r.rmsDb + ' dB, ' + JSON.stringify(r.built) + ', repeats after ' + list.formSeconds[name] + ' s');
        t.expect(r.peak >= MUSIC.peakLo && r.peak <= MUSIC.peakHi, name + ' peak ' + r.peak + ' in 0.06 to 0.16');
        t.expect(r.rmsDb >= MUSIC.rmsLo && r.rmsDb <= MUSIC.rmsHi, name + ' rms ' + r.rmsDb + ' dB in -40 to -28');
        t.expect(r.longestSilence < 2, name + ' has no silent stretch (' + r.longestSilence + ' s)');
        t.expect(list.formSeconds[name] >= 45, name + ' form lasts ' + list.formSeconds[name] + ' s, at least 45');
        t.expect(r.built && r.built.formBars >= 16, name + ' form has ' + (r.built && r.built.formBars) + ' bars');
        t.expect(r.built && r.built.distinctBars >= 6, name + ' distinct bars ' + (r.built && r.built.distinctBars));
        t.expect(r.built && r.built.pitches >= 6, name + ' distinct pitches ' + (r.built && r.built.pitches));
      }
    },
  },
  {
    name: 'S5-02 every ambience scene renders quietly with no silent stretch',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      t.equal(list.ambience.length, 7, 'one bed per era');
      for (const name of list.ambience) {
        const r = await render(t, name, 30);
        t.log(name + ': peak ' + r.peak + ', rms ' + r.rmsDb + ' dB, longest silence ' + r.longestSilence + ' s');
        t.expect(r.peak < AMB.peakHi, name + ' peak ' + r.peak + ' under 0.07');
        t.expect(r.rmsDb >= AMB.rmsLo && r.rmsDb <= AMB.rmsHi, name + ' rms ' + r.rmsDb + ' dB in -52 to -38');
        t.expect(r.longestSilence < 2, name + ' has no silent stretch');
      }
    },
  },
  {
    name: 'S5-02 each bed has a vent layer driven by the heat',
    viewports: ['desktop'],
    async run(t) {
      const n = await t.page.evaluate(() => Object.values(SCENES).map(sc => sc.beds.filter(b => b.param === 'heat').length));
      t.expect(n.every(c => c === 1), 'every scene has one bed driven by the heat (' + n.join(',') + ')');
    },
  },
  {
    name: 'S5-03 frequent cues vary on every repeat and stay in range; the full mix never clips',
    viewports: ['desktop'],
    async run(t) {
      const list = await t.game('audioList');
      for (const cue of list.cues) {
        const seen = new Set(); let lo = 9, hi = 0;
        for (let i = 0; i < 8; i++) {
          const r = await render(t, 'cue:' + cue, 2);
          seen.add(r.peak + '|' + r.rms); lo = Math.min(lo, r.peak); hi = Math.max(hi, r.peak);
        }
        t.log('cue ' + cue + ': peak ' + lo + ' to ' + hi + ', ' + seen.size + ' of 8 repeats distinct');
        t.expect(seen.size >= 7, cue + ': repeats differ (' + seen.size + ' of 8 distinct)');
        if (cue !== 'click') t.expect(lo >= 0.2 && hi <= 0.45, cue + ': peak ' + lo + ' to ' + hi + ' within 0.2 to 0.45');
      }
      for (const id of list.mix) {
        const r = await render(t, 'mix:' + id, 30);
        t.log('mix ' + id + ': peak ' + r.peak + ', rms ' + r.rmsDb + ' dB');
        t.expect(r.peak < 0.95, 'music + ambience + loudest cues never clip in ' + id + ' (' + r.peak + ')');
      }
    },
  },
  {
    name: 'S5-03 place pitch follows piece size and cue pan is held inside 0.7',
    viewports: ['desktop'],
    async run(t) {
      const f = await t.page.evaluate(() => {
        const out = {};
        for (const n of [1, 4, 9]) {
          const freqs = [];
          const keep = { ...AU };
          const oc = new OfflineAudioContext(2, 4410, 22050);
          const orig = oc.createOscillator.bind(oc);
          oc.createOscillator = () => { const o = orig(); const set = o.frequency.setValueAtTime.bind(o.frequency); o.frequency.setValueAtTime = (v, tt) => { freqs.push(v); return set(v, tt); }; return o; };
          Object.assign(AU, { ctx: oc, master: oc.createGain(), noise: makeNoiseBuffer(oc), kit: null });
          try { JIT = { f: 1, g: 1, o: 0, pan: 0 }; playCue('place', { n }, 0.01); } finally { Object.assign(AU, keep); }
          out[n] = freqs[0];
        }
        return { f1: out[1], f4: out[4], f9: out[9], panHi: jitter(5).pan, panLo: jitter(-5).pan };
      });
      t.expect(f.f1 > f.f4 && f.f4 > f.f9, 'small pieces sound higher (' + [f.f1, f.f4, f.f9].map(x => x.toFixed(0)).join(' > ') + ' Hz)');
      t.equal(f.panHi, 0.7, 'pan is held at +0.7');
      t.equal(f.panLo, -0.7, 'pan is held at -0.7');
    },
  },
  {
    name: 'S5-01 nothing plays before the first gesture, and the title has its own music',
    async run(t) {
      let s = await audioState(t);
      t.equal(s.kit, false, 'no audio engine before a gesture');
      t.equal(await t.page.evaluate(() => !!AU.ctx), false, 'no AudioContext yet');
      const live = await startAudio(t);
      if (!live) { t.log('audio context not running in this browser; live checks skipped'); return; }
      s = await audioState(t);
      t.equal(s.music, 'title', 'title music on the title screen');
      t.expect(s.amb === 'bath-ancient', 'ambience bed is playing (' + s.amb + ')');
    },
  },
  {
    name: 'S5-01 a run plays its era piece, the end screen its own, and the title returns',
    viewports: ['desktop'],
    async run(t) {
      const live = await startAudio(t);
      if (!live) { t.log('audio context not running in this browser; skipped'); return; }
      await t.seed(5);
      await t.game('newGame', { mode: 'classic' });
      let s = await audioState(t);
      t.equal(s.music, 'ancient', 'ancient piece at the start of Classic');
      await t.game('setState', { era: 3 });
      await t.game('scene', 'game');
      s = await audioState(t);
      t.equal(s.music, 'roaring', 'era 3 plays its own piece');
      t.equal(s.amb, 'bath-roaring', 'and its own bed');
      await t.game('scene', 'over');
      s = await audioState(t);
      t.equal(s.music, 'over', 'game-over piece on the results screen');
      await t.game('scene', 'title');
      s = await audioState(t);
      t.equal(s.music, 'title', 'back to the title piece');
    },
  },
  {
    name: 'S5-01 pause and a hidden tab hold the music and ambience and schedule nothing',
    viewports: ['desktop'],
    async run(t) {
      const live = await startAudio(t);
      if (!live) { t.log('audio context not running in this browser; skipped'); return; }
      await t.game('newGame', { mode: 'classic' });
      await t.page.waitForTimeout(700);
      let s = await audioState(t);
      t.equal(s.held, false, 'playing in a run');
      t.expect(s.bars > 0, 'the music has started scheduling (' + s.bars + ' bars)');
      await t.game('act', 'pause');
      await t.page.waitForTimeout(700);
      s = await audioState(t);
      t.equal(s.held, true, 'held on the pause card');
      t.expect(s.musicGain < 0.02 && s.ambGain < 0.02, 'both beds faded out (' + s.musicGain.toFixed(3) + ', ' + s.ambGain.toFixed(3) + ')');
      const bars = s.bars;
      await t.page.waitForTimeout(1500);
      t.equal((await audioState(t)).bars, bars, 'no bar scheduled while paused');
      await t.game('act', 'resume');
      await t.page.waitForTimeout(900);
      s = await audioState(t);
      t.equal(s.held, false, 'released on resume');
      t.expect(s.musicGain > 0.2, 'music is back (' + s.musicGain.toFixed(3) + ')');
      await setHidden(t, true);
      await t.page.waitForTimeout(300);
      t.equal((await audioState(t)).held, true, 'held while the tab is hidden');
      await setHidden(t, false);
      await t.page.waitForTimeout(900);
      t.equal((await audioState(t)).held, false, 'released when the tab is back');
    },
  },
  {
    name: 'S5-01 Music and Ambience settings silence their buses and persist across a reload',
    viewports: ['desktop'],
    async run(t) {
      const def = await t.game('act', 'save');
      t.equal(def.settings.music, true, 'music on by default');
      t.equal(def.settings.ambience, true, 'ambience on by default');
      t.equal(def.settings.sfx, true, 'sound effects on by default');
      t.equal(def.settings.musicVol, 0.5, 'music at the quiet default level');
      t.equal(def.settings.ambVol, 0.5, 'ambience at the quiet default level');
      const live = await startAudio(t);
      await t.game('act', 'setting', 'music', false);
      await t.game('act', 'setting', 'ambience', false);
      if (live) {
        await t.page.waitForTimeout(600);
        const s = await audioState(t);
        t.expect(s.musicGain < 0.01, 'music bus silent (' + s.musicGain.toFixed(4) + ')');
        t.expect(s.ambGain < 0.01, 'ambience bus silent (' + s.ambGain.toFixed(4) + ')');
      }
      await t.reload();
      const kept = (await t.game('act', 'save')).settings;
      t.equal(kept.music, false, 'music off survives a reload');
      t.equal(kept.ambience, false, 'ambience off survives a reload');
      await t.game('act', 'setting', 'musicVol', 0.3);
      await t.game('act', 'setting', 'music', true);
      await t.reload();
      const again = (await t.game('act', 'save')).settings;
      t.equal(again.musicVol, 0.3, 'music level survives a reload');
      t.equal(again.music, true, 'music on survives a reload');
      t.equal(again.ambience, false, 'ambience still off');
    },
  },
  {
    name: 'S5-01 the master Sound switch silences music and ambience; an older save keeps its choice',
    viewports: ['desktop'],
    async run(t) {
      // a pre-wave save: sound off, none of the new settings
      const old = { v: 1, settings: { sound: false, volume: 0.7, motion: 'system', patterns: true, undo: 1, bigText: false, theme: 'system', effects: 'full', tapPlace: false },
        best: { classic: 1234, springs: 0, daily: {} }, trail: { done: ['l1'] }, stats: { games: 3, lines: 9, bestHeat: 4, springs: 0 }, resume: null };
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(old)]);
      await t.reload();
      const s = await t.game('act', 'save');
      t.equal(s.settings.sound, false, 'sound stays off');
      t.equal(s.settings.music, true, 'new music setting merged with its default');
      t.equal(s.best.classic, 1234, 'best score kept');
      t.equal(s.trail.done.length, 1, 'trail progress kept');
      const a = await t.game('act', 'audio', 'click');
      if (a.ctx) t.equal(a.gain, 0, 'master gain is zero, so music and ambience are silent too');
      const st = await audioState(t);
      if (st.kit) t.equal(st.master, 0, 'master is zero with the kit running');
      // damaged values fall back to the defaults
      const bad = JSON.parse(JSON.stringify(old)); bad.settings.sound = true; bad.settings.musicVol = 'loud'; bad.settings.ambience = 'yes';
      await t.page.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(bad)]);
      await t.reload();
      const fixed = (await t.game('act', 'save')).settings;
      t.equal(fixed.musicVol, 0.5, 'a damaged music level falls back');
      t.equal(fixed.ambience, true, 'a damaged ambience flag falls back');
    },
  },
  {
    name: 'S5-01 Settings shows Sound effects, Music and Ambience controls that work',
    async run(t) {
      await t.game('scene', 'settings');
      await t.waitForStable();
      for (const id of ['s-sfx', 's-music', 's-musicvol', 's-ambience', 's-ambvol']) t.expect(await t.page.isVisible('#' + id), id + ' is visible');
      await t.page.uncheck('#s-music');
      t.equal((await t.game('act', 'save')).settings.music, false, 'unchecking Music saves');
      await t.page.check('#s-music');
      await t.page.fill('#s-ambvol', '20');
      t.equal((await t.game('act', 'save')).settings.ambVol, 0.2, 'the ambience slider saves');
      await t.page.fill('#s-ambvol', '50');
      await t.page.focus('#s-musicvol');
      await t.page.keyboard.press('ArrowRight');
      t.expect((await t.game('act', 'save')).settings.musicVol > 0.5, 'the music slider works from the keyboard');
      await t.shot('S5-01-settings');
    },
  },
];
