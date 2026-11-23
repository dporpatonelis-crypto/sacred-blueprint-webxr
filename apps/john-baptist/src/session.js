import source from './data/source-lesson.json';

export const lesson = {
  ...source,
  stations: source.stations.map(station => ({ ...station, prompt: station.before + '_______' + station.after }))
};

export const TILE_COUNT = 6;
export const TILES = Array.from({ length: TILE_COUNT }, (_, index) => index);
const stationIds = lesson.stations.map(station => station.id);
const storageKey = 'john-baptist-webxr.v1';

function shuffle(values) {
  const list = [...values];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function restoreOrder(order, values) {
  if (Array.isArray(order) && order.length === values.length &&
      values.every(value => order.includes(value))) return order;
  return shuffle(values);
}

export class LessonSession {
  constructor() {
    let saved;
    try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
    this.placed = new Set(Array.isArray(saved?.placed) ? saved.placed.filter(tile => TILES.includes(tile)) : []);
    this.tileOrder = restoreOrder(saved?.tileOrder, TILES);
    this.choiceOrder = restoreOrder(saved?.choiceOrder, stationIds);
    this.choices = this.choiceOrder.map(id => lesson.stations.find(station => station.id === id));
    this.count = this.gateComplete && Number.isInteger(saved?.count)
      ? Math.min(lesson.stations.length, Math.max(0, saved.count)) : 0;
    this.level = saved?.level === 'river' && this.gateComplete ? 'river' : 'gate';
    this.pending = null;
    this.save();
  }

  get gateComplete() { return this.placed.size === TILE_COUNT; }
  get complete() { return this.count === lesson.stations.length && !this.pending; }
  get sceneComplete() { return this.complete; }
  get selected() { return this.pending?.id || this.current?.id || null; }
  get localCount() { return this.count; }
  get busy() { return Boolean(this.pending); }
  get current() { return this.pending ? null : lesson.stations[this.count] || null; }
  get visibleStation() {
    return this.pending || lesson.stations[Math.min(this.count, lesson.stations.length - 1)];
  }

  solved(id) {
    const index = stationIds.indexOf(id);
    return index >= 0 && index < this.count;
  }

  save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        placed: [...this.placed], tileOrder: this.tileOrder, choiceOrder: this.choiceOrder,
        count: this.count, level: this.level
      }));
    } catch {}
  }

  place(tile, slot) {
    if (!TILES.includes(tile) || tile !== slot || this.level !== 'gate' || this.placed.has(tile)) return false;
    this.placed.add(tile);
    this.save();
    return true;
  }

  shuffleTiles() {
    this.tileOrder = shuffle(TILES);
    this.placed.clear();
    this.count = 0;
    this.save();
  }

  enter() {
    if (!this.gateComplete) return false;
    this.level = 'river';
    this.save();
    return true;
  }

  answer(id) {
    if (this.current?.id !== id) return false;
    this.pending = this.current;
    this.count++;
    this.save();
    return true;
  }

  finish(id) {
    if (this.pending?.id === id) this.pending = null;
  }

  restart() {
    this.level = 'gate';
    this.pending = null;
    this.shuffleTiles();
  }
}
