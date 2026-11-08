import { SlidingPuzzle } from './sliding-puzzle.js';

// Storage and notifications are shared by the HTML and Three.js views.
export class PuzzleActivity {
  constructor({ key, storage = null, rows = 3, columns = 3 }) {
    this.key = key; this.storage = storage; this.canStore = Boolean(storage); this.listeners = new Set();
    let saved = null;
    try { saved = JSON.parse(storage?.getItem(key) || 'null'); } catch { /* Start a fresh, solvable board. */ }
    this.puzzle = new SlidingPuzzle({ rows, columns, saved, onChange: () => this.changed() });
    this.persist();
  }
  persist() {
    if (!this.canStore) return;
    try { this.storage.setItem(this.key, JSON.stringify(this.puzzle.serialize())); } catch { this.canStore = false; }
  }
  changed() { this.persist(); for (const listener of this.listeners) listener(this.puzzle); }
  subscribe(listener) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  move(tile) { return this.puzzle.move(tile); }
  restart() { this.puzzle.shuffle(); }
}
