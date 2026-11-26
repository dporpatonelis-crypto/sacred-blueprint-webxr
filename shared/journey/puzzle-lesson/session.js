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

function normalizeLesson(source) {
  const grid = source.puzzle?.grid || { columns: 3, rows: 2 };
  const phases = (source.phases || [{ id: 'river', title: 'Σταθμοί', stations: source.stations || [] }])
    .map(phase => {
      const stations = (phase.stations || []).map(station => ({
        ...station,
        phaseId: phase.id,
        answerId: station.answerId || station.id,
        prompt: station.prompt ?? station.before + '_______' + station.after
      }));
      const choices = (phase.choices || stations.map(station => ({
        id: station.answerId,
        word: station.word,
        title: station.title
      }))).map(choice => ({ ...choice }));
      return { ...phase, stations, choices };
    });
  const stations = phases.flatMap(phase => phase.stations);
  return {
    ...source,
    puzzle: { ...source.puzzle, grid },
    phases,
    stations,
    grid,
    tiles: Array.from({ length: grid.columns * grid.rows }, (_, index) => index)
  };
}

export class LessonSession {
  constructor(source) {
    this.lesson = normalizeLesson(source);
    this.stationIds = this.lesson.stations.map(station => station.id);
    this.stationPhase = new Map(this.lesson.stations.map(station => [station.id, station.phaseId]));
    this.phaseOffsets = new Map();
    let offset = 0;
    for (const phase of this.lesson.phases) {
      this.phaseOffsets.set(phase.id, offset);
      offset += phase.stations.length;
    }
    this.storageKey = source.id + '-webxr.v1';
    let saved;
    try { saved = JSON.parse(localStorage.getItem(this.storageKey)); } catch {}
    this.placed = new Set(Array.isArray(saved?.placed) ? saved.placed.filter(tile => this.lesson.tiles.includes(tile)) : []);
    this.tileOrder = restoreOrder(saved?.tileOrder, this.lesson.tiles);
    const savedOrders = saved?.choiceOrders ||
      (this.lesson.phases.length === 1 && saved?.choiceOrder ? { [this.lesson.phases[0].id]: saved.choiceOrder } : {});
    this.choiceOrders = Object.fromEntries(this.lesson.phases.map(phase => [
      phase.id, restoreOrder(savedOrders?.[phase.id], phase.choices.map(choice => choice.id))
    ]));
    this.count = this.gateComplete && Number.isInteger(saved?.count)
      ? Math.min(this.lesson.stations.length, Math.max(0, saved.count)) : 0;
    this.level = saved?.level === 'river' && this.gateComplete ? 'river' : 'gate';
    this.pending = null;
    this.reviewId = null;
    this.save();
  }

  get grid() { return this.lesson.grid; }
  get tiles() { return this.lesson.tiles; }
  get tileCount() { return this.lesson.tiles.length; }
  get gateComplete() { return this.placed.size === this.tileCount; }
  get complete() { return this.count === this.lesson.stations.length && !this.pending && !this.reviewId; }
  get sceneComplete() { return this.complete; }
  get activePhase() {
    const id = this.pending?.phaseId || this.stationPhase.get(this.reviewId) ||
      this.stationPhase.get(this.lesson.stations[this.count]?.id) || this.lesson.phases.at(-1)?.id;
    return this.lesson.phases.find(phase => phase.id === id) || this.lesson.phases[0];
  }
  get choices() {
    const phase = this.activePhase;
    const order = this.choiceOrders[phase.id] || [];
    return order.map(id => phase.choices.find(choice => choice.id === id)).filter(Boolean);
  }
  get allChoices() { return this.lesson.phases.flatMap(phase => phase.choices); }
  get choiceOrder() { return this.choiceOrders[this.activePhase.id]; }
  get selected() { return this.pending?.id || this.reviewId || this.current?.id || null; }
  get localCount() { return this.phaseCount; }
  get phaseCount() {
    const phase = this.activePhase;
    const start = this.phaseOffsets.get(phase.id) || 0;
    return Math.max(0, Math.min(phase.stations.length, this.count - start));
  }
  get busy() { return Boolean(this.pending); }
  get current() {
    if (this.pending) return null;
    if (this.reviewId) return this.lesson.stations.find(station => station.id === this.reviewId) || null;
    return this.lesson.stations[this.count] || null;
  }
  get visibleStation() {
    return this.pending || this.current || this.lesson.stations[Math.min(this.count, this.lesson.stations.length - 1)];
  }

  phaseFor(id) {
    const phaseId = this.stationPhase.get(id);
    return this.lesson.phases.find(phase => phase.id === phaseId) || null;
  }

  solved(id) {
    const index = this.stationIds.indexOf(id);
    return index >= 0 && index < this.count;
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        placed: [...this.placed], tileOrder: this.tileOrder, choiceOrders: this.choiceOrders,
        count: this.count, level: this.level
      }));
    } catch {}
  }

  place(tile, slot) {
    if (!this.tiles.includes(tile) || tile !== slot || this.level !== 'gate' || this.placed.has(tile)) return false;
    this.placed.add(tile);
    this.save();
    return true;
  }

  shuffleTiles() {
    this.tileOrder = shuffle(this.tiles);
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
    if (this.reviewId || !this.current || (this.current.answerId || this.current.id) !== id) return false;
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
