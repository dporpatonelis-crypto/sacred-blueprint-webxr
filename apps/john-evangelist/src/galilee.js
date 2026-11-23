import * as THREE from 'three';
import { panorama } from '../../../shared/journey/panorama.js';

const shore = x => -7.32 + .48 * Math.cos(x * .21) + .31 * Math.sin(x * .38);
const waterline = -.072;

function shoreGeometry(front, back, y) {
  const positions = [], uv = [], indices = [];
  for (let i = 0; i <= 96; i++) {
    const x = i - 48;
    positions.push(x, y, front(x), x, y, back(x));
    uv.push(i / 96, 0, i / 96, 1);
    if (i) {
      const j = i * 2;
      indices.push(j - 2, j, j - 1, j - 1, j, j + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function randomGenerator(seed) {
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

function beachTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#beaa86';
  ctx.fillRect(0, 0, 256, 256);
  const rand = randomGenerator(418);
  const pigments = ['#e4d0a9', '#a99577', '#8e8066', '#d1c098', '#aca17f'];
  for (let i = 0; i < 3800; i++) {
    ctx.globalAlpha = .16 + rand() * .26;
    ctx.fillStyle = pigments[i % pigments.length];
    ctx.fillRect(rand() * 256, rand() * 256, 1 + rand() * 3, 1 + rand() * 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(52, 18);
  texture.anisotropy = 4;
  return texture;
}

function makeWater() {
  return new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    side: THREE.DoubleSide,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec2 lakePosition;
      varying vec2 bankPosition;
      void main() {
        lakePosition = position.xz;
        bankPosition = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float time;
      varying vec2 lakePosition;
      varying vec2 bankPosition;
      void main() {
        vec2 p = lakePosition;
        float wave = sin(p.x * 1.65 + p.y * 11.7 - time * 1.9);
        float crossWave = sin(-p.x * 4.0 + p.y * 7.1 - time * 1.16);
        float slow = .62 * sin(p.x * .38 + p.y * 1.43 - time * .58)
          + .38 * sin(p.x * .77 - p.y * .91 - time * .36);
        float shimmer = pow(max(0., .53 * wave + .28 * crossWave + .19 * slow), 6.);
        float shallows = 1. - smoothstep(.002, .09, bankPosition.y);
        vec3 color = mix(vec3(.072, .183, .347), vec3(.117, .263, .433), slow * .5 + .5);
        color = mix(color, vec3(.34, .42, .35), shallows * .77);
        float reflectedLight = .23 + .77 * exp(-pow((p.x - 3.3) * .156, 2.));
        color += vec3(.37, .30, .18) * shimmer * reflectedLight;
        float falloff = 1. - smoothstep(.32, 1., bankPosition.y);
        float sides = smoothstep(0., .14, min(bankPosition.x, 1. - bankPosition.x));
        gl_FragColor = vec4(color, falloff * sides);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `
  });
}

function shoreDetails(scene) {
  const rand = randomGenerator(845);
  const pose = new THREE.Object3D();
  const geometry = new THREE.IcosahedronGeometry(1, 1);
  const stones = new THREE.InstancedMesh(geometry,
    new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }), 138);
  const colors = [0x756c5c, 0x8e806a, 0xb9a78b, 0xcfc0a3, 0x918d84].map(hex => new THREE.Color(hex));
  for (let i = 0; i < stones.count; i++) {
    const x = -22 + rand() * 44;
    const z = shore(x) + (rand() - .19) * 1.18;
    const size = .07 + Math.pow(rand(), 2) * .53;
    pose.position.set(x, .018, z);
    pose.rotation.set(rand() * .54, rand() * Math.PI * 2, rand() * .44);
    pose.scale.set(size, size * (.25 + rand() * .47), size * (.71 + rand() * .32));
    pose.updateMatrix();
    stones.setMatrixAt(i, pose.matrix);
    stones.setColorAt(i, colors[i % colors.length]);
  }
  scene.add(stones);

  const boulderMaterial = new THREE.MeshStandardMaterial({ color: 0xb6ab96, roughness: 1, flatShading: true });
  for (const [x, z, size] of [[-4.02, .46, .75], [-4.49, .76, .31], [2.93, -.64, .54], [3.46, -.33, .29], [5.02, -4.71, .61], [-4.96, -4.91, .47]]) {
    const rock = new THREE.Mesh(geometry, boulderMaterial);
    rock.position.set(x, .014, z);
    rock.scale.set(size, size * .4, size * .65);
    rock.rotation.y = rand() * Math.PI;
    scene.add(rock);
  }

  const reeds = new THREE.InstancedMesh(new THREE.CylinderGeometry(.004, .011, 1, 4),
    new THREE.MeshStandardMaterial({ roughness: .88 }), 168);
  const reedColors = [0x65683e, 0x828354, 0x9f965c, 0x556645].map(hex => new THREE.Color(hex));
  for (let bed = 0; bed < 14; bed++) {
    const centerX = -17 + bed * 2.55;
    for (let stem = 0; stem < 12; stem++) {
      const i = bed * 12 + stem;
      const x = centerX + (rand() - .5) * 1.13;
      const height = .17 + rand() * .65;
      pose.position.set(x, height / 2, shore(x) + .20 + rand() * .40);
      pose.rotation.set((rand() - .5) * .5, 0, (rand() - .5) * .54);
      pose.scale.set(1, height, 1);
      pose.updateMatrix();
      reeds.setMatrixAt(i, pose.matrix);
      reeds.setColorAt(i, reedColors[i % reedColors.length]);
    }
  }
  scene.add(reeds);
}

const hullProfile = (angle, spread, height) => {
  const x = Math.cos(angle);
  return new THREE.Vector3(1.91 * x, height + .19 * Math.pow(Math.abs(x), 4), spread * Math.sin(angle));
};

function fishingBoat(scene) {
  const wood = new THREE.MeshStandardMaterial({ color: 0x855239, roughness: .85, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: 0xb78353, roughness: .88 });
  const floor = new THREE.MeshStandardMaterial({ color: 0x62463c, roughness: .95, side: THREE.DoubleSide });
  const boat = new THREE.Group();
  const segments = 40;
  const hull = [], indices = [];
  const profile = [[.17, -.22], [.42, -.13], [.66, .12], [.74, .37]];
  for (const [width, height] of profile) {
    for (let i = 0; i < segments; i++) hull.push(...hullProfile(i * 2 * Math.PI / segments, width, height));
  }
  for (let row = 1; row < profile.length; row++) {
    for (let i = 0; i < segments; i++) {
      const a = (row - 1) * segments + i;
      const b = (row - 1) * segments + (i + 1) % segments;
      indices.push(a, a + segments, b, b, a + segments, b + segments);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(hull, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  boat.add(new THREE.Mesh(geometry, wood));
  const edge = Array.from({ length: segments }, (_, i) => hullProfile(i * 2 * Math.PI / segments, .744, .375));
  const gunwale = new THREE.CatmullRomCurve3(edge, true);
  boat.add(new THREE.Mesh(new THREE.TubeGeometry(gunwale, 80, .038, 5, true), trim));
  const inside = new THREE.Mesh(new THREE.CircleGeometry(1, segments), floor);
  inside.rotation.x = -Math.PI / 2;
  inside.scale.set(1.63, .57, 1);
  inside.position.y = .114;
  boat.add(inside);
  for (const [x, width] of [[-.86, 1.25], [0, 1.43], [.86, 1.25]]) {
    const seat = new THREE.Mesh(new THREE.BoxGeometry(.24, .055, width), trim);
    seat.position.set(x, .31, 0);
    boat.add(seat);
  }

  const net = [];
  function meshPoint(i, j) {
    return new THREE.Vector3(-.57 + i * .10 + Math.sin(j * .8) * .036,
      .49 - j * .066 - Math.sin(i / 10 * Math.PI) * j * .010, .64 + j * .051);
  }
  for (let i = 0; i <= 11; i++) {
    for (let j = 0; j <= 7; j++) {
      if (i < 11) net.push(...meshPoint(i, j), ...meshPoint(i + 1, j));
      if (j < 7) net.push(...meshPoint(i, j), ...meshPoint(i, j + 1));
    }
  }
  const cords = new THREE.BufferGeometry();
  cords.setAttribute('position', new THREE.Float32BufferAttribute(net, 3));
  boat.add(new THREE.LineSegments(cords, new THREE.LineBasicMaterial({ color: 0xd7ba85 })));
  boat.position.set(-6.5, waterline, shore(-6.5) - .70);
  boat.rotation.y = -.34;
  scene.add(boat);
  return boat;
}

export function makeGalilee(scene, sky) {
  scene.add(panorama(sky, 1.76));
  const beach = new THREE.MeshStandardMaterial({ map: beachTexture(), roughness: 1, side: THREE.DoubleSide });
  scene.add(new THREE.Mesh(shoreGeometry(() => 27, shore, -.013), beach));
  const water = makeWater();
  scene.add(new THREE.Mesh(shoreGeometry(shore, () => -45, waterline), water));
  const light = new THREE.HemisphereLight(0xffeed5, 0xa99a7f, 2.28);
  const sun = new THREE.DirectionalLight(0xffdbab, 2.35);
  sun.position.set(11, 9, -14);
  scene.add(light, sun);
  shoreDetails(scene);
  const boat = fishingBoat(scene);
  return (dt, reduced) => {
    if (!reduced) water.uniforms.time.value += dt;
    const t = water.uniforms.time.value;
    boat.position.y = waterline + Math.sin(t * .85) * .018;
    boat.rotation.x = Math.cos(t * .53) * .025;
  };
}
