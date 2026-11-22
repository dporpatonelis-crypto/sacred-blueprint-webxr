import * as THREE from 'three';
import { panel, setText } from '../../../shared/journey/text-panels.js';
import { assetUrl, byId, gatePicture, ids, picturePath, pictures, ringNames, stages, tiles, worlds } from './content.js';

const palette = {
  dark: { background: '#192a4b', border: '#ccaf70', text: '#f9e9c7' },
  chosen: { background: '#42557d', border: '#efcb83', text: '#fff0c7' },
  paper: { background: '#eddbad', border: '#b78a49', text: '#352718' },
  gold: { background: '#efca84', border: '#fff1c0', text: '#2b2118' },
  locked: { background: '#273046', border: '#7f745e', text: '#a5a097' },
  miss: { background: '#4e343c', border: '#df987a', text: '#ffe0d6' }
};

const stone = [0x8b735a, 0xb39a75, 0xc2a47b, 0x9d8569].map(color => new THREE.MeshStandardMaterial({ color, roughness: .96 }));
const wood = new THREE.MeshStandardMaterial({ color: 0x3d2b27, roughness: .84 });
const brass = new THREE.MeshStandardMaterial({ color: 0xc39959, metalness: .43, roughness: .5 });
const dark = new THREE.MeshBasicMaterial({ color: 0x1c2b46 });
const white = new THREE.Color(0xffffff);
const gold = new THREE.Color(0xffcc79);
const wall = new THREE.BoxGeometry(1, 1, 1);

function mesh(parent, geometry, material, x, y, z) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function block(parent, x, y, z, w, h, d, material) {
  const object = mesh(parent, wall, material, x, y, z);
  object.scale.set(w, h, d);
  return object;
}

export function setSign(node, text, tone = 'dark') {
  if (node.userData.label === text && node.userData.tone === tone) return;
  node.userData.label = text;
  node.userData.tone = tone;
  setText(node, text, { palette: palette[tone], selected: tone === 'chosen' });
}

function sign(parent, text, w, h, x, y, z, action, tone = 'dark') {
  const node = panel(text, w, h, action, { palette: palette[tone] });
  node.position.set(x, y, z);
  node.userData.label = text;
  node.userData.tone = tone;
  parent.add(node);
  return node;
}

function cropped(texture, left, top, right, bottom) {
  const result = texture.clone();
  result.repeat.set((right - left) / 100, (bottom - top) / 100);
  result.offset.set(left / 100, 1 - bottom / 100);
  result.needsUpdate = true;
  return result;
}

function artwork(parent, texture, w, h, x, y, z, color = 0xffffff, opacity = 1) {
  return mesh(parent, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({
    map: texture, color, transparent: opacity < 1, opacity, toneMapped: false
  }), x, y, z);
}

function paving(parent) {
  block(parent, 0, -.18, 2.4, 14, .28, 14.4, stone[0]);
  const geometry = new THREE.BoxGeometry(1.2, .054, .73);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .98 });
  const pavers = new THREE.InstancedMesh(geometry, material, 10 * 17);
  const matrix = new THREE.Matrix4();
  const colors = [0x8d765d, 0x9d8265, 0xa99172, 0xb29a7b, 0xbda383].map(value => new THREE.Color(value));
  for (let row = 0; row < 17; row++) {
    for (let col = 0; col < 10; col++) {
      const index = row * 10 + col;
      matrix.makeTranslation((col - 4.5) * 1.34 + (row % 2 ? .21 : -.21), -.035, row * .78 - 4.04);
      pavers.setMatrixAt(index, matrix);
      pavers.setColorAt(index, colors[(row * 7 + col * 3 + col * row) % colors.length]);
    }
  }
  parent.add(pavers);
}

function arch(parent, x, z, scale) {
  const radius = 1.82 * scale, depth = .6 * scale, spring = 2.18 * scale;
  for (const side of [-1, 1]) {
    for (let row = 0; row < 5; row++) {
      block(parent, x + side * radius, (row + .5) * spring / 5, z, .5 * scale, spring / 5 - .022, depth, stone[row % stone.length]);
    }
  }
  for (let step = 0; step < 12; step++) {
    const angle = Math.PI * (step + .5) / 12;
    const piece = block(parent, x + radius * Math.cos(angle), spring + radius * Math.sin(angle), z,
      .48 * scale, radius * Math.PI / 12 + .03, depth, stone[(step + 1) % stone.length]);
    piece.rotation.z = angle;
  }
}

function lamp(parent, x, z, tall = 1.5) {
  mesh(parent, new THREE.CylinderGeometry(.055, .085, tall, 8), brass, x, tall / 2, z);
  mesh(parent, new THREE.CylinderGeometry(.05, .19, .16, 6), brass, x, tall + .4, z);
  mesh(parent, new THREE.CylinderGeometry(.13, .1, .28, 6),
    new THREE.MeshStandardMaterial({ color: 0xffcb7d, emissive: 0xff9b32, emissiveIntensity: .91 }), x, tall + .18, z);
  const light = new THREE.PointLight(0xffaa53, 9, 7, 1.9);
  light.position.set(x, tall + .22, z + .17);
  parent.add(light);
}

function ruins(parent, inside) {
  paving(parent);
  for (const side of [-1, 1]) {
    const x = side * 6.48;
    block(parent, x, .24, .9, .45, .48, 9.6, stone[0]);
    block(parent, x, .49, .9, .61, .13, 9.6, stone[2]);
    for (const z of [-3.8, -.8, 2.2, 5.2]) block(parent, x, .65, z, .71, 1.3, .71, stone[1]);
    lamp(parent, side * 5.43, -.1);
    if (inside) arch(parent, side * 3.75, -4.55, 1.16);
  }
  arch(parent, 0, -4.82, inside ? 1.58 : 1.77);
  if (inside) {
    block(parent, -5.95, 1.54, -4.67, .65, 3.08, .64, stone[1]);
    block(parent, 5.95, 1.54, -4.67, .65, 3.08, .64, stone[1]);
  }
}

function frame(parent, x, y, z, w, h) {
  block(parent, x, y, z - .16, w + .24, h + .26, .22, wood);
  block(parent, x, y, z - .041, w + .14, h + .15, .08, brass);
  block(parent, x, y, z - .004, w, h, .025, dark);
  for (const side of [-1, 1]) block(parent, x + side * w * .35, Math.max(.24, (y - h / 2) / 2), z - .34,
    .13, Math.max(.48, y - h / 2), .28, wood);
}

function buildGate(group, texture, pickables) {
  const stepX = 1.16, stepY = .99, width = 1.12, height = width * 27 / 32;
  const tileAt = (index, x, z) => new THREE.Vector3(x + (index % 3 - 1) * stepX,
    2.15 + (.5 - Math.floor(index / 3)) * stepY, z);
  const slots = tiles.map(index => tileAt(index, -2.07, -1.93));
  const tray = tiles.map(index => tileAt(index, 2.07, -1.93));
  frame(group, -2.07, 2.15, -2, 3.51, 2.02);
  frame(group, 2.07, 2.15, -2, 3.51, 2.02);
  sign(group, stages.gate.place, 4.6, .49, 0, 4.18, -2, null, 'dark');
  sign(group, 'Η εικόνα', 2.56, .34, -2.07, 3.46, -1.97, null, 'gold');
  sign(group, 'Τα κομμάτια', 2.56, .34, 2.07, 3.46, -1.97, null, 'paper');

  const targets = slots.map((slot, index) => {
    const target = mesh(group, new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: 0x2b3b58 }), slot.x, slot.y, slot.z - .026);
    target.userData.action = { type: 'slot', value: index };
    pickables.push(target);
    return target;
  });
  const parts = tiles.map(tile => {
    const col = tile % 3 * 100 / 3, row = Math.floor(tile / 3) * 50;
    const part = artwork(group, cropped(texture, col, row, col + 100 / 3, row + 50), width, height, 0, 0, -1.93);
    part.userData.action = { type: 'tile', value: tile };
    pickables.push(part);
    return { part, goal: new THREE.Vector3() };
  });
  const reference = artwork(group, texture, width * 3, height * 2, -2.07, 2.15, -1.83);
  const progress = sign(group, '0/6', 1.15, .34, -2.08, .87, -1.95);
  const see = sign(group, 'Δες την εικόνα', 1.82, .36, -2.92, .38, -1.95, { type: 'preview' });
  const shuffle = sign(group, 'Ανακάτεμα', 1.54, .36, -1.17, .38, -1.95, { type: 'shuffle' });
  const auto = sign(group, 'Αυτόματη λύση', 1.82, .36, 1.17, .86, -1.95, { type: 'auto' });
  const enter = sign(group, 'Στη Βηθλεέμ →', 1.98, .36, 3.15, .86, -1.95, { type: 'travel', value: 'meaning' }, 'locked');
  pickables.push(see, shuffle, auto, enter);
  let first = true;
  return {
    sync(session, view) {
      const { placed, tray: order } = session.state;
      setSign(progress, placed.length + '/6', session.gateOpen ? 'gold' : 'dark');
      reference.visible = view.reference;
      targets.forEach((target, index) => {
        target.userData.disabled = placed.includes(index) || view.assisting || view.reference;
        target.material.color.set(index === view.missedSlot ? 0xa56558 : 0x2b3b58);
      });
      parts.forEach(({ part, goal }, tile) => {
        const locked = placed.includes(tile);
        goal.copy(locked ? slots[tile] : tray[order.indexOf(tile)]);
        if (first || view.reduced) part.position.copy(goal);
        part.material.color.copy(view.tile === tile ? gold : white);
        part.userData.disabled = locked || view.assisting;
      });
      first = false;
      setSign(see, view.reference ? 'Κλείσε την εικόνα' : 'Δες την εικόνα');
      setSign(auto, view.assisting ? 'Διακοπή λύσης' : 'Αυτόματη λύση', session.gateOpen ? 'locked' : 'dark');
      setSign(enter, 'Στη Βηθλεέμ →', session.gateOpen ? 'gold' : 'locked');
      auto.userData.disabled = session.gateOpen;
      shuffle.userData.disabled = view.assisting || session.gateOpen;
      setSign(shuffle, 'Ανακάτεμα', shuffle.userData.disabled ? 'locked' : 'dark');
      enter.userData.disabled = !session.gateOpen;
    },
    tick(dt) {
      const amount = 1 - Math.exp(-dt * 16);
      parts.forEach(({ part, goal }) => part.position.lerp(goal, amount));
    }
  };
}

function learningPicture(group, stage, texture, w, x, y, z, pickables) {
  const h = w * pictures[stage].height / pictures[stage].width;
  frame(group, x, y, z - .025, w, h);
  artwork(group, texture, w, h, x, y, z, 0x73716c);
  const layers = pictures[stage].regions.map(region => {
    const [left, top, right, bottom] = region.bounds;
    const layer = artwork(group, cropped(texture, ...region.bounds), w * (right - left) / 100,
      h * (bottom - top) / 100, x + ((left + right) / 200 - .5) * w, y + (.5 - (top + bottom) / 200) * h, z + .012, 0xffffff, 0);
    layer.material.depthWrite = false;
    if (pickables) {
      layer.userData.action = { type: 'target', value: region.id };
      pickables.push(layer);
    }
    return { layer, id: region.id, opacity: 0 };
  });
  return {
    sync(solved, reduced) {
      layers.forEach(item => {
        item.opacity = Number(solved.includes(item.id));
        if (reduced) item.layer.material.opacity = item.opacity;
      });
    },
    tick(dt) {
      layers.forEach(({ layer, opacity }) => {
        layer.material.opacity = THREE.MathUtils.damp(layer.material.opacity, opacity, 9, dt);
      });
    }
  };
}

function buildMeaning(group, texture, pickables) {
  const picture = learningPicture(group, 'meaning', texture, 5.35, -1.62, 2.19, -1.94, pickables);
  sign(group, stages.meaning.name, 4.8, .49, 0, 4.18, -1.97);
  const targets = ids.map((id, index) => sign(group, byId[id].target, 1.71, .43,
    -3.41 + index * 1.79, .84, -1.92, { type: 'target', value: id }));
  const cards = ['welcome', 'uplift', 'birth'].map((id, index) => sign(group, byId[id].concept, 2.34, .49,
    2.76, 2.96 - index * .72, -1.95, { type: 'card', value: id }, 'paper'));
  const hint = sign(group, 'Υπόδειξη', 1.15, .37, 2.15, .97, -1.95, { type: 'hint' });
  const next = sign(group, 'Στον ύμνο →', 1.44, .37, 3.5, .97, -1.95, { type: 'travel', value: 'hymn' }, 'locked');
  const progress = sign(group, '0/3', 1.3, .32, -1.64, .33, -1.95);
  pickables.push(...targets, ...cards, hint, next);
  return {
    sync(session, view) {
      const solved = session.state.meaning;
      picture.sync(solved, view.reduced);
      targets.forEach((target, index) => {
        const id = ids[index];
        setSign(target, byId[id].target, solved.includes(id) ? 'gold' : view.meaningTarget === id ? 'chosen' : 'dark');
      });
      cards.forEach(card => {
        const id = card.userData.action.value;
        card.userData.disabled = solved.includes(id);
        setSign(card, byId[id].concept, card.userData.disabled ? 'locked' : view.card === id ? 'chosen' : 'paper');
      });
      hint.userData.disabled = session.hymnOpen;
      setSign(hint, 'Υπόδειξη', hint.userData.disabled ? 'locked' : 'dark');
      setSign(next, 'Στον ύμνο →', session.hymnOpen ? 'gold' : 'locked');
      setSign(progress, solved.length + '/3', session.hymnOpen ? 'gold' : 'dark');
      next.userData.disabled = !session.hymnOpen;
    },
    tick: picture.tick
  };
}

function buildHymn(group, texture, pickables) {
  const picture = learningPicture(group, 'hymn', texture, 4.87, -1.95, 2.71, -1.97);
  sign(group, stages.hymn.name, 4.65, .45, 0, 4.42, -1.97);
  const ringX = 2.59, ringY = 2.89;
  const faces = ids.map((id, index) => {
    const radius = [1.02, .73, .43][index];
    const face = mesh(group, new THREE.RingGeometry(Math.max(.045, radius - .277), radius, 54),
      new THREE.MeshBasicMaterial({ color: 0x243b61, side: THREE.DoubleSide }), ringX, ringY, -1.91 + index * .012);
    mesh(group, new THREE.RingGeometry(radius - .019, radius, 54), brass, ringX, ringY, face.position.z + .003);
    const marker = mesh(group, new THREE.SphereGeometry(.042, 12, 8), brass, ringX, ringY, face.position.z + .07);
    sign(group, String(index + 1), .285, .22, ringX, ringY + radius - .15, face.position.z + .036, null);
    face.userData.action = { type: 'ring', value: id };
    pickables.push(face);
    return { face, marker, radius };
  });
  const rows = ids.map((id, index) => sign(group, ringNames[index], 3.2, .34,
    2.59, 1.54 - index * .36, -1.94, { type: 'ring', value: id }));
  const options = ['uplift', 'birth', 'welcome'].map((id, index) => {
    const x = -3.56 + index * 1.59;
    const phrase = sign(group, byId[id].full, 1.51, .48, x, 1.09, -1.94, { type: 'phrase', value: id }, 'paper');
    const clip = sign(group, '♫ Άκου', 1.25, .31, x, .66, -1.94, { type: 'listen', value: id });
    pickables.push(phrase, clip);
    return phrase;
  });
  const sequence = sign(group, 'Άκου τη σωστή ακολουθία', 2.04, .34, -3.07, .22, -1.92, { type: 'listen', value: 'sequence' }, 'gold');
  const full = sign(group, 'Ολόκληρος ο ειρμός', 1.71, .34, -1.1, .22, -1.92, { type: 'listen', value: 'full' });
  const hint = sign(group, 'Υπόδειξη', 1.16, .34, 1.55, .38, -1.94, { type: 'hint' });
  const seal = sign(group, 'Σφραγίδα  ·  0/3', 1.9, .36, 3.14, .38, -1.94, { type: 'check-hymn' }, 'gold');
  const pause = sign(group, 'Παύση', .85, .31, -.1, 1.05, -1.94, { type: 'pause' });
  const stop = sign(group, 'Διακοπή', .85, .31, -.1, .68, -1.94, { type: 'stop' });
  pickables.push(...rows, sequence, full, hint, seal, pause, stop);
  return {
    sync(session, view) {
      const { hymn, choices } = session.state;
      picture.sync(hymn, view.reduced);
      faces.forEach(({ face, marker, radius }, index) => {
        const locked = hymn.includes(ids[index]);
        const active = view.ring === ids[index];
        face.material.color.set(locked ? 0xb38d50 : active ? 0x5274a5 : [0x273b60, 0x34496f, 0x223659][index]);
        const angle = Math.PI / 2 - ids.indexOf(choices[index]) * Math.PI * 2 / ids.length;
        marker.position.x = ringX + Math.cos(angle) * (radius - .088);
        marker.position.y = ringY + Math.sin(angle) * (radius - .088);
        setSign(rows[index], (index + 1) + ' · ' + byId[choices[index]].full, locked ? 'gold' : active ? 'chosen' : 'dark');
      });
      options.forEach(node => {
        const id = node.userData.action.value;
        setSign(node, byId[id].full, view.phrase === id ? 'chosen' : 'paper');
      });
      sequence.visible = full.visible = session.complete;
      hint.userData.disabled = seal.userData.disabled = session.complete;
      setSign(seal, session.complete ? 'Ο ύμνος ολοκληρώθηκε' : 'Σφραγίδα  ·  ' + hymn.length + '/3', 'gold');
      setSign(hint, 'Υπόδειξη', session.complete ? 'locked' : 'dark');
      pause.visible = ['playing', 'paused'].includes(view.audio);
      stop.visible = pause.visible || view.audio === 'loading';
      setSign(pause, view.audio === 'paused' ? 'Συνέχεια' : 'Παύση');
    },
    tick: picture.tick
  };
}

function markers(group, points, pickables) {
  const material = new THREE.MeshBasicMaterial({ color: 0xffd490, transparent: true, opacity: .74, side: THREE.DoubleSide });
  points.forEach(point => {
    const marker = mesh(group, new THREE.CircleGeometry(.33, 28), material, point[0], .019, point[1]);
    marker.rotation.x = -Math.PI / 2;
    marker.userData.action = { type: 'teleport', value: point };
    const center = mesh(group, new THREE.CircleGeometry(.19, 20), dark, point[0], .024, point[1]);
    center.rotation.x = -Math.PI / 2;
    pickables.push(marker);
  });
}

export async function buildBethlehem(scene) {
  const loader = new THREE.TextureLoader();
  const [sky, gate, meaning, hymn] = await Promise.all([
    worlds.gate.skybox, gatePicture, picturePath('meaning'), picturePath('hymn')
  ].map(async path => {
    const texture = await loader.loadAsync(assetUrl(path));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }));
  sky.mapping = THREE.EquirectangularReflectionMapping;
  scene.background = sky;
  scene.backgroundRotation.set(-.50, Math.PI / 2, 0, 'YXZ');
  scene.backgroundIntensity = .93;
  const moon = new THREE.DirectionalLight(0xbbd1ff, 1.48);
  moon.position.set(-6, 8, 4);
  scene.add(new THREE.HemisphereLight(0xb5c7ed, 0x78513b, 1.65), moon);

  return Object.fromEntries([
    ['gate', gate, buildGate], ['meaning', meaning, buildMeaning], ['hymn', hymn, buildHymn]
  ].map(([key, texture, build]) => {
    const group = new THREE.Group();
    group.visible = false;
    scene.add(group);
    ruins(group, key !== 'gate');
    const actions = [];
    markers(group, worlds[key].landings, actions);
    const activity = build(group, texture, actions);
    return [key, { group, actions, ...activity }];
  }));
}
