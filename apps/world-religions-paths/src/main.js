import * as THREE from 'three';
import { Navigation } from '../../../shared/journey/navigation.js';
import { WaterQuiz } from '../../../shared/journey/water-quiz.js';
import { ManuscriptConnections } from '../../../shared/journey/manuscript-connections.js';
import { XRMenu } from '../../../shared/journey/xr-menu.js';
import { panel, setText } from '../../../shared/journey/text-panels.js';
import { mountPuzzle } from '../../../shared/puzzles/puzzle-dom.js';
import { lesson, ReligionsSession } from './session.js';
import { $, installInterface, lessonReadingPages } from './interface.js';
import { assetUrl, buildHub, buildPlanet, disposeScene, HUB, WATER_APPROACH } from './scenes.js';
import '../../../shared/puzzles/puzzle.css';
import './style.css';

let storage;
try { storage = localStorage; } catch { /* The session can stay in memory. */ }
const session = new ReligionsSession(storage);
const canvas = $('scene');
const coarse = matchMedia('(pointer: coarse)');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(59, 1, .06, 130);
const rig = new THREE.Group();
rig.add(camera);
scene.add(rig);
const head = new THREE.Vector3(), pointer = new THREE.Vector2(), rotation = new THREE.Matrix4();
const ray = new THREE.Raycaster();
const direction = new THREE.Vector3(), origin = new THREE.Vector3(), aimTarget = new THREE.Vector3();
const reduced = () => motionOverride ?? motionPreference.matches;
const xr = () => renderer?.xr.isPresenting ?? false;
const hasModal = () => Boolean(document.querySelector('dialog[open]'));
const route = () => religion && session.route(religion.id);
const current = () => religion && session.current(religion.id);

let renderer, navigation, xrMenu, xrFeedback, worldScene, environment, religion, water, quiz, manuscript;
let ready = false, changing = false, revealing = false, interpretation = null;
let feedback = null, firing = null, gesture = null, aim = null, motionOverride, desktopPose, overview = false;
let puzzleView = null, puzzlePlanet = null, lastTime = 0, failedView = 'hub';
let xrReading = null;

const ui = installInterface(session, {
  visit: visitPlanet,
  read: openReader,
  overview: showOverview,
  hub: () => enter('hub'),
  menu: () => openDialog('menu-dialog'),
  hint: showHint,
  proceed: proceed,
  motion: () => { motionOverride = !reduced(); render(); },
  confirmReset: () => {
    $('menu-dialog').close();
    $('reset-current').textContent = 'Μόνο ' + session.religion(session.state.selectedPlanet).label;
    openDialog('reset-dialog');
  },
  reset: reset,
  retry: () => enter(failedView, true),
  review: reviewStation,
  aim: aimChoice,
  manuscript: showBook
});

function canFire() {
  return Boolean(ready && !changing && religion && route().phase === 'ready' &&
    !revealing && !interpretation && !hasModal() && !xrMenu?.opened &&
    !document.hidden && (!xr() || renderer.xr.getSession()?.visibilityState === 'visible'));
}

function syncInput() {
  if (navigation) navigation.enabled = ready && !changing && !hasModal() && !xrMenu?.opened &&
    !gesture && !revealing && !interpretation;
}

function render() {
  water?.sync(quiz);
  syncInput();
  ui.render({
    ready, religion, revealing, interpretation, aim, canFire: canFire(), reduced: reduced(),
    coarse: coarse.matches, hasModal: hasModal(), xr: xr(), feedback, firing: Boolean(firing)
  });
  if (puzzlePlanet) $('puzzle-enter').disabled = !session.isOpen(puzzlePlanet);
}

function announce(text, kind = '') {
  feedback = text ? { text, kind, until: performance.now() + 5700 } : null;
  if (xrFeedback && text) setText(xrFeedback, text, { dark: true, small: true });
  render();
}

function openDialog(id) {
  finishGesture(false);
  stopFire();
  if (!$(id).open) $(id).showModal();
  render();
}

function openReader() {
  if (!ready) return;
  const id = religion?.id || session.state.selectedPlanet;
  ui.reading(id, interpretation?.station.id || current()?.id);
  openDialog('reader');
}

function showHint() {
  if (!religion || route().phase !== 'ready') return;
  session.hint(religion.id);
  render();
}

function createLearningView(parent, next, definition) {
  const track = session.route(definition.id);
  const entries = definition.scenes.map(station => ({
    stationId: station.id, text: station.basic, keywords: station.keywords,
    interpretation: station.interpretation, sourceLabel: station.axis
  }));
  const visibleStation = () => session.current(definition.id) || definition.scenes.at(-1);
  const choices = track.order.map(id => {
    const station = definition.scenes.find(value => value.id === id);
    return { id, word: station.cardTitle };
  });
  const model = {
    choices,
    get current() { return track.phase === 'ready' ? { id: visibleStation().id } : null; },
    get visibleStation() {
      const station = visibleStation();
      return { id: station.id, prompt: station.statement };
    },
    get sceneComplete() { return track.phase !== 'ready'; },
    get reviewId() { return interpretation?.review ? interpretation.station.id : null; },
    get busy() { return revealing; },
    solved(id) { return session.solved(definition.id, id); }
  };
  const positions = definition.scenes.map(() => ({ quizPosition: [0, WATER_APPROACH.position[1]] }));
  const vessels = new WaterQuiz(parent, { ...next.world, promptHeight: .83 }, model, camera, answerWater, positions);
  vessels.blaster.scale.setScalar(.44);
  const presentation = {
    get selected() { return aim; },
    get reviewId() { return model.reviewId; },
    get busy() { return revealing; },
    get localCount() { return track.count; },
    get complete() { return track.phase === 'complete'; },
    get current() { return visibleStation(); },
    solved: model.solved
  };
  const book = new ManuscriptConnections(parent, next.world, presentation, next.illustrations, positions, finishReveal, {
    title: definition.label,
    heading: 'ΟΙ ΒΑΣΙΚΕΣ ΔΙΔΑΣΚΑΛΙΕΣ',
    instruction: 'Διάβασε · στόχευσε το δοχείο του τίτλου',
    entryLabel: 'ΣΤΑΘΜΟΣ',
    readLabel: 'Κείμενα και πηγές',
    centralPosition: [0, 2.23, -1.58],
    compactEntries: true,
    instantReduced: true,
    labelHeights: [1.43, 1.09],
    interpretationOffset: .38,
    entries,
    readingPages: lessonReadingPages(definition)
  });
  return { book, model, vessels };
}

async function enter(id, force = false) {
  if (changing || (!force && ready && session.state.view === id) || (id !== 'hub' && !session.isOpen(id))) return;
  failedView = id;
  changing = true;
  ready = false;
  overview = false;
  setBoardFocus(false);
  feedback = null;
  aim = null;
  interpretation = null;
  revealing = false;
  stopFire();
  finishGesture(false);
  closePuzzle();
  xrMenu?.close();
  $('error').hidden = true;
  $('loading').hidden = false;
  render();
  const nextScene = new THREE.Scene();
  const definition = session.religion(id);
  let next, nextLearning;

  try {
    next = definition ? await buildPlanet(nextScene, definition) : await buildHub(nextScene, session, puzzleSolved);
    if (definition) nextLearning = createLearningView(nextScene, next, definition);
    manuscript?.dispose();
    water?.dispose();
    environment?.dispose?.();
    if (worldScene) disposeScene(worldScene);
    worldScene = nextScene;
    environment = next;
    religion = definition;
    ({ book: manuscript, vessels: water, model: quiz } = nextLearning || {});
    scene.add(worldScene);
    scene.background = worldScene.background;
    scene.backgroundRotation.copy(worldScene.backgroundRotation);
    navigation.world = environment.world;
    session.enter(id);
    if (xr()) navigation.landXR(navigation.world.spawn);
    else if (religion) navigation.goTo(WATER_APPROACH);
    else showOverview();

    if (route()?.phase === 'explaining') {
      interpretation = { station: current(), review: false };
      focusStation(interpretation.station.id);
    }
    ready = true;
    if (xr() && interpretation) showXRInterpretation();
    if (religion && !xr()) $('choices').open = false;
  } catch (error) {
    nextLearning?.vessels.dispose();
    nextLearning?.book.dispose();
    next?.dispose?.();
    disposeScene(nextScene);
    $('error-copy').textContent = 'Δεν φορτώθηκε το σκηνικό. Η πρόοδός σου είναι διαθέσιμη όταν δοκιμάσεις ξανά.';
    $('error').hidden = false;
    console.error(error);
  } finally {
    changing = false;
    $('loading').hidden = true;
    render();
  }
}

function setBoardFocus(active) {
  document.body.classList.toggle('board-focus', active);
  $('overview').textContent = active ? 'Στους πλανήτες' : 'Συνολική εικόνα';
}

function showOverview() {
  stopFire();
  setBoardFocus(false);
  if (xr()) {
    navigation.landXR(navigation.world.spawn);
    return;
  }
  const aspect = canvas.clientWidth / canvas.clientHeight;
  overview = true;
  if (religion) {
    camera.position.set(0, 11.2, 8.15);
    camera.lookAt(0, .45, -1.3);
  } else {
    const portraitDistance = 20 + Math.max(0, 1 - aspect) * 12;
    camera.position.set(0, aspect < 1 ? 14.4 : 11.35, aspect < 1 ? portraitDistance : 12.1);
    camera.lookAt(0, 2.35, -3.5);
  }
}

function goPlanetBoard(id) {
  const station = HUB.stations.find(value => value.id === id);
  overview = false;
  setBoardFocus(!xr());
  session.selectPlanet(id);
  if (xr()) navigation.landXR(station.landing);
  else navigation.goTo({ ...station, lookHeight: 2.12 });
}

function visitPlanet(id) {
  if (!ready || changing || religion) return;
  if (session.isOpen(id)) { enter(id); return; }
  goPlanetBoard(id);
  if (!xr()) openPuzzle(id);
}

function openPuzzle(id) {
  closePuzzle();
  puzzlePlanet = id;
  const selected = session.religion(id);
  $('puzzle-title').textContent = selected.label + ' · Παζλ 3 × 2';
  puzzleView = mountPuzzle($('puzzle-mount'), session.activity(id), {
    image: assetUrl(selected.scenes[0].imageSrc),
    title: selected.label,
    solvedMessage: 'Η εικόνα ολοκληρώθηκε. Ο πλανήτης άνοιξε.',
    allowAutoSolve: true,
    reducedMotion: reduced,
    onSolved: () => $('puzzle-enter').focus()
  });
  const image = $('puzzle-mount').querySelector('.puzzle-reference');
  image.alt = 'Η ολοκληρωμένη εικόνα · ' + selected.scenes[0].cardTitle;
  openDialog('puzzle-dialog');
}

function closePuzzle() {
  puzzleView?.dispose();
  puzzleView = null;
  puzzlePlanet = null;
  $('puzzle-mount').replaceChildren();
  if ($('puzzle-dialog').open) $('puzzle-dialog').close();
}

function puzzleSolved(id) {
  const selected = session.religion(id);
  environment?.boards?.get(id)?.setUnlocked(true);
  announce('Η εικόνα ολοκληρώθηκε. Άνοιξε ο πλανήτης ' + selected.label + '.', 'success');
}

function focusStation(id) {
  if (xr()) return;
  const [x, z] = environment.world.stations.find(station => station.id === id).position;
  overview = false;
  navigation.goTo({ landing: [x * .48, 6.85], position: [x * .55, (z - 1.58) / 2], lookHeight: 2.15 });
}

function showBook() {
  if (!religion || xr() || revealing || interpretation) return;
  stopFire();
  overview = false;
  navigation.goTo({ landing: [0, 1.42], position: [0, -1.58], lookHeight: 2.23 });
  announce('Πάτησε μια γραμμή στο χειρόγραφο για να στοχεύσεις το δοχείο της.');
}

function aimChoice(id) {
  if (!canFire() || session.solved(religion.id, id)) return;
  aim = id;
  overview = false;
  if (!xr()) {
    navigation.goTo(WATER_APPROACH);
    const root = water.root;
    camera.getWorldPosition(head);
    root.lookAt(head.x, root.position.y, head.z);
    root.updateMatrixWorld(true);
    const target = water.getTarget(id, aimTarget);
    if (target) camera.lookAt(target);
    $('water').focus({ preventScroll: true });
  }
  render();
}

function activateStation(id) {
  if (!religion || revealing || interpretation) return;
  if (session.solved(religion.id, id)) reviewStation(id);
  else if (current()?.id === id) {
    overview = false;
    if (xr()) navigation.landXR(WATER_APPROACH.landing);
    else navigation.goTo(WATER_APPROACH);
    announce('Διάβασε τη διδασκαλία και γέμισε το δοχείο με τον σωστό τίτλο.');
  } else announce('Ακολούθησε τον επόμενο αριθμημένο σταθμό.', 'warn');
}

function startReveal(station, review) {
  if (revealing || interpretation) return;
  stopFire();
  aim = null;
  revealing = true;
  interpretation = { station, review, pending: true };
  focusStation(station.id);
  camera.getWorldPosition(head);
  manuscript.start(station.id, reduced(), head);
  announce('Οι λέξεις ταξιδεύουν από το χειρόγραφο στην εικόνα…', 'success');
}

function answerWater(id) {
  if (!canFire()) return;
  const station = current();
  const result = session.pour(religion.id, id);
  if (result === 'wrong') {
    water.reject(id, performance.now());
    announce('Ο τίτλος δεν ταιριάζει σε αυτή τη διδασκαλία. Άφησε τη ροή και δοκίμασε ξανά.', 'warn');
    if (xr() && route().wrong[station.id] >= 2) showXRHint();
  } else if (result === 'correct') {
    startReveal(station, false);
  }
}

function finishReveal() {
  revealing = false;
  if (!interpretation) return;
  interpretation.pending = false;
  if (xr()) showXRInterpretation();
  announce('', '');
  if (!xr()) $('interpretation-title').focus({ preventScroll: true });
}

function reviewStation(id) {
  if (!religion || !session.solved(religion.id, id)) return;
  const station = religion.scenes.find(value => value.id === id);
  startReveal(station, true);
}

function proceed() {
  if (!interpretation || revealing) return;
  stopFire();
  if (!interpretation.review) session.proceed(religion.id);
  interpretation = null;
  aim = null;
  xrMenu?.close();
  const done = route().phase === 'complete';
  if (!xr() && !done) navigation.goTo(WATER_APPROACH);
  announce(done ? 'Οι πέντε συνδέσεις ολοκληρώθηκαν.' : null, done ? 'success' : '');
}

function reset(scope) {
  $('reset-dialog').close();
  xrMenu?.close();
  session.reset(scope);
  enter('hub', true);
}

function visible(object) {
  for (let item = object; item; item = item.parent) if (!item.visible || item.userData.disabled) return false;
  return true;
}

function activePickables() {
  if (xrMenu?.opened) return xrMenu.pickables.filter(visible);
  return [
    ...(xrMenu?.pickables || []),
    ...(environment?.pickables || []),
    ...(manuscript?.pickables || []),
    ...(water?.root.visible ? water.pickables : [])
  ].filter(visible);
}

function pick() {
  return ray.intersectObjects(activePickables(), false).find(result => result.distance < 24);
}

function rayAt(point = null) {
  if (point) {
    const rect = canvas.getBoundingClientRect();
    pointer.set(2 * (point.x - rect.left) / rect.width - 1, 1 - 2 * (point.y - rect.top) / rect.height);
  } else pointer.set(0, 0);
  ray.setFromCamera(pointer, camera);
}

function controllerRay(controller) {
  controller.updateWorldMatrix(true, false);
  rotation.identity().extractRotation(controller.matrixWorld);
  ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  ray.ray.direction.set(0, 0, -1).applyMatrix4(rotation);
}

function handleAction(action) {
  if (!ready || changing || !action || hasModal()) return;
  if (handleXRAction(action)) return;
  if (action.type === 'planet') visitPlanet(action.id);
  else if (action.type === 'hub') enter('hub');
  else if (action.type === 'station') activateStation(action.id);
  else if (action.type === 'teleport' && xr()) navigation.landXR(action.point);
  else if (action.type === 'word') {
    if (session.solved(religion.id, action.id)) reviewStation(action.id);
    else aimChoice(action.id);
  } else if (action.type === 'hymn-page') {
    if (xr()) showXRReading(religion.id, 0);
    else openReader();
  } else if (action.type.startsWith('puzzle-')) {
    const board = environment.boards?.get(action.id);
    if (!board) return;
    session.selectPlanet(action.id);
    if (action.type === 'puzzle-preview') board.togglePreview();
    else if (action.type === 'puzzle-reset') session.activity(action.id).restart();
    else if (action.type === 'puzzle-auto') board.toggleAutoSolve(reduced());
    else if (action.type === 'puzzle-enter' && session.isOpen(action.id)) enter(action.id);
    else if (action.type === 'puzzle-surface' && !xr()) openPuzzle(action.id);
    render();
  }
}

function beginGesture(action, owner) {
  const board = environment?.boards?.get(action.id);
  if (action.type !== 'puzzle-tile' || !board?.beginDrag(action.tile, ray.ray)) return false;
  session.selectPlanet(action.id);
  gesture = { board, owner };
  syncInput();
  return true;
}

function finishGesture(commit) {
  if (!gesture) return;
  const { board, owner } = gesture;
  gesture = null;
  board.finishDrag(commit);
  if (typeof owner === 'number' && canvas.hasPointerCapture(owner)) canvas.releasePointerCapture(owner);
  syncInput();
}

function vesselTarget() {
  const hit = ray.intersectObjects(water.pickables.filter(visible), false).find(result => result.distance <= 10);
  return hit?.object.userData.action.id || null;
}

function beginFire(input) {
  if (!canFire() || firing) return;
  firing = input;
  $('water').setAttribute('aria-pressed', 'true');
}

function stopFire() {
  firing = null;
  water?.fill.release();
  $('water').setAttribute('aria-pressed', 'false');
}

function onCanvasDown(event) {
  if (!ready || changing || hasModal() || xr() || event.button !== 0) return;
  rayAt({ x: event.clientX, y: event.clientY });
  const action = pick()?.object.userData.action;
  if (!action) return;
  if (beginGesture(action, event.pointerId)) {
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
  } else if (action.type === 'vessel' && canFire()) {
    beginFire({ mode: 'point', pointerId: event.pointerId, point: { x: event.clientX, y: event.clientY } });
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}

canvas.addEventListener('pointerdown', onCanvasDown, true);
canvas.addEventListener('pointermove', event => {
  const point = { x: event.clientX, y: event.clientY };
  if (gesture?.owner === event.pointerId) { rayAt(point); gesture.board.drag(ray.ray); }
  if (firing?.mode === 'point' && firing.pointerId === event.pointerId) firing.point = point;
});
for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  window.addEventListener(eventName, event => {
    if (gesture?.owner === event.pointerId) finishGesture(eventName === 'pointerup');
    if (firing?.pointerId === event.pointerId) stopFire();
  });
}
$('water').addEventListener('pointerdown', event => {
  if (event.button !== 0 || !canFire()) return;
  event.preventDefault();
  beginFire({ mode: 'center', pointerId: event.pointerId });
  $('water').setPointerCapture(event.pointerId);
});
document.addEventListener('keydown', event => {
  if (overview && /^Key[WASD]$|^Arrow/.test(event.code) && !hasModal()) {
    overview = false;
    navigation.spawn();
  }
  if ((event.code !== 'Space' && !(event.code === 'Enter' && event.target === $('water'))) || event.repeat) return;
  if (event.target !== $('water') && event.target.closest?.('button, input, select, textarea, summary, a')) return;
  if (!canFire()) return;
  event.preventDefault();
  beginFire({ mode: 'center', key: event.code });
});
document.addEventListener('keyup', event => {
  if (firing?.key === event.code) stopFire();
});
for (const name of ['blur', 'pagehide']) window.addEventListener(name, () => { finishGesture(false); stopFire(); });
document.addEventListener('visibilitychange', () => { finishGesture(false); stopFire(); });

$('puzzle-world').addEventListener('click', () => {
  const id = puzzlePlanet;
  closePuzzle();
  if (id) goPlanetBoard(id);
});
$('puzzle-enter').addEventListener('click', () => {
  const id = puzzlePlanet;
  closePuzzle();
  if (id && session.isOpen(id)) enter(id);
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('close', () => {
    if (dialog.id === 'puzzle-dialog' && !dialog.open) closePuzzle();
    render();
  });
}

const item = (label, type, params = {}) => ({ label, action: { type, ...params } });
function showXRMain() {
  stopFire();
  if (interpretation && !revealing) { showXRInterpretation(); return; }
  const options = [
    item('Συνέχεια εξερεύνησης', 'xr-close'),
    religion ? item('Στους πλανήτες', 'hub') : item('Επιλογή πλανήτη', 'xr-planets'),
    item('Κείμενα και πηγές', 'xr-reader'),
    item('Συνολική εικόνα', 'xr-overview'),
    item('Από την αρχή', 'xr-confirm'),
    item('Έξοδος VR', 'xr-exit')
  ];
  if (route()?.phase === 'ready') options.splice(2, 0, item('Μικρή υπόδειξη', 'xr-hint'));
  xrMenu.show(religion?.label || 'Θρησκείες του κόσμου', religion
    ? route().count + ' / 5 σταθμοί · ' + (current()?.axis || 'Η διαδρομή ολοκληρώθηκε.')
    : 'Επίλεξε πλανήτη και λύσε το παζλ της εισόδου.', options);
  syncInput();
}
function showXRInterpretation() {
  if (!interpretation || revealing) return;
  const { station, review } = interpretation;
  xrMenu.show(station.cardTitle, station.interpretation + '\n' + station.question,
    [item(review ? 'Στη διαδρομή' : 'Συνέχεια', 'xr-proceed'), item('Κείμενο και πηγή', 'xr-reader')], true);
  syncInput();
}
function showXRHint() {
  showHint();
  xrMenu.show('Μικρή υπόδειξη', current()?.hint || '', [item('Στη διαδρομή', 'xr-close')], true);
  syncInput();
}
function showXRReading(id, index) {
  const selected = session.religion(id);
  if (xrReading?.id !== id) xrReading = { id, pages: lessonReadingPages(selected) };
  const { pages } = xrReading;
  const page = pages[index];
  if (!page) return;
  const control = [
    ...(index > 0 ? [item('← Προηγούμενο', 'xr-page', { id, index: index - 1 })] : []),
    ...(index + 1 < pages.length ? [item('Επόμενο →', 'xr-page', { id, index: index + 1 })] : []),
    item('Άνοιγμα πηγής ↗', 'xr-source', { url: page.sourceUrl }),
    item('Επιστροφή', 'xr-back')
  ];
  xrMenu.show(page.title + ' · ' + (index + 1) + ' / ' + pages.length, page.text + '\n\n' + page.attribution, control, true);
  syncInput();
}
function handleXRAction(action) {
  if (!action.type.startsWith('xr-') || !xr()) return false;
  if (action.type === 'xr-menu') { if (xrMenu.opened) { xrMenu.close(); syncInput(); } else showXRMain(); }
  else if (action.type === 'xr-close') { xrMenu.close(); syncInput(); }
  else if (action.type === 'xr-back') showXRMain();
  else if (action.type === 'xr-planets') {
    xrMenu.show('Οι πέντε πλανήτες', 'Επίλεξε προορισμό.', [
      ...lesson.religions.map(value => item(value.label, 'xr-visit', { id: value.id })), item('Επιστροφή', 'xr-back')
    ]);
  } else if (action.type === 'xr-visit') { xrMenu.close(); visitPlanet(action.id); syncInput(); }
  else if (action.type === 'xr-overview') { xrMenu.close(); showOverview(); syncInput(); }
  else if (action.type === 'xr-hint') showXRHint();
  else if (action.type === 'xr-proceed') proceed();
  else if (action.type === 'xr-reader') {
    if (religion) showXRReading(religion.id, 0);
    else xrMenu.show('Κείμενα και πηγές', 'Επίλεξε παράδοση.', [
      ...lesson.religions.map(value => item(value.label, 'xr-page', { id: value.id, index: 0 })), item('Επιστροφή', 'xr-back')
    ]);
  } else if (action.type === 'xr-page') showXRReading(action.id, action.index);
  else if (action.type === 'xr-source') window.open(action.url, '_blank', 'noopener,noreferrer');
  else if (action.type === 'xr-confirm') {
    xrMenu.show('Από την αρχή;', 'Επίλεξε ποια πρόοδος θα μηδενιστεί.', [
      item('Ακύρωση', 'xr-back'), item('Αυτός ο πλανήτης', 'xr-reset', { scope: session.state.selectedPlanet }),
      item('Και οι πέντε', 'xr-reset', { scope: 'all' })
    ]);
  } else if (action.type === 'xr-reset') reset(action.scope);
  else if (action.type === 'xr-exit') renderer.xr.getSession()?.end();
  return true;
}

function connectXR() {
  for (const index of [0, 1]) {
    const controller = renderer.xr.getController(index);
    rig.add(controller);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(), new THREE.Vector3(0, 0, -1)
    ]), new THREE.LineBasicMaterial({ color: 0xf3d58f, transparent: true, opacity: .84 }));
    line.scale.z = 8;
    controller.add(line);
    controller.addEventListener('selectstart', () => {
      if (!ready || changing) return;
      controllerRay(controller);
      const action = pick()?.object.userData.action;
      if (!action || beginGesture(action, controller)) return;
      if (action.type === 'vessel') beginFire({ mode: 'xr', controller });
      else handleAction(action);
    });
    controller.addEventListener('selectend', () => {
      if (gesture?.owner === controller) finishGesture(true);
      if (firing?.controller === controller) stopFire();
    });
    controller.addEventListener('disconnected', () => {
      if (gesture?.owner === controller) finishGesture(false);
      if (firing?.controller === controller) stopFire();
    });
  }

  renderer.xr.addEventListener('sessionstart', () => {
    desktopPose = { id: session.state.view, position: camera.position.clone(), rotation: camera.quaternion.clone() };
    stopFire();
    finishGesture(false);
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    xrMenu.enable(true);
    document.body.classList.add('xr-active');
    navigation.landXR(navigation.world.spawn);
    if (interpretation && !revealing) showXRInterpretation();
    render();
  });
  renderer.xr.addEventListener('sessionend', () => {
    stopFire();
    finishGesture(false);
    xrMenu.enable(false);
    document.body.classList.remove('xr-active');
    rig.position.set(0, 0, 0);
    rig.quaternion.identity();
    if (desktopPose?.id === session.state.view) {
      camera.position.copy(desktopPose.position);
      camera.quaternion.copy(desktopPose.rotation);
    } else navigation.spawn();
    desktopPose = null;
    render();
  });
}

async function offerXR() {
  try {
    if (!navigator.xr || !await navigator.xr.isSessionSupported('immersive-vr')) return;
  } catch { return; }
  $('vr').hidden = false;
  $('vr').addEventListener('click', async () => {
    if (!ready) return;
    try {
      const immersive = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] });
      await renderer.xr.setSession(immersive);
    } catch {
      announce('Η συνεδρία VR δεν άνοιξε. Η προβολή στον browser είναι διαθέσιμη.', 'warn');
    }
  });
}

function resize() {
  const { clientWidth, clientHeight } = canvas;
  if (!clientWidth || !clientHeight) return;
  camera.aspect = clientWidth / clientHeight;
  camera.fov = camera.aspect < 1 ? 69 : 59;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
  if (overview && environment && !xr()) showOverview();
}

function frame(time) {
  const dt = Math.min(.05, (time - lastTime) / 1000 || 0);
  lastTime = time;
  navigation.update(dt);
  camera.getWorldPosition(head);
  const immersive = xr();
  environment?.update(dt, head, reduced(), immersive);
  if (gesture && typeof gesture.owner !== 'number') {
    controllerRay(gesture.owner);
    gesture.board.drag(ray.ray);
  }

  if (water) {
    const input = firing, permitted = canFire();
    let id = null;
    if (permitted) {
      if (input?.mode === 'xr') controllerRay(input.controller);
      else rayAt(input?.point);
      id = water.root.visible ? vesselTarget() : null;
      direction.copy(ray.ray.direction);
      if (input?.mode === 'xr') origin.copy(ray.ray.origin);
    }
    water.update(time, dt, quiz, head, reduced(), permitted, {
      id, active: Boolean(input && permitted), xr: immersive, direction,
      origin: input?.mode === 'xr' ? origin : null, worldPrompt: immersive
    });
    if (!immersive) {
      const choice = quiz.choices.find(value => value.id === id);
      ui.setAim(choice ? 'Στόχος · ' + choice.word : 'Στόχευσε ένα δοχείο', Boolean(choice));
    }
  }
  manuscript?.update(dt, head, reduced(), document.hidden || hasModal() || xrMenu.opened);
  xrMenu.update(head);
  xrFeedback.visible = Boolean(immersive && feedback && !xrMenu.opened);
  if (feedback && time >= feedback.until) { feedback = null; render(); }
  renderer.render(scene, camera);
}

try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local-floor');
  navigation = new Navigation(camera, renderer, HUB, [], {
    pick(point) { rayAt(point); handleAction(pick()?.object.userData.action); },
    lock() {},
    escape() { stopFire(); if (ready && !hasModal() && !xr()) openDialog('menu-dialog'); }
  });
  xrMenu = new XRMenu(scene, camera);
  xrFeedback = panel('', 2.3, .33, null, { dark: true, small: true });
  xrFeedback.position.set(0, .7, -2.0);
  xrFeedback.material.depthTest = false;
  xrFeedback.renderOrder = 1000;
  xrFeedback.visible = false;
  camera.add(xrFeedback);
  connectXR();
  window.addEventListener('resize', resize);
  motionPreference.addEventListener('change', render);
  coarse.addEventListener('change', render);
  resize();
  render();
  renderer.setAnimationLoop(frame);
  offerXR();
  enter(session.state.view, true);
} catch (error) {
  $('loading').hidden = true;
  $('retry').hidden = true;
  $('error-copy').textContent = 'Ο browser χρειάζεται WebGL για την τρισδιάστατη προβολή.';
  $('error').hidden = false;
  console.error(error);
}
