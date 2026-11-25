import * as THREE from 'three';
import { panorama } from '../../../shared/journey/panorama.js';

const PLATFORM_RADIUS = 16.9;
const WATER_RADIUS = 18.5;

function randomGenerator(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function makePaving(scene) {
  const earth = new THREE.Mesh(new THREE.CircleGeometry(PLATFORM_RADIUS, 64),
    new THREE.MeshStandardMaterial({ color: 0xb3a184, roughness: 1, flatShading: true }));
  earth.rotation.x = -Math.PI / 2;
  earth.position.y = -.19;
  scene.add(earth);

  const colors = [0xd0c09e, 0xc4b28e, 0xb7a583, 0xd8c9a8, 0xa99775];
  const stones = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .075, .84),
    new THREE.MeshStandardMaterial({ roughness: .96, flatShading: true }), 660);
  const pose = new THREE.Object3D(), random = randomGenerator(453);
  let index = 0;
  for (let z = 13; z >= -14; z -= .86) {
    for (let x = -9.5; x <= 9.5; x += 1.03) {
      pose.position.set(x + (Math.round(z * 10) % 2 ? .2 : 0), -.022, z);
      pose.rotation.y = (random() - .5) * .045;
      pose.scale.set(.88 + random() * .15, 1, .82 + random() * .16);
      pose.updateMatrix();
      stones.setMatrixAt(index, pose.matrix);
      stones.setColorAt(index, new THREE.Color(colors[index % colors.length]).multiplyScalar(.94 + random() * .12));
      index++;
    }
  }
  stones.count = index;
  scene.add(stones);
}

function makeColonnades(scene) {
  const marble = new THREE.MeshStandardMaterial({ color: 0xe0d1b3, roughness: .92, flatShading: true });
  const warmStone = new THREE.MeshStandardMaterial({ color: 0xc8b28e, roughness: .96 });
  const base = new THREE.CylinderGeometry(.43, .49, .15, 16);
  const shaft = new THREE.CylinderGeometry(.28, .36, 2.65, 16, 1);
  const capital = new THREE.CylinderGeometry(.47, .37, .18, 16);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      const x = side * 7.55, z = 1.2 - row * 2.7;
      for (const [geometry, material, y] of [[base, warmStone, .075], [shaft, marble, 1.42], [capital, warmStone, 2.82]]) {
        const column = new THREE.Mesh(geometry, material);
        column.position.set(x, y, z);
        scene.add(column);
      }
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.68, .25, 12.4), marble);
    beam.position.set(side * 7.55, 2.98, -4.2);
    scene.add(beam);
  }
}

function makePalms(scene) {
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x92724c, roughness: 1 });
  const leaves = [0x607043, 0x75804a, 0x879055].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: .98, flatShading: true, side: THREE.DoubleSide }));
  const leafGeometry = new THREE.ConeGeometry(.12, 2.2, 5, 1, true);
  const trunkGeometry = new THREE.CylinderGeometry(.11, .22, 3.4, 8);
  for (const [x, z, lean] of [[-5.6, -9.7, -.10], [5.7, -10.4, .08], [-8.4, -1.6, -.1], [8.5, -2.4, .11]]) {
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(x, 1.68, z);
    trunk.rotation.z = lean;
    scene.add(trunk);
    for (let i = 0; i < 9; i++) {
      const angle = i * Math.PI * 2 / 9;
      const frond = new THREE.Mesh(leafGeometry, leaves[i % leaves.length]);
      frond.position.set(x + Math.cos(angle) * .72, 3.46 + Math.sin(angle * 3) * .08, z + Math.sin(angle) * .72);
      frond.rotation.z = -Math.cos(angle) * .62;
      frond.rotation.x = Math.sin(angle) * .62;
      frond.rotation.y = angle;
      frond.scale.set(.85, 1, 1.35);
      scene.add(frond);
    }
  }
}

function makeHarbor(scene) {
  const quay = new THREE.Mesh(new THREE.BoxGeometry(17.4, .36, .42),
    new THREE.MeshStandardMaterial({ color: 0x9d8865, roughness: .94 }));
  quay.position.set(0, .14, -12.15);
  scene.add(quay);
  const coping = new THREE.Mesh(new THREE.BoxGeometry(17.7, .13, .58),
    new THREE.MeshStandardMaterial({ color: 0xd0bd98, roughness: .9 }));
  coping.position.set(0, .38, -12.2);
  scene.add(coping);

  const sea = new THREE.Mesh(new THREE.RingGeometry(PLATFORM_RADIUS - .08, WATER_RADIUS, 128),
    new THREE.MeshStandardMaterial({ color: 0x397f86, roughness: .34, metalness: .08, side: THREE.DoubleSide }));
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -.245;
  scene.add(sea);

  const bollardMaterial = new THREE.MeshStandardMaterial({ color: 0x776449, roughness: 1 });
  for (const x of [-7.6, -4.7, 4.6, 7.6]) {
    const bollard = new THREE.Mesh(new THREE.CylinderGeometry(.11, .15, .58, 9), bollardMaterial);
    bollard.position.set(x, .33, -11.9);
    scene.add(bollard);
  }
}

export function makeAlexandria(scene, sky) {
  scene.add(panorama(sky, .12));
  scene.fog = new THREE.Fog(0xc9b99b, 48, 125);
  scene.add(new THREE.HemisphereLight(0xfff1d8, 0x726348, 2.02));
  const sun = new THREE.DirectionalLight(0xffdfaa, 2.15);
  sun.position.set(-13, 18, 7);
  scene.add(sun);
  makePaving(scene);
  makeColonnades(scene);
  makePalms(scene);
  makeHarbor(scene);
  return () => {};
}
