// M2: pointer drag, touch drag (default) and tap-select/tap-place (setting), keyboard play (AC14–AC16)
const EMPTY = () => new Array(81).fill(0);

async function setup(t, tray) {
  await t.seed(3);
  await t.game('newGame', { mode: 'classic' });
  await t.game('setState', { board: EMPTY(), tray, score: 0, heat: 0 });
  await t.game('act', 'hideToast');
  return t.game('layout');
}
function cellCenter(L, r, c) { const b = L.board; return [b.gx + (c + 0.5) * b.cell, b.gy + (r + 0.5) * b.cell]; }
function slotCenter(L, k) { const s = L.slots[k]; return [s.x + s.w / 2, s.y + s.h / 2]; }

export const tests = [
  {
    name: 'pointer drag places with snapped ghost',
    viewports: ['desktop'],
    async run(t) {
      const L = await setup(t, [{ id: 't4a' }, { id: 'o1' }, { id: 'i2h' }]);
      const [sx, sy] = slotCenter(L, 0);
      // t4a is 3 wide × 2 tall; to land its top-left at (5,4) the pointer goes to the piece's center there
      const b = L.board, tx = b.gx + (4 + 1.5) * b.cell + 6, ty = b.gy + (5 + 1) * b.cell - 7;
      await t.page.mouse.move(sx, sy);
      await t.page.mouse.down();
      for (let k = 1; k <= 12; k++) await t.page.mouse.move(sx + (tx - sx) * k / 12, sy + (ty - sy) * k / 12);
      const s = await t.state();
      t.expect(s.ghost && s.ghost.valid && s.ghost.r === 5 && s.ghost.c === 4, 'ghost snapped to 5,4: ' + JSON.stringify(s.ghost));
      await t.game('act', 'freezeFx');
      await t.shot('30-drag-ghost');
      await t.game('act', 'unfreezeFx');
      await t.page.mouse.up();
      const s2 = await t.state();
      t.equal([45 + 4, 45 + 5, 45 + 6, 54 + 5].map(i => s2.board[i] > 0), [true, true, true, true], 't4a placed at 5,4');
      t.equal(s2.tray[0], null, 'slot 1 used');
      // a drop off the board returns the piece
      const [ax, ay] = slotCenter(L, 1);
      await t.page.mouse.move(ax, ay); await t.page.mouse.down();
      await t.page.mouse.move(ax - 300, ay + 10, { steps: 6 }); await t.page.mouse.move(ax - 900, ay + 10, { steps: 6 });
      await t.page.mouse.up();
      const s3 = await t.state();
      t.expect(s3.tray[1] && s3.tray[1].id === 'o1', 'piece returned to tray');
      // click-select then click-place
      const [bx, by] = slotCenter(L, 2);
      await t.page.mouse.click(bx, by);
      const [cx, cy] = cellCenter(L, 0, 0);
      await t.page.mouse.move(cx, cy);
      await t.page.mouse.click(cx, cy);
      const s4 = await t.state();
      t.expect(s4.board[0] > 0 && s4.board[1] > 0, 'click-select then click-place puts i2h at 0,0');
      await t.checkLayout();
    },
  },
  {
    name: 'touch drag is the default',
    viewports: ['mobile'],
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true); // first-run tips (S2-01) hold the drag-hint toast back; this test is about the hint
      const L = await setup(t, [{ id: 'i5v' }, { id: 'o1' }, { id: 'i2h' }]);
      const b = L.board, cell = b.cell;
      const cdp = await t.page.context().newCDPSession(t.page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      // the finger point that puts a w×h piece's top-left at (r, c): the piece floats with its bottom 3/4 cell above the finger
      const fingerFor = (w, h, r, c) => [b.gx + c * cell + w * cell / 2, b.gy + r * cell + h * cell + cell * 0.75];
      async function drag(k, [ex, ey], mid) {
        const [ax, ay] = slotCenter(L, k);
        await touch('touchStart', ax, ay);
        for (let i = 1; i <= 10; i++) await touch('touchMove', ax + (ex - ax) * i / 10, ay + (ey - ay) * i / 10);
        if (mid) await mid();
        await touch('touchEnd', ex, ey);
      }
      // a tap on a tray piece hints at dragging instead of selecting; a board tap does nothing
      const [sx, sy] = slotCenter(L, 1);
      await t.page.touchscreen.tap(sx, sy);
      let s = await t.state();
      t.equal(s.sel, -1, 'tray tap does not select');
      t.expect(await t.page.evaluate(() => document.getElementById('toast').classList.contains('on')), 'drag hint shown');
      await t.game('act', 'hideToast');
      const [cx, cy] = cellCenter(L, 4, 4);
      await t.page.touchscreen.tap(cx, cy); await t.page.touchscreen.tap(cx, cy);
      s = await t.state();
      t.equal(s.board.filter(Boolean).length, 0, 'board taps place nothing');
      // a tall piece stays clear of the finger and lands where its ghost shows
      await drag(0, fingerFor(1, 5, 1, 2), async () => {
        await t.page.evaluate(() => new Promise(r => requestAnimationFrame(() => r()))); // pointermoves arrive once per frame
        const m = await t.state();
        t.expect(m.ghost && m.ghost.valid && m.ghost.r === 1 && m.ghost.c === 2, 'i5v ghost at 1,2 above the finger: ' + JSON.stringify(m.ghost));
        await t.game('act', 'freezeFx');
        await t.shot('34-touch-drag');
        await t.game('act', 'unfreezeFx');
      });
      s = await t.state();
      t.equal([1, 2, 3, 4, 5].map(r => s.board[r * 9 + 2] > 0), [true, true, true, true, true], 'i5v placed at 1,2');
      // snap assist: a drop 0.4 cell off an open spot, next to a blocked one, takes the open spot
      const board = EMPTY(); board[2 * 9 + 3] = 1;
      await t.game('setState', { board, tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }] });
      await drag(0, fingerFor(1, 1, 2, 3.4));
      s = await t.state();
      t.expect(s.tray[0] === null && s.board[2 * 9 + 4] > 0, 'o1 snapped to the open cell 2,4');
      // a small overhang past the board edge is pulled back in
      await drag(2, fingerFor(2, 1, 6, -0.55));
      s = await t.state();
      t.expect(s.tray[2] === null && s.board[54] > 0 && s.board[55] > 0, 'i2h hanging off the left edge lands at 6,0');
      await t.checkLayout();
    },
  },
  {
    name: 'touch tap select and place',
    viewports: ['mobile'],
    async run(t) {
      const L = await setup(t, [{ id: 'o4' }, { id: 'o1' }, { id: 'i3v' }]);
      await t.game('act', 'setting', 'tapPlace', true);
      const [sx, sy] = slotCenter(L, 0);
      await t.page.touchscreen.tap(sx, sy);
      let s = await t.state();
      t.equal(s.sel, 0, 'slot 1 selected by tap');
      const [cx, cy] = cellCenter(L, 3, 3);
      await t.page.touchscreen.tap(cx, cy);
      s = await t.state();
      t.expect(s.ghost && s.ghost.valid, 'first tap shows ghost');
      t.equal(s.board.filter(Boolean).length, 0, 'nothing placed yet');
      await t.shot('31-tap-ghost');
      await t.page.touchscreen.tap(cx, cy);
      s = await t.state();
      t.equal(s.board.filter(Boolean).length, 4, 'second tap on ghost places the piece');
      // real touch drag with lift
      const [ax, ay] = slotCenter(L, 2);
      const tgt = cellCenter(L, 6, 7);
      const cdp = await t.page.context().newCDPSession(t.page);
      const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
      await touch('touchStart', ax, ay);
      const lift = L.board.cell * (3 / 2 + 0.75); // i3v is 3 tall: half its height plus 3/4 cell
      const ex = tgt[0], ey = tgt[1] + lift;
      for (let k = 1; k <= 10; k++) await touch('touchMove', ax + (ex - ax) * k / 10, ay + (ey - ay) * k / 10);
      s = await t.state();
      t.expect(s.ghost && s.ghost.valid, 'touch drag shows a valid ghost above the finger: ' + JSON.stringify(s.ghost));
      await touch('touchEnd', ex, ey);
      s = await t.state();
      t.equal(s.tray[2], null, 'i3v placed by touch drag');
      await t.checkLayout();
    },
  },
  {
    name: 'keyboard turn and pause',
    async run(t) {
      await setup(t, [{ id: 'l4a' }, { id: 'o1' }, { id: 'i2v' }]);
      await t.page.focus('#cv');
      await t.page.keyboard.press('1');
      let s = await t.state();
      t.equal(s.sel, 0, 'key 1 selects slot 1');
      await t.page.keyboard.press('ArrowLeft'); await t.page.keyboard.press('ArrowLeft');
      await t.page.keyboard.press('ArrowDown');
      s = await t.state();
      t.expect(s.ghost && s.ghost.valid, 'ghost follows arrows');
      await t.shot('32-keyboard-cursor');
      const g = s.ghost;
      await t.page.keyboard.press('Enter');
      s = await t.state();
      t.equal(s.board[g.r * 9 + g.c] > 0, true, 'Enter placed the piece at the ghost');
      t.equal(s.tray[0], null, 'slot 1 used');
      await t.page.keyboard.press('Tab');
      s = await t.state();
      t.equal(s.sel, 1, 'Tab cycles to the next piece');
      await t.page.keyboard.press('Escape');
      await t.page.keyboard.press('Escape');
      s = await t.state();
      t.equal(s.scene, 'pause', 'Escape twice: cancel, then pause');
      await t.checkLayout();
      await t.shot('33-pause');
      await t.page.keyboard.press('Escape');
      s = await t.state();
      t.equal(s.scene, 'game', 'Escape resumes');
    },
  },
  {
    name: 'W6-S6-04 mid-drag doUndo() and blur/contextmenu/Escape aborts never throw',
    viewports: ['desktop'],
    async run(t) {
      const L = await setup(t, [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }]);
      await t.game('act', 'setting', 'undo', 3);
      await t.game('newGame', { mode: 'classic', seed: 12 });
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }], undoLeft: 3 });
      await t.game('act', 'hideToast');
      // Place 3 pieces so Round 2 deals a fresh tray; snapshot on undoStack has slot 0 = null, slot 1 = null, slot 2 = o1.
      t.expect((await t.game('act', 'place', 0, 0, 0)).ok, 'piece 1 placed');
      t.expect((await t.game('act', 'place', 1, 0, 2)).ok, 'piece 2 placed');
      t.expect((await t.game('act', 'place', 2, 0, 4)).ok, 'piece 3 placed -> Round 2 dealt');
      // Begin dragging slot 0 of Round 2 across the board (slot 0 was null in Round 1's pre-Piece-3 snapshot!).
      const [sx, sy] = slotCenter(L, 0);
      const [bx, by] = cellCenter(L, 4, 4);
      await t.page.mouse.move(sx, sy);
      await t.page.mouse.down();
      await t.page.mouse.move(bx, by, { steps: 6 });
      // Trigger Undo mid-drag: must cancelDrag cleanly without TypeError on null S.tray[0].
      const u = await t.game('act', 'undo');
      t.equal(u.ok, true, 'mid-drag undo succeeds');
      await t.page.mouse.move(bx + 20, by + 20, { steps: 3 });
      await t.page.mouse.up();
      const afterUndo = await t.page.evaluate(() => ({ drag: UI.drag, ghost: UI.ghost, slot0: S.tray[0] }));
      t.equal(afterUndo.drag, null, 'drag cleared on mid-drag undo');
      t.equal(afterUndo.ghost, null, 'ghost cleared on mid-drag undo');
      t.equal(afterUndo.slot0, null, 'restored Round 1 slot 0 is null without crashing');
      // Verify blur, contextmenu, Escape, and hidden-tab aborts cleanly cancel active drags.
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o4' }, { id: 'o1' }, { id: 'i2h' }], undoLeft: 3 });
      for (const abortKind of ['blur', 'contextmenu', 'Escape']) {
        await t.page.mouse.move(sx, sy);
        await t.page.mouse.down();
        await t.page.mouse.move(bx, by, { steps: 5 });
        t.expect(await t.page.evaluate(() => !!(UI.drag && UI.drag.moved)), abortKind + ': drag started');
        if (abortKind === 'blur') await t.page.evaluate(() => window.dispatchEvent(new Event('blur')));
        else if (abortKind === 'contextmenu') await t.page.evaluate(() => document.getElementById('cv').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
        else await t.page.keyboard.press('Escape');
        await t.page.mouse.up();
        const cleared = await t.page.evaluate(() => ({ drag: UI.drag, ghost: UI.ghost }));
        t.equal(cleared.drag, null, abortKind + ': drag cancelled cleanly');
        t.equal(cleared.ghost, null, abortKind + ': ghost cleared');
      }
    },
  },
  {
    name: 'W6-S5-04 40/40 concave Tap-to-Place double-tap, strict non-bbox confirmation & shared resolveSnapTarget()',
    viewports: ['mobile'],
    async run(t) {
      await t.game('act', 'setting', 'tipsSeen', true);
      await t.game('act', 'setting', 'tapPlace', true);
      const L = await setup(t, [{ id: 'o1' }, { id: 'o1' }, { id: 'o1' }]);
      const pieces = await t.game('pieces');
      const ids = Object.keys(pieces);
      t.equal(ids.length, 40, 'all 40 pieces tested');
      const [sx, sy] = slotCenter(L, 0);
      const [cx, cy] = cellCenter(L, 3, 3); // (3,3) keeps 3x3 o9 straddling 4 pools (2,2..4,4) so none of the 40 pieces auto-clears a 3x3 pool
      // 1. Every single piece (all 40/40, including 10 concave pieces c3d, l4c, l4d, j4a, j4b, v5a..d, u5a) confirms on two identical center taps.
      for (const id of ids) {
        await t.game('setState', { board: EMPTY(), tray: [{ id }, { id: 'o1' }, { id: 'o1' }], score: 0, heat: 0, placed: 0 });
        await t.page.touchscreen.tap(sx, sy);
        await t.page.touchscreen.tap(cx, cy);
        const mid = await t.state();
        t.expect(mid.ghost && mid.ghost.valid && mid.board.filter(Boolean).length === 0, id + ': first center tap shows valid preview without placing');
        await t.page.touchscreen.tap(cx, cy);
        const after = await t.state();
        t.equal(after.tray[0], null, id + ': second identical center tap places piece');
        t.equal(after.placed, 1, id + ': placed counter incremented');
        t.equal(after.board.filter(Boolean).length, pieces[id].n, id + ': exact tile count placed (' + pieces[id].n + ')');
      }
      // 2. Strict non-bbox confirmation (CD-WF6-06): concave v5a previewed at (3,3) does NOT confirm on empty bbox corner (5,5),
      //    but DOES confirm on occupied ghost cell (3,3).
      const [c44x0, c44y0] = cellCenter(L, 4, 4);
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'v5a' }, { id: 'o1' }, { id: 'o1' }], score: 0, heat: 0 });
      await t.page.touchscreen.tap(sx, sy);
      await t.page.touchscreen.tap(c44x0, c44y0);
      let s = await t.state();
      t.expect(s.ghost && s.ghost.r === 3 && s.ghost.c === 3 && s.ghost.valid, 'v5a previewed at 3,3');
      const [c55x, c55y] = cellCenter(L, 5, 5);
      await t.page.touchscreen.tap(c55x, c55y);
      s = await t.state();
      t.equal(s.board.filter(Boolean).length, 0, 'empty bbox corner (5,5) repositions preview instead of loose-bbox placing');
      t.expect(s.ghost && s.ghost.r === 4 && s.ghost.c === 4, 'preview moved to 4,4');
      const [c44x, c44y] = cellCenter(L, 4, 4); // (4,4) is an occupied cell of v5a at (4,4)
      await t.page.touchscreen.tap(c44x, c44y);
      s = await t.state();
      t.equal(s.board.filter(Boolean).length, 5, 'tap on occupied ghost cell confirms placement');
      // 3. Shared resolveSnapTarget() 0.75-cell nearest-valid snap assist works in Tap-to-Place too.
      const board = EMPTY(); board[2 * 9 + 3] = 1;
      await t.game('setState', { board, tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], score: 0, heat: 0 });
      await t.page.touchscreen.tap(sx, sy);
      const b = L.board;
      const snapX = b.gx + (3 + 0.9) * b.cell, snapY = b.gy + (2 + 0.5) * b.cell; // 0.4 cells right of blocked (2,3) -> 0.6 cells from open (2,4)
      await t.page.touchscreen.tap(snapX, snapY);
      s = await t.state();
      t.expect(s.ghost && s.ghost.valid && s.ghost.r === 2 && s.ghost.c === 4, 'Tap-to-Place snaps past blocked (2,3) to open (2,4): ' + JSON.stringify(s.ghost));
      await t.page.touchscreen.tap(snapX, snapY);
      s = await t.state();
      t.expect(s.tray[0] === null && s.board[2 * 9 + 4] > 0, 'second tap confirms snapped placement at (2,4)');
    },
  },
  {
    name: 'W6-P-N04 W6-S5-04 fresh-boot & Level-24 focusFirst() (getClientRects), Title #cv containment & <main> landmark',
    viewports: ['desktop'],
    async run(t) {
      // Fresh boot straight on #sc-title (no prior game or clicks):
      const bootInfo = await t.page.evaluate(() => {
        const ae = document.activeElement;
        const main = document.querySelector('main');
        const cv = document.getElementById('cv');
        const hud = document.getElementById('hud');
        const title = document.getElementById('sc-title');
        return {
          scene: window.__game.getState().scene,
          hasMain: !!main,
          mainWrapsCv: !!(main && main.contains(cv)),
          mainWrapsTitle: !!(main && main.contains(title)),
          hudOutsideMain: !!(main && hud && !main.contains(hud)),
          activeTag: ae && ae.tagName,
          activeMode: ae && ae.dataset ? ae.dataset.mode : null,
          activeId: ae && ae.id,
          activeRects: ae ? ae.getClientRects().length : 0,
          cvInert: cv.inert,
          cvTabIndex: cv.tabIndex,
          hudInert: hud.inert,
          usesOffsetParent: /offsetParent/.test(focusFirst.toString() + isVisibleControl.toString()),
          usesGetClientRects: /getClientRects/.test(isVisibleControl.toString()),
        };
      });
      t.equal(bootInfo.scene, 'title', 'fresh boot starts on Title');
      t.equal(bootInfo.hasMain, true, 'semantic <main> landmark present');
      t.equal(bootInfo.mainWrapsCv && bootInfo.mainWrapsTitle && bootInfo.hudOutsideMain, true, '<main> wraps #cv and #sc-title while <header id="hud"> stays top-level');
      t.equal(bootInfo.activeMode, 'classic', 'fresh-boot focusFirst() skips hidden #b-continue and focuses Play Classic (got ' + JSON.stringify(bootInfo) + ')');
      t.expect(bootInfo.activeRects > 0, 'focused Play Classic button is visible via getClientRects()');
      t.equal(bootInfo.cvInert, true, '#cv is inert on non-modal #sc-title');
      t.equal(bootInfo.cvTabIndex, -1, '#cv tabIndex is -1 on #sc-title');
      t.equal(bootInfo.hudInert, true, '#hud is inert on #sc-title');
      t.equal(bootInfo.usesOffsetParent, false, 'focusFirst() never relies on offsetParent (CD-WF6-04)');
      t.equal(bootInfo.usesGetClientRects, true, 'focusFirst() filters visibility strictly via getClientRects()');

      // Shift+Tab from Play Classic must NEVER escape onto hidden #cv behind Title (W6-P-N04).
      await t.page.keyboard.press('Shift+Tab');
      const afterShiftTab = await t.page.evaluate(() => ({ id: document.activeElement && document.activeElement.id, tag: document.activeElement && document.activeElement.tagName }));
      t.expect(afterShiftTab.id !== 'cv', 'Shift+Tab on Title never lands on #cv (got ' + JSON.stringify(afterShiftTab) + ')');

      // Even if blurred to <body>, pressing Tab once on Title must land on Play Classic, never #cv.
      await t.page.evaluate(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
      await t.page.keyboard.press('Tab');
      const afterBodyTab = await t.page.evaluate(() => ({ id: document.activeElement && document.activeElement.id, mode: document.activeElement && document.activeElement.dataset && document.activeElement.dataset.mode }));
      t.equal(afterBodyTab.mode, 'classic', 'first Tab from <body> on Title lands on Play Classic, skipping inert #cv');

      // Level-24 Win (#sc-win with #b-next hidden): focusFirst() must land on visible #b-trail2, never <body> or hidden #b-next.
      const lvl24Focus = await t.page.evaluate(() => {
        const last = LEVELS[LEVELS.length - 1];
        newGame({ mode: 'trail', level: last.id });
        S.over = true; S.won = true; S.undosUsed = 0;
        showWinTrail();
        const ae = document.activeElement;
        return {
          scene: S.scene,
          nextHidden: $('b-next').getClientRects().length === 0,
          activeId: ae && ae.id,
          activeTag: ae && ae.tagName,
          activeVisible: !!(ae && ae.getClientRects().length > 0),
          inWin: $('sc-win').contains(ae),
          cvInert: cv.inert,
          cvTabIndex: cv.tabIndex,
        };
      });
      t.equal(lvl24Focus.scene, 'win', 'Level-24 win screen opened');
      t.equal(lvl24Focus.nextHidden, true, '#b-next is hidden on final Level 24');
      t.equal(lvl24Focus.inWin && lvl24Focus.activeVisible && lvl24Focus.activeId === 'b-trail2', true, 'Level-24 focusFirst() focuses visible #b-trail2 instead of <body> (' + JSON.stringify(lvl24Focus) + ')');
      t.equal(lvl24Focus.cvInert && lvl24Focus.cvTabIndex === -1, true, '#cv is inert with tabIndex=-1 on #sc-win');
    },
  },
  {
    name: 'W6-S5-04 all 9 dialogs Tab-trap & #cv inertness, back() opener restore, boundary-releasing #cv Tab, numeric 1-9 rim & pointer UI.kbd clear',
    viewports: ['desktop'],
    async run(t) {
      // 1. Verify all 8 non-confirm aria-modal dialogs trap Tab/Shift+Tab and hold #cv/#hud/<main> inert.
      const dialogSpecs = [
        { name: 'trail', id: 'sc-trail', open: () => t.game('scene', 'trail') },
        { name: 'cards', id: 'sc-cards', open: () => t.game('scene', 'cards') },
        { name: 'records', id: 'sc-records', open: () => t.game('scene', 'records') },
        { name: 'help', id: 'sc-help', open: () => t.game('scene', 'help') },
        { name: 'settings', id: 'sc-settings', open: () => t.game('scene', 'settings') },
        { name: 'pause', id: 'sc-pause', open: async () => { await t.game('newGame', { mode: 'classic', seed: 5 }); await t.game('act', 'pause'); } },
        { name: 'over', id: 'sc-over', open: async () => { await t.game('newGame', { mode: 'classic', seed: 5 }); await t.game('scene', 'over'); } },
        { name: 'win', id: 'sc-win', open: async () => { await t.game('newGame', { mode: 'trail', level: 'display-spring' }); await t.game('act', 'place', 0, 8, 3); await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 6000 }); } },
      ];
      for (const d of dialogSpecs) {
        await d.open();
        const st = await t.page.evaluate(id => {
          const root = document.getElementById(id), list = padControls(), ae = document.activeElement;
          return {
            modal: root.getAttribute('aria-modal'),
            count: list.length,
            inRoot: root.contains(ae),
            cvInert: cv.inert,
            cvTab: cv.tabIndex,
            hudInert: $('hud').inert,
            mainInert: $('main').inert,
          };
        }, d.id);
        t.equal(st.modal, 'true', d.name + ': aria-modal="true"');
        t.expect(st.count >= 1 && st.inRoot, d.name + ': active focus is inside dialog (' + JSON.stringify(st) + ')');
        t.equal(st.cvInert && st.cvTab === -1 && st.hudInert && st.mainInert, true, d.name + ': #cv, #hud, and <main> inert behind dialog');
        // Focus first control and press Shift+Tab -> must wrap to last control inside dialog.
        await t.page.evaluate(() => { const l = padControls(); l[0].focus({ preventScroll: true }); });
        await t.page.keyboard.press('Shift+Tab');
        const wrappedBack = await t.page.evaluate(id => {
          const l = padControls();
          return document.getElementById(id).contains(document.activeElement) && document.activeElement === l[l.length - 1];
        }, d.id);
        t.equal(wrappedBack, true, d.name + ': Shift+Tab wraps cleanly from first to last control inside dialog');
        // Now on last control -> press Tab -> must wrap to first control inside dialog.
        await t.page.keyboard.press('Tab');
        const wrappedFwd = await t.page.evaluate(id => {
          const l = padControls();
          return document.getElementById(id).contains(document.activeElement) && document.activeElement === l[0];
        }, d.id);
        t.equal(wrappedFwd, true, d.name + ': Tab wraps cleanly from last to first control inside dialog');
      }

      // 2. 9th dialog (#sc-confirm) inerts underlying screen, traps Tab/Shift+Tab, and restores opener focus on Escape.
      await t.game('newGame', { mode: 'classic', seed: 9 });
      await t.game('act', 'place', 0, 0, 0);
      await t.game('act', 'pause');
      await t.page.focus('#b-restart');
      await t.page.click('#b-restart');
      const cfState = await t.page.evaluate(() => ({
        on: $('sc-confirm').classList.contains('on'),
        activeId: document.activeElement && document.activeElement.id,
        pauseInert: $('sc-pause').inert,
        cvInert: cv.inert,
      }));
      t.equal(cfState.on && cfState.activeId === 'cf-no' && cfState.pauseInert && cfState.cvInert, true, '#sc-confirm inerts underlying #sc-pause & #cv and focuses #cf-no');
      await t.page.keyboard.press('Shift+Tab');
      t.equal(await t.page.evaluate(() => document.activeElement.id), 'cf-yes', '#sc-confirm Shift+Tab wraps to #cf-yes');
      await t.page.keyboard.press('Tab');
      t.equal(await t.page.evaluate(() => document.activeElement.id), 'cf-no', '#sc-confirm Tab wraps to #cf-no');
      await t.page.keyboard.press('Escape');
      const afterCf = await t.page.evaluate(() => ({ pauseInert: $('sc-pause').inert, activeId: document.activeElement && document.activeElement.id }));
      t.equal(afterCf.pauseInert, false, 'closing #sc-confirm un-inerts #sc-pause');
      t.equal(afterCf.activeId, 'b-restart', 'closing #sc-confirm restores opener focus to #b-restart');

      // 3. Opener focus restore in back() from both #sc-pause and #sc-title.
      await t.page.focus('#sc-pause [data-go="help"]');
      await t.page.click('#sc-pause [data-go="help"]');
      t.equal((await t.state()).scene, 'help', 'opened Help from Pause');
      await t.page.keyboard.press('Escape');
      t.equal(await t.page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-go') === 'help' && $('sc-pause').contains(document.activeElement)), true, 'back() restores focus to Pause How to play opener');

      await t.game('scene', 'title');
      await t.page.focus('#sc-title [data-go="settings"]');
      await t.page.click('#sc-title [data-go="settings"]');
      t.equal((await t.state()).scene, 'settings', 'opened Settings from Title');
      await t.page.keyboard.press('Escape');
      t.equal(await t.page.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-go') === 'settings' && $('sc-title').contains(document.activeElement)), true, 'back() restores focus to Title Settings opener');

      // 4. Boundary-releasing #cv Tab (WCAG 2.1.2) + Q/E infinite wrap + UI.kbd-only numeric 1-9 rim indices + pointer drag clear.
      await t.game('act', 'setting', 'tipsSeen', false);
      const L = await setup(t, [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }]);
      await t.page.evaluate(() => { tipShow('goal'); cv.focus({ preventScroll: true }); });
      await t.page.keyboard.press('Tab');
      t.equal((await t.state()).sel, 0, '#cv Tab 1 selects slot 0');
      await t.page.keyboard.press('Tab');
      t.equal((await t.state()).sel, 1, '#cv Tab 2 selects slot 1');
      await t.page.keyboard.press('Tab');
      t.equal((await t.state()).sel, 2, '#cv Tab 3 selects slot 2');
      await t.page.keyboard.press('Tab');
      const releasedId = await t.page.evaluate(() => document.activeElement && document.activeElement.id);
      t.equal(releasedId, 'b-pause', '#cv Tab past last occupied slot releases cleanly to #hud (#b-pause)');
      // Continue tabbing across #hud until reaching #tip-skip (zero WCAG 2.1.2 trap!).
      let hitSkip = false;
      for (let step = 0; step < 8; step++) {
        if (await t.page.evaluate(() => document.activeElement && document.activeElement.id === 'tip-skip')) { hitSkip = true; break; }
        await t.page.keyboard.press('Tab');
      }
      t.equal(hitSkip, true, 'forward Tab from #cv reaches #tip-skip cleanly');

      // Shift+Tab from slot 0 on #cv releases backward cleanly; Q/E wrap infinitely.
      await t.page.focus('#cv');
      await t.page.keyboard.press('1');
      await t.page.keyboard.press('Shift+Tab');
      t.expect(await t.page.evaluate(() => document.activeElement && document.activeElement.id !== 'cv'), '#cv Shift+Tab at slot 0 releases backward off #cv');
      await t.page.focus('#cv');
      await t.page.keyboard.press('1');
      await t.page.keyboard.press('e'); t.equal((await t.state()).sel, 1, 'E steps 0 -> 1');
      await t.page.keyboard.press('e'); t.equal((await t.state()).sel, 2, 'E steps 1 -> 2');
      await t.page.keyboard.press('e'); t.equal((await t.state()).sel, 0, 'E wraps 2 -> 0 infinitely');
      await t.page.keyboard.press('q'); t.equal((await t.state()).sel, 2, 'Q wraps 0 -> 2 infinitely');

      // Numeric 1-9 rim indices drawn ONLY when UI.kbd is active (zero A-I letters, all >=12px), cleared on pointer drag.
      const kbdTexts = await t.game('act', 'canvasText');
      const rimNums = kbdTexts.texts.filter(x => /^[1-9]$/.test(x.text) && x.size === 12);
      const alphaCols = kbdTexts.texts.filter(x => /^[A-I]$/.test(x.text));
      t.equal(rimNums.length, 18, 'UI.kbd renders 18 numeric 1-9 rim indices (9 cols + 9 rows) at 12px');
      t.equal(alphaCols.length, 0, 'zero A-I column letters on board rim (CD-WF5-07)');
      const [sx, sy] = slotCenter(L, 0), [bx, by] = cellCenter(L, 4, 4);
      await t.page.mouse.move(sx, sy);
      await t.page.mouse.down();
      await t.page.mouse.move(bx, by, { steps: 5 });
      await t.page.mouse.up();
      const afterDragKbd = await t.page.evaluate(() => UI.kbd);
      t.equal(afterDragKbd, false, 'pointer drag clears UI.kbd');
      const ptrTexts = await t.game('act', 'canvasText');
      t.equal(ptrTexts.texts.filter(x => /^[1-9]$/.test(x.text) && x.size === 12).length, 0, 'numeric rim indices hidden once UI.kbd clears');
    },
  },
  {
    name: 'W6-S5-04 modifier-key passthrough preserving (Ctrl|Cmd)+Z Undo & #sc-over/#sc-win Escape/U/Gamepad B/START',
    viewports: ['desktop'],
    async run(t) {
      await t.game('act', 'setting', 'undo', 3);
      await t.game('act', 'setting', 'tipsSeen', true);
      await setup(t, [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }]);
      await t.game('setState', { board: EMPTY(), tray: [{ id: 'o1' }, { id: 'o4' }, { id: 'i2h' }], undoLeft: 3 });
      t.expect((await t.game('act', 'place', 0, 0, 0)).ok, 'initial piece placed for undo check');

      // 1. Modifier shortcuts MUST NOT be intercepted (no preventDefault, no game state mutation, no UI.kbd latch).
      const modChecks = await t.page.evaluate(() => {
        UI.kbd = false; UI.sel = -1; UI.ghost = null; UI.hint = null;
        const cases = [
          { label: 'Ctrl+1', key: '1', ctrlKey: true },
          { label: 'Meta+2', key: '2', metaKey: true },
          { label: 'Alt+3', key: '3', altKey: true },
          { label: 'Ctrl+q', key: 'q', ctrlKey: true },
          { label: 'Alt+e', key: 'e', altKey: true },
          { label: 'Alt+ArrowLeft', key: 'ArrowLeft', altKey: true },
          { label: 'Ctrl+ArrowDown', key: 'ArrowDown', ctrlKey: true },
          { label: 'Ctrl+h', key: 'h', ctrlKey: true },
          { label: 'Meta+h', key: 'h', metaKey: true },
          { label: 'Ctrl+u', key: 'u', ctrlKey: true },
          { label: 'Alt+u', key: 'u', altKey: true },
          { label: 'Ctrl+p', key: 'p', ctrlKey: true },
          { label: 'Meta+p', key: 'p', metaKey: true },
          { label: 'Ctrl+m', key: 'm', ctrlKey: true },
          { label: 'Ctrl+Alt+z', key: 'z', ctrlKey: true, altKey: true },
        ];
        const soundBefore = SAVE.settings.sound, placedBefore = S.placed;
        const results = cases.map(c => {
          const ev = new KeyboardEvent('keydown', { key: c.key, ctrlKey: !!c.ctrlKey, metaKey: !!c.metaKey, altKey: !!c.altKey, bubbles: true, cancelable: true });
          window.dispatchEvent(ev);
          return { label: c.label, prevented: ev.defaultPrevented };
        });
        return {
          results,
          scene: S.scene,
          sel: UI.sel,
          ghost: UI.ghost,
          hint: UI.hint,
          kbd: UI.kbd,
          placedSame: S.placed === placedBefore,
          soundSame: SAVE.settings.sound === soundBefore,
        };
      });
      for (const r of modChecks.results) t.equal(r.prevented, false, r.label + ' not intercepted');
      t.equal(modChecks.scene === 'game' && modChecks.sel === -1 && modChecks.ghost === null && modChecks.hint === null && modChecks.kbd === false && modChecks.placedSame && modChecks.soundSame, true, 'zero game state mutated by browser modifier shortcuts');

      // 2. (Ctrl|Cmd)+Z (without Alt) STILL triggers Undo cleanly!
      const ctrlZ = await t.page.evaluate(() => {
        const before = S.placed;
        const ev = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
        window.dispatchEvent(ev);
        return { prevented: ev.defaultPrevented, delta: S.placed - before };
      });
      t.equal(ctrlZ.prevented && ctrlZ.delta === -1, true, 'Ctrl+Z Undo preserved (' + JSON.stringify(ctrlZ) + ')');

      t.expect((await t.game('act', 'place', 0, 0, 0)).ok, 're-placed piece for Cmd+Z check');
      const metaZ = await t.page.evaluate(() => {
        const before = S.placed;
        const ev = new KeyboardEvent('keydown', { key: 'z', metaKey: true, bubbles: true, cancelable: true });
        window.dispatchEvent(ev);
        return { prevented: ev.defaultPrevented, delta: S.placed - before };
      });
      t.equal(metaZ.prevented && metaZ.delta === -1, true, 'Cmd+Z (Meta+Z) Undo preserved (' + JSON.stringify(metaZ) + ')');

      // 3. #sc-over Escape, U, Ctrl+Z, Gamepad B (undoable vs non-undoable) & Gamepad START.
      const triggerLoss = async (undoLeft) => {
        await t.game('newGame', { mode: 'classic', seed: 11 });
        const bFull = EMPTY();
        for (let i = 0; i < 81; i++) bFull[i] = ((Math.floor(i / 9) + (i % 9)) % 2) ? 1 + (i % 6) : 0;
        bFull[0] = 0;
        await t.game('setState', { board: bFull, tray: [{ id: 'o1' }, { id: 'o9' }, { id: 'o9' }], undoLeft });
        await t.game('act', 'place', 0, 0, 0);
        await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 6000 });
      };
      await triggerLoss(2);
      await t.page.keyboard.press('u');
      t.equal((await t.state()).scene, 'game', '#sc-over U rescues run via doUndo()');

      await triggerLoss(2);
      await t.page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })));
      t.equal((await t.state()).scene, 'game', '#sc-over Ctrl+Z rescues run via doUndo()');

      await triggerLoss(2);
      await t.page.evaluate(() => padButton('B'));
      t.equal((await t.state()).scene, 'game', '#sc-over Gamepad B rescues run when undoAvail()');

      await triggerLoss(0);
      await t.page.evaluate(() => padButton('B'));
      t.equal((await t.state()).scene, 'title', '#sc-over Gamepad B returns to Title when non-undoable');

      await triggerLoss(0);
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).scene, 'title', '#sc-over Escape returns cleanly to Title');

      await triggerLoss(0);
      await t.page.evaluate(() => padButton('START'));
      const afterStartOver = await t.state();
      t.equal(afterStartOver.scene === 'game' && afterStartOver.placed === 0, true, '#sc-over Gamepad START activates Play again');

      // 4. #sc-win Escape, Gamepad B & Gamepad START (both Level 1 with #b-next and Level 24 without #b-next).
      const solveLevel1 = async () => {
        await t.game('newGame', { mode: 'trail', level: 'display-spring' });
        await t.game('act', 'place', 0, 8, 3);
        await t.page.waitForFunction(() => window.__game.getState().scene === 'win', null, { timeout: 6000 });
      };
      await solveLevel1();
      await t.page.evaluate(() => padButton('START'));
      const afterWinStart = await t.state();
      t.equal(afterWinStart.scene === 'game' && afterWinStart.level === 'hale-bathhouse', true, '#sc-win Gamepad START launches visible #b-next');

      await solveLevel1();
      await t.page.keyboard.press('Escape');
      t.equal((await t.state()).scene, 'trail', '#sc-win Escape returns cleanly to Spring Trail');

      await solveLevel1();
      await t.page.evaluate(() => padButton('B'));
      t.equal((await t.state()).scene, 'trail', '#sc-win Gamepad B returns cleanly to Spring Trail');

      // Level 24 (#b-next hidden): Gamepad START falls back to visible #b-trail2 instead of dead 'p'.
      await t.page.evaluate(() => {
        const last = LEVELS[LEVELS.length - 1];
        newGame({ mode: 'trail', level: last.id });
        S.over = true; S.won = true; S.undosUsed = 0;
        showWinTrail();
        padButton('START');
      });
      t.equal((await t.state()).scene, 'trail', 'Level-24 #sc-win Gamepad START activates visible #b-trail2');
    },
  },
];
