import * as THREE from 'three';
import { frameAt, frameRect } from './animation-timing.js';

const vertexShader = `varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const fragmentShader = `
uniform sampler2D uAtlas;
uniform vec4 uRect;
uniform float uReveal;
uniform float uKeyEnabled;
uniform vec3 uKey;
varying vec2 vUv;
void main(){
  vec4 c=texture2D(uAtlas,uRect.xy+vUv*uRect.zw);
  float key=1.;
  if(uKeyEnabled>.5) key=smoothstep(.12,.36,distance(c.rgb,uKey));
  float alpha=c.a*key;
  if(alpha<.12) discard;
  float grey=dot(c.rgb,vec3(.2126,.7152,.0722));
  vec3 muted=vec3(.10,.20,.17)+grey*vec3(.25,.30,.27);
  vec3 color=mix(muted,c.rgb,uReveal);
  gl_FragColor=vec4(color,alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export async function loadActors(scene, world, base, onProgress) {
  const response = await fetch(`${base}media/manifest.json`);
  if (!response.ok) throw new Error('Δεν βρέθηκαν τα αρχεία κίνησης.');
  const manifest = await response.json();
  const loader = new THREE.TextureLoader();
  const actors = new Map();
  let loaded = 0;
  for (const station of world.stations) {
    const animation = manifest.animations[station.asset];
    if (!animation) throw new Error('Λείπει η εικόνα: ' + station.asset);
    let texture;
    try { texture = await loader.loadAsync(`${base}${animation.atlas}`); }
    catch { throw new Error('Δεν φορτώθηκε η εικόνα «' + animation.atlas + '».'); }
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false;
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uAtlas: { value: texture }, uRect: { value: new THREE.Vector4(...frameRect(0, animation)) },
        uReveal: { value: 0.16 }, uKeyEnabled: { value: animation.chromaKey ? 1 : 0 },
        uKey: { value: new THREE.Color(animation.chromaKey || '#ff00ff') },
      },
      vertexShader, fragmentShader, transparent: true, depthWrite: true, side: THREE.DoubleSide,
    });
    const group = new THREE.Group(); group.position.set(station.position[0], 0.24, station.position[1]); scene.add(group);
    const height = station.height, width = height * animation.frameWidth / animation.frameHeight;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    plane.position.y = height / 2; plane.userData.action = { type: 'target', id: station.id }; group.add(plane);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(width * 0.35, 32), new THREE.MeshBasicMaterial({ color: 0x2c3827, transparent: true, opacity: 0.14, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.scale.y = 0.4; shadow.position.set(station.position[0], 0.245, station.position[1]); scene.add(shadow);
    actors.set(station.id, { group, plane, material, animation, frame: -1, value: 0.16 });
    onProgress?.(++loaded / world.stations.length);
  }
  return {
    actors, manifest,
    pickables: [...actors.values()].map(actor => actor.plane),
    update(timeMs, cameraPosition, session, reduced, dt) {
      for (const [id, actor] of actors) {
        // A cylindrical billboard stays upright and retains a fixed foot point.
        actor.group.lookAt(cameraPosition.x, actor.group.position.y, cameraPosition.z);
        const solved = session.solved(id);
        const frame = !reduced && solved ? frameAt(timeMs, actor.animation.durations) : 0;
        if (frame !== actor.frame) {
          actor.material.uniforms.uRect.value.set(...frameRect(frame, actor.animation)); actor.frame = frame;
        }
        const goal = solved ? 1 : session.current?.id === id ? (world.kind === 'hub' ? 0.75 : 0.42) : (world.kind === 'hub' ? 0.5 : 0.16);
        actor.value = reduced ? goal : THREE.MathUtils.damp(actor.value, goal, 3.7, dt);
        actor.material.uniforms.uReveal.value = actor.value;
      }
    },
  };
}
