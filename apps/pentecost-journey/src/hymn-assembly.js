import * as THREE from 'three';
import { panel, setText } from '../../../shared/journey/text-panels.js';
import './hymn-assembly.css';

const palette = {
  paper: { background: '#ead9b5', border: '#bd9250', text: '#382a1b' },
  slot: { background: '#1d3c38', border: '#b89557', text: '#ecdfc1' },
  selected: { background: '#526143', border: '#ffe1a0', text: '#fff2ce' },
  placed: { background: '#e8d5a6', border: '#f1ce79', text: '#302517' },
  muted: { background: '#203330', border: '#72664f', text: '#a9a38d' }
};

function shuffle(values) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result.every((value, index) => value === values[index])) result.push(result.shift());
  return result;
}

function validOrder(order, ids) {
  return Array.isArray(order) && order.length === ids.length && new Set(order).size === ids.length &&
    order.every(id => ids.includes(id));
}

function box(parent, geometry, material, x, y, z) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

export class HymnAssembly {
  constructor({ scene, lesson, onChange, refreshInput, isImmersive }) {
    this.rounds = lesson.hymnRounds || [];
    this.fullHymn = lesson.hymn?.text || '';
    this.onChange = onChange;
    this.refreshInput = refreshInput;
    this.isImmersive = isImmersive;
    this.storageKey = lesson.id + '-hymn-assembly.v1';
    this.selected = null;
    this.notice = '';
    this.transition = 0;
    this.active = false;
    this.wasActivated = false;
    this.canSave = true;
    this.state = this.restore();

    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.pickables = [];
    this.pieces = new Map();
    this.slots = [];
    this.poses = new Map();
    this.makeWorld();
    this.installDialog();
    this.sync();
  }

  restore() {
    const ids = this.rounds.map(round => round.phrases.map(phrase => phrase.id));
    let saved;
    try { saved = JSON.parse(localStorage.getItem(this.storageKey)); } catch { this.canSave = false; }
    if (saved?.version !== 1 || !Array.isArray(saved.placed) || !Array.isArray(saved.orders)) {
      return { roundIndex: 0, placed: this.rounds.map(() => []), orders: ids.map(list => shuffle(list)) };
    }
    const placed = this.rounds.map((round, index) => {
      const values = Array.isArray(saved.placed[index]) ? saved.placed[index] : [];
      return round.phrases.map((_, slot) => values[slot] === ids[index][slot] ? values[slot] : null);
    });
    const orders = this.rounds.map((_, index) => validOrder(saved.orders[index], ids[index]) ? saved.orders[index] : shuffle(ids[index]));
    let roundIndex = Number.isInteger(saved.roundIndex) ? Math.max(0, Math.min(this.rounds.length, saved.roundIndex)) : 0;
    while (roundIndex < this.rounds.length && placed[roundIndex].filter(Boolean).length === this.rounds[roundIndex].phrases.length) roundIndex++;
    return { roundIndex, placed, orders };
  }

  get complete() { return this.state.roundIndex >= this.rounds.length; }
  get round() { return this.rounds[this.state.roundIndex] || null; }
  get roundCount() { return this.rounds.length; }
  get placed() { return this.round ? (this.state.placed[this.state.roundIndex] || []) : []; }
  get dialogOpen() { return this.dialog?.open || false; }
  get menuStatus() {
    if (this.complete) return {
      complete: true, title: 'Ολοκλήρωση', progress: `${this.roundCount} / ${this.roundCount}`,
      instruction: 'Ολοκλήρωσες και τους δύο γύρους σύνθεσης του ύμνου.'
    };
    return {
      complete: false, title: `Γύρος ${this.state.roundIndex + 1} / ${this.roundCount}`,
      progress: `${this.placed.filter(Boolean).length} / ${this.round.phrases.length}`,
      instruction: 'Πιάσε τις φράσεις και τοποθέτησέ τες στη σωστή σειρά.'
    };
  }
  get statusText() {
    if (this.complete) return 'Ο ύμνος ολοκληρώθηκε · 2 / 2 γύροι.';
    return `${this.round.title} · Γύρος ${this.state.roundIndex + 1} / ${this.roundCount} · ${this.placed.filter(Boolean).length} / ${this.round.phrases.length} φράσεις.`;
  }

  save() {
    if (!this.canSave) return;
    try { localStorage.setItem(this.storageKey, JSON.stringify({ version: 1, ...this.state })); }
    catch { this.canSave = false; }
  }

  makeWorld() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x604735, roughness: .88 });
    const edge = new THREE.MeshStandardMaterial({ color: 0xb69257, roughness: .68, metalness: .16 });
    const board = new THREE.MeshStandardMaterial({ color: 0x7e6748, roughness: .93 });
    for (const x of [-3.18, 3.18]) {
      box(this.root, new THREE.BoxGeometry(6.22, 2.72, .16), board, x, 1.78, -2.63);
      box(this.root, new THREE.BoxGeometry(6.4, .1, .2), edge, x, 3.18, -2.54);
      box(this.root, new THREE.BoxGeometry(.18, 1.7, .2), wood, x - 2.98, .79, -2.55);
      box(this.root, new THREE.BoxGeometry(.18, 1.7, .2), wood, x + 2.98, .79, -2.55);
      box(this.root, new THREE.BoxGeometry(.16, 2.55, .16), wood, x - 2.35, .42, -2.48);
      box(this.root, new THREE.BoxGeometry(.16, 2.55, .16), wood, x + 2.35, .42, -2.48);
    }

    this.roundHeading = panel('', 5.3, .52, null, { dark: true });
    this.roundHeading.position.set(0, 3.72, -2.44);
    this.root.add(this.roundHeading);
    this.labels = [
      panel('ΧΕΙΡΟΓΡΑΦΟ · Η ΣΕΙΡΑ ΤΟΥ ΥΜΝΟΥ', 5.55, .38, null, { dark: true, small: true }),
      panel('ΦΡΑΣΕΙΣ · ΠΙΑΣΕ ΚΑΙ ΜΕΤΑΦΕΡΕ', 5.55, .38, null, { dark: true, small: true })
    ];
    this.labels[0].position.set(-3.18, 3.28, -2.42);
    this.labels[1].position.set(3.18, 3.28, -2.42);
    this.labels.forEach(label => this.root.add(label));

    const rowY = [2.53, 1.77, 1.01], cardWidth = 5.63, cardHeight = .63;
    this.slots = rowY.map((y, index) => {
      const slot = panel(`${index + 1} · Τοποθέτησε τη φράση`, cardWidth, cardHeight,
        { type: 'phrase-slot', slot: index }, { palette: palette.slot });
      slot.position.set(-3.18, y, -2.505);
      slot.userData.slotIndex = index;
      this.root.add(slot);
      this.pickables.push(slot);
      return slot;
    });

    for (const round of this.rounds) {
      round.phrases.forEach((phrase, index) => {
        const piece = panel(phrase.text, cardWidth, cardHeight,
          { type: 'phrase-piece', id: phrase.id }, { palette: palette.paper });
        piece.visible = false;
        piece.userData.phraseId = phrase.id;
        piece.userData.roundId = round.id;
        piece.userData.home = new THREE.Vector3(3.18, rowY[index], -2.47);
        this.root.add(piece);
        this.pieces.set(phrase.id, piece);
        this.pickables.push(piece);
      });
    }

    this.completedPanel = panel('Ο ύμνος συντέθηκε', 4.9, .68, null, { palette: palette.placed });
    this.completedPanel.position.set(0, .7, -2.38);
    this.completedPanel.visible = false;
    this.root.add(this.completedPanel);
  }

  installDialog() {
    this.dialog = document.getElementById('hymn-dialog');
    document.getElementById('hymn-full-text').textContent = this.fullHymn;
    this.dialog.addEventListener('close', () => { this.refreshInput?.(); });
    document.getElementById('hymn-close').addEventListener('click', () => this.dialog.close());
    document.getElementById('hymn-hint').addEventListener('click', () => {
      this.notice = this.hint();
      this.renderDialog();
    });
    document.getElementById('hymn-reset').addEventListener('click', () => this.resetRound());
    this.dialog.addEventListener('click', event => {
      const piece = event.target.closest('[data-phrase-piece]');
      const slot = event.target.closest('[data-phrase-slot]');
      if (piece && !piece.disabled) {
        this.selected = piece.dataset.phrasePiece;
        this.notice = 'Διάλεξε τη θέση όπου συνεχίζεται ο ύμνος.';
        this.renderDialog();
      } else if (slot && !slot.disabled && this.selected) {
        this.place(this.selected, Number(slot.dataset.phraseSlot));
      }
    });
    this.dialog.addEventListener('dragstart', event => {
      const piece = event.target.closest('[data-phrase-piece]');
      if (!piece || piece.disabled) return;
      event.dataTransfer.setData('text/plain', piece.dataset.phrasePiece);
      event.dataTransfer.effectAllowed = 'move';
    });
    this.dialog.addEventListener('dragover', event => {
      const slot = event.target.closest('[data-phrase-slot]');
      if (slot && !slot.disabled) event.preventDefault();
    });
    this.dialog.addEventListener('drop', event => {
      const slot = event.target.closest('[data-phrase-slot]');
      if (!slot || slot.disabled) return;
      const id = event.dataTransfer.getData('text/plain');
      if (id) { event.preventDefault(); this.place(id, Number(slot.dataset.phraseSlot)); }
    });
    this.installPointerDrag();
    this.renderDialog();
  }

  installPointerDrag() {
    let drag = null;
    this.dialog.addEventListener('pointerdown', event => {
      const source = event.target.closest('[data-phrase-piece]:not(:disabled)');
      if (!source || !event.isPrimary || event.button !== 0) return;
      drag = { source, pointerId: event.pointerId, x: event.clientX, y: event.clientY, ghost: null };
    });
    this.dialog.addEventListener('pointermove', event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (!drag.ghost && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) >= 8) {
        drag.ghost = drag.source.cloneNode(true);
        drag.ghost.classList.add('hymn-drag-ghost');
        drag.ghost.setAttribute('aria-hidden', 'true');
        drag.ghost.removeAttribute('data-phrase-piece');
        drag.ghost.style.width = drag.source.getBoundingClientRect().width + 'px';
        this.dialog.append(drag.ghost);
        drag.source.setPointerCapture(event.pointerId);
      }
      if (drag.ghost) {
        drag.ghost.style.left = event.clientX + 'px';
        drag.ghost.style.top = event.clientY + 'px';
      }
    });
    this.dialog.addEventListener('pointerup', event => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const current = drag;
      drag = null;
      if (!current.ghost) return;
      current.ghost.remove();
      const slot = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-phrase-slot]:not(:disabled)');
      if (slot) this.place(current.source.dataset.phrasePiece, Number(slot.dataset.phraseSlot));
    });
    const cancel = () => { drag?.ghost?.remove(); drag = null; };
    for (const name of ['pointercancel', 'lostpointercapture', 'close']) this.dialog.addEventListener(name, cancel);
  }

  activate(active, immersive = false) {
    this.active = active;
    this.root.visible = active;
    this.syncScene();
    if (active && !this.wasActivated) {
      this.wasActivated = true;
      if (!immersive && !this.complete) this.openDialog();
    }
  }

  openDialog() {
    if (!this.dialog.open && !this.isImmersive?.()) this.dialog.showModal();
    this.renderDialog();
    this.refreshInput?.();
  }

  closeDialog() {
    if (this.dialog.open) this.dialog.close();
  }

  get sources() {
    if (!this.round) return [];
    return this.round.phrases.map(phrase => this.pieces.get(phrase.id)).filter(piece => piece.visible && !piece.userData.placed);
  }

  get targets() {
    return this.complete ? [] : this.slots.filter((slot, index) => !this.placed[index]);
  }

  get currentOrder() {
    return this.complete ? [] : this.state.orders[this.state.roundIndex];
  }

  getSlotPosition(index) {
    return this.slots[index]?.position;
  }

  select(id) {
    if (!this.active || this.complete || !this.sources.some(piece => piece.userData.phraseId === id)) return false;
    this.selected = id;
    this.notice = 'Διάλεξε τη θέση όπου συνεχίζεται ο ύμνος.';
    this.syncScene();
    this.renderDialog();
    return true;
  }

  placeSelected(slot) {
    if (!this.selected) {
      this.notice = 'Πιάσε πρώτα μία φράση από τον δίσκο.';
      this.renderDialog();
      return false;
    }
    const id = this.selected;
    const placed = this.place(id, slot);
    this.selected = null;
    return placed;
  }

  place(id, slotIndex) {
    if (!this.active || this.complete || this.transition || !Number.isInteger(slotIndex) ||
        slotIndex < 0 || slotIndex >= this.round.phrases.length || this.placed[slotIndex]) return false;
    const phrase = this.round.phrases.find(item => item.id === id);
    if (!phrase || this.placed.includes(id)) return false;
    if (this.round.phrases[slotIndex].id !== id) {
      this.notice = 'Η φράση δεν συνεχίζει ακόμη το χειρόγραφο. Δοκίμασε άλλη θέση.';
      this.syncScene();
      this.renderDialog();
      this.onChange?.('wrong');
      return false;
    }
    this.state.placed[this.state.roundIndex][slotIndex] = id;
    this.pieces.get(id).userData.placed = true;
    this.selected = null;
    this.notice = 'Η φράση μπήκε στη θέση της.';
    const done = this.placed.filter(Boolean).length === this.round.phrases.length;
    if (done) {
      this.transition = 1.15;
      this.notice = this.state.roundIndex + 1 < this.roundCount ? 'Ο γύρος ολοκληρώθηκε. Ετοιμάζεται η συνέχεια…' : 'Και οι δύο γύροι ολοκληρώθηκαν.';
    }
    this.save();
    this.syncScene();
    this.renderDialog();
    this.onChange?.(done ? 'round-complete' : 'placed');
    return true;
  }

  hint() {
    if (this.complete) return 'Ο ύμνος έχει συντεθεί ολόκληρος.';
    const slot = this.placed.findIndex(value => !value);
    const value = this.round.hints?.[slot];
    return typeof value === 'string' ? value : 'Αναζήτησε τη φράση που ακολουθεί στη σειρά του ύμνου.';
  }

  resetRound() {
    if (this.complete) return;
    this.state.placed[this.state.roundIndex] = [];
    this.state.orders[this.state.roundIndex] = shuffle(this.round.phrases.map(phrase => phrase.id));
    this.selected = null;
    this.transition = 0;
    this.notice = 'Ο γύρος ανακατεύτηκε.';
    this.save();
    this.syncScene();
    this.renderDialog();
    this.onChange?.('reset');
  }

  reset() {
    this.state = { roundIndex: 0, placed: this.rounds.map(() => []), orders: this.rounds.map(round => shuffle(round.phrases.map(phrase => phrase.id))) };
    this.selected = null;
    this.transition = 0;
    this.notice = '';
    this.wasActivated = false;
    this.save();
    this.syncScene();
    this.renderDialog();
  }

  syncScene() {
    const round = this.round;
    this.completedPanel.visible = this.complete;
    if (this.complete) {
      this.roundHeading.visible = false;
      this.labels.forEach(label => { label.visible = false; });
      this.slots.forEach(slot => { slot.visible = false; });
      this.pieces.forEach(piece => { piece.visible = false; });
      this.pickables.forEach(item => { item.userData.disabled = true; });
      return;
    }
    this.roundHeading.visible = true;
    this.labels.forEach(label => { label.visible = true; });
    setText(this.roundHeading, `${round.title} · ${this.state.roundIndex + 1} / ${this.roundCount}`, { dark: true });
    const currentIds = new Set(round.phrases.map(phrase => phrase.id));
    for (const [id, piece] of this.pieces) {
      const index = round.phrases.findIndex(phrase => phrase.id === id);
      const isCurrent = currentIds.has(id);
      const placed = isCurrent && this.placed[index] === id;
      piece.visible = isCurrent;
      piece.userData.disabled = !isCurrent || placed || this.transition > 0;
      piece.userData.dropDisabled = piece.userData.disabled;
      piece.userData.placed = placed;
      if (isCurrent) {
        const homeIndex = this.currentOrder.indexOf(id);
        const homeRow = homeIndex < 0 ? index : homeIndex;
        const home = new THREE.Vector3(3.18, [2.53, 1.77, 1.01][homeRow], -2.47);
        const target = placed ? this.slots[index].position.clone().setZ(-2.455) : home;
        piece.userData.goal = target;
        piece.userData.home = home;
        if (this.selected === id) setText(piece, round.phrases[index].text, { palette: palette.selected });
        else if (piece.userData.label !== round.phrases[index].text) setText(piece, round.phrases[index].text, { palette: palette.paper });
        piece.userData.label = round.phrases[index].text;
        if (!piece.userData.carried) piece.position.copy(target);
      }
    }
    this.slots.forEach((slot, index) => {
      const phrase = this.placed[index] && round.phrases[index];
      slot.visible = !phrase;
      slot.userData.disabled = Boolean(phrase) || this.transition > 0;
      slot.userData.dropDisabled = slot.userData.disabled;
      if (!phrase) {
        const label = `${index + 1} · Τοποθέτησε τη φράση`;
        if (slot.userData.label !== label) setText(slot, label, { palette: this.selected ? palette.selected : palette.slot });
        slot.userData.label = label;
      }
    });
    this.pickables.forEach(item => {
      if (item.userData.action?.type === 'phrase-piece') item.userData.disabled = !item.visible || item.userData.placed || this.transition > 0;
      else if (item.userData.action?.type === 'phrase-slot') item.userData.disabled = !item.visible || this.transition > 0;
    });
    this.roundHeading.userData.label = `${round.title} · ${this.state.roundIndex + 1} / ${this.roundCount}`;
    for (const slot of this.slots) slot.updateMatrixWorld(true);
  }

  sync() {
    this.syncScene();
    this.renderDialog();
  }

  renderDialog() {
    if (!this.dialog) return;
    const title = document.getElementById('hymn-dialog-title');
    const hint = document.getElementById('hymn-hint'), reset = document.getElementById('hymn-reset');
    const slotsRoot = document.getElementById('hymn-slots'), piecesRoot = document.getElementById('hymn-pieces');
    const finished = document.getElementById('hymn-finished');
    if (this.complete) {
      title.textContent = 'Ο ύμνος συντέθηκε';
      document.getElementById('hymn-instruction').textContent = 'Ολοκλήρωσες και τους δύο γύρους της σύνθεσης.';
      document.getElementById('hymn-progress').textContent = '2 / 2';
      slotsRoot.replaceChildren(); piecesRoot.replaceChildren();
      finished.hidden = false;
      document.getElementById('hymn-full-text').textContent = document.getElementById('hymn-full-text').textContent || '';
      hint.hidden = true; reset.hidden = true;
      return;
    }
    slotsRoot.replaceChildren();
    piecesRoot.replaceChildren();
    title.textContent = this.round.title;
    document.getElementById('hymn-instruction').textContent = 'Γύρος ' + (this.state.roundIndex + 1) + ' από ' + this.roundCount + ' · Μετέφερε κάθε φράση στη σωστή θέση του χειρογράφου.';
    const count = this.placed.filter(Boolean).length;
    document.getElementById('hymn-progress').textContent = `${count} / ${this.round.phrases.length}`;
    finished.hidden = true;
    hint.hidden = false; reset.hidden = false;
    const slots = this.round.phrases.map((phrase, index) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'hymn-slot-button'; button.dataset.phraseSlot = String(index);
      button.disabled = Boolean(this.placed[index]) || this.transition > 0;
      button.textContent = this.placed[index] ? phrase.text : `Θέση ${index + 1} · Άφησε εδώ τη φράση`;
      button.setAttribute('aria-label', this.placed[index] ? `Θέση ${index + 1}: ${phrase.text}` : `Κενή θέση ${index + 1}`);
      slotsRoot.append(button);
      return button;
    });
    const placedIds = new Set(this.placed.filter(Boolean));
    for (const id of this.currentOrder) {
      if (placedIds.has(id)) continue;
      const phrase = this.round.phrases.find(item => item.id === id);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'hymn-piece-button'; button.dataset.phrasePiece = id;
      button.draggable = true; button.textContent = phrase.text;
      button.setAttribute('aria-pressed', String(this.selected === id));
      piecesRoot.append(button);
    }
    document.getElementById('hymn-notice').textContent = this.notice;
    for (const slot of slots) slot.classList.toggle('selected-target', Boolean(this.selected));
  }

  update(dt) {
    if (this.transition > 0) {
      this.transition = Math.max(0, this.transition - dt);
      if (!this.transition) {
        this.state.roundIndex = Math.min(this.roundCount, this.state.roundIndex + 1);
        this.selected = null;
        this.notice = this.complete ? 'Ο ύμνος ολοκληρώθηκε.' : 'Ξεκίνησε ο επόμενος γύρος.';
        this.save();
        this.sync();
        this.onChange?.(this.complete ? 'complete' : 'next-round');
      }
    }
    for (const [id, piece] of this.pieces) {
      if (!piece.visible || piece.userData.carried || !piece.userData.goal) continue;
      piece.position.lerp(piece.userData.goal, 1 - Math.exp(-15 * dt));
    }
  }
}
