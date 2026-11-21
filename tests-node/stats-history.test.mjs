// Wave 3 (S3-07): recent scores, biggest clear and longest game ride in save version 1 with defaults merged on load.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const core = html.split('// SAVE MERGE CORE (portable regression extracts this same function)')[1]?.split('// END SAVE MERGE CORE')[0];
const def = /function defaultSave\(\) \{[\s\S]*?\n\}\n/.exec(html)[0];
const { createSaveStore, defaultSave } = new Function(def + core + '\nreturn { createSaveStore, defaultSave };')();
const copy = value => JSON.parse(JSON.stringify(value));
function rig(initial = null) {
  let raw = initial === null ? null : JSON.stringify(initial), c = 0;
  const storage = { getItem: () => raw, setItem: v => { raw = v; } };
  return { get saved() { return JSON.parse(raw); }, tab: () => createSaveStore(storage, defaultSave, () => 'r' + (++c)) };
}

test('an older save without the new stats loads with every old stat intact and empty history', () => {
  const old = copy(defaultSave()); old.stats = { games: 20, lines: 100, bestHeat: 9, springs: 12 };
  const store = rig(old).tab(); store.load();
  assert.equal(store.value.stats.games, 20); assert.equal(store.value.stats.bestHeat, 9);
  assert.equal(store.value.stats.longest, 0); assert.equal(store.value.stats.bestCombo, 0);
  assert.deepEqual(store.value.stats.recent, { classic: [], springs: [], daily: [] });
});
test('damaged history falls back to empty and keeps at most the last ten numbers', () => {
  const bad = copy(defaultSave());
  bad.stats.recent = { classic: [1, 2, 'x', null, 3, -4, 5, 6, 7, 8, 9, 10, 11, 12, 13], springs: 'no', daily: { a: 1 }, extra: [1] };
  bad.stats.longest = 'many'; bad.stats.bestCombo = -2;
  const store = rig(bad).tab(); store.load();
  assert.deepEqual(store.value.stats.recent.classic, [3, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  assert.deepEqual(store.value.stats.recent.springs, []); assert.deepEqual(store.value.stats.recent.daily, []);
  assert.equal(Object.hasOwn(store.value.stats.recent, 'extra'), false);
  assert.equal(store.value.stats.longest, 0); assert.equal(store.value.stats.bestCombo, 0);
});
test('two tabs each finishing a game keep both scores, and the biggest clear and longest game are the maxima', () => {
  const r = rig(), a = r.tab(), b = r.tab(); a.load(); b.load();
  a.value.stats.recent.classic.push(100); a.value.stats.bestCombo = 3; a.value.stats.longest = 40; a.persist();
  b.value.stats.recent.classic.push(250); b.value.stats.bestCombo = 2; b.value.stats.longest = 55; b.persist();
  assert.deepEqual(r.saved.stats.recent.classic, [100, 250]);
  assert.equal(r.saved.stats.bestCombo, 3); assert.equal(r.saved.stats.longest, 55);
});
test('a tab that rereads does not add the same score twice, and the list stays at ten', () => {
  const r = rig(), a = r.tab(); a.load();
  for (let i = 1; i <= 12; i++) { a.value.stats.recent.daily = [...a.value.stats.recent.daily, i * 10].slice(-10); a.persist(); a.persist(); }
  assert.deepEqual(r.saved.stats.recent.daily, [30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
});

// Wave 3 (S3-04): a best per difficulty beside the old Standard slots.
test('an older save without difficulty bests loads with them at zero and the old bests untouched', () => {
  const old = copy(defaultSave()); old.best = { classic: 1234, springs: 55, daily: { '2026-11-01': 300 } }; delete old.settings.difficulty;
  const store = rig(old).tab(); store.load();
  assert.equal(store.value.best.classic, 1234); assert.equal(store.value.best.springs, 55);
  assert.deepEqual(store.value.best.diff, { relaxed: { classic: 0, springs: 0 }, master: { classic: 0, springs: 0 } });
  assert.equal(store.value.settings.difficulty, 'standard');
});
test('damaged difficulty bests fall back to zero one by one', () => {
  const bad = copy(defaultSave());
  bad.best.diff = { relaxed: { classic: 'x', springs: 90 }, master: 'no', extra: { classic: 5 } };
  const store = rig(bad).tab(); store.load();
  assert.deepEqual(store.value.best.diff, { relaxed: { classic: 0, springs: 90 }, master: { classic: 0, springs: 0 } });
});
test('two tabs each setting a Master best keep the higher, and a lower score never lowers it', () => {
  const r = rig(), a = r.tab(), b = r.tab(); a.load(); b.load();
  a.value.best.diff.master.classic = 500; a.persist();
  b.value.best.diff.master.classic = 300; b.value.best.diff.relaxed.springs = 80; b.persist();
  assert.equal(r.saved.best.diff.master.classic, 500); assert.equal(r.saved.best.diff.relaxed.springs, 80);
});

// Wave 4 (W6-S3-08 / W6-S4-07): per-difficulty recent history and legacy boolean patterns migration.
test('recentDiff normalizes damaged entries, keeps Relaxed/Master separate from Standard, and merges across tabs', () => {
  const bad = copy(defaultSave());
  bad.stats.recentDiff = { relaxed: { classic: [100, 'x', -5, 200], springs: 'bad' }, master: null, extra: { classic: [9] } };
  const s = rig(bad).tab(); s.load();
  assert.deepEqual(s.value.stats.recentDiff, { relaxed: { classic: [100, 200], springs: [] }, master: { classic: [], springs: [] } });
  const r = rig(), a = r.tab(), b = r.tab(); a.load(); b.load();
  a.value.stats.recent.classic.push(300); a.value.stats.recentDiff.relaxed.classic.push(900); a.persist();
  b.value.stats.recentDiff.relaxed.classic.push(950); b.value.stats.recentDiff.master.classic.push(150); b.persist();
  assert.deepEqual(r.saved.stats.recent.classic, [300]);
  assert.deepEqual(r.saved.stats.recentDiff.relaxed.classic, [900, 950]);
  assert.deepEqual(r.saved.stats.recentDiff.master.classic, [150]);
});

test('legacy boolean settings.patterns migrates cleanly to 3-state relief/high/off', () => {
  const oldOn = copy(defaultSave()); oldOn.settings.patterns = true;
  const oldOff = copy(defaultSave()); oldOff.settings.patterns = false;
  const hi = copy(defaultSave()); hi.settings.patterns = 'high';
  const bad = copy(defaultSave()); bad.settings.patterns = 'invalid';
  assert.equal(rig(oldOn).tab().load().settings.patterns, 'relief');
  assert.equal(rig(oldOff).tab().load().settings.patterns, 'off');
  assert.equal(rig(hi).tab().load().settings.patterns, 'high');
  assert.equal(rig(bad).tab().load().settings.patterns, 'relief');
});
