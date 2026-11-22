import { SlidingPuzzle } from './sliding-puzzle.js';

function solutionFrom(puzzle) {
  const initial = { tiles: [...puzzle.tiles], blank: puzzle.blank, move: null, previous: null };
  const queue = [initial];
  const visited = new Set([initial.tiles.join(',')]);

  for (let i = 0; i < queue.length; i++) {
    const state = queue[i];
    if (state.tiles.every((tile, index) => tile === (index === puzzle.size - 1 ? null : index))) {
      const moves = [];
      for (let cursor = state; cursor.previous; cursor = cursor.previous) moves.push(cursor.move);
      return moves.reverse();
    }
    for (let next = 0; next < puzzle.size; next++) {
      if (!puzzle.adjacent(state.blank, next)) continue;
      const tiles = [...state.tiles];
      const move = tiles[next];
      tiles[state.blank] = move;
      tiles[next] = null;
      const key = tiles.join(',');
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push({ tiles, blank: next, move, previous: state });
    }
  }
  return [];
}

// Storage and notifications are shared by the HTML and Three.js views.
export class PuzzleActivity {
  constructor({ key, storage = null, rows = 3, columns = 3 }) {
    this.key = key; this.storage = storage; this.canStore = Boolean(storage); this.listeners = new Set();
    this.autoRun = null;
    let saved = null;
    try { saved = JSON.parse(storage?.getItem(key) || 'null'); } catch { /* Start a fresh, solvable board. */ }
    this.puzzle = new SlidingPuzzle({ rows, columns, saved, onChange: () => this.changed() });
    this.persist();
  }
  persist() {
    if (!this.canStore) return;
    try { this.storage.setItem(this.key, JSON.stringify(this.puzzle.serialize())); } catch { this.canStore = false; }
  }
  notify() { for (const listener of this.listeners) listener(this.puzzle); }
  changed() { this.persist(); this.notify(); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  get autoSolving() { return this.autoRun !== null; }
  move(tile) { return !this.autoSolving && this.puzzle.move(tile); }
  restart() {
    this.cancelAutoSolve();
    this.puzzle.shuffle();
  }
  cancelAutoSolve() {
    if (!this.autoRun) return;
    clearTimeout(this.autoRun.timer);
    this.autoRun = null;
    this.notify();
  }
  solveAutomatically({ immediate = false } = {}) {
    // The assisted activity is the 3 × 2 board. Its complete search is small.
    if (this.puzzle.rows !== 2 || this.puzzle.columns !== 3 || this.puzzle.solved || this.autoSolving) return;
    const moves = solutionFrom(this.puzzle);
    if (!moves.length) return;
    const run = { index: 0, timer: null };
    this.autoRun = run;
    this.notify();

    const advance = () => {
      if (this.autoRun !== run) return;
      const moved = this.puzzle.move(moves[run.index++]);
      if (this.autoRun !== run) return;
      if (!moved || this.puzzle.solved || run.index === moves.length) {
        this.cancelAutoSolve();
      } else if (!immediate) {
        run.timer = setTimeout(advance, 195);
      }
    };
    if (immediate) {
      while (this.autoRun === run) advance();
    } else {
      run.timer = setTimeout(advance, 110);
    }
  }
}
