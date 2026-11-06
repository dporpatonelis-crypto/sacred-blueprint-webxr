import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import './style.css';
import worlds from './data/worlds.json' with { type: 'json' };
import { LessonSession, lesson } from './session.js';
import { buildCourtyard } from './world.js';
import { buildHub } from './hub-world.js';
import { Navigation } from './navigation.js';
import { SpatialUI } from './spatial-ui.js';
import { loadActors } from './actors.js';
import { WaterQuiz } from './water-quiz.js';

const $ = id => document.getElementById(id);
document.getElementById('app').innerHTML = [
  '<main id="stage" aria-label="Η διαδρομή μας">',
  '<canvas id="scene" tabindex="0" aria-label="Τρισδιάστατη αυλή. Σύρε για να κοιτάξεις, WASD ή βελάκια για να κινηθείς. Οι κάρτες είναι διαθέσιμες και στον πλαϊνό πίνακα."></canvas>',
  '<div class="vignette"></div>',
  '<header class="masthead"><div class="brand"><span class="brand-mark" aria-hidden="true">✧</span><div><p class="eyebrow" id="scene-eyebrow">Τέσσερις νησίδες · 20 συνδέσεις</p><h1 id="journey-title">Η διαδρομή μας</h1></div></div>',
  '<div class="top-actions"><div class="progress-pill" aria-label="Πρόοδος"><div id="global-dots" class="progress-dots" aria-hidden="true"><i></i><i></i><i></i></div><output id="progress">0 / 20</output></div><button class="tool icon" id="help-button" aria-label="Οδηγίες">?</button><button class="tool" id="back-hub" hidden>↩ Χάρτης</button><button class="tool" id="final-button" hidden>Χάρτης εννοιών</button><span id="vr-slot"></span></div></header>',
  '<section id="welcome" aria-labelledby="welcome-title"><div class="welcome-inner"><div class="welcome-line"></div><p class="welcome-kicker">Από την παρομοίωση στις τρεις φάσεις</p><h2 id="welcome-title">Η Θεία<br>Οικονομία.</h2><p>Ιατρική παρομοίωση · Παλαιά Διαθήκη · Καινή Διαθήκη · Εκκλησία.<br>Τέσσερις νησίδες, είκοσι φωτεινές συνδέσεις.</p><p class="welcome-note"><strong>Να θυμάσαι:</strong> η ασθένεια είναι παρομοίωση· οι φάσεις είναι τρεις.</p><button id="start-button" class="start-button" disabled><span id="start-label">Ετοιμασία αυλής</span><span aria-hidden="true">↗</span></button><p class="subtle"><span class="desktop-instruction">Ποντίκι για το βλέμμα · WASD για τα βήματα.</span><span class="touch-instruction">Σύρε για να κοιτάξεις · κράτησε τον μοχλό για να περπατήσεις.</span><br>Η πρώτη γέφυρα είναι έτοιμη. Γέμισε τη σωστή απάντηση για να ανοίξει η επόμενη.</p></div><div class="welcome-footer"><span>Φθορά → Σωτηρία</span><span>Τρεις φάσεις</span></div></section>',
  '<aside id="lesson-panel" aria-labelledby="lesson-prompt" hidden><div class="panel-top"><span id="panel-kicker" class="panel-kicker">Σύνδεση 1 / 4</span><div><span id="step-number" class="step-number">01</span><button id="hide-panel" class="panel-close" aria-label="Κλείσιμο καρτών">×</button></div></div><h2 id="lesson-prompt">Η διαδρομή της σωτηρίας</h2><button id="go-station" class="go-button"><span aria-hidden="true">↗</span> Στο σημείο</button><div id="choices" class="choices" role="group" aria-label="Κάρτες εννοιών"></div><button id="connect-target" class="connect-target"><span class="target-icon" id="target-number">01</span><span id="connect-label">Στον φωτεινό στόχο</span></button><p id="station-explanation" class="station-explanation" hidden></p><p id="hint-text" hidden></p><div class="panel-foot"><button id="hint-button" class="text-button">Υπόδειξη</button><button id="resume-button" class="text-button" hidden>Συνέχεια</button><button id="reset-button" class="text-button">Νέα αρχή</button></div><p id="feedback" role="status" aria-live="polite">Επίλεξε · Σύνδεσε</p></aside>',
  '<div id="reticle" aria-hidden="true"></div>',
  '<section id="bridge-hud" hidden aria-label="Πρόοδος γέφυρας"><span class="water-kicker">Χτίσε το πέρασμα</span><div class="bridge-headline"><strong>Περάσματα</strong><output id="bridge-count">0 / 4</output></div><div id="bridge-parts"></div><p id="water-guide">Γέμισε το δοχείο της σωστής απάντησης.</p></section>',
  '<button id="fire-button" hidden aria-label="Κράτησε για βολή νερού προς το κέντρο"><span aria-hidden="true">◉</span><span>Νερό</span></button>',
  '<div class="keyboard-guide" id="keyboard-guide" hidden><span class="normal-guide"><span class="desktop-controls"><kbd>W A S D</kbd> κίνηση <span class="dot">·</span> σύρε για ματιά <span class="desktop-hint">· <kbd>Tab</kbd> κάρτες</span></span><span class="touch-controls">Κράτησε και σύρε τον μοχλό για κίνηση <span class="dot">·</span> σύρε για ματιά</span></span><span class="locked-guide">Στόχευσε και πάτησε <span class="dot">·</span> <kbd>Esc</kbd> για κάρτες</span></div>',
  '<div id="touch-walk" class="touch-walk" hidden role="group" aria-label="Χειριστήριο κίνησης αφής"><div class="touch-walk-pad"><span class="touch-walk-ring" aria-hidden="true"></span><span class="touch-walk-stick" id="touch-walk-stick" aria-hidden="true"></span></div><span class="touch-walk-label">Κίνηση</span></div>',
  '<footer class="bottom-bar" id="bottom-bar" hidden><nav class="scene-nav" aria-label="Σημεία μαθήματος"><span class="scene-nav-label">Η διαδρομή</span></nav><div><div id="saving-note" class="saving-note"></div><div class="explore-controls"><button class="tool paper" id="restore-panel">Κάρτες</button><button class="tool" id="skybox-toggle" aria-pressed="true">Ορίζοντας: εικόνα</button><button class="tool" id="gameplay-toggle" aria-pressed="true">Παιχνίδι νερού</button><button class="tool" id="motion-toggle" aria-pressed="false">Παύση κίνησης</button><button class="tool" id="look-button">Κάρτες στον χώρο</button></div></div></footer>',
  '<div class="failure-banner" id="failure-banner" role="alert" hidden><span id="failure-text"></span><button id="retry-button">Επαναφόρτωση</button></div>',
  '</main>',
  '<dialog id="reset-dialog" aria-labelledby="reset-title"><p class="dialog-kicker">Η διαδρομή σου</p><h2 id="reset-title">Νέα αρχή;</h2><p id="reset-description">Οι συνδέσεις θα ξεκινήσουν από την αρχή.</p><div class="dialog-actions"><button class="dialog-button" id="reset-cancel">Ακύρωση</button><button class="dialog-button" id="reset-all" hidden>Όλη η διαδρομή</button><button class="dialog-button primary" id="reset-confirm">Επαναφορά</button></div></dialog>',
  '<dialog id="help-dialog" aria-labelledby="help-title"><p class="dialog-kicker">Ένας μικρός οδηγός</p><h2 id="help-title">Βήματα στην αυλή</h2><dl><dt>Παρατήρησε</dt><dd>Σύρε με το ποντίκι ή το δάχτυλο για να κοιτάξεις γύρω σου.</dd><dt>Περπάτησε</dt><dd>WASD ή βελάκια στον υπολογιστή· σε tablet/κινητό, κράτησε και σύρε τον μοχλό κάτω αριστερά. Το «Στο σημείο» σε μεταφέρει δίπλα στην ενεργή σκηνή.</dd><dt>Γέμισε</dt><dd>Κράτησε πατημένο ένα δοχείο ή την κάρτα της απάντησης για περίπου 1,5 δευτερόλεπτο. Το water blaster γεμίζει το δοχείο. Με Space ή το «Νερό» πυροβολείς προς το κέντρο της οθόνης.</dd><dt>Χτίσε</dt><dd>Σωστή απάντηση: ανοίγει η επόμενη γέφυρα. Λάθος απάντηση: το δοχείο αδειάζει· άφησε τη βολή και δοκίμασε ξανά. Με δύο λάθη εμφανίζεται υπόδειξη. Η πρώτη γέφυρα είναι έτοιμη. Τα δοχεία εμφανίζονται μόλις ανέβεις στην ανοιχτή γέφυρα, προς τον σταθμό. Απάντησε για να ανοίξει η επόμενη. Ο χάρτης έχει 4 απαντήσεις, κάθε ενότητα 4.</dd><dt>Κλασικές κάρτες</dt><dd>Το «Παιχνίδι νερού» εναλλάσσει τον μηχανισμό με την αρχική επιλογή κάρτας και στόχου.</dd><dt>Χωρικές κάρτες</dt><dd>Το «Κάρτες στον χώρο» μεταφέρει τις επιλογές μέσα στη σκηνή. Πάτησέ τες με το ποντίκι. Esc ή «Πίνακας καρτών» για επιστροφή.</dd><dt>Ξαναδές</dt><dd>Πάτησε μια λυμένη κάρτα ή σκηνή για επανεξέταση.</dd><dt>Σε VR</dt><dd>Κράτησε trigger στο δοχείο για νερό. Πάτησε για επιλογή ή για τα ανοιχτά σημεία τηλεμεταφοράς στο δάπεδο. Joystick δεξιά/αριστερά για στροφή ανά 45°.</dd></dl><div class="dialog-actions"><button class="dialog-button primary" id="help-close">Στην αυλή</button></div></dialog>',
  '<dialog id="completion-dialog" aria-labelledby="completion-title"><div class="completion-seal" aria-hidden="true">✧</div><p class="dialog-kicker" id="completion-kicker">Η ενότητα φωτίστηκε · 4 / 4</p><h2 id="completion-title">Η ενότητα<br>φωτίστηκε.</h2><p>Άνοιξε και η γέφυρα επιστροφής. Διάσχισε το ποτάμι για να παρατηρήσεις τις σκηνές ή επέστρεψε στον κεντρικό χάρτη.</p><div class="completion-words" id="completion-words"></div><div class="dialog-actions"><button id="completion-hub" class="dialog-button primary">Στον χάρτη</button><button id="completion-close" class="dialog-button primary">Συνέχισε την περιήγηση</button><button id="completion-reset" class="dialog-button">Νέα αρχή</button></div></dialog>',
  '<dialog id="final-dialog" class="mind-map-dialog" aria-labelledby="final-title"><p class="dialog-kicker" id="final-kicker">Η διαδρομή ολοκληρώθηκε · 20 / 20</p><h2 id="final-title" tabindex="-1" autofocus>Ο νοητικός χάρτης της Θείας Οικονομίας</h2><section id="final-mind-map" class="mind-map" aria-label="Νοητικός χάρτης των τεσσάρων ενοτήτων"></section><p id="final-question" class="mind-map-question"></p><div class="dialog-actions"><button class="dialog-button primary" id="final-back">Στον χάρτη</button></div></dialog>',
  '<div id="scene-loading" hidden role="status">Μετάβαση…</div>',
].join('');

if (import.meta.env.VITE_COLLECTION_URL) {
  const collectionLink = document.createElement('a');
  collectionLink.className = 'dialog-button'; collectionLink.textContent = 'Όλοι οι κόσμοι';
  collectionLink.href = import.meta.env.VITE_COLLECTION_URL;
  document.querySelector('#help-dialog .dialog-actions').prepend(collectionLink);
}

let storage = null;
try { storage = window.localStorage; } catch {}
// Experimental gameplay has its own save slot, including on the same origin.
const waterStorage = storage && { getItem: key => storage.getItem(key + '.water-v1'), setItem: (key, value) => storage.setItem(key + '.water-v1', value) };
const session = new LessonSession(waterStorage);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(66, 1, 0.08, 180);
const rig = new THREE.Group(); rig.add(camera); scene.add(rig);
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: $('scene'), antialias: true, powerPreference: 'high-performance' }); }
catch (error) { fail('Ο browser δεν μπόρεσε να ανοίξει τη διαδρομή.'); throw error; }
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.16;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true; renderer.xr.setReferenceSpaceType('local-floor'); renderer.xr.setFramebufferScaleFactor(0.9);
let world = worlds[session.sceneId], level = null, courtyard = null, spatial = null, actors = null, waterQuiz = null;
let waterMode = true;
let firing = { active: false };
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(), cameraPosition = new THREE.Vector3(), rotationMatrix = new THREE.Matrix4();
let started = false, ready = false, changingScene = false, vrButton = null, revealTimer = 0, pendingFinal = false;
let lastTime = performance.now(), lastProximity = null, hovered = null, motionOverride = null;
let fpsTime = 0, fpsFrames = 0, desktopPose = null, turnLatched = false, teleportFlash = -1000;
let resetScope = 'all', uiScene = null, skybox = null, skyboxEnabled = true;
let worldCards = false, lastStationNear = null;
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => motionOverride ?? preference.matches;
const navigation = new Navigation(camera, renderer, world, [], {
  pick: point => pickDesktop(point),
  canWalk: (x,z) => courtyard?.canWalk?.(x,z) ?? true,
  lock: locked => document.body.classList.toggle('pointer-locked', locked),
  escape: () => {
    if (session.selected) { session.selected = null; session.changed(false); }
    document.body.classList.remove('panel-hidden');
    setWorldCards(false);
  },
});
const choiceButtons = new Map();
function fail(message) { $('failure-text').textContent = message; $('failure-banner').hidden = false; }
function visibleInHierarchy(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return !object.userData.disabled;
}
function hitFromRay(ray, includeTeleport = false) {
  const objects = [...(waterQuiz?.pickables || []), ...(spatial?.pickables || []), ...(actors?.pickables || []), ...(includeTeleport ? teleportTargets : [])].filter(visibleInHierarchy);
  return ray.intersectObjects(objects, false).find(hit => hit.distance <= (includeTeleport ? 16 : 10)) || null;
}
function pickDesktop(point) {
  if (!started || changingScene || renderer.xr.isPresenting || document.querySelector('dialog[open]')) return;
  if (point) {
    const rect = $('scene').getBoundingClientRect();
    pointer.set((point.x - rect.left) / rect.width * 2 - 1, -(point.y - rect.top) / rect.height * 2 + 1);
  } else pointer.set(0, 0);
  raycaster.setFromCamera(pointer, camera);
  const hit = hitFromRay(raycaster);
  if (hit) action(hit.object.userData.action);
}
function activeConfig() { return world.stations.find(s => s.id === session.visibleStation.id); }
function stationPose(station) {
  const index = world.stations.indexOf(station), approach = courtyard?.approaches?.[index];
  if (!approach) return station;
  return { ...station, landing: approach.viewpoint, lookHeight: 1.35,
    position: waterMode && session.current?.id === station.id ? approach.quizPosition : station.position };
}
function availableLandings() {
  return [world.spawn,...world.stations.slice(0,session.localCount+1).map(station=>stationPose(station).landing)];
}
function atActiveStation() {
  if (session.sceneComplete) return true;
  const station = world.stations.find(s=>s.id===session.current?.id);
  const p = renderer.xr.isPresenting ? cameraPosition : camera.position;
  const approach = courtyard?.approaches?.[world.stations.indexOf(station)];
  if (approach) return approach.contains(p.x,p.z);
  return Boolean(station && courtyard?.onLand(p.x,p.z) && Math.hypot(p.x-station.landing[0],p.z-station.landing[1]) < 2.5);
}
function canFire() {
  return atActiveStation() && started && ready && waterMode && !changingScene && !session.busy && !session.sceneComplete && !session.reviewId && !document.querySelector('dialog[open]');
}
function beginFire(input) {
  if (!canFire() || firing.active) return;
  firing = { active: true, ...input };
  $('fire-button').classList.add('firing');
}
function stopFire() {
  firing = { active: false };
  waterQuiz?.fill.release();
  $('fire-button').classList.remove('firing');
}
function bindPourButton(button, id) {
  button.addEventListener('pointerdown', event => {
    if (!canFire() || session.solved(id)) return;
    event.preventDefault();
    beginFire({ mode: 'guided', id, pointerId: event.pointerId });
    button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('keydown', event => {
    if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat && canFire()) {
      event.preventDefault(); event.stopPropagation(); beginFire({ mode: 'guided', id, keyboard: true });
    }
  });
  button.addEventListener('keyup', event => { if (event.code === 'Space' || event.code === 'Enter') stopFire(); });
}
function updateFire() {
  const shot = { ...firing, xr: renderer.xr.isPresenting, worldPrompt: renderer.xr.isPresenting || document.body.classList.contains('panel-hidden'), direction: new THREE.Vector3() };
  camera.getWorldDirection(shot.direction);
  if (!shot.active || changingScene || !waterQuiz) return shot;
  if (shot.mode === 'guided') return shot;
  if (shot.mode === 'xr') {
    controllerRay(shot.controller);
    shot.origin = raycaster.ray.origin.clone(); shot.direction.copy(raycaster.ray.direction);
  } else {
    if (shot.mode === 'canvas') {
      const rect = $('scene').getBoundingClientRect();
      pointer.set((shot.point.x - rect.left) / rect.width * 2 - 1, -(shot.point.y - rect.top) / rect.height * 2 + 1);
    } else pointer.set(0,0);
    raycaster.setFromCamera(pointer,camera); shot.direction.copy(raycaster.ray.direction);
  }
  const hit = raycaster.intersectObjects(waterQuiz.pickables.filter(visibleInHierarchy),false).find(h => h.distance <= 10);
  shot.id = waterQuiz.root.visible ? hit?.object.userData.action.id : null;
  return shot;
}
function updateFillHUD() {
  for (const [id, button] of choiceButtons) {
    if (!button.classList.contains('pour-choice')) { button.style.removeProperty('--fill'); continue; }
    const level = session.solved(id) ? 100 : Math.floor((waterQuiz?.fill.levels.get(id) || 0) * 100);
    button.style.setProperty('--fill', level + '%');
    button.classList.toggle('pouring',firing.active && (firing.id === id));
    let value = button.querySelector('.pour-value');
    if (!value) { value = document.createElement('span'); value.className = 'pour-value'; button.append(value); }
    const text = level ? level + '%' : 'Κράτησε'; if (value.textContent !== text) value.textContent = text;
  }
  $('scene').dataset.bridgeParts = session.localCount + '/' + session.sceneData.stations.length;
}
function submitWater(id) {
  const current = session.current;
  if (!current || session.busy || session.solved(id)) return;
  session.choose(id);
  const result = action({ type: 'target', id: current.id, water: true });
  if (result?.type === 'wrong') waterQuiz.reject(id,performance.now());
  if (result?.type === 'matched') {
    session.message = 'Σωστά! Άνοιξε η επόμενη γέφυρα.'; session.changed(false);
  }
}
// Capture a hold on a vessel before the canvas navigation interprets it as drag.
$('scene').addEventListener('pointerdown', event => {
  if (!canFire() || event.button !== 0) return;
  const rect = $('scene').getBoundingClientRect();
  pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hit = raycaster.intersectObjects(waterQuiz.pickables.filter(visibleInHierarchy),false).find(h=>h.distance<=10);
  if (!hit || !waterQuiz.root.visible) return;
  event.preventDefault(); event.stopImmediatePropagation();
  beginFire({ mode:'canvas', point:{x:event.clientX,y:event.clientY}, pointerId:event.pointerId });
  $('scene').setPointerCapture(event.pointerId);
},true);
$('scene').addEventListener('pointermove', event => {
  if (firing.mode==='canvas' && firing.pointerId===event.pointerId) firing.point={x:event.clientX,y:event.clientY};
});
for (const name of ['pointerup','pointercancel','lostpointercapture']) window.addEventListener(name,event=> {
  if (firing.pointerId===event.pointerId) stopFire();
});
$('fire-button').addEventListener('pointerdown',event=> {
  event.preventDefault(); beginFire({ mode:'center', pointerId:event.pointerId }); $('fire-button').setPointerCapture(event.pointerId);
});
document.addEventListener('keydown',event=> {
  if (event.code!=='Space' || event.repeat || /^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(event.target.tagName)) return;
  if (canFire()) { event.preventDefault(); beginFire({mode:'center',keyboard:true}); }
});
document.addEventListener('keyup',event=> { if (event.code==='Space' && firing.keyboard) stopFire(); });
window.addEventListener('blur',stopFire);
document.addEventListener('visibilitychange',stopFire);
function goTo(station = activeConfig()) {
  if (changingScene || !station) return;
  stopFire();
  const index = world.stations.findIndex(s=>s.id===station.id);
  if (index > session.localCount) return;
  const pose = stationPose(station);
  if (renderer.xr.isPresenting) return teleportTo(pose.landing);
  navigation.goTo(pose); renderProximity(true);
}
function action(event) {
  if (!event || changingScene) return;
  let result;
  if (event.type === 'target' && !atActiveStation() && !session.solved(event.id)) {
    session.message = 'Ανέβα στη γέφυρα προς τον ενεργό σταθμό'; session.changed(false); return;
  }
  if (event.type === 'target' && waterMode && !event.water && !session.solved(event.id) && !session.sceneComplete) {
    session.message = 'Γέμισε το δοχείο της απάντησης'; session.changed(false); return;
  }
  if (event.type === 'word') result = session.choose(event.id);
  if (event.type === 'target') result = session.target(event.id);
  if (result?.type === 'enter') { void changeScene(result.sceneId); return; }
  if (result?.type === 'matched') {
    spatial.flash(result.stationId, performance.now());
    pendingFinal ||= result.scenarioCompleted;
    clearTimeout(revealTimer);
    revealTimer = setTimeout(() => {
      if (!session.finishReveal(result.token)) return;
      rebuildTeleportTargets();
      if (session.complete) { pendingFinal = false; if (!renderer.xr.isPresenting) showDialog('final-dialog'); }
      else if (session.sceneComplete && !session.inHub && !renderer.xr.isPresenting) showDialog('completion-dialog');
    }, reducedMotion() ? 0 : 1150);
  }
  if (event.type === 'hint') session.hint();
  if (event.type === 'resume') session.resume();
  if (event.type === 'hub') { void changeScene('main'); return; }
  if (event.type === 'request-reset') {
    resetScope = session.inHub ? 'all' : 'scene';
    if (renderer.xr.isPresenting) spatial.setResetConfirm(true); else showReset(resetScope);
  }
  if (event.type === 'cancel-reset') spatial.setResetConfirm(false);
  if (event.type === 'confirm-reset') {
    clearTimeout(revealTimer); pendingFinal = false; spatial.flashes.clear(); spatial.resetConfirm = false;
    if (resetScope === 'all' && !session.inHub) { void changeScene('main', true, true); return; }
    stopFire(); waterQuiz?.fill.reset(); session.reset(resetScope);
    for (const actor of actors?.actors.values() || []) actor.value = 0.16;
    if (!renderer.xr.isPresenting) navigation.spawn(); else teleportTo(world.spawn);
  }
  if (event.type === 'teleport') teleportTo(event.point);
  return result;
}
function rebuildChoices() {
  if (uiScene === session.sceneId) return;
  uiScene = session.sceneId; choiceButtons.clear(); $('choices').replaceChildren();
  for (const station of session.choices) {
    const b = document.createElement('button');
    b.className = 'choice'; b.dataset.choice = station.id;
    b.addEventListener('click', () => { if (!waterMode || session.sceneComplete || session.reviewId) action({ type: 'word', id: station.id }); });
    bindPourButton(b, station.id);
    choiceButtons.set(station.id, b);
  }
  const nav = document.querySelector('.scene-nav'); nav.replaceChildren();
  const home = document.createElement('button'); home.id = 'overview-button'; home.textContent = '⌂';
  home.setAttribute('aria-label', 'Συνολική άποψη του χώρου');
  home.addEventListener('click', () => {
    if (renderer.xr.isPresenting) teleportTo(world.spawn);
    else { navigation.spawn(); renderProximity(true); }
  });
  nav.append(home);
  for (const item of session.sceneData.stations) {
    const cfg = world.stations.find(s => s.id === item.id), b = document.createElement('button');
    b.dataset.station = item.id; b.textContent = String(cfg.number).padStart(2, '0');
    b.setAttribute('aria-label', 'Σημείο ' + cfg.number + ': ' + item.word);
    b.addEventListener('click', () => {
      if (session.solved(item.id)) session.review(item.id); else session.resume();
      goTo(cfg);
    });
    nav.append(b);
  }
}
function renderFinalMindMap() {
  const host = $('final-mind-map');
  if (!host) return;
  host.replaceChildren();
  const map = lesson.finalMindMap;
  const intro = document.createElement('div'); intro.className = 'mind-map-intro';
  const center = document.createElement('div'); center.className = 'mind-map-center';
  const title = document.createElement('strong'); title.textContent = map.center;
  const summary = document.createElement('span'); summary.textContent = map.summary;
  center.append(title, summary); intro.append(center);
  const roots = document.createElement('div'); roots.className = 'mind-map-roots';
  for (const [label, value] of [['Αφετηρία', map.premise], ['Κίνητρο', map.initiative], ['Σκοπός', map.goal]]) {
    const chip = document.createElement('div'); chip.className = 'mind-map-root-chip';
    const key = document.createElement('small'); key.textContent = label;
    const text = document.createElement('strong'); text.textContent = value;
    chip.append(key, text); roots.append(chip);
  }
  intro.append(roots); host.append(intro);
  const branches = document.createElement('div'); branches.className = 'mind-map-branches';
  for (const group of lesson.groups) {
    const scene = lesson.scenes.find(item => item.id === group.sceneId);
    const card = document.createElement('article'); card.className = 'mind-map-branch ' + (group.role === 'analogy' ? 'analogy' : 'phase');
    const imageDef = lesson.images[group.imageId || group.id];
    if (imageDef?.src) {
      const image = document.createElement('img'); image.className = 'mind-map-image';
      image.src = import.meta.env.BASE_URL + imageDef.src; image.alt = 'Εικονογράφηση: ' + group.word; image.loading = 'lazy'; card.append(image);
    }
    const badge = document.createElement('small'); badge.className = 'mind-map-badge';
    badge.textContent = group.role === 'analogy' ? 'Ιατρική παρομοίωση · όχι φάση' : group.phaseLabel;
    const heading = document.createElement('h3'); heading.textContent = group.word;
    const list = document.createElement('ul'); list.className = 'mind-map-terms';
    for (const station of scene.stations) {
      const item = document.createElement('li'); item.textContent = station.word; list.append(item);
    }
    card.append(badge, heading, list); branches.append(card);
  }
  host.append(branches);
  const ending = document.createElement('p'); ending.className = 'mind-map-ending';
  ending.textContent = 'Η παρομοίωση φωτίζει τον σκοπό· οι τρεις φάσεις δείχνουν την πορεία της σωτηρίας.';
  host.append(ending);
}

function renderUI() {
  if (changingScene || !spatial) return;
  rebuildChoices();
  const reviewing = Boolean(session.reviewId), completed = session.sceneComplete;
  const traveling = !completed && !reviewing && !session.busy && !atActiveStation();
  const portal = session.inHub && session.unlocked, station = session.visibleStation;
  const number = session.sceneData.stations.findIndex(s => s.id === station.id) + 1;
  $('progress').textContent = session.count + ' / ' + session.size;
  $('global-dots').replaceChildren(...Array.from({ length: session.size }, (_, i) => {
    const dot = document.createElement('i'); dot.classList.toggle('done', i < session.count); return dot;
  }));
  $('journey-title').textContent = session.inHub ? 'Θεία Οικονομία' : session.sceneData.title;
  $('lesson-panel').classList.toggle('hub-panel', session.inHub);
  $('scene-eyebrow').textContent = session.inHub ? 'Τέσσερις νησίδες · 20 συνδέσεις' : (lesson.groups.find(g=>g.sceneId===session.sceneId)?.phaseLabel || session.sceneData.title);
  $('back-hub').hidden = session.inHub;
  $('final-button').hidden = !session.complete;
  $('panel-kicker').textContent = portal ? 'Ο κεντρικός χάρτης φωτίστηκε' : reviewing ? 'Επανεξέταση' : completed ? 'Η ενότητα ολοκληρώθηκε · 4 / 4' : 'Σύνδεση ' + number + ' / ' + session.sceneData.stations.length;
  $('step-number').textContent = String(number).padStart(2, '0');
  $('lesson-prompt').textContent = traveling ? 'Προχώρησε στον σταθμό ' + number : portal ? 'Διάλεξε νησίδα' : reviewing || completed ? station.word : station.prompt;
  $('lesson-panel').classList.toggle('route-panel', traveling);
  $('choices').hidden = traveling;
  const explained = reviewing ? station : session.busy ? session.sceneData.stations[session.localCount-1] : completed ? station : null;
  $('station-explanation').hidden = !explained;
  $('station-explanation').textContent = explained?.explanation || '';
  $('feedback').textContent = traveling ? 'Ανέβα στην ανοιχτή γέφυρα για να εμφανιστούν τα δοχεία.' : session.message; $('feedback').dataset.kind = session.kind;
  $('hint-text').hidden = reviewing || completed || !session.hasHint(station.id);
  $('hint-text').textContent = station.hint;
  $('hint-button').hidden = reviewing || completed || traveling; $('hint-button').disabled = session.busy;
  $('resume-button').hidden = !reviewing || completed;
  $('reset-button').textContent = session.inHub ? 'Νέα αρχή' : 'Επαναφορά';
  $('saving-note').textContent = session.canStore ? 'Η πρόοδός σου αποθηκεύεται εδώ' : 'Μνήμη συνεδρίας';
  $('target-number').textContent = String(number).padStart(2, '0');
  $('connect-label').textContent = reviewing || completed ? 'Δες τη σκηνή' : session.selected ? 'Σύνδεσε στον στόχο' : 'Στον φωτεινό στόχο';
  $('connect-target').classList.toggle('ready', Boolean(session.selected)); $('connect-target').hidden = traveling || portal || (waterMode && !reviewing && !completed);
  session.choices.forEach(s => {
    const b = choiceButtons.get(s.id); $('choices').append(b);
    b.textContent = s.word; b.classList.toggle('portal-choice', portal);
    if (portal) {
      const progress = document.createElement('span'); progress.className = 'choice-progress';
      progress.textContent = session.groupProgress(s.id) + ' / ' + session.groupSize(s.id) + ' ↗'; b.append(progress);
    }
    b.classList.toggle('selected', session.selected === s.id || session.reviewId === s.id);
    b.classList.toggle('solved', session.solved(s.id) && !portal);
    b.setAttribute('aria-pressed', String(session.selected === s.id || session.reviewId === s.id));
    b.disabled = session.busy || (waterMode && !portal && !reviewing && !completed && session.solved(s.id));
    b.classList.toggle('pour-choice', waterMode && !portal && !reviewing && !completed);
  });
  document.querySelectorAll('[data-station]').forEach(b => {
    const id = b.dataset.station, solved = session.solved(id), active = session.current?.id === id;
    b.disabled = !solved && !active;
    b.classList.toggle('done', solved); b.classList.toggle('active', session.visibleStation.id === id);
    b.setAttribute('aria-current', session.visibleStation.id === id ? 'step' : 'false');
  });
  $('skybox-toggle').hidden = !session.inHub;
  $('skybox-toggle').textContent = skyboxEnabled ? 'Ορίζοντας: εικόνα' : 'Ορίζοντας: απλός';
  $('skybox-toggle').setAttribute('aria-pressed', String(skyboxEnabled));
  $('completion-title').textContent = session.sceneData.title;
  $('completion-words').replaceChildren(...session.sceneData.stations.map(s => {
    const span = document.createElement('span'); span.textContent = '✓ ' + s.word; return span;
  }));
  $('final-question').textContent = lesson.finalQuestion;
  renderFinalMindMap();
  waterQuiz?.sync(session);
  $('bridge-hud').hidden = !started;
  $('bridge-count').textContent = session.localCount + ' / ' + session.sceneData.stations.length;
  $('bridge-parts').replaceChildren(...session.sceneData.stations.map((_,i) => {
    const piece = document.createElement('i'); piece.className = i < session.localCount ? 'raised' : ''; return piece;
  }));
  $('water-guide').textContent = completed ? 'Όλες οι γέφυρες άνοιξαν · εξερεύνησε ελεύθερα' : traveling ? 'Ανέβα στη γέφυρα · σταθμός ' + number : waterMode ? 'Απάντησε εδώ · γέμισε το σωστό δοχείο' : 'Απάντησε εδώ · σύνδεσε τη σωστή κάρτα';
  $('gameplay-toggle').textContent = waterMode ? 'Παιχνίδι νερού' : 'Κλασικές κάρτες';
  $('gameplay-toggle').setAttribute('aria-pressed', String(waterMode));
  $('fire-button').hidden = !started || !waterMode || completed || reviewing || traveling;
  $('look-button').hidden = waterMode && !completed;
  $('go-station').textContent = traveling ? '↗ Στον σταθμό ' + number : '↗ Μπροστά στον σταθμό';
  document.body.classList.toggle('water-mode',waterMode && !completed && !reviewing && started);
  spatial.refresh(); renderProximity(true);
}
function renderProximity(force = false) {
  if (changingScene || !spatial) return;
  const station = activeConfig(), p = renderer.xr.isPresenting ? cameraPosition : camera.position;
  const near = Math.hypot(p.x - station.position[0], p.z - station.position[1]) < 6;
  const key = String(near) + String(session.busy);
  if (key !== lastProximity || force) {
    $('connect-target').disabled = session.busy;
    $('connect-target').title = near ? 'Σύνδεσε την κάρτα με τον στόχο' : 'Πλησίασε τη σκηνή ή πάτησε «Στο σημείο»';
    lastProximity = key;
  }
}
function syncNavigation() {
  if (document.querySelector('dialog[open]') || changingScene) stopFire();
  navigation.enabled = started && !changingScene && !document.querySelector('dialog[open]') && !renderer.xr.isPresenting;
  if (!navigation.enabled) navigation.keys.clear();
}
function showDialog(id) {
  if (navigation.controls.isLocked) navigation.controls.unlock();
  $(id).showModal(); syncNavigation();
}
function closeDialog(id) { $(id).close(); syncNavigation(); }
function showReset(scope) {
  resetScope = scope;
  $('reset-title').textContent = scope === 'all' ? 'Νέα αρχή;' : 'Επαναφορά ενότητας;';
  $('reset-description').textContent = scope === 'all' ? 'Θα ξεκινήσουν από την αρχή και οι 20 συνδέσεις.' : 'Θα ξεκινήσουν από την αρχή οι τέσσερις συνδέσεις αυτής της ενότητας.';
  $('reset-all').hidden = scope === 'all';
  if (!$('reset-dialog').open) showDialog('reset-dialog');
}
function start() {
  if (!ready) return;
  started = true; $('welcome').hidden = true; $('lesson-panel').hidden = false;
  $('bottom-bar').hidden = false; $('keyboard-guide').hidden = false; $('touch-walk').hidden = false;
  syncNavigation(); renderUI();
}
$('start-button').addEventListener('click', start);
$('go-station').addEventListener('click', () => goTo());
$('connect-target').addEventListener('click', () => action({ type: 'target', id: session.visibleStation.id }));
$('hint-button').addEventListener('click', () => action({ type: 'hint' }));
$('resume-button').addEventListener('click', () => action({ type: 'resume' }));
$('reset-button').addEventListener('click', () => action({ type: 'request-reset' }));
$('reset-cancel').addEventListener('click', () => closeDialog('reset-dialog'));
$('reset-confirm').addEventListener('click', () => { closeDialog('reset-dialog'); action({ type: 'confirm-reset' }); });
$('reset-all').addEventListener('click', () => showReset('all'));
$('help-button').addEventListener('click', () => showDialog('help-dialog'));
$('help-close').addEventListener('click', () => closeDialog('help-dialog'));
$('completion-close').addEventListener('click', () => closeDialog('completion-dialog'));
$('completion-hub').addEventListener('click', () => { closeDialog('completion-dialog'); void changeScene('main'); });
$('completion-reset').addEventListener('click', () => { closeDialog('completion-dialog'); action({ type: 'request-reset' }); });
$('back-hub').addEventListener('click', () => void changeScene('main'));
$('final-button').addEventListener('click', () => showDialog('final-dialog'));
$('final-back').addEventListener('click', () => { closeDialog('final-dialog'); void changeScene('main'); });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', syncNavigation));
$('look-button').addEventListener('click', () => {
  setWorldCards(!worldCards);
});
function setWorldCards(value) {
  worldCards = value;
  document.body.classList.toggle('spatial-cards', value);
  document.body.classList.remove('panel-hidden');
  $('look-button').textContent = value ? 'Πίνακας καρτών' : 'Κάρτες στον χώρο';
  $('look-button').setAttribute('aria-pressed', String(value));
}
$('hide-panel').addEventListener('click', () => { setWorldCards(false); document.body.classList.add('panel-hidden'); });
$('restore-panel').addEventListener('click', () => setWorldCards(false));
$('retry-button').addEventListener('click', () => location.reload());
function renderMotion() {
  $('motion-toggle').textContent = reducedMotion() ? 'Ενεργοποίηση κίνησης' : 'Παύση κίνησης';
  $('motion-toggle').setAttribute('aria-pressed', String(reducedMotion()));
}
$('motion-toggle').addEventListener('click', () => { motionOverride = !reducedMotion(); renderMotion(); });
preference.addEventListener('change', renderMotion);
$('gameplay-toggle').addEventListener('click', () => { stopFire(); waterMode = !waterMode; setWorldCards(false); renderUI(); });
$('skybox-toggle').addEventListener('click', () => {
  skyboxEnabled = !skyboxEnabled; applyBackground(); renderUI();
});
session.onChange = renderUI; renderMotion(); setWorldCards(false);

// Fixed landing points avoid continuous artificial motion in VR.
const teleportTargets = [];
function rebuildTeleportTargets() {
  for (const marker of teleportTargets) { scene.remove(marker); marker.geometry.dispose(); marker.material.dispose(); }
  teleportTargets.length = 0;
for (const point of availableLandings()) {
  const marker = new THREE.Mesh(new THREE.RingGeometry(0.24, 0.35, 32), new THREE.MeshBasicMaterial({ color: 0xe9ce85, side: THREE.DoubleSide, transparent: true, opacity: 0.82, depthWrite: false, toneMapped: false }));
  marker.position.set(point[0], point === world.spawn ? (session.inHub ? .19 : .07) : .29, point[1]); marker.rotation.x = -Math.PI / 2;
  marker.userData.action = { type: 'teleport', point }; marker.visible = renderer.xr.isPresenting; scene.add(marker); teleportTargets.push(marker);
}
}
const fade = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0x102c25, side: THREE.BackSide, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
fade.renderOrder = 1000; fade.visible = false; camera.add(fade);
function teleportTo(point) {
  if (!renderer.xr.isPresenting) return;
  stopFire();
  const permitted = availableLandings();
  if (!permitted.some(p=>p[0]===point[0] && p[1]===point[1])) return;
  teleportFlash = performance.now();
  fade.visible = true; fade.material.opacity = 0.95;
  rig.position.x = point[0]; rig.position.z = point[1]; rig.updateMatrixWorld(true);
}
const controllers = [];
for (let i = 0; i < 2; i++) {
  const controller = renderer.xr.getController(i); rig.add(controller);
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xf2d58c, transparent: true, opacity: 0.8 }));
  line.scale.z = 8; controller.add(line);
  const cursor = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe7a7, toneMapped: false }));
  cursor.visible = false; scene.add(cursor);
  controller.addEventListener('selectstart', () => {
    if (!renderer.xr.isPresenting) return;
    controllerRay(controller);
    const hit = hitFromRay(raycaster, true);
    if (waterMode && !session.sceneComplete && !session.reviewId && (!hit || hit.object.userData.action?.type === 'vessel')) { beginFire({ mode: 'xr', controller, id: hit?.object.userData.action?.id }); return; }
    if (hit) action(hit.object.userData.action);
  });
  controller.addEventListener('selectend', () => { if (firing.controller === controller) stopFire(); });
  controllers.push({ controller, line, cursor });
}
function controllerRay(controller) {
  rotationMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(rotationMatrix).normalize();
}
renderer.xr.addEventListener('sessionstart', () => {
  stopFire();
  desktopPose = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
  if (navigation.controls.isLocked) navigation.controls.unlock();
  const yaw = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ').y;
  rig.position.set(camera.position.x, 0, camera.position.z); rig.rotation.y = yaw;
  camera.position.set(0, 0, 0); camera.quaternion.identity();
  document.body.classList.add('xr-active');
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  teleportTargets.forEach(m => { m.visible = true; });
  start(); syncNavigation();
});
renderer.xr.addEventListener('sessionend', () => {
  stopFire();
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  if (desktopPose) { camera.position.copy(desktopPose.position); camera.quaternion.copy(desktopPose.quaternion); }
  document.body.classList.remove('xr-active');
  teleportTargets.forEach(m => { m.visible = false; }); controllers.forEach(c => { c.cursor.visible = false; });
  fade.visible = false; spatial.setResetConfirm(false); syncNavigation();
});
async function prepareVR() {
  if (!navigator.xr || !await navigator.xr.isSessionSupported('immersive-vr').catch(() => false)) return;
  vrButton = VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor'] });
  vrButton.id = 'vr-button'; vrButton.className = 'tool'; vrButton.style.cssText = '';
  $('vr-slot').append(vrButton);
  const translate = () => {
    const text = renderer.xr.isPresenting ? 'Έξοδος VR' : 'Είσοδος VR';
    if (vrButton.textContent !== text) vrButton.textContent = text;
  };
  new MutationObserver(translate).observe(vrButton, { childList: true }); translate();
  renderer.xr.addEventListener('sessionstart', translate); renderer.xr.addEventListener('sessionend', translate);
}

function resize() {
  if (renderer.xr.isPresenting) return;
  const w = $('scene').clientWidth, h = $('scene').clientHeight;
  renderer.setSize(w, h, false); camera.aspect = w / h;
  const baseFov = world.kind === 'hub' ? 66 : 68;
  // Preserve the overview's horizontal framing in a narrow preview pane.
  camera.fov = Math.min(105, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * Math.max(1, 1.6 / camera.aspect))));
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('stage')); resize();
// Long questions change the mobile panel height; keep movement/fire above it.
new ResizeObserver(() => {
  $('stage').style.setProperty('--lesson-panel-height', $('lesson-panel').getBoundingClientRect().height + 'px');
}).observe($('lesson-panel'));
function disposeLevel(root) {
  if (!root) return;
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    object.shadow?.dispose?.();
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
      for (const uniform of Object.values(material.uniforms || {})) if (uniform.value?.isTexture) textures.add(uniform.value);
    }
  });
  geometries.forEach(g => g.dispose()); textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose());
}
async function getSkybox() {
  if (!skybox) {
    skybox = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + worlds.main.skybox);
    skybox.colorSpace = THREE.SRGBColorSpace; skybox.mapping = THREE.EquirectangularReflectionMapping;
  }
  return skybox;
}
function applyBackground() {
  if (!level) return;
  scene.background = session.inHub && skyboxEnabled && skybox ? skybox : level.background;
  scene.fog = level.fog; scene.backgroundIntensity = 1;
  scene.backgroundRotation.set(0, 2.25, 0);
  $('scene').dataset.skybox = String(session.inHub && skyboxEnabled && Boolean(skybox));
}
async function changeScene(id, force = false, resetAll = false) {
  if (changingScene || (!force && level && id === session.sceneId)) return;
  if (id !== 'main' && !session.unlocked) return;
  const previousId = session.sceneId, cfg = worlds[id];
  changingScene = true; stopFire(); clearTimeout(revealTimer);
  $('stage').setAttribute('aria-busy', 'true');
  $('scene-loading').textContent = 'Μετάβαση · ' + CoreTitle(id);
  $('scene-loading').hidden = !started; syncNavigation();
  if (resetAll) session.reset('all');
  session.enter(id);
  const next = new THREE.Scene();
  try {
    const quiz = { segments: session.sceneData.stations.length, progress: session.localCount };
    const nextEnvironment = cfg.kind === 'hub' ? buildHub(next, cfg, quiz) : buildCourtyard(next, cfg, quiz);
    const nextSpatial = new SpatialUI(next, cfg, session, action);
    const nextActors = await loadActors(next, cfg, import.meta.env.BASE_URL, progress => {
      if (!started) $('start-label').textContent = 'Ετοιμασία εικόνων · ' + Math.round(progress * 100) + '%';
    });
    if (cfg.kind === 'hub') await getSkybox();
    waterQuiz?.dispose();
    const nextWaterQuiz = new WaterQuiz(next, cfg, session, camera, submitWater, nextEnvironment.approaches);
    if (level) { scene.remove(level); disposeLevel(level); }
    level = next; courtyard = nextEnvironment; spatial = nextSpatial; actors = nextActors; waterQuiz = nextWaterQuiz; world = cfg;
    scene.add(level); navigation.world = cfg; navigation.obstacles = courtyard.obstacles;
    camera.fov = cfg.kind === 'hub' ? 66 : 58; camera.updateProjectionMatrix();
    if (renderer.xr.isPresenting) {
      rig.position.set(cfg.spawn[0], 0, cfg.spawn[1]); rig.rotation.set(0, 0, 0);
      const view = new THREE.PerspectiveCamera(); view.position.set(cfg.spawn[0], 1.65, cfg.spawn[1]); view.lookAt(...(cfg.lookAt || [0, 1.65, -5]));
      desktopPose = { position: view.position.clone(), quaternion: view.quaternion.clone() };
    } else if (session.localCount > 0 && !session.sceneComplete) navigation.goTo(stationPose(cfg.stations[session.localCount-1]));
    else { navigation.spawn(); if (!session.sceneComplete) {
      const first = nextEnvironment.approaches[0].quizPosition; camera.lookAt(first[0],1.2,first[1]);
    } }
    lastStationNear = null;
    rebuildTeleportTargets(); applyBackground(); ready = true; uiScene = null; lastProximity = null;
    $('start-label').textContent = session.count ? 'Συνέχισε τη διαδρομή' : 'Μπες στη διαδρομή';
    $('start-button').disabled = false;
    $('stage').dataset.space = id; $('scene').dataset.space = id; $('scene').dataset.animations = String(nextActors.actors.size);
    $('scene').dataset.animationFrames = JSON.stringify(Object.fromEntries([...nextActors.actors].map(([key, a]) => [key, a.animation.frameCount])));
    $('failure-banner').hidden = true;
    changingScene = false; $('scene-loading').hidden = true; $('stage').setAttribute('aria-busy', 'false');
    renderUI(); syncNavigation(); resize();
    if (pendingFinal && started && !renderer.xr.isPresenting) { pendingFinal = false; showDialog('final-dialog'); }
    if (!vrButton) await prepareVR().catch(error => console.warn('WebXR:', error.message));
  } catch (error) {
    disposeLevel(next); changingScene = false; session.enter(previousId);
    $('scene-loading').hidden = true; $('stage').setAttribute('aria-busy', 'false');
    fail('Δεν φορτώθηκε η ενότητα. ' + (error?.message || 'Παρουσιάστηκε σφάλμα φόρτωσης.')); console.error(error); syncNavigation();
  }
}
function CoreTitle(id) { return lesson.scenes.find(s => s.id === id).title; }
void changeScene(session.sceneId, true);

renderer.setAnimationLoop(time => {
  const now = typeof time === 'number' ? time : performance.now();
  const rawDt = Math.max(0, (now - lastTime) / 1000);
  const dt = Math.min(0.06, rawDt); lastTime = now;
  navigation.update(dt);
  const xr = renderer.xr.isPresenting, viewCamera = xr ? renderer.xr.getCamera() : camera;
  viewCamera.getWorldPosition(cameraPosition);
  const reduced = reducedMotion();
  courtyard?.update(now / 1000, reduced, session.localCount, dt);
  const waterShot = updateFire();
  waterQuiz?.update(now,dt,session,cameraPosition,reduced,waterMode && started && !changingScene && (atActiveStation() || session.busy),waterShot);
  updateFillHUD();
  actors?.update(now, cameraPosition, session, reduced, dt);
  if (!changingScene) spatial?.update(now, cameraPosition, reduced);
  if (spatial) spatial.rack.visible = (xr || worldCards || navigation.controls.isLocked) && (!waterMode || session.sceneComplete || Boolean(session.reviewId));
  if (started && !changingScene) {
    const near = atActiveStation();
    if (near !== lastStationNear) { lastStationNear = near; renderUI(); }
    renderProximity();
  }
  if (navigation.controls.isLocked && !xr) {
    raycaster.setFromCamera(pointer.set(0, 0), camera);
    hovered = hitFromRay(raycaster);
    $('reticle').classList.toggle('hot', Boolean(hovered));
  }
  if (xr) {
    for (const item of controllers) {
      controllerRay(item.controller); const hit = hitFromRay(raycaster, true);
      item.line.scale.z = hit ? hit.distance : 8;
      item.cursor.visible = Boolean(hit);
      if (hit) item.cursor.position.copy(hit.point);
    }
    let axis = 0;
    for (const input of renderer.xr.getSession()?.inputSources || []) {
      if (input.gamepad && (input.handedness === 'right' || !axis)) {
        const axes = input.gamepad.axes; axis = axes.length >= 4 ? axes[2] : axes[0] || 0;
      }
    }
    if (Math.abs(axis) > 0.72 && !turnLatched) {
      const delta = -Math.sign(axis) * Math.PI / 4;
      rig.position.sub(cameraPosition).applyAxisAngle(THREE.Object3D.DEFAULT_UP, delta).add(cameraPosition);
      rig.rotation.y += delta; rig.updateMatrixWorld(true); turnLatched = true;
    } else if (Math.abs(axis) < 0.3) turnLatched = false;
    if (fade.visible) { fade.material.opacity = Math.max(0, 0.95 * (1 - (now - teleportFlash) / 180)); if (!fade.material.opacity) fade.visible = false; }
  }
  renderer.render(scene, camera);
  fpsFrames++; fpsTime += rawDt;
  if (fpsTime >= 1) {
    $('scene').dataset.fps = String(Math.round(fpsFrames / fpsTime));
    $('scene').dataset.drawCalls = String(renderer.info.render.calls);
    $('scene').dataset.position = camera.position.toArray().map(v => v.toFixed(2)).join(',');
    fpsFrames = 0; fpsTime = 0;
  }
});
window.addEventListener('pagehide', () => { stopFire(); clearTimeout(revealTimer); navigation.keys.clear(); });
