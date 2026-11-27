import * as THREE from 'three';
import { ManuscriptConnections } from '../manuscript-connections.js';
import { WaterQuiz } from '../water-quiz.js';
import { panel } from '../text-panels.js';

const defaultPlaces = [[-4.13, -2.68], [-2.70, -4.73], [2.70, -4.73], [4.13, -2.68]];
const imageRadius = .90;
const imageHeight = 2.18;

function phasePlaces(count) {
  if (count === 4) return defaultPlaces;
  const radius = count > 6 ? 5.0 : 4.55;
  const centerZ = -2.2;
  return Array.from({ length: count }, (_, index) => {
    const angle = THREE.MathUtils.degToRad(-70 + index * 140 / Math.max(1, count - 1));
    return [Math.sin(angle) * radius, centerZ - Math.cos(angle) * radius];
  });
}

export function stationWorld(lesson, walkable = null) {
  const positions = new Map();
  for (const phase of lesson.phases) {
    const places = phasePlaces(phase.stations.length);
    phase.stations.forEach((station, index) => positions.set(station.id, station.position || places[index]));
  }
  const placed = lesson.stations.map(station => positions.get(station.id));
  return {
    id: lesson.id + '-stations',
    spawn: [0, 4.9], xrSpawn: [0, 3.1], lookAt: [0, .87, -.12],
    bounds: {
      minX: Math.min(-6.8, ...placed.map(([x]) => x - 1.2)),
      maxX: Math.max(6.8, ...placed.map(([x]) => x + 1.2)),
      minZ: Math.min(-5.8, ...placed.map(([, z]) => z - 1.8)),
      maxZ: 9
    },
    ...(walkable ? { walkable } : {}),
    promptHeight: lesson.promptHeight,
    stations: lesson.stations.map(station => ({
      ...station, position: positions.get(station.id), height: 2.58
    }))
  };
}

function illustrationTexture(source, fit, crop = null) {
  const { image } = source;
  if (crop) {
    const [left, top, width, height] = crop;
    const sx = Math.max(0, Math.min(image.width - 1, Math.round(left * image.width)));
    const sy = Math.max(0, Math.min(image.height - 1, Math.round(top * image.height)));
    const sw = Math.max(1, Math.min(image.width - sx, Math.round(width * image.width)));
    const sh = Math.max(1, Math.min(image.height - sy, Math.round(height * image.height)));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 768;
    canvas.getContext('2d').drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = source.colorSpace;
    texture.anisotropy = source.anisotropy;
    return texture;
  }
  if (!fit) {
    const texture = source.clone();
    texture.repeat.x = image.height / image.width;
    texture.offset.x = (1 - texture.repeat.x) / 2;
    texture.needsUpdate = true;
    return texture;
  }

  // Keep figures on both sides visible and fill the rim from the same image.
  const size = 768;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const wash = document.createElement('canvas');
  wash.width = wash.height = 32;
  const square = Math.min(image.width, image.height);
  wash.getContext('2d').drawImage(image, (image.width - square) / 2, (image.height - square) / 2,
    square, square, 0, 0, wash.width, wash.height);
  ctx.drawImage(wash, 0, 0, size, size);
  ctx.fillStyle = '#30292355';
  ctx.fillRect(0, 0, size, size);

  const still = document.createElement('canvas');
  still.width = size;
  still.height = Math.round(size * image.height / image.width);
  const foreground = still.getContext('2d');
  foreground.drawImage(image, 0, 0, still.width, still.height);
  const blend = foreground.createLinearGradient(0, 0, 0, still.height);
  blend.addColorStop(0, 'transparent');
  blend.addColorStop(.055, 'white');
  blend.addColorStop(.945, 'white');
  blend.addColorStop(1, 'transparent');
  foreground.globalCompositeOperation = 'destination-in';
  foreground.fillStyle = blend;
  foreground.fillRect(0, 0, still.width, still.height);
  ctx.drawImage(still, 0, (size - still.height) / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = source.colorSpace;
  texture.anisotropy = source.anisotropy;
  return texture;
}

function makeFrame(scene, station, index, source, fit, crop) {
  const group = new THREE.Group();
  group.position.set(station.position[0], imageHeight, station.position[1]);
  scene.add(group);
  const map = illustrationTexture(source, fit, crop);
  const art = new THREE.Mesh(new THREE.CircleGeometry(imageRadius, 64),
    new THREE.MeshBasicMaterial({ map, toneMapped: false }));
  const wood = new THREE.Mesh(new THREE.CylinderGeometry(.069, .11, imageHeight - .75, 12),
    new THREE.MeshStandardMaterial({ color: 0x705739, roughness: .95 }));
  wood.position.set(0, -(imageHeight + .75) / 2, -.09);
  const backing = new THREE.Mesh(new THREE.CircleGeometry(imageRadius + .083, 64),
    new THREE.MeshBasicMaterial({ color: 0x473c31, side: THREE.DoubleSide }));
  backing.position.z = -.015;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(imageRadius + .025, .032, 10, 64),
    new THREE.MeshBasicMaterial({ color: 0xc09356, toneMapped: false }));
  rim.position.z = .01;
  const sign = panel(String(index + 1) + ' · ' + station.title, 1.94, .26, null, { dark: true });
  sign.position.set(0, .995, .036);
  group.add(wood, backing, art, rim, sign);
  return { group, art, rim };
}

export function makeStations(root, camera, world, session, images, answer, finish) {
  const { lesson } = session;
  const approaches = world.stations.map(() => ({ quizPosition: [0, -.12] }));
  const muted = new THREE.Color(0xb0aaa1), bright = new THREE.Color(0xffffff);
  const bronze = new THREE.Color(0xb6854a), gold = new THREE.Color(0xffd986);
  const frames = new Map(), manuscripts = new Map(), phaseRoots = new Map();
  for (const [phaseIndex, phase] of lesson.phases.entries()) {
    const phaseRoot = new THREE.Group();
    root.add(phaseRoot);
    phaseRoots.set(phase.id, phaseRoot);
    const phaseStations = phase.stations.map(station => world.stations.find(item => item.id === station.id));
    const phaseWorld = { ...world, id: world.id + '-' + phase.id, stations: phaseStations };
    const phaseFrames = new Map();
    phaseStations.forEach((station, index) => {
      const imageIndex = lesson.stations.findIndex(item => item.id === station.id);
      const frame = makeFrame(phaseRoot, station, index, images[imageIndex], lesson.fitStationImages, station.imageCrop);
      frames.set(station.id, frame);
      phaseFrames.set(station.id, frame);
    });
    const stories = {
      present(id, { reveal }) {
        const { art, rim } = phaseFrames.get(id);
        art.material.color.copy(muted).lerp(bright, reveal);
        rim.material.color.copy(bronze).lerp(gold, reveal);
      }
    };
    const phaseApproaches = phaseStations.map(() => ({ quizPosition: [0, -.12] }));
    const manuscript = new ManuscriptConnections(root, phaseWorld, session, stories, phaseApproaches, finish, {
      heading: (phase.manuscriptHeading || phase.title).toLocaleUpperCase('el'),
      title: phase.manuscriptTitle || lesson.manuscriptTitle || phase.title,
      instruction: '',
      entryLabel: 'Σταθμός',
      entries: phase.stations.map(station => ({
        stationId: station.id, text: station.manuscriptText || station.before + station.word + station.after,
        keywords: [station.word], sourceLabel: station.title, interpretation: ''
      })),
      readingPages: [],
      centralPosition: [0, 2.07, -2.98],
      compactEntries: true,
      entryRowHeight: phase.entryRowHeight ?? lesson.manuscriptRowHeight ?? 130,
      entryFontSize: phase.entryFontSize ?? lesson.manuscriptEntryFontSize,
      entryBaseline: phase.entryBaseline ?? lesson.manuscriptEntryBaseline,
      entryLineHeight: phase.entryLineHeight ?? lesson.manuscriptEntryLineHeight,
      maskUnsolvedKeywords: lesson.maskUnsolvedKeywords ?? true,
      passiveEntries: true,
      flightMs: 1850,
      revealOnArrival: true,
      instantReduced: true,
      beamFromEdge: lesson.beamFromEdge,
      labelHeights: [1.02],
      labelSide: 0,
      labelFront: .18
    });
    manuscripts.set(phase.id, manuscript);
    phaseRoots.set(phase.id + ':manuscript', manuscript.root);
  }
  const water = new WaterQuiz(root, world, session, camera, answer, approaches);

  return {
    water,
    manuscripts,
    setPhase(id) {
      for (const phase of lesson.phases) {
        phaseRoots.get(phase.id).visible = phase.id === id;
        phaseRoots.get(phase.id + ':manuscript').visible = phase.id === id;
      }
    },
    update(dt, head, reduced, paused) {
      for (const phase of lesson.phases) {
        if (phase.id !== session.activePhase.id) continue;
        for (const station of phase.stations) frames.get(station.id).group.lookAt(head.x, frames.get(station.id).group.position.y, head.z);
        manuscripts.get(phase.id).update(dt, head, reduced, paused);
      }
    }
  };
}
