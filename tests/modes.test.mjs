// M3: Daily Soak, Springs, eras, resume, records (AC18, AC19, AC22, AC30, AC32)
const EMPTY = () => new Array(81).fill(0);
const ERA_IDS = ['ancient', 'frontier', 'gilded-spa', 'roaring', 'midcentury', 'revival', 'modern'];
const ERA_AT = [0, 400, 1000, 2000, 3500, 5500, 8000];

export const tests = [
  {
    name: 'daily determinism',
    async run(t) {
      const a = await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
      const b = await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
      const c = await t.game('newGame', { mode: 'daily', date: '2026-10-29' });
      t.equal(a.board, b.board, 'same date, same stones');
      t.equal(a.tray, b.tray, 'same date, same pieces');
      t.equal(a.board.filter(v => v === 7).length, 8, 'eight tufa stones');
      t.expect(JSON.stringify(a.board) !== JSON.stringify(c.board), 'another date, other stones');
      // the piece sequence does not depend on where you play (no mercy redraws in Daily)
      const seqA = [], seqB = [];
      for (const [seq, offset] of [[seqA, 0], [seqB, 3]]) {
        await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
        await t.game('setState', { board: EMPTY() });
        for (let round = 0; round < 3; round++) {
          const s = await t.state();
          seq.push(...s.tray.map(x => x.id));
          for (let k = 0; k < 3; k++) {
            const st = await t.state();
            const id = st.tray[k].id;
            // place each piece somewhere legal, starting from a different corner per run
            let placed = false;
            for (let r = offset; r < 9 && !placed; r++) for (let cc = 0; cc < 9 && !placed; cc++) placed = (await t.game('act', 'place', k, r, cc)).ok;
            t.expect(placed, 'placed ' + id);
          }
        }
      }
      t.equal(seqA, seqB, 'same daily piece sequence regardless of placements');
      await t.game('newGame', { mode: 'daily', date: '2026-10-28' });
      await t.game('act', 'hideToast');
      await t.checkLayout();
      await t.shot('40-daily');
    },
  },
  {
    name: 'springs vents',
    async run(t) {
      await t.seed(21);
      let s = await t.game('newGame', { mode: 'springs' });
      t.equal(s.board.filter(v => v === 8).length, 4, 'starts with four vents');
      await t.game('act', 'hideToast');
      await t.shot('41-springs');
      // a vent clears only with its group
      const b = EMPTY();
      b[4 * 9 + 0] = 8; for (let c = 1; c < 8; c++) b[4 * 9 + c] = 3; b[0] = 8;
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o4' }], springs: 0, heat: 0, score: 0 });
      await t.game('act', 'place', 0, 1, 1);
      s = await t.state();
      t.equal(s.springs, 0, 'no tap without a clear');
      const r = await t.game('act', 'place', 1, 4, 8);
      s = await t.state();
      t.equal(s.springs, 1, 'clearing the row taps its vent');
      t.equal(s.board[0], 8, 'other vent untouched');
      t.equal(r.points, 1 + Math.round(18 * 1.25) + Math.round(40 * 1.25), 'vent tap scores 40 × multiplier');
      // respawn: new tray adds one vent while fewer than 6
      const b2 = EMPTY(); [0, 10, 20, 30, 40].forEach(i => { b2[i] = 8; });
      await t.game('setState', { board: b2, tray: [null, null, { id: 'o1' }] });
      await t.game('act', 'place', 2, 8, 8);
      s = await t.state();
      t.equal(s.board.filter(v => v === 8).length, 6, 'a vent bubbles up with the new tray');
      await t.game('setState', { tray: [null, null, { id: 'o1' }] });
      await t.game('act', 'place', 2, 8, 6);
      s = await t.state();
      t.equal(s.board.filter(v => v === 8).length, 6, 'capped at six vents');
      // 47th tap wins
      const b3 = EMPTY(); b3[8 * 9 + 0] = 8; for (let c = 1; c < 8; c++) b3[8 * 9 + c] = 2;
      await t.game('setState', { board: b3, tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'o4' }], springs: 46, score: 5200, era: 4 });
      await t.game('act', 'place', 0, 8, 8);
      s = await t.state();
      t.expect(s.won && s.over, 'won at 47 taps');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 4000 });
      const txt = await t.page.textContent('#sc-over');
      t.expect(/All 47 springs flowing/.test(txt), 'win title');
      await t.checkLayout();
      await t.shot('42-springs-win');
    },
  },
  {
    name: 'eras',
    async run(t) {
      await t.seed(2);
      await t.game('newGame', { mode: 'classic' });
      // crossing a threshold switches era and shows the caption
      const b = EMPTY(); for (let c = 0; c < 8; c++) b[c] = 1;
      await t.game('setState', { board: b, tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'o4' }], score: 390, era: 0 });
      await t.game('act', 'place', 0, 0, 8);
      let s = await t.state();
      t.equal(s.eraId, 'frontier', 'score 400+ reaches the frontier era');
      const toast = await t.page.textContent('#toast');
      t.expect(/boiling springs/.test(toast), 'frontier caption shown');
      for (let i = 0; i < 7; i++) {
        const board = EMPTY();
        [10, 11, 12, 20, 30, 31, 40, 41, 42, 50, 60, 61, 62, 63, 70, 74].forEach((x, k) => { board[x] = 1 + (k % 6); });
        board[76] = 7; board[24] = 8;
        await t.game('setState', { board, tray: [{ id: 't4a' }, { id: 'o1' }, { id: 'l4b' }], score: ERA_AT[i] + 20, era: i, heat: i * 2 });
        s = await t.state();
        t.equal(s.eraId, ERA_IDS[i], 'era ' + ERA_IDS[i]);
        await t.game('act', 'hideToast');
        await t.shot('5' + i + '-era-' + ERA_IDS[i]);
      }
    },
  },
  {
    name: 'resume and records',
    async run(t) {
      await t.seed(30);
      await t.game('newGame', { mode: 'classic' });
      const first = (await t.state()).tray[0].id;
      let ok = false;
      for (let r = 0; r < 9 && !ok; r++) ok = (await t.game('act', 'place', 0, r, 0)).ok;
      const before = await t.state();
      t.expect(ok && before.tray[0] === null, 'placed ' + first);
      await t.page.reload();
      await t.page.waitForFunction(() => !!window.__game);
      const vis = await t.page.isVisible('#b-continue');
      t.expect(vis, 'Continue offered on the title screen');
      await t.checkLayout();
      await t.shot('47-continue');
      await t.page.click('#b-continue');
      const after = await t.state();
      t.equal(after.scene, 'game', 'resumed into the game');
      t.equal(after.board, before.board, 'board restored');
      t.equal(after.tray, before.tray, 'tray restored');
      t.equal(after.score, before.score, 'score restored');
      await t.game('scene', 'records');
      const txt = await t.page.textContent('#sc-records');
      t.expect(/Water’s age/.test(txt) && /4,400/.test(txt), 'water age line');
      await t.checkLayout();
      await t.shot('48-records');
    },
  },
];
