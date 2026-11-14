// Wave 2, batch C: the save merge core with the return-loop fields (daily history, goals, tipsSeen).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const core = html.split('// SAVE MERGE CORE (portable regression extracts this same function)')[1]?.split('// END SAVE MERGE CORE')[0];
assert.ok(core, 'Actual inline save core exists');
const createSaveStore = new Function(core + '\nreturn createSaveStore;')();
const defaults = () => ({
  v: 1, settings: { sound: true, volume: 0.7, motion: 'system', tapPlace: false, tipsSeen: false },
  best: { classic: 0, springs: 0, daily: {} }, trail: { done: [], stars: {} }, stats: { games: 0, lines: 0, bestHeat: 0, springs: 0 },
  daily: { longest: 0, played: [] }, ach: {}, goals: { boiled: 0 }, resume: null,
});
function rig(initial = null) {
  let raw = initial === null ? null : JSON.stringify(initial), counter = 0;
  const storage = { getItem() { return raw; }, setItem(value) { raw = value; } };
  return { get raw() { return raw; }, set raw(v) { raw = v; }, get saved() { return JSON.parse(raw); }, tab() { const s = createSaveStore(storage, defaults, () => 'rev-' + (++counter)); s.load(); return s; } };
}

test('a fresh player is a newcomer; a save from before tips is not', () => {
  assert.equal(rig().tab().value.settings.tipsSeen, false);
  const old = defaults(); delete old.settings.tipsSeen; delete old.daily; delete old.ach; delete old.goals;
  const s = rig(old).tab().value;
  assert.equal(s.settings.tipsSeen, true);
  assert.deepEqual(s.daily, { longest: 0, played: [] });
  assert.deepEqual(s.ach, {});
  assert.deepEqual(s.goals, { boiled: 0 });
});

test('a replay request survives: tipsSeen false written by this version stays false', () => {
  const r = rig(), a = r.tab(); a.value.settings.tipsSeen = true; a.persist();
  a.value.settings.tipsSeen = false; a.persist();
  assert.equal(r.tab().value.settings.tipsSeen, false);
});

test('damaged return-loop fields fall back to defaults', () => {
  const bad = defaults(); bad.daily = { longest: -3, played: ['2026-11-01', 'x', 5, '2026-11-01'] }; bad.ach = { a: 'no', b: '2026-11-02' }; bad.goals = { boiled: 'many' };
  const s = rig(bad).tab().value;
  assert.deepEqual(s.daily, { longest: 0, played: ['2026-11-01'] });
  assert.deepEqual(s.ach, { b: '2026-11-02' });
  assert.deepEqual(s.goals, { boiled: 0 });
  const worse = defaults(); worse.daily = 'x'; worse.ach = []; worse.goals = null;
  const w = rig(worse).tab().value;
  assert.deepEqual([w.daily, w.ach, w.goals], [{ longest: 0, played: [] }, {}, { boiled: 0 }]);
});

test('two tabs keep each other: played days union, goals union, longest takes the max, Boiling count adds', () => {
  const r = rig(), a = r.tab(), b = r.tab();
  a.value.daily.played.push('2026-11-01'); a.value.daily.longest = 2; a.value.ach['first-soak'] = '2026-11-01'; a.value.goals.boiled = 2; a.persist();
  b.value.daily.played.push('2026-11-02'); b.value.daily.longest = 3; b.value.ach.boiling = '2026-11-02'; b.value.goals.boiled = 1; b.persist();
  const s = r.saved;
  assert.deepEqual(s.daily, { longest: 3, played: ['2026-11-01', '2026-11-02'] });
  assert.deepEqual(s.ach, { 'first-soak': '2026-11-01', boiling: '2026-11-02' });
  assert.equal(s.goals.boiled, 3);
});

test('an earned goal keeps its first date when another tab earns it later', () => {
  const r = rig(), a = r.tab(), b = r.tab();
  a.value.ach['first-soak'] = '2026-11-01'; a.persist();
  b.value.ach['first-soak'] = '2026-11-09'; b.persist();
  assert.equal(r.saved.ach['first-soak'], '2026-11-01');
});

test('the played list is capped at 120 days', () => {
  const r = rig(), a = r.tab();
  const days = []; for (let i = 0; i < 150; i++) days.push('2026-' + String(1 + Math.floor(i / 28)).padStart(2, '0') + '-' + String(1 + (i % 28)).padStart(2, '0'));
  a.value.daily.played = days; a.persist();
  assert.equal(r.saved.daily.played.length, 120);
  assert.equal(r.saved.daily.played.at(-1), days.at(-1));
});
