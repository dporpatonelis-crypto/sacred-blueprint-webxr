import * as THREE from 'three';
import { panorama } from '../../../shared/journey/panorama.js';

const stoneTones = [0xbbae8e, 0xc4b693, 0xa99978, 0xd0c1a0];

function horizontalDisk(scene, radius, material, y, segments = 72) {
  const disk = new THREE.Mesh(new THREE.CircleGeometry(radius, segments), material);
  disk.rotation.x = -Math.PI / 2;
  disk.position.y = y;
  scene.add(disk);
  return disk;
}

function makeWater(scene) {
  const sea = new THREE.Mesh(new THREE.CircleGeometry(12, 96), new THREE.MeshStandardMaterial({
    color: 0x28646a, roughness: .38, metalness: .07, side: THREE.DoubleSide
  }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -.25;
  scene.add(sea);
}

function makeIslet(scene) {
  const cliff = new THREE.Mesh(new THREE.CylinderGeometry(8.68, 9.35, 1.4, 72),
    new THREE.MeshStandardMaterial({ color: 0x77694f, roughness: .98, flatShading: true }));
  cliff.position.y = -.695;
  scene.add(cliff);

  horizontalDisk(scene, 8.7, new THREE.MeshStandardMaterial({
    color: 0xb5a27b, roughness: .98, flatShading: true
  }), .018);
  horizontalDisk(scene, 4.55, new THREE.MeshStandardMaterial({
    color: 0xc4b28d, roughness: .98, flatShading: true
  }), .034, 56);

  const rockGeometry = new THREE.IcosahedronGeometry(1, 0);
  const rockMaterials = [0x74674f, 0x89795b, 0x9a8966, 0x625d4e].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  for (let index = 0; index < 56; index++) {
    const angle = index / 56 * Math.PI * 2;
    const radius = 8.55 + Math.sin(index * 2.17) * .16;
    const rock = new THREE.Mesh(rockGeometry, rockMaterials[index % rockMaterials.length]);
    rock.position.set(Math.cos(angle) * radius, -.01 + (index % 3) * .045, Math.sin(angle) * radius);
    rock.scale.set(.34 + (index % 4) * .07, .20 + (index % 3) * .06, .30 + (index % 5) * .04);
    rock.rotation.set(index * .17, angle, index * .29);
    scene.add(rock);
  }
}

function makePath(scene) {
  const geometry = new THREE.BoxGeometry(.78, .055, .54);
  const materials = stoneTones.map(color => new THREE.MeshStandardMaterial({ color, roughness: .96, flatShading: true }));
  for (let row = 0; row < 9; row++) {
    const z = 4.9 - row * .63;
    for (let column = -2; column <= 2; column++) {
      if (row > 4 && Math.abs(column) === 2) continue;
      const tile = new THREE.Mesh(geometry, materials[(row * 3 + column + 10) % materials.length]);
      tile.position.set(column * .82 + (row % 2 ? .10 : -.06), .075, z);
      tile.rotation.y = ((row + column) % 3 - 1) * .025;
      scene.add(tile);
    }
  }
}

function makeLanding(scene) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x755638, roughness: .94 });
  const plank = new THREE.BoxGeometry(2.75, .12, .48);
  for (let index = 0; index < 5; index++) {
    const board = new THREE.Mesh(plank, wood);
    board.position.set(0, .12, 5.95 + index * .37);
    scene.add(board);
  }
  const postGeometry = new THREE.CylinderGeometry(.075, .10, 1.4, 8);
  for (const x of [-1.25, 1.25]) {
    for (const z of [6.05, 7.55]) {
      const post = new THREE.Mesh(postGeometry, wood);
      post.position.set(x, -.58, z);
      scene.add(post);
    }
  }
}

function makeOliveTree(scene, x, z, scale = 1) {
  const bark = new THREE.MeshStandardMaterial({ color: 0x6e553a, roughness: 1, flatShading: true });
  const leaves = [0x67734d, 0x798054, 0x8a8759].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: .98, flatShading: true }));
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.13, .22, 1.75, 9), bark);
  trunk.position.set(x, .88 * scale, z);
  trunk.rotation.z = x < 0 ? -.08 : .08;
  trunk.scale.setScalar(scale);
  scene.add(trunk);
  for (let index = 0; index < 6; index++) {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.56 + (index % 3) * .08, 1), leaves[index % leaves.length]);
    const angle = index * Math.PI / 3;
    crown.position.set(x + Math.cos(angle) * .42 * scale, 1.72 * scale + (index % 2) * .23, z + Math.sin(angle) * .38 * scale);
    crown.scale.set(1.25, .76, .94);
    scene.add(crown);
  }
}

function makeCoastalPlants(scene) {
  const reedMaterial = new THREE.MeshStandardMaterial({ color: 0x77784f, roughness: 1, flatShading: true });
  for (const [x, z] of [[-7.7, 3.1], [7.6, 3.5], [-7.4, -2.4], [7.4, -2.1]]) {
    for (let index = 0; index < 4; index++) {
      const reed = new THREE.Mesh(new THREE.CylinderGeometry(.018, .035, .60 + index * .11, 5), reedMaterial);
      reed.position.set(x + (index - 1.5) * .09, .31 + index * .04, z + (index % 2) * .12);
      reed.rotation.z = (index - 1.5) * .08;
      scene.add(reed);
    }
  }
}

export function makeBosporusIslet(scene, sky) {
  scene.add(panorama(sky, .34));
  scene.fog = new THREE.Fog(0x9c917e, 58, 138);
  scene.add(new THREE.HemisphereLight(0xffe8c5, 0x43594f, 1.75));
  const sun = new THREE.DirectionalLight(0xffd19a, 2.15);
  sun.position.set(-16, 19, 11);
  scene.add(sun);

  makeWater(scene);
  makeIslet(scene);
  makePath(scene);
  makeLanding(scene);
  makeOliveTree(scene, -6.25, 2.15, .96);
  makeOliveTree(scene, 6.25, 2.25, 1.05);
  makeOliveTree(scene, -6.35, -1.05, .78);
  makeOliveTree(scene, 6.35, -1.0, .82);
  makeCoastalPlants(scene);
  return () => {};
}
