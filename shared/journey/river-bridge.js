import * as THREE from 'three';
import { batchStatic } from './batch-static.js';

export function risingBridge(scene, { from, to, width = 2.16, segments = 3, inset = 0, progress = 0 }) {
  const a = new THREE.Vector2(...from), b = new THREE.Vector2(...to);
  const direction = b.clone().sub(a).normalize(), center = a.clone().add(b).multiplyScalar(.5);
  const length = Math.max(.5, a.distanceTo(b) - inset * 2), part = length / segments;
  const root = new THREE.Group(); root.position.set(center.x, 0, center.y);
  root.rotation.y = Math.atan2(direction.x, direction.y); scene.add(root);
  const exclude = new Set(), panels = [];
  const stone = new THREE.MeshStandardMaterial({ color: 0xddc38c, roughness: .86 });
  const edge = new THREE.MeshStandardMaterial({ color: 0xb69257, roughness: .83 });
  const add = (geometry, material, x, y, z, parent) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(x, y, z);
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  };
  for (let i = 0; i < segments; i++) {
    const panel = new THREE.Group(), parts = new THREE.Scene();
    panel.position.z = -length / 2 + (i + .5) * part; root.add(panel);
    add(new THREE.BoxGeometry(width, .17, part - .035), stone, 0, 0, 0, parts);
    for (let j = 0; j < Math.max(2, Math.ceil(part / .4)); j++) {
      const z = -part / 2 + (j + .5) * part / Math.max(2, Math.ceil(part / .4));
      add(new THREE.BoxGeometry(width, .025, .025), edge, 0, .098, z, parts);
    }
    for (const x of [-width / 2 + .08, width / 2 - .08]) {
      add(new THREE.BoxGeometry(.12, .12, part - .035), stone, x, .73, 0, parts);
      for (const z of [-part / 2 + .1, part / 2 - .1]) add(new THREE.BoxGeometry(.12, .66, .12), edge, x, .35, z, parts);
    }
    batchStatic(parts);
    for (const mesh of [...parts.children]) { panel.add(mesh); exclude.add(mesh); }
    panels.push({ root: panel, value: i < progress ? 1 : 0 });
  }
  function update(count, dt = 0, reduced = false) {
    panels.forEach((panel, i) => {
      panel.value = reduced ? Number(i < count) : THREE.MathUtils.damp(panel.value, Number(i < count), 3.3, dt);
      panel.root.position.y = THREE.MathUtils.lerp(-1.12, .18, panel.value);
      panel.root.rotation.x = (1 - panel.value) * 1.13;
    });
  }
  update(progress, 0, true);
  return {
    root, panels, exclude, update,
    from: [center.x-direction.x*length/2,center.y-direction.y*length/2],
    to: [center.x+direction.x*length/2,center.y+direction.y*length/2],
    allows(x, z, radius = .34) {
      const dx = x - center.x, dz = z - center.y;
      const along = dx * direction.x + dz * direction.y + length / 2;
      const across = dx * direction.y - dz * direction.x;
      if (Math.abs(across) > width / 2 - radius || along < -radius || along > length + radius) return false;
      const raised = panels.filter(p => p.value > .97).length;
      return raised === segments || along + radius < raised * part;
    },
  };
}

// Use the real incoming deck and destination bank instead of an unrelated
// south-facing landing point. The two regions overlap at the end of the deck.
export function stationApproach(bridge, onDestinationBank) {
  const from = new THREE.Vector2(...bridge.from), to = new THREE.Vector2(...bridge.to);
  const direction = to.clone().sub(from).normalize();
  const retreat = Math.min(1.8,from.distanceTo(to)-.15);
  return {
    quizPosition: [to.x+direction.x*.65+direction.y*.45,to.y+direction.y*.65-direction.x*.45],
    viewpoint: [to.x-direction.x*retreat,to.y-direction.y*retreat],
    contains(x,z) {
      if (!bridge.panels.every(panel=>panel.value>.97)) return false;
      return bridge.allows(x,z,.2) || onDestinationBank(x,z);
    },
  };
}

export function courtyardRiver(scene, progress = 0, segments = 3) {
  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `uniform float uTime;varying vec2 vUv;void main(){
      float a=sin(vUv.x*140.-uTime*2.+sin(vUv.y*18.));
      float light=smoothstep(.82,1.,a)*.16;
      gl_FragColor=vec4(vec3(.055,.49,.56)+light,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
  });
  for (const [width,length,x,z] of [[23,2,0,3],[1.1,12.5,-3.15,-4.25],[1.1,12.5,3.15,-4.25]]) {
    const water = new THREE.Mesh(new THREE.PlaneGeometry(width,length),material);
    water.rotation.x=-Math.PI/2; water.position.set(x,-.075,z); scene.add(water);
  }
  const bank = new THREE.MeshStandardMaterial({ color: 0x9f9770, roughness: .95 });
  for (const z of [1.97,4.03]) for (const x of [-8.9,0,8.9]) {
    const stones = new THREE.Mesh(new THREE.BoxGeometry(x === 0 ? 8 : 3,.17,.16),bank); stones.position.set(x,-.01,z); scene.add(stones);
  }
  const routes = [
    {from:[-5.5,4.4],to:[-5.5,1.6]},
    {from:[-4.05,.8],to:[-2.25,.8]},
    {from:[2.25,.8],to:[4.05,.8]},
    {from:[5.5,1.6],to:[5.5,4.4]},
  ];
  const bridges = routes.map((route,index)=>risingBridge(scene,{...route,width:2,segments:1,progress:index===0 || progress>=index ? 1 : 0}));
  const onLand = (x,z) => !((z>2-.34 && z<4+.34) || (z<2+.34 && Math.abs(Math.abs(x)-3.15)<.55+.34));
  const banks = [
    (x,z)=>x>=-10.5 && x<=-4.04 && z>=-8 && z<=1.66,
    (x,z)=>Math.abs(x)<=2.26 && z>=-8 && z<=1.66,
    (x,z)=>x>=4.04 && x<=10.5 && z>=-8 && z<=1.66,
  ];
  const approaches = banks.map((bank,index)=>stationApproach(bridges[index],bank));
  return {
    bridges, onLand, approaches,
    update(time, count, dt, reduced) {
      material.uniforms.uTime.value = reduced ? 0 : time;
      bridges.forEach((bridge,index)=>bridge.update(index===0 || count>=index ? 1 : 0,dt,reduced));
    },
    canWalk(x, z) {
      return onLand(x,z) || bridges.some(bridge=>bridge.allows(x,z));
    },
  };
}
