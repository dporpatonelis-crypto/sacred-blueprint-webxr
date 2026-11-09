import lesson from './data/lesson.json' with { type: 'json' };
export { lesson };
export const SAVE_KEY = 'paulos-journey-webxr.v1';
export class PaulSession {
  constructor(storage) {
    this.storage = storage; this.canStore = Boolean(storage); let saved;
    try { saved = JSON.parse(storage?.getItem(SAVE_KEY) || 'null'); } catch { this.canStore = false; }
    this.state = { version: 1, gears: [], cities: {}, view: 'observatory' };
    if (saved?.version === 1) {
      this.state.gears = [...new Set((Array.isArray(saved.gears) ? saved.gears : []).filter(n => Number.isInteger(n) && n >= 0 && n < 3))];
      for (const c of lesson.cities) { const v = saved.cities?.[c.id]; this.state.cities[c.id] = { biography: v?.biography === true, teaching: v?.biography === true && v?.teaching === true, wrongBio: Math.max(0, Math.min(99, Number(v?.wrongBio) || 0)), wrongMeaning: Math.max(0, Math.min(99, Number(v?.wrongMeaning) || 0)) }; }
      if (saved.view === 'observatory' || lesson.cities.some(c => c.id === saved.view)) this.state.view = saved.view;
    }
    for (const c of lesson.cities) this.state.cities[c.id] ||= { biography: false, teaching: false, wrongBio: 0, wrongMeaning: 0 };
    this.onChange = () => {}; this.persist();
  }
  get count() { return Object.values(this.state.cities).reduce((n,c) => n + Number(c.biography) + Number(c.teaching), 0); }
  get complete() { return this.count === 10; }
  get next() { return lesson.cities.find(c => !this.done(c.id)); }
  done(id) { return this.state.cities[id]?.teaching === true; }
  allowed(id) { return this.state.gears.length === 3 && (this.done(id) || this.next?.id === id); }
  city(id) { return this.state.cities[id]; }
  persist() { try { this.storage?.setItem(SAVE_KEY, JSON.stringify(this.state)); } catch { this.canStore = false; } this.onChange(); }
  gear(n) { if (!this.state.gears.includes(n)) { this.state.gears.push(n); this.persist(); } }
  answer(id, phase, choice) {
    if (!this.allowed(id)) return 'locked';
    const state = this.city(id), key = phase === 'bio' ? 'biography' : 'teaching';
    if (state[key]) return 'review';
    if (phase !== 'bio' && !state.biography) return 'locked';
    if (choice !== id) { state[phase === 'bio' ? 'wrongBio' : 'wrongMeaning']++; this.persist(); return 'wrong'; }
    state[key] = true; this.persist(); return 'correct';
  }
  enter(id) { if (id !== 'observatory' && !this.allowed(id)) return false; this.state.view = id; this.persist(); return true; }
  reset(id) { if (id === 'all') { this.state.gears = []; for (const c of lesson.cities) this.state.cities[c.id] = { biography: false, teaching: false, wrongBio: 0, wrongMeaning: 0 }; this.state.view = 'observatory'; } else this.state.cities[id] = { biography: false, teaching: false, wrongBio: 0, wrongMeaning: 0 }; this.persist(); }
}
