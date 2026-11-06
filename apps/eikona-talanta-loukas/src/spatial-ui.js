import * as THREE from 'three';
import { revealProgress } from './animation-timing.js';
import { lesson } from './session.js';

function panelTexture(text, { dark = false, selected = false, solved = false, small = false, square = false, paragraph = false, aspect = 3 } = {}) {
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = square ? 768 : Math.round(768 / aspect);
  const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  ctx.fillStyle = dark ? '#244d41' : solved ? '#d8debd' : '#f7e8c9';
  ctx.beginPath();
  if (square) ctx.arc(w / 2, h / 2, w / 2 - 12, 0, Math.PI * 2); else ctx.roundRect(6, 6, w - 12, h - 12, 32);
  ctx.fill();
  ctx.strokeStyle = selected ? '#ffdf8c' : dark ? '#ccaf70' : '#c6a265'; ctx.lineWidth = selected ? 13 : 5; ctx.stroke();
  ctx.fillStyle = dark ? '#f7edcf' : '#274237';
  const fontSize = paragraph ? 34 : square ? 280 : Math.round(h * (small ? 0.30 : 0.27));
  ctx.font = `${selected ? 650 : 550} ${fontSize}px system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const words = text.split(' '), lines = []; let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > w - 74) { lines.push(line); line = word; } else line = next;
  }
  lines.push(line);
  lines.forEach((value, i) => ctx.fillText(value, w / 2, h / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.25));
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4; return texture;
}
export function setText(mesh, text, options) {
  mesh.material.map?.dispose(); mesh.material.map = panelTexture(text, { ...options, aspect: mesh.userData.panelAspect }); mesh.material.needsUpdate = true;
}
export function panel(text, width, height, action, options = {}) {
  const result = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: panelTexture(text, { ...options, aspect: width / height }), transparent: true, side: THREE.DoubleSide, toneMapped: false }));
  result.userData.panelAspect = width / height;
  if (action) result.userData.action = action;
  return result;
}

export class SpatialUI {
  constructor(scene, world, session, onAction) {
    this.scene = scene; this.world = world; this.session = session; this.onAction = onAction;
    this.targets = new Map(); this.labels = new Map(); this.beams = new Map(); this.flashes = new Map();
    this.pickables = []; this.resetConfirm = false;
    for (const station of world.stations) {
      const data = session.sceneData.stations.find(s => s.id === station.id);
      const group = new THREE.Group(); group.position.set(station.position[0], 1.35, station.position[1] + 1.45); scene.add(group);
      const target = panel(String(station.number).padStart(2, '0'), 0.48, 0.48, { type: 'target', id: station.id }, { dark: true, square: true }); group.add(target);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.34, 0.42, 12), new THREE.MeshStandardMaterial({ color: 0xc9aa73, roughness: 0.9 }));
      base.position.set(station.position[0], 0.21, station.position[1] + 1.45); scene.add(base);
      const labelGroup = new THREE.Group(); labelGroup.position.set(station.position[0], station.height + 0.43, station.position[1]); scene.add(labelGroup);
      const label = panel(data.prompt, 3.12, 0.64, null, { dark: true }); labelGroup.add(label);
      this.labels.set(station.id, { group: labelGroup, mesh: label });
      this.targets.set(station.id, { group, mesh: target, number: station.number }); this.pickables.push(target);
      const rootZ = world.kind === 'hub' ? 7.5 : 0.65;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0.21, rootZ),
        new THREE.Vector3(station.position[0] * 0.38, 0.27, rootZ + (station.position[1] - rootZ) * 0.35),
        new THREE.Vector3(station.position[0] * 0.8, 0.3, rootZ + (station.position[1] - rootZ) * 0.8),
        new THREE.Vector3(station.position[0], 0.35, station.position[1] + 1.45),
      ]);
      const beam = new THREE.Mesh(new THREE.TubeGeometry(curve, 50, 0.024, 6, false), new THREE.MeshBasicMaterial({ color: 0xffd778, transparent: true, opacity: 0.9, toneMapped: false }));
      const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 50, 0.085, 6, false), new THREE.MeshBasicMaterial({ color: 0xffcc55, transparent: true, opacity: 0.13, depthWrite: false, toneMapped: false }));
      const bead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffefbb, toneMapped: false }));
      scene.add(beam, halo, bead); this.beams.set(station.id, { beam, halo, bead, curve });
    }
    this.rack = new THREE.Group(); scene.add(this.rack);
    this.cards = new Map();
    for (const [i, data] of session.choices.entries()) {
      const card = panel(data.word, 1.1, 0.38, { type: 'word', id: data.id });
      this.positionCard(card, i); this.rack.add(card); this.cards.set(data.id, card); this.pickables.push(card);
    }
    this.hint = panel('Υπόδειξη', 1.05, 0.34, { type: 'hint' }, { dark: true, small: true }); this.hint.position.set(-1.3, -0.51, 0);
    this.resume = panel('Συνέχεια', 1.05, 0.34, { type: 'resume' }, { dark: true, small: true }); this.resume.position.set(0, -0.51, 0);
    this.reset = panel('Νέα αρχή', 1.05, 0.34, { type: 'request-reset' }, { dark: true, small: true }); this.reset.position.set(1.3, -0.51, 0);
    this.back = panel('Στον χάρτη', 1.05, 0.34, { type: 'hub' }, { dark: true, small: true }); this.back.position.set(0, -0.51, 0);
    this.hintText = panel('', 3.0, 0.42, null, { dark: true }); this.hintText.position.set(0, 0.55, 0);
    if (world.kind === 'hub') {
      for (const control of [this.hint, this.resume, this.reset, this.back]) control.position.y = -0.68;
      this.hintText.position.y = 0.83;
    }
    this.confirmTitle = panel('Νέα αρχή;', 2, 0.45, null, { dark: true }); this.confirmTitle.position.set(0, 0.55, 0);
    this.confirmYes = panel('Επαναφορά', 1.3, 0.45, { type: 'confirm-reset' }); this.confirmYes.position.set(0.75, 0, 0);
    this.confirmNo = panel('Ακύρωση', 1.3, 0.45, { type: 'cancel-reset' }); this.confirmNo.position.set(-0.75, 0, 0);
    this.rack.add(this.hint, this.resume, this.reset, this.back, this.hintText, this.confirmTitle, this.confirmYes, this.confirmNo);
    this.finalPanel = panel('16 / 16 · ' + lesson.finalQuestion, 3.8, 2.25, null, { dark: true, paragraph: true });
    this.finalPanel.position.set(0, 2.05, -0.3); this.rack.add(this.finalPanel);
    this.pickables.push(this.hint, this.resume, this.reset, this.back, this.confirmYes, this.confirmNo);
    this.refresh();
  }
  positionCard(card, index) {
    if (this.world.kind === 'hub') card.position.set((index % 2 - 0.5) * 1.68, 0.26 - Math.floor(index / 2) * 0.48, 0);
    else card.position.set((index - 1) * 1.19, 0, 0);
  }
  refresh() {
    const session = this.session;
    this.finalPanel.visible = session.complete && !this.resetConfirm && !session.reviewId;
    const station = this.world.stations.find(s => s.id === session.visibleStation.id);
    this.rack.position.set(station.position[0], this.world.kind === 'hub' ? 1.1 : 0.95, station.position[1] + (this.world.kind === 'hub' ? 1.4 : 2.0));
    for (const [id, target] of this.targets) {
      const solved = session.solved(id), active = session.current?.id === id;
      setText(target.mesh, session.inHub && session.unlocked ? '↗' : solved ? '✓' : String(target.number).padStart(2, '0'), { dark: true, selected: active || session.reviewId === id, solved, square: true });
      target.mesh.material.opacity = active || solved ? 1 : 0.55;
      target.mesh.userData.disabled = session.busy;
      const data = session.sceneData.stations.find(s => s.id === id);
      const caption = session.inHub && session.unlocked ? data.word + ' · ' + session.groupProgress(id) + '/3' : solved ? data.word : data.prompt;
      setText(this.labels.get(id).mesh, caption, { dark: true, selected: session.reviewId === id });
      this.labels.get(id).mesh.material.opacity = active || solved ? 0.98 : 0.62;
      const b = this.beams.get(id); b.beam.visible = b.halo.visible = solved; b.bead.visible = false;
    }
    session.choices.forEach((data, index) => {
      const card = this.cards.get(data.id);
      this.positionCard(card, index);
      card.visible = !this.resetConfirm;
      const caption = session.inHub && session.unlocked ? data.word + ' · ' + session.groupProgress(data.id) + '/3' : (session.solved(data.id) ? '✓ ' : '') + data.word;
      setText(card, caption, { selected: session.selected === data.id || session.reviewId === data.id, solved: session.solved(data.id) });
      card.userData.disabled = session.busy;
    });
    this.hint.visible = !this.resetConfirm && !session.sceneComplete && !session.reviewId;
    this.resume.visible = !this.resetConfirm && Boolean(session.reviewId) && !session.sceneComplete;
    this.back.visible = !this.resetConfirm && !session.inHub;
    this.back.position.x = this.resume.visible ? -1.3 : 0;
    this.reset.visible = !this.resetConfirm;
    this.hintText.visible = !this.resetConfirm && ((session.sceneComplete && !session.reviewId) || (!session.reviewId && session.hasHint()));
    if (this.hintText.visible) setText(this.hintText, session.sceneComplete ? (session.inHub ? 'Διάλεξε μια νησίδα' : 'Ολοκληρώθηκε · 3/3') : session.visibleStation.hint, { dark: true });
    setText(this.reset, session.inHub ? 'Νέα αρχή' : 'Επαναφορά', { dark: true, small: true });
    for (const object of [this.confirmTitle, this.confirmYes, this.confirmNo]) object.visible = this.resetConfirm;
  }
  setResetConfirm(value) { this.resetConfirm = value; this.refresh(); }
  flash(id, timeMs) { this.flashes.set(id, timeMs); }
  update(timeMs, cameraPosition, reduced) {
    this.rack.lookAt(cameraPosition.x, this.rack.position.y, cameraPosition.z);
    for (const [id, target] of this.targets) {
      target.group.lookAt(cameraPosition.x, target.group.position.y, cameraPosition.z);
      this.labels.get(id).group.lookAt(cameraPosition.x, this.labels.get(id).group.position.y, cameraPosition.z);
      const active = this.session.current?.id === id;
      target.mesh.scale.setScalar(!reduced && active ? 1 + Math.sin(timeMs * 0.003) * 0.035 : 1);
      const beam = this.beams.get(id), start = this.flashes.get(id);
      if (start !== undefined && this.session.solved(id)) {
        const p = reduced ? 1 : revealProgress(timeMs, start);
        beam.bead.visible = p < 1;
        if (p < 1) beam.bead.position.copy(beam.curve.getPoint(p)); else this.flashes.delete(id);
      }
    }
  }
}
