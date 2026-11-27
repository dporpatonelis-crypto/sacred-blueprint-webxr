import * as THREE from 'three';
import { panorama } from '../../../shared/journey/panorama.js';

const clay = new THREE.MeshStandardMaterial({ color: 0xb66e43, roughness: .96, flatShading: true });
const sunbaked = new THREE.MeshStandardMaterial({ color: 0xd49a5d, roughness: .98, flatShading: true });
const darkClay = new THREE.MeshStandardMaterial({ color: 0x744a35, roughness: .95, flatShading: true });
const metal = new THREE.MeshStandardMaterial({ color: 0x4f716e, roughness: .72, metalness: .22 });

function box(scene, width, height, depth, material, x, y, z, rotationY = 0) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  scene.add(mesh);
  return mesh;
}

function addBrickStacks(scene) {
  const brick = new THREE.BoxGeometry(.45, .22, .28);
  const materials = [clay, sunbaked, darkClay];
  const stacks = [[-6.8, -8.1, 3], [-5.9, -8.45, 2], [-7.25, -8.75, 2], [5.9, -10.6, 2]];
  for (const [x, z, rows] of stacks) {
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < 3 - (row % 2); col++) {
        const mesh = new THREE.Mesh(brick, materials[(row + col) % materials.length]);
        mesh.position.set(x + (col - 1) * .47 + (row % 2 ? .22 : 0), .11 + row * .23, z + (col % 2) * .02);
        scene.add(mesh);
      }
    }
  }
}

function addKiln(scene) {
  const kilnMaterial = new THREE.MeshStandardMaterial({ color: 0x86513a, roughness: .98, flatShading: true });
  const kiln = new THREE.Mesh(new THREE.CylinderGeometry(.72, .86, 1.18, 12, 1, false), kilnMaterial);
  kiln.position.set(-6.55, .59, -7.05);
  scene.add(kiln);
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.27, .07, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0xe89a49, emissive: 0x57240b, roughness: .75 }));
  mouth.position.set(-6.55, .31, -6.61);
  scene.add(mouth);
  const fire = new THREE.PointLight(0xeaa052, 1.25, 3.2, 2);
  fire.position.set(-6.55, .52, -6.38);
  scene.add(fire);
}

function addMeetingPlace(scene) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x98734b, roughness: .98, flatShading: true });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, .18, 12), stone);
  top.position.set(-5.45, .68, -10.2);
  scene.add(top);
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(.25, .31, .42, 8), darkClay);
    seat.position.set(-5.45 + Math.cos(angle) * 1.38, .21, -10.2 + Math.sin(angle) * 1.38);
    scene.add(seat);
  }
}

function addDivergingPaths(scene) {
  const stone = new THREE.MeshStandardMaterial({ color: 0x9e8058, roughness: 1, flatShading: true });
  const routes = [[-1, -1], [-.55, -1], [.55, -1], [1, -1]];
  for (const [side, forward] of routes) {
    for (let index = 0; index < 5; index++) {
      const t = index / 4;
      const x = side * (1.1 + t * 4.1);
      const z = -7.3 - t * 3.5;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(.65, .07, .48), stone);
      slab.position.set(x, .015, z + forward * .15);
      slab.rotation.y = side * -.24;
      scene.add(slab);
    }
  }
}

function addModernCorner(scene) {
  const water = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x3a9b9a, roughness: .28, metalness: .08, transparent: true, opacity: .86 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(6.0, -.015, -9.7);
  scene.add(water);
  const bridge = new THREE.MeshStandardMaterial({ color: 0xd6d1bd, roughness: .8 });
  box(scene, 2.4, .17, 1.55, bridge, 6.0, .18, -9.7);
  for (const side of [-1, 1]) box(scene, 2.4, .055, .06, metal, 6.0, .48, -9.7 + side * .68);

  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.65, .08, 1.05),
    new THREE.MeshStandardMaterial({ color: 0x26717d, roughness: .5, metalness: .28 }));
  panel.position.set(6.2, 1.27, -11.0);
  panel.rotation.x = -.32;
  scene.add(panel);
  for (const x of [5.55, 6.85]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(.035, .05, .8, 8), metal);
    leg.position.set(x, .69, -11.0);
    leg.rotation.x = -.32;
    scene.add(leg);
  }

  const canopy = new THREE.MeshStandardMaterial({ color: 0xe8e3d4, roughness: .92 });
  box(scene, 1.7, .13, 1.1, canopy, 7.2, 1.67, -10.4);
  for (const [x, z] of [[6.5, -10.0], [7.9, -10.0], [6.5, -10.8], [7.9, -10.8]]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.04, .05, 1.65, 8), metal);
    post.position.set(x, .83, z);
    scene.add(post);
  }
  const sign = box(scene, .27, .27, .045, new THREE.MeshStandardMaterial({ color: 0x5d9b70, roughness: .85 }), 7.2, 1.14, -9.93);
  sign.rotation.y = Math.PI;
}

export function makeShinar(scene, sky) {
  scene.add(panorama(sky, Math.PI / 2));
  scene.fog = new THREE.Fog(0xcaa678, 48, 118);
  scene.add(new THREE.HemisphereLight(0xffe4bd, 0x594130, 1.65));
  const sunlight = new THREE.DirectionalLight(0xffd29b, 2.15);
  sunlight.position.set(18, 23, -8);
  scene.add(sunlight);
  const glow = new THREE.PointLight(0xffd28a, 1.2, 18, 2);
  glow.position.set(0, 5.8, -10.3);
  scene.add(glow);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(52, 52),
    new THREE.MeshStandardMaterial({ color: 0xb98a56, roughness: 1, flatShading: true }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -.17;
  scene.add(ground);
  const paving = new THREE.Mesh(new THREE.PlaneGeometry(15.5, 18),
    new THREE.MeshStandardMaterial({ color: 0xc9a16d, roughness: 1, flatShading: true }));
  paving.rotation.x = -Math.PI / 2;
  paving.position.set(0, -.13, -4.5);
  scene.add(paving);

  addBrickStacks(scene);
  addKiln(scene);
  addMeetingPlace(scene);
  addDivergingPaths(scene);
  addModernCorner(scene);
  return () => {};
}
