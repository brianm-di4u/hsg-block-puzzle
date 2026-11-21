// M3: Spring Trail. Every level is solvable (solutions from tools/rules-node.mjs, replayed through the
// real game), wins unlock cards and the next level, losses offer undo (AC20, AC21).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRules } from '../tools/rules-node.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOL = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'tools', 'solutions.json'), 'utf8'));
const RULES = loadRules();
const levelKey = L => JSON.stringify([L.board, L.pieces, L.goal]);

async function play(t, L, moves) {
  await t.game('newGame', { mode: 'trail', level: L.id });
  for (const [id, r, c] of moves) {
    const s = await t.state();
    const k = s.tray.findIndex(x => x && x.id === id);
    t.expect(k >= 0, `${L.id}: ${id} in tray`);
    if (k < 0) return false;
    const res = await t.game('act', 'place', k, r, c);
    t.expect(res.ok, `${L.id}: ${id}@${r},${c} legal`);
  }
  return (await t.state()).won;
}

export const tests = [
  {
    name: 'trail select',
    async run(t) {
      await t.game('scene', 'trail');
      const btns = await t.page.$$eval('#levels button', els => els.map(e => ({ dis: e.disabled, txt: e.textContent })));
      t.equal(btns.length, 24, 'twenty-four levels');
      t.equal(btns.filter(b => !b.dis).length, 1, 'only the first is open');
      await t.checkLayout();
      await t.shot('43-trail-select');
    },
  },
  {
    name: 'every level solvable and unlocks its card',
    viewports: ['desktop'],
    async run(t) {
      const levels = await t.game('getLevels');
      t.equal(levels.length, 24, 'twenty-four levels');
      for (const [i, L] of levels.entries()) {
        const rec = SOL[L.id];
        t.expect(rec && rec.key === levelKey(L), `${L.id}: solutions.json is current (re-run node tools/rules-node.mjs)`);
        t.expect(rec && rec.solution, `${L.id}: solver found a solution`);
        if (!rec || !rec.solution) continue;
        if (i === 6) { await t.game('newGame', { mode: 'trail', level: L.id }); await t.game('act', 'hideToast'); await t.shot('44-trail-level'); }
        const won = await play(t, L, rec.solution);
        t.expect(won, `${L.id}: solution wins in the game`);
        await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 4000 }).catch(() => t.fail(L.id + ': no win screen'));
        if (i === 6) await t.shot('45-trail-win');
        const save = await t.game('act', 'save');
        t.expect(save.trail.done.includes(L.id), `${L.id}: card collected`);
      }
      await t.game('scene', 'trail');
      const open = await t.page.$$eval('#levels button', els => els.filter(e => !e.disabled).length);
      t.equal(open, 24, 'all levels open after solving');
      await t.game('scene', 'cards');
      const cards = await t.page.$$eval('#cards .card:not(.locked)', els => els.length);
      t.equal(cards, 12, 'twelve cards shown');
      await t.checkLayout();
      await t.shot('46-cards');
    },
  },
  {
    name: 'mobile trail play and album',
    viewports: ['mobile'],
    async run(t) {
      const levels = await t.game('getLevels');
      for (const L of levels.slice(0, 3)) await play(t, L, SOL[L.id].solution);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 4000 });
      await t.checkLayout();
      await t.shot('45-trail-win');
      await t.game('newGame', { mode: 'trail', level: levels[3].id });
      await t.game('act', 'hideToast');
      await t.shot('44-trail-level');
      await t.game('scene', 'cards');
      const locked = await t.page.$$eval('#cards .card.locked', els => els.length);
      t.equal(locked, 9, 'nine cards still locked');
      await t.checkLayout();
      await t.shot('46-cards');
    },
  },
  {
    name: 'trail loss offers undo',
    viewports: ['desktop'],
    async run(t) {
      await t.game('newGame', { mode: 'trail', level: 'display-spring' });
      for (const [k, r, c] of [[0, 0, 0], [1, 0, 4], [2, 0, 8]]) await t.game('act', 'place', k, r, c);
      let s = await t.state();
      t.expect(s.over && !s.won, 'out of pieces without reaching the goal');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
      const txt = await t.page.textContent('#sc-over');
      t.expect(/Out of pieces/.test(txt), 'loss title');
      t.expect(await t.page.isVisible('#b-ovundo'), 'undo offered');
      await t.page.click('#b-ovundo');
      s = await t.state();
      t.equal(s.scene, 'game', 'back in the puzzle');
      t.equal(s.over, false, 'not over');
      t.equal(s.tray.filter(Boolean).length, 1, 'last piece back in the tray');
    },
  },
  {
    name: 'W6-S3-01 W6-S3-06 24/24 zero-pre-clear invariant, #b-next 18-star Ring 2 gate, Trail HUD/queue & Goal/Record isolation',
    async run(t) {
      // 1. All 24 Trail levels start with zero pre-completed groups.
      for (const L of RULES.LEVELS) {
        t.equal(RULES.findClears(RULES.parseLevel(L)).length, 0, L.id + ': zero board-start pre-clears');
      }
      // 2. Trail unconditionally hides Score in #hud and Heat on canvas, rendering Up Next S.queue + 3★ stake.
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('newGame', { mode: 'trail', level: 'lamar-bathhouse' });
      await t.game('act', 'hideToast');
      const scoreHidden = await t.page.evaluate(() => document.querySelector('#hud .stat.score').hidden);
      t.equal(scoreHidden, true, 'Trail hides #hud Score');
      const ct = await t.game('act', 'canvasText');
      t.expect(!ct.texts.some(x => /\bHEAT\b|Heat |°F|Boiling/.test(x.text)), 'Trail prints zero Heat chrome: ' + ct.texts.map(x => x.text).join(' | '));
      t.expect(ct.texts.some(x => /UP NEXT|^Next$/.test(x.text)), 'Trail shows Up Next queue label: ' + ct.texts.map(x => x.text).join(' | '));
      t.expect(ct.texts.some(x => /★★★/.test(x.text)), 'Trail shows 3★ Undo stake: ' + ct.texts.map(x => x.text).join(' | '));
      t.expect(ct.texts.every(x => x.size >= 12), 'all Trail canvas text >= 12 px');
      // 3. Trail solves never farm endless Goals (clear-spring, four-at-once, boiling, bathhouse-regular) or arcade Records.
      const before = await t.game('act', 'save');
      for (const id of ['display-spring', 'ozark-bathhouse', 'lamar-bathhouse']) {
        const L = RULES.LEVELS.find(x => x.id === id);
        t.expect(await play(t, L, SOL[id].solution), id + ': solved cleanly');
        await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 4000 });
      }
      const after = await t.game('act', 'save');
      t.equal(after.stats.games, before.stats.games + 3, 'Trail counts games played');
      t.equal(after.stats.lines, before.stats.lines, 'Trail does not farm lifetime lines');
      t.equal(after.stats.springs, before.stats.springs, 'Trail does not farm lifetime springs');
      t.equal(after.stats.bestCombo, before.stats.bestCombo, 'Trail does not write bestCombo');
      t.equal(after.stats.bestHeat, before.stats.bestHeat, 'Trail does not write bestHeat');
      t.equal(after.stats.longest, before.stats.longest, 'Trail does not write longest');
      t.expect(!after.ach['clear-spring'] && !after.ach['four-at-once'] && !after.ach['boiling'] && !after.ach['bathhouse-regular'], 'Trail does not grant endless skill Goals');
      t.expect(!!after.ach['steady-hand'], 'Trail still grants Steady Hand');
      // 4. #b-next enforces unlocked(idx + 1): solving Level 12 with < 18 stars hides #b-next and blocks click bypass.
      if (t.viewport === 'desktop') {
        const KEY = 'hs-thermal-blocks-v1';
        const ring1 = RULES.LEVELS.slice(0, 12).map(l => l.id);
        await t.page.evaluate(([k, ids]) => {
          const sv = JSON.parse(localStorage.getItem(k));
          sv.trail.done = ids.slice(0, 11);
          sv.trail.stars = { 'display-spring': 3 };
          localStorage.setItem(k, JSON.stringify(sv));
        }, [KEY, ring1]);
        await t.reload();
        const lv12 = RULES.LEVELS[11];
        t.expect(await play(t, lv12, SOL[lv12.id].solution), 'Level 12 solved with < 18 stars');
        await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 4000 });
        t.equal(await t.page.isVisible('#b-next'), false, '#b-next hidden when Ring 2 is locked (< 18 stars)');
        // Even forcing a click on #b-next must not open Ring 2 Level 13.
        await t.page.evaluate(() => document.getElementById('b-next').click());
        const stBlocked = await t.state();
        t.expect(stBlocked.scene === 'trail' && stBlocked.level !== RULES.LEVELS[12].id, '#b-next click cannot bypass 18-star Ring 2 gate');
        // Now grant 18+ stars and solve Level 12 again: #b-next shows and opens Level 13.
        await t.page.evaluate(([k, ids]) => {
          const sv = JSON.parse(localStorage.getItem(k));
          sv.trail.done = ids.slice();
          sv.trail.stars = Object.fromEntries(ids.slice(0, 6).map(id => [id, 3]));
          localStorage.setItem(k, JSON.stringify(sv));
        }, [KEY, ring1]);
        await t.reload();
        t.expect(await play(t, lv12, SOL[lv12.id].solution), 'Level 12 solved with 18 stars');
        await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 4000 });
        t.equal(await t.page.isVisible('#b-next'), true, '#b-next shown once 18 stars unlock Ring 2');
        await t.page.click('#b-next');
        t.equal((await t.state()).level, RULES.LEVELS[12].id, '#b-next opens Ring 2 Level 13 when unlocked');
      }
    },
  },
  {
    name: 'W6-S4-05 Ring 2 architectural/geological silhouettes (<=2 glazes, real vents on Springs puzzles, stones+vents compound goal)',
    viewports: ['desktop'],
    async run(t) {
      const ring2 = RULES.LEVELS.slice(12);
      t.equal(ring2.length, 12, 'twelve Ring 2 puzzles');
      for (const L of ring2) {
        const b = RULES.parseLevel(L);
        const glazes = new Set(b.filter(v => v >= 1 && v <= 6));
        t.expect(glazes.size <= 2, L.id + ': uses <= 2 glaze colors (got ' + glazes.size + ')');
        if (/springs/i.test(L.name)) {
          t.expect(RULES.count(b, 8) > 0, L.id + ' ("' + L.name + '"): contains real Spring Vents');
        }
      }
      // Verify stones+vents compound goal requires BOTH stones and vents cleared, and HUD/label render cleanly.
      const compound = ring2.filter(L => L.goal === 'stones+vents');
      t.expect(compound.length >= 6, 'Ring 2 uses >= 6 compound stones+vents goals (' + compound.length + ')');
      const lv = compound[0];
      await t.game('newGame', { mode: 'trail', level: lv.id });
      const hudCheck = await t.page.evaluate((lvId) => {
        const L = LEVELS.find(x => x.id === lvId);
        const g1 = { mode: 'trail', goal: 'stones+vents', board: new Array(81).fill(0) };
        g1.board[0] = 7;
        const metOnlyStone = goalMet(g1);
        g1.board[0] = 0; g1.board[1] = 8;
        const metOnlyVent = goalMet(g1);
        g1.board[1] = 0;
        const metClear = goalMet(g1);
        return {
          metOnlyStone, metOnlyVent, metClear,
          goalLabelText: goalLabel('stones+vents'),
          hudGoalPair: hudGoal(),
          goalTextStr: goalText(),
          levelName: L.name,
        };
      }, lv.id);
      t.equal(hudCheck.metOnlyStone, false, 'stones+vents not met while tufa stone remains');
      t.equal(hudCheck.metOnlyVent, false, 'stones+vents not met while spring vent remains');
      t.equal(hudCheck.metClear, true, 'stones+vents met once both tufa and vents are cleared');
      t.expect(/tufa/i.test(hudCheck.goalLabelText) && /vent/i.test(hudCheck.goalLabelText), 'goalLabel names tufa & vents: ' + hudCheck.goalLabelText);
      t.expect(Array.isArray(hudCheck.hudGoalPair) && hudCheck.hudGoalPair[1] > 0, 'hudGoal reports remaining count: ' + JSON.stringify(hudCheck.hudGoalPair));
      t.expect(/tufa/i.test(hudCheck.goalTextStr) && /vent/i.test(hudCheck.goalTextStr), 'goalText names tufa & vents: ' + hudCheck.goalTextStr);
    },
  },
];
