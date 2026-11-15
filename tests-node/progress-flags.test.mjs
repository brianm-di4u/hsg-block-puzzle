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
