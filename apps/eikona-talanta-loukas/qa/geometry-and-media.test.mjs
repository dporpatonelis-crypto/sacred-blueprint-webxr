import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allowedPosition } from '../src/navigation.js';
import { frameAt, frameRect, revealProgress } from '../src/animation-timing.js';
import * as THREE from 'three';
import { lesson } from '../src/session.js';
import { buildHub } from '../src/hub-world.js';
import { buildCourtyard } from '../src/world.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const worlds = JSON.parse(fs.readFileSync(path.join(root, 'src/data/worlds.json')));
const world = worlds.talanta;

test('courtyard boundary and circle/box obstacles reject penetration but permit clear paths', () => {
  const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
  const obstacles = [{ type: 'circle', x: 0, z: 0, radius: 1 }, { type: 'box', minX: 3, maxX: 4, minZ: 2, maxZ: 4 }];
  assert.equal(allowedPosition(0, 5, bounds, obstacles), true);
  assert.equal(allowedPosition(0, 1.2, bounds, obstacles), false);
  assert.equal(allowedPosition(0, 1.5, bounds, obstacles), true);
  assert.equal(allowedPosition(3.5, 2.1, bounds, obstacles), false);
  assert.equal(allowedPosition(9.9, 0, bounds, obstacles), false);
  for (const station of world.stations) assert.equal(allowedPosition(...station.landing, world.bounds, obstacles), true);
});

test('the hub bridges, spawn and landing points stay on navigable land and water is blocked', () => {
  const hub = worlds.main, scene = new THREE.Scene(), environment = buildHub(scene, hub);
  const allowed = (x,z) => allowedPosition(x,z,hub.bounds,environment.obstacles,.34,hub.walkable);
  for (const point of [hub.spawn,...hub.stations.map(s=>s.landing)]) assert.equal(allowed(...point), true, String(point));
  for (const p of hub.walkable.paths) for (const t of [.2,.3,.5,.7,.8]) {
    const x=p.from[0]+(p.to[0]-p.from[0])*t, z=p.from[1]+(p.to[1]-p.from[1])*t;
    assert.equal(allowed(x,z), true, `bridge ${x},${z}`);
  }
  assert.equal(allowed(0,0), false); assert.equal(allowed(-15,7), false);
  const movingBridgeMeshes = new Set(environment.bridges.flatMap(b => [...b.exclude]));
  let meshes=0;scene.traverse(o=>{if(o.isMesh && !movingBridgeMeshes.has(o))meshes++;});
  assert.ok(meshes < 50, 'static landscape details are batched for rendering');
});

test('each original station maps to one world position and existing plane artwork', () => {
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/media/manifest.json')));
  assert.deepEqual(Object.keys(worlds).sort(),lesson.scenes.map(s=>s.id).sort());
  for(const data of lesson.scenes){
    const config=worlds[data.id];
    assert.deepEqual(config.stations.map(s=>s.id),data.stations.map(s=>s.id));
    for(const station of config.stations) assert.ok(manifest.animations[station.asset],station.asset);
  }
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_entries','stream=width,height','-of','json',path.join(root,'public',worlds.main.skybox)],{encoding:'utf8'}));
  assert.equal(probe.streams[0].width,probe.streams[0].height*2,'equirectangular image is exactly 2:1');
});

test('focus batching preserves navigation and leaves moving scenery animatable', () => {
  const scene = new THREE.Scene(), environment = buildCourtyard(scene, 'eikona');
  for (const station of worlds.eikona.stations) assert.equal(allowedPosition(...station.landing, worlds.eikona.bounds, environment.obstacles),true);
  const before = new Map(); scene.traverse(o => {if(o.isMesh) before.set(o.uuid, o.position.clone().toArray().join(',')+o.rotation.toArray().join(','));});
  assert.ok(before.size < 100, 'fixed props are batched while dynamic props stay separate');
  environment.update(1, false);
  let changed = 0; scene.traverse(o => {if(o.isMesh && before.get(o.uuid)!==o.position.toArray().join(',')+o.rotation.toArray().join(',')) changed++;});
  assert.ok(changed >= 12, 'fountain droplets and leaves still animate');
});

test('animation clock honors individual frame durations, exact boundaries, pause and loop wrap', () => {
  const timing = [100, 200, 300];
  assert.equal(frameAt(0, timing), 0);
  assert.equal(frameAt(99, timing), 0);
  assert.equal(frameAt(100, timing), 1);
  assert.equal(frameAt(300, timing), 2);
  assert.equal(frameAt(599, timing), 2);
  assert.equal(frameAt(600, timing), 0);
  assert.equal(frameAt(700, timing), 1);
  assert.equal(frameAt(-1, timing), 2);
});

test('reveal stays within the curve even when the RAF timestamp precedes the click', () => {
  const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0),new THREE.Vector3(1,1,0),new THREE.Vector3(2,0,0)]);
  for (const time of [99.5, 100, 400, 1150, 2000]) {
    const t = revealProgress(time, 100);
    assert.ok(t >= 0 && t <= 1);
    assert.ok(curve.getPoint(t).toArray().every(Number.isFinite));
  }
  assert.equal(revealProgress(99.5, 100), 0);
  assert.equal(revealProgress(2000, 100), 1);
});

test('every GIF has genuinely different frames, transparency and the atlas timing matches the encoded file', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/media/manifest.json')));
  assert.equal(Object.keys(manifest.animations).length, 16);
  assert.equal(Object.values(manifest.animations).filter(a=>a.gif).length, 12);
  for (const animation of Object.values(manifest.animations)) {
    assert.equal(animation.frameCount, animation.gif ? 8 : 1);
    assert.equal(animation.durations.length, animation.frameCount);
    assert.equal(animation.durationMs, animation.durations.reduce((a, b) => a + b, 0));
    if (animation.gif) {
    const gif = path.join(root, animation.gif);
    const probe = JSON.parse(execFileSync('ffprobe', ['-v','error','-count_frames','-show_entries','stream=duration,nb_read_frames','-of','json',gif], { encoding: 'utf8' }));
    assert.equal(Number(probe.streams[0].nb_read_frames), animation.frameCount);
    assert.ok(Math.abs(Number(probe.streams[0].duration) * 1000 - animation.durationMs) <= 20);
    const hashes = execFileSync('ffmpeg', ['-v','error','-i',gif,'-f','framemd5','-'], { encoding: 'utf8' }).split('\n').filter(line => line && !line.startsWith('#')).map(line => line.split(',').at(-1).trim());
    assert.ok(new Set(hashes).size >= 2, 'a renamed or repeated still is not an animation');
    const gifAlpha = execFileSync('ffmpeg', ['-v','error','-i',gif,'-vf','alphaextract','-frames:v','1','-f','rawvideo','-pix_fmt','gray','-']);
    assert.ok(gifAlpha.includes(0), 'the encoded GIF retains transparency');
    }
    const alpha = execFileSync('ffmpeg', ['-v','error','-i',path.join(root, 'public', animation.atlas),'-vf','alphaextract','-frames:v','1','-f','rawvideo','-pix_fmt','gray','-'], { maxBuffer: 32 * 1024 * 1024 });
    assert.ok(alpha.includes(0), 'cutout needs transparent pixels');
    assert.ok(alpha.includes(254) || alpha.includes(255), 'cutout also needs solid subject pixels');
    for (let i = 0; i < animation.frameCount; i++) {
      const [u, v, w, h] = frameRect(i, animation);
      assert.ok(u > 0 && v > 0 && u + w < 1 && v + h < 1, 'UVs stay within the padded atlas');
    }
  }
});

test('the imported source lesson and original engine remain byte-identical', () => {
  const checksums = JSON.parse(fs.readFileSync(path.join(root, 'qa/source-baseline.json')));
  for (const [file, expected] of Object.entries(checksums)) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'), expected, file);
  }
});
