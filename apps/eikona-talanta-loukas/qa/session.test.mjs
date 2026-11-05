import test from 'node:test';
import assert from 'node:assert/strict';
import { LessonSession, SAVE_KEY, PILOT_KEY, Core, lesson } from '../src/session.js';

const scene = id => Core.scene(lesson, id);
const ids = id => scene(id).stations.map(s => s.id);
function memory(initial = []) {
  const entries = new Map(initial);
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), entries };
}
function solve(s, id = s.current.id) {
  s.choose(id); const result = s.target(id);
  assert.equal(result.type, 'matched');
  s.finishReveal(result.token); return result;
}
function unlock(s) { ids('main').forEach(id => solve(s, id)); }
function finishScene(s) { while (s.current) solve(s); }

test('all 16 original IDs and texts are present; the four main matches gate focus scenes', () => {
  const s = new LessonSession(null, () => .42);
  assert.equal(s.size, 16); assert.equal(s.count, 0); assert.equal(s.sceneId, 'main');
  assert.equal(s.enter('eikona'), false);
  assert.deepEqual(s.state.counts, { main: 0, eikona: 0, talanta: 0, loukas: 0, omoiosi: 0 });
  assert.deepEqual(s.choices.map(c => c.id).sort(), ids('main').sort());
  assert.notEqual(SAVE_KEY, PILOT_KEY);
  unlock(s); assert.equal(s.count, 4); assert.equal(s.complete, false);
  assert.deepEqual(s.choose('main-loukas'), { type: 'enter', sceneId: 'loukas' });
  assert.equal(s.enter('loukas'), true); assert.equal(s.current.id, 'loukas-knowledge');
});

test('sequential targets, two wrong answers and hints work in every scene', () => {
  const s = new LessonSession();
  for (const data of lesson.scenes) {
    if (data.id !== 'main') s.enter(data.id);
    const [first, second] = ids(data.id);
    s.choose(first); assert.equal(s.target(second).type, 'ignored'); s.selected = null;
    for (let i=0;i<2;i++) { s.choose(second); assert.equal(s.target(first).type, 'wrong'); }
    assert.equal(s.hasHint(first), true); assert.equal(s.message, data.stations[0].hint);
    finishScene(s);
  }
  assert.equal(s.count, 16);
});

test('a committed match cannot be submitted twice during the reveal', () => {
  const s = new LessonSession();
  s.choose(s.current.id); const r = s.target(s.current.id);
  assert.equal(s.count, 1); s.choose(ids('main')[1]); assert.equal(s.selected, null);
  assert.equal(s.target(ids('main')[0]).type, 'busy'); assert.equal(s.count, 1);
  assert.equal(s.finishReveal(r.token), true); assert.equal(s.finishReveal(r.token), false);
});

test('focus scenes can be visited in any order; completion happens only at 16/16', () => {
  const s = new LessonSession(); unlock(s);
  for (const id of ['omoiosi', 'loukas', 'eikona', 'talanta']) {
    s.enter(id); assert.equal(s.complete, false); finishScene(s);
    s.enter('main');
  }
  assert.equal(s.count, 16); assert.equal(s.complete, true);
  for (const id of ids('main')) assert.equal(s.groupProgress(id), 3);
});

test('progress, current scene, shuffled options and hints survive a reload', () => {
  const storage = memory(), s = new LessonSession(storage, () => .1);
  unlock(s); s.enter('eikona'); s.hint(); solve(s);
  const order = s.choices.map(c => c.id), restored = new LessonSession(storage);
  assert.equal(restored.count, 5); assert.equal(restored.sceneId, 'eikona');
  assert.equal(restored.current.id, 'eikona-reason'); assert.equal(restored.hasHint('eikona-unity'), true);
  assert.deepEqual(restored.choices.map(c => c.id), order); assert.equal(storage.entries.size, 1);
});

test('reviewing solved focus targets leaves progress unchanged and resumes at the active target', () => {
  const s = new LessonSession(); unlock(s); s.enter('talanta'); solve(s);
  s.choose('talanta-trust'); assert.equal(s.reviewId, 'talanta-trust');
  assert.equal(s.target('talanta-trust').type, 'review'); assert.equal(s.count, 5);
  s.resume(); assert.equal(s.reviewId, null); assert.equal(s.current.id, 'talanta-cultivation');
});

test('changing scenes during a reveal cancels its callback while keeping the match', () => {
  const s = new LessonSession(); unlock(s); s.enter('talanta');
  s.choose(s.current.id); const r = s.target(s.current.id);
  s.enter('main'); assert.equal(s.finishReveal(r.token), false);
  assert.equal(s.busy, false); assert.equal(s.state.counts.talanta, 1);
  s.enter('talanta'); assert.equal(s.current.id, 'talanta-cultivation');
});

test('resetting one focus scene preserves main map, other scenes and their hints', () => {
  const s = new LessonSession(); unlock(s);
  s.enter('eikona'); s.hint(); finishScene(s);
  s.enter('talanta'); s.hint(); solve(s); s.reset('scene');
  assert.equal(s.count, 7); assert.equal(s.state.counts.eikona, 3); assert.equal(s.unlocked, true);
  assert.equal(s.sceneId, 'talanta'); assert.equal(s.hasHint('eikona-unity'), true);
  assert.equal(s.hasHint('talanta-trust'), false); assert.equal(s.current.id, 'talanta-trust');
});

test('full reset during a reveal returns to a clean main map and invalidates the timer', () => {
  const s = new LessonSession(); unlock(s); s.enter('loukas'); s.hint();
  s.choose(s.current.id); const r = s.target(s.current.id); s.reset();
  assert.equal(s.finishReveal(r.token), false); assert.equal(s.count, 0);
  assert.equal(s.sceneId, 'main'); assert.equal(s.unlocked, false);
  assert.equal(s.selected, null); assert.equal(s.reviewId, null); assert.deepEqual(s.state.hints, []);
});

test('pilot progress is preserved only after the four main matches; reset never imports it twice', () => {
  const legacy = { version: 1, lessonId: 'eikona-talanta-loukas-webxr-talanta', contentVersion: 1,
    counts: { main: 2 }, orders: { main: ids('talanta').reverse() }, hints: ['talanta-trust'], wrong: {'talanta-trust': 2} };
  const storage = memory([[PILOT_KEY, JSON.stringify(legacy)]]);
  let s = new LessonSession(storage);
  assert.equal(s.count, 0); assert.equal(s.pilotCarry.count, 2);
  solve(s); s = new LessonSession(storage); assert.equal(s.pilotCarry.count, 2);
  finishScene(s);
  assert.equal(s.count, 6); assert.equal(s.state.counts.talanta, 2); assert.equal(s.pilotCarry, null);
  s.enter('talanta'); assert.equal(s.current.id, 'talanta-inaction'); assert.equal(s.hasHint('talanta-trust'), true);
  assert.deepEqual(s.choices.map(c => c.id), legacy.orders.main);
  s.reset('scene'); s.enter('main'); assert.equal(s.state.counts.talanta, 0);
  s.reset(); s = new LessonSession(storage); unlock(s);
  assert.equal(s.count, 4); assert.equal(s.state.counts.talanta, 0);
  assert.equal(storage.getItem(PILOT_KEY), JSON.stringify(legacy), 'legacy save remains untouched');
});

test('storage read/write failures retain a usable in-memory lesson', () => {
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  const s = new LessonSession(blocked); assert.equal(s.canStore, false); solve(s); assert.equal(s.count, 1);
  const unwritable = new LessonSession({ getItem: () => null, setItem() { throw Error('quota'); } });
  solve(unwritable); assert.equal(unwritable.count, 1); assert.equal(unwritable.canStore, false);
});

test('invalid saves, locked focus progress and corrupt migration fields are rejected', () => {
  const storage = memory(); storage.setItem(SAVE_KEY, '{broken');
  assert.equal(new LessonSession(storage).count, 0);
  const clean = new LessonSession().state;
  for (const bad of [
    { ...clean, lessonId:'other', counts:{main:4,talanta:3}, pilotCarry:{count:3} },
    { ...clean, counts:{main:99,talanta:3}, view:'talanta' },
    { ...clean, counts:{main:2,talanta:3}, view:'talanta', pilotCarry:{count:99} },
  ]) {
    storage.setItem(SAVE_KEY, JSON.stringify(bad));
    const s = new LessonSession(storage);
    assert.equal(s.state.counts.talanta, 0); assert.equal(s.sceneId, 'main'); assert.equal(s.pilotCarry, null);
  }
});
