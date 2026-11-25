export const TILE_COUNT = 6;
export const TILES = Array.from({ length: TILE_COUNT }, (_, index) => index);

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
  constructor(source) {
    this.lesson = {
      ...source,
      stations: source.stations.map(station => ({
        ...station,
        prompt: station.prompt ?? station.before + '_______' + station.after
      }))
    };
    this.stationIds = this.lesson.stations.map(station => station.id);
    this.storageKey = source.id + '-webxr.v1';
    let saved;
    try { saved = JSON.parse(localStorage.getItem(this.storageKey)); } catch {}
    this.placed = new Set(Array.isArray(saved?.placed) ? saved.placed.filter(tile => TILES.includes(tile)) : []);
    this.tileOrder = restoreOrder(saved?.tileOrder, TILES);
    this.choiceOrder = restoreOrder(saved?.choiceOrder, this.stationIds);
    this.choices = this.choiceOrder.map(id => this.lesson.stations.find(station => station.id === id));
    this.count = this.gateComplete && Number.isInteger(saved?.count)
      ? Math.min(this.lesson.stations.length, Math.max(0, saved.count)) : 0;
    this.level = saved?.level === 'river' && this.gateComplete ? 'river' : 'gate';
    this.pending = null;
    this.reviewId = null;
    this.save();
  }

  get gateComplete() { return this.placed.size === TILE_COUNT; }
  get complete() { return this.count === this.lesson.stations.length && !this.pending && !this.reviewId; }
  get sceneComplete() { return this.complete; }
  get selected() { return this.pending?.id || this.reviewId || this.current?.id || null; }
  get localCount() { return this.count; }
  get busy() { return Boolean(this.pending); }
  get current() {
    if (this.pending) return null;
    if (this.reviewId) return this.lesson.stations.find(station => station.id === this.reviewId) || null;
    return this.lesson.stations[this.count] || null;
  }
  get visibleStation() {
    return this.pending || this.current || this.lesson.stations[Math.min(this.count, this.lesson.stations.length - 1)];
  }

  solved(id) {
    const index = this.stationIds.indexOf(id);
    return index >= 0 && index < this.count;
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
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
    if (this.reviewId || this.current?.id !== id) return false;
    this.pending = this.current;
    this.count++;
    this.save();
    return true;
  }

  finish(id) {
    if (this.pending?.id === id) this.pending = null;
    if (this.reviewId === id) this.reviewId = null;
  }

  review(id) {
    if (!this.solved(id) || this.pending || this.level !== 'river') return false;
    this.reviewId = id;
    return true;
  }

  resume() {
    if (!this.reviewId) return false;
    this.reviewId = null;
    return true;
  }

  restart() {
    this.level = 'gate';
    this.pending = null;
    this.reviewId = null;
    this.shuffleTiles();
  }
}
