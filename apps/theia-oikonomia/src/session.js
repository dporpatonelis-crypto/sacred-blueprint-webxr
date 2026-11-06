import source from './data/source-lesson.json' with { type: 'json' };
import JourneyCore from '#journey-core';

export const Core = JourneyCore;
export const lesson = { ...source, id: source.id + '-webxr' };
export const SAVE_KEY = lesson.id + '.v' + lesson.contentVersion;

export class LessonSession {
  constructor(storage = null, random = Math.random) {
    this.storage = storage; this.random = random; this.canStore = Boolean(storage);
    let raw = null, saved = null;
    try { raw = storage?.getItem(SAVE_KEY) ?? null; } catch { this.canStore = false; }
    try { saved = JSON.parse(raw || 'null'); } catch { /* Invalid saves start clean. */ }
    this.state = Core.create(lesson, saved, random);
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
  groupSize(id) { const group = this.groupFor(id); return group ? Core.scene(lesson, group.sceneId).stations.length : 0; }
  changed(persist = true) {
    if (persist && this.canStore) {
      try { this.storage.setItem(SAVE_KEY, JSON.stringify(this.state)); }
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
      result.scenarioCompleted = this.complete;
    }
    this.changed(); return result;
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
    else { this.state = Core.create(lesson, null, this.random); }
    this.message = 'Επίλεξε · Σύνδεσε'; this.kind = ''; this.changed();
  }
}
