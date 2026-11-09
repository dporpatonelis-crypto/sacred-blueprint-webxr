import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import './style.css';
import '../../../shared/journey/compact-water-controls.css';
import worlds from './data/worlds.json' with { type: 'json' };
import { LessonSession, lesson } from './session.js';
import { buildCourtyard } from './world.js';
import { buildHub } from './hub-world.js';
import { Navigation } from './navigation.js';
import { SpatialUI } from './spatial-ui.js';
import { loadActors } from './actors.js';
import { WaterQuiz } from './water-quiz.js';
import { ManuscriptConnections } from './hymn-manuscript.js';
import { manuscriptForWorld, manuscriptEntry as hymnEntry } from './manuscript-content.js';

const $ = id => document.getElementById(id);
document.getElementById('app').innerHTML = [
  '<main id="stage" aria-label="Η διαδρομή μας">',
  '<canvas id="scene" tabindex="0" aria-label="Τρισδιάστατη αυλή. Σύρε για να κοιτάξεις, WASD ή βελάκια για να κινηθείς. Το μενού ανοίγει τις ερωτήσεις, τα κείμενα και τις επιλογές."></canvas>',
  '<div class="vignette"></div>',
  '<p id="hymn-announcement" class="sr-only" role="status" aria-live="polite" aria-atomic="true"></p>',
  '<button id="menu-toggle" class="menu-toggle" type="button" aria-expanded="false" aria-controls="lesson-panel bottom-bar" aria-label="Άνοιγμα μενού" title="Ερωτήσεις, πληροφορίες και επιλογές" hidden><span aria-hidden="true">☰</span><span>Μενού</span></button>',
  '<header class="masthead"><div class="brand"><span class="brand-mark" aria-hidden="true">✧</span><div><p class="eyebrow" id="scene-eyebrow">Τέσσερις νησίδες · 16 συνδέσεις</p><h1 id="journey-title">Η διαδρομή μας</h1></div></div>',
  '<div class="top-actions"><div class="progress-pill" aria-label="Πρόοδος"><div id="global-dots" class="progress-dots" aria-hidden="true"><i></i><i></i><i></i></div><output id="progress">0 / 16</output></div><button class="tool icon" id="help-button" aria-label="Οδηγίες">?</button><button class="tool" id="back-hub" hidden>↩ Χάρτης</button><button class="tool" id="final-button" hidden>Τελικό ερώτημα</button><span id="vr-slot"></span></div></header>',
  '<section id="welcome" aria-labelledby="welcome-title"><div class="welcome-inner"><div class="welcome-line"></div><p class="welcome-kicker">Από το κατ’ εικόνα στο καθ’ ομοίωση</p><h2 id="welcome-title">Η διαδρομή<br>μας.</h2><p>Κατ’ εικόνα · Τάλαντα · Άγιος Λουκάς · Καθ’ ομοίωση.<br>Στα Τάλαντα και στον Άγιο Λουκά σύνδεσε τα χωρία του χειρογράφου.<br>Στις άλλες αυλές γέμισε τη σωστή απάντηση με νερό.<br>Πέρασε τη γέφυρα · απάντησε στον σταθμό.<br>Κάθε επιτυχία ανοίγει το επόμενο πέρασμα.</p><button id="start-button" class="start-button" disabled><span id="start-label">Ετοιμασία αυλής</span><span aria-hidden="true">↗</span></button><p class="subtle"><span class="desktop-instruction">Ποντίκι για το βλέμμα · WASD για τα βήματα.</span><span class="touch-instruction">Σύρε για να κοιτάξεις · κράτησε τον μοχλό για να περπατήσεις.</span><br>Επίλεξε χωρίο στο χειρόγραφο· στις άλλες αυλές κράτησε ένα δοχείο για νερό.</p></div><div class="welcome-footer"><span>Κατ’ εικόνα → Καθ’ ομοίωση</span><span>Ενιαία διαδρομή</span></div></section>',
  '<aside id="lesson-panel" aria-labelledby="lesson-prompt" hidden><div class="panel-top"><span id="panel-kicker" class="panel-kicker">Σύνδεση 1 / 3</span><div><span id="step-number" class="step-number">01</span></div></div><h2 id="lesson-prompt">Το δοσμένο ποσό</h2><div id="completed-actions" class="completed-actions" role="group" aria-label="Επόμενο βήμα" hidden><button id="completed-map" class="dialog-button primary">Στον χάρτη</button><button id="completed-explore" class="dialog-button">Συνέχεια εξερεύνησης</button></div><button id="go-station" class="go-button"><span aria-hidden="true">↗</span> Στο σημείο</button><div id="choices" class="choices" role="group" aria-label="Κάρτες εννοιών"></div><button id="hymn-read" class="go-button" hidden>Πλήρης ύμνος</button><section id="hymn-reading" hidden aria-label="Πλήρης ανάγνωση ύμνου"><div id="hymn-reading-sections" class="hymn-reading-actions" role="group" aria-label="Κείμενο ανάγνωσης"></div><p id="hymn-reading-kind" class="panel-kicker"></p><p id="hymn-reading-text"></p><p id="hymn-reading-source" class="hymn-reading-source"></p><div class="hymn-reading-actions"><button id="hymn-prev" class="text-button" aria-label="Προηγούμενη σελίδα">←</button><output id="hymn-reading-page"></output><button id="hymn-next" class="text-button" aria-label="Επόμενη σελίδα">→</button><button id="hymn-reading-back" class="text-button">Στις συνδέσεις</button></div></section><p id="hymn-interpretation" hidden role="status" aria-live="polite" aria-atomic="true"></p><button id="connect-target" class="connect-target"><span class="target-icon" id="target-number">01</span><span id="connect-label">Στον φωτεινό στόχο</span></button><p id="hint-text" hidden></p><div class="panel-foot"><button id="hint-button" class="text-button">Υπόδειξη</button><button id="resume-button" class="text-button" hidden>Συνέχεια</button><button id="reset-button" class="text-button">Νέα αρχή</button></div><p id="feedback" role="status" aria-live="polite">Επίλεξε · Σύνδεσε</p></aside>',
  '<div id="reticle" aria-hidden="true"></div>',
  '<section id="bridge-hud" hidden aria-label="Πρόοδος γέφυρας"><span class="water-kicker">Χτίσε το πέρασμα</span><div class="bridge-headline"><strong>Περάσματα</strong><output id="bridge-count">0 / 4</output></div><div id="bridge-parts"></div><p id="water-guide">Γέμισε το δοχείο της σωστής απάντησης.</p></section>',
  '<button id="fire-button" hidden aria-label="Κράτησε για βολή νερού προς το κέντρο"><span aria-hidden="true">◉</span><span>Νερό</span></button>',
  '<div class="keyboard-guide" id="keyboard-guide" hidden><span class="normal-guide"><span class="desktop-controls"><kbd>W A S D</kbd> κίνηση <span class="dot">·</span> σύρε για ματιά <span class="desktop-hint">· <kbd>Tab</kbd> κάρτες</span></span><span class="touch-controls">Κράτησε και σύρε τον μοχλό για κίνηση <span class="dot">·</span> σύρε για ματιά</span></span><span class="locked-guide">Στόχευσε και πάτησε <span class="dot">·</span> <kbd>Esc</kbd> για κάρτες</span></div>',
  '<div id="touch-walk" class="touch-walk" hidden role="group" aria-label="Χειριστήριο κίνησης αφής"><div class="touch-walk-pad"><span class="touch-walk-ring" aria-hidden="true"></span><span class="touch-walk-stick" id="touch-walk-stick" aria-hidden="true"></span></div><span class="touch-walk-label">Κίνηση</span></div>',
  '<footer class="bottom-bar" id="bottom-bar" hidden><nav class="scene-nav" aria-label="Σημεία παραβολής"><span class="scene-nav-label">Η διαδρομή</span></nav><div><div id="saving-note" class="saving-note"></div><div class="explore-controls"><button class="tool" id="skybox-toggle" aria-pressed="true">Ορίζοντας: εικόνα</button><button class="tool" id="gameplay-toggle" aria-pressed="true">Παιχνίδι νερού</button><button class="tool" id="motion-toggle" aria-pressed="false">Παύση κίνησης</button><button class="tool" id="look-button">Κάρτες στον χώρο</button></div></div></footer>',
  '<div class="failure-banner" id="failure-banner" role="alert" hidden><span id="failure-text"></span><button id="retry-button">Επαναφόρτωση</button></div>',
  '</main>',
  '<dialog id="reset-dialog" aria-labelledby="reset-title"><p class="dialog-kicker">Η διαδρομή σου</p><h2 id="reset-title">Νέα αρχή;</h2><p id="reset-description">Οι συνδέσεις θα ξεκινήσουν από την αρχή.</p><div class="dialog-actions"><button class="dialog-button" id="reset-cancel">Ακύρωση</button><button class="dialog-button" id="reset-all" hidden>Όλη η διαδρομή</button><button class="dialog-button primary" id="reset-confirm">Επαναφορά</button></div></dialog>',
  '<dialog id="help-dialog" aria-labelledby="help-title"><p class="dialog-kicker">Ένας μικρός οδηγός</p><h2 id="help-title">Βήματα στην αυλή</h2><dl><dt>Παρατήρησε</dt><dd>Σύρε με το ποντίκι ή το δάχτυλο για να κοιτάξεις γύρω σου.</dd><dt>Περπάτησε</dt><dd>WASD ή βελάκια στον υπολογιστή· σε tablet/κινητό, κράτησε και σύρε τον μοχλό κάτω αριστερά. Το «Στο σημείο» σε μεταφέρει δίπλα στην ενεργή σκηνή.</dd><dt>Χειρόγραφα Ταλάντων και Αγίου Λουκά</dt><dd>Επίλεξε ένα χωρίο στο χειρόγραφο ή στον πίνακα και κατόπιν τον ενεργό σταθμό. Οι δύο λέξεις ταξιδεύουν στην εικόνα, η κίνηση παίζει μία φορά και εμφανίζεται η ερμηνεία. Η σωστή σύνδεση ανοίγει την επόμενη γέφυρα. Η πλήρης ανάγνωση ανοίγει τον ύμνο ή τη βιογραφία και το απολυτίκιο σε σελίδες. Πάτησε λυμένο χωρίο ή σταθμό για επανεξέταση.</dd><dt>Γέμισε</dt><dd>Κράτησε πατημένο ένα δοχείο ή την κάρτα της απάντησης για περίπου 1,5 δευτερόλεπτο. Το water blaster γεμίζει το δοχείο. Με Space ή το «Νερό» πυροβολείς προς το κέντρο της οθόνης.</dd><dt>Χτίσε</dt><dd>Σωστή απάντηση: ανοίγει η επόμενη γέφυρα. Λάθος απάντηση: το δοχείο αδειάζει· άφησε τη βολή και δοκίμασε ξανά. Με δύο λάθη εμφανίζεται υπόδειξη. Η πρώτη γέφυρα είναι έτοιμη. Τα δοχεία εμφανίζονται μόλις ανέβεις στην ανοιχτή γέφυρα, προς τον σταθμό. Απάντησε για να ανοίξει η επόμενη. Ο χάρτης έχει 4 απαντήσεις, κάθε ενότητα 3.</dd><dt>Κλασικές κάρτες</dt><dd>Το «Παιχνίδι νερού» εναλλάσσει τον μηχανισμό με την αρχική επιλογή κάρτας και στόχου.</dd><dt>Χωρικές κάρτες</dt><dd>Το «Κάρτες στον χώρο» μεταφέρει τις επιλογές μέσα στη σκηνή. Πάτησέ τες με το ποντίκι. Esc ή «Πίνακας καρτών» για επιστροφή.</dd><dt>Ξαναδές</dt><dd>Πάτησε μια λυμένη κάρτα ή σκηνή για επανεξέταση.</dd><dt>Σε VR</dt><dd>Κράτησε trigger στο δοχείο για νερό. Πάτησε για επιλογή ή για τα ανοιχτά σημεία τηλεμεταφοράς στο δάπεδο. Αριστερός μοχλός: μπροστά/πίσω και πλάγια, προς την κατεύθυνση που κοιτάς. Δεξιός μοχλός: στροφή ανά 45° γύρω από τη θέση σου.</dd></dl><div class="dialog-actions"><button class="dialog-button primary" id="help-close">Στην αυλή</button></div></dialog>',
  '<dialog id="completion-dialog" aria-labelledby="completion-title"><div class="completion-seal" aria-hidden="true">✧</div><p class="dialog-kicker" id="completion-kicker">Η ενότητα φωτίστηκε · 3 / 3</p><h2 id="completion-title">Η ενότητα<br>φωτίστηκε.</h2><p>Άνοιξε και η γέφυρα επιστροφής. Διάσχισε το ποτάμι για να παρατηρήσεις τις σκηνές ή επέστρεψε στον κεντρικό χάρτη.</p><div class="completion-words" id="completion-words"></div><div class="dialog-actions"><button id="completion-hub" class="dialog-button primary">Στον χάρτη</button><button id="completion-close" class="dialog-button primary">Συνέχεια εξερεύνησης</button><button id="completion-reset" class="dialog-button">Νέα αρχή</button></div></dialog>',
  '<dialog id="final-dialog" aria-labelledby="final-title"><p class="dialog-kicker">Η διαδρομή ολοκληρώθηκε · 16 / 16</p><h2 id="final-title">Σκέψου και σύνδεσε</h2><p id="final-question"></p><div class="dialog-actions"><button class="dialog-button primary" id="final-back">Στον χάρτη</button></div></dialog>',
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
// Direct hymn review uses a separate save slot; normal lesson progress is retained.
const previewWorld = { 'talanta-hymn': 'talanta', 'loukas-manuscript': 'loukas' }[new URLSearchParams(location.search).get('preview')];
const hymnPreview = Boolean(previewWorld);
const saveSuffix = previewWorld === 'talanta' ? '.hymn-preview-v1' : previewWorld === 'loukas' ? '.loukas-preview-v1' : '.water-v1';
const waterStorage = storage && { getItem: key => storage.getItem(key + saveSuffix), setItem: (key, value) => storage.setItem(key + saveSuffix, value) };
const session = new LessonSession(waterStorage);
if (hymnPreview && !session.unlocked) { session.state.counts.main = 4; session.enter(previewWorld); }
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
let world = worlds[session.sceneId], level = null, courtyard = null, spatial = null, actors = null, waterQuiz = null, hymn = null, hymnReveal = null;
let waterMode = true;
const hymnContent = () => manuscriptForWorld(session.sceneId);
const isHymn = () => Boolean(hymnContent());
const waterEnabled = () => waterMode && !isHymn();
let firing = { active: false };
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2(), cameraPosition = new THREE.Vector3(), rotationMatrix = new THREE.Matrix4();
let started = false, ready = false, changingScene = false, vrButton = null, revealTimer = 0, pendingFinal = false;
let lastTime = performance.now(), lastProximity = null, hovered = null, motionOverride = null;
let fpsTime = 0, fpsFrames = 0, desktopPose = null, teleportFlash = -1000;
let resetScope = 'all', uiScene = null, skybox = null, skyboxEnabled = true;
let worldCards = false, lastStationNear = null, interfaceOpen = false;
const preference = matchMedia('(prefers-reduced-motion: reduce)');
const reducedMotion = () => motionOverride ?? preference.matches;
const navigation = new Navigation(camera, renderer, world, [], {
  pick: point => pickDesktop(point),
  canWalk: (x,z) => courtyard?.canWalk?.(x,z) ?? true,
  lock: locked => document.body.classList.toggle('pointer-locked', locked),
  escape: () => {
    if (session.selected) { session.selected = null; session.changed(false); }
    setWorldCards(false);
    setInterfaceMenu(true);
  },
});
const choiceButtons = new Map();
function fail(message) { $('failure-text').textContent = message; $('failure-banner').hidden = false; }
function visibleInHierarchy(object) {
  for (let node = object; node; node = node.parent) if (!node.visible) return false;
  return !object.userData.disabled;
}
function hitFromRay(ray, includeTeleport = false) {
  const objects = [...(hymn?.pickables || []), ...(waterQuiz?.pickables || []), ...(spatial?.pickables || []), ...(actors?.pickables || []), ...(includeTeleport ? teleportTargets : [])].filter(visibleInHierarchy);
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
  const pose = { ...station, landing: approach.viewpoint, lookHeight: 1.35,
    position: waterEnabled() && session.current?.id === station.id ? approach.quizPosition : station.position };
  return hymn ? hymn.viewPose(station, pose) : pose;
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
  return atActiveStation() && started && ready && waterEnabled() && !changingScene && !session.busy && !session.sceneComplete && !session.reviewId && !document.querySelector('dialog[open]');
}
function beginFire(input) {
  if (!canFire() || firing.active) return;
  firing = { active: true, ...input };
  $('fire-button').classList.add('firing');
  $('fire-button').setAttribute('aria-pressed','true');
}
function stopFire() {
  firing = { active: false };
  waterQuiz?.fill.release();
  $('fire-button').classList.remove('firing');
  $('fire-button').setAttribute('aria-pressed','false');
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
  const shot = { ...firing, xr: renderer.xr.isPresenting, worldPrompt: renderer.xr.isPresenting || !interfaceOpen, direction: new THREE.Vector3() };
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
  stopFire();
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
  if(event.button!==0||!canFire())return;
  event.preventDefault(); beginFire({ mode:'center', pointerId:event.pointerId }); $('fire-button').setPointerCapture(event.pointerId);
});
$('fire-button').addEventListener('keydown',event=>{if(!['Space','Enter'].includes(event.code)||event.repeat||!canFire())return;event.preventDefault();event.stopPropagation();beginFire({mode:'center',keyboard:true});});
$('fire-button').addEventListener('keyup',event=>{if(['Space','Enter'].includes(event.code)&&firing.keyboard){event.preventDefault();stopFire();}});
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
  if (event.type === 'hymn-block') return;
  if (event.type === 'hymn-page') { if (hymn) { hymn.setPage(event.page); renderUI(); } return; }
  if (hymn && spatial.resetConfirm && !['confirm-reset','cancel-reset','hub'].includes(event.type)) return;
  if (hymn && session.busy && ['word','target'].includes(event.type)) return { type: 'busy' };
  let result;
  if (event.type === 'target' && !atActiveStation() && !session.solved(event.id)) {
    session.message = 'Ανέβα στη γέφυρα προς τον ενεργό σταθμό'; session.changed(false); return;
  }
  if (event.type === 'target' && waterEnabled() && !event.water && !session.solved(event.id) && !session.sceneComplete) {
    session.message = 'Γέμισε το δοχείο της απάντησης'; session.changed(false); return;
  }
  if (event.type === 'word') result = session.choose(event.id);
  if (event.type === 'target') result = session.target(event.id);
  if (hymn && result?.type === 'empty') { session.message = 'Πρώτα επίλεξε ένα χωρίο'; session.changed(false); }
  if (hymn && ((event.type === 'word' && session.reviewId === event.id) || result?.type === 'review')) { startHymnReveal(event.id, null, event.bookId); return result; }
  if (result?.type === 'enter') { void changeScene(result.sceneId); return; }
  if (result?.type === 'matched') {
    if (hymn) { startHymnReveal(result.stationId, result.token); return result; }
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
    cancelHymnReveal(false);
    hymn?.setPage(-1);
    clearTimeout(revealTimer); pendingFinal = false; spatial.flashes.clear(); spatial.resetConfirm = false;
    if (resetScope === 'all' && !session.inHub) { void changeScene('main', true, true); return; }
    stopFire(); waterQuiz?.fill.reset(); session.reset(resetScope);
    for (const actor of actors?.actors.values() || []) actor.value = 0.16;
    if (!renderer.xr.isPresenting) navigation.spawn(); else teleportTo(world.spawn);
  }
  if (event.type === 'teleport') teleportTo(event.point);
  return result;
}
function startHymnReveal(id, token = null, bookId = null) {
  if (!hymn || hymnReveal) return;
  hymnReveal = { id, token };
  setInterfaceMenu(false);
  if (token === null) { session.busy = true; session.changed(false); }
  camera.getWorldPosition(cameraPosition); hymn.start(id, reducedMotion(), cameraPosition, bookId);
  session.message = 'Οι λέξεις ταξιδεύουν στην εικόνα…'; session.kind = 'success'; session.changed(false);
}
function finishHymnReveal() {
  const pending = hymnReveal; hymnReveal = null; if (!pending) return;
  const matched = pending.token !== null && session.finishReveal(pending.token);
  if (pending.token === null) { session.busy = false; session.message = 'Η σύνδεση διατηρείται · συνέχισε την εξερεύνηση'; session.changed(false); }
  if (matched && session.sceneComplete) offerSceneCompletion();
  rebuildTeleportTargets();
}
function offerSceneCompletion() {
  if (!isHymn() || !session.sceneComplete || renderer.xr.isPresenting || document.hidden) return;
  setInterfaceMenu(true);
  if (!$('completion-dialog').open) showDialog('completion-dialog');
}
function cancelHymnReveal(settle = true) { hymn?.cancel(false); if (settle) finishHymnReveal(); else hymnReveal = null; }
function renderHymnReading() {
  const content = hymnContent(), reading = Boolean(hymn?.reading);
  $('hymn-read').hidden = !content || reading; $('hymn-reading').hidden = !reading;
  if (content) { $('hymn-read').textContent = content.readLabel; $('hymn-reading').setAttribute('aria-label', content.readingTitle); }
  if (!reading) return;
  const final = hymn.page === hymn.finalPage, page = content.readingPages[hymn.page];
  const sections = new Map(); content.readingPages.forEach((item, index) => { if (!sections.has(item.title)) sections.set(item.title, index); });
  $('hymn-reading-sections').replaceChildren(); $('hymn-reading-sections').hidden = sections.size < 2;
  for (const [title, index] of sections) {
    const button = document.createElement('button'); button.className = 'text-button'; button.textContent = title.split(' · ')[0]; button.dataset.readingSection = String(index);
    button.setAttribute('aria-pressed', String(!final && page.title === title)); button.addEventListener('click', () => action({ type: 'hymn-page', page: index })); $('hymn-reading-sections').append(button);
  }
  $('hymn-reading-kind').textContent = final ? 'Σκέψου και σύνδεσε' : page.title;
  $('hymn-reading-text').textContent = final ? lesson.finalQuestion : page.text;
  $('hymn-reading-source').replaceChildren();
  if (!final && page.attribution) {
    const credit = document.createElement(page.sourceUrl ? 'a' : 'span'); credit.textContent = page.attribution;
    if (page.sourceUrl) { credit.href = page.sourceUrl; credit.target = '_blank'; credit.rel = 'noopener noreferrer'; }
    $('hymn-reading-source').append(credit);
  }
  $('hymn-reading-page').textContent = final ? 'Τελικό ερώτημα' : (hymn.page + 1) + ' / ' + hymn.finalPage;
  $('hymn-prev').disabled = hymn.page === 0 || final; $('hymn-next').disabled = hymn.page >= hymn.finalPage - 1;
}
let interpretationCaption = '';
function renderHymnInterpretation() {
  const text = hymn?.interpretationText || '';
  if (text !== interpretationCaption) { interpretationCaption = text; $('hymn-interpretation').textContent = text; $('hymn-interpretation').hidden = !text; $('hymn-announcement').textContent = text; }
  if (hymn) {
    $('scene').dataset.hymnPhase = hymn.reading ? 'reading' : hymn.active ? hymn.active.elapsed < (hymn.active.reduced ? 0 : 800) ? 'words' : 'reveal' : 'explore';
    $('scene').dataset.hymnElapsed = String(Math.round(hymn.active?.elapsed || 0));
  } else { delete $('scene').dataset.hymnPhase; delete $('scene').dataset.hymnElapsed; }
}
function rebuildChoices() {
  if (uiScene === session.sceneId) return;
  uiScene = session.sceneId; choiceButtons.clear(); $('choices').replaceChildren();
  for (const station of session.choices) {
    const b = document.createElement('button');
    b.className = 'choice'; b.dataset.choice = station.id;
    b.addEventListener('click', () => { if (!waterEnabled() || session.sceneComplete || session.reviewId) action({ type: 'word', id: station.id }); });
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
      if (session.busy) return;
      if (hymn && session.solved(item.id)) { goTo(cfg); action({type:'target',id:item.id}); return; }
      if (session.solved(item.id)) { if (hymn) action({type:'target',id:item.id}); else session.review(item.id); } else session.resume();
      goTo(cfg);
    });
    nav.append(b);
  }
}
function renderUI() {
  if (changingScene || !spatial) return;
  rebuildChoices();
  const reviewing = Boolean(session.reviewId), completed = session.sceneComplete;
  const hymnMode = isHymn();
  document.body.classList.toggle('hymn-mode', hymnMode);
  $('choices').setAttribute('aria-label', hymnMode ? hymnContent().choicesLabel : 'Κάρτες εννοιών');
  const traveling = !completed && !reviewing && !session.busy && !atActiveStation();
  const portal = session.inHub && session.unlocked, station = session.visibleStation;
  const number = session.sceneData.stations.findIndex(s => s.id === station.id) + 1;
  $('progress').textContent = session.count + ' / ' + session.size;
  $('global-dots').replaceChildren(...Array.from({ length: session.size }, (_, i) => {
    const dot = document.createElement('i'); dot.classList.toggle('done', i < session.count); return dot;
  }));
  $('journey-title').textContent = session.inHub ? 'Η διαδρομή μας' : session.sceneData.title;
  $('lesson-panel').classList.toggle('hub-panel', session.inHub);
  $('scene-eyebrow').textContent = session.inHub ? 'Τέσσερις νησίδες · 16 συνδέσεις' : 'Η διαδρομή μας · Ενότητα ' + (lesson.groups.findIndex(g => g.sceneId === session.sceneId) + 1) + ' / 4';
  $('back-hub').hidden = session.inHub;
  $('final-button').hidden = !session.complete;
  $('panel-kicker').textContent = portal ? 'Ο κεντρικός χάρτης φωτίστηκε' : reviewing ? 'Επανεξέταση' : completed ? 'Η ενότητα ολοκληρώθηκε · 3 / 3' : 'Σύνδεση ' + number + ' / ' + session.sceneData.stations.length;
  $('step-number').textContent = String(number).padStart(2, '0');
  $('lesson-prompt').textContent = traveling ? 'Προχώρησε στον σταθμό ' + number : portal ? 'Διάλεξε νησίδα' : reviewing || completed ? station.word : station.prompt;
  $('lesson-panel').classList.toggle('route-panel', traveling && !hymnMode);
  $('choices').hidden = (traveling && !hymnMode) || Boolean(hymn?.reading);
  $('feedback').textContent = traveling ? hymnMode ? 'Επίλεξε χωρίο και προχώρησε στον ενεργό σταθμό.' : 'Ανέβα στην ανοιχτή γέφυρα για να εμφανιστούν τα δοχεία.' : session.message; $('feedback').dataset.kind = session.kind;
  $('hint-text').hidden = reviewing || completed || !session.hasHint(station.id);
  $('hint-text').textContent = station.hint;
  $('hint-button').hidden = reviewing || completed || traveling; $('hint-button').disabled = session.busy;
  $('resume-button').hidden = !reviewing || completed;
  $('reset-button').textContent = session.inHub ? 'Νέα αρχή' : 'Επαναφορά';
  $('saving-note').textContent = session.pilotCarry ? 'Η πρόοδος των Ταλάντων θα διατηρηθεί' : session.canStore ? 'Η πρόοδός σου αποθηκεύεται εδώ' : 'Μνήμη συνεδρίας';
  $('target-number').textContent = String(number).padStart(2, '0');
  $('connect-label').textContent = reviewing || completed ? 'Δες τη σκηνή' : session.selected ? 'Σύνδεσε στον στόχο' : 'Στον φωτεινό στόχο';
  $('connect-target').classList.toggle('ready', Boolean(session.selected)); $('connect-target').hidden = traveling || portal || Boolean(hymn?.reading) || (waterEnabled() && !reviewing && !completed);
  const displayChoices = hymnMode ? hymnContent().entries.map(entry => session.sceneData.stations.find(s => s.id === entry.stationId)) : session.choices;
  displayChoices.forEach(s => {
    const b = choiceButtons.get(s.id); $('choices').append(b);
    b.textContent = hymnMode ? hymnEntry(s.id).text : s.word; b.classList.toggle('portal-choice', portal);
    if (hymnMode && (hymnEntry(s.id).sourceLabel || hymnEntry(s.id).note)) { const note = document.createElement('span'); note.className = 'hymn-note'; note.textContent = hymnEntry(s.id).sourceLabel || 'Προσωπική εφαρμογή'; b.append(note); }
    if (portal) {
      const progress = document.createElement('span'); progress.className = 'choice-progress';
      progress.textContent = session.groupProgress(s.id) + ' / 3 ↗'; b.append(progress);
    }
    b.classList.toggle('selected', session.selected === s.id || session.reviewId === s.id);
    b.classList.toggle('solved', session.solved(s.id) && !portal);
    b.setAttribute('aria-pressed', String(session.selected === s.id || session.reviewId === s.id));
    b.disabled = session.busy || (waterEnabled() && !portal && !reviewing && !completed && session.solved(s.id));
    b.classList.toggle('pour-choice', waterEnabled() && !portal && !reviewing && !completed);
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
  $('completion-reset').hidden = hymnMode;
  $('completed-actions').hidden = !hymnMode || !completed || session.busy;
  $('completion-words').replaceChildren(...session.sceneData.stations.map(s => {
    const span = document.createElement('span'); span.textContent = '✓ ' + s.word; return span;
  }));
  $('final-question').textContent = lesson.finalQuestion;
  waterQuiz?.sync(session);
  $('bridge-hud').hidden = !started;
  $('bridge-count').textContent = session.localCount + ' / ' + session.sceneData.stations.length;
  $('bridge-parts').replaceChildren(...session.sceneData.stations.map((_,i) => {
    const piece = document.createElement('i'); piece.className = i < session.localCount ? 'raised' : ''; return piece;
  }));
  $('water-guide').textContent = completed ? 'Όλες οι γέφυρες άνοιξαν · εξερεύνησε ελεύθερα' : traveling ? 'Ανέβα στη γέφυρα · σταθμός ' + number : hymnMode ? 'Επίλεξε χωρίο · σύνδεσε με την εικόνα' : waterMode ? 'Απάντησε εδώ · γέμισε το σωστό δοχείο' : 'Απάντησε εδώ · σύνδεσε τη σωστή κάρτα';
  $('gameplay-toggle').textContent = waterMode ? 'Παιχνίδι νερού' : 'Κλασικές κάρτες';
  $('gameplay-toggle').setAttribute('aria-pressed', String(waterMode));
  $('gameplay-toggle').hidden = hymnMode;
  $('fire-button').hidden = !started || !waterEnabled() || completed || reviewing || traveling;
  $('look-button').hidden = hymnMode || (waterMode && !completed);
  $('go-station').textContent = traveling ? '↗ Στον σταθμό ' + number : '↗ Μπροστά στον σταθμό';
  document.body.classList.toggle('water-mode',waterEnabled() && !completed && !reviewing && started);
  renderHymnReading(); hymn?.sync();
  spatial.refresh(); renderProximity(true);
}
function renderProximity(force = false) {
  if (changingScene || !spatial) return;
  const station = activeConfig(), p = renderer.xr.isPresenting ? cameraPosition : camera.position;
  const near = hymn ? atActiveStation() : Math.hypot(p.x - station.position[0], p.z - station.position[1]) < 6;
  const key = String(near) + String(session.busy);
  if (key !== lastProximity || force) {
    $('connect-target').disabled = session.busy;
    $('connect-target').title = near ? 'Σύνδεσε την κάρτα με τον στόχο' : 'Πλησίασε τη σκηνή ή πάτησε «Στο σημείο»';
    lastProximity = key;
  }
}
function syncNavigation() {
  if (document.querySelector('dialog[open]') || changingScene) stopFire();
  navigation.enabled = started && !changingScene && !document.querySelector('dialog[open]');
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
  $('reset-description').textContent = scope === 'all' ? 'Θα ξεκινήσουν από την αρχή και οι 16 συνδέσεις.' : 'Θα ξεκινήσουν από την αρχή οι τρεις συνδέσεις αυτής της ενότητας.';
  $('reset-all').hidden = scope === 'all';
  if (!$('reset-dialog').open) showDialog('reset-dialog');
}
function setInterfaceMenu(open) {
  interfaceOpen = Boolean(open);
  if (interfaceOpen && worldCards) {
    worldCards = false; document.body.classList.remove('spatial-cards');
    $('look-button').textContent = 'Κάρτες στον χώρο'; $('look-button').setAttribute('aria-pressed','false');
  }
  document.body.classList.toggle('interface-collapsed', started && !interfaceOpen && !renderer.xr.isPresenting);
  if (interfaceOpen && isHymn() && session.sceneComplete) $('lesson-panel').scrollTop = 0;
  const button = $('menu-toggle'); button.hidden = !started || renderer.xr.isPresenting;
  button.setAttribute('aria-expanded',String(interfaceOpen));
  button.setAttribute('aria-label',interfaceOpen?'Κλείσιμο μενού':'Άνοιγμα μενού');
  button.title = interfaceOpen?'Κλείσιμο μενού':'Ερωτήσεις, κείμενα και επιλογές';
  button.innerHTML = interfaceOpen?'<span aria-hidden="true">×</span><span>Κλείσιμο</span>':'<span aria-hidden="true">☰</span><span>Μενού</span>';
}
function start() {
  if (!ready) return;
  started = true; $('welcome').hidden = true; $('lesson-panel').hidden = false;
  $('bottom-bar').hidden = false; $('keyboard-guide').hidden = false; $('touch-walk').hidden = false;
  setInterfaceMenu(false);
  syncNavigation(); renderUI(); offerSceneCompletion();
}
$('start-button').addEventListener('click', start);
$('menu-toggle').addEventListener('click', () => setInterfaceMenu(!interfaceOpen));
$('hymn-read').addEventListener('click', () => action({type:'hymn-page',page:0}));
$('hymn-reading-back').addEventListener('click', () => action({type:'hymn-page',page:-1}));
$('hymn-prev').addEventListener('click', () => action({type:'hymn-page',page:hymn.page-1}));
$('hymn-next').addEventListener('click', () => action({type:'hymn-page',page:hymn.page+1}));
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
function continueExploration() {
  if ($('completion-dialog').open) closeDialog('completion-dialog');
  if (isHymn()) { if (hymn.reading) { hymn.setPage(-1); renderUI(); } setInterfaceMenu(false); $('scene').focus(); }
}
$('completion-close').addEventListener('click', continueExploration);
$('completed-explore').addEventListener('click', continueExploration);
$('completed-map').addEventListener('click', () => void changeScene('main'));
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
  if (worldCards) setInterfaceMenu(false);
  $('look-button').textContent = value ? 'Πίνακας καρτών' : 'Κάρτες στον χώρο';
  $('look-button').setAttribute('aria-pressed', String(value));
}
$('retry-button').addEventListener('click', () => location.reload());
function renderMotion() {
  $('motion-toggle').textContent = reducedMotion() ? 'Ενεργοποίηση κίνησης' : 'Παύση κίνησης';
  $('motion-toggle').setAttribute('aria-pressed', String(reducedMotion()));
}
$('motion-toggle').addEventListener('click', () => { motionOverride = !reducedMotion(); renderMotion(); });
preference.addEventListener('change', renderMotion);
$('gameplay-toggle').addEventListener('click', () => { if (isHymn()) return; stopFire(); waterMode = !waterMode; setWorldCards(false); renderUI(); });
$('skybox-toggle').addEventListener('click', () => {
  skyboxEnabled = !skyboxEnabled; applyBackground(); renderUI();
});
session.onChange = renderUI; renderMotion(); setWorldCards(false);

// Fixed landing points complement thumbstick walking in VR.
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
  navigation.landXR(point);
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
    if (waterEnabled() && !session.sceneComplete && !session.reviewId && (!hit || hit.object.userData.action?.type === 'vessel')) { beginFire({ mode: 'xr', controller, id: hit?.object.userData.action?.id }); return; }
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
  navigation.landXR([desktopPose.position.x, desktopPose.position.z]);
  document.body.classList.add('xr-active');
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  teleportTargets.forEach(m => { m.visible = true; });
  start(); syncNavigation();
});
renderer.xr.addEventListener('sessionend', () => {
  stopFire();
  cancelHymnReveal(true);
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  if (desktopPose) { camera.position.copy(desktopPose.position); camera.quaternion.copy(desktopPose.quaternion); }
  document.body.classList.remove('xr-active');
  setInterfaceMenu(false);
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
  camera.fov = Math.min(isHymn() ? 116 : 105, THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(baseFov) / 2) * Math.max(1, 1.6 / camera.aspect))));
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe($('stage')); resize();
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
  changingScene = true; stopFire(); clearTimeout(revealTimer); cancelHymnReveal(false);
  $('stage').setAttribute('aria-busy', 'true');
  $('scene-loading').textContent = 'Μετάβαση · ' + CoreTitle(id);
  $('scene-loading').hidden = !started; syncNavigation();
  if (resetAll) session.reset('all');
  session.enter(id);
  const next = new THREE.Scene();
  try {
    const quiz = { segments: session.sceneData.stations.length, progress: session.localCount };
    const nextEnvironment = cfg.kind === 'hub' ? buildHub(next, cfg, quiz) : buildCourtyard(next, id, quiz);
    const nextSpatial = new SpatialUI(next, cfg, session, action);
    const nextActors = await loadActors(next, cfg, import.meta.env.BASE_URL, progress => {
      if (!started) $('start-label').textContent = 'Ετοιμασία εικόνων · ' + Math.round(progress * 100) + '%';
    });
    const nextHymn = manuscriptForWorld(id) ? new ManuscriptConnections(next, cfg, session, nextActors, nextEnvironment.approaches, finishHymnReveal) : null;
    if (nextHymn) nextHymn.finalQuestion = lesson.finalQuestion;
    if (cfg.kind === 'hub') await getSkybox();
    waterQuiz?.dispose();
    hymn?.dispose();
    const nextWaterQuiz = new WaterQuiz(next, cfg, session, camera, submitWater, nextEnvironment.approaches);
    if (level) { scene.remove(level); disposeLevel(level); }
    level = next; courtyard = nextEnvironment; spatial = nextSpatial; actors = nextActors; waterQuiz = nextWaterQuiz; world = cfg; hymn = nextHymn;
    scene.add(level); navigation.world = cfg; navigation.obstacles = courtyard.obstacles;
    camera.fov = cfg.kind === 'hub' ? 66 : 58; camera.updateProjectionMatrix();
    if (renderer.xr.isPresenting) {
      rig.position.set(cfg.spawn[0], 0, cfg.spawn[1]); rig.rotation.set(0, 0, 0);
      navigation.landXR(cfg.spawn);
      const view = new THREE.PerspectiveCamera(); view.position.set(cfg.spawn[0], 1.65, cfg.spawn[1]); view.lookAt(...(cfg.lookAt || [0, 1.65, -5]));
      desktopPose = { position: view.position.clone(), quaternion: view.quaternion.clone() };
    } else if (session.localCount > 0 && !session.sceneComplete) navigation.goTo(stationPose(cfg.stations[session.localCount-1]));
    else { navigation.spawn(); if (!session.sceneComplete) {
      const first = hymn ? [0,5.75] : nextEnvironment.approaches[0].quizPosition; camera.lookAt(first[0],hymn?1.55:1.2,first[1]);
    } }
    lastStationNear = null;
    rebuildTeleportTargets(); applyBackground(); ready = true; uiScene = null; lastProximity = null;
    $('start-label').textContent = hymnPreview ? 'Στο χειρόγραφο' : session.count ? 'Συνέχισε τη διαδρομή' : 'Μπες στη διαδρομή';
    $('start-button').disabled = false;
    $('stage').dataset.space = id; $('scene').dataset.space = id; $('scene').dataset.animations = String(nextActors.actors.size);
    $('scene').dataset.animationFrames = JSON.stringify(Object.fromEntries([...nextActors.actors].map(([key, a]) => [key, a.animation.frameCount])));
    $('failure-banner').hidden = true;
    changingScene = false; $('scene-loading').hidden = true; $('stage').setAttribute('aria-busy', 'false');
    renderUI(); syncNavigation(); resize();
    if (started && nextHymn && session.sceneComplete) offerSceneCompletion();
    if (pendingFinal && started && !renderer.xr.isPresenting) { pendingFinal = false; showDialog('final-dialog'); }
    if (!vrButton) await prepareVR().catch(error => console.warn('WebXR:', error.message));
  } catch (error) {
    disposeLevel(next); changingScene = false; session.enter(previousId);
    $('scene-loading').hidden = true; $('stage').setAttribute('aria-busy', 'false');
    fail('Δεν φορτώθηκε η ενότητα. ' + error.message); console.error(error); syncNavigation();
  }
}
function CoreTitle(id) { return lesson.scenes.find(s => s.id === id).title; }
void changeScene(session.sceneId, true);

renderer.setAnimationLoop(time => {
  const now = typeof time === 'number' ? time : performance.now();
  const rawDt = Math.max(0, (now - lastTime) / 1000);
  const dt = Math.min(0.06, rawDt); lastTime = now;
  navigation.update(dt);
  const xr = renderer.xr.isPresenting;
  camera.getWorldPosition(cameraPosition);
  const reduced = reducedMotion();
  courtyard?.update(now / 1000, reduced, session.localCount, dt);
  const waterShot = updateFire();
  waterQuiz?.update(now,dt,session,cameraPosition,reduced,waterEnabled() && started && !changingScene && (atActiveStation() || session.busy),waterShot);
  updateFillHUD();
  const hymnPaused = !started || changingScene || document.hidden || Boolean(document.querySelector('dialog[open]')) || (xr && ['hidden','visible-blurred'].includes(renderer.xr.getSession()?.visibilityState));
  hymn?.update(dt, cameraPosition, reduced, hymnPaused, spatial?.resetConfirm);
  renderHymnInterpretation();
  actors?.update(now, cameraPosition, session, reduced, dt);
  if (!changingScene) spatial?.update(now, cameraPosition, reduced);
  if (hymn && spatial) for (const [id, label] of spatial.labels) label.group.visible = !(hymn.active?.id === id && hymn.interpretation.visible);
  if (spatial) spatial.rack.visible = (xr || worldCards || navigation.controls.isLocked) && (!waterEnabled() || session.sceneComplete || Boolean(session.reviewId));
  if (started && !changingScene) {
    const near = atActiveStation();
    if (near !== lastStationNear) { lastStationNear = near; renderUI(); }
    renderProximity();
  }
  if (!xr&&(navigation.controls.isLocked||canFire())) {
    raycaster.setFromCamera(pointer.set(0, 0), camera);
    hovered = waterEnabled()?raycaster.intersectObjects(waterQuiz.pickables.filter(visibleInHierarchy),false).find(hit=>hit.distance<=10):hitFromRay(raycaster);
    $('reticle').classList.toggle('hot', Boolean(hovered));
  }else $('reticle').classList.remove('hot');
  if (xr) {
    for (const item of controllers) {
      controllerRay(item.controller); const hit = hitFromRay(raycaster, true);
      item.line.scale.z = hit ? hit.distance : 8;
      item.cursor.visible = Boolean(hit);
      if (hit) item.cursor.position.copy(hit.point);
    }
    if (fade.visible) { fade.material.opacity = Math.max(0, 0.95 * (1 - (now - teleportFlash) / 180)); if (!fade.material.opacity) fade.visible = false; }
  }
  renderer.render(scene, camera);
  fpsFrames++; fpsTime += rawDt;
  if (fpsTime >= 1) {
    $('scene').dataset.fps = String(Math.round(fpsFrames / fpsTime));
    $('scene').dataset.drawCalls = String(renderer.info.render.calls);
    if (actors) $('scene').dataset.playbackFrames = JSON.stringify(Object.fromEntries([...actors.actors].map(([id, actor]) => [id, actor.frame])));
    $('scene').dataset.position = camera.position.toArray().map(v => v.toFixed(2)).join(',');
    fpsFrames = 0; fpsTime = 0;
  }
});
window.addEventListener('pagehide', () => { stopFire(); clearTimeout(revealTimer); cancelHymnReveal(true); navigation.keys.clear(); });
