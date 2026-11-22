import { ids, tiles } from './content.js';

const storageKey = 'christos-gennatai-webxr.v1';
const starterChoices = ['welcome', 'uplift', 'birth'];

function shuffle(values) {
  const order = [...values];
  for (let index = order.length - 1; index > 0; index--) {
    const choice = Math.floor(Math.random() * (index + 1));
    [order[index], order[choice]] = [order[choice], order[index]];
  }
  if (order.length > 1 && order.every((value, index) => value === values[index])) order.push(order.shift());
  return order;
}

function validSet(values, allowed) {
  return Array.isArray(values) ? [...new Set(values.filter(value => allowed.includes(value)))] : [];
}

function fresh() {
  return {
    stage: 'gate', tray: shuffle(tiles), placed: [], meaning: [],
    choices: [...starterChoices], hymn: [], evidence: [], reflection: ''
  };
}

function restore(saved) {
  const state = fresh();
  if (saved?.version !== 1) return state;
  if (validSet(saved.tray, tiles).length === tiles.length && saved.tray.length === tiles.length) state.tray = saved.tray;
  state.placed = validSet(saved.placed, tiles);
  if (state.placed.length === tiles.length) {
    state.meaning = validSet(saved.meaning, ids);
    if (saved.stage === 'meaning' || saved.stage === 'hymn') state.stage = 'meaning';
  }
  if (state.meaning.length === ids.length) {
    if (Array.isArray(saved.choices) && saved.choices.length === ids.length && saved.choices.every(id => ids.includes(id))) state.choices = saved.choices;
    state.hymn = validSet(saved.hymn, ids);
    state.hymn.forEach(id => { state.choices[ids.indexOf(id)] = id; });
    state.evidence = validSet(saved.evidence, ids);
    state.reflection = typeof saved.reflection === 'string' ? saved.reflection.slice(0, 3000) : '';
    if (saved.stage === 'hymn') state.stage = 'hymn';
  }
  return state;
}

export class ChristmasSession {
  constructor(storage) {
    this.storage = storage;
    this.canSave = Boolean(storage);
    let saved;
    try {
      saved = JSON.parse(storage?.getItem(storageKey) || 'null');
    } catch {
      // The lesson can start from a fresh board or run entirely in memory.
    }
    this.state = restore(saved);
    this.save();
  }

  save() {
    if (!this.canSave) return;
    try {
      this.storage.setItem(storageKey, JSON.stringify({ ...this.state, version: 1 }));
    } catch {
      this.canSave = false;
    }
  }

  get gateOpen() { return this.state.placed.length === tiles.length; }
  get hymnOpen() { return this.state.meaning.length === ids.length; }
  get complete() { return this.state.hymn.length === ids.length; }

  travel(stage) {
    if (stage !== 'gate' && !(stage === 'meaning' && this.gateOpen) && !(stage === 'hymn' && this.hymnOpen)) return false;
    this.state.stage = stage;
    this.save();
    return true;
  }

  placeTile(tile, slot) {
    if (!tiles.includes(tile) || !tiles.includes(slot) || this.state.placed.includes(tile) || this.state.placed.includes(slot)) return 'unavailable';
    if (tile !== slot) return 'miss';
    this.state.placed.push(tile);
    this.save();
    return 'matched';
  }

  shuffleTray() {
    const remaining = shuffle(this.state.tray.filter(tile => !this.state.placed.includes(tile)));
    this.state.tray = this.state.tray.map(tile => this.state.placed.includes(tile) ? tile : remaining.shift());
    this.save();
  }

  matchMeaning(card, target) {
    if (!this.gateOpen || !ids.includes(card) || !ids.includes(target) || this.state.meaning.includes(target)) return 'unavailable';
    if (card !== target) return 'miss';
    this.state.meaning.push(target);
    this.save();
    return 'matched';
  }

  choosePhrase(slot, phrase) {
    if (!this.hymnOpen || !ids.includes(slot) || !ids.includes(phrase) || this.state.hymn.includes(slot)) return;
    this.state.choices[ids.indexOf(slot)] = phrase;
    this.save();
  }

  checkHymn() {
    const matched = [];
    const remaining = [];
    if (!this.hymnOpen) return { matched, remaining };
    ids.forEach((id, index) => {
      if (this.state.hymn.includes(id)) return;
      if (this.state.choices[index] === id) matched.push(id);
      else remaining.push(id);
    });
    this.state.hymn.push(...matched);
    this.save();
    return { matched, remaining };
  }

  saveEvidence(values) {
    if (!this.hymnOpen) return;
    this.state.evidence = validSet([...this.state.evidence, ...values], ids);
    this.save();
  }

  reflect(value) {
    if (!this.hymnOpen) return;
    this.state.reflection = value.slice(0, 3000);
    this.save();
  }

  resetHymn() {
    this.state.choices = ['uplift', 'birth', 'welcome'];
    this.state.hymn = [];
    this.save();
  }

  resetAll() {
    this.state = fresh();
    this.save();
  }
}
