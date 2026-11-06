import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runMedia } from '../../../shared/node/media-cli.mjs';
import { validateWorldMedia } from '../../../scripts/media-catalog.mjs';
import worlds from '../src/data/worlds.json' with {type:'json'};
const root=fileURLToPath(new URL('../',import.meta.url));

test('all station textures and final-map illustrations are present in the runtime build',async()=>{
  assert.ok(await validateWorldMedia(root)>=25);
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/media/manifest.json')));
  assert.deepEqual(Object.keys(manifest.animations).sort(),Object.values(worlds).flatMap(w=>w.stations.map(s=>s.asset)).sort());
});

test('sixteen genuine transparent eight-frame GIFs have matching atlas timing and different keyframes',()=>{
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'public/media/manifest.json')));
  const animations=Object.values(manifest.animations);assert.equal(animations.length,20);assert.equal(animations.filter(a=>a.gif).length,16);
  for(const a of animations){
    assert.equal(a.frameCount,a.gif?8:1);assert.equal(a.durations.length,a.frameCount);assert.equal(a.durationMs,a.durations.reduce((s,d)=>s+d,0));
    const alpha=runMedia('ffmpeg',['-v','error','-i',path.join(root,'public',a.atlas),'-vf','alphaextract','-frames:v','1','-f','rawvideo','-pix_fmt','gray','-'],{encoding:null});
    assert.ok(alpha.some(v=>v<30),'background alpha must be transparent');assert.ok(alpha.some(v=>v>240),'subject must remain visible');
    if(!a.gif)continue;
    const gif=path.join(root,a.gif),probe=JSON.parse(runMedia('ffprobe',['-v','error','-count_frames','-show_entries','stream=nb_read_frames,duration','-of','json',gif])).streams[0];
    assert.equal(Number(probe.nb_read_frames),8);assert.ok(Math.abs(Number(probe.duration)*1000-a.durationMs)<=20);
    const gifAlpha=runMedia('ffmpeg',['-v','error','-i',gif,'-vf','alphaextract','-frames:v','1','-f','rawvideo','-pix_fmt','gray','-'],{encoding:null});
    assert.ok(gifAlpha.includes(0),'the encoded GIF retains transparency');
    const hashes=runMedia('ffmpeg',['-v','error','-i',gif,'-f','framemd5','-']).split('\n').filter(l=>l&&!l.startsWith('#')).map(l=>l.split(',').at(-1).trim());
    assert.ok(new Set(hashes).size>1,'a repeated still is not animation');
  }
});

test('the new horizon is a 2:1 equirectangular asset, not the old source collage',()=>{
  const probe=JSON.parse(runMedia('ffprobe',['-v','error','-show_entries','stream=width,height','-of','json',path.join(root,'public',worlds.main.skybox)])).streams[0];
  assert.equal(probe.width,probe.height*2);assert.notEqual(worlds.main.skybox,'media/oikonomia-skybox.webp');
  assert.equal(fs.readdirSync(path.join(root,'prompts')).filter(p=>p.endsWith('.txt')).length>=17,true);
});
