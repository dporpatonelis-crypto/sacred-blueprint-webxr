import * as THREE from 'three';
import { batchStatic } from './batch-static.js';
import { courtyardRiver } from './river-bridge.js';

const palette = { stone: 0xe3c38e, pale: 0xf3ddb0, edge: 0xc5a16b, wood: 0x815b37, green: 0x628849, gold: 0xd4a64a };
export function buildCourtyard(scene, theme = 'talanta', quiz = null) {
  let seed = 1807;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const materials = new Map();
  const mat = (color, extra = {}) => {
    const key = `${color}:${JSON.stringify(extra)}`;
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.92, flatShading: true, ...extra }));
    return materials.get(key);
  };
  const mesh = (geo, material, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (w, h, d, x, y, z, color = palette.stone, parent = scene) => mesh(new THREE.BoxGeometry(w, h, d), mat(color), x, y, z, parent);
  const cylinder = (r1, r2, h, x, y, z, color, n = 12, parent = scene) => mesh(new THREE.CylinderGeometry(r1, r2, h, n), mat(color), x, y, z, parent);

  scene.background = new THREE.Color(theme === 'loukas' ? 0xd1e2e7 : theme === 'omoiosi' ? 0xdce8d1 : 0xbcdfe9);
  scene.fog = new THREE.Fog(0xd4e5df, 28, 100);
  const hemi = new THREE.HemisphereLight(0xe1f4ff, 0xc6a26b, 2.2); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffefd1, 2.5); sun.position.set(-8, 14, 7);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -16; sun.shadow.camera.right = 16; sun.shadow.camera.top = 15; sun.shadow.camera.bottom = -15;
  sun.shadow.normalBias = 0.045; sun.shadow.bias = -0.0001; scene.add(sun);

  // The walkable courtyard is genuine geometry; the reference illustration is
  // used for art direction, never stretched around the camera as a panorama.
  box(24, 0.7, 22, 0, -0.48, 0, 0xb6a172);
  if (quiz) {
    box(23,.12,6.5,0,-.06,7.25,palette.stone);
    for (const [x,width] of [[-7.6,7.8],[0,5.2],[7.6,7.8]]) box(width,.12,12.5,x,-.06,-4.25,palette.stone);
  } else box(23, 0.12, 21, 0, -0.06, 0, palette.stone);
  const slabGeo = new THREE.BoxGeometry(0.93, 0.045, 0.93);
  const slabs = new THREE.InstancedMesh(slabGeo, mat(0xffffff), 23 * 21);
  const matrix = new THREE.Matrix4(), color = new THREE.Color();
  let index = 0;
  for (let x = -11; x <= 11; x++) for (let z = -10; z <= 10; z++) {
    if (quiz && ((z > 1.5 && z < 4.5) || (z < 2.5 && Math.abs(Math.abs(x)-3.15)<1))) continue;
    matrix.makeTranslation(x + (z % 2 ? 0.035 : -0.035), 0.001 + random() * 0.008, z);
    slabs.setMatrixAt(index, matrix);
    color.setHSL(0.107 + random() * 0.018, 0.32 + random() * 0.13, 0.67 + random() * 0.08);
    slabs.setColorAt(index++, color);
  }
  slabs.count = index;
  slabs.receiveShadow = true; scene.add(slabs);
  for (const x of [-11.6, 11.6]) {
    box(0.45, 0.8, 20.8, x, 0.4, 0, palette.edge);
    box(0.66, 0.16, 21.2, x, 0.86, 0, palette.pale);
    for (let z = -9; z < 10; z += 3.3) box(0.72, 1.12, 0.72, x, 0.56, z, palette.stone);
  }
  for (const x of [-7.8, 7.8]) {
    box(7.3, 0.7, 0.5, x, 0.35, 10.2, palette.edge);
    box(7.5, 0.14, 0.72, x, 0.77, 10.2, palette.pale);
  }
  for (const center of [-6.3, 0, 6.3]) {
    const arch = new THREE.Group(); arch.position.set(center, 0, -8.9); scene.add(arch);
    for (const side of [-1, 1]) {
      box(0.62, 2.5, 0.82, side * 2.65, 1.25, 0, palette.stone, arch);
      box(0.83, 0.19, 1.02, side * 2.65, 0.13, 0, palette.edge, arch);
      box(0.81, 0.22, 1.0, side * 2.65, 2.45, 0, palette.pale, arch);
      for (let y = 0.55; y < 2.4; y += 0.49) box(0.64, 0.025, 0.84, side * 2.65, y, 0, 0xc4a576, arch);
    }
    const arc = mesh(new THREE.TorusGeometry(2.65, 0.31, 6, 30, Math.PI), mat(palette.stone), 0, 2.45, 0, arch);
    arc.scale.z = 1.4;
    box(0.56, 0.66, 0.99, 0, 5.06, 0, palette.pale, arch);
  }
  // Terrace pedestals visually anchor the transparent actors.
  for (const [x, z] of [[-6.3, -3.5], [0, -6.3], [6.3, -3.5]]) {
    cylinder(2.12, 2.25, 0.16, x, 0.08, z, palette.edge, 48);
    cylinder(2.05, 2.05, 0.07, x, 0.195, z, palette.pale, 48);
  }

  // Fountain, benches and a lectern-sized table are ordinary 3D props.
  const fountainX = quiz ? 8 : 0;
  const fountainZ = quiz ? .2 : 2.7;
  const tableX = quiz ? -8 : -3.1;
  const tableZ = quiz ? .6 : 4.3;
  cylinder(1.15, 1.28, 0.35, fountainX, 0.175, fountainZ, palette.edge, 32);
  cylinder(1.1, 1.1, 0.12, fountainX, 0.39, fountainZ, palette.pale, 32);
  const fountainWater = cylinder(0.99, 0.99, 0.018, fountainX, 0.46, fountainZ, 0x4eb7af, 48);
  fountainWater.material = new THREE.MeshStandardMaterial({ color: 0x43aca7, roughness: 0.23, metalness: 0.24 });
  cylinder(0.22, 0.35, 0.65, fountainX, 0.71, fountainZ, palette.stone, 12);
  cylinder(0.55, 0.15, 0.19, fountainX, 1.12, fountainZ, palette.pale, 24);
  const droplets = [];
  for (let i = 0; i < 12; i++) {
    const d = mesh(new THREE.SphereGeometry(0.035, 5, 4), mat(0x8be0d5), fountainX, 1.15, fountainZ);
    d.castShadow = false; droplets.push(d);
  }
  for (const x of [-8, 8]) {
    box(2.5, 0.16, 0.75, x, 0.65, 5.5, palette.pale);
    box(0.37, 0.6, 0.57, x - 0.85, 0.3, 5.5, palette.stone);
    box(0.37, 0.6, 0.57, x + 0.85, 0.3, 5.5, palette.stone);
  }
  box(1.8, 0.13, 0.85, tableX, 0.98, tableZ, 0xaa7845);
  for (const dx of [-0.65, 0.65]) for (const dz of [-0.27, 0.27]) box(0.12, 0.88, 0.12, tableX + dx, 0.47, tableZ + dz, palette.wood);
  for (let i = 0; i < 5; i++) cylinder(0.11, 0.11, 0.035, tableX - .4 + (i % 3) * 0.26, 1.08 + Math.floor(i / 3) * 0.04, tableZ, palette.gold, 12);

  const leaves = [];
  const tree = (x, z, scale = 1) => {
    const root = new THREE.Group(); root.position.set(x, 0, z); root.scale.setScalar(scale); scene.add(root);
    const trunk = cylinder(0.22, 0.43, 3.7, 0, 1.85, 0, palette.wood, 9, root); trunk.rotation.z = 0.09;
    for (let i = 0; i < 5; i++) {
      const a = i * 1.26;
      const branch = cylinder(0.07, 0.16, 1.85, Math.cos(a) * 0.6, 3.15, Math.sin(a) * 0.6, palette.wood, 7, root);
      branch.rotation.z = Math.sin(a) * 0.75; branch.rotation.x = Math.cos(a) * 0.75;
    }
    for (let i = 0; i < 17; i++) {
      const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 1.8;
      const leaf = mesh(new THREE.IcosahedronGeometry(0.8 + random() * 0.55, 1), mat([0x739749, 0x4e783f, 0x8aa94c, 0x567e40][i % 4]), Math.cos(a) * r, 3.65 + random() * 1.1, Math.sin(a) * r, root);
      leaf.scale.y = 0.63; leaves.push({ mesh: leaf, base: leaf.rotation.z, phase: random() * 6 });
    }
    cylinder(1.1, 1.25, 0.35, 0, 0.17, 0, palette.edge, 16, root);
    cylinder(1.0, 1, 0.06, 0, 0.37, 0, 0x75684b, 16, root);
  };
  tree(-9.3, -0.2, 1.12); tree(9.4, 3.0, 0.85);
  // Terracotta pots and broad-leaf plants keep the silhouette simple.
  const potLocations = [[-10, -6], [10, -6], [-4.1, -7.7], [4.1, -7.7], [-10, 7.8], [10, 7.8]];
  for (const [x, z] of potLocations) {
    cylinder(0.45, 0.29, 0.7, x, 0.35, z, 0xb77349, 12);
    cylinder(0.48, 0.48, 0.1, x, 0.69, z, 0xca8a59, 12);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const l = mesh(new THREE.SphereGeometry(0.32, 6, 4), mat(i % 2 ? 0x71894b : 0x91a65e), x + Math.cos(a) * 0.2, 0.9 + random() * 0.3, z + Math.sin(a) * 0.2);
      l.scale.set(0.48, 1.9, 0.8); l.rotation.z = Math.cos(a) * 0.5; l.rotation.x = Math.sin(a) * 0.5;
    }
  }

  const sea = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: `uniform float uTime; varying vec2 vUv; void main(){ vUv=uv; vec3 p=position; p.z += sin(p.x*.5+uTime*.7)*.06+sin(p.y*.8+uTime)*.025; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.); }`,
    fragmentShader: `uniform float uTime; varying vec2 vUv; void main(){ float ripple=sin(vUv.y*610.+sin(vUv.x*180.+uTime)*2.+uTime*1.8); float light=smoothstep(.86,1.,ripple)*.2; vec3 c=mix(vec3(.10,.51,.53),vec3(.23,.70,.66),vUv.y)+light; gl_FragColor=vec4(c,1.); #include <tonemapping_fragment>\n #include <colorspace_fragment> }`,
  });
  // Shader include directives must begin on a new line.
  sea.fragmentShader = sea.fragmentShader.replace(' #include', '\n#include');
  const seaMesh = mesh(new THREE.PlaneGeometry(180, 180, 55, 55), sea, 0, -0.53, -10);
  seaMesh.rotation.x = -Math.PI / 2; seaMesh.castShadow = false;
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * Math.PI * 2, r = 40 + random() * 35;
    const hill = mesh(new THREE.ConeGeometry(13 + random() * 14, 11 + random() * 13, 7), mat([0x8fb9ae, 0x7facac, 0xa3c4b1][i % 3]), Math.cos(a) * r, 1, Math.sin(a) * r - 15);
    hill.scale.z = 0.58; hill.castShadow = false;
  }
  const house = new THREE.Group(); house.position.set(-22, 1, -25); house.rotation.y = 0.3; scene.add(house);
  box(5, 4, 4, 0, 2, 0, 0xe8c99b, house);
  const roof = mesh(new THREE.ConeGeometry(4.2, 1.8, 4), mat(0xb77c51), 0, 4.8, 0, house); roof.rotation.y = Math.PI / 4;
  box(1.2, 2.7, 1.1, 0, 5.7, 0, 0xe9d3a5, house);
  const roof2 = mesh(new THREE.ConeGeometry(1.15, 0.8, 4), mat(0xb77c51), 0, 7.4, 0, house); roof2.rotation.y = Math.PI / 4;

  const obstacles = [
    { type: 'circle', x: fountainX, z: fountainZ, radius: 1.32 },
    { type: 'circle', x: -9.3, z: -0.2, radius: 1.4 },
    { type: 'circle', x: 9.4, z: 3, radius: 1.1 },
    { type: 'box', minX: tableX-1, maxX: tableX+1, minZ: tableZ-.5, maxZ: tableZ+.5 },
    ...[-8, 8].map(x => ({ type: 'box', minX: x - 1.3, maxX: x + 1.3, minZ: 5.0, maxZ: 6.0 })),
    ...[[-6.3, -3.5], [0, -6.3], [6.3, -3.5]].map(([x, z]) => ({ type: 'circle', x, z, radius: 0.9 })),
    ...potLocations.map(([x, z]) => ({ type: 'circle', x, z, radius: 0.51 })),
  ];
  const river = quiz ? courtyardRiver(scene, quiz.progress, quiz.segments) : null;
  batchStatic(scene, new Set([...leaves.map(l => l.mesh), ...droplets, ...(river?.bridges.flatMap(b=>[...b.exclude]) || [])]));
  return {
    obstacles, river, approaches: river?.approaches,
    onLand(x,z) { return river?.onLand(x,z) ?? true; },
    canWalk(x,z) { return river?.canWalk(x,z) ?? true; },
    update(time, reduced, count = quiz?.progress || 0, dt = 0) {
      river?.update(time,count,dt,reduced);
      sea.uniforms.uTime.value = reduced ? 0 : time;
      if (!reduced) {
        leaves.forEach(l => { l.mesh.rotation.z = l.base + Math.sin(time * 0.7 + l.phase) * 0.025; });
        droplets.forEach((d, i) => {
          const t = (time * 0.65 + i / droplets.length) % 1;
          const a = i * 2.4;
          d.position.set(fountainX + Math.cos(a) * t * 0.5, 1.19 - t * t * 0.67, fountainZ + Math.sin(a) * t * 0.5);
        });
      }
    },
  };
}
