import * as THREE from 'three';
import content from './data/talanta-hymn.json' with { type: 'json' };
import { panel, setText } from '../../../shared/journey/text-panels.js';

export const hymnContent = content;
export const hymnEntry = id => content.entries.find(entry => entry.stationId === id);
const CW = 1024, CH = 924, BW = 2.05, BH = BW * CH / CW, FONT = 'Georgia, "Times New Roman", serif';
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const ink = 0x50381f, gold = 0xffde96;

function texture(canvas) { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function wrapped(ctx, text, width) {
  const lines = []; let line = '';
  for (const token of text.split(/\s+/u)) {
    const next = line ? line + ' ' + token : token;
    if (line && ctx.measureText(next).width > width) { lines.push(line); line = token; } else line = next;
  }
  if (line) lines.push(line); return lines;
}
function glyph(text) {
  const canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
  ctx.font = `64px ${FONT}`; const metrics = ctx.measureText(text), ascent = Math.ceil(metrics.actualBoundingBoxAscent || 58), descent = Math.ceil(metrics.actualBoundingBoxDescent || 17), pad = 9;
  canvas.width = Math.ceil(metrics.width) + pad * 2; canvas.height = ascent + descent + pad * 2;
  ctx.font = `64px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText(text, pad, pad + ascent);
  return { texture: texture(canvas), geometry: new THREE.PlaneGeometry(canvas.width / canvas.height, 1), width: canvas.width, height: canvas.height, ascent, pad };
}
function invisibleHit(rect, action) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rect.w / CW * BW, rect.h / CH * BH), new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
  mesh.position.set((rect.x + rect.w / 2 - CW / 2) / CW * BW, (CH / 2 - rect.y - rect.h / 2) / CH * BH, .028);
  mesh.userData.action = action; return mesh;
}

/** World-space manuscript, exact glyph origins, one beam and two words per station. */
export class TalantaHymn {
  constructor(scene, world, session, actors, approaches, onFinished) {
    this.world = world; this.session = session; this.actors = actors; this.onFinished = onFinished;
    this.root = new THREE.Group(); scene.add(this.root); this.root.name = 'talanta-hymn';
    this.pickables = []; this.books = []; this.words = new Map(); this.beams = new Map(); this.glyphs = new Map(); this.pages = new Map();
    this.page = -1; this.active = null; this.signature = ''; this.lastInterpretation = ''; this.resetConfirm = false;
    for (const entry of content.entries) for (const word of entry.keywords) this.glyphs.set(word, glyph(word));
    this.layout = this.makePage(-1).layout;
    this.makeBook('entry', [0, 1.55, 5.75]);
    world.stations.forEach((station, index) => {
      const q = approaches[index]?.quizPosition || station.position;
      const offset = [[-1.1, .65], [.4, -1.4], [1.65, -.6]][index];
      const book = this.makeBook(station.id, [q[0] + offset[0], 1.55, q[1] + offset[1]]);
      this.makeWords(station); this.makeBeam(station, book);
    });
    this.interpretation = panel('', 3.4, .8, null, { dark: true, paragraph: true }); this.interpretation.visible = false; this.root.add(this.interpretation);
    this.sync();
  }
  get reading() { return this.page >= 0; }
  get revealing() { return Boolean(this.active); }
  get interpretationText() { return !this.reading && this.active && this.active.elapsed >= (this.active.reduced ? 0 : 800) ? hymnEntry(this.active.id).interpretation : ''; }
  makePage(page) {
    const solved = content.entries.map(e => Number(this.session.solved(e.stationId))).join('');
    const key = `${page}:${this.session.selected || this.session.reviewId || ''}:${solved}:${this.session.complete}`;
    if (this.pages.has(key)) return this.pages.get(key);
    const canvas = document.createElement('canvas'); canvas.width = CW; canvas.height = CH;
    const ctx = canvas.getContext('2d');
    const wash = ctx.createLinearGradient(0, 0, CW, CH); wash.addColorStop(0, '#f9edcb'); wash.addColorStop(.5, '#edce94'); wash.addColorStop(1, '#f5e2b9');
    ctx.fillStyle = wash; ctx.fillRect(0, 0, CW, CH); ctx.strokeStyle = '#9a6c2e'; ctx.lineWidth = 3; ctx.strokeRect(22, 22, CW - 44, CH - 44);
    ctx.strokeStyle = '#b9904c'; ctx.lineWidth = 1; ctx.strokeRect(32, 32, CW - 64, CH - 64);
    ctx.textAlign = 'center'; ctx.fillStyle = '#846232'; ctx.font = '17px system-ui'; ctx.fillText('ΥΜΝΟΣ ΤΗΣ ΜΕΓΑΛΗΣ ΤΡΙΤΗΣ', CW / 2, 66);
    ctx.fillStyle = '#51391f'; ctx.font = `38px ${FONT}`; ctx.fillText(content.title, CW / 2, 113);
    const layout = new Map(), hits = [];
    const button = (text, rect, action) => {
      ctx.fillStyle = '#f9edce'; ctx.strokeStyle = '#a9813f'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#533a20'; ctx.textAlign = 'center'; ctx.font = '23px system-ui'; ctx.fillText(text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 8); hits.push({ rect, action });
    };
    if (page < 0) {
      ctx.font = '19px system-ui'; ctx.fillStyle = '#7d5d31'; ctx.fillText('Επίλεξε στίχους · σύνδεσε με τον σταθμό', CW / 2, 149);
      content.entries.forEach((entry, index) => {
        const rect = { x: 54, y: 180 + index * 197, w: 916, h: 175 }, selected = this.session.selected === entry.stationId || this.session.reviewId === entry.stationId, done = this.session.solved(entry.stationId);
        ctx.fillStyle = selected ? '#f1cf83' : done ? '#d9dfb8' : '#f9edce'; ctx.strokeStyle = selected ? '#9a641d' : '#b18c4f'; ctx.lineWidth = selected ? 4 : 1.5;
        ctx.beginPath(); ctx.roundRect(rect.x, rect.y, rect.w, rect.h, 12); ctx.fill(); ctx.stroke();
        ctx.textAlign = 'left'; ctx.font = '16px system-ui'; ctx.fillStyle = '#806331'; ctx.fillText((done ? '✓ ' : '') + 'ΧΩΡΙΟ ' + (index + 1) + (entry.note ? ' · ΠΡΟΣΩΠΙΚΗ ΕΦΑΡΜΟΓΗ' : ''), rect.x + 23, rect.y + 29);
        ctx.font = `28px ${FONT}`; ctx.fillStyle = done ? '#3c4c2b' : '#50381f';
        const anchors = []; const lines = wrapped(ctx, entry.text, rect.w - 48);
        for (const [lineIndex, line] of lines.entries()) {
          const baseline = rect.y + 73 + lineIndex * 37; let x = rect.x + 24;
          for (const [tokenIndex, token] of line.split(' ').entries()) {
            if (tokenIndex) x += ctx.measureText(' ').width;
            const keyword = entry.keywords.find(word => token.includes(word));
            if (!keyword) ctx.fillText(token, x, baseline);
            else {
              const at = token.indexOf(keyword), before = token.slice(0, at), after = token.slice(at + keyword.length), start = x + ctx.measureText(before).width;
              if (before) ctx.fillText(before, x, baseline);
              const g = this.glyphs.get(keyword), factor = 28 / 64;
              const glyphRect = { x: start - g.pad * factor, y: baseline - (g.ascent + g.pad) * factor, w: g.width * factor, h: g.height * factor };
              anchors.push({ text: keyword, rect: glyphRect });
              if (after) ctx.fillText(after, start + ctx.measureText(keyword).width, baseline);
            }
            x += ctx.measureText(token).width;
          }
        }
        layout.set(entry.stationId, anchors); hits.push({ rect, action: { type: 'word', id: entry.stationId } });
      });
      button('Πλήρης ύμνος', { x: 84, y: 801, w: this.session.complete ? 405 : 856, h: 65 }, { type: 'hymn-page', page: 0 });
      if (this.session.complete) button('Τελικό ερώτημα', { x: 533, y: 801, w: 405, h: 65 }, { type: 'hymn-page', page: 3 });
    } else {
      const text = page === 3 ? this.session.sceneData && this.finalQuestion : content.readingPages[page];
      ctx.textAlign = 'left'; ctx.fillStyle = '#50381f'; ctx.font = `34px ${FONT}`;
      let y = 205;
      for (const paragraph of String(text || '').split('\n')) { for (const line of wrapped(ctx, paragraph, 840)) { ctx.fillText(line, 92, y); y += 48; } y += 18; }
      ctx.textAlign = 'center'; ctx.font = '18px system-ui'; ctx.fillStyle = '#7c6039'; ctx.fillText(page === 3 ? 'Σκέψου και σύνδεσε' : `${page + 1} / ${content.readingPages.length}`, CW / 2, 761);
      if (page < 3) {
        if (page > 0) button('←', { x: 70, y: 801, w: 135, h: 65 }, { type: 'hymn-page', page: page - 1 });
        if (page < 2) button('→', { x: 819, y: 801, w: 135, h: 65 }, { type: 'hymn-page', page: page + 1 });
      }
      button('Στις συνδέσεις', { x: 267, y: 801, w: 490, h: 65 }, { type: 'hymn-page', page: -1 });
    }
    const result = { texture: texture(canvas), layout, hits }; this.pages.set(key, result); return result;
  }
  makeBook(id, position) {
    const root = new THREE.Group(); root.position.set(...position); this.root.add(root);
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(BW, BH), new THREE.MeshBasicMaterial({ transparent: false, side: THREE.DoubleSide, toneMapped: false })); surface.userData.action = { type: 'hymn-block' }; root.add(surface);
    const wood = new THREE.MeshStandardMaterial({ color: 0x98703d, roughness: .82 });
    for (const y of [-BH / 2 - .025, BH / 2 + .025]) { const roll = new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, BW + .13, 16), wood); roll.rotation.z = Math.PI / 2; roll.position.y = y; root.add(roll); }
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.045, .07, position[1] - BH / 2, 10), wood); post.position.y = -BH / 2 - (position[1] - BH / 2) / 2; root.add(post);
    const book = { id, root, surface, hitMeshes: [], sources: new Map() }; this.books.push(book);
    for (const entry of content.entries) {
      const words = [];
      for (const item of this.layout.get(entry.stationId)) {
        const g = this.glyphs.get(item.text), material = new THREE.MeshBasicMaterial({ map: g.texture, color: ink, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
        const mesh = new THREE.Mesh(g.geometry, material), r = item.rect;
        mesh.scale.setScalar(r.h / CH * BH); mesh.position.set((r.x + r.w / 2 - CW / 2) / CW * BW, (CH / 2 - r.y - r.h / 2) / CH * BH, .014); root.add(mesh);
        mesh.userData.keyword = item.text; words.push(mesh);
      }
      book.sources.set(entry.stationId, words);
    }
    return book;
  }
  makeWords(station) {
    const words = hymnEntry(station.id).keywords.map(text => {
      const g = this.glyphs.get(text), material = new THREE.MeshBasicMaterial({ map: g.texture, color: gold, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(g.geometry, material); mesh.scale.setScalar(.24); mesh.visible = false; this.root.add(mesh);
      const backdrop = panel('', g.width / g.height + .4, 1.5, null, { dark: true }); backdrop.position.z = -.01; backdrop.material.depthWrite = false; backdrop.renderOrder = 9; mesh.renderOrder = 10; mesh.add(backdrop);
      return { mesh, backdrop, curve: new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()), start: new THREE.Vector3(), startScale: 1 };
    });
    this.words.set(station.id, words);
  }
  destination(station, index, cameraPosition, out = new THREE.Vector3()) {
    const angle = Math.atan2(cameraPosition.x - station.position[0], cameraPosition.z - station.position[1]);
    const book = this.books.find(b => b.id === station.id).root.position;
    const bookSide = (book.x - station.position[0]) * Math.cos(angle) - (book.z - station.position[1]) * Math.sin(angle);
    const side = (bookSide >= 0 ? -1 : 1) * .28;
    return out.set(station.position[0] + Math.cos(angle) * side + Math.sin(angle) * .8, index ? .43 : .84, station.position[1] - Math.sin(angle) * side + Math.cos(angle) * .8);
  }
  makeBeam(station, book) {
    const start = book.root.position.clone(), end = new THREE.Vector3(station.position[0], station.height * .52, station.position[1] + .12);
    const delta = end.clone().sub(start), curve = new THREE.CubicBezierCurve3(start, start.clone().addScaledVector(delta, .33).add(new THREE.Vector3(0, .5, 0)), end.clone().addScaledVector(delta, -.2).add(new THREE.Vector3(0, .3, 0)), end);
    const beam = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .018, 6, false), new THREE.MeshBasicMaterial({ color: 0xffd582, toneMapped: false }));
    const halo = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, .055, 6, false), new THREE.MeshBasicMaterial({ color: 0xffd582, transparent: true, opacity: .14, depthWrite: false, toneMapped: false }));
    const bead = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffefbb, toneMapped: false }));
    this.root.add(beam, halo, bead); this.beams.set(station.id, { beam, halo, bead, curve });
  }
  setPage(page) { this.page = Math.max(-1, Math.min(3, page)); this.signature = ''; this.sync(); }
  sync() {
    const key = `${this.page}:${this.session.selected}:${this.session.reviewId}:${this.session.localCount}:${this.session.busy}:${this.session.complete}:${this.resetConfirm}`;
    if (key === this.signature) return; this.signature = key;
    const page = this.makePage(this.page);
    for (const book of this.books) {
      book.surface.material.map = page.texture; book.surface.material.needsUpdate = true;
      for (const hit of book.hitMeshes) { hit.removeFromParent(); hit.geometry.dispose(); hit.material.dispose(); }
      book.hitMeshes.length = 0;
      for (const { rect, action } of page.hits) { const hit = invisibleHit(rect, { ...action, bookId: book.id }); book.root.add(hit); book.hitMeshes.push(hit); }
      for (const [id, sources] of book.sources) for (const source of sources) {
        source.visible = !this.reading; source.material.color.setHex(this.session.solved(id) ? 0x3c4c2b : ink);
      }
    }
    this.pickables = this.books.flatMap(book => [book.surface, ...book.hitMeshes]);
    for (const hit of this.pickables) hit.userData.disabled = this.resetConfirm || (this.session.busy && hit.userData.action.type === 'word');
  }
  start(id, reduced = false, cameraPosition = null, bookId = null) {
    this.cancel(false); this.page = -1; this.signature = ''; this.sync();
    const station = this.world.stations.find(s => s.id === id);
    const book = this.books.find(b => b.id === (bookId || id));
    if (cameraPosition) book.root.lookAt(cameraPosition.x, book.root.position.y, cameraPosition.z);
    book.root.updateWorldMatrix(true, true);
    const words = this.words.get(id);
    for (const [index, word] of words.entries()) { const source = book.sources.get(id).find(mesh => mesh.userData.keyword === hymnEntry(id).keywords[index]);
      source.getWorldPosition(word.start); const scale = source.getWorldScale(new THREE.Vector3()); word.startScale = scale.y; word.mesh.position.copy(word.start); word.mesh.visible = true;
    }
    this.active = { id, station, book, elapsed: 0, reduced };
    setText(this.interpretation, hymnEntry(id).interpretation, { dark: true, paragraph: true });
    this.interpretation.position.set(station.position[0], station.height + 1, station.position[1] + .15);
  }
  cancel(finish = true) {
    const active = this.active; this.active = null; this.interpretation.visible = false;
    for (const book of this.books) for (const sources of book.sources.values()) for (const source of sources) source.material.opacity = 1;
    if (active && finish) this.onFinished?.(active.id);
  }
  viewPose(station, pose) {
    const book = this.books.find(b => b.id === station.id); if (!book) return pose;
    const origin = new THREE.Vector2(...pose.landing);
    const bookDirection = new THREE.Vector2(book.root.position.x, book.root.position.z).sub(origin).normalize();
    const imageDirection = new THREE.Vector2(...station.position).sub(origin).normalize();
    const look = bookDirection.multiplyScalar(.6).addScaledVector(imageDirection, .4).normalize().multiplyScalar(5).add(origin);
    return { ...pose, position: look.toArray(), lookHeight: book.root.position.y };
  }
  update(dt, cameraPosition, reduced, paused = false, resetConfirm = false) {
    this.resetConfirm = resetConfirm; this.sync();
    for (const book of this.books) book.root.lookAt(cameraPosition.x, book.root.position.y, cameraPosition.z);
    if (this.active && !paused && !this.reading && !resetConfirm) this.active.elapsed += dt * 1000;
    if (this.active && reduced) this.active.reduced = true;
    this.interpretation.visible = Boolean(this.interpretationText);
    if (this.interpretation.visible) this.interpretation.lookAt(cameraPosition.x, this.interpretation.position.y, cameraPosition.z);
    for (const station of this.world.stations) {
      const active = this.active?.id === station.id ? this.active : null, solved = this.session.solved(station.id), entry = hymnEntry(station.id), time = active?.elapsed ?? 0, instant = active?.reduced;
      const arrival = instant ? 0 : 800;
      this.actors.present(station.id, { elapsedMs: active && time >= arrival && !instant ? time - arrival : -1, reveal: active ? instant ? 1 : time < arrival ? .42 : .42 + .58 * ease((time - arrival) / 600) : solved ? 1 : this.session.current?.id === station.id ? .42 : .16 });
      const beam = this.beams.get(station.id); beam.beam.visible = beam.halo.visible = solved;
      beam.bead.visible = Boolean(active && !this.reading && !instant && time < 800); if (beam.bead.visible) beam.bead.position.copy(beam.curve.getPoint(clamp(time / 800)));
      this.words.get(station.id).forEach((word, index) => {
        word.mesh.visible = solved && !(active && this.reading); if (!solved) return;
        word.mesh.material.depthTest = !active;
        const u = active ? instant ? 1 : clamp((time - index * 300) / 4700) : 1, e = ease(u);
        const end = this.destination(station, index, cameraPosition, word.curve.v3);
        if (active) {
          word.curve.v0.copy(word.start); const delta = end.clone().sub(word.start);
          word.curve.v1.copy(word.start).addScaledVector(delta, .32); word.curve.v1.y += index ? .16 : 1.05;
          word.curve.v2.copy(end).addScaledVector(delta, -.18); word.curve.v2.y += index ? .12 : .5;
          word.curve.getPoint(e, word.mesh.position);
        } else word.mesh.position.copy(end);
        word.mesh.rotation.set(0, Math.atan2(cameraPosition.x - word.mesh.position.x, cameraPosition.z - word.mesh.position.z), 0);
        word.mesh.scale.setScalar(active ? THREE.MathUtils.lerp(word.startScale, .24, clamp(u * 4)) : .24);
        word.mesh.material.color.setHex(active && u < .15 ? ink : gold);
        word.backdrop.material.opacity = active ? clamp((u - .8) / .2) : 1;
        word.backdrop.material.depthTest = !active;
        const source = active?.book.sources.get(station.id).find(mesh => mesh.userData.keyword === entry.keywords[index]);
        if (source) source.material.opacity = u < .08 ? 1 - u / .08 * .82 : u > .86 ? .18 + (u - .86) / .14 * .82 : .18;
      });
    }
    if (this.active && this.active.elapsed >= (this.active.reduced ? 4000 : 5000)) this.cancel(true);
  }
  dispose() {
    this.cancel(false);
    const geometries = new Set(), materials = new Set(); this.root.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) materials.add(o.material); });
    for (const value of geometries) value.dispose(); for (const value of materials) { if (value.map && ![...this.pages.values()].some(p => p.texture === value.map) && ![...this.glyphs.values()].some(g => g.texture === value.map)) value.map.dispose(); value.dispose(); }
    for (const value of this.pages.values()) value.texture.dispose(); for (const value of this.glyphs.values()) value.texture.dispose(); this.root.removeFromParent();
  }
}
