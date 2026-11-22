import * as THREE from 'three';
import { Navigation } from '../../../shared/journey/navigation.js';
import { XRMenu } from '../../../shared/journey/xr-menu.js';
import { panel } from '../../../shared/journey/text-panels.js';
import { byId, excerpt, fullHymn, ids, lesson, music, stages, tiles, worlds } from './content.js';
import { $, installInterface } from './interface.js';
import { ChristmasSession } from './session.js';
import { HymnAudio } from './audio.js';
import { buildBethlehem, setSign } from './world.js';
import './style.css';

let storage;
try { storage = localStorage; } catch { /* A restricted browser can keep progress in memory. */ }
const session = new ChristmasSession(storage);
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const touch = matchMedia('(pointer: coarse)');
const canvas = $('scene');
const view = {
  tile: null, missedSlot: null, card: null, meaningTarget: ids[0], phrase: null,
  ring: ids.find(id => !session.state.hymn.includes(id)) || ids[0],
  reference: false, assisting: false, reduced: motion.matches, audio: 'idle', feedback: null
};
const attempts = { meaning: {}, hymn: {} };
const hints = { meaning: {}, hymn: {} };
const ui = installInterface(session, dispatch);
const sound = new HymnAudio(info => {
  ui.playStatus(info);
  if (view.audio === info.status) return;
  view.audio = info.status;
  if (info.status === 'error' && inXR()) announce('Ο ήχος δεν ξεκίνησε. Πάτησε ξανά την ακρόαση.', 'miss');
  else if (info.status === 'playing' && inXR()) announce(info.label);
  else render();
});

let renderer, scene, camera, rig, navigation, environments, xrMenu, xrFeedback, desktopPose;
let solveTimer, messageTimer;
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const controllerRotation = new THREE.Matrix4();
const head = new THREE.Vector3();
const inXR = () => renderer?.xr.isPresenting ?? false;
const currentDialog = () => [...document.querySelectorAll('dialog[open]')].at(-1);
const stage = () => session.state.stage;

function render() {
  ui.render(view);
  for (const [id, environment] of Object.entries(environments || {})) {
    environment.group.visible = id === stage();
    environment.sync(session, view);
  }
  if (navigation) navigation.enabled = !currentDialog() && !xrMenu?.opened;
  $('touch-walk').hidden = !touch.matches || !navigation || !navigation.enabled || inXR();
  if (xrFeedback) {
    xrFeedback.visible = inXR() && Boolean(view.feedback) && !xrMenu.opened;
    if (xrFeedback.visible) setSign(xrFeedback, view.feedback.text, view.feedback.tone === 'miss' ? 'miss' : 'dark');
  }
}

function announce(text, tone = '') {
  clearTimeout(messageTimer);
  view.feedback = { text, tone };
  messageTimer = setTimeout(() => {
    view.feedback = null;
    view.missedSlot = null;
    render();
  }, 6800);
  render();
}

function clearNotice() {
  clearTimeout(messageTimer);
  view.feedback = null;
  view.missedSlot = null;
}

function syncAudioHome() {
  const home = $('activity').open ? $('audio-home') : $('world-audio');
  if ($('audio-strip').parentNode !== home) home.append($('audio-strip'));
}

function openDialog(id) {
  if (id !== 'activity') {
    stopAssist();
    sound.stop();
    clearNotice();
  }
  if (id === 'reset') $('menu').close();
  if (id === 'reader') ui.syncReflection();
  if (!$(id).open) $(id).showModal();
  if (id === 'activity') $('activity-close').focus();
  syncAudioHome();
  render();
}

for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('close', () => {
    if (dialog.id === 'activity' && !dialog.open) {
      stopAssist();
      sound.stop();
      view.reference = false;
    }
    syncAudioHome();
    render();
  });
}

function travel(destination) {
  if (!session.travel(destination)) return;
  stopAssist();
  sound.stop();
  clearNotice();
  view.tile = view.card = view.phrase = null;
  view.reference = false;
  for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
  xrMenu?.close();
  if (navigation) {
    navigation.world = worlds[destination];
    if (inXR()) navigation.landXR(navigation.world.spawn);
    else navigation.spawn();
  }
  render();
}

function placeTile(slot, node) {
  if (view.assisting) return;
  if (view.tile === null) {
    announce('Διάλεξε πρώτα ένα κομμάτι από τον πάγκο.');
    return;
  }
  const outcome = session.placeTile(view.tile, slot);
  view.tile = null;
  view.missedSlot = outcome === 'miss' ? slot : null;
  if (outcome === 'miss') announce('Το κομμάτι επέστρεψε στον πάγκο. Δοκίμασε άλλη θέση.', 'miss');
  if (outcome === 'matched') {
    announce(session.gateOpen ? 'Η εικόνα ολοκληρώθηκε. Μπορείς να μπεις στη Βηθλεέμ.' : 'Το κομμάτι μπήκε στη θέση του.', 'good');
    if (node) {
      const target = session.gateOpen ? $('gate-enter') : $('gate-tray').querySelector('button:not(:disabled)');
      target?.focus({ preventScroll: true });
    }
  }
  render();
}

function stopAssist() {
  clearTimeout(solveTimer);
  view.assisting = false;
}

function autoAssist() {
  if (view.assisting) {
    stopAssist();
    announce('Η αυτόματη λύση σταμάτησε. Τα τοποθετημένα κομμάτια μένουν στη θέση τους.');
    return;
  }
  if (stage() !== 'gate' || session.gateOpen) return;
  clearNotice();
  view.assisting = true;
  view.reference = false;
  view.tile = null;
  const remaining = tiles.filter(tile => !session.state.placed.includes(tile));
  const complete = () => {
    stopAssist();
    announce('Η εικόνα ολοκληρώθηκε. Μπορείς να μπεις στη Βηθλεέμ.', 'good');
  };
  const next = () => {
    if (!view.assisting) return;
    const tile = remaining.shift();
    session.placeTile(tile, tile);
    if (!remaining.length) complete();
    else {
      render();
      solveTimer = setTimeout(next, 325);
    }
  };
  if (view.reduced) {
    remaining.forEach(tile => session.placeTile(tile, tile));
    complete();
  } else {
    render();
    solveTimer = setTimeout(next, 220);
  }
}

function guide(title, text, tone = '') {
  if (inXR()) {
    xrMenu.show(title, text, [{ label: 'Συνέχεια', action: { type: 'close-xr' } }], true);
    render();
  } else announce(text, tone);
}

function hintFor(section, id) {
  const phrase = byId[id];
  const set = section === 'meaning' ? phrase.hints : phrase.orderHints;
  const count = hints[section][id] || 0;
  hints[section][id] = Math.min(count + 1, set.length - 1);
  return set[count];
}

function seeMeaning(target) {
  view.meaningTarget = target;
  const phrase = byId[target];
  if (session.state.meaning.includes(target)) {
    guide(phrase.concept, phrase.explanation, 'good');
  } else if (!view.card) {
    guide(phrase.target, phrase.question);
  } else {
    const result = session.matchMeaning(view.card, target);
    view.card = null;
    if (result === 'matched') {
      guide(phrase.concept, phrase.explanation, 'good');
    } else if (result === 'miss') {
      attempts.meaning[target] = (attempts.meaning[target] || 0) + 1;
      const text = attempts.meaning[target] === 2 ? hintFor('meaning', target) : phrase.question;
      guide(phrase.target, 'Δοκίμασε άλλο χειρόγραφο. ' + text, 'miss');
    }
  }
  render();
}

function giveHint() {
  if (stage() === 'meaning') {
    const id = session.state.meaning.includes(view.meaningTarget) ? ids.find(id => !session.state.meaning.includes(id)) : view.meaningTarget;
    if (id) guide(byId[id].target, hintFor('meaning', id));
  } else if (stage() === 'hymn') {
    const id = session.state.hymn.includes(view.ring) ? ids.find(id => !session.state.hymn.includes(id)) : view.ring;
    if (id) guide('Υπόδειξη για τη θέση ' + (ids.indexOf(id) + 1), hintFor('hymn', id));
  }
}

function pickRing(id) {
  view.ring = id;
  if (view.phrase && !session.state.hymn.includes(id)) {
    session.choosePhrase(id, view.phrase);
    view.phrase = null;
    clearNotice();
  }
  render();
}

function cycleRing(id, direction) {
  if (session.state.hymn.includes(id)) return;
  const current = ids.indexOf(session.state.choices[ids.indexOf(id)]);
  view.ring = id;
  view.phrase = null;
  session.choosePhrase(id, ids[(current + direction + ids.length) % ids.length]);
  clearNotice();
  render();
}

function checkHymn() {
  const { matched, remaining } = session.checkHymn();
  if (session.complete) {
    guide('Ο ύμνος ολοκληρώθηκε', lesson.finalInterpretation, 'good');
  } else {
    remaining.forEach(id => { attempts.hymn[id] = (attempts.hymn[id] || 0) + 1; });
    const next = remaining.includes(view.ring) ? view.ring : remaining[0];
    view.ring = next;
    const text = matched.length ? 'Οι σωστές θέσεις κλείδωσαν. Δοκίμασε τις υπόλοιπες.' : 'Δοκίμασε άλλη φράση σε κάθε θέση που μένει ανοιχτή.';
    if (attempts.hymn[next] === 2) guide('Υπόδειξη για τη θέση ' + (ids.indexOf(next) + 1), text + ' ' + hintFor('hymn', next), matched.length ? 'good' : 'miss');
    else announce(text, matched.length ? 'good' : 'miss');
  }
  render();
}

function listen(value) {
  if (stage() !== 'hymn') return;
  if (ids.includes(value)) sound.play([music.segments[value]], byId[value].full);
  else if (session.complete && value === 'sequence') sound.play(ids.map(id => music.segments[id]), 'Η σωστή ακολουθία');
  else if (session.complete && value === 'full') sound.play(null, music.label);
}

function resetHymn() {
  session.resetHymn();
  attempts.hymn = {};
  hints.hymn = {};
  view.ring = ids[0];
  travel('hymn');
}

function resetAll() {
  session.resetAll();
  attempts.meaning = {};
  attempts.hymn = {};
  hints.meaning = {};
  hints.hymn = {};
  view.ring = view.meaningTarget = ids[0];
  ui.clearEvidence();
  travel('gate');
}

function xrMain() {
  const buttons = [
    { label: 'Είσοδος', action: { type: 'travel', value: 'gate' } },
    ...(session.gateOpen ? [{ label: 'Αναλόγιο', action: { type: 'travel', value: 'meaning' } }] : []),
    ...(session.hymnOpen ? [{ label: 'Ύμνος', action: { type: 'travel', value: 'hymn' } }] : []),
    { label: 'Κείμενα και πηγές', action: { type: 'read' } },
    ...(session.hymnOpen ? [{ label: 'Εργασία στα κείμενα', action: { type: 'xr-evidence' } }, { label: 'Επαναφορά ύμνου', action: { type: 'reset-hymn' } }] : []),
    { label: 'Επανεκκίνηση', action: { type: 'confirm-reset' } },
    { label: 'Κλείσιμο', action: { type: 'close-xr' } }
  ];
  xrMenu.show('Χριστός γεννάται', stages[stage()].name, buttons);
  render();
}

function xrRead(page = 0) {
  const pages = [
    [lesson.sourceLabel, excerpt], [lesson.hymnLabel, fullHymn],
    ['Εικόνες, μουσική και προέλευση', lesson.audioCredits + ' ' + lesson.artNote]
  ];
  xrMenu.show(...pages[page], [
    { label: 'Μενού', action: { type: 'menu' } },
    { label: 'Επόμενη πηγή', action: { type: 'xr-read', value: (page + 1) % pages.length } },
    { label: 'Κλείσιμο', action: { type: 'close-xr' } }
  ], true);
  render();
}

function xrEvidence(id, message) {
  const answered = session.state.evidence;
  const choices = id ? ['uplift', 'birth', 'welcome'].map(phrase => ({
    label: byId[phrase].full, action: { type: 'xr-check-evidence', value: { id, phrase } }
  })) : ids.filter(phrase => !answered.includes(phrase)).map(phrase => ({
    label: byId[phrase].concept, action: { type: 'xr-evidence', value: phrase }
  }));
  const prompt = message || (id ? byId[id].concept + ' · Βρες το απόσπασμα που ταιριάζει.' : 'Τεκμήρια ' + answered.length + '/3. Ο γραπτός αναστοχασμός ανοίγει στην προβολή του browser.');
  xrMenu.show('Εργασία στα κείμενα', prompt, [
    ...choices, { label: id ? 'Πίσω' : 'Μενού', action: { type: id ? 'xr-evidence' : 'menu' } }
  ]);
  render();
}

function dispatch(type, value, node) {
  switch (type) {
    case 'activity': openDialog('activity'); break;
    case 'close': currentDialog()?.close(); break;
    case 'travel': travel(value); break;
    case 'tile':
      if (!view.assisting && !session.state.placed.includes(Number(value))) {
        view.reference = false;
        view.tile = Number(value);
        clearNotice();
        render();
      }
      break;
    case 'slot': placeTile(Number(value), node); break;
    case 'preview': view.reference = !view.reference; render(); break;
    case 'shuffle':
      if (view.assisting || session.gateOpen) break;
      session.shuffleTray();
      view.tile = null;
      clearNotice();
      render();
      break;
    case 'auto': autoAssist(); break;
    case 'card': view.card = value; clearNotice(); render(); break;
    case 'target': seeMeaning(value); break;
    case 'hint': giveHint(); break;
    case 'phrase': view.phrase = value; clearNotice(); render(); break;
    case 'ring': pickRing(value); break;
    case 'cycle': cycleRing(view.ring, Number(value)); break;
    case 'cycle-ring': cycleRing(value.id, value.direction); break;
    case 'check-hymn': checkHymn(); break;
    case 'listen': listen(value); break;
    case 'pause': sound.togglePause(); break;
    case 'stop': sound.stop(); break;
    case 'menu':
      if (inXR()) {
        if (node === 'toggle' && xrMenu.opened) xrMenu.close();
        else xrMain();
        render();
      } else openDialog('menu');
      break;
    case 'read':
      if (inXR()) { sound.stop(); xrRead(); }
      else openDialog('reader');
      break;
    case 'xr-read': xrRead(value); break;
    case 'close-xr': xrMenu.close(); render(); break;
    case 'xr-evidence': xrEvidence(value); break;
    case 'xr-check-evidence':
      if (value.id === value.phrase) {
        session.saveEvidence([value.id]);
        xrEvidence(undefined, 'Σωστή σύνδεση. Τεκμήρια ' + session.state.evidence.length + '/3.');
      } else xrEvidence(value.id, 'Ξανακοίτα τις φράσεις και δοκίμασε άλλο απόσπασμα.');
      break;
    case 'check-evidence':
      session.saveEvidence(ui.evidenceAnswers());
      $('evidence-status').textContent = session.state.evidence.length === ids.length ? 'Οι τρεις συνδέσεις τεκμηριώθηκαν.' : 'Ξανακοίτα τα αποσπάσματα που απομένουν.';
      render();
      break;
    case 'reset-hymn': resetHymn(); break;
    case 'confirm-reset':
      if (inXR()) {
        xrMenu.show('Επανεκκίνηση μαθήματος;', 'Η εικόνα και οι δραστηριότητες θα ξεκινήσουν από την αρχή.', [
          { label: 'Άκυρο', action: { type: 'menu' } }, { label: 'Επανεκκίνηση', action: { type: 'reset-all' } }
        ]);
        render();
      } else openDialog('reset');
      break;
    case 'reset-all': resetAll(); break;
    case 'teleport':
      if (inXR()) navigation.landXR(value);
      else navigation.goTo({ landing: value, position: [value[0], -1.94], lookHeight: 1.9 });
      break;
  }
}

function hit() {
  const pool = xrMenu.opened ? xrMenu.pickables : [...environments[stage()].actions, ...xrMenu.pickables];
  const active = pool.filter(node => node.visible && !node.userData.disabled);
  return ray.intersectObjects(active, false).find(result => result.distance < 20);
}

function pickScreen(point) {
  if (!environments || !point) return;
  const bounds = canvas.getBoundingClientRect();
  pointer.set(2 * (point.x - bounds.left) / bounds.width - 1, 1 - 2 * (point.y - bounds.top) / bounds.height);
  ray.setFromCamera(pointer, camera);
  const action = hit()?.object.userData.action;
  if (action) dispatch(action.type, action.value);
}

function escape() {
  if (currentDialog()) return;
  if (view.assisting) stopAssist();
  view.tile = view.card = view.phrase = null;
  view.reference = false;
  clearNotice();
  render();
}

function connectXR() {
  for (const index of [0, 1]) {
    const controller = renderer.xr.getController(index);
    rig.add(controller);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -7)]),
      new THREE.LineBasicMaterial({ color: 0xffd98c, transparent: true, opacity: .82 }));
    controller.add(line);
    controller.addEventListener('selectstart', () => {
      if (!environments) return;
      controller.updateWorldMatrix(true, false);
      controllerRotation.extractRotation(controller.matrixWorld);
      ray.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      ray.ray.direction.set(0, 0, -1).applyMatrix4(controllerRotation).normalize();
      const action = hit()?.object.userData.action;
      if (action) dispatch(action.type === 'xr-menu' ? 'menu' : action.type, action.value, action.type === 'xr-menu' ? 'toggle' : undefined);
    });
  }
  renderer.xr.addEventListener('sessionstart', () => {
    desktopPose = { stage: stage(), position: camera.position.clone(), quaternion: camera.quaternion.clone() };
    for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
    stopAssist();
    sound.stop();
    document.body.classList.add('xr-active');
    xrMenu.enable(true);
    navigation.landXR(navigation.world.spawn);
    render();
  });
  renderer.xr.addEventListener('sessionend', () => {
    sound.stop();
    stopAssist();
    xrMenu.enable(false);
    document.body.classList.remove('xr-active');
    rig.position.set(0, 0, 0);
    rig.quaternion.identity();
    if (desktopPose?.stage === stage()) {
      camera.position.copy(desktopPose.position);
      camera.quaternion.copy(desktopPose.quaternion);
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
    sound.unlock().catch(() => {});
    try {
      const immersive = await navigator.xr.requestSession('immersive-vr', { requiredFeatures: ['local-floor'] });
      await renderer.xr.setSession(immersive);
    } catch {
      announce('Η συνεδρία VR δεν άνοιξε. Μπορείς να συνεχίσεις στον browser.', 'miss');
    }
  });
}

function resize() {
  const width = window.innerWidth, height = window.innerHeight;
  camera.aspect = width / height;
  camera.fov = Math.min(96, THREE.MathUtils.radToDeg(2 * Math.atan(.51 * Math.max(1, 1.12 / camera.aspect))));
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

async function startWorld() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
    renderer.xr.enabled = true;
    renderer.xr.setReferenceSpaceType('local-floor');
    scene = new THREE.Scene();
    rig = new THREE.Group();
    camera = new THREE.PerspectiveCamera(54, 1, .05, 125);
    rig.add(camera);
    scene.add(rig);
    environments = await buildBethlehem(scene);
    navigation = new Navigation(camera, renderer, worlds[stage()], [], { pick: pickScreen, escape, lock: () => {}, canWalk: () => !inXR() }, rig);
    xrMenu = new XRMenu(scene, camera);
    xrFeedback = panel('', 2.48, .33, null, { dark: true });
    xrFeedback.position.set(0, .64, -1.9);
    xrFeedback.material.depthTest = false;
    xrFeedback.renderOrder = 1000;
    camera.add(xrFeedback);
    connectXR();
    window.addEventListener('resize', resize);
    resize();
    let last = 0;
    renderer.setAnimationLoop(time => {
      const dt = Math.min(.04, (time - last) / 1000);
      last = time;
      navigation.update(dt);
      environments[stage()].tick(dt);
      if (xrMenu.opened) {
        camera.getWorldPosition(head);
        xrMenu.update(head);
      }
      renderer.render(scene, camera);
    });
    offerXR();
  } catch (error) {
    $('scene-unavailable').hidden = false;
    console.error(error);
  } finally {
    $('loading').hidden = true;
    render();
  }
}

motion.addEventListener('change', () => { view.reduced = motion.matches; render(); });
touch.addEventListener('change', render);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  sound.stop();
  stopAssist();
  render();
});
render();
startWorld();
