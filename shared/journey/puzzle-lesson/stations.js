import * as THREE from 'three';
import { ManuscriptConnections } from '../manuscript-connections.js';
import { WaterQuiz } from '../water-quiz.js';
import { panel } from '../text-panels.js';

const defaultPlaces = [[-4.13, -2.68], [-2.70, -4.73], [2.70, -4.73], [4.13, -2.68]];
const imageRadius = .90;
const imageHeight = 2.18;

export function stationWorld(lesson) {
  const positions = lesson.stations.map((station, index) =>
    station.position || defaultPlaces[index] || [Math.cos(index / lesson.stations.length * Math.PI * 2) * 4.2,
      Math.sin(index / lesson.stations.length * Math.PI * 2) * 4.2 - 2.4]);
  return {
    id: lesson.id + '-stations',
    spawn: [0, 4.9], xrSpawn: [0, 3.1], lookAt: [0, .87, -.12],
    bounds: {
      minX: Math.min(-6.8, ...positions.map(([x]) => x - 1.2)),
      maxX: Math.max(6.8, ...positions.map(([x]) => x + 1.2)),
      minZ: Math.min(-5.8, ...positions.map(([, z]) => z - 1.8)),
      maxZ: 9
    },
    promptHeight: lesson.promptHeight,
    stations: lesson.stations.map((station, index) => ({
      ...station, position: positions[index], height: 2.58
    }))
  };
}

function illustrationTexture(source, fit) {
  const { image } = source;
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

function makeFrame(scene, station, index, source, fit) {
  const group = new THREE.Group();
  group.position.set(station.position[0], imageHeight, station.position[1]);
  scene.add(group);
  const map = illustrationTexture(source, fit);
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
  const frames = new Map(world.stations.map((station, i) =>
    [station.id, makeFrame(root, station, i, images[i], lesson.fitStationImages)]));
  const muted = new THREE.Color(0xb0aaa1), bright = new THREE.Color(0xffffff);
  const bronze = new THREE.Color(0xb6854a), gold = new THREE.Color(0xffd986);
  const stories = {
    present(id, { reveal }) {
      const { art, rim } = frames.get(id);
      art.material.color.copy(muted).lerp(bright, reveal);
      rim.material.color.copy(bronze).lerp(gold, reveal);
    }
  };

  const manuscript = new ManuscriptConnections(root, world, session, stories, approaches, finish, {
    heading: lesson.title.toLocaleUpperCase('el'),
    title: lesson.manuscriptTitle,
    instruction: '',
    entryLabel: 'Σταθμός',
    entries: lesson.stations.map(station => ({
      stationId: station.id, text: station.manuscriptText || station.before + station.word + station.after,
      keywords: [station.word], sourceLabel: station.title, interpretation: ''
    })),
    readingPages: [],
    centralPosition: [0, 2.07, -2.98],
    compactEntries: true,
    entryRowHeight: lesson.manuscriptRowHeight ?? 130,
    entryFontSize: lesson.manuscriptEntryFontSize,
    entryBaseline: lesson.manuscriptEntryBaseline,
    entryLineHeight: lesson.manuscriptEntryLineHeight,
    maskUnsolvedKeywords: true,
    passiveEntries: true,
    flightMs: 1850,
    revealOnArrival: true,
    instantReduced: true,
    beamFromEdge: lesson.beamFromEdge,
    labelHeights: [1.02],
    labelSide: 0,
    labelFront: .18
  });
  const water = new WaterQuiz(root, world, session, camera, answer, approaches);

  return {
    water,
    manuscript,
    update(dt, head, reduced, paused) {
      for (const { group } of frames.values()) group.lookAt(head.x, group.position.y, head.z);
      manuscript.update(dt, head, reduced, paused);
    }
  };
}
