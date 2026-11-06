import * as THREE from 'three';
import { batchStatic } from './batch-static.js';

export function buildHub(scene, config) {
  scene.background = new THREE.Color(0xb9e2ec);
  scene.fog = new THREE.Fog(0xc4e4e4, 42, 130);
  scene.add(new THREE.HemisphereLight(0xe5f4ff, 0x8c9b52, 2.4));
  const sun = new THREE.DirectionalLight(0xffeed0, 2.4);
  sun.position.set(-10, 18, 9); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22 });
  sun.shadow.normalBias = 0.06; scene.add(sun);
  const materials = new Map();
  const mat = color => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.95, flatShading: true }));
    return materials.get(color);
  };
  const add = (geometry, color, x, y, z, parent = scene) => {
    const m = new THREE.Mesh(geometry, mat(color)); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  let seed = 1937;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const centers = [config.hubCenter || config.spawn, ...config.stations.map(s => s.position)];
  const obstacles = [];
  centers.forEach(([x, z], index) => {
    const radius = index ? 4.0 : 4.1;
    add(new THREE.CylinderGeometry(radius - 0.05, radius + 0.32, 0.75, 30), 0x948b61, x, -0.30, z);
    add(new THREE.CylinderGeometry(radius, radius, 0.15, 48), index ? 0x80a94e : 0xc6b784, x, 0.075, z);
    if (index) add(new THREE.CylinderGeometry(1.57, 1.67, 0.11, 32), 0xe2d1a5, x, 0.205, z);
    // Stone shore and low flowering shrubs; the image provides the distant detail.
    for (let i = 0; i < 23; i++) {
      const a = i / 23 * Math.PI * 2, r = radius - 0.12;
      const rock = add(new THREE.IcosahedronGeometry(0.29 + random() * 0.18, 0), [0xb6a47d, 0xcabd92, 0x9c9576][i % 3], x + Math.cos(a) * r, -0.02, z + Math.sin(a) * r);
      rock.scale.set(1.4, 0.8, 1.0);
    }
    for (let i = 0; i < 12; i++) {
      const a = random() * Math.PI * 2, r = 2.7 + random() * 0.7;
      const bx = x + Math.cos(a) * r, bz = z + Math.sin(a) * r;
      const shrub = add(new THREE.IcosahedronGeometry(0.30 + random() * 0.2, 1), [0x527d3e, 0x6f9945, 0x8daa4c][i % 3], bx, 0.37, bz);
      shrub.scale.y = 0.7;
      for (let j = 0; j < 3; j++) add(new THREE.SphereGeometry(0.06, 5, 4), [0xf5d96a, 0xf4c99c, 0xe6e7a0][j], bx + (random() - 0.5) * 0.35, 0.68, bz + (random() - 0.5) * 0.35);
    }
  });
  // The five real bridges follow the same corridors as the collision model.
  for (const path of config.walkable.paths) {
    const a = new THREE.Vector3(path.from[0], 0, path.from[1]), b = new THREE.Vector3(path.to[0], 0, path.to[1]);
    const direction = b.clone().sub(a), fullLength = direction.length(); direction.normalize();
    const length = Math.max(0.5, fullLength - 5.8);
    const root = new THREE.Group(); root.position.copy(a.clone().add(b).multiplyScalar(0.5)); root.rotation.y = Math.atan2(direction.x, direction.z); scene.add(root);
    add(new THREE.BoxGeometry(2.16, 0.16, length), 0xd9c28f, 0, 0.18, 0, root);
    for (let i = 0; i <= Math.ceil(length / 0.8); i++) {
      const z = -length / 2 + i * length / Math.ceil(length / 0.8);
      add(new THREE.BoxGeometry(2.18, 0.025, 0.04), 0xb7a478, 0, 0.271, z, root);
    }
    for (const x of [-1.08, 1.08]) {
      add(new THREE.BoxGeometry(0.18, 0.22, length + 0.1), 0xe8d4a7, x, 0.96, 0, root);
      const posts = Math.max(2, Math.ceil(length / 1.4));
      for (let i = 0; i <= posts; i++) add(new THREE.BoxGeometry(0.22, 0.81, 0.22), 0xd4b47a, x, 0.6, -length / 2 + i / posts * length, root);
      const arch = add(new THREE.TorusGeometry(length / 2, 0.17, 6, 24, Math.PI), 0xbfa16e, x, -0.8, 0, root);
      arch.rotation.y = Math.PI / 2; arch.scale.y = 0.15;
    }
  }
  // Olive trees sit away from all landing points and the learning tableaux.
  for (const [x, z] of [[-12.5, -4.4], [-5.7, -13.2], [6.8, -13.3], [13.4, -4.8], [-2.4, 9.0]]) {
    add(new THREE.CylinderGeometry(0.13, 0.3, 2.6, 8), 0x80633e, x, 1.35, z);
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * Math.PI * 2;
      const leaf = add(new THREE.IcosahedronGeometry(0.72, 1), [0x6f984f, 0x8da85d, 0x5b8546][i % 3], x + Math.cos(a) * 0.72, 2.8 + random() * 0.38, z + Math.sin(a) * 0.72);
      leaf.scale.y = 0.65;
    }
    obstacles.push({ type: 'circle', x, z, radius: 0.38 });
  }
  for (const station of config.stations) obstacles.push({ type: 'circle', x: station.position[0], z: station.position[1], radius: 0.72 });
  // A stone compass anchors the starting island without obscuring the horizon.
  add(new THREE.CylinderGeometry(1.0, 1.05, 0.08, 48), 0xe6d8b0, 0, 0.19, 7.5);
  const compass = add(new THREE.TorusGeometry(0.8, 0.025, 6, 48), 0xc8a961, 0, 0.24, 7.5); compass.rotation.x = Math.PI / 2;
  const water = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: 'uniform float uTime;varying vec2 vUv;void main(){float a=sin(vUv.y*1050.+sin(vUv.x*420.+uTime*.4)*2.+uTime);float b=sin(vUv.x*720.-vUv.y*630.+uTime*.6);float sparkle=smoothstep(.93,1.,a)*.13+smoothstep(.97,1.,b)*.07;vec3 c=vec3(.07,.56,.62)+sparkle*vec3(.8,.9,.5);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}',
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(180, 180), water); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.48; scene.add(sea);
  // The landscape is static: batch by material to keep flowers and bridge
  // detail inexpensive on both a desktop GPU and a headset.
  batchStatic(scene);
  return { obstacles, update(time, reduced) { water.uniforms.uTime.value = reduced ? 0 : time; } };
}
