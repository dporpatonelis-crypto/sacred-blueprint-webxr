// Input independent fill clock: a completed pour requires release before retry.
export class WaterFill {
  constructor(seconds = 1.45) {
    this.seconds = seconds;
    this.question = null;
    this.levels = new Map();
    this.latched = false;
  }
  setQuestion(id, choices) {
    if (id === this.question) return;
    this.question = id;
    this.levels = new Map(choices.map(choice => [choice, 0]));
    // A held trigger must not answer the next question automatically.
  }
  release() { this.latched = false; }
  reset() { this.question = null; this.levels.clear(); this.latched = false; }
  reject(id) { this.levels.set(id, 0); }
  pour(id, dt, enabled = true) {
    if (!enabled || this.latched || !this.question || !this.levels.has(id)) return null;
    const value = Math.min(1, this.levels.get(id) + Math.max(0, Math.min(dt, .08)) / this.seconds);
    this.levels.set(id, value);
    if (value < 1) return null;
    this.latched = true;
    return id;
  }
}
