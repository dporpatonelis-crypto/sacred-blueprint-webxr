/* Pure lesson state. No DOM, storage, timers or rendering dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.JourneyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const VERSION = 1;
  function shuffle(items, random = Math.random) {
    const out = [...items];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
  function validOrder(order, ids) {
    return Array.isArray(order) && order.length === ids.length && new Set(order).size === ids.length && order.every(id => ids.includes(id));
  }
  function validCount(value, max) {
    return Number.isInteger(value) && value >= 0 && value <= max;
  }
  function create(lesson, saved = null, random = Math.random) {
    const scenes = new Map(lesson.scenes.map(s => [s.id, s]));
    const stations = new Map();
    for (const scene of scenes.values()) scene.stations.forEach((s, index) => stations.set(s.id, { ...s, sceneId: scene.id, index }));
    const counts = {}, orders = {}, wrong = {}, hints = [];
    for (const scene of scenes.values()) {
      counts[scene.id] = 0;
      orders[scene.id] = shuffle(scene.stations.map(s => s.id), random);
    }
    let view = 'main';
    if (saved && saved.version === VERSION && saved.lessonId === lesson.id && saved.contentVersion === lesson.contentVersion) {
      for (const scene of scenes.values()) {
        if (validCount(saved.counts?.[scene.id], scene.stations.length)) counts[scene.id] = saved.counts[scene.id];
        const ids = scene.stations.map(s => s.id);
        if (validOrder(saved.orders?.[scene.id], ids)) orders[scene.id] = [...saved.orders[scene.id]];
      }
      if (counts.main !== scenes.get('main').stations.length) {
        for (const scene of scenes.values()) if (scene.id !== 'main') counts[scene.id] = 0;
      } else if (saved.view === 'main' || scenes.has(saved.view)) view = saved.view;
      for (const s of stations.values()) {
        if (Number.isInteger(saved.wrong?.[s.id]) && saved.wrong[s.id] >= 0 && saved.wrong[s.id] <= 1000) wrong[s.id] = saved.wrong[s.id];
        if (Array.isArray(saved.hints) && saved.hints.includes(s.id)) hints.push(s.id);
      }
    }
    return { version: VERSION, lessonId: lesson.id, contentVersion: lesson.contentVersion, counts, orders, wrong, hints, view };
  }
  function scene(lesson, id) { return lesson.scenes.find(s => s.id === id); }
  function unlocked(lesson, state) { return state.counts.main === scene(lesson, 'main').stations.length; }
  function active(lesson, state, sceneId) { return scene(lesson, sceneId)?.stations[state.counts[sceneId]] || null; }
  function solved(lesson, state, sceneId, stationId) {
    const index = scene(lesson, sceneId)?.stations.findIndex(s => s.id === stationId) ?? -1;
    return index >= 0 && index < state.counts[sceneId];
  }
  function total(lesson, state) { return lesson.scenes.reduce((n, s) => n + state.counts[s.id], 0); }
  function size(lesson) { return lesson.scenes.reduce((n, s) => n + s.stations.length, 0); }
  function complete(lesson, state) { return total(lesson, state) === size(lesson); }
  function match(lesson, state, sceneId, targetId, choiceId) {
    const current = active(lesson, state, sceneId), s = scene(lesson, sceneId);
    if (!s || (sceneId !== 'main' && !unlocked(lesson, state))) return { type: 'locked' };
    if (!current || targetId !== current.id) return { type: 'ignored' };
    if (!s.stations.some(v => v.id === choiceId) || solved(lesson, state, sceneId, choiceId)) return { type: 'ignored' };
    if (current.id !== choiceId) {
      state.wrong[current.id] = (state.wrong[current.id] || 0) + 1;
      if (state.wrong[current.id] >= 2 && !state.hints.includes(current.id)) state.hints.push(current.id);
      return { type: 'wrong', stationId: current.id, hint: state.hints.includes(current.id) };
    }
    state.counts[sceneId]++;
    return { type: 'matched', stationId: current.id, sceneCompleted: state.counts[sceneId] === s.stations.length, scenarioCompleted: complete(lesson, state) };
  }
  function resetScene(lesson, state, sceneId, random = Math.random) {
    const s = scene(lesson, sceneId);
    if (!s || sceneId === 'main') return false;
    state.counts[sceneId] = 0;
    state.orders[sceneId] = shuffle(s.stations.map(s => s.id), random);
    const ids = s.stations.map(s => s.id);
    for (const id of ids) delete state.wrong[id];
    state.hints = state.hints.filter(id => !ids.includes(id));
    return true;
  }
  function pointInPolygon(point, poly) {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i], [xj, yj] = poly[j];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  return { VERSION, shuffle, validOrder, create, scene, unlocked, active, solved, total, size, complete, match, resetScene, pointInPolygon };
});
