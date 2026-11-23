import * as THREE from 'three';
import { panel } from '../../../shared/journey/text-panels.js';
import { TILES } from './session.js';

const W = 1.48, H = W * 9 / 16;
const tileWidth = W / 3, tileHeight = H / 2;

function material(color, roughness = .8) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function box(parent, width, height, depth, surface, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), surface);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function flat(g, surface, action) {
  const mesh = new THREE.Mesh(g, surface);
  if (action) mesh.userData.action = action;
  return mesh;
}

function point(index, z) {
  return new THREE.Vector3((index % 3 - 1) * tileWidth, (.5 - Math.floor(index / 3)) * tileHeight, z);
}

function pieceTexture(image, tile) {
  const texture = image.clone();
  texture.repeat.set(1 / 3, 1 / 2);
  texture.offset.set(tile % 3 / 3, (1 - Math.floor(tile / 3)) / 2);
  texture.needsUpdate = true;
  return texture;
}

const stone = material(0xa6895e);
const edge = material(0x855735);
const rim = material(0xe6b86b, .57);

export class BaptismPuzzle {
  constructor(root, image) {
    this.image = image;
    this.board = this.makeBench(root, -.88, 'Υποδοχές');
    this.tray = this.makeBench(root, .88, 'Δίσκος');
    this.pickables = [];
    this.slots = [];
    this.tiles = [];
    this.poses = new Map();
    const plane = new THREE.PlaneGeometry(tileWidth - .014, tileHeight - .014);
    for (const tile of TILES) {
      const well = flat(plane, new THREE.MeshStandardMaterial({ color: 0x416767, roughness: 1 }), { type: 'slot', tile });
      well.position.copy(point(tile, .075));
      this.board.add(well);
      const piece = flat(plane, new THREE.MeshBasicMaterial({
        map: pieceTexture(image, tile), side: THREE.DoubleSide, toneMapped: false
      }), { type: 'tile', tile });
      piece.position.copy(point(tile, .092));
      box(piece, tileWidth - .017, tileHeight - .016, .041, edge, 0, 0, -.023);
      this.tray.add(piece);
      this.pickables.push(well, piece);
      this.slots.push(well);
      this.tiles.push(piece);
    }
    this.enter = panel('Στους σταθμούς →', 1.04, .29, { type: 'enter' }, { dark: true });
    this.enter.position.set(0, 1.62, -.66);
    root.add(this.enter);
    this.pickables.push(this.enter);
  }

  makeBench(parent, x, title) {
    const base = new THREE.Group();
    base.position.set(x, .94, -.47);
    base.rotation.x = THREE.MathUtils.degToRad(-90 + 25);
    parent.add(base);
    box(base, W + .10, H + .12, .11, stone);
    box(base, W + .028, H + .025, .027, rim, 0, 0, .057);
    for (const legX of [-.60, .60]) {
      box(parent, .115, .77, .12, edge, x + legX, .385, -.23);
      box(parent, .115, 1.01, .12, edge, x + legX, .505, -.74);
    }
    const sign = panel(title, .58, .16, null, { dark: true });
    sign.position.set(0, -H / 2 - .065, .117);
    base.add(sign);
    return base;
  }

  sync(session, selected, immediate = false) {
    this.enter.visible = session.gateComplete;
    for (const tile of TILES) {
      const piece = this.tiles[tile], slot = this.slots[tile], placed = session.placed.has(tile);
      if (piece.userData.carried) continue;
      const parent = placed ? this.board : this.tray;
      piece.userData.disabled = placed;
      slot.userData.disabled = placed;
      slot.material.emissive.setHex(selected !== null && !placed ? 0x324c3a : 0x000000);
      piece.material.color.setHex(tile === selected ? 0xffdeb0 : 0xffffff);
      const target = point(placed ? tile : session.tileOrder.indexOf(tile), placed ? .093 : .097);
      if (piece.parent !== parent) {
        parent.add(piece);
        piece.position.copy(target);
      }
      if (immediate) piece.position.copy(target);
      this.poses.set(piece, target);
    }
  }

  update(dt, head, reduced) {
    for (const [piece, target] of this.poses) {
      if (!piece.userData.carried) piece.position.lerp(target, reduced ? 1 : 1 - Math.exp(-16 * dt));
    }
    if (this.enter.visible) this.enter.lookAt(head.x, this.enter.position.y, head.z);
  }
}
