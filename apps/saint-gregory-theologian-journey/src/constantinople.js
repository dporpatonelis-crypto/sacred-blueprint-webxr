import * as THREE from 'three';
import { panorama } from '../../../shared/journey/panorama.js';

function randomGenerator(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function makeCourtyard(scene) {
  const earth = new THREE.Mesh(new THREE.CircleGeometry(74, 64),
    new THREE.MeshStandardMaterial({ color: 0xb7a987, roughness: 1, flatShading: true }));
  earth.rotation.x = -Math.PI / 2;
  earth.position.y = -.19;
  scene.add(earth);

  const colors = [0xd8c8a7, 0xc9b995, 0xb9a783, 0xe0d1b0, 0xad9b79];
  const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .075, .82),
    new THREE.MeshStandardMaterial({ roughness: .97, flatShading: true }), 520);
  const pose = new THREE.Object3D(), random = randomGenerator(381);
  let index = 0;
  for (let z = 10; z >= -10; z -= .88) {
    for (let x = -9; x <= 9; x += 1.06) {
      pose.position.set(x + (Math.round(z * 10) % 2 ? .2 : 0), -.022, z);
      pose.rotation.y = (random() - .5) * .045;
      pose.scale.set(.88 + random() * .16, 1, .82 + random() * .17);
      pose.updateMatrix();
      stones.setMatrixAt(index, pose.matrix);
      stones.setColorAt(index, new THREE.Color(colors[index % colors.length]).multiplyScalar(.94 + random() * .12));
      index++;
    }
  }
  stones.count = index;
  scene.add(stones);
}

function makeColonnade(scene) {
  const paleStone = new THREE.MeshStandardMaterial({ color: 0xe1d3b7, roughness: .93, flatShading: true });
  const warmStone = new THREE.MeshStandardMaterial({ color: 0xc2ad89, roughness: .97 });
  const base = new THREE.CylinderGeometry(.43, .48, .14, 16);
  const shaft = new THREE.CylinderGeometry(.27, .34, 2.55, 16, 1);
  const capital = new THREE.CylinderGeometry(.43, .34, .17, 16);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      const x = side * 7.45, z = .5 - row * 2.55;
      for (const [geometry, material, y] of [[base, warmStone, .07], [shaft, paleStone, 1.34], [capital, warmStone, 2.69]]) {
        const column = new THREE.Mesh(geometry, material);
        column.position.set(x, y, z);
        scene.add(column);
      }
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.62, .22, 11.8), paleStone);
    beam.position.set(side * 7.45, 2.89, -4.1);
    scene.add(beam);
  }
}

function makeBasilica(scene) {
  const limestone = new THREE.MeshStandardMaterial({ color: 0xd5c3a0, roughness: .92, flatShading: true });
  const shadedStone = new THREE.MeshStandardMaterial({ color: 0x947d5b, roughness: .98 });
  const timber = new THREE.MeshStandardMaterial({ color: 0x73583c, roughness: .94 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(8.7, 3.05, .48), limestone);
  body.position.set(0, 1.5, -10.3);
  scene.add(body);

  const doorway = new THREE.Mesh(new THREE.BoxGeometry(1.25, 2.25, .06), shadedStone);
  doorway.position.set(0, 1.1, -10.025);
  scene.add(doorway);
  for (const x of [-3.15, -1.8, 1.8, 3.15]) {
    const pilaster = new THREE.Mesh(new THREE.BoxGeometry(.23, 2.6, .15), limestone);
    pilaster.position.set(x, 1.33, -10.02);
    scene.add(pilaster);
  }

  const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(4.75, .28, 1.15), timber);
  roofLeft.position.set(-2.27, 3.23, -10.28);
  roofLeft.rotation.z = .31;
  scene.add(roofLeft);
  const roofRight = new THREE.Mesh(new THREE.BoxGeometry(4.75, .28, 1.15), timber);
  roofRight.position.set(2.27, 3.23, -10.28);
  roofRight.rotation.z = -.31;
  scene.add(roofRight);

  const porchBeam = new THREE.Mesh(new THREE.BoxGeometry(6.3, .28, .34), limestone);
  porchBeam.position.set(0, 2.72, -8.95);
  scene.add(porchBeam);
  for (const x of [-2.5, -1.25, 0, 1.25, 2.5]) {
    const column = new THREE.Mesh(new THREE.CylinderGeometry(.17, .22, 2.4, 14), limestone);
    column.position.set(x, 1.3, -8.94);
    scene.add(column);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(.56, .17, .52), shadedStone);
    cap.position.set(x, 2.55, -8.94);
    scene.add(cap);
  }
}

function makeWaterfront(scene) {
  const quay = new THREE.Mesh(new THREE.BoxGeometry(17, .35, .42),
    new THREE.MeshStandardMaterial({ color: 0x9d8867, roughness: .95 }));
  quay.position.set(0, .12, -12.15);
  scene.add(quay);
  const coping = new THREE.Mesh(new THREE.BoxGeometry(17.3, .13, .56),
    new THREE.MeshStandardMaterial({ color: 0xd0bd98, roughness: .92 }));
  coping.position.set(0, .35, -12.2);
  scene.add(coping);

  const water = new THREE.Mesh(new THREE.PlaneGeometry(160, 90),
    new THREE.MeshStandardMaterial({ color: 0x397f86, roughness: .36, metalness: .06, side: THREE.DoubleSide }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -.08, -57.3);
  scene.add(water);

  const bollardMaterial = new THREE.MeshStandardMaterial({ color: 0x79674e, roughness: 1 });
  for (const x of [-7.2, -4.6, 4.6, 7.2]) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(.11, .15, .52, 9), bollardMaterial);
    bollard.position.set(x, .3, -11.9);
    scene.add(bollard);
  }
}

function makeOlives(scene) {
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x806748, roughness: 1 });
  const foliage = [0x68734b, 0x7b8051, 0x858356].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: .98, flatShading: true }));
  for (const [x, z] of [[-9.8, -6.7], [9.7, -7.2], [-10.2, 1.9], [10.1, 2.7]]) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(.16, .25, 2.4, 8), trunkMaterial);
    trunk.position.set(x, 1.2, z);
    trunk.rotation.z = x < 0 ? -.08 : .08;
    scene.add(trunk);
    for (let i = 0; i < 5; i++) {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(.78 + (i % 2) * .12, 1), foliage[i % foliage.length]);
      crown.position.set(x + Math.cos(i * 1.26) * .57, 2.5 + (i % 2) * .32, z + Math.sin(i * 1.26) * .56);
      crown.scale.set(1.2, .72, .9);
      scene.add(crown);
    }
  }
}

export function makeConstantinople(scene, sky) {
  scene.add(panorama(sky, .12));
  scene.fog = new THREE.Fog(0xcbbd9e, 48, 125);
  scene.add(new THREE.HemisphereLight(0xfff1d8, 0x746b54, 2.0));
  const sun = new THREE.DirectionalLight(0xffe0ad, 2.1);
  sun.position.set(-13, 18, 7);
  scene.add(sun);
  makeCourtyard(scene);
  makeColonnade(scene);
  makeBasilica(scene);
  makeWaterfront(scene);
  makeOlives(scene);
  return () => {};
}
