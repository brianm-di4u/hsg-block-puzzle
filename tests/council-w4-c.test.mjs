// Council wave 4, batch C: sound; layout and accessibility; world, words and ceremony.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GAME_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

  {
    name: 'C4-02 the Help screen says how the art was made, in one plain line that is on screen and inside its card',
    viewports: BOTH,
    async run(t) {
      await t.game('scene', 'help');
      const LINE = 'Art: 3D block-outs painted with AI image tools for this game.';
      const info = await t.page.evaluate(line => {
        const p = [...document.querySelectorAll('#sc-help p')].find(e => e.textContent.trim() === line);
        if (!p) return null;
        p.scrollIntoView({ block: 'center' });
        const r = p.getBoundingClientRect(), panel = document.querySelector('#sc-help .panel').getBoundingClientRect();
        return { left: r.left, right: r.right, panelL: panel.left, panelR: panel.right, vw: innerWidth, lines: Math.round(r.height / parseFloat(getComputedStyle(p).lineHeight)), count: [...document.querySelectorAll('#sc-help p')].filter(e => /AI image/i.test(e.textContent)).length };
      }, LINE);
      t.expect(!!info, 'the line is in the Help screen exactly as written');
      t.expect(info.left >= info.panelL && info.right <= info.panelR && info.right <= info.vw, 'it sits inside the card and the screen');
      t.equal(info.count, 1, 'it is said once');
      t.expect(await t.page.evaluate(() => !/OpenAI|Codex|Blender|Midjourney|Stable/i.test(document.querySelector('#sc-help').innerText.split('About the pictures')[1] || '')), 'no company or product is named in that section');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('C4-02-credits-line');
    },
  },

  {
    name: 'C4-03 the approved lines are on the cards, in the ticker and in the era captions, character for character, and the Superior year is 2013',
    viewports: ['desktop'],
    async run(t) {
      const w = await t.game('act', 'words');
      const eras = await t.page.evaluate(() => ERAS.map(e => ({ id: e.id, cap: e.cap })));
      const facts = id => w.cards[id].facts;
      t.equal(facts('hale-bathhouse')[2], 'Its former sweat cave in the tufa bluff was called the "electric cave."', 'Hale, third fact');
      t.equal(facts('superior-bathhouse'), ['The northernmost house on the Row. Its concrete facade is painted to look like tile, with green tile medallions.', 'Since 2013 it has housed a brewery and distillery.', 'Smallest on the Row, it offered only basic hydrotherapy, mercury and massage, at the lowest rates.'], 'Superior: 2013 and a third fact');
      t.expect(w.cards['superior-bathhouse'].src.includes('Superior Bathhouse Brewery: History'), 'the brewery page is a source of that card');
      t.equal(facts('ozark-bathhouse')[2], 'It was a bathhouse for middle-class bathers, and it stopped operating in 1977.', 'Ozark, third fact');
      t.equal(facts('maurice-spring-fountain')[2], 'A new jug fountain was installed on the sidewalk in front of the NPS Administration Building in 1966.', 'Maurice Spring Fountain, third fact');
      for (const line of ['The park’s traditional bath routine: full tub 98 to 100 degrees, head-out vapor cabinet five minutes.', 'In 1920 an attendant’s fee at Hot Springs was capped at 20 cents a bath, or $4 a course.', 'The park provides spring water free of charge at all of its jug fountains.'])
        t.expect(w.ticker.includes(line), 'the ticker has: ' + line);
      const second = { ancient: 'Native peoples quarried novaculite from the hills around Hot Springs for many thousands of years.', 'gilded-spa': '1875: the first Arlington Hotel opens as the state’s largest hotel.', roaring: 'Leo P. McLaughlin was mayor from 1927 to 1947 and ran an "open town," with gamblers paying regular fines.', midcentury: '1967: Gov. Winthrop Rockefeller orders the State Police to crack down on gambling in Hot Springs.', modern: 'Hot Springs Creek flows under Bathhouse Row and empties into Lake Hamilton.' };
      for (const [id, line] of Object.entries(second)) t.expect(eras.find(e => e.id === id).cap.endsWith(' ' + line), id + ' caption ends with its second sentence');
      t.expect(eras.find(e => e.id === 'frontier').cap === '1804: William Dunbar writes Thomas Jefferson about "the boiling springs."', 'the other captions are as they were');
      t.expect(!JSON.stringify(w).includes('Since 2012'), 'no 2012 left');
      const help = await t.page.evaluate(() => document.getElementById('sc-help').textContent);
      for (const src of ['Traditional Baths', 'Experience the Water', 'Superior Bathhouse', 'Ozark Bathhouse', 'Arlington Hotel', 'Superior Bathhouse Brewery']) t.expect(help.includes(src), 'Help lists the source: ' + src);
    },
  },
  {
    name: 'C4-03 the longer cards, postcards, era toast and ticker fit at both sizes',
    viewports: BOTH,
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      const levels = await t.game('getLevels');
      await t.page.evaluate(([k, ids]) => { const v = JSON.parse(localStorage.getItem(k) || '{}'); v.trail = { ...(v.trail || {}), done: ids, stars: {} }; v.eraMax = 7; localStorage.setItem(k, JSON.stringify(v)); }, ['hs-thermal-blocks-v1', levels.map(l => l.id)]);
      await t.reload();
      await t.game('scene', 'cards');
      const fit = await t.page.evaluate(() => {
        const bad = [], vw = innerWidth;
        for (const el of document.querySelectorAll('#sc-cards article.card')) {
          const r = el.getBoundingClientRect();
          if (r.right > vw + 0.5 || r.left < -0.5) bad.push('card off screen: ' + el.querySelector('h4, h3, b')?.textContent);
          for (const c of el.querySelectorAll('li, p, h4')) { const cr = c.getBoundingClientRect(); if (cr.right > r.right + 0.5 || cr.bottom > r.bottom + 0.5 || c.scrollWidth > c.clientWidth + 1) bad.push('clipped in ' + el.textContent.slice(0, 30) + ': ' + c.textContent.slice(0, 40)); }
        }
        return { bad, n: document.querySelectorAll('#sc-cards article.card:not(.locked)').length, sw: document.documentElement.scrollWidth, vw };
      });
      t.equal(fit.bad, [], 'nothing is clipped or off the screen on the Cards screen (' + fit.n + ' open cards)');
      t.expect(fit.sw <= fit.vw, 'no sideways scroll');
      await t.page.evaluate(() => document.getElementById('cards-era').scrollIntoView({ block: 'start' }));
      await t.waitFrames(2);
      await t.shot('C4-03-postcards');
      await t.page.evaluate(() => { const c = [...document.querySelectorAll('#sc-cards article.card')].find(a => /Superior Bathhouse/.test(a.textContent)); c.scrollIntoView({ block: 'center' }); });
      await t.waitFrames(2);
      await t.shot('C4-03-superior-card');
      // the arrival toast of the era with the longest second sentence, with the first-time tip in front and the postcard line behind
      await t.game('newGame', { mode: 'classic' });
      const toastBox = await t.page.evaluate(() => {
        const out = [];
        for (const e of ERAS) {
          window.__game.act('toast', e.name + ' · ' + e.years, 'Your score moved the town forward; eras are scenery only. ' + e.cap + ' Postcard added to Fact cards.');
          const r = document.getElementById('toast').getBoundingClientRect();
          out.push({ id: e.id, top: r.top, left: r.left, right: r.right, bottom: r.bottom, vw: innerWidth, vh: innerHeight });
        }
        return out;
      });
      for (const b of toastBox) t.expect(b.top >= 0 && b.left >= 0 && b.right <= b.vw && b.bottom <= b.vh, b.id + ': the era toast is on the screen (top ' + Math.round(b.top) + ')');
      if (t.viewport === 'mobile') t.expect(toastBox.every(b => b.right - b.left >= 330), 'on a phone the toast uses the width, not half of it: ' + toastBox.map(b => Math.round(b.right - b.left)).join(', '));
      await t.game('act', 'toast', 'Roaring Spa Town · 1921–1946', 'Your score moved the town forward; eras are scenery only. ' + await t.page.evaluate(() => ERAS[3].cap) + ' Postcard added to Fact cards.');
      await t.shot('C4-03-era-toast');
      await t.game('act', 'hideToast');
    },
  },

  {
    name: 'C4-03 the results card shows the longer era caption inside itself, and the title ticker holds the new lines',
    viewports: BOTH,
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      const lines = await t.page.evaluate(() => TICKER.slice(-3));
      const tk = await t.page.evaluate(ls => ls.map(l => { document.getElementById('ticker').textContent = l; const r = document.getElementById('ticker').getBoundingClientRect(); return { l, left: r.left, right: r.right, vw: innerWidth, h: r.height, sw: document.documentElement.scrollWidth }; }), lines);
      for (const x of tk) t.expect(x.left >= 0 && x.right <= x.vw && x.sw <= x.vw, 'the ticker line fits the title: ' + x.l.slice(0, 40));
      await t.shot('C4-03-ticker');
      await t.seed(8);
      await t.game('newGame', { mode: 'classic' });
      const b = new Array(81).fill(0); for (let i = 0; i < 81; i++) if ((Math.floor(i / 9) + i % 9) % 2 === 0) b[i] = 1 + (i % 6);
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score: 900, era: 3, groups: 12, placed: 40, undoLeft: 0 });
      await t.game('act', 'hideToast');
      await t.game('act', 'place', 0, 0, 1);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      const r = await t.page.evaluate(() => { const e = document.getElementById('ov-era'), p = document.querySelector('#sc-over .panel').getBoundingClientRect(), q = e.getBoundingClientRect(); return { text: e.textContent, inside: q.left >= p.left - 0.5 && q.right <= p.right + 0.5, sw: document.documentElement.scrollWidth, vw: innerWidth }; });
      t.expect(r.text.includes('Leo P. McLaughlin was mayor from 1927 to 1947'), 'the card carries the Roaring caption: ' + r.text.slice(0, 60));
      t.expect(r.inside && r.sw <= r.vw, 'the caption sits inside the card');
      await t.shot('C4-03-results-era');
    },
  },

  {
    name: 'W6-S2-02 swipeable >=44px SVG Bathhouse Row skyline, mini 9x9 previews, persistent Trail hints, Pause/Over Trail shortcuts & Replay for 3★',
    viewports: BOTH,
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      const levels = await t.game('getLevels');
      await t.page.evaluate(([k, ids]) => {
        const v = JSON.parse(localStorage.getItem(k) || '{}');
        v.trail = { done: ids.slice(0, 3), stars: Object.fromEntries(ids.slice(0, 3).map(id => [id, 3])) };
        localStorage.setItem(k, JSON.stringify(v));
      }, ['hs-thermal-blocks-v1', levels.map(l => l.id)]);
      await t.reload();
      await t.game('scene', 'trail');
      const trailCheck = await t.page.evaluate(() => {
        const strip = document.getElementById('row-strip');
        const stStyle = getComputedStyle(strip);
        const rowBtns = [...strip.querySelectorAll('button')];
        const rowGeom = rowBtns.map(b => {
          const r = b.getBoundingClientRect();
          return { w: r.width, h: r.height, left: r.left, right: r.right, hasSvg: !!b.querySelector('svg.row-svg'), label: b.textContent.trim() };
        });
        const minis = document.querySelectorAll('#levels svg.lv-mini').length;
        return {
          display: stStyle.display,
          nowrap: stStyle.flexWrap === 'nowrap',
          scrollX: stStyle.overflowX === 'auto' || stStyle.overflowX === 'scroll',
          rowGeom,
          minis,
          sw: document.documentElement.scrollWidth,
          vw: innerWidth,
        };
      });
      if (t.viewport === 'desktop') t.expect(trailCheck.nowrap && trailCheck.scrollX, 'Desktop Bathhouse Row skyline is a single-row scrollable strip');
      else t.equal(trailCheck.display, 'grid', 'Mobile Bathhouse Row skyline reflows into a >=44px 4-column grid');
      t.equal(trailCheck.rowGeom.length, 8, '8 Bathhouse Row skyline emblems');
      t.expect(trailCheck.rowGeom.every(g => g.hasSvg && g.w >= 44 && g.h >= 44 && g.left >= 0 && g.right <= trailCheck.vw + 1), 'every Bathhouse Row emblem has inline SVG, >=44x44px target, and stays on-screen');
      t.equal(trailCheck.minis, 24, 'all 24 Trail cards render mini 9x9 board SVG previews');
      t.expect(trailCheck.sw <= trailCheck.vw, 'no page-level horizontal overflow on Trail');

      // Persistent Trail hint on Pause + desktop #h-mode re-read + Pause Trail shortcut
      await t.game('newGame', { mode: 'trail', level: 'fordyce-bathhouse' });
      const fordyce = levels.find(l => l.id === 'fordyce-bathhouse');
      await t.game('act', 'hideToast');
      if (t.viewport === 'desktop') {
        await t.page.click('#h-mode');
        t.expect((await t.page.textContent('#toast')).includes(fordyce.hint), 'tapping #h-mode in Trail calmly re-shows L.hint');
      }
      await t.game('act', 'pause');
      const pauseTxt = await t.page.textContent('#pause-goal');
      t.expect(pauseTxt.includes('Hint: ' + fordyce.hint), 'Pause persistently shows Trail L.hint: ' + pauseTxt);
      t.equal(await t.page.locator('#b-pause-trail').isVisible(), true, 'Pause shows Spring Trail shortcut in Trail');
      await t.page.click('#b-pause-trail');
      t.equal((await t.state()).scene, 'trail', 'Pause Spring Trail shortcut returns straight to #sc-trail');

      // Classic Pause must keep #b-pause-trail hidden
      await t.game('newGame', { mode: 'classic' });
      await t.game('act', 'pause');
      t.equal(await t.page.locator('#b-pause-trail').isVisible(), false, 'Pause hides Spring Trail shortcut in Classic');

      // Trail loss shows L.hint in #ov-tip & #b-ov-trail shortcut
      await t.game('newGame', { mode: 'trail', level: 'hale-bathhouse' });
      const hale = levels.find(l => l.id === 'hale-bathhouse');
      await t.game('setState', { tray: [null, null, null], queue: [], over: true, won: false, scene: 'over' });
      t.expect((await t.page.textContent('#ov-tip')).includes('Hint: ' + hale.hint), 'Trail loss shows L.hint in #ov-tip');
      t.equal(await t.page.locator('#b-ov-trail').isVisible(), true, 'Trail loss shows Spring Trail shortcut');
      await t.page.click('#b-ov-trail');
      t.equal((await t.state()).scene, 'trail', 'Trail loss shortcut jumps back to #sc-trail');

      // 2-star Trail win offers 1-click "Replay for 3★" and immediately restarts same puzzle
      await t.game('newGame', { mode: 'trail', level: 'display-spring' });
      await t.game('setState', { undosUsed: 1 });
      await t.page.evaluate(() => { UI.trailWin = { stars: 2, prev: 2, undos: 1, first: false }; S.won = true; S.over = true; showWinTrail(); });
      t.equal(await t.page.locator('#b-replay3').isVisible(), true, '2-star Trail win shows Replay for 3★');
      await t.page.click('#b-replay3');
      const replayed = await t.state();
      t.equal([replayed.scene, replayed.mode, replayed.level, replayed.undosUsed], ['game', 'trail', 'display-spring', 0], 'Replay for 3★ immediately restarts the same puzzle with 0 undos');
    },
  },

  {
    name: 'W6-S2-03 0-KB focus-trapped Era Postcard Lightbox, All (27) sticky filter bar, SVG Place crests, Title tallies/unread pips & Game Over card links',
    viewports: BOTH,
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      const levels = await t.game('getLevels');
      await t.page.evaluate(([k, ids]) => {
        const v = JSON.parse(localStorage.getItem(k) || '{}');
        v.trail = { done: ids.slice(0, 2), stars: { [ids[0]]: 3, [ids[1]]: 3 } };
        v.eraMax = 3; // 4 eras unlocked
        v.stats = { ...(v.stats || {}), lines: 30 }; // w250 unlocked
        v.ach = { 'first-soak': '2026-11-20' };
        localStorage.setItem(k, JSON.stringify(v));
      }, ['hs-thermal-blocks-v1', levels.map(l => l.id)]);
      await t.reload();

      // Title zero-height inline counts (N/27 & N/12) + unread pip appears on new unlock and clears on visit + landscape 844x390 fits (CD-WF1-08)
      t.equal(await t.page.textContent('#cards-cnt'), '7/27', 'Title shows 7/27 Fact cards tally (2 places + 4 eras + 1 water)');
      t.equal(await t.page.textContent('#records-cnt'), '1/12', 'Title shows 1/12 Goals tally');
      await t.page.evaluate(() => { UI.freshCards.add('water:w250'); fillTitle(); });
      t.equal(await t.page.$eval('#b-cards', e => e.classList.contains('unread')), true, 'Title Fact cards shows antique-brass unread pip when a card was newly earned');
      if (t.viewport === 'mobile') {
        await t.page.setViewportSize({ width: 844, height: 390 });
        await t.waitFrames(2);
        const landFit = await t.page.evaluate(() => {
          const p = document.querySelector('#sc-title .panel').getBoundingClientRect();
          return { bottom: p.bottom, vh: innerHeight, sw: document.documentElement.scrollWidth, vw: innerWidth, linkH: document.getElementById('b-cards').getBoundingClientRect().height };
        });
        t.expect(landFit.bottom <= landFit.vh + 1 && landFit.sw <= landFit.vw, 'Landscape 844x390 Title fits with zero vertical overflow');
        t.expect(landFit.linkH <= 50, 'Title utility link keeps zero vertical growth on mobile landscape (' + landFit.linkH.toFixed(1) + 'px)');
        await t.page.setViewportSize({ width: 390, height: 844 });
        await t.waitFrames(2);
      }

      // Fact cards default to All (27) with #cards-era immediately visible (PREC-03 / CD-WF5-05)
      await t.page.click('#b-cards');
      const hasNewBadge = await t.page.locator('#cards-water .card-new').count();
      t.equal(hasNewBadge, 1, 'Freshly unlocked Water card shows New badge on first visit');
      const cardsInit = await t.page.evaluate(() => {
        const tabs = [...document.querySelectorAll('#cards-tabs button')];
        const rects = tabs.map(b => b.getBoundingClientRect());
        return {
          allPressed: document.getElementById('ctab-all').getAttribute('aria-pressed'),
          allText: document.getElementById('ctab-all').textContent,
          erasVisible: !document.getElementById('sec-eras').hidden,
          minTabH: Math.min(...rects.map(r => r.height)),
          placeCrests: document.querySelectorAll('#cards svg.card-crest').length,
          lockedPostcards: document.querySelectorAll('#cards-era .pic.locked-pic svg').length,
          openPostcardBtns: document.querySelectorAll('#cards-era button.pic-btn').length,
        };
      });
      t.equal(cardsInit.allPressed, 'true', 'All (27) filter active by default');
      t.equal(cardsInit.allText, 'All (27)', 'Album stays lean at 27 cards');
      t.equal(cardsInit.erasVisible, true, '#cards-era is immediately visible on open');
      t.expect(cardsInit.minTabH >= 44, 'every filter pill >= 44px');
      t.equal(cardsInit.placeCrests, 2, 'unlocked Place Cards show inline-SVG landmark crests');
      t.equal(cardsInit.lockedPostcards, 3, 'locked Era Postcards show frosted sepia SVG teasers');
      t.equal(cardsInit.openPostcardBtns, 4, 'unlocked Era Postcards are clickable buttons');

      // Filter pills switch categories cleanly and return to All (27)
      await t.page.click('#ctab-eras');
      t.equal(await t.page.$eval('#sec-places', e => e.hidden), true, 'Era filter hides Bathhouse Row section');
      t.equal(await t.page.$eval('#sec-eras', e => e.hidden), false, 'Era filter keeps Era Postcards visible');
      t.equal(await t.page.$eval('#sec-water', e => e.hidden), true, 'Era filter hides Water Cards section');
      await t.page.click('#ctab-all');
      t.equal(await t.page.$eval('#sec-places', e => e.hidden), false, 'All filter restores Bathhouse Row');

      // Open 0-KB Era Postcard Lightbox from #cards-era, verify decode, VRAM <=2 LRU, Arrow cycling, Tab trap, Escape restore
      await t.page.click('#cards-era button.pic-btn');
      await t.page.waitForFunction(() => document.getElementById('sc-lightbox').classList.contains('on'));
      await t.page.waitForFunction(() => { const im = document.getElementById('lb-img'); return im.complete && im.naturalWidth > 0; }, null, { timeout: 10000 });
      const lbOpen = await t.page.evaluate(() => ({
        title: document.getElementById('lb-title').textContent,
        pos: document.getElementById('lb-pos').textContent,
        cardsInert: document.getElementById('sc-cards').inert,
        activeId: document.activeElement && document.activeElement.id,
        lru: window.__game.act('art').residentBackdropCount,
      }));
      t.equal(lbOpen.title, 'Ancient Valley', 'Lightbox opens clicked Era Postcard');
      t.equal(lbOpen.pos, '1 of 4 unlocked', 'Lightbox shows unlocked count');
      t.equal(lbOpen.cardsInert, true, 'Underlying Cards modal is inert while Lightbox is open');
      t.equal(lbOpen.activeId, 'lb-close', 'Initial Lightbox focus lands on Close');
      t.expect(lbOpen.lru <= 2, 'Lightbox preserves <=2 resident decoded backdrops (got ' + lbOpen.lru + ')');

      // ArrowRight cycles to Frontier Springs, Tab stays trapped inside #sc-lightbox
      await t.page.keyboard.press('ArrowRight');
      t.equal(await t.page.textContent('#lb-title'), 'Frontier Springs', 'ArrowRight advances to next unlocked era');
      for (let i = 0; i < 6; i++) {
        await t.page.keyboard.press('Tab');
        t.equal(await t.page.evaluate(() => document.getElementById('sc-lightbox').contains(document.activeElement)), true, 'Tab stays strictly trapped inside #sc-lightbox');
      }
      await t.page.keyboard.press('Escape');
      t.equal(await t.page.$eval('#sc-lightbox', e => e.classList.contains('on')), false, 'Escape closes Lightbox');
      t.equal(await t.page.evaluate(() => document.activeElement && document.activeElement.classList.contains('pic-btn')), true, 'Focus returns to triggering postcard button');

      // Game Over clickable #ov-hero opens Lightbox & stat-link jumps straight to Cards (and Back returns to Over)
      await t.game('newGame', { mode: 'classic' });
      await t.page.evaluate(() => { UI.newEras = ['Roaring Spa Town']; UI.newCards = ['Water’s age: 250 years']; });
      await t.game('setState', { score: 900, era: 3, placed: 20, groups: 8, over: true, won: false, scene: 'over' });
      await t.page.click('#ov-hero');
      await t.page.waitForFunction(() => document.getElementById('sc-lightbox').classList.contains('on'));
      t.equal(await t.page.textContent('#lb-title'), 'Roaring Spa Town', 'Game Over hero banner opens Lightbox on the reached era');
      await t.page.keyboard.press('Escape');
      const linkBtn = t.page.locator('#ov-stats button.stat-link').first();
      const box = await linkBtn.boundingBox();
      t.expect(box && box.height >= 44 && box.width >= 44, 'Game Over card stat-link meets >=44px touch target');
      await linkBtn.click();
      t.equal((await t.state()).scene, 'cards', 'Game Over card link jumps straight to Fact cards');
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).scene, 'over', 'Backing out of Cards opened from Game Over returns cleanly to Game Over');
    },
  },

  {
    name: 'W6-S1-04 zero verbatim lore duplication, WCAG 2.2.2 interactive ticker, and synced PRD/MECHANICS/backdrop-notes docs',
    viewports: ['desktop'],
    async run(t) {
      const data = await t.page.evaluate(() => {
        const w = window.__game.act('words');
        const lv = window.__game.getLevels();
        const r2 = lv.slice(12).map(l => ({ id: l.id, fact: l.fact }));
        const eras = ERAS.map(e => ({ id: e.id, cap: e.cap }));
        return { ticker: w.ticker, water: w.waterCards, r2, eras };
      });
      const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const citeRe = /\((NPS|USGS|Wikipedia|HSNP|EOA)|Wikipedia|Encyclopedia|NPS:|corpus/;
      // Every Ring 2 fact & ticker line stays <=120 chars and free of face citations
      for (const l of data.r2) {
        t.expect(l.fact.length <= 120, l.id + ' fact <= 120 chars (' + l.fact.length + ')');
        t.expect(!citeRe.test(l.fact), l.id + ' fact has no face citation');
      }
      for (const line of data.ticker) {
        t.expect(line.length <= 120, 'ticker line <= 120 chars: ' + line.slice(0, 40));
        t.expect(!citeRe.test(line), 'ticker line has no face citation: ' + line.slice(0, 40));
      }
      // Zero verbatim overlap across TICKER, WATER_CARDS, Ring 2 facts, and Era captions
      const pools = [
        ...data.ticker.map((s, i) => ['ticker[' + i + ']', norm(s)]),
        ...data.water.map(c => ['water:' + c.id, norm(c.text)]),
        ...data.r2.map(l => ['r2:' + l.id, norm(l.fact)]),
        ...data.eras.map(e => ['era:' + e.id, norm(e.cap)]),
      ];
      const dupes = [];
      for (let i = 0; i < pools.length; i++) {
        for (let j = i + 1; j < pools.length; j++) {
          const [aName, a] = pools[i], [bName, b] = pools[j];
          if (a === b || (a.length >= 35 && b.includes(a)) || (b.length >= 35 && a.includes(b))) {
            dupes.push(aName + ' <-> ' + bName);
          }
        }
      }
      t.equal(dupes, [], 'zero verbatim lore overlap across ticker, water cards, Ring 2 facts, and era captions');

      // WCAG 2.2.2 interactive ticker: button >=44px, click/Enter cycles even under reduced motion
      await t.game('act', 'setting', 'motion', 'reduced');
      await t.game('scene', 'title');
      const tkTag = await t.page.$eval('#ticker', e => ({ tag: e.tagName, h: e.getBoundingClientRect().height, text: e.textContent }));
      t.equal(tkTag.tag, 'BUTTON', '#ticker is an interactive button');
      t.expect(tkTag.h >= 44, '#ticker meets >=44px target height');
      await t.page.click('#ticker');
      const afterClick = await t.page.textContent('#ticker');
      t.expect(afterClick !== tkTag.text, 'clicking #ticker cycles to the next sourced fact');
      await t.page.keyboard.press('Enter');
      const afterEnter = await t.page.textContent('#ticker');
      t.expect(afterEnter !== afterClick, 'pressing Enter on focused #ticker cycles to the next fact');
      await t.game('act', 'setting', 'motion', 'system');

      // Synced PRD.md, MECHANICS.md & research/backdrop-notes.md (CD-WF1-07, CD-WF3-06, W6-S1-04)
      const prd = fs.readFileSync(path.join(GAME_DIR, 'PRD.md'), 'utf8');
      const mech = fs.readFileSync(path.join(GAME_DIR, 'MECHANICS.md'), 'utf8');
      const notes = fs.readFileSync(path.join(GAME_DIR, 'research', 'backdrop-notes.md'), 'utf8');
      t.expect(!/more than 12 trail levels/i.test(prd) && !/only sound effects/i.test(prd), 'PRD.md Out of Scope removes legacy music/12-level exclusions (CD-WF1-07)');
      t.expect(/24 hand-designed/i.test(prd) && /generative WebAudio music/i.test(prd), 'PRD.md adopts 24 Trail levels and generative music');
      t.expect(/Boil-Hold/.test(mech) && /stones\+vents/.test(mech) && /ConvolverNode/.test(mech), 'MECHANICS.md matches shipped rules, Boil-Hold, Trail stones+vents & audio architecture');
      t.expect(/warm lit evening windows/i.test(notes) && /rooftop chillers/i.test(notes) && /1924 Arlington/i.test(notes), 'research/backdrop-notes.md honestly documents shipped painted WebPs (CD-WF3-06)');
    },
  },
];
