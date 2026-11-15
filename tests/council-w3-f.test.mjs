// Council wave 3, batch F: layout and accessibility, world and words (S2-09, S4-05, S4-08).
// S4-03, S4-07 and S4-02 are reported as needs-owner and change nothing.
const EMPTY = () => new Array(81).fill(0);
const checker = () => { const b = EMPTY(); for (let i = 0; i < 81; i++) if ((Math.floor(i / 9) + i % 9) % 2 === 0) b[i] = 1 + (i % 6); return b; };
const live = t => t.page.evaluate(() => document.getElementById('live').textContent);
const liveHas = (t, re) => t.page.waitForFunction(src => new RegExp(src).test(document.getElementById('live').textContent), re.source, { timeout: 4000 });
// A game one placement from "no room left": a checkerboard with only the single tile fitting.
async function loseGame(t, score) {
  await t.game('newGame', { mode: 'classic' });
  await t.game('setState', { board: checker(), tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score, heat: 3, bestHeat: 7, groups: 12, placed: 40 });
  await t.game('act', 'hideToast');
  await t.game('act', 'place', 0, 0, 1);
  await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
}

export const tests = [
  {
    name: 'S2-09 every overlay screen is a labelled modal dialog',
    async run(t) {
      const r = await t.page.evaluate(() => [...document.querySelectorAll('.screen.overlay')].map(s => {
        const lab = (s.getAttribute('aria-labelledby') || '').split(/\s+/).map(i => (document.getElementById(i) || {}).textContent || '').join('').trim();
        return { id: s.id, role: s.getAttribute('role'), modal: s.getAttribute('aria-modal'), label: lab };
      }));
      t.expect(r.length >= 9, 'found the overlay screens (' + r.length + ')');
      for (const s of r) {
        t.expect(s.role === 'dialog' || s.role === 'alertdialog', s.id + ' has a dialog role');
        t.equal(s.modal, 'true', s.id + ' is modal');
        t.expect(s.id === 'sc-confirm' || s.label.length > 0, s.id + ' is named by its heading (' + s.label + ')');
      }
      const d = await t.page.evaluate(() => ['ov-score', 'ov-new'].every(i => document.getElementById('sc-over').getAttribute('aria-describedby').split(' ').includes(i)));
      t.expect(d, 'the game-over dialog is described by the score and the best line');
      await t.page.evaluate(() => showScene('settings'));
      await t.shot('S2-09-settings-dialog');
    },
  },
  {
    name: 'S2-09 the game-over card announces the score, and "New best" when it is one',
    async run(t) {
      await t.seed(8);
      await loseGame(t, 480);
      await liveHas(t, /No room left\. Score 481\. New best!/);
      await t.page.evaluate(() => showScene('title'));
      await t.seed(9);
      await loseGame(t, 20);
      await liveHas(t, /No room left\. Score 21\. Best: 481/);
      t.expect(!/New best/.test(await live(t)), 'a game below the best does not claim one');
      t.expect(await t.page.evaluate(() => document.getElementById('sc-over').classList.contains('on')), 'the card is up');
      await t.shot('S2-09-game-over');
    },
  },
  {
    name: 'S4-05 the year line on a card is set in the display face, not a typewriter face',
    async run(t) {
      const r = await t.page.evaluate(() => {
        const box = document.createElement('div'); box.className = 'card'; box.innerHTML = '<div class="yr">uncovered 1930s</div>';
        document.getElementById('sc-cards').appendChild(box);
        const cs = getComputedStyle(box.firstChild), out = { fam: cs.fontFamily, spacing: cs.letterSpacing, size: parseFloat(cs.fontSize) };
        box.remove(); return out;
      });
      t.expect(/Fraunces|Palatino|Georgia/.test(r.fam) && !/Courier|monospace/.test(r.fam), 'serif display face (' + r.fam + ')');
      t.expect(parseFloat(r.spacing) > 0, 'with letter-spacing (' + r.spacing + ')');
      const k = await t.page.evaluate(() => getComputedStyle(document.querySelector('#sc-help kbd')).fontFamily);
      t.expect(/Courier|monospace/.test(k), 'key caps keep the monospace face');
      await t.page.evaluate(() => { showScene('cards'); document.getElementById('cards').replaceChildren(cardEl('quapaw-bathhouse', false)); });
      await t.shot('S4-05-fact-card');
    },
  },
  {
    name: 'S4-08 the title subtitle sits on a dark pill and the title fits a phone on its side',
    viewports: ['desktop'],
    async run(t) {
      const sub = () => t.page.evaluate(() => {
        const s = document.querySelector('.logo small'), cs = getComputedStyle(s), b = s.getBoundingClientRect(), p = document.querySelector('#sc-title .panel').getBoundingClientRect();
        const a = (cs.backgroundColor.match(/[\d.]+/g) || []).map(Number);
        return { alpha: a.length > 3 ? a[3] : 1, lum: (a[0] + a[1] + a[2]) / 3, size: parseFloat(cs.fontSize), top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: innerWidth, h: innerHeight, pTop: p.top, pLeft: p.left };
      });
      await t.waitFrames(3);
      const d = await sub();
      t.expect(d.alpha >= 0.6 && d.lum < 60, 'a dark backing at least 60% opaque (alpha ' + d.alpha + ', brightness ' + Math.round(d.lum) + ')');
      t.expect(d.size >= 13, 'the subtitle is at least 13 px (' + d.size.toFixed(1) + ')');
      await t.shot('S4-08-title');
      for (const [w, h] of [[844, 390], [667, 375]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.reload(); await t.waitFrames(3); await t.waitForAnimations();
        const l = await sub();
        t.expect(l.left >= 0 && l.right <= l.w && l.bottom <= l.h, w + 'x' + h + ': the subtitle is on screen');
        t.expect(l.bottom <= l.pTop || l.right <= l.pLeft, w + 'x' + h + ': the subtitle does not run under the menu card');
        if (w === 844) await t.shot('S4-08-title-landscape');
      }
    },
  },
];
