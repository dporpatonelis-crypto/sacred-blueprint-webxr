import * as THREE from 'three';
import { panorama } from '../../../shared/journey/panorama.js';

function randomGenerator(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function makeCourtyard(scene) {
  const ground = new THREE.Mesh(new THREE.CircleGeometry(16.5, 64),
    new THREE.MeshStandardMaterial({ color: 0xb7a987, roughness: 1, flatShading: true }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.19;
  scene.add(ground);

  const colors = [0xd8c8a7, 0xc9b995, 0xb9a783, 0xe0d1b0, 0xad9b79];
  const paving = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .075, .82),
    new THREE.MeshStandardMaterial({ roughness: .97, flatShading: true }), 500);
  const pose = new THREE.Object3D(), random = randomGenerator(379);
  let index = 0;
  for (let z = 10; z >= -10; z -= .88) {
    for (let x = -9; x <= 9; x += 1.06) {
      pose.position.set(x + (Math.round(z * 10) % 2 ? .2 : 0), -.022, z);
      pose.rotation.y = (random() - .5) * .045;
      pose.scale.set(.88 + random() * .16, 1, .82 + random() * .17);
      pose.updateMatrix();
      paving.setMatrixAt(index, pose.matrix);
      paving.setColorAt(index, new THREE.Color(colors[index % colors.length]).multiplyScalar(.94 + random() * .12));
      index++;
    }
  }
  paving.count = index;
  scene.add(paving);
}

function makeColonnades(scene) {
  const timber = new THREE.MeshStandardMaterial({ color: 0x72573b, roughness: .94 });
  const columnMaterial = new THREE.MeshStandardMaterial({ color: 0xe3d4b7, roughness: .92, flatShading: true });
  const capMaterial = new THREE.MeshStandardMaterial({ color: 0xb49a70, roughness: .97 });
  const base = new THREE.CylinderGeometry(.39, .45, .13, 14);
  const shaft = new THREE.CylinderGeometry(.24, .31, 2.58, 14, 1);
  const capital = new THREE.CylinderGeometry(.43, .31, .16, 14);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      const x = side * 7.25, z = 1.1 - row * 2.55;
      for (const [geometry, material, y] of [[base, capMaterial, .065], [shaft, columnMaterial, 1.36], [capital, capMaterial, 2.73]]) {
        const column = new THREE.Mesh(geometry, material);
        column.position.set(x, y, z);
        scene.add(column);
      }
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.72, .24, 11.3), columnMaterial);
    beam.position.set(side * 7.25, 2.88, -3.9);
    scene.add(beam);
  }
}

function makeGarden(scene) {
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x806748, roughness: 1 });
  const foliage = [0x68734b, 0x7b8051, 0x858356].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: .98, flatShading: true }));
  for (const [x, z] of [[-9.5, -7.4], [9.4, -7.8], [-9.9, 2.1], [10, 2.7]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.15, .23, 2.55, 8), trunkMaterial);
    trunk.position.set(x, 1.27, z);
    trunk.rotation.z = x < 0 ? -.08 : .08;
    scene.add(trunk);
    for (let i = 0; i < 6; i++) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.78 + (i % 2) * .12, 1), foliage[i % foliage.length]);
      crown.position.set(x + Math.cos(i * 1.05) * .55, 2.55 + (i % 2) * .28, z + Math.sin(i * 1.05) * .56);
      crown.scale.set(1.2, .74, .92);
      scene.add(crown);
    }
  }
}

function makeServiceTable(scene) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x765739, roughness: .95 });
  const stone = new THREE.MeshStandardMaterial({ color: 0xb49b71, roughness: .98 });
  const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, .14, .75), wood);
  table.position.set(-5.25, .82, 1.1);
  scene.add(table);
  for (const x of [-6.05, -4.45]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(.14, .82, .14), wood);
    leg.position.set(x, .4, 1.1);
    scene.add(leg);
  }
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(.45, .52, .32, 20), stone);
  basin.position.set(4.9, .18, 1.55);
  scene.add(basin);
  const water = new THREE.Mesh(new THREE.CircleGeometry(.39, 24),
    new THREE.MeshStandardMaterial({ color: 0x4b9490, roughness: .28, metalness: .05 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(4.9, .35, 1.55);
  scene.add(water);
}

export function makeCaesarea(scene, sky) {
  scene.add(panorama(sky, .12));
  scene.fog = new THREE.Fog(0xcbbd9e, 50, 128);
  scene.add(new THREE.HemisphereLight(0xfff1d8, 0x75674b, 2.02));
  const sun = new THREE.DirectionalLight(0xffdfaa, 2.1);
  sun.position.set(-12, 19, 8);
  scene.add(sun);
  makeCourtyard(scene);
  makeColonnades(scene);
  makeGarden(scene);
  makeServiceTable(scene);
  return () => {};
}
