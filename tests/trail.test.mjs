// M3: Spring Trail. Every level is solvable (solutions from tools/rules-node.mjs, replayed through the
// real game), wins unlock cards and the next level, losses offer undo (AC20, AC21).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOL = JSON.parse(fs.readFileSync(path.join(HERE, '..', 'tools', 'solutions.json'), 'utf8'));
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
      t.equal(btns.length, 12, 'twelve levels');
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
      t.equal(levels.length, 12, 'twelve levels');
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
      t.equal(open, 12, 'all levels open after solving');
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
];
