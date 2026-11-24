import * as THREE from 'three';
import { panorama } from '../../../shared/journey/panorama.js';

function makeGround(scene) {
  const earth = new THREE.Mesh(new THREE.CircleGeometry(72, 64),
    new THREE.MeshStandardMaterial({ color: 0x9b896c, roughness: 1, flatShading: true }));
  earth.rotation.x = -Math.PI / 2;
  earth.position.y = -.34;
  scene.add(earth);

  const colors = [0xbbaa8b, 0xc8b99a, 0xd1c2a1, 0xa9987b, 0xbaa889];
  const stone = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, .075, .84),
    new THREE.MeshStandardMaterial({ roughness: .94, flatShading: true }),
    300
  );
  const pose = new THREE.Object3D();
  let seed = 1947;
  const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  let index = 0;
  for (let z = 7.5; z >= -8.5; z -= .9) {
    for (let x = -6.3; x <= 6.3; x += 1.05) {
      pose.position.set(x + (Math.floor(z * 10) % 2 ? .24 : 0), -.025, z);
      pose.rotation.y = (random() - .5) * .05;
      pose.scale.set(.90 + random() * .14, 1, .82 + random() * .16);
      pose.updateMatrix();
      stone.setMatrixAt(index, pose.matrix);
      stone.setColorAt(index, new THREE.Color(colors[index % colors.length]).multiplyScalar(.94 + random() * .12));
      index++;
    }
  }
  stone.count = index;
  stone.receiveShadow = true;
  scene.add(stone);
}

function makeColonnade(scene) {
  const marble = new THREE.MeshStandardMaterial({ color: 0xd5c5a6, roughness: .9, flatShading: true });
  const capital = new THREE.MeshStandardMaterial({ color: 0xc2ae8c, roughness: .92 });
  const baseGeometry = new THREE.CylinderGeometry(.42, .48, .16, 16);
  const shaftGeometry = new THREE.CylinderGeometry(.29, .39, 2.75, 16, 1, false);
  const topGeometry = new THREE.CylinderGeometry(.48, .4, .19, 16);
  for (const side of [-1, 1]) {
    for (let row = 0; row < 4; row++) {
      const x = side * 7.35, z = 2.2 - row * 3.05;
      const base = new THREE.Mesh(baseGeometry, capital);
      const shaft = new THREE.Mesh(shaftGeometry, marble);
      const top = new THREE.Mesh(topGeometry, capital);
      base.position.set(x, .09, z);
      shaft.position.set(x, 1.54, z);
      top.position.set(x, 2.99, z);
      scene.add(base, shaft, top);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(.8, .28, 10.1), marble);
    beam.position.set(side * 7.35, 3.22, -2.35);
    scene.add(beam);
  }
}

function makeOlives(scene) {
  const bark = new THREE.MeshStandardMaterial({ color: 0x80684d, roughness: 1, flatShading: true });
  const leaves = [0x506b3f, 0x617947, 0x778652].map(color =>
    new THREE.MeshStandardMaterial({ color, roughness: 1, flatShading: true }));
  const trunk = new THREE.CylinderGeometry(.13, .21, 1.55, 7);
  const crown = new THREE.IcosahedronGeometry(.9, 1);
  const trees = [[-6.2, -1.3], [6.1, -1.2], [-6.6, -5.3], [6.6, -5.4], [-5.7, -8.5], [5.7, -8.6]];
  trees.forEach(([x, z], index) => {
    const stem = new THREE.Mesh(trunk, bark);
    stem.position.set(x, .68, z);
    scene.add(stem);
    for (const [offsetX, offsetY, offsetZ, scale] of [
      [-.35, 1.4, 0, .8], [.26, 1.62, -.08, .87], [0, 2.02, .08, .7]
    ]) {
      const leavesMesh = new THREE.Mesh(crown, leaves[(index + Math.round(offsetY * 2)) % leaves.length]);
      leavesMesh.position.set(x + offsetX, offsetY, z + offsetZ);
      leavesMesh.scale.set(scale * 1.25, scale * .7, scale);
      scene.add(leavesMesh);
    }
  });
}

export function makeAthens(scene, sky) {
  scene.add(panorama(sky, .18));
  scene.fog = new THREE.Fog(0xbdb49f, 42, 120);
  scene.add(new THREE.HemisphereLight(0xf2ead7, 0x756448, 2.0));
  const sun = new THREE.DirectionalLight(0xffe3b0, 2.15);
  sun.position.set(-11, 17, 8);
  scene.add(sun);
  makeGround(scene);
  makeColonnade(scene);
  makeOlives(scene);
  return () => {};
}
