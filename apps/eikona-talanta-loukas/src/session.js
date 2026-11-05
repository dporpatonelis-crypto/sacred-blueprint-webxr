import source from './data/source-lesson.json' with { type: 'json' };
import JourneyCore from '#journey-core';

export const Core = JourneyCore;
export const lesson = { ...source, id: source.id + '-webxr' };
export const SAVE_KEY = lesson.id + '.v' + lesson.contentVersion;
export const PILOT_KEY = source.id + '-webxr-talanta.v' + source.contentVersion;

export class LessonSession {
  constructor(storage = null, random = Math.random) {
    this.storage = storage; this.random = random; this.canStore = Boolean(storage);
    let raw = null, saved = null, pilot = null;
    try { raw = storage?.getItem(SAVE_KEY) ?? null; } catch { this.canStore = false; }
    try { saved = JSON.parse(raw || 'null'); } catch { /* Invalid saves start clean. */ }
    if (raw === null && this.canStore) {
      try { pilot = JSON.parse(storage.getItem(PILOT_KEY) || 'null'); } catch { /* Optional migration. */ }
    }
    this.state = Core.create(lesson, saved, random);
    this.pilotCarry = saved?.version === Core.VERSION && saved.lessonId === lesson.id && saved.contentVersion === lesson.contentVersion &&
      saved.pilotCarry && Number.isInteger(saved.pilotCarry.count) && saved.pilotCarry.count > 0 && saved.pilotCarry.count <= 3
      ? { count: saved.pilotCarry.count, order: saved.pilotCarry.order, hints: Array.isArray(saved.pilotCarry.hints) ? saved.pilotCarry.hints : [], wrong: saved.pilotCarry.wrong || {} } : null;
    if (pilot?.lessonId === source.id + '-webxr-talanta' && pilot.contentVersion === source.contentVersion &&
        Number.isInteger(pilot.counts?.main) && pilot.counts.main > 0 && pilot.counts.main <= 3) {
      this.pilotCarry = { count: pilot.counts.main, order: pilot.orders?.main, hints: Array.isArray(pilot.hints) ? pilot.hints : [], wrong: pilot.wrong || {} };
    }
    this.selected = null; this.reviewId = null; this.busy = false; this.revealToken = 0;
    this.message = this.inHub && this.sceneComplete ? 'Διάλεξε μια νησίδα' : 'Επίλεξε · Σύνδεσε';
    this.kind = ''; this.onChange = () => {};
  }
  get sceneId() { return this.state.view; }
  get sceneData() { return Core.scene(lesson, this.sceneId); }
  get inHub() { return this.sceneId === 'main'; }
  get count() { return Core.total(lesson, this.state); }
  get size() { return Core.size(lesson); }
  get localCount() { return this.state.counts[this.sceneId]; }
  get sceneComplete() { return this.localCount === this.sceneData.stations.length; }
  get current() { return Core.active(lesson, this.state, this.sceneId); }
  get complete() { return Core.complete(lesson, this.state); }
  get unlocked() { return Core.unlocked(lesson, this.state); }
  get visibleStation() { return this.sceneData.stations.find(s => s.id === this.reviewId) || this.current || this.sceneData.stations.at(-1); }
  get choices() { return this.state.orders[this.sceneId].map(id => this.sceneData.stations.find(s => s.id === id)); }
  solved(id, sceneId = this.sceneId) { return Core.solved(lesson, this.state, sceneId, id); }
  hasHint(id = this.visibleStation.id) { return this.state.hints.includes(id); }
  groupFor(id) { return lesson.groups.find(group => group.mainStationId === id); }
  groupProgress(id) { const group = this.groupFor(id); return group ? this.state.counts[group.sceneId] : 0; }
  changed(persist = true) {
    if (persist && this.canStore) {
      try { this.storage.setItem(SAVE_KEY, JSON.stringify({ ...this.state, pilotCarry: this.pilotCarry })); }
      catch { this.canStore = false; }
    }
    this.onChange();
  }
  choose(id) {
    if (this.busy || !this.sceneData.stations.some(s => s.id === id)) return;
    if (this.inHub && this.unlocked) return { type: 'enter', sceneId: this.groupFor(id).sceneId };
    if (this.solved(id)) { this.review(id); return; }
    this.reviewId = null; this.selected = this.selected === id ? null : id;
    this.message = this.selected ? 'Τώρα, στον στόχο' : 'Επίλεξε · Σύνδεσε'; this.kind = '';
    this.changed(false);
  }
  target(id) {
    if (this.busy) return { type: 'busy' };
    if (this.inHub && this.unlocked && this.groupFor(id)) return { type: 'enter', sceneId: this.groupFor(id).sceneId };
    if (this.solved(id)) { this.review(id); return { type: 'review' }; }
    this.reviewId = null;
    if (!this.current || id !== this.current.id) {
      this.message = 'Ακολούθησε το φως'; this.kind = ''; this.changed(false); return { type: 'ignored' };
    }
    if (!this.selected) {
      this.message = 'Πρώτα μία κάρτα'; this.kind = ''; this.changed(false); return { type: 'empty' };
    }
    const result = Core.match(lesson, this.state, this.sceneId, id, this.selected);
    this.selected = null;
    if (result.type === 'wrong') {
      this.message = result.hint ? this.current.hint : 'Δοκίμασε ξανά'; this.kind = 'wrong';
    } else if (result.type === 'matched') {
      this.busy = true; result.token = ++this.revealToken;
      this.message = 'Η σύνδεση φωτίστηκε'; this.kind = 'success';
      if (this.inHub && this.unlocked) this.importPilot();
      result.scenarioCompleted = this.complete;
    }
    this.changed(); return result;
  }
  importPilot() {
    if (!this.pilotCarry) return;
    const ids = Core.scene(lesson, 'talanta').stations.map(s => s.id);
    this.state.counts.talanta = Math.max(this.state.counts.talanta, Math.min(3, Math.max(0, this.pilotCarry.count)));
    if (Core.validOrder(this.pilotCarry.order, ids)) this.state.orders.talanta = [...this.pilotCarry.order];
    for (const id of ids) {
      if (this.pilotCarry.hints.includes(id) && !this.state.hints.includes(id)) this.state.hints.push(id);
      const wrong = this.pilotCarry.wrong[id];
      if (Number.isInteger(wrong) && wrong >= 0 && wrong <= 1000) this.state.wrong[id] = wrong;
    }
    this.pilotCarry = null;
  }
  finishReveal(token) {
    if (token !== this.revealToken || !this.busy) return false;
    this.busy = false;
    this.message = this.complete ? 'Η διαδρομή ολοκληρώθηκε' : this.sceneComplete
      ? (this.inHub ? 'Διάλεξε μια νησίδα' : 'Η ενότητα φωτίστηκε') : 'Στο επόμενο σημείο';
    this.kind = 'success'; this.changed(false); return true;
  }
  enter(sceneId) {
    if (!Core.scene(lesson, sceneId) || (sceneId !== 'main' && !this.unlocked)) return false;
    ++this.revealToken; this.busy = false; this.selected = null; this.reviewId = null;
    this.state.view = sceneId;
    this.message = this.inHub && this.unlocked ? 'Διάλεξε μια νησίδα' : 'Επίλεξε · Σύνδεσε'; this.kind = '';
    this.changed(); return true;
  }
  hint() {
    if (this.busy || this.reviewId || !this.current) return;
    if (!this.hasHint(this.current.id)) this.state.hints.push(this.current.id);
    this.message = this.current.hint; this.kind = ''; this.changed();
  }
  review(id) {
    if (this.busy || !this.solved(id)) return;
    this.selected = null; this.reviewId = id; this.message = 'Δες τη σύνδεση'; this.kind = ''; this.changed(false);
  }
  resume() {
    this.reviewId = null; this.selected = null;
    this.message = this.inHub && this.unlocked ? 'Διάλεξε μια νησίδα' : 'Επίλεξε · Σύνδεσε'; this.kind = ''; this.changed(false);
  }
  reset(scope = 'all') {
    ++this.revealToken; this.busy = false; this.selected = null; this.reviewId = null;
    if (scope === 'scene' && !this.inHub) Core.resetScene(lesson, this.state, this.sceneId, this.random);
    else { this.state = Core.create(lesson, null, this.random); this.pilotCarry = null; }
    this.message = 'Επίλεξε · Σύνδεσε'; this.kind = ''; this.changed();
  }
}
