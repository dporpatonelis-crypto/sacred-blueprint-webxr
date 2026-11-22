import { PuzzleActivity } from '../../../shared/puzzles/puzzle-activity.js';
import lesson from './data/source-lesson.json';

export { lesson };
const SAVE_KEY = 'world-religions-paths-webxr.v1';

function shuffled(ids) {
  const order = [...ids];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

function fresh(religion) {
  return {
    count: 0,
    phase: 'ready',
    focus: null,
    unlocked: false,
    puzzle: null,
    wrong: {},
    hints: [],
    order: shuffled(religion.scenes.map(scene => scene.id))
  };
}

function restored(religion, saved) {
  const route = fresh(religion);
  if (!saved || typeof saved !== 'object') return route;
  const ids = religion.scenes.map(scene => scene.id);
  if (Number.isInteger(saved.count) && saved.count >= 0 && saved.count <= ids.length) route.count = saved.count;
  route.phase = route.count === ids.length ? 'complete' : 'ready';
  if (saved.phase === 'explaining' && ids.slice(0, route.count).includes(saved.focus)) {
    route.phase = 'explaining';
    route.focus = saved.focus;
  }
  route.unlocked = saved.unlocked === true || route.count > 0;
  route.puzzle = saved.puzzle ?? null;
  route.hints = Array.isArray(saved.hints) ? [...new Set(saved.hints.filter(id => ids.includes(id)))] : [];
  if (Array.isArray(saved.order) && saved.order.length === ids.length &&
      new Set(saved.order).size === ids.length && saved.order.every(id => ids.includes(id))) {
    route.order = [...saved.order];
  }
  for (const id of ids) {
    if (Number.isInteger(saved.wrong?.[id]) && saved.wrong[id] > 0) route.wrong[id] = saved.wrong[id];
  }
  return route;
}

export class ReligionsSession {
  constructor(storage) {
    this.storage = storage;
    this.canStore = Boolean(storage);
    let saved;
    try {
      saved = JSON.parse(storage?.getItem(SAVE_KEY) || 'null');
    } catch {
      this.canStore = false;
    }
    if (saved?.version !== 1) saved = null;

    this.state = {
      version: 1,
      view: 'hub',
      selectedPlanet: this.religion(saved?.selectedPlanet)?.id || lesson.religions[0].id,
      routes: Object.fromEntries(lesson.religions.map(religion => [
        religion.id, restored(religion, saved?.routes?.[religion.id])
      ]))
    };
    this.activities = new Map();
    for (const { id } of lesson.religions) {
      const storageAdapter = {
        getItem: () => JSON.stringify(this.route(id).puzzle),
        setItem: (_, serialized) => {
          const snapshot = JSON.parse(serialized);
          const route = this.route(id);
          route.puzzle = snapshot;
          if (snapshot.tiles.every((tile, index) => tile === (index === snapshot.tiles.length - 1 ? null : index))) {
            route.unlocked = true;
          }
          this.persist();
        }
      };
      this.activities.set(id, new PuzzleActivity({ key: id, rows: 2, columns: 3, storage: storageAdapter }));
    }
    if (this.isOpen(saved?.view)) this.state.view = saved.view;
  }

  religion(id) { return lesson.religions.find(religion => religion.id === id); }
  route(id) { return this.state.routes[id]; }
  activity(id) { return this.activities.get(id); }
  isOpen(id) { return this.route(id)?.unlocked === true; }

  solved(id, stationId) {
    const index = this.religion(id)?.scenes.findIndex(scene => scene.id === stationId);
    return index >= 0 && index < this.route(id).count;
  }

  current(id) {
    const route = this.route(id);
    return this.religion(id)?.scenes.find((scene, index) => route.focus ? scene.id === route.focus : index === route.count);
  }

  selectPlanet(id) {
    if (!this.religion(id)) return;
    this.state.selectedPlanet = id;
    this.persist();
  }

  enter(id) {
    if (id !== 'hub' && !this.isOpen(id)) return false;
    this.state.view = id;
    if (id !== 'hub') this.state.selectedPlanet = id;
    this.persist();
    return true;
  }

  pour(id, choiceId) {
    const route = this.route(id);
    const station = this.current(id);
    if (!this.isOpen(id) || route.phase !== 'ready' || !station ||
        !route.order.includes(choiceId) || this.solved(id, choiceId)) return null;
    if (choiceId !== station.id) {
      route.wrong[station.id] = (route.wrong[station.id] || 0) + 1;
      if (route.wrong[station.id] >= 2 && !route.hints.includes(station.id)) {
        route.hints.push(station.id);
      }
      this.persist();
      return 'wrong';
    }
    route.count++;
    route.phase = 'explaining';
    route.focus = station.id;
    this.persist();
    return 'correct';
  }

  hint(id) {
    const station = this.current(id);
    const route = this.route(id);
    if (!station || route.phase !== 'ready' || route.hints.includes(station.id)) return;
    route.hints.push(station.id);
    this.persist();
  }

  proceed(id) {
    const route = this.route(id);
    if (route.phase !== 'explaining') return false;
    route.focus = null;
    route.phase = route.count === this.religion(id).scenes.length ? 'complete' : 'ready';
    this.persist();
    return true;
  }

  reset(id) {
    const religions = id === 'all' ? lesson.religions : lesson.religions.filter(religion => religion.id === id);
    for (const religion of religions) {
      this.state.routes[religion.id] = fresh(religion);
      this.activity(religion.id).restart();
    }
    this.enter('hub');
  }

  persist() {
    if (!this.canStore) return;
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.state));
    } catch {
      this.canStore = false;
    }
  }
}
