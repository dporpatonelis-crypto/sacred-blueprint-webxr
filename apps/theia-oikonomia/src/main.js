import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import lesson from './data/lesson.json';
import './style.css';

const $ = id => document.getElementById(id);
const canvas = $('scene');
const STORAGE_KEY = 'theia-oikonomia-webxr.v1';
const MAP_URL = import.meta.env.BASE_URL + 'media/oikonomia-map.webp';
const GROUPS = lesson.groups;
const GROUP_BY_ID = new Map(GROUPS.map(group => [group.id, group]));
const COLORS = { gold: 0xe3c16f, bright: 0xffe09b, green: 0xadc995, analogy: 0xd6a16f, old: 0xe0bf76, new: 0xb5c58b, church: 0x93c1b5 };

const state = {
  started: false,
  mode: 'welcome',
  currentGroupId: null,
  selectedWord: null,
  mainSolved: new Set(),
  childSolved: Object.fromEntries(GROUPS.map(group => [group.id, new Set()])),
  errors: {},
  hints: new Set(),
  sourceOpen: false,
  feedback: '',
  feedbackKind: '',
};

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.xr.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x102027);
scene.fog = new THREE.Fog(0x102027, 30, 90);
const rig = new THREE.Group();
scene.add(rig);
const camera = new THREE.PerspectiveCamera(66, window.innerWidth / window.innerHeight, 0.08, 120);
camera.position.set(0, 1.62, 0);
camera.rotation.order = 'YXZ';
rig.add(camera);

const hemisphere = new THREE.HemisphereLight(0xe2eff0, 0x17231e, 2.0);
scene.add(hemisphere);
const sunlight = new THREE.DirectionalLight(0xffe2ac, 2.4);
sunlight.position.set(-7, 12, 6);
scene.add(sunlight);
const beaconLight = new THREE.PointLight(0xffd677, 8, 16, 2);
beaconLight.position.set(0, 2.3, 0.5);
scene.add(beaconLight);

const materialCache = new Map();
function material(color, options = {}) {
  const key = String(color) + JSON.stringify(options);
  if (!materialCache.has(key)) materialCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.86, flatShading: true, ...options }));
  return materialCache.get(key);
}
function mesh(geometry, mat, x, y, z, parent = scene) {
  const item = new THREE.Mesh(geometry, mat);
  item.position.set(x, y, z);
  item.castShadow = false;
  item.receiveShadow = false;
  parent.add(item);
  return item;
}

const mapPanels = new Map();
const mainMarkers = new Map();
const childMarkers = new Map();
const panelImageMeshes = [];
const markerMeshes = [];
const mapPickables = [];
const mainLinks = new Map();
const detailLinks = new Map();
const mainLinkRoot = new THREE.Group();
scene.add(mainLinkRoot);
let mapTexture = null;
let hudCanvas = null;
let hudContext = null;
let hudTexture = null;
let hudRoot = null;
let hudHitRoot = null;
let hudPickables = [];
let mapGroup = null;
let activePointer = null;
let movePointer = null;
let touchVector = { x: 0, y: 0 };
let lastFrame = 0;
let sourceParagraph = 0;
const keys = new Set();

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function textTexture(text, options = {}) {
  const width = options.canvasWidth || 768;
  const height = options.canvasHeight || 160;
  const canvas2d = document.createElement('canvas');
  canvas2d.width = width;
  canvas2d.height = height;
  const ctx = canvas2d.getContext('2d');
  ctx.clearRect(0, 0, width, height);
  if (options.background) {
    roundedRect(ctx, 4, 4, width - 8, height - 8, options.radius || 22);
    ctx.fillStyle = options.background;
    ctx.fill();
    ctx.strokeStyle = options.border || '#d6bb796c';
    ctx.lineWidth = options.borderWidth || 3;
    ctx.stroke();
  }
  const lines = String(text).split('\n');
  const fontSize = options.fontSize || 34;
  ctx.font = (options.weight || 600) + ' ' + fontSize + 'px system-ui, sans-serif';
  ctx.fillStyle = options.color || '#f4e8c9';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lineHeight = options.lineHeight || fontSize * 1.2;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => ctx.fillText(line, width / 2, startY + index * lineHeight, width - 42));
  const texture = new THREE.CanvasTexture(canvas2d);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function textPlane(text, width, height, options = {}) {
  const texture = textTexture(text, options);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
}

function createEnvironment() {
  mesh(new THREE.CylinderGeometry(14, 14, 0.55, 64), material(0x1b2e30), 0, -0.31, -1.5);
  const floorRing = mesh(new THREE.TorusGeometry(11.5, 0.055, 8, 100), material(0xc4a25e), 0, -0.015, -1.5);
  floorRing.rotation.x = Math.PI / 2;
  const innerRing = mesh(new THREE.TorusGeometry(5.3, 0.028, 8, 96), material(0x9e8a56), 0, -0.006, -1.5);
  innerRing.rotation.x = Math.PI / 2;
  const center = mesh(new THREE.CylinderGeometry(1.55, 1.9, 0.38, 16), material(0x324542), 0, 0.08, 0.4);
  center.position.y = 0.08;
  mesh(new THREE.CylinderGeometry(0.78, 1.04, 0.62, 12), material(0x9c8150), 0, 0.55, 0.4);
  const orb = mesh(new THREE.IcosahedronGeometry(0.42, 1), new THREE.MeshBasicMaterial({ color: 0xffd576, toneMapped: false }), 0, 1.12, 0.4);
  orb.userData.isBeacon = true;
  const halo = mesh(new THREE.TorusGeometry(0.84, 0.025, 8, 56), new THREE.MeshBasicMaterial({ color: 0xf1d18d, transparent: true, opacity: 0.78, toneMapped: false }), 0, 1.14, 0.4);
  halo.rotation.x = Math.PI / 2;

  [-5.25, 5.25].forEach(x => {
    const column = mesh(new THREE.CylinderGeometry(0.18, 0.26, 5.7, 10), material(0x806b48), x, 2.78, -8.12);
    column.position.y = 2.78;
    mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 12), material(0xc0a166), x, 5.65, -8.12);
    mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.22, 12), material(0xb59b68), x, -0.02, -8.12);
  });
  mesh(new THREE.BoxGeometry(10.95, 0.16, 0.25), material(0xb49a67), 0, 6.18, -8.12);

  const dustPositions = [];
  let seed = 7413;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 90; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 6 + random() * 28;
    dustPositions.push(Math.cos(angle) * radius, 0.6 + random() * 13, -6 - random() * 32);
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.Float32BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(dustGeometry, new THREE.PointsMaterial({ color: 0xd6c28e, size: 0.035, transparent: true, opacity: 0.48, sizeAttenuation: true }));
  scene.add(dust);
}

function imageBounds(group) {
  return group.imageBounds;
}

function pointInPanel(group, sourcePoint) {
  const bounds = imageBounds(group);
  const rx = (sourcePoint[0] - bounds[0]) / Math.max(1, bounds[2] - bounds[0]);
  const ry = (sourcePoint[1] - bounds[1]) / Math.max(1, bounds[3] - bounds[1]);
  return new THREE.Vector3((rx - 0.5) * PANEL_WIDTH, (0.5 - ry) * PANEL_HEIGHT, 0.16);
}

const PANEL_WIDTH = 4.24;
const PANEL_HEIGHT = PANEL_WIDTH * 941 / 1672;
const MAP_WIDTH = PANEL_WIDTH * 2 + 0.16;
const MAP_HEIGHT = PANEL_HEIGHT * 2 + 0.16;
const MAP_CENTER_Y = 3.78;
const MAP_Z = -8.08;

function createMarker(parent, group, id, index, sourcePoint, kind) {
  const marker = new THREE.Group();
  const local = pointInPanel(group, sourcePoint);
  marker.position.copy(local);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 28), new THREE.MeshBasicMaterial({ color: COLORS.bright, transparent: true, opacity: 0.92, toneMapped: false }));
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: COLORS.bright, toneMapped: false }));
  ring.position.z = 0.04;
  core.position.z = 0.07;
  marker.add(ring, core);
  const number = textPlane(String(index + 1).padStart(2, '0'), 0.42, 0.23, {
    canvasWidth: 512,
    canvasHeight: 256,
    fontSize: 74,
    color: '#fff1c8',
    background: '#102027dd',
    border: '#e5c77e',
    borderWidth: 5,
    radius: 64,
  });
  number.position.set(0, 0.28, 0.09);
  marker.add(number);
  marker.userData.action = kind === 'main'
    ? { type: 'mainTarget', id: id }
    : { type: 'childTarget', id: id, groupId: group.id };
  marker.userData.ring = ring;
  marker.userData.core = core;
  marker.userData.index = index;
  parent.add(marker);
  marker.traverse(object => { if (object.isMesh) markerMeshes.push(object); });
  return marker;
}

function createGroupPanels() {
  const mapBacking = mesh(new THREE.BoxGeometry(MAP_WIDTH + 0.24, MAP_HEIGHT + 0.24, 0.28), material(0x18292a), 0, MAP_CENTER_Y, MAP_Z - 0.18);
  mapBacking.userData.isMapFrame = true;
  const border = mesh(new THREE.BoxGeometry(MAP_WIDTH + 0.38, MAP_HEIGHT + 0.38, 0.08), material(0xb69b64), 0, MAP_CENTER_Y, MAP_Z - 0.24);
  border.userData.isMapFrame = true;

  GROUPS.forEach(group => {
    const bounds = imageBounds(group);
    const centerX = (bounds[0] + bounds[2]) / 2;
    const centerY = (bounds[1] + bounds[3]) / 2;
    const home = new THREE.Vector3((centerX / 100 - 0.5) * MAP_WIDTH, MAP_CENTER_Y + (0.5 - centerY / 100) * MAP_HEIGHT, MAP_Z);
    const panel = new THREE.Group();
    panel.position.copy(home);
    panel.userData.home = home.clone();
    panel.userData.groupId = group.id;
    panel.userData.frameMaterial = material(0x4b4738);
    const frame = mesh(new THREE.BoxGeometry(PANEL_WIDTH + 0.08, PANEL_HEIGHT + 0.08, 0.12), panel.userData.frameMaterial, 0, 0, -0.025, panel);

    const groupTexture = mapTexture.clone();
    groupTexture.wrapS = THREE.ClampToEdgeWrapping;
    groupTexture.wrapT = THREE.ClampToEdgeWrapping;
    groupTexture.repeat.set((bounds[2] - bounds[0]) / 100, (bounds[3] - bounds[1]) / 100);
    groupTexture.offset.set(bounds[0] / 100, 1 - bounds[3] / 100);
    groupTexture.colorSpace = THREE.SRGBColorSpace;
    groupTexture.needsUpdate = true;
    const image = mesh(
      new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT),
      new THREE.MeshBasicMaterial({ map: groupTexture, side: THREE.DoubleSide, toneMapped: false }),
      0, 0, 0.055, panel,
    );
    image.userData.action = { type: 'panel', groupId: group.id };
    panelImageMeshes.push(image);
    mapPickables.push(image);

    const label = textPlane(group.phaseLabel, PANEL_WIDTH, 0.32, {
      canvasWidth: 1024,
      canvasHeight: 128,
      fontSize: 25,
      color: group.role === 'analogy' ? '#f0c19a' : '#f5e7c4',
      background: '#112329ef',
      border: group.role === 'analogy' ? '#d6a16f' : '#d6bb79',
      borderWidth: 3,
      radius: 25,
    });
    label.position.set(0, PANEL_HEIGHT / 2 + 0.22, 0.055);
    panel.add(label);

    const mainMarker = createMarker(panel, group, group.id, GROUPS.indexOf(group), group.at, 'main');
    mainMarkers.set(group.id, mainMarker);
    mapPickables.push(...markerMeshes.slice(-3));

    const childLineGroup = new THREE.Group();
    panel.add(childLineGroup);
    panel.userData.childLineGroup = childLineGroup;
    group.children.forEach((child, index) => {
      const marker = createMarker(panel, group, child.id, index, child.at, 'child');
      childMarkers.set(group.id + ':' + child.id, marker);
      mapPickables.push(...markerMeshes.slice(-3));
    });
    mapPanels.set(group.id, panel);
    scene.add(panel);
  });
}

function lineTube(parent, start, end, color, radius = 0.022, opacity = 0.88) {
  const a = start.clone();
  const b = end.clone();
  const midpoint = a.clone().lerp(b, 0.5);
  midpoint.z += 0.16;
  const curve = new THREE.CatmullRomCurve3([a, midpoint, b]);
  const line = new THREE.Mesh(
    new THREE.TubeGeometry(curve, 28, radius, 6, false),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity, toneMapped: false }),
  );
  line.userData.pulseOffset = Math.random() * 3;
  parent.add(line);
  return line;
}

function createMainLink(groupId) {
  if (mainLinks.has(groupId)) return;
  const marker = mainMarkers.get(groupId);
  if (!marker) return;
  const endpoint = new THREE.Vector3();
  marker.getWorldPosition(endpoint);
  const root = new THREE.Vector3(0, MAP_CENTER_Y, MAP_Z + 0.16);
  const link = lineTube(mainLinkRoot, root, endpoint, COLORS.gold, 0.027, 0.9);
  mainLinks.set(groupId, link);
}

function createDetailLink(groupId, childId) {
  const key = groupId + ':' + childId;
  if (detailLinks.has(key)) return;
  const panel = mapPanels.get(groupId);
  const parentMarker = mainMarkers.get(groupId);
  const childMarker = childMarkers.get(key);
  if (!panel || !parentMarker || !childMarker) return;
  const color = GROUP_BY_ID.get(groupId).role === 'analogy' ? COLORS.analogy : COLORS.gold;
  const link = lineTube(panel.userData.childLineGroup, parentMarker.position.clone(), childMarker.position.clone(), color, 0.018, 0.86);
  detailLinks.set(key, link);
}

function buildMindMap() {
  mapGroup = new THREE.Group();
  const board = mesh(new THREE.BoxGeometry(12.25, 5.55, 0.20), material(0x102126), 0, 3.92, -8.18, mapGroup);
  board.userData.isMapFrame = true;
  const edge = mesh(new THREE.BoxGeometry(12.45, 5.75, 0.08), material(0xc2a468), 0, 3.92, -8.31, mapGroup);
  edge.userData.isMapFrame = true;
  const rootLabel = textPlane('ΘΕΙΑ ΟΙΚΟΝΟΜΙΑ', 4.6, 0.55, {
    canvasWidth: 1024, canvasHeight: 140, fontSize: 43, color: '#fff0c6',
    background: '#263932', border: '#e4c67c', borderWidth: 4, radius: 28,
  });
  rootLabel.position.set(0, 6.39, -8.02);
  mapGroup.add(rootLabel);
  const subtitle = textPlane('Από τη φθορά προς τη σωτηρία · με ελεύθερη συνεργασία', 10.4, 0.34, {
    canvasWidth: 1200, canvasHeight: 100, fontSize: 28, color: '#d7d3bf',
    background: '#14282b', border: '#b7a16b', borderWidth: 3, radius: 18,
  });
  subtitle.position.set(0, 5.93, -8.02);
  mapGroup.add(subtitle);

  const columns = [-4.5, -1.5, 1.5, 4.5];
  const categoryY = 5.16;
  const childTopY = 4.32;
  const columnWidth = 2.62;
  const categoryCards = new Map();
  const mapColors = { illness: COLORS.analogy, old: COLORS.old, new: COLORS.new, church: COLORS.church };
  GROUPS.forEach((group, index) => {
    const x = columns[index];
    const roleText = group.role === 'analogy' ? 'ΑΣΘΕΝΕΙΑ · ΠΑΡΟΜΟΙΩΣΗ\nΟΧΙ ΦΑΣΗ' : group.phaseLabel;
    const category = textPlane(roleText, columnWidth, 0.66, {
      canvasWidth: 800, canvasHeight: 210, fontSize: group.role === 'analogy' ? 24 : 26,
      color: group.role === 'analogy' ? '#ffe0c1' : '#f8edcf',
      background: group.role === 'analogy' ? '#403229' : '#263a33',
      border: '#' + mapColors[group.id].toString(16).padStart(6, '0'), borderWidth: 4, radius: 26,
    });
    category.position.set(x, categoryY, -8.02);
    mapGroup.add(category);
    categoryCards.set(group.id, category);
    lineTube(mapGroup, new THREE.Vector3(0, 5.66, -8.04), new THREE.Vector3(x, categoryY + 0.35, -8.04), mapColors[group.id], 0.018, 0.85);
    group.children.forEach((child, childIndex) => {
      const y = childTopY - childIndex * 0.65;
      const card = textPlane(child.word, columnWidth, 0.42, {
        canvasWidth: 800, canvasHeight: 160, fontSize: 27,
        color: '#e9e4d3', background: '#14282d', border: '#927f54', borderWidth: 3, radius: 22,
      });
      card.position.set(x, y, -8.02);
      mapGroup.add(card);
      lineTube(mapGroup, new THREE.Vector3(x, categoryY - 0.33, -8.03), new THREE.Vector3(x, y + 0.22, -8.03), mapColors[group.id], 0.012, 0.62);
    });
  });
  const phasePath = new THREE.Group();
  mapGroup.add(phasePath);
  lineTube(phasePath, new THREE.Vector3(-1.5, 4.78, -8.01), new THREE.Vector3(1.5, 4.78, -8.01), COLORS.bright, 0.026, 0.88);
  lineTube(phasePath, new THREE.Vector3(1.5, 4.78, -8.01), new THREE.Vector3(4.5, 4.78, -8.01), COLORS.bright, 0.026, 0.88);
  const principle = textPlane('Πρόβλημα: φθορά και θάνατος     ·     Πρωτοβουλία: φιλανθρωπία     ·     Σκοπός: σωτηρία', 11.2, 0.36, {
    canvasWidth: 1400, canvasHeight: 100, fontSize: 24, color: '#e4d2a8',
    background: '#111f24', border: '#8d815f', borderWidth: 2, radius: 20,
  });
  principle.position.set(0, 1.62, -8.02);
  mapGroup.add(principle);
  mapGroup.visible = false;
  scene.add(mapGroup);
}

function initHud() {
  hudCanvas = document.createElement('canvas');
  hudCanvas.width = 1024;
  hudCanvas.height = 768;
  hudContext = hudCanvas.getContext('2d');
  hudTexture = new THREE.CanvasTexture(hudCanvas);
  hudTexture.colorSpace = THREE.SRGBColorSpace;
  const panel = new THREE.Mesh(
    new THREE.PlaneGeometry(2.92, 2.19),
    new THREE.MeshBasicMaterial({ map: hudTexture, transparent: true, side: THREE.DoubleSide, depthWrite: false, toneMapped: false }),
  );
  hudRoot = new THREE.Group();
  hudRoot.position.set(0, -0.78, -2.45);
  hudRoot.add(panel);
  hudHitRoot = new THREE.Group();
  hudRoot.add(hudHitRoot);
  hudRoot.visible = false;
  camera.add(hudRoot);
}

function wrapLines(ctx, text, maxWidth, maxLines = 10) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const next = line ? line + ' ' + word : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[.,;:]?$/, '…');
  }
  return lines;
}

function drawWrapped(ctx, text, x, y, maxWidth, lineHeight, maxLines = 8) {
  const lines = wrapLines(ctx, text, maxWidth, maxLines);
  lines.forEach((line, index) => ctx.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function addHudHitbox(x, y, width, height, action) {
  const planeWidth = 2.92;
  const planeHeight = 2.19;
  const hit = new THREE.Mesh(
    new THREE.PlaneGeometry(width / 1024 * planeWidth, height / 768 * planeHeight),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  hit.position.set(((x + width / 2) / 1024 - 0.5) * planeWidth, (0.5 - (y + height / 2) / 768) * planeHeight, 0.018);
  hit.userData.action = action;
  hudHitRoot.add(hit);
  hudPickables.push(hit);
}

function clearHudHitboxes() {
  for (const item of hudPickables) {
    hudHitRoot.remove(item);
    item.geometry.dispose();
    item.material.dispose();
  }
  hudPickables = [];
}

function drawHudButton(ctx, rect, label, selected = false, complete = false) {
  roundedRect(ctx, rect.x, rect.y, rect.w, rect.h, 18);
  ctx.fillStyle = complete ? '#21372f' : selected ? '#403c30' : '#14282e';
  ctx.fill();
  ctx.lineWidth = selected ? 4 : 2;
  ctx.strokeStyle = complete ? '#a8c995' : selected ? '#f3d48d' : '#a88f5b';
  ctx.stroke();
  ctx.font = '600 29px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = complete ? '#cce0b8' : selected ? '#ffe5a9' : '#f1e8d5';
  const lines = wrapLines(ctx, label, rect.w - 34, 2);
  const startY = rect.y + rect.h / 2 - ((lines.length - 1) * 34) / 2;
  lines.forEach((line, index) => ctx.fillText(line, rect.x + rect.w / 2, startY + index * 34));
}

function activeGroup() {
  return GROUP_BY_ID.get(state.currentGroupId) || null;
}

function currentPrompt() {
  if (state.mode === 'main') {
    const group = GROUPS.find(item => !state.mainSolved.has(item.id));
    return group ? { kind: 'main', id: group.id, group, data: group } : null;
  }
  if (state.mode === 'detail') {
    const group = activeGroup();
    if (!group) return null;
    const child = group.children.find(item => !state.childSolved[group.id].has(item.id));
    return child ? { kind: 'detail', id: child.id, group, data: child } : null;
  }
  return null;
}

function currentWordChoices() {
  if (state.mode === 'main') return GROUPS;
  if (state.mode === 'detail') {
    const group = activeGroup();
    return group ? group.children.filter(child => !state.childSolved[group.id].has(child.id)) : [];
  }
  return [];
}

function hudReadingPages() {
  const pages = [];
  const prompt = currentPrompt();
  if (prompt) {
    pages.push({
      title: 'Παραπομπή για την ερώτηση',
      text: prompt.data.quote || prompt.group.quote,
      note: prompt.data.source || prompt.group.source || 'Από το δοσμένο κείμενο',
    });
  }
  lesson.sourceText.forEach((text, index) => pages.push({
    title: 'Κείμενο μαθήματος · παράγραφος ' + (index + 1) + ' / ' + lesson.sourceText.length,
    text,
  }));
  lesson.sourceNotes.forEach((text, index) => pages.push({
    title: 'Σημείωση · ' + (index + 1) + ' / ' + lesson.sourceNotes.length,
    text,
  }));
  return pages;
}

function drawHud() {
  if (!hudContext) return;
  clearHudHitboxes();
  const ctx = hudContext;
  ctx.clearRect(0, 0, 1024, 768);
  const gradient = ctx.createLinearGradient(0, 0, 1024, 768);
  gradient.addColorStop(0, 'rgba(12,28,34,0.97)');
  gradient.addColorStop(1, 'rgba(22,43,43,0.96)');
  roundedRect(ctx, 5, 5, 1014, 758, 25);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#d8bb765c';
  ctx.stroke();

  const total = solvedCount();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '650 19px system-ui, sans-serif';
  ctx.fillStyle = '#dfbf7d';
  ctx.fillText('SACRED BLUEPRINT  ·  ΘΕΙΑ ΟΙΚΟΝΟΜΙΑ', 42, 47);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f1dfa9';
  ctx.fillText(total + ' / ' + lesson.totalConnections, 975, 47);
  ctx.textAlign = 'left';
  roundedRect(ctx, 815, 67, 160, 45, 13);
  ctx.fillStyle = state.sourceOpen ? '#3e392e' : '#14292e';
  ctx.fill();
  ctx.strokeStyle = '#b49b63';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillStyle = '#f0dfb8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.sourceOpen ? 'Κλείσιμο κειμένου' : 'Κείμενο', 895, 89);
  addHudHitbox(815, 67, 160, 45, { type: 'source' });

  if (state.sourceOpen) {
    const pages = hudReadingPages();
    sourceParagraph = THREE.MathUtils.clamp(sourceParagraph, 0, pages.length - 1);
    const page = pages[sourceParagraph];
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '650 27px system-ui, sans-serif';
    ctx.fillStyle = '#f4dfad';
    ctx.fillText(page.title, 46, 162);
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = '#e3e1d5';
    drawWrapped(ctx, page.text, 48, 210, 925, 32, 13);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#c7b889';
    if (page.note) drawWrapped(ctx, page.note, 48, 665, 900, 24, 2);
    roundedRect(ctx, 48, 704, 220, 42, 11);
    ctx.fillStyle = sourceParagraph > 0 ? '#192d31' : '#101e22';
    ctx.fill();
    ctx.strokeStyle = '#b69c61';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = sourceParagraph > 0 ? '#efdcad' : '#8e9388';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('‹ Προηγούμενο', 158, 725);
    addHudHitbox(48, 704, 220, 42, { type: 'sourcePrev' });
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d9c99f';
    ctx.fillText((sourceParagraph + 1) + ' / ' + pages.length, 512, 725);
    roundedRect(ctx, 756, 704, 220, 42, 11);
    ctx.fillStyle = sourceParagraph < pages.length - 1 ? '#192d31' : '#101e22';
    ctx.fill();
    ctx.strokeStyle = '#b69c61';
    ctx.stroke();
    ctx.font = '600 18px system-ui, sans-serif';
    ctx.fillStyle = sourceParagraph < pages.length - 1 ? '#efdcad' : '#8e9388';
    ctx.fillText('Επόμενο ›', 866, 725);
    addHudHitbox(756, 704, 220, 42, { type: 'sourceNext' });
    return;
  }

  if (state.mode === 'welcome') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '36px Georgia, serif';
    ctx.fillStyle = '#f5e5bf';
    ctx.fillText('Το σχέδιο της Θείας Οικονομίας', 512, 224);
    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = '#c5d0ca';
    drawWrapped(ctx, 'Τέσσερις κεντρικές συνδέσεις, δεκαέξι επιμέρους έννοιες και ένας τελικός mind map.', 112, 283, 800, 36, 3);
    roundedRect(ctx, 274, 444, 476, 88, 18);
    ctx.fillStyle = '#d8bd7c';
    ctx.fill();
    ctx.font = '700 29px system-ui, sans-serif';
    ctx.fillStyle = '#142329';
    ctx.fillText('Έναρξη διαδρομής', 512, 489);
    addHudHitbox(274, 444, 476, 88, { type: 'start' });
    ctx.font = '21px system-ui, sans-serif';
    ctx.fillStyle = '#e3c79b';
    ctx.fillText('Η ασθένεια είναι παρομοίωση, όχι τέταρτη φάση.', 512, 607);
    return;
  }

  if (state.mode === 'main' || state.mode === 'detail') {
    const prompt = currentPrompt();
    if (!prompt) return;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '650 19px system-ui, sans-serif';
    ctx.fillStyle = '#d9bd7a';
    const progress = state.mode === 'main'
      ? 'ΚΕΝΤΡΙΚΟΣ ΧΑΡΤΗΣ · ' + (state.mainSolved.size + 1) + ' / 4'
      : prompt.group.phaseLabel + ' · ' + (state.childSolved[prompt.group.id].size + 1) + ' / 4';
    ctx.fillText(progress.toUpperCase(), 46, 157);
    ctx.font = '30px Georgia, serif';
    ctx.fillStyle = '#fff0c9';
    const nextY = drawWrapped(ctx, prompt.data.question || prompt.group.question, 46, 202, 920, 38, 4);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillStyle = '#b9c8bf';
    ctx.fillText(state.selectedWord ? 'Τώρα στόχευσε το φωτεινό σημείο στην εικόνα.' : 'Διάλεξε τη λέξη που ταιριάζει και μετά στόχευσε το σημείο.', 46, Math.max(330, nextY + 24));
    const words = currentWordChoices();
    const rects = [
      { x: 46, y: 388, w: 450, h: 100 },
      { x: 528, y: 388, w: 450, h: 100 },
      { x: 46, y: 504, w: 450, h: 100 },
      { x: 528, y: 504, w: 450, h: 100 },
    ];
    words.slice(0, 4).forEach((word, index) => {
      drawHudButton(ctx, rects[index], word.word, state.selectedWord === word.id, false);
      addHudHitbox(rects[index].x, rects[index].y, rects[index].w, rects[index].h, { type: 'answer', id: word.id });
    });
    const itemKey = prompt.kind === 'main' ? prompt.id : prompt.group.id + ':' + prompt.id;
    if (state.hints.has(itemKey)) {
      ctx.font = '21px system-ui, sans-serif';
      ctx.fillStyle = '#f0dcae';
      drawWrapped(ctx, 'Υπόδειξη: ' + prompt.data.hint, 48, 654, 920, 29, 3);
    } else {
      roundedRect(ctx, 48, 647, 244, 51, 12);
      ctx.fillStyle = '#192d31';
      ctx.fill();
      ctx.strokeStyle = '#b69c61';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.font = '600 20px system-ui, sans-serif';
      ctx.fillStyle = '#efdcad';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Μικρή υπόδειξη', 170, 673);
      addHudHitbox(48, 647, 244, 51, { type: 'hint' });
    }
    return;
  }

  if (state.mode === 'chapters') {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '650 20px system-ui, sans-serif';
    ctx.fillStyle = '#d9bd7a';
    ctx.fillText('ΟΙ ΤΕΣΣΕΡΙΣ ΕΝΟΤΗΤΕΣ', 46, 157);
    ctx.font = '30px Georgia, serif';
    ctx.fillStyle = '#fff0c9';
    ctx.fillText('Άνοιξε έναν σταθμό για εμβάθυνση', 46, 207);
    const rects = [
      { x: 46, y: 260, w: 450, h: 104 },
      { x: 528, y: 260, w: 450, h: 104 },
      { x: 46, y: 382, w: 450, h: 104 },
      { x: 528, y: 382, w: 450, h: 104 },
    ];
    GROUPS.forEach((group, index) => {
      const count = state.childSolved[group.id].size;
      drawHudButton(ctx, rects[index], group.word + '\n' + count + ' / ' + group.children.length, false, count === group.children.length);
      addHudHitbox(rects[index].x, rects[index].y, rects[index].w, rects[index].h, { type: 'openGroup', id: group.id });
    });
    if (isComplete()) {
      roundedRect(ctx, 274, 557, 476, 82, 18);
      ctx.fillStyle = '#ddc27f';
      ctx.fill();
      ctx.font = '700 27px system-ui, sans-serif';
      ctx.fillStyle = '#15262a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Άνοιξε τον τελικό mind map', 512, 598);
      addHudHitbox(274, 557, 476, 82, { type: 'mindmap' });
    } else {
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillStyle = '#c7c6b7';
      ctx.fillText('Ολοκλήρωσε και τις τέσσερις ενότητες για να ανοίξει ο τελικός χάρτης.', 47, 602, 920);
    }
    return;
  }

  if (state.mode === 'mindmap') {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.font = '650 20px system-ui, sans-serif';
    ctx.fillStyle = '#d9bd7a';
    ctx.fillText('ΟΛΟΚΛΗΡΩΜΕΝΗ ΔΙΑΔΡΟΜΗ · ' + lesson.totalConnections + ' / ' + lesson.totalConnections, 46, 157);
    ctx.font = '29px Georgia, serif';
    ctx.fillStyle = '#fff0c9';
    ctx.fillText('Ο νους οργανώνει τις συνδέσεις', 46, 207);
    ctx.font = '23px system-ui, sans-serif';
    drawWrapped(ctx, lesson.finalMindMap.reflectionPrompt, 47, 258, 930, 36, 6);
    roundedRect(ctx, 275, 570, 474, 78, 16);
    ctx.fillStyle = '#d8bd7c';
    ctx.fill();
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.fillStyle = '#142329';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Επιστροφή στις ενότητες', 512, 610);
    addHudHitbox(275, 570, 474, 78, { type: 'home' });
  }
}

function refreshHud() {
  drawHud();
  if (hudTexture) hudTexture.needsUpdate = true;
}

function addCountLinkLines() {
  for (const group of GROUPS) {
    if (state.mainSolved.has(group.id)) createMainLink(group.id);
    for (const child of group.children) {
      if (state.childSolved[group.id].has(child.id)) createDetailLink(group.id, child.id);
    }
  }
}

function restoreProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (!saved || saved.version !== 1) return;
    state.mainSolved = new Set((saved.mainSolved || []).filter(id => GROUP_BY_ID.has(id)));
    for (const group of GROUPS) {
      state.childSolved[group.id] = new Set((saved.childSolved?.[group.id] || []).filter(id => group.children.some(child => child.id === id)));
    }
    state.started = Boolean(saved.started);
    state.mode = state.started ? (state.mainSolved.size === GROUPS.length ? 'chapters' : 'main') : 'welcome';
  } catch {
    // Continue without stored progress when browser storage is unavailable.
  }
}

function persistProgress() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      started: state.started,
      mainSolved: [...state.mainSolved],
      childSolved: Object.fromEntries(GROUPS.map(group => [group.id, [...state.childSolved[group.id]]])),
    }));
  } catch {
    // The activity remains usable if the browser blocks local storage.
  }
}

function solvedCount() {
  let count = state.mainSolved.size;
  for (const group of GROUPS) count += state.childSolved[group.id].size;
  return count;
}

function isComplete() {
  return solvedCount() === lesson.totalConnections;
}

function setFeedback(message, kind = '') {
  state.feedback = message;
  state.feedbackKind = kind;
  const box = $('feedback');
  box.textContent = message;
  box.className = 'feedback' + (kind ? ' ' + kind : '');
  box.hidden = !message;
}

function makeElement(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function panelHeader(kicker, title) {
  $('panel-content').append(makeElement('p', 'panel-kicker', kicker));
  $('panel-content').append(makeElement('h2', '', title));
}

function renderAnswers(items) {
  const grid = makeElement('div', 'answer-grid');
  items.forEach(item => {
    const button = makeElement('button', 'answer-card', item.word);
    button.type = 'button';
    button.setAttribute('aria-pressed', String(state.selectedWord === item.id));
    if (state.selectedWord === item.id) button.setAttribute('aria-pressed', 'true');
    button.addEventListener('click', () => selectWord(item.id));
    grid.append(button);
  });
  $('panel-content').append(grid);
}

function renderPanel() {
  const panel = $('lesson-panel');
  const content = $('panel-content');
  panel.hidden = !state.started || state.mode === 'welcome';
  content.replaceChildren();
  const prompt = currentPrompt();

  if (state.mode === 'main' && prompt) {
    panelHeader('Κεντρικός χάρτης · ' + (state.mainSolved.size + 1) + ' / 4', prompt.group.word);
    content.append(makeElement('p', '', prompt.group.question));
    renderAnswers(GROUPS);
    content.append(makeElement('p', 'panel-instruction', state.selectedWord ? 'Τώρα στόχευσε τον αριθμό που ανήκει στην επιλεγμένη ενότητα.' : 'Διάλεξε λέξη και στόχευσε το αριθμημένο σημείο στην εικόνα.'));
    renderHintButton(prompt);
  } else if (state.mode === 'chapters') {
    panelHeader('Οι τέσσερις ενότητες', 'Άνοιξε έναν σταθμό');
    content.append(makeElement('p', '', 'Η ασθένεια λειτουργεί ως παρομοίωση. Οι επόμενες τρεις ενότητες είναι οι φάσεις του σχεδίου.'));
    const list = makeElement('div', 'chapter-list');
    GROUPS.forEach(group => {
      const count = state.childSolved[group.id].size;
      const button = makeElement('button', 'chapter-card');
      button.type = 'button';
      button.append(makeElement('span', '', group.phaseLabel));
      button.append(makeElement('span', '', count + ' / ' + group.children.length));
      button.addEventListener('click', () => openGroup(group.id));
      list.append(button);
    });
    content.append(list);
    if (isComplete()) {
      const map = makeElement('button', 'hint-button', 'Άνοιξε τον τελικό mind map');
      map.type = 'button';
      map.addEventListener('click', () => enterMindMap());
      content.append(map);
    } else {
      content.append(makeElement('p', 'panel-instruction', 'Ο τελικός χάρτης ανοίγει μετά την ολοκλήρωση και των 16 επιμέρους συνδέσεων.'));
    }
  } else if (state.mode === 'detail' && prompt) {
    const number = state.childSolved[prompt.group.id].size + 1;
    panelHeader(prompt.group.phaseLabel + ' · ' + number + ' / 4', prompt.data.title || 'Ποια έννοια ταιριάζει;');
    content.append(makeElement('p', '', prompt.data.question));
    content.append(makeElement('p', 'quote-text', '«' + prompt.data.quote + '»'));
    renderAnswers(currentWordChoices());
    content.append(makeElement('p', 'panel-instruction', state.selectedWord ? 'Τώρα στόχευσε το φωτεινό σημείο της εικόνας.' : 'Διάλεξε λέξη και σύνδεσέ την με το σημείο της εικόνας.'));
    renderHintButton(prompt);
  } else if (state.mode === 'mindmap') {
    panelHeader('Ολοκληρωμένη διαδρομή · ' + lesson.totalConnections + ' / ' + lesson.totalConnections, 'Ο mind map της Θείας Οικονομίας');
    content.append(makeElement('p', '', lesson.finalMindMap.reflectionPrompt));
    content.append(makeElement('p', 'panel-instruction', 'Η αριστερή ενότητα είναι παρομοίωση. Η πορεία των τριών φάσεων κινείται από την Παλαιά Διαθήκη στην Καινή Διαθήκη και στην Εκκλησία.'));
    const home = makeElement('button', 'hint-button', 'Επιστροφή στις ενότητες');
    home.type = 'button';
    home.addEventListener('click', () => goHome());
    content.append(home);
  }

  if (state.feedback) content.append(makeElement('p', 'panel-status', state.feedback));
  $('progress-count').textContent = solvedCount() + ' / ' + lesson.totalConnections;
  $('home-button').hidden = !state.started || state.mode === 'chapters';
  $('map-button').disabled = !isComplete();
  $('map-button').hidden = !state.started || !isComplete() || state.mode === 'mindmap';
}

function renderHintButton(prompt) {
  const itemKey = prompt.kind === 'main' ? prompt.id : prompt.group.id + ':' + prompt.id;
  if (state.hints.has(itemKey)) {
    $('panel-content').append(makeElement('div', 'hint-box', 'Υπόδειξη: ' + prompt.data.hint));
    return;
  }
  const button = makeElement('button', 'hint-button', 'Μικρή υπόδειξη');
  button.type = 'button';
  button.addEventListener('click', () => showHint(prompt));
  $('panel-content').append(button);
}

function refresh() {
  renderPanel();
  updateWorldVisibility();
  refreshHud();
  persistProgress();
}

function updateMarkerStyle(marker, color, opacity = 1, active = false) {
  if (!marker) return;
  marker.userData.ring.material.color.setHex(color);
  marker.userData.ring.material.opacity = opacity;
  marker.userData.core.material.color.setHex(color);
  marker.userData.core.material.opacity = opacity;
  marker.userData.core.scale.setScalar(active ? 1.25 : 1);
}

function updateWorldVisibility() {
  const focus = state.mode === 'detail';
  for (const group of GROUPS) {
    const panel = mapPanels.get(group.id);
    if (!panel) continue;
    const isFocus = focus && group.id === state.currentGroupId;
    panel.visible = state.mode !== 'mindmap';
    panel.position.copy(isFocus ? new THREE.Vector3(0, MAP_CENTER_Y, MAP_Z) : panel.userData.home);
    panel.scale.setScalar(isFocus ? 1.32 : 1);
    panel.userData.frameMaterial.color.setHex(isFocus ? 0x89774f : 0x4b4738);
    const mainMarker = mainMarkers.get(group.id);
    const mainDone = state.mainSolved.has(group.id);
    const mainActive = state.mode === 'main' && currentPrompt()?.id === group.id;
    mainMarker.visible = state.mode === 'main' || state.mode === 'chapters';
    updateMarkerStyle(mainMarker, mainDone ? COLORS.green : mainActive ? COLORS.bright : COLORS.gold, mainActive || state.mode === 'chapters' ? 1 : 0.56, mainActive);
    group.children.forEach(child => {
      const marker = childMarkers.get(group.id + ':' + child.id);
      const solved = state.childSolved[group.id].has(child.id);
      const activePrompt = currentPrompt();
      const active = state.mode === 'detail' && group.id === state.currentGroupId && activePrompt?.id === child.id;
      marker.visible = isFocus;
      updateMarkerStyle(marker, solved ? COLORS.green : active ? COLORS.bright : COLORS.gold, active || solved ? 1 : 0.42, active);
    });
  }
  mainLinkRoot.visible = state.mode !== 'detail' && state.mode !== 'mindmap';
  for (const group of GROUPS) {
    const panel = mapPanels.get(group.id);
    if (panel?.userData.childLineGroup) panel.userData.childLineGroup.visible = state.mode === 'detail' && group.id === state.currentGroupId;
  }
  if (mapGroup) mapGroup.visible = state.mode === 'mindmap';
  if (hudRoot) {
    hudRoot.visible = renderer.xr.isPresenting;
    hudRoot.position.y = -0.78;
  }
  $('welcome').hidden = state.started;
}

function showHint(prompt = currentPrompt()) {
  if (!prompt) return;
  const key = prompt.kind === 'main' ? prompt.id : prompt.group.id + ':' + prompt.id;
  state.hints.add(key);
  setFeedback('Υπόδειξη: ' + prompt.data.hint, '');
  refresh();
}

function selectWord(id) {
  if (!currentPrompt()) return;
  state.selectedWord = id;
  setFeedback('Επίλεξες λέξη. Τώρα στόχευσε το αντίστοιχο σημείο στην εικόνα.', '');
  refresh();
}

function attemptTarget(targetId) {
  const prompt = currentPrompt();
  if (!prompt) return;
  if (!state.selectedWord) {
    setFeedback('Επίλεξε πρώτα μία λέξη από τις κάρτες.', 'error');
    refresh();
    return;
  }
  if (state.selectedWord !== prompt.id || targetId !== prompt.id) {
    const key = prompt.kind === 'main' ? prompt.id : prompt.group.id + ':' + prompt.id;
    state.errors[key] = (state.errors[key] || 0) + 1;
    if (state.errors[key] >= 2) state.hints.add(key);
    state.selectedWord = null;
    setFeedback(state.errors[key] >= 2 ? 'Δεν ταιριάζει ακόμη. Εμφανίστηκε υπόδειξη.' : 'Η σύνδεση δεν ταιριάζει. Δοκίμασε ξανά.', 'error');
    refresh();
    return;
  }

  state.selectedWord = null;
  state.errors[prompt.kind === 'main' ? prompt.id : prompt.group.id + ':' + prompt.id] = 0;
  if (prompt.kind === 'main') {
    state.mainSolved.add(prompt.id);
    createMainLink(prompt.id);
    setFeedback('Σωστά · ' + prompt.group.explanation, 'success');
    if (state.mainSolved.size === GROUPS.length) {
      state.mode = 'chapters';
      state.currentGroupId = null;
    }
  } else {
    state.childSolved[prompt.group.id].add(prompt.id);
    createDetailLink(prompt.group.id, prompt.id);
    setFeedback('Σωστά · ' + prompt.data.explanation, 'success');
    if (state.childSolved[prompt.group.id].size === prompt.group.children.length) {
      state.currentGroupId = null;
      state.mode = 'chapters';
      if (isComplete()) state.mode = 'mindmap';
    }
  }
  refresh();
}

function openGroup(groupId) {
  if (!GROUP_BY_ID.has(groupId) || state.mainSolved.size !== GROUPS.length) return;
  const group = GROUP_BY_ID.get(groupId);
  if (state.childSolved[groupId].size === group.children.length) {
    setFeedback('Αυτή η ενότητα έχει ολοκληρωθεί. Μπορείς να την ξαναδείς από τον κεντρικό χάρτη.', 'success');
    return;
  }
  state.currentGroupId = groupId;
  state.mode = 'detail';
  state.selectedWord = null;
  state.sourceOpen = false;
  rig.position.set(0, 0, 2.35);
  rig.rotation.y = 0;
  camera.rotation.x = -0.08;
  setFeedback('Σταθμός ανοιχτός · σύνδεσε τις τέσσερις έννοιες.', '');
  refresh();
}

function goHome() {
  state.currentGroupId = null;
  state.selectedWord = null;
  state.sourceOpen = false;
  state.mode = state.mainSolved.size === GROUPS.length ? 'chapters' : 'main';
  rig.position.set(0, 0, 8.5);
  rig.rotation.y = 0;
  camera.rotation.x = 0;
  refresh();
}

function enterMindMap() {
  if (!isComplete()) return;
  state.currentGroupId = null;
  state.selectedWord = null;
  state.mode = 'mindmap';
  state.sourceOpen = false;
  rig.position.set(0, 0, 8.5);
  rig.rotation.y = 0;
  camera.rotation.x = -0.02;
  setFeedback('Ολοκληρώθηκαν και οι 20 συνδέσεις. Ο τελικός mind map είναι ανοιχτός.', 'success');
  refresh();
}

function startJourney() {
  state.started = true;
  state.mode = state.mainSolved.size === GROUPS.length ? 'chapters' : 'main';
  state.currentGroupId = null;
  rig.position.set(0, 0, 8.5);
  rig.rotation.y = 0;
  camera.rotation.x = 0;
  refresh();
}

function returnToIntro() {
  state.started = false;
  state.mode = 'welcome';
  state.selectedWord = null;
  refresh();
}

function findAction(object) {
  let current = object;
  while (current) {
    if (current.userData?.action) return current.userData.action;
    current = current.parent;
  }
  return null;
}

function performAction(action) {
  if (!action) return;
  if (action.type === 'start') startJourney();
  else if (action.type === 'answer') selectWord(action.id);
  else if (action.type === 'hint') showHint();
  else if (action.type === 'openGroup') openGroup(action.id);
  else if (action.type === 'mindmap') enterMindMap();
  else if (action.type === 'home') goHome();
  else if (action.type === 'source') {
    state.sourceOpen = !state.sourceOpen;
    sourceParagraph = 0;
    refresh();
  }
  else if (action.type === 'sourcePrev') {
    sourceParagraph = Math.max(0, sourceParagraph - 1);
    refreshHud();
  }
  else if (action.type === 'sourceNext') {
    sourceParagraph = Math.min(hudReadingPages().length - 1, sourceParagraph + 1);
    refreshHud();
  }
  else if (action.type === 'mainTarget') {
    if (state.mode === 'main') attemptTarget(action.id);
    else if (state.mode === 'chapters') openGroup(action.id);
  }
  else if (action.type === 'childTarget') {
    if (state.mode === 'detail' && action.groupId === state.currentGroupId) attemptTarget(action.id);
  }
  else if (action.type === 'panel' && state.mode === 'chapters') openGroup(action.groupId);
}

function raycastObjects() {
  const objects = [...mapPickables];
  if (renderer.xr.isPresenting) objects.push(...hudPickables);
  return objects.filter(object => object.visible && object.parent?.visible !== false);
}

function interactWithRay(ray) {
  const raycaster = ray;
  raycaster.far = 24;
  const hits = raycaster.intersectObjects(raycastObjects(), true);
  for (const hit of hits) {
    const action = findAction(hit.object);
    if (action) {
      performAction(action);
      return;
    }
  }
}

function interactAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const pointer = new THREE.Vector2(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(pointer, camera);
  interactWithRay(raycaster);
}

function renderReadingDialog() {
  const content = $('reading-content');
  content.replaceChildren();
  lesson.sourceText.forEach(text => content.append(makeElement('p', '', text)));
  lesson.sourceNotes.forEach(text => content.append(makeElement('p', 'source-note', text)));
}

function showDialog(id) {
  const dialog = $(id);
  if (dialog && !dialog.open) dialog.showModal();
}

function hideDialog(id) {
  const dialog = $(id);
  if (dialog?.open) dialog.close();
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
}

function updateMovement(delta) {
  if (renderer.xr.isPresenting) return;
  const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - touchVector.y;
  const strafe = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft')) + touchVector.x;
  const length = Math.hypot(forward, strafe);
  if (length < 0.06) return;
  const f = forward / Math.max(1, length);
  const r = strafe / Math.max(1, length);
  const yaw = rig.rotation.y;
  const speed = 3.0 * delta;
  rig.position.x += (Math.sin(yaw) * f + Math.cos(yaw) * r) * speed;
  rig.position.z += (-Math.cos(yaw) * f + Math.sin(yaw) * r) * speed;
  rig.position.x = THREE.MathUtils.clamp(rig.position.x, -10.8, 10.8);
  rig.position.z = THREE.MathUtils.clamp(rig.position.z, -12.5, 12.8);
}

function animate(time) {
  const delta = Math.min(0.05, Math.max(0, (time - lastFrame) / 1000));
  lastFrame = time;
  updateMovement(delta);
  if (renderer.xr.isPresenting && hudRoot) hudRoot.visible = true;
  scene.traverse(object => {
    if (object.userData?.isBeacon) object.rotation.y = time * 0.00035;
  });
  for (const line of [...mainLinks.values(), ...detailLinks.values()]) {
    line.material.opacity = 0.68 + Math.sin(time * 0.0013 + (line.userData.pulseOffset || 0)) * 0.14;
  }
  renderer.render(scene, camera);
}

function setupInputs() {
  window.addEventListener('keydown', event => {
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
      event.preventDefault();
      keys.add(event.code);
    }
    if (event.key === 'Escape' && !renderer.xr.isPresenting && state.mode === 'detail') goHome();
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); touchVector = { x: 0, y: 0 }; });

  canvas.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    activePointer = { id: event.pointerId, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY, moved: false };
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', event => {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    const dx = event.clientX - activePointer.lastX;
    const dy = event.clientY - activePointer.lastY;
    activePointer.lastX = event.clientX;
    activePointer.lastY = event.clientY;
    if (Math.hypot(event.clientX - activePointer.x, event.clientY - activePointer.y) > 5) activePointer.moved = true;
    if (activePointer.moved) {
      rig.rotation.y -= dx * 0.004;
      camera.rotation.x = THREE.MathUtils.clamp(camera.rotation.x - dy * 0.003, -1.2, 1.2);
    }
  });
  canvas.addEventListener('pointerup', event => {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    const moved = activePointer.moved;
    activePointer = null;
    if (!moved) interactAt(event.clientX, event.clientY);
  });
  canvas.addEventListener('pointercancel', () => { activePointer = null; });

  const pad = $('touch-base');
  const stick = $('touch-stick');
  function setTouch(event) {
    const rect = pad.getBoundingClientRect();
    const radius = rect.width * 0.36;
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    const amount = Math.min(length / radius, 1);
    const nx = length ? dx / length * amount : 0;
    const ny = length ? dy / length * amount : 0;
    touchVector = { x: nx, y: ny };
    stick.style.left = (50 + nx * 34) + '%';
    stick.style.top = (50 + ny * 34) + '%';
  }
  function releaseTouch() {
    movePointer = null;
    touchVector = { x: 0, y: 0 };
    stick.style.left = '50%';
    stick.style.top = '50%';
  }
  pad.addEventListener('pointerdown', event => {
    event.preventDefault();
    movePointer = event.pointerId;
    pad.setPointerCapture(event.pointerId);
    setTouch(event);
  });
  pad.addEventListener('pointermove', event => {
    if (movePointer === event.pointerId) setTouch(event);
  });
  pad.addEventListener('pointerup', releaseTouch);
  pad.addEventListener('pointercancel', releaseTouch);
}

function setupXR() {
  try { renderer.xr.setReferenceSpaceType('local-floor'); } catch { /* The browser chooses its supported floor space. */ }
  const button = VRButton.createButton(renderer, { optionalFeatures: ['local-floor', 'bounded-floor'] });
  $('vr-slot').append(button);
  renderer.xr.addEventListener('sessionstart', () => {
    document.body.classList.add('xr');
    hudRoot.visible = true;
    refreshHud();
  });
  renderer.xr.addEventListener('sessionend', () => {
    document.body.classList.remove('xr');
    hudRoot.visible = false;
    renderPanel();
  });
  for (let index = 0; index < 2; index++) {
    const controller = renderer.xr.getController(index);
    const rayLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -4)]),
      new THREE.LineBasicMaterial({ color: 0xf0d28a, transparent: true, opacity: 0.72 }),
    );
    controller.add(rayLine);
    controller.addEventListener('select', () => {
      const raycaster = new THREE.Raycaster();
      raycaster.setFromXRController(controller);
      interactWithRay(raycaster);
    });
    rig.add(controller);
  }
}

function initCollectionLink() {
  const collectionUrl = import.meta.env.VITE_COLLECTION_URL;
  if (collectionUrl) $('collection-link').href = collectionUrl;
}

function restoreAndBuildLinks() {
  restoreProgress();
  createEnvironment();
  initHud();
  buildMindMap();
  const loader = new THREE.TextureLoader();
  loader.load(
    MAP_URL,
    texture => {
      mapTexture = texture;
      mapTexture.colorSpace = THREE.SRGBColorSpace;
      mapTexture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      createGroupPanels();
      addCountLinkLines();
      $('start-button').disabled = false;
      refresh();
    },
    undefined,
    () => {
      $('start-button').disabled = false;
      setFeedback('Η εικόνα του χάρτη δεν φορτώθηκε. Δοκίμασε ξανά τη σελίδα.', 'error');
    },
  );
}

function setupButtons() {
  $('start-button').addEventListener('click', startJourney);
  $('home-button').addEventListener('click', goHome);
  $('map-button').addEventListener('click', enterMindMap);
  $('reading-button').addEventListener('click', () => showDialog('reading-dialog'));
  $('help-button').addEventListener('click', () => showDialog('help-dialog'));
  $('reading-close').addEventListener('click', () => hideDialog('reading-dialog'));
  $('help-close').addEventListener('click', () => hideDialog('help-dialog'));
  $('reading-dialog').addEventListener('click', event => {
    if (event.target === $('reading-dialog')) hideDialog('reading-dialog');
  });
  $('help-dialog').addEventListener('click', event => {
    if (event.target === $('help-dialog')) hideDialog('help-dialog');
  });
}

renderReadingDialog();
initCollectionLink();
setupButtons();
setupInputs();
setupXR();
restoreAndBuildLinks();
window.addEventListener('resize', onResize);
renderer.setAnimationLoop(animate);
