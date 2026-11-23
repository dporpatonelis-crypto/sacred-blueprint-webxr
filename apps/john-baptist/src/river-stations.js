import * as THREE from 'three';
import { ManuscriptConnections } from '../../../shared/journey/manuscript-connections.js';
import { WaterQuiz } from '../../../shared/journey/water-quiz.js';
import { panel } from '../../../shared/journey/text-panels.js';
import { lesson } from './session.js';

const places = [[-4.13, -2.68], [-2.70, -4.73], [2.70, -4.73], [4.13, -2.68]];
const imageRadius = .90;
const imageHeight = 2.18;

export const riverWorld = {
  id: 'jordan-stations',
  spawn: [0, 4.9],
  xrSpawn: [0, 3.1],
  lookAt: [0, 1.65, -2.2],
  bounds: { minX: -6.8, maxX: 6.8, minZ: -5.8, maxZ: 9 },
  stations: lesson.stations.map((station, index) => ({
    ...station, position: places[index], height: 2.58
  }))
};
const vesselApproaches = places.map(() => ({ quizPosition: [0, -.12] }));

function makeFrame(scene, station, index, source) {
  const group = new THREE.Group();
  group.position.set(station.position[0], imageHeight, station.position[1]);
  scene.add(group);
  const map = source.clone();
  map.repeat.x = source.image.height / source.image.width;
  map.offset.x = (1 - map.repeat.x) / 2;
  map.needsUpdate = true;
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

export function makeRiverStations(root, camera, session, images, answer, finish) {
  const frames = new Map(riverWorld.stations.map((station, i) => [station.id, makeFrame(root, station, i, images[i])]));
  const muted = new THREE.Color(0xb0aaa1), bright = new THREE.Color(0xffffff);
  const bronze = new THREE.Color(0xb6854a), gold = new THREE.Color(0xffd986);
  const stories = {
    present(id, { reveal }) {
      const { art, rim } = frames.get(id);
      art.material.color.copy(muted).lerp(bright, reveal);
      rim.material.color.copy(bronze).lerp(gold, reveal);
    }
  };

  const manuscript = new ManuscriptConnections(root, riverWorld, session, stories, vesselApproaches, finish, {
    heading: 'Ο ΙΩΑΝΝΗΣ Ο ΒΑΠΤΙΣΤΗΣ',
    title: 'Το χειρόγραφο του Ιορδάνη',
    instruction: 'Γέμισε το δοχείο με τη λέξη που λείπει.',
    entryLabel: 'Σταθμός',
    entries: lesson.stations.map(station => ({
      stationId: station.id, text: station.before + station.word + station.after,
      keywords: [station.word], sourceLabel: station.title, interpretation: ''
    })),
    readingPages: [],
    centralPosition: [0, 2.07, -2.98],
    compactEntries: true,
    entryRowHeight: 130,
    maskUnsolvedKeywords: true,
    passiveEntries: true,
    flightMs: 1850,
    revealOnArrival: true,
    instantReduced: true,
    labelHeights: [1.02],
    labelSide: 0,
    labelFront: .18
  });
  const water = new WaterQuiz(root, riverWorld, session, camera, answer, vesselApproaches);
  const finishSign = panel('Οι τέσσερις συνδέσεις ολοκληρώθηκαν', 2.55, .31, null, { dark: true });
  finishSign.position.set(0, .69, -2.22);
  root.add(finishSign);

  return {
    water,
    manuscript,
    update(dt, head, reduced, paused) {
      for (const { group } of frames.values()) group.lookAt(head.x, group.position.y, head.z);
      finishSign.visible = session.complete;
      if (finishSign.visible) finishSign.lookAt(head.x, finishSign.position.y, head.z);
      manuscript.update(dt, head, reduced, paused);
    }
  };
}
