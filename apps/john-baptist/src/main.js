import * as THREE from 'three';
import { HandCarry } from '../../../shared/journey/hand-carry.js';
import { Navigation } from '../../../shared/journey/navigation.js';
import { XRMenu } from '../../../shared/journey/xr-menu.js';
import worldMedia from './data/worlds.json';
import { lesson, LessonSession, TILES } from './session.js';
import { BaptismPuzzle } from './puzzle.js';
import { makeLandscape } from './landscape.js';
import { makeRiverStations, riverWorld } from './river-stations.js';
import { el, LessonInterface, mediaUrl } from './interface.js';
import './style.css';
import '../../../shared/journey/compact-water-controls.css';

const gateWorld = {
  spawn: [0, 2.75], xrSpawn: [0, 1.18], lookAt: [0, 1.18, -.47],
  bounds: { minX: -5.8, maxX: 5.8, minZ: -5.3, maxZ: 8.5 }
};
const gateObstacles = [{ minX: -1.64, maxX: 1.64, minZ: -.88, maxZ: -.23 }];
const riverObstacles = [{ minX: -.9, maxX: .9, minZ: -3.21, maxZ: -2.74 }];
const approach = {
  gate: [[-.88, .22], [.88, .22], [0, 2.25]],
  river: [[0, 1.70], [-2.79, .65], [2.79, .65], [0, -1.64]]
};

const session = new LessonSession();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xd0b392);
const gateRoot = new THREE.Group(), riverRoot = new THREE.Group();
const rig = new THREE.Group();
const camera = new THREE.PerspectiveCamera(64, 1, .04, 90);
rig.add(camera);
scene.add(rig, gateRoot, riverRoot);
const canvas = el('world');
const fireButton = el('fire-button'), reticle = el('reticle');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const ray = new THREE.Raycaster();
const point = new THREE.Vector2(), head = new THREE.Vector3(), rotation = new THREE.Matrix4();
const waterDirection = new THREE.Vector3(), waterOrigin = new THREE.Vector3();
const hands = [];

let renderer, navigation, xrMenu, carry, gate, stations, terrain;
let selected = null, shot = null, desktopPose, showVideoAfterXR = false;
let notice = '', lastFrame = 0, assistAt = 0;
let ready = false, assisting = false;

const ui = new LessonInterface(session, {
  select: selectTile, place: placeSelected, enter: enterRiver, shuffle: shuffleTiles,
  aim: aimAtVessel, assist, stopAssist, restart,
  dialogChanged: refreshInput,
  selectedTile: () => selected, assisting: () => assisting
});

const inXR = () => Boolean(renderer?.xr.isPresenting);
const atGate = () => session.level === 'gate';
const water = () => stations?.water;
const reduced = () => motion.matches;

function refreshInput() {
  const playing = ready && !ui.modal && !xrMenu?.opened;
  if (!playing) stopPour();
  if (navigation) navigation.enabled = playing;
  ui.syncControls(playing && !inXR());
}

function render() {
  gate?.sync(session, selected);
  water()?.sync(session);
  ui.render({ selected, assisting });
  refreshInput();
}

function announce(message = '', kind = '') {
  notice = message;
  ui.notify(message, kind);
}

function selectTile(tile, dragging = false) {
  if (assisting || !atGate() || session.placed.has(tile)) return;
  selected = !dragging && selected === tile ? null : tile;
  announce();
  render();
}

function placeTile(tile, slot) {
  if (session.place(tile, slot)) announce();
  else announce('Το κομμάτι επέστρεψε στον δίσκο.', 'wrong');
  selected = null;
  render();
}

function placeSelected(slot) {
  if (assisting) return;
  if (selected === null) {
    announce('Διάλεξε πρώτα ένα κομμάτι από τον δίσκο.');
    return;
  }
  placeTile(selected, slot);
  const dialog = el('puzzle-dialog');
  if (dialog.open) {
    const next = session.gateComplete ? el('puzzle-enter') :
      dialog.querySelector('#tray button:not(:disabled)');
    next?.focus();
  }
}

function assist() {
  if (!atGate() || session.gateComplete || assisting) return;
  carry?.cancel();
  selected = null;
  assisting = true;
  assistAt = performance.now();
  announce();
  render();
}

function stopAssist() {
  if (!assisting) return;
  assisting = false;
  render();
}

function shuffleTiles() {
  stopAssist();
  carry?.cancel();
  session.shuffleTiles();
  selected = null;
  announce();
  render();
}

function switchLevel() {
  if (!ready) { render(); return; }
  ui.close();
  xrMenu.close();
  stopPour();
  stopAssist();
  carry.cancel();
  selected = null;
  announce();
  gateRoot.visible = atGate();
  riverRoot.visible = !atGate();
  navigation.world = atGate() ? gateWorld : riverWorld;
  navigation.obstacles = atGate() ? gateObstacles : riverObstacles;
  if (inXR()) navigation.landXR(navigation.world.xrSpawn);
  else navigation.spawn();
  render();
}

function enterRiver() {
  if (ready && session.enter()) switchLevel();
}

function restart() {
  stations?.manuscript.cancel(false);
  water()?.fill.reset();
  session.restart();
  switchLevel();
}

function aimAtVessel(id) {
  const target = water()?.getTarget(id);
  if (!target || session.busy || session.solved(id)) return;
  target.y -= .20;
  camera.lookAt(target);
  ui.close();
  refreshInput();
  fireButton.focus({ preventScroll: true });
}

function answer(id) {
  if (!session.answer(id)) {
    water().reject(id, performance.now());
    announce('Το δοχείο άδειασε. Δοκίμασε άλλη λέξη.', 'wrong');
    return;
  }
  announce();
  stations.manuscript.start(id, reduced(), head);
  render();
}

function finishAnswer(id) {
  session.finish(id);
  render();
}

function canPour() {
  return ready && !atGate() && !session.busy && !session.complete && !ui.modal && !xrMenu.opened && !document.hidden;
}

function beginPour(input) {
  if (!canPour() || shot) return false;
  announce();
  shot = input;
  if (!input.controller) {
    fireButton.classList.add('firing');
    fireButton.setAttribute('aria-pressed', 'true');
  }
  return true;
}

function stopPour() {
  if (shot && !shot.controller) {
    fireButton.classList.remove('firing');
    fireButton.setAttribute('aria-pressed', 'false');
  }
  shot = null;
  water()?.fill.release();
}

function addLanding(root, x, z) {
  const base = new THREE.Mesh(new THREE.CircleGeometry(.28, 28),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: 0x244846, toneMapped: false }));
  base.rotation.x = -Math.PI / 2;
  base.position.set(x, .022, z);
  base.userData.action = { type: 'land', position: [x, z] };
  const rim = new THREE.Mesh(new THREE.RingGeometry(.225, .267, 28),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: 0xf2cf8a, toneMapped: false }));
  rim.position.z = .003;
  base.add(rim);
  root.add(base);
  return base;
}

function screenRay(position) {
  if (position) {
    const rect = canvas.getBoundingClientRect();
    point.set(2 * (position.x - rect.left) / rect.width - 1, 1 - 2 * (position.y - rect.top) / rect.height);
  } else point.set(0, 0);
  camera.updateWorldMatrix(true, false);
  ray.setFromCamera(point, camera);
}

function controllerRay(controller) {
  controller.updateWorldMatrix(true, false);
  ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  ray.ray.direction.set(0, 0, -1).applyMatrix4(rotation.extractRotation(controller.matrixWorld)).normalize();
}

function hit(objects) {
  return ray.intersectObjects(objects.filter(mesh => mesh.visible && !mesh.userData.disabled), false)
    .find(candidate => candidate.distance < 16)?.object.userData.action;
}

function hitVessel() {
  const quiz = water();
  return quiz?.root.visible ? hit(quiz.pickables)?.id : null;
}

function findAction() {
  const menuAction = hit(xrMenu.pickables);
  if (menuAction || xrMenu.opened) return menuAction;
  if (atGate() && !inXR() && !assisting) {
    const action = hit(gate.pickables);
    if (action) return action;
  }
  if (atGate() && gate.enter.visible) {
    const action = hit([gate.enter]);
    if (action) return action;
  }
  if (inXR() && canPour()) {
    const id = hitVessel();
    if (id) return { type: 'vessel', id };
  }
  return hit(landings[session.level]);
}

function dispatch(action) {
  if (!action) return;
  if (action.type === 'tile') selectTile(action.tile);
  else if (action.type === 'slot') placeSelected(action.tile);
  else if (action.type === 'enter') enterRiver();
  else if (action.type === 'land') {
    if (inXR()) navigation.landXR(action.position);
    else navigation.goTo({
      landing: action.position, position: atGate() ? [0, -.47] : [0, -2.98],
      lookHeight: atGate() ? .95 : 1.70
    });
  } else handleXRMenu(action);
}

const menuItem = (label, type, index) => ({ label, action: { type, index } });
const back = menuItem('Πίσω στο μενού', 'xr-menu');
const close = menuItem('Κλείσιμο', 'close-menu');

function showXRMenu() {
  if (carry.held) carry.cancel();
  const items = [
    menuItem('Κείμενα και πηγές', 'reading', 0), menuItem('Το αρχικό βίντεο', 'video')
  ];
  let copy;
  if (atGate()) {
    items.unshift(menuItem('Δες την εικόνα', 'reference'), menuItem('Ανακάτεμα', 'shuffle'));
    if (session.gateComplete) items.unshift(menuItem('Στους σταθμούς', 'enter'));
    else items.push(assisting ? menuItem('Σταμάτησε τη λύση', 'stop-assist') :
      menuItem('Αυτόματη λύση', 'assist'));
    copy = session.gateComplete ? lesson.baptism.caption :
      'Παζλ ' + session.placed.size + ' / 6. Πιάσε με τη λαβή και άφησε στη φωτισμένη υποδοχή.';
  } else {
    if (session.current) items.unshift(menuItem('Υπόδειξη', 'hint'));
    copy = session.complete ? 'Οι τέσσερις συνδέσεις ολοκληρώθηκαν.' :
      'Συνδέσεις ' + session.count + ' / 4. Στόχευσε το δοχείο και κράτησε τη σκανδάλη.';
  }
  items.push(menuItem('Από την αρχή', 'confirm-reset'), menuItem('Έξοδος VR', 'exit'), close);
  const guidance = notice || 'Αριστερός μοχλός για κίνηση, δεξιός για στροφή. Οι κύκλοι στο έδαφος είναι σημεία τηλεμεταφοράς.';
  xrMenu.show('Μενού', copy + '  ' + guidance, items);
  refreshInput();
}

function showXRReading(index) {
  const station = lesson.stations[index], controls = [back, close];
  if (index > 0) controls.unshift(menuItem('← Προηγούμενο', 'reading', index - 1));
  if (index < lesson.stations.length - 1) controls.unshift(menuItem('Επόμενο →', 'reading', index + 1));
  const source = station.relatedSource ? station.source + ' · ' + station.relatedSource : station.source;
  xrMenu.show(station.title, station.reading + '  ' + source, controls, true);
}

function handleXRMenu(action) {
  switch (action.type) {
    case 'xr-menu': showXRMenu(); return;
    case 'reference': xrMenu.show('Η εικόνα της Βάπτισης', '', [back, close], true, gate.image); return;
    case 'hint': xrMenu.show('Υπόδειξη', session.visibleStation.hint, [back, close], true); return;
    case 'reading': showXRReading(action.index); return;
    case 'confirm-reset':
      xrMenu.show('Από την αρχή;', 'Θα ξεκινήσεις ξανά από τα έξι κομμάτια της Βάπτισης.',
        [back, menuItem('Μηδένισε την πρόοδο', 'restart')], true); return;
  }
  xrMenu.close();
  switch (action.type) {
    case 'video':
      showVideoAfterXR = true;
      renderer.xr.getSession()?.end();
      break;
    case 'shuffle': shuffleTiles(); break;
    case 'assist': assist(); break;
    case 'stop-assist': stopAssist(); break;
    case 'restart': restart(); break;
    case 'exit': renderer.xr.getSession()?.end(); break;
  }
  render();
}

function connectControllers() {
  for (let index = 0; index < 2; index++) {
    const controller = renderer.xr.getController(index);
    const grip = renderer.xr.getControllerGrip(index);
    rig.add(controller, grip);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(0, 0, -7)
    ]), new THREE.LineBasicMaterial({ color: 0xf6d48c, transparent: true, opacity: .76 }));
    controller.add(line);
    const cursor = new THREE.Mesh(new THREE.SphereGeometry(.024, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xd2efec }));
    cursor.visible = false;
    scene.add(cursor);
    hands.push({ controller, grip, line, cursor });
    controller.addEventListener('squeezestart', () => {
      if (atGate() && ready && !xrMenu.opened && !assisting) {
        if (carry.grab(controller, 'grip', grip.visible ? grip : controller, gate.tiles)) announce();
      }
    });
    controller.addEventListener('squeezeend', () => {
      const placement = carry.release(controller, 'grip', gate?.slots || []);
      if (placement?.target) placeTile(placement.action.tile, placement.target.tile);
      else if (placement) announce('Άφησε το κομμάτι στη φωτισμένη υποδοχή.', 'wrong');
    });
    controller.addEventListener('selectstart', () => {
      if (!ready || carry.held?.owner === controller) return;
      controllerRay(controller);
      const action = findAction();
      if (action?.type === 'vessel') beginPour({ controller });
      else dispatch(action);
    });
    const release = () => { if (shot?.controller === controller) stopPour(); };
    controller.addEventListener('selectend', release);
    controller.addEventListener('disconnected', () => { release(); carry.cancel(controller); });
  }
  renderer.xr.addEventListener('sessionstart', () => {
    desktopPose = { level: session.level, position: camera.position.clone(), rotation: camera.quaternion.clone() };
    ui.close();
    stopPour();
    selected = null;
    document.body.classList.add('xr-active');
    xrMenu.enable(true);
    navigation.landXR(navigation.world.xrSpawn);
    renderer.xr.getSession().addEventListener('visibilitychange', event => {
      if (event.target.visibilityState !== 'visible') { carry.cancel(); stopPour(); }
    });
    render();
  });
  renderer.xr.addEventListener('sessionend', () => {
    carry.cancel();
    stopPour();
    xrMenu.enable(false);
    document.body.classList.remove('xr-active');
    rig.position.set(0, 0, 0);
    rig.quaternion.identity();
    if (desktopPose?.level === session.level) {
      camera.position.copy(desktopPose.position);
      camera.quaternion.copy(desktopPose.rotation);
    } else navigation.spawn();
    if (showVideoAfterXR) {
      showVideoAfterXR = false;
      ui.showVideo();
    }
    render();
  });
}

function bindPourControls() {
  fireButton.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !beginPour({ pointerId: event.pointerId })) return;
    event.preventDefault();
    fireButton.setPointerCapture(event.pointerId);
  });
  fireButton.addEventListener('keydown', event => {
    if (event.code !== 'Space' && event.code !== 'Enter') return;
    event.preventDefault();
    if (!event.repeat) beginPour({ key: event.code });
  });
  document.addEventListener('keydown', event => {
    if (inXR() || event.code !== 'Space' || event.repeat ||
        event.target.closest?.('button, input, select, textarea, a, [contenteditable]')) return;
    if (beginPour({ key: event.code })) event.preventDefault();
  });
  document.addEventListener('keyup', event => { if (event.code === shot?.key) stopPour(); });

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.pointerType === 'touch' || inXR() || shot || !canPour()) return;
    const position = { x: event.clientX, y: event.clientY };
    screenRay(position);
    if (!hitVessel() || !beginPour({ pointerId: event.pointerId, position })) return;
    event.stopImmediatePropagation();
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
  }, true);
  canvas.addEventListener('pointermove', event => {
    if (shot?.pointerId === event.pointerId && shot.position) {
      shot.position.x = event.clientX;
      shot.position.y = event.clientY;
    }
  });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    document.addEventListener(event, e => { if (e.pointerId === shot?.pointerId) stopPour(); }, true);
  }
  window.addEventListener('blur', stopPour);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPour(); });
}

function updateHands() {
  const play = inXR();
  const handling = play && atGate() && ready && !xrMenu.opened && !assisting;
  if (carry.held && (!handling || !carry.held.pose.visible)) carry.cancel();
  carry.update(handling ? gate.slots : []);
  for (const { controller, grip, cursor, line } of hands) {
    const pose = grip.visible ? grip : controller;
    const holding = carry.held?.owner === controller;
    const near = handling && Boolean(carry.near(pose, gate.tiles));
    line.visible = play && !holding && !near;
    cursor.visible = handling && pose.visible && (holding || near);
    if (cursor.visible) {
      pose.localToWorld(cursor.position.set(0, 0, -.07));
      cursor.material.color.setHex(holding ? 0xffd689 : 0xd2efec);
    }
  }
}

function updateWater(time, dt, immersive) {
  const quiz = water();
  if (!quiz) return;
  const permitted = canPour();
  const active = Boolean(shot && permitted);
  let id = null;
  if (active && shot.controller) {
    controllerRay(shot.controller);
    id = hitVessel();
  } else if (permitted && !immersive) {
    screenRay(shot?.position);
    id = hitVessel();
  }
  reticle.classList.toggle('hot', !immersive && Boolean(id) && !shot?.position);
  quiz.update(time, dt, session, head, reduced(), !atGate(), {
    id, active, xr: immersive, direction: waterDirection.copy(ray.ray.direction),
    origin: active && shot?.controller ? waterOrigin.copy(ray.ray.origin) : null
  });
  quiz.blaster.visible &&= active;
}

function frame(time) {
  const dt = Math.min(.05, (time - lastFrame) / 1000 || 0);
  lastFrame = time;
  navigation.update(dt);
  camera.getWorldPosition(head);
  terrain?.(dt, reduced());
  if (ready) {
    if (assisting && time >= assistAt && !xrMenu.opened) {
      const tile = TILES.find(number => !session.placed.has(number));
      if (tile !== undefined) session.place(tile, tile);
      assisting = !session.gateComplete;
      assistAt = time + (reduced() ? 140 : 350);
      render();
    }
    if (atGate()) gate.update(dt, head, reduced());
    else stations.update(dt, head, reduced(), ui.modal || xrMenu.opened || document.hidden);
    updateHands();
    updateWater(time, dt, inXR());
    xrMenu.update(head);
  }
  renderer.render(scene, camera);
}

function resize() {
  if (!canvas.clientHeight) return;
  camera.aspect = canvas.clientWidth / canvas.clientHeight;
  camera.fov = camera.aspect < 1 ? 79 : 64;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
}

function loadTexture(path) {
  return new THREE.TextureLoader().loadAsync(mediaUrl(path)).then(texture => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return texture;
  });
}

async function offerVR() {
  if (!await navigator.xr?.isSessionSupported('immersive-vr').catch(() => false)) return;
  const button = el('vr');
  button.hidden = false;
  button.onclick = async () => {
    try {
      const immersive = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] });
      await renderer.xr.setSession(immersive);
    } catch { announce('Η συνεδρία VR δεν άνοιξε.'); }
  };
}

const landings = {};
async function start() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  navigation = new Navigation(camera, renderer, gateWorld, gateObstacles, {
    xrSingleStick: true,
    pick(position) {
      if (!position || !ready) return;
      screenRay(position);
      dispatch(findAction());
    },
    lock() {},
    escape() { if (ready && !inXR() && !ui.modal) ui.showMenu(); }
  }, rig);
  xrMenu = new XRMenu(scene, camera, { hideToggleWhileOpen: true });
  xrMenu.toggle.position.set(.85, .76, -1.65);
  carry = new HandCarry(scene);
  connectControllers();
  bindPourControls();
  window.addEventListener('resize', resize);
  resize();

  const [sky, baptism, ...images] = await Promise.all([
    worldMedia.jordan.skybox, lesson.baptism.image, ...lesson.stations.map(station => station.image)
  ].map(loadTexture));
  terrain = makeLandscape(scene, sky);
  gate = new BaptismPuzzle(gateRoot, baptism);
  gate.sync(session, null, true);
  stations = makeRiverStations(riverRoot, camera, session, images, answer, finishAnswer);
  landings.gate = approach.gate.map(([x, z]) => addLanding(gateRoot, x, z));
  landings.river = approach.river.map(([x, z]) => addLanding(riverRoot, x, z));
  ready = true;
  el('loading').hidden = true;
  switchLevel();
  renderer.setAnimationLoop(frame);
  void offerVR();
}

render();
start().catch(error => {
  console.error(error);
  el('loading').textContent = 'Ο Ιορδάνης δεν φορτώθηκε. Δοκίμασε να ανανεώσεις τη σελίδα σε browser με WebGL.';
});
