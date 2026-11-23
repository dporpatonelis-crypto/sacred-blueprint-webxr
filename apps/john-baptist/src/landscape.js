import * as THREE from 'three';
import { panorama } from '../../../shared/journey/panorama.js';

const nearBank = x => -6.75 + .65 * Math.sin(x * .19) + .35 * Math.sin(x * .43);
const farBank = x => nearBank(x) - 5.8 - 1.1 * Math.cos(x * .14);

function makeRibbon(leftEdge, rightEdge, elevation, fade = [1, 1]) {
  const positions = [], indices = [], uv = [];
  const colors = [];
  for (let i = 0; i <= 80; i++) {
    const x = i - 40;
    positions.push(x, elevation, leftEdge(x), x, elevation, rightEdge(x));
    uv.push(i / 80, 0, i / 80, 1);
    const sides = 1 - THREE.MathUtils.smoothstep(Math.abs(x), 24, 40);
    colors.push(1, 1, 1, sides * fade[0], 1, 1, 1, sides * fade[1]);
    if (i) {
      const index = i * 2;
      indices.push(index - 2, index - 1, index, index - 1, index + 1, index);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function groundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c5a370';
  ctx.fillRect(0, 0, 256, 256);
  let seed = 341;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pigments = ['#b28e61', '#d3b280', '#a9885f', '#c4a172', '#dec395'];
  for (let i = 0; i < 5200; i++) {
    ctx.globalAlpha = .10 + rand() * .23;
    ctx.fillStyle = pigments[i % pigments.length];
    ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 4, 1 + rand() * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(54, 15);
  texture.anisotropy = 4;
  return texture;
}

const riverVertex = /* glsl */ `
  varying vec2 positionOnRiver;
  varying vec2 channel;
  void main() {
    positionOnRiver = position.xz;
    channel = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const riverFragment = /* glsl */ `
  uniform float time;
  varying vec2 positionOnRiver;
  varying vec2 channel;
  void main() {
    vec2 p = positionOnRiver;
    float wave = sin(p.x * 3.1 + p.y * 10.8 - time * 1.35);
    float crossing = sin(p.x * 4.7 - p.y * 6.15 - time * .8);
    float broad = sin(p.x * 1.39 - p.y * 3.2 - time * .55);
    float glint = pow(max(0., .52 * wave + .32 * crossing + .16 * broad), 6.);
    float shallows = 1. - smoothstep(0., .2, min(channel.y, 1. - channel.y));
    vec3 water = mix(vec3(.079, .27, .235), vec3(.20, .41, .32), broad * .5 + .5);
    water = mix(water, vec3(.37, .36, .20), shallows * .58);
    water += vec3(.42, .39, .26) * glint;
    gl_FragColor = vec4(water, 1.);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function bankDetails(scene) {
  let seed = 653;
  const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const pose = new THREE.Object3D();
  const rock = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1),
    new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 156);
  const rockColors = [0xceb590, 0xbb9d76, 0xe1c79b, 0x9e8467, 0xd9c5ac];
  for (let i = 0; i < rock.count; i++) {
    const x = -28 + rand() * 56, z = nearBank(x) + (rand() - .43) * 1.6;
    const size = .10 + Math.pow(rand(), 2) * .67;
    pose.position.set(x, .015, i < 128 ? z : farBank(x) - rand() * 1.15);
    pose.rotation.set(rand() * .55, rand() * Math.PI * 2, rand() * .45);
    pose.scale.set(size, size * (.38 + rand() * .26), size * (.69 + rand() * .27));
    pose.updateMatrix();
    rock.setMatrixAt(i, pose.matrix);
    rock.setColorAt(i, new THREE.Color(rockColors[i % rockColors.length]));
  }
  scene.add(rock);
  const boulders = new THREE.IcosahedronGeometry(1, 2);
  const boulderMaterial = new THREE.MeshStandardMaterial({ color: 0xc7b492, roughness: .98, flatShading: true });
  for (const [x, z, width, height, depth] of [
    [-2.64, .58, .72, .27, .41], [-3.19, 1.23, .33, .14, .26], [3.11, .08, .53, .28, .34],
    [3.62, .45, .30, .15, .28], [-5.82, -3.9, .85, .36, .49], [5.55, -4.32, .73, .26, .60]
  ]) {
    const mesh = new THREE.Mesh(boulders, boulderMaterial);
    mesh.position.set(x, .04, z);
    mesh.scale.set(width, height, depth);
    mesh.rotation.y = rand() * 6;
    scene.add(mesh);
  }
  const reed = new THREE.InstancedMesh(new THREE.CylinderGeometry(.003, .017, 1, 5),
    new THREE.MeshStandardMaterial({ roughness: .86 }), 360);
  const heads = new THREE.InstancedMesh(new THREE.CapsuleGeometry(.026, .13, 2, 6),
    new THREE.MeshStandardMaterial({ color: 0x756343, roughness: .93 }), reed.count);
  const tip = new THREE.Vector3();
  const greens = [0x65794b, 0x7e8752, 0x566c4d, 0x939052];
  for (let bed = 0; bed < 36; bed++) {
    const x = -25 + rand() * 50;
    const baseZ = bed < 29 ? nearBank(x) + .52 : farBank(x) - .12;
    for (let stem = 0; stem < 10; stem++) {
      const i = bed * 10 + stem, height = .34 + rand() * .78;
      pose.position.set(x + (rand() - .5) * 1.15, height / 2, baseZ + (rand() - .5) * .83);
      pose.rotation.set((rand() - .5) * .43, rand() * Math.PI, (rand() - .5) * .43);
      pose.scale.set(1, height, 1);
      pose.updateMatrix();
      reed.setMatrixAt(i, pose.matrix);
      reed.setColorAt(i, new THREE.Color(greens[i % greens.length]));
      tip.set(0, .49, 0).applyMatrix4(pose.matrix);
      pose.position.copy(tip);
      pose.scale.set(stem % 3 ? .001 : 1, stem % 3 ? .001 : .8 + rand() * .35, stem % 3 ? .001 : 1);
      pose.updateMatrix();
      heads.setMatrixAt(i, pose.matrix);
    }
  }
  scene.add(reed, heads);
}

export function makeLandscape(scene, sky) {
  scene.add(panorama(sky));
  const sand = groundTexture();
  const ground = new THREE.MeshStandardMaterial({ map: sand, roughness: 1, side: THREE.DoubleSide });
  const farGround = new THREE.MeshStandardMaterial({
    map: sand, roughness: 1, side: THREE.DoubleSide, vertexColors: true, transparent: true
  });
  scene.add(new THREE.Mesh(makeRibbon(nearBank, () => 24, -.015), ground));
  scene.add(new THREE.Mesh(makeRibbon(() => -36, farBank, -.031, [0, .86]), farGround));
  const river = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } }, vertexShader: riverVertex, fragmentShader: riverFragment, side: THREE.DoubleSide
  });
  scene.add(new THREE.Mesh(makeRibbon(farBank, nearBank, -.053), river));
  const skyLight = new THREE.HemisphereLight(0xffedcb, 0xa08764, 2.15);
  const sun = new THREE.DirectionalLight(0xffdb9a, 2.3);
  sun.position.set(-10, 12, -13);
  scene.add(skyLight, sun);
  bankDetails(scene);
  return (dt, reduced) => { if (!reduced) river.uniforms.time.value += dt; };
}
