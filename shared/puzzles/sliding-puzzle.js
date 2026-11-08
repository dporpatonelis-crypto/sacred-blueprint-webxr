// Pure sliding-puzzle rules. Tile IDs describe their positions in the final image.
export class SlidingPuzzle {
  constructor({ rows = 3, columns = 3, shuffleMoves = 24, random = Math.random, saved = null, onChange = () => {}, onSolved = () => {} } = {}) {
    if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 2 || columns < 2) throw new Error('A puzzle needs at least two rows and columns.');
    this.rows = rows; this.columns = columns; this.random = random; this.shuffleMoves = shuffleMoves;
    this.onChange = onChange; this.onSolved = onSolved;
    if (SlidingPuzzle.valid(saved, rows, columns)) {
      this.tiles = [...saved.tiles]; this.moves = saved.moves;
    } else this.shuffle(false);
  }
  get size() { return this.rows * this.columns; }
  get blank() { return this.tiles.indexOf(null); }
  get solved() { return this.tiles.every((tile, index) => tile === (index === this.size - 1 ? null : index)); }
  adjacent(a, b) {
    return Math.abs(Math.floor(a / this.columns) - Math.floor(b / this.columns)) + Math.abs(a % this.columns - b % this.columns) === 1;
  }
  canMove(tile) {
    const index = this.tiles.indexOf(tile);
    return tile !== null && index >= 0 && !this.solved && this.adjacent(index, this.blank);
  }
  move(tile) {
    if (!this.canMove(tile)) return false;
    const index = this.tiles.indexOf(tile), blank = this.blank;
    [this.tiles[index], this.tiles[blank]] = [this.tiles[blank], this.tiles[index]];
    this.moves++;
    this.onChange(this);
    if (this.solved) this.onSolved(this);
    return true;
  }
  moveBlank(direction) {
    const [dr, dc] = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[direction] || [];
    if (dr === undefined) return false;
    const row = Math.floor(this.blank / this.columns) + dr, column = this.blank % this.columns + dc;
    return row >= 0 && row < this.rows && column >= 0 && column < this.columns
      ? this.move(this.tiles[row * this.columns + column]) : false;
  }
  shuffle(notify = true) {
    // Legal moves preserve parity. Reversing the last move is never selected.
    let attempt = 0;
    do {
      this.tiles = Array.from({ length: this.size }, (_, i) => i === this.size - 1 ? null : i);
      let previous = -1;
      // A 2×2 board cycles after twelve non-reversing moves; vary that case.
      const steps = this.shuffleMoves + (this.size === 4 ? attempt % 12 : 0);
      for (let step = 0; step < steps; step++) {
        const blank = this.blank;
        const choices = this.tiles.map((_, i) => i).filter(i => i !== previous && this.adjacent(i, blank));
        const next = choices[Math.min(choices.length - 1, Math.floor(this.random() * choices.length))];
        [this.tiles[blank], this.tiles[next]] = [this.tiles[next], this.tiles[blank]];
        previous = blank;
      }
      if (++attempt > 128) throw new Error('Could not create a shuffled puzzle with this random source.');
    } while (this.solved || this.tiles.filter((tile, i) => tile !== null && tile !== i).length < Math.min(4, this.size - 1) || this.distance() < Math.min(8, this.size - 1));
    this.moves = 0;
    if (notify) this.onChange(this);
  }
  distance() {
    return this.tiles.reduce((sum, tile, i) => tile === null ? sum : sum + Math.abs(Math.floor(i / this.columns) - Math.floor(tile / this.columns)) + Math.abs(i % this.columns - tile % this.columns), 0);
  }
  serialize() { return { version: 1, rows: this.rows, columns: this.columns, tiles: [...this.tiles], moves: this.moves }; }
  static valid(saved, rows, columns) {
    const size = rows * columns;
    if (!saved || saved.version !== 1 || saved.rows !== rows || saved.columns !== columns || !Number.isSafeInteger(saved.moves) || saved.moves < 0 || !Array.isArray(saved.tiles) || saved.tiles.length !== size) return false;
    const tiles = saved.tiles;
    if (new Set(tiles).size !== size || tiles.filter(t => t === null).length !== 1 || !tiles.every(t => t === null || Number.isInteger(t) && t >= 0 && t < size - 1)) return false;
    const numbers = tiles.filter(t => t !== null);
    let inversions = 0;
    for (let i = 0; i < numbers.length; i++) for (let j = i + 1; j < numbers.length; j++) if (numbers[i] > numbers[j]) inversions++;
    const rowFromBottom = rows - Math.floor(tiles.indexOf(null) / columns);
    return columns % 2 ? inversions % 2 === 0 : (inversions + rowFromBottom) % 2 === 1;
  }
}
