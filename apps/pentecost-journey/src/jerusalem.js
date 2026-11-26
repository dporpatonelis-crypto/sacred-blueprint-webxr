import * as THREE from 'three';
import { panorama } from '../../../shared/journey/panorama.js';

function addBox(scene, width, height, depth, color, x, y, z, roughness = .94) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness, flatShading: true }));
  mesh.position.set(x, y, z);
  scene.add(mesh);
  return mesh;
}

function courtyard(scene) {
  const stone = [0xc9b591, 0xd4c19d, 0xbca581, 0xe1cfac, 0xa99270];
  addBox(scene, 18, .42, 23.5, 0xb9a27f, 0, -.22, .3);
  const slab = new THREE.BoxGeometry(1.15, .055, .76);
  const pavers = new THREE.InstancedMesh(slab,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .98, flatShading: true }), 16 * 28);
  const pose = new THREE.Object3D();
  let index = 0;
  for (let row = 0; row < 28; row++) {
    for (let col = 0; col < 16; col++) {
      pose.position.set((col - 7.5) * 1.12 + (row % 2 ? .16 : 0), .015, row * .79 - 10.65);
      pose.rotation.y = Math.sin((row + 1) * (col + 5)) * .018;
      pose.scale.set(.91 + ((row * 13 + col * 7) % 9) * .011, 1, .88 + ((row * 5 + col * 3) % 9) * .014);
      pose.updateMatrix();
      pavers.setMatrixAt(index, pose.matrix);
      pavers.setColorAt(index, new THREE.Color(stone[(row * 5 + col * 3) % stone.length]));
      index++;
    }
  }
  pavers.count = index;
  scene.add(pavers);

  const wall = new THREE.MeshStandardMaterial({ color: 0xb49b76, roughness: .98, flatShading: true });
  const cap = new THREE.MeshStandardMaterial({ color: 0xd3bd96, roughness: .95, flatShading: true });
  for (const side of [-1, 1]) {
    addBox(scene, .45, .92, 22.8, 0xa88f6b, side * 8.45, .26, .3);
    addBox(scene, .58, .18, 22.9, 0xd0ba91, side * 8.45, .78, .3);
    for (let row = 0; row < 6; row++) {
      const z = -8.2 + row * 3.3;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(.4, .48, .16, 12), cap);
      base.position.set(side * 6.65, .08, z); scene.add(base);
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.26, .34, 2.75, 12, 1), wall);
      shaft.position.set(side * 6.65, 1.5, z); scene.add(shaft);
      const capital = new THREE.Mesh(new THREE.CylinderGeometry(.44, .31, .2, 12), cap);
      capital.position.set(side * 6.65, 2.98, z); scene.add(capital);
      addBox(scene, .65, .22, 3.38, 0xc8b28c, side * 6.65, 3.15, z - 1.52);
    }
  }

  // Low benches and lamps frame the reading area without blocking the image stations.
  const benchMaterial = new THREE.MeshStandardMaterial({ color: 0x61483a, roughness: .88 });
  for (const side of [-1, 1]) {
    for (const z of [-1.35, 2.05]) {
      addBox(scene, 1.35, .17, 2.05, 0x76604a, side * 5.35, .64, z);
      addBox(scene, .16, .64, .16, 0x61483a, side * 5.35 - .47, .3, z - .68);
      addBox(scene, .16, .64, .16, 0x61483a, side * 5.35 + .47, .3, z + .68);
    }
    const lamp = new THREE.Group();
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(.055, .085, 1.58, 8), benchMaterial);
    stem.position.y = .79; lamp.add(stem);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(.12, .08, .14, 8),
      new THREE.MeshStandardMaterial({ color: 0xc28a42, metalness: .18, roughness: .65 }));
    cup.position.y = 1.63; lamp.add(cup);
    const glow = new THREE.PointLight(0xffc46e, 4.2, 5.2, 2); glow.position.set(0, 1.62, 0); lamp.add(glow);
    lamp.position.set(side * 5.45, 0, -4.85); scene.add(lamp);
  }
}

export function makeJerusalem(scene, sky) {
  scene.add(panorama(sky, .08));
  scene.fog = new THREE.Fog(0xcdbb98, 52, 130);
  scene.add(new THREE.HemisphereLight(0xffeed3, 0x66533e, 1.92));
  const sunlight = new THREE.DirectionalLight(0xffdfad, 2.05);
  sunlight.position.set(-18, 21, -7);
  scene.add(sunlight);
  courtyard(scene);
  return () => {};
}
