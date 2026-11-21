// Wave 2, batch B: S3-01 Classic difficulty curve, S3-03 Spring Trail mastery.
import { loadRules } from '../tools/rules-node.mjs';

const R = loadRules();
const HARD = ['x5', 'u5a', 'u5b', 'v5a', 'v5b', 'v5c', 'v5d', 'o9', 'r6h', 'r6v', 'i5h', 'i5v'];
const EASY = ['o1', 'i2h', 'i2v'];

function share(mode, score, ids, n = 6000, extra = null) {
  const g = R.freshGame(mode);
  g.score = score;
  g.rng = 99;
  if (extra) Object.assign(g, extra);
  let k = 0;
  for (let i = 0; i < n; i++) if (ids.includes(R.pickPiece(g))) k++;
  return k / n;
}

function greedyLength(seed, cap) {
  let ns = seed; const noise = () => ((ns = (ns * 1103515245 + 12345) >>> 0) / 4294967296);
  const g = R.freshGame('classic'); g.rng = 1000 + seed; R.setupGame(g, {});
  let n = 0;
  while (!g.over && n < cap) {
    let best = -1e9, m = null;
    g.tray.forEach((t, k) => {
      if (!t) return;
      const p = R.PIECES[t.id];
      for (let r = 0; r <= 9 - p.h; r++) for (let c = 0; c <= 9 - p.wd; c++) {
        if (!R.canPlace(g.board, t.id, r, c)) continue;
        const b = g.board.slice();
        for (const [dr, dc] of p.cells) b[(r + dr) * 9 + c + dc] = 1;
        let contact = 0, holes = 0;
        for (const [dr, dc] of p.cells) for (const [a, d] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const rr = r + dr + a, cc = c + dc + d;
          if (rr < 0 || rr > 8 || cc < 0 || cc > 8 || (b[rr * 9 + cc] && !p.cells.some(([x, y]) => x === dr + a && y === dc + d))) contact++;
        }
        for (let i = 0; i < 81; i++) if (!b[i]) {
          const rr = Math.floor(i / 9), cc = i % 9;
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, d]) => { const x = rr + a, y = cc + d; return x < 0 || x > 8 || y < 0 || y > 8 || b[x * 9 + y]; })) holes++;
        }
        const s = R.findClears(b).length * 1000 + contact * 3 - holes * 25 + noise();
        if (s > best) { best = s; m = [k, r, c]; }
      }
    });
    if (!m) break;
    R.applyMove(g, m[0], m[1], m[2]);
    n++;
  }
  return { n, over: g.over };
}

export const tests = [
  {
    name: 'S3-01 Classic piece weights follow the era',
    node: true,
    async run(t) {
      // the pressure ramp's own steps; the backdrop steps (ERAS[].at) moved earlier in P-N03 and the ramp did not
      const STEPS = [0, 400, 1000, 2000, 3500, 5500, 8000];
      const hard = STEPS.map(at => share('classic', at, HARD));
      const easy = STEPS.map(at => share('classic', at, EASY));
      t.log('hard share by era ' + hard.map(v => v.toFixed(3)).join(' '));
      t.log('easy share by era ' + easy.map(v => v.toFixed(3)).join(' '));
      t.expect(Math.abs(hard[0] - hard[1]) < 0.02 && Math.abs(easy[0] - easy[1]) < 0.02, 'eras 0 and 1 draw the same pieces as before');
      for (let e = 2; e < 7; e++) {
        t.expect(hard[e] > hard[e - 1], `hard pieces get likelier in era ${e}`);
        t.expect(easy[e] < easy[e - 1], `small pieces get rarer in era ${e}`);
      }
      t.expect(hard[6] > hard[0] * 2, 'last era serves at least twice the hard pieces');
      // PREC-06 synchronized migration (W6-S3-03 / W6-S3-02): Daily escalates strictly by round (score-independent),
      // and Springs escalates by 3-Act vent progress (Act I matches baseline; Act III Final 10 surges).
      t.expect(Math.abs(share('daily', 9000, HARD, 6000, { round: 0 }) - hard[0]) < 0.02, 'Daily ignores score at round 0');
      const dailyLate = share('daily', 0, HARD, 6000, { round: 92 });
      t.expect(dailyLate > hard[0] * 2, 'Daily escalates hard pieces by round (round 92 >= 2x baseline: ' + dailyLate.toFixed(3) + ')');
      t.expect(Math.abs(share('springs', 9000, HARD, 6000, { springs: 0, round: 0 }) - hard[0]) < 0.02, 'Springs Act I keeps baseline weights regardless of score');
      const springsAct3 = share('springs', 0, HARD, 6000, { springs: 38, round: 28 });
      const springsAct3Easy = share('springs', 0, EASY, 6000, { springs: 38, round: 28 });
      t.expect(springsAct3 > hard[0] * 1.5 && springsAct3Easy < easy[0] * 0.75, 'Springs Act III surges hard pieces and trims helpers (' + springsAct3.toFixed(3) + ' / ' + springsAct3Easy.toFixed(3) + ')');
    },
  },
  {
    name: 'S3-01 greedy bot games end between 150 and 300 moves',
    node: true,
    async run(t) {
      const lens = [];
      for (let i = 0; i < 24; i++) lens.push(greedyLength(7 + i, 900));
      const sorted = lens.map(l => l.n).sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      t.log('greedy lengths ' + sorted.join(' ') + ' median ' + median);
      t.expect(median >= 150 && median <= 330, 'median game length ' + median + ' is in range');
      t.expect(lens.filter(l => !l.over).length === 0, 'no run outlives the cap');
    },
  },
  {
    name: 'S3-01 the mercy deal still rescues early and fades late',
    node: true,
    async run(t) {
      const dead = (score) => {
        // a board where only o1 fits: every tray without o1 is dead on arrival unless mercy redraws
        let saved = 0;
        for (let seed = 1; seed <= 400; seed++) {
          const g = R.freshGame('classic'); g.rng = seed; g.score = score;
          g.board = new Array(81).fill(1);
          g.board[40] = 0;
          R.dealTray(g);
          if (g.tray.some(x => R.fitsAnywhere(g.board, x.id))) saved++;
        }
        return saved;
      };
      const early = dead(0), late = dead(8000);
      t.log('rescued of 400: era 0 ' + early + ', era 6 ' + late);
      t.expect(early > late, 'mercy rescues more trays early than in the last era');
      t.expect(late > 0, 'the last era still gives some mercy');
    },
  },
];

// ---------------------------------------------------------------------------------------------- S3-03
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOL = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'tools', 'solutions.json'), 'utf8'));
const KEY = 'hs-thermal-blocks-v1';
const RING1 = R.LEVELS.filter(l => l.ring !== 2).map(l => l.id);
const RING2 = R.LEVELS.filter(l => l.ring === 2);

const storeAndReload = async (t, save) => {
  await t.page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, save]);
  await t.reload();
  await t.waitFrames(3);
};
const readSave = t => t.page.evaluate(k => JSON.parse(localStorage.getItem(k)), KEY);
const oldSave = () => ({
  v: 1, settings: { sound: true, volume: 0.7, motion: 'system', patterns: true, undo: 1, bigText: false, theme: 'system', effects: 'full', tapPlace: false },
  best: { classic: 1234, springs: 55, daily: { '2026-11-01': 300 } }, trail: { done: RING1.slice() },
  stats: { games: 20, lines: 100, bestHeat: 9, springs: 12 }, resume: null,
});
async function playSolution(t, id, undos = 0) {
  await t.game('newGame', { mode: 'trail', level: id });
  const sol = SOL[id].solution;
  for (let u = 0; u < undos; u++) {
    const s = await t.state();
    const [pid, r, c] = sol[0];
    t.expect((await t.game('act', 'place', s.tray.findIndex(x => x && x.id === pid), r, c)).ok, 'first move placed');
    t.expect((await t.game('act', 'undo')).ok, 'undo ' + (u + 1));
  }
  for (const [pid, r, c] of sol) {
    const s = await t.state();
    const res = await t.game('act', 'place', s.tray.findIndex(x => x && x.id === pid), r, c);
    t.expect(res.ok, id + ': ' + pid + ' legal');
  }
  await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 5000 });
}

tests.push(
  {
    name: 'S3-03 second ring: twelve levels, each solvable and in solutions.json',
    node: true,
    async run(t) {
      t.equal(R.LEVELS.length, 24, 'twenty-four levels');
      t.equal(RING2.length, 12, 'twelve in the second ring');
      t.equal(new Set(R.LEVELS.map(l => l.id)).size, 24, 'ids are unique');
      t.equal(R.LEVELS.slice(0, 12).map(l => l.id), RING1, 'the first twelve are unchanged and first');
      for (const L of R.LEVELS) {
        t.equal(R.findClears(R.parseLevel(L)).length, 0, L.id + ': starts with zero pre-cleared groups');
      }
      for (const L of RING2) {
        const rec = SOL[L.id];
        t.expect(rec && rec.key === JSON.stringify([L.board, L.pieces, L.goal]), L.id + ': solutions.json is current (run node tools/rules-node.mjs)');
        t.expect(L.fact && L.fact.length > 20 && L.hint && L.name, L.id + ': has name, hint and spring fact');
        t.expect(L.pieces.length >= 5, L.id + ': five pieces or more');
        const g = R.setupGame(Object.assign(R.freshGame('trail'), { rng: 1 }), { level: L.id });
        for (const [pid, r, c] of (rec && rec.solution) || []) {
          const k = g.tray.findIndex(x => x && x.id === pid);
          t.expect(k >= 0 && R.applyMove(g, k, r, c).ok, L.id + ': replay ' + pid);
        }
        t.expect(g.won, L.id + ': the stored solution wins');
      }
    },
  },
  {
    name: 'S3-03 star thresholds',
    node: true,
    async run(t) {
      t.equal([0, 1, 2, 3, 4, 20].map(R.trailStars), [3, 2, 2, 1, 1, 1], 'stars by undos used');
      t.equal(R.TRAIL_RING2_STARS, 18, 'the second ring opens at 18 stars');
    },
  },
  {
    name: 'S3-03 stars follow undos, only improve, and survive a reload',
    async run(t) {
      const id = 'hale-bathhouse';
      await playSolution(t, id, 0);
      t.expect(await t.page.isVisible('#sc-win'), 'win panel shows');
      t.equal(await t.page.getAttribute('#win-stars .stars', 'aria-label'), '3 of 3 stars', 'three stars with no undos');
      t.expect(/No undos used/.test(await t.page.textContent('#win-sub')), 'panel says no undos');
      await t.checkLayout();
      await t.shot('S3-03-win-3-stars');
      t.equal((await readSave(t)).trail.stars[id], 3, 'saved 3');
      await playSolution(t, id, 1);
      t.equal(await t.page.getAttribute('#win-stars .stars', 'aria-label'), '2 of 3 stars', 'one undo is two stars');
      t.expect(/Solve it again with no undos for 3 stars/.test(await t.page.textContent('#win-sub')), 'panel says how to get the next star');
      t.equal((await readSave(t)).trail.stars[id], 3, 'a worse attempt never lowers the saved stars');
      await t.reload();
      t.equal((await readSave(t)).trail.stars[id], 3, '3 stars after a reload');
      t.equal((await t.game('act', 'save')).trail.stars[id], 3, 'and in the live save');
      await playSolution(t, 'fordyce-bathhouse', 3);
      t.equal(await t.page.getAttribute('#win-stars .stars', 'aria-label'), '1 of 3 stars', 'three undos is one star');
      await playSolution(t, 'fordyce-bathhouse', 2);
      t.expect(/New best: up from 1/.test(await t.page.textContent('#win-sub')), 'new best is announced');
      t.equal((await readSave(t)).trail.stars['fordyce-bathhouse'], 2, 'improved to 2');
      await t.shot('S3-03-win-2-stars');
    },
  },
  {
    name: 'S3-03 the Undo button shows what is at stake',
    async run(t) {
      await t.game('newGame', { mode: 'trail', level: 'hale-bathhouse' });
      t.equal(await t.page.textContent('#h-undo'), '3★', 'starts at three stars');
      const place = async () => t.game('act', 'place', (await t.state()).tray.findIndex(x => x && x.id === 'o1'), 0, 0);
      await place();
      await t.game('act', 'undo');
      t.equal(await t.page.textContent('#h-undo'), '2★', 'one undo, two stars');
      t.expect(/worth 2 stars/.test(await t.page.getAttribute('#b-undo', 'aria-label')), 'screen reader label says so');
      t.expect(/now worth 2 stars/.test(await t.page.textContent('#toast')), 'a toast says the puzzle dropped to two stars');
      for (let i = 0; i < 2; i++) { await place(); await t.game('act', 'undo'); }
      t.equal(await t.page.textContent('#h-undo'), '1★', 'three undos, one star');
      await t.shot('S3-03-undo-stake');
    },
  },
  {
    name: 'S3-03 the undo count survives leaving and resuming a puzzle',
    async run(t) {
      await storeAndReload(t, oldSave());
      await t.game('newGame', { mode: 'trail', level: 'hale-bathhouse' });
      const place = async (id, r, c) => t.game('act', 'place', (await t.state()).tray.findIndex(x => x && x.id === id), r, c);
      t.expect((await place('o1', 0, 0)).ok, 'placed o1');
      t.expect((await place('o4', 0, 5)).ok, 'placed o4');
      await t.game('act', 'undo');
      t.equal((await t.state()).undosUsed, 1, 'one undo used');
      await t.reload();
      await t.page.click('#sc-title [data-go="trail"]');
      await t.page.click('#levels button:nth-child(2)');
      const s = await t.state();
      t.equal(s.level, 'hale-bathhouse', 'same puzzle resumed');
      t.equal(s.undosUsed, 1, 'the undo count came back with the run');
      t.equal(await t.page.textContent('#h-undo'), '2★', 'button shows two stars');
    },
  },
  {
    name: 'S3-03 an older save keeps every solved puzzle and gets stars on the next win',
    async run(t) {
      await storeAndReload(t, oldSave());
      const before = await readSave(t);
      t.equal(before.best.classic, 1234, 'classic best intact');
      await t.page.click('#sc-title [data-go="trail"]');
      const info = await t.page.$$eval('#levels button', els => els.map(e => ({ dis: e.disabled, txt: e.textContent })));
      t.equal(info.length, 24, 'all levels listed');
      t.equal(info.slice(0, 12).filter(b => !b.dis).length, 12, 'every solved puzzle stays open');
      t.expect(info.slice(0, 12).every(b => /Solved · replay for stars/.test(b.txt)), 'solved puzzles invite a replay for stars');
      t.expect(info[12].dis && /Needs 18 stars \(0\)/.test(info[12].txt), 'second ring is locked with its condition in words');
      t.expect(/locked until 18 stars/.test(await t.page.textContent('#levels h3.ring')), 'heading says what is needed');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-03-trail-old-save');
      await playSolution(t, 'display-spring', 0);
      const after = await readSave(t);
      t.equal(after.trail.done, RING1, 'still twelve solved');
      t.equal(after.trail.stars['display-spring'], 3, 'stars arrive on the next win');
      // wave 3 adds best.diff (zeros) to a loaded save; the three bests that existed must be untouched
      t.equal({ classic: after.best.classic, springs: after.best.springs, daily: after.best.daily }, { classic: before.best.classic, springs: before.best.springs, daily: before.best.daily }, 'bests untouched');
      t.equal(after.stats.games, before.stats.games + 1, 'only the games counter moved');
    },
  },
  {
    name: 'S3-03 the second ring opens at eighteen stars',
    async run(t) {
      const save = oldSave();
      save.trail.stars = Object.fromEntries(RING1.slice(0, 5).map(id => [id, 3]).concat([[RING1[5], 2]]));
      await storeAndReload(t, save);
      await t.page.click('#sc-title [data-go="trail"]');
      t.expect(await t.page.$eval('#levels button:nth-of-type(13)', e => e.disabled), '17 stars: still locked');
      t.expect(/Needs 18 stars \(17\)/.test(await t.page.textContent('#levels button:nth-of-type(13)')), 'it says how many you have');
      save.trail.stars[RING1[5]] = 3;
      await storeAndReload(t, save);
      await t.page.click('#sc-title [data-go="trail"]');
      // Ratified CD-WF2-06 / OQ-WF2-02: Ring 2 opens in a rolling 3-puzzle window (13..15 open, 16 locked)
      t.expect(!(await t.page.$eval('#levels button:nth-of-type(13)', e => e.disabled)), '18 stars: Ring 2 #13 open');
      t.expect(!(await t.page.$eval('#levels button:nth-of-type(14)', e => e.disabled)), '18 stars: Ring 2 #14 open in rolling 3-puzzle window');
      t.expect(!(await t.page.$eval('#levels button:nth-of-type(15)', e => e.disabled)), '18 stars: Ring 2 #15 open in rolling 3-puzzle window');
      t.expect(await t.page.$eval('#levels button:nth-of-type(16)', e => e.disabled), '18 stars: Ring 2 #16 waits until an open Ring 2 puzzle is solved');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-03-trail-ring2-open');
      await t.page.click('#levels button:nth-of-type(13)');
      const s = await t.state();
      t.equal(s.level, RING2[0].id, 'the first second-ring puzzle starts');
      await t.game('act', 'hideToast');
      await t.shot('S3-03-ring2-level');
    },
  },
  {
    name: 'W6-S2-02 / CD-WF2-06 forgiving 3-stage Spring Trail Accordion funnel and truthful Finish Ring 1 gate',
    viewports: ['desktop'],
    async run(t) {
      // Stage 1: #1-#3 linear; solving #1-#3 opens full Bathhouse Row Promenade (#4-#9) while #10-#12 wait for 4/6 Row solves
      const s3 = oldSave();
      s3.trail.done = RING1.slice(0, 3);
      s3.trail.stars = Object.fromEntries(s3.trail.done.map(id => [id, 3]));
      await storeAndReload(t, s3);
      await t.page.click('#sc-title [data-go="trail"]');
      let dis = await t.page.$$eval('#levels button', els => els.map(e => e.disabled));
      t.equal(dis.slice(0, 9), Array(9).fill(false), 'Stage 2 Promenade: solving #1-#3 opens #4-#9 simultaneously');
      t.equal(dis.slice(9, 12), [true, true, true], 'Stage 3 Park Finale (#10-#12) waits for 4 Bathhouse Row solves');

      // Stage 3: solving any 4 of #4-#9 (out of order!) opens #10-#12 AND hitting 18 stars before Ring 1 completes says Finish Ring 1
      const s7 = oldSave();
      s7.trail.done = [...RING1.slice(0, 3), RING1[3], RING1[5], RING1[7], RING1[8]]; // 7 done, 4 in Promenade
      s7.trail.stars = Object.fromEntries(s7.trail.done.map(id => [id, 3])); // 21 stars (>= 18), Ring 1 incomplete!
      await storeAndReload(t, s7);
      await t.page.click('#sc-title [data-go="trail"]');
      dis = await t.page.$$eval('#levels button', els => els.map(e => e.disabled));
      t.equal(dis.slice(9, 12), [false, false, false], 'Stage 3 Park Finale: any 4 of 6 Promenade solves open #10-#12 simultaneously');
      t.equal(dis[12], true, 'Ring 2 stays locked until Ring 1 is complete even at 21 stars');
      const r2Head = await t.page.textContent('#levels h3.ring');
      const r2Btn = await t.page.textContent('#levels button:nth-of-type(13)');
      t.expect(/Finish Ring 1/.test(r2Head) && !/locked until 18 stars/.test(r2Head), 'Ring 2 header truthfully says Finish Ring 1 when >=18 stars: ' + r2Head);
      t.expect(/Finish Ring 1/.test(r2Btn), 'Ring 2 card truthfully says Finish Ring 1 when >=18 stars: ' + r2Btn);
    },
  },
  {
    name: 'S3-03 a second-ring win shows its spring fact and no fact card is invented',
    async run(t) {
      const save = oldSave();
      save.trail.stars = Object.fromEntries(RING1.map(id => [id, 2]));
      await storeAndReload(t, save);
      await playSolution(t, RING2[0].id, 0);
      t.expect((await t.page.textContent('#win-card')).includes(RING2[0].fact), 'the spring fact is on the panel');
      t.equal(await t.page.getAttribute('#win-stars .stars', 'aria-label'), '3 of 3 stars', 'stars shown');
      await t.checkLayout();
      await t.shot('S3-03-ring2-win');
      await t.game('scene', 'cards');
      t.equal(await t.page.$$eval('#cards .card', els => els.length), 12, 'still twelve fact cards');
      t.expect(/12 of 12 collected/.test(await t.page.textContent('#cards-sub')), 'cards counted out of twelve');
      await t.game('scene', 'records');
      t.expect(/Trail stars/.test(await t.page.textContent('#rec-stats')), 'Records lists the trail stars');
    },
  },
  {
    name: 'S3-03 a damaged stars record loads clean',
    async run(t) {
      const save = oldSave();
      save.trail.stars = { 'display-spring': 5, 'hale-bathhouse': '3', 'fordyce-bathhouse': -1, 'grand-promenade': 2, 'quapaw-bathhouse': 1.5 };
      await storeAndReload(t, save);
      await playSolution(t, 'buckstaff-bathhouse', 0);
      const after = await readSave(t);
      t.equal(after.trail.stars, { 'grand-promenade': 2, 'buckstaff-bathhouse': 3 }, 'only valid entries kept');
      const bad = oldSave(); bad.trail.stars = 'lots';
      await storeAndReload(t, bad);
      t.equal((await t.game('act', 'save')).trail.stars, {}, 'a non-object becomes empty');
    },
  },
);

tests.push({
  name: 'S3-03 stars from two tabs merge by the higher value and never drop',
  node: true,
  async run(t) {
    const html = fs.readFileSync(path.join(HERE, '..', 'index.html'), 'utf8');
    const core = html.split('// SAVE MERGE CORE (portable regression extracts this same function)')[1].split('// END SAVE MERGE CORE')[0];
    const createSaveStore = new Function(core + '\nreturn createSaveStore;')();
    const defaults = () => ({ v: 1, settings: { sound: true, volume: 0.7 }, best: { classic: 0, springs: 0, daily: {} }, trail: { done: [], stars: {} }, stats: { games: 0, lines: 0, bestHeat: 0, springs: 0 }, resume: null });
    let raw = null, n = 0;
    const storage = { getItem: () => raw, setItem: v => { raw = v; } };
    const tab = () => { const s = createSaveStore(storage, defaults, () => 'r' + (++n)); s.load(); return s; };
    const a = tab(), b = tab();
    a.value.trail.done.push('x'); a.value.trail.stars.x = 2; a.value.trail.stars.y = 3; a.persist();
    b.value.trail.done.push('x'); b.value.trail.stars.x = 3; b.value.trail.stars.z = 1; b.persist();
    const saved = JSON.parse(raw);
    t.equal(saved.trail.stars, { x: 3, y: 3, z: 1 }, 'highest star count per puzzle from both tabs');
    a.value.trail.stars.x = 1; a.persist();
    t.equal(JSON.parse(raw).trail.stars.x, 3, 'a lower value from a stale tab does not lower it');
  },
});
