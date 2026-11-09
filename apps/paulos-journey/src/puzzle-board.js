import * as THREE from 'three';
import { panel, setText } from '../../../shared/journey/text-panels.js';

// A real world-space board; all hits use the same action path as the lesson.
export class IslandPuzzle {
  constructor(parent, activity, texture, station, city, onSolved) {
    this.activity=activity; this.pickables=[]; this.preview=false; this.gesture=null; this.city=city; this.enabled=true; this.wasSolved=activity.puzzle.solved; this.unlocked=activity.puzzle.solved;
    this.inverse = new THREE.Matrix4(); this.localRay = new THREE.Ray(); this.localPoint = new THREE.Vector3();
    this.localPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); this.destination = new THREE.Vector3();
    this.root = new THREE.Group(); this.root.position.set(station.position[0],1.95,station.position[1]); parent.add(this.root);
    const aspect=texture.image.width/texture.image.height, width=Math.min(3.25,2.4*aspect), height=width/aspect;
    const backing = new THREE.Mesh(new THREE.BoxGeometry(width + .16, height + .16, .10), new THREE.MeshStandardMaterial({ color: 0x27483a, roughness: .8 }));
    backing.position.z = -.065; this.root.add(backing);
    backing.userData.action = { type: 'puzzle-surface', id:city.id }; this.pickables.push(backing);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(.12, 1.95-height/2-.2, .14), backing.material);
      post.position.set(side * width * .4,-height/2-(1.95-height/2-.2)/2,-.07); this.root.add(post);
    }
    this.tiles = [];
    const { rows, columns, size } = activity.puzzle;
    this.cellWidth = width / columns; this.cellHeight = height / rows;
    for (let id = 0; id < size; id++) {
      const map = texture.clone(); map.repeat.set(1 / columns, 1 / rows);
      map.offset.set(id % columns / columns, 1 - (Math.floor(id / columns) + 1) / rows); map.needsUpdate = true;
      const tile = new THREE.Mesh(new THREE.PlaneGeometry(this.cellWidth - .012, this.cellHeight - .012), new THREE.MeshBasicMaterial({ map, color: 0xffffff, toneMapped: false }));
      tile.userData.action = { type: 'puzzle-tile', tile:id, id:city.id }; tile.userData.cell = -1;
      this.tiles.push(tile); this.root.add(tile); this.pickables.push(tile);
    }
    this.reference = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false }));
    this.reference.position.z = .025; this.reference.visible = false; this.root.add(this.reference);
    this.reference.userData.action = { type: 'puzzle-surface', id:city.id }; this.pickables.push(this.reference);
    this.caption = panel(city.title+' · Παζλ 3 × 2', 3.6, .40, null, { dark: true });
    this.caption.position.set(0, height / 2 + .32, 0); this.root.add(this.caption);
    this.status = panel('', 3.6, .40, null, { dark: true }); this.status.position.set(0, -height / 2 - .29, 0); this.root.add(this.status);
    const controls = [
      ['Δες την εικόνα', 'puzzle-preview'], ['Νέο ανακάτεμα', 'puzzle-reset'], ['Στην πόλη →', 'puzzle-enter'],
    ];
    controls.forEach(([label, type], i) => {
      const button = panel(label, 1.25, .38, { type,id:city.id }, { dark: true, small: true });
      button.position.set(width/2+.82, .65 - i * .60, .015); this.root.add(button); this.pickables.push(button);
      if(type==='puzzle-preview')this.previewButton=button;if(type==='puzzle-enter')this.enterButton=button;
    });
    this.unsubscribe=activity.subscribe(()=>{this.refresh();if(activity.puzzle.solved&&!this.wasSolved)onSolved(city.id);this.wasSolved=activity.puzzle.solved;});this.refresh(true);
  }
  cell(index, target) {
    const { rows, columns } = this.activity.puzzle;
    return target.set((index % columns - (columns - 1) / 2) * this.cellWidth, ((rows - 1) / 2 - Math.floor(index / columns)) * this.cellHeight, 0);
  }
  refresh(instant = false) {
    this.finishDrag(false);
    const puzzle = this.activity.puzzle;
    for (let id = 0; id < puzzle.size; id++) {
      const tile = this.tiles[id], cell = id === puzzle.size - 1 ? puzzle.size - 1 : puzzle.tiles.indexOf(id);
      tile.visible = !this.preview && (id !== puzzle.size - 1 || puzzle.solved);
      // Even immovable tiles absorb a ray so puzzle input never fires water behind it.
      tile.userData.disabled = !this.enabled;
      tile.material.color.setHex(!this.enabled?0x687c76:puzzle.solved||puzzle.canMove(id)?0xffffff:0xbbc9b8);
      tile.userData.cell = cell;
      if (instant || puzzle.moves === 0) this.cell(cell, tile.position);
    }
    this.reference.visible = this.preview;
    setText(this.previewButton, this.preview ? 'Στο puzzle' : 'Δες την εικόνα', { dark: true, small: true });
    setText(this.status,!this.enabled?'Ολοκλήρωσε την προηγούμενη πόλη':puzzle.solved?'Η πόλη άνοιξε · πάτησε «Στην πόλη»':this.preview?'Εικόνα αναφοράς · επέστρεψε στο παζλ':'Κινήσεις: '+puzzle.moves+' · πάτησε ή σύρε δίπλα στο κενό',{dark:true,small:true});
    for(const mesh of this.pickables)mesh.userData.disabled=!this.enabled||mesh===this.enterButton&&!puzzle.solved&&!this.unlocked;
  }
  setEnabled(value){if(this.enabled===value)return;this.enabled=value;this.refresh();}

  setUnlocked(value){if(this.unlocked===value)return;this.unlocked=value;this.refresh();}
  togglePreview() { this.preview = !this.preview; this.refresh(); }
  pointOnBoard(ray) { return this.localRay.copy(ray).applyMatrix4(this.inverse).intersectPlane(this.localPlane, this.localPoint); }
  beginDrag(tile, ray) {
    if (!this.enabled || this.gesture || this.preview || !this.activity.puzzle.canMove(tile)) return false;
    this.root.updateWorldMatrix(true, false); this.inverse.copy(this.root.matrixWorld).invert();
    const point = this.pointOnBoard(ray); if (!point) return false;
    const puzzle = this.activity.puzzle, from = this.cell(puzzle.tiles.indexOf(tile), new THREE.Vector3());
    const delta = this.cell(puzzle.blank, new THREE.Vector3()).sub(from);
    this.gesture = { tile, from, start: point.clone(), axis: delta.clone().normalize(), distance: delta.length(), offset: 0 };
    this.tiles[tile].position.copy(from); return true;
  }
  drag(ray) {
    if (!this.gesture) return;
    const point = this.pointOnBoard(ray); if (!point) return;
    const g = this.gesture, along = this.destination.copy(point).sub(g.start).dot(g.axis);
    g.offset = Math.max(g.offset, Math.min(g.distance, along));
    this.tiles[g.tile].position.copy(g.from).addScaledVector(g.axis, g.offset);
  }
  finishDrag(commit = true) {
    if (!this.gesture) return;
    const tile = this.gesture.tile; this.gesture = null;
    if (commit) this.activity.move(tile);
  }
  update(dt, reduced) {
    const destination = this.destination;
    for (const tile of this.tiles) {
      if (this.gesture?.tile === tile.userData.action.tile) continue;
      this.cell(tile.userData.cell, destination);
      if (reduced) tile.position.copy(destination);
      else tile.position.lerp(destination, 1 - Math.exp(-25 * dt));
    }
  }
  dispose() { this.finishDrag(false); this.unsubscribe(); }
}
