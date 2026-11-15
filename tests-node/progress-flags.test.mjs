// Wave 3 batch C: the furthest era reached (S4-17) rides in save version 1 with a default merged on load.
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

test('an older save without eraMax loads with 0 and every old field intact', () => {
  const old = copy(defaultSave()); delete old.eraMax; old.best.classic = 1234; old.stats.games = 9;
  const store = rig(old).tab(); store.load();
  assert.equal(store.value.eraMax, 0); assert.equal(store.value.best.classic, 1234); assert.equal(store.value.stats.games, 9);
});
test('a damaged eraMax falls back to 0', () => {
  for (const bad of ['x', -1, 7, 2.5, null, {}, [3]]) {
    const save = copy(defaultSave()); save.eraMax = bad;
    const store = rig(save).tab(); store.load();
    assert.equal(store.value.eraMax, 0, 'bad value ' + JSON.stringify(bad));
  }
  const ok = copy(defaultSave()); ok.eraMax = 4;
  const store = rig(ok).tab(); store.load(); assert.equal(store.value.eraMax, 4);
});
test('two tabs reaching different eras keep the furthest, and a lower value never lowers it', () => {
  const r = rig(), a = r.tab(), b = r.tab(); a.load(); b.load();
  a.value.eraMax = 3; a.persist();
  b.value.eraMax = 2; b.persist();
  assert.equal(r.saved.eraMax, 3);
});

// Batch C (S2-02, S2-07, S2-17): one-time teaching toasts. A save from before them reads as "all shown".
test('a brand new profile has no hints shown; an older save without the field reads as all shown', () => {
  const fresh = rig().tab(); fresh.load();
  assert.deepEqual(fresh.value.hints, {});
  const old = copy(defaultSave()); delete old.hints; old.stats.games = 4;
  const store = rig(old).tab(); store.load();
  assert.deepEqual(store.value.hints, { all: true });
});
test('damaged hints keep only true flags with short ids, at most thirty', () => {
  const bad = copy(defaultSave());
  bad.hints = { cool: true, era: 'yes', undo: false, ['x'.repeat(30)]: true };
  for (let i = 0; i < 40; i++) bad.hints['h' + i] = true;
  const store = rig(bad).tab(); store.load();
  const ids = Object.keys(store.value.hints);
  assert.ok(ids.includes('cool') && !ids.includes('era') && !ids.includes('undo') && !ids.includes('x'.repeat(30)));
  assert.equal(ids.length, 30);
  const text = copy(defaultSave()); text.hints = 'cool';
  const s2 = rig(text).tab(); s2.load(); assert.deepEqual(s2.value.hints, { all: true });
});
test('two tabs each showing a different hint keep both', () => {
  const r = rig(), a = r.tab(), b = r.tab(); a.load(); b.load();
  a.value.hints.cool = true; a.persist();
  b.value.hints.undo = true; b.persist();
  assert.deepEqual(r.saved.hints, { cool: true, undo: true });
});
