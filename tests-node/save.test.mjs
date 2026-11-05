import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const core = html.split('// SAVE MERGE CORE (portable regression extracts this same function)')[1]?.split('// END SAVE MERGE CORE')[0];
assert.ok(core, 'Actual inline save core exists');
const createSaveStore = new Function(core + '\nreturn createSaveStore;')();
const fixture = JSON.parse(fs.readFileSync(new URL('../test-fixtures/save-v1-earned-classic.json', import.meta.url), 'utf8'));
const copy = value => JSON.parse(JSON.stringify(value));
const defaults = () => ({ v: 1, settings: { sound: true, volume: .7, motion: 'system', patterns: true, undo: 1, bigText: false, theme: 'system', effects: 'full', tapPlace: false }, best: { classic: 0, springs: 0, daily: {} }, trail: { done: [] }, stats: { games: 0, lines: 0, bestHeat: 0, springs: 0 }, resume: null });
function rig(initial = null) {
  let raw = initial === null ? null : JSON.stringify(initial), counter = 0;
  const storage = { readBlocked: false, writeBlocked: false, writes: 0, getItem() { if (this.readBlocked) throw Error('blocked read'); return raw; }, setItem(value) { if (this.writeBlocked) throw Error('quota'); raw = value; this.writes++; } };
  return { storage, get raw() { return raw; }, set raw(value) { raw = value; }, get saved() { return raw === null ? null : JSON.parse(raw); }, tab() { const s = createSaveStore(storage, defaults, () => 'revision-' + (++counter)); s.load(); return s; } };
}
function move(store, amount = 1) { const r = copy(fixture.resume); r.score += amount; r.placed += amount; r.board[0] = amount; r.rng += amount; store.value.resume = r; return r; }
function begin(store) { store.value.resume = null; return store.persist('replace'); }

test('behavior: stale Title preference preserves the complete newer Classic slot', () => {
  const r = rig(), a = r.tab(), b = r.tab(); begin(a); const resume = move(a); a.persist('update');
  b.value.settings.sound = false; b.persist();
  assert.deepEqual(r.saved.resume, resume); assert.equal(r.saved.settings.sound, false);
});
test('behavior: independent stale preference edits retain each other', () => {
  const r = rig(), a = r.tab(), b = r.tab(); a.value.settings.sound = false; a.persist();
  b.value.settings.volume = .25; b.value.settings.bigText = true; b.persist();
  assert.equal(r.saved.settings.sound, false); assert.equal(r.saved.settings.volume, .25); assert.equal(r.saved.settings.bigText, true);
});
test('behavior: active run update preserves and rebases newer preferences without changing its snapshot', () => {
  const r = rig(), a = r.tab(), b = r.tab(); begin(a); move(a); a.persist('update');
  b.value.settings.motion = 'reduced'; b.persist(); const resume = move(a, 2); a.persist('update');
  assert.deepEqual(r.saved.resume, resume); assert.equal(a.value.settings.motion, 'reduced');
});
test('behavior: earned bests, daily records, cards and independent stat deltas survive both writers', () => {
  const r = rig(), a = r.tab(), b = r.tab();
  a.value.best.classic = 80; a.value.best.daily['2026-11-04'] = 10; a.value.trail.done.push('a'); a.value.stats.games++; a.value.stats.lines += 3; a.value.stats.bestHeat = 7; a.persist();
  b.value.best.classic = 40; b.value.best.daily['2026-11-04'] = 20; b.value.trail.done.push('b'); b.value.stats.games++; b.value.stats.springs += 2; b.value.stats.bestHeat = 5; b.persist(); b.persist();
  assert.deepEqual(r.saved.best, { classic: 80, springs: 0, daily: { '2026-11-04': 20 } }); assert.deepEqual(r.saved.trail.done, ['a', 'b']); assert.deepEqual(r.saved.stats, { games: 2, lines: 3, bestHeat: 7, springs: 2 });
});
test('two tabs continuing one generation cannot overwrite a newer revision or hybridize the run', () => {
  const r = rig({ ...fixture, resumeGeneration: 'run', resumeRevision: 'one' }), a = r.tab(), b = r.tab();
  const winner = move(a, 2); a.persist('update'); move(b, 3); assert.equal(b.persist('update').conflict, true);
  assert.deepEqual(r.saved.resume, winner); assert.equal(r.saved.resumeGeneration, 'run');
  move(b, 4); assert.equal(b.persist('update').conflict, false); assert.deepEqual(r.saved.resume, winner);
});
test('legacy same-token snapshot comparison also rejects stale active writes', () => {
  const r = rig(fixture), a = r.tab(), b = r.tab(); const winner = move(a, 2); a.persist('update');
  move(b, 3); assert.equal(b.persist('update').conflict, true); assert.deepEqual(r.saved.resume, winner);
});
test('unchanged generation/revision cannot hide a changed whole snapshot', () => {
  const r = rig({ ...fixture, resumeGeneration: 'run', resumeRevision: 'one' }), a = r.tab();
  const foreign = r.saved; foreign.resume.board[1] = 3; foreign.resume.score += 3; r.raw = JSON.stringify(foreign);
  move(a, 2); assert.equal(a.persist('update').conflict, true); assert.deepEqual(r.saved.resume, foreign.resume);
});
test('explicit new game advances generation even for null to null', () => {
  const r = rig(), a = r.tab(); begin(a); const first = r.saved.resumeGeneration;
  begin(a); assert.notEqual(r.saved.resumeGeneration, first); assert.equal(r.saved.resume, null);
});
test('older empty-run tab cannot resurrect after another explicit new game', () => {
  const r = rig(), a = r.tab(); begin(a); const b = r.tab(); begin(b);
  move(a); assert.equal(a.persist('update').conflict, true); assert.equal(r.saved.resume, null);
});
test('guarded game-end clear advances generation and stale Quit/visibility cannot resurrect', () => {
  const r = rig(fixture), a = r.tab(), b = r.tab(); a.value.resume = null; a.persist('clear'); const generation = r.saved.resumeGeneration;
  move(b); assert.equal(b.persist('update').conflict, true); assert.equal(r.saved.resume, null); assert.equal(r.saved.resumeGeneration, generation);
});
test('Quit update saves the owned coherent run while preserving remote preferences', () => {
  const r = rig(), a = r.tab(), b = r.tab(); begin(a); const run = move(a); a.persist('update'); b.value.settings.sound = false; b.persist();
  a.value.resume = copy(run); a.persist('update'); assert.deepEqual(r.saved.resume, run); assert.equal(r.saved.settings.sound, false);
});
test('quota retains pending preferences and stat deltas until one successful write', () => {
  const r = rig(), a = r.tab(), b = r.tab(); r.storage.writeBlocked = true; a.value.settings.bigText = true; a.value.stats.games++; assert.equal(a.persist().ok, false);
  r.storage.writeBlocked = false; b.value.settings.sound = false; b.persist(); a.value.settings.volume = .2; a.persist(); a.persist();
  assert.equal(r.saved.settings.bigText, true); assert.equal(r.saved.settings.sound, false); assert.equal(r.saved.settings.volume, .2); assert.equal(r.saved.stats.games, 1);
});
test('failed new-run clear retains generation intent on later successful placement', () => {
  const r = rig(fixture), a = r.tab(); r.storage.writeBlocked = true; assert.equal(begin(a).ok, false); r.storage.writeBlocked = false;
  const next = move(a); a.persist('update'); assert.deepEqual(r.saved.resume, next); assert.equal(typeof r.saved.resumeGeneration, 'string');
});
test('a blocked explicit replacement cannot become an unconditional delayed claim', () => {
  const r = rig(fixture), a = r.tab(), b = r.tab(); r.storage.readBlocked = true; assert.equal(begin(a).ok, false);
  r.storage.readBlocked = false; begin(b); const foreign = move(b, 4); b.persist('update');
  assert.equal(a.persist().conflict, true); assert.deepEqual(r.saved.resume, foreign);
});
test('quota-failed clear retries once without resurrecting the old run or counting records twice', () => {
  const r = rig(fixture), a = r.tab(); r.storage.writeBlocked = true; a.value.resume = null; a.value.stats.games++;
  assert.equal(a.persist('clear').ok, false); r.storage.writeBlocked = false; a.persist(); a.persist();
  assert.equal(r.saved.resume, null); assert.equal(r.saved.stats.games, fixture.stats.games + 1);
});
test('blocked read never writes, and a later failed-load call retains pending memory on an empty store', () => {
  const r = rig(), a = r.tab(); a.value.settings.sound = false; r.storage.readBlocked = true; assert.equal(a.persist().ok, false); assert.equal(r.storage.writes, 0);
  r.storage.readBlocked = false; assert.equal(a.load().settings.sound, false); a.persist(); assert.equal(r.saved.settings.sound, false);
});
test('corrupt/partial saves remain playable and corrupt replacement keeps the last known valid values', () => {
  const r = rig(fixture), a = r.tab(); r.raw = '{broken'; a.value.settings.sound = false; a.persist(); assert.deepEqual(r.saved.resume, fixture.resume);
  r.raw = JSON.stringify({ settings: null, best: { daily: null }, trail: { done: null }, stats: { games: 'bad' }, resume: null });
  const b = r.tab(); assert.equal(b.value.resume, null); assert.deepEqual(b.value.trail.done, []); assert.equal(b.value.stats.games, 0); b.value.settings.sound = false; assert.equal(b.persist().ok, true);
});
test('unknown compatible fields and own __proto__ data survive without prototype assignment', () => {
  const source = JSON.parse(JSON.stringify(fixture).replace('"v":1', '"v":1,"__proto__":{"polluted":true},"future":{"flag":7}'));
  source.settings.futureSetting = 'keep'; const r = rig(source), a = r.tab(); a.value.settings.sound = false; a.persist();
  assert.deepEqual(r.saved.future, { flag: 7 }); assert.equal(r.saved.settings.futureSetting, 'keep'); assert.equal(Object.hasOwn(r.saved, '__proto__'), true); assert.equal(({}).polluted, undefined);
});
test('candidate reads the exact legacy earned fixture and the original reader reads candidate fields', () => {
  const r = rig(fixture), a = r.tab(); assert.deepEqual(a.value.resume, fixture.resume); move(a); a.persist('update');
  const d = r.saved, def = defaults(); // Exact original load merge projection, with no candidate-only API.
  const legacy = { ...def, ...d, settings: { ...def.settings, ...(d.settings || {}) }, best: { ...def.best, ...(d.best || {}) }, trail: { ...def.trail, ...(d.trail || {}) }, stats: { ...def.stats, ...(d.stats || {}) } };
  assert.deepEqual(legacy.resume, a.value.resume); assert.deepEqual(legacy.settings, a.value.settings); assert.equal(legacy.v, 1);
});
test('external clear does not resurrect unchanged old records or an old active slot', () => {
  const initial = { ...fixture, resumeGeneration: 'run', resumeRevision: 'rev', best: { classic: 90, springs: 0, daily: {} }, trail: { done: ['a'] } };
  const r = rig(initial), a = r.tab(); r.raw = null; a.value.settings.sound = false; a.persist();
  assert.equal(r.saved.best.classic, 0); assert.deepEqual(r.saved.trail.done, []); move(a); a.persist('update'); assert.equal(r.saved.resume, null);
});
test('explicit Continue adopts the latest whole stored slot after a preference-only merge', () => {
  const r = rig(fixture), a = r.tab(), b = r.tab(); begin(b); const newer = move(b, 4); b.persist('update');
  a.value.settings.sound = false; a.persist(); assert.deepEqual(r.saved.resume, newer); assert.deepEqual(a.readResume(), newer);
  const afterContinue = move(a, 5); assert.equal(a.persist('update').conflict, false); assert.deepEqual(r.saved.resume, afterContinue);
});

test('accepted legacy optional run fields are preserved verbatim rather than newly required', () => {
  const legacy = copy(fixture); delete legacy.resume.rng; delete legacy.resume.queue; delete legacy.resume.undoStack; legacy.resume.futureOptional = { keep: true };
  const r = rig(legacy), a = r.tab(); assert.deepEqual(a.value.resume, legacy.resume); a.value.settings.sound = false; a.persist(); assert.deepEqual(r.saved.resume, legacy.resume);
});
