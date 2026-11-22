import * as THREE from 'three';
import { panel } from '../../../shared/journey/text-panels.js';
import { IslandPuzzle } from '../../../shared/puzzles/puzzle-board.js';
import { lesson } from './session.js';
import worlds from './data/worlds.json';

export const assetUrl = path => import.meta.env.BASE_URL + path;
export const WATER_APPROACH = { landing: [0, 7.35], position: [-.8, 2.65], lookHeight: 1.65 };

const palette = [0xc9a561, 0x649c9a, 0xa77eaf, 0x7db98f, 0x779ebc];
const positions = [[-9.4, .35], [-6.5, -6.6], [0, -9.8], [6.5, -6.6], [9.4, .35]];
const imagePositions = [[-5.7, -1.45], [-3.75, -5], [0, -6.5], [3.75, -5], [5.7, -1.45]];
const hubCenter = [0, 8.4];
const gold = 0xe5b76b;
const textureLoader = new THREE.TextureLoader();

export const HUB = {
  ...worlds.hub,
  stations: lesson.religions.map(({ id }, index) => {
    const [x, z] = positions[index];
    return { id, position: [x, z + .8], landing: [x, z + 4.45] };
  }),
  walkable: {
    circles: [{ x: 0, z: hubCenter[1], radius: 4.6 }, ...positions.map(([x, z]) => ({ x, z: z + 1.05, radius: 4 }))],
    paths: positions.map(([x, z]) => ({ from: hubCenter, to: [x, z + 1.05], width: 2.1 }))
  }
};

export function planetWorld(religion) {
  return {
    ...worlds[religion.id],
    stations: religion.scenes.map((scene, i) => ({ id: scene.id, position: imagePositions[i], height: 3.84 }))
  };
}

function add(parent, geometry, material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

const matte = color => new THREE.MeshStandardMaterial({ color, roughness: .85 });

function flatRing(root, x, z, height, radius, width, color, opacity = 1) {
  const ring = add(root, new THREE.RingGeometry(radius - width, radius, 80),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: opacity < 1, opacity }),
    x, height, z);
  ring.rotation.x = -Math.PI / 2;
  return ring;
}

function stonePlatform(root, x, z, radius, accent) {
  const stone = matte(0xa38962);
  add(root, new THREE.CylinderGeometry(radius, radius * .83, .58, 60), [stone, matte(0xddcba4), stone], x, -.29, z);
  flatRing(root, x, z, .009, radius * .973, .075, accent);
  flatRing(root, x, z, .013, radius * .925, .024, 0x9d794b, .48);
  flatRing(root, x, z, .012, radius * .49, .022, 0xb59467, .40);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, r = radius * .94;
    const peg = add(root, new THREE.BoxGeometry(.065, .016, .20), matte(0xbc9055),
      x + Math.cos(a) * r, .013, z + Math.sin(a) * r);
    peg.rotation.y = Math.PI / 2 - a;
  }
}

function bridge(root, from, to) {
  const dx = to[0] - from[0], dz = to[1] - from[1], distance = Math.hypot(dx, dz);
  const floor = add(root, new THREE.BoxGeometry(2.12, .18, distance), matte(0xb79b72),
    (from[0] + to[0]) / 2, -.12, (from[1] + to[1]) / 2);
  floor.rotation.y = Math.atan2(dx, dz);
  const trim = new THREE.MeshBasicMaterial({ color: 0xc49452 });
  for (const side of [-1, 1]) add(floor, new THREE.BoxGeometry(.04, .022, distance), trim, side * .99, .095, 0);
}

function decorate(root, x, z, tone) {
  const base = new THREE.Group();
  root.add(base);
  base.position.set(x, 0, z);
  add(base, new THREE.CylinderGeometry(.26, .34, .14, 10), matte(0xb29468), 0, .07, 0);
  const stone = matte(tone);
  add(base, new THREE.IcosahedronGeometry(.23, 0), stone, 0, .21, 0).scale.set(1, .75, 1);
  add(base, new THREE.IcosahedronGeometry(.16, 0), stone, -.19, .16, .15);
}

function earthTexture(color, index) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const hue = new THREE.Color(color);
  const shade = factor => '#' + hue.clone().multiplyScalar(factor).getHexString();
  ctx.fillStyle = shade(.75);
  ctx.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 15; i++) {
    const y = i * 19 - 6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= 512; x += 8) {
      const angle = x / 256 * Math.PI;
      ctx.lineTo(x, y + Math.sin(angle + i * .53 + index) * 8 + Math.cos(angle * 3 + i * .71) * 4);
    }
    ctx.lineTo(512, y + 25);
    ctx.lineTo(0, y + 25);
    ctx.closePath();
    ctx.fillStyle = shade(.48 + ((i * 7 + index * 2) % 11) * .078);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

async function texture(path) {
  const image = await textureLoader.loadAsync(assetUrl(path));
  image.colorSpace = THREE.SRGBColorSpace;
  image.anisotropy = 4;
  return image;
}

async function light(scene, world) {
  const sky = await texture(world.skybox);
  sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = sky;
  scene.backgroundRotation.y = Math.PI * .45;
  scene.add(new THREE.HemisphereLight(0xffe7c8, 0x537e7b, 2.25));
  const sun = new THREE.DirectionalLight(0xffe1aa, 2.1);
  sun.position.set(-7, 11, 6);
  scene.add(sun);
}

function teleportMarkers(scene, points) {
  return points.map(point => {
    const mesh = flatRing(scene, point[0], point[1], .037, .43, .085, 0xfad08a, .8);
    mesh.userData.action = { type: 'teleport', point };
    mesh.visible = false;
    return mesh;
  });
}

function face(mesh, head) {
  mesh.lookAt(head.x, mesh.position.y, head.z);
}

export async function buildHub(scene, session, onSolved) {
  await light(scene, HUB);
  for (const circle of positions) bridge(scene, hubCenter, [circle[0], circle[1] + 1.05]);
  stonePlatform(scene, ...hubCenter, 4.7, gold);
  const boards = new Map();
  const pickables = [];
  const labels = [];
  const spheres = [];
  const images = await Promise.all(lesson.religions.map(religion => texture(religion.scenes[0].imageSrc)));
  lesson.religions.forEach((religion, index) => {
    const station = HUB.stations[index], [x, z] = positions[index], accent = palette[index];
    stonePlatform(scene, x, z + 1.05, 3.9, accent);
    decorate(scene, x - 2.9, z + 2.3, accent);
    decorate(scene, x + 2.8, z + 1.8, accent);

    const sphere = add(scene, new THREE.SphereGeometry(2.07, 48, 32),
      new THREE.MeshStandardMaterial({ map: earthTexture(accent, index), roughness: .88, emissive: accent, emissiveIntensity: .13 }),
      x, 4.05, z - 1.62);
    sphere.rotation.z = -.22 + index * .065;
    sphere.userData.action = { type: 'planet', id: religion.id };
    spheres.push({ id: religion.id, sphere });
    pickables.push(sphere);

    const orbit = add(scene, new THREE.RingGeometry(2.42, 2.49, 100),
      new THREE.MeshBasicMaterial({ color: gold, side: THREE.DoubleSide, opacity: .70, transparent: true, depthWrite: false }),
      x, 4.02, z - 1.61);
    orbit.rotation.set(Math.PI / 2.44, 0, -.38 + index * .07);

    const title = panel(religion.label, 3.0, .43, { type: 'planet', id: religion.id }, { dark: true });
    title.position.set(x, 6.38, z - 1.36);
    scene.add(title);
    labels.push(title);
    pickables.push(title);

    const board = new IslandPuzzle(scene, session.activity(religion.id), images[index], station,
      { id: religion.id, title: religion.label }, onSolved,
      { enterLabel: 'Στον πλανήτη →', solvedLabel: 'Ο πλανήτης άνοιξε', allowAutoSolve: true });
    board.setUnlocked(session.isOpen(religion.id));
    boards.set(religion.id, board);
    pickables.push(...board.pickables);
  });

  const teleports = teleportMarkers(scene, [HUB.spawn, ...HUB.stations.map(station => station.landing)]);
  return {
    world: HUB, boards, pickables: [...pickables, ...teleports],
    update(dt, head, reduced, xr) {
      for (const label of labels) face(label, head);
      for (const [id, board] of boards) {
        board.setUnlocked(session.isOpen(id));
        board.update(dt, reduced);
      }
      for (const { id, sphere } of spheres) {
        if (!reduced) sphere.rotation.y += dt * .12;
        sphere.material.emissiveIntensity = session.isOpen(id) ? .30 : .13;
      }
      for (const marker of teleports) marker.visible = xr;
    },
    dispose() { for (const board of boards.values()) board.dispose(); }
  };
}

export async function buildPlanet(scene, religion) {
  const world = planetWorld(religion);
  await light(scene, world);
  const accent = palette[lesson.religions.indexOf(religion)];
  stonePlatform(scene, 0, 0, 10, accent);
  flatRing(scene, 0, 0, .019, 8.9, .17, 0x329f9c, .72);
  for (const point of [[-8, -2], [8, -2], [-6.9, 3.2], [6.9, 3.2], [-7, -5], [7, -5]]) decorate(scene, ...point, accent);

  const frames = new Map();
  const pickables = [];
  const textures = new Map();
  const pictures = await Promise.all(religion.scenes.map(station => {
    if (!textures.has(station.imageSrc)) textures.set(station.imageSrc, texture(station.imageSrc));
    return textures.get(station.imageSrc);
  }));
  for (const [index, station] of world.stations.entries()) {
    const content = religion.scenes[index], [x, z] = station.position;
    const frame = new THREE.Group();
    frame.position.set(x, 2.92, z);
    scene.add(frame);
    const image = add(frame, new THREE.CircleGeometry(1.19, 68),
      new THREE.MeshBasicMaterial({ map: pictures[index], color: 0x667575, side: THREE.DoubleSide, toneMapped: false }));
    image.userData.action = { type: 'station', id: station.id };
    const rim = add(frame, new THREE.RingGeometry(1.19, 1.23, 68),
      new THREE.MeshBasicMaterial({ color: gold, side: THREE.DoubleSide, toneMapped: false }), 0, 0, .004);
    const caption = panel((index + 1) + ' · ' + content.axis, 2.88, .34, { type: 'station', id: station.id }, { dark: true, small: true });
    caption.position.set(0, 1.45, .015);
    frame.add(caption);
    frames.set(station.id, { frame, image, rim });
    pickables.push(image, caption);
  }

  const teleports = teleportMarkers(scene, [world.spawn, WATER_APPROACH.landing, [-4.2, 2.5], [4.2, 2.5], [0, .3]]);
  const back = panel('Στους πλανήτες ↗', 1.9, .38, { type: 'hub' }, { dark: true });
  back.position.set(-4.45, 1.3, 3.6);
  scene.add(back);
  const bright = new THREE.Color(0xffffff), pending = new THREE.Color(0x526465), lit = new THREE.Color(gold);
  return {
    world, pickables: [...pickables, back, ...teleports],
    illustrations: {
      present(id, { reveal }) {
        const item = frames.get(id);
        item.image.material.color.copy(pending).lerp(bright, reveal);
        item.rim.material.color.copy(lit).multiplyScalar(.48 + reveal * .52);
      }
    },
    update(dt, head, reduced, xr) {
      for (const { frame } of frames.values()) face(frame, head);
      back.visible = xr;
      if (xr) face(back, head);
      for (const marker of teleports) marker.visible = xr;
    }
  };
}

export function disposeScene(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  if (scene.background?.isTexture) textures.add(scene.background);
  scene.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!material) continue;
      materials.add(material);
      if (material.map) textures.add(material.map);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const image of textures) image.dispose();
  scene.removeFromParent();
}
