import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { validateWorldMedia } from '../scripts/media-catalog.mjs';

test('missing runtime media is rejected before Vite can publish an unusable lesson',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'webxr-media-'));
  try{
    await fs.mkdir(path.join(root,'src/data'),{recursive:true});await fs.mkdir(path.join(root,'public/media'),{recursive:true});
    await fs.writeFile(path.join(root,'src/data/worlds.json'),JSON.stringify({main:{stations:[{asset:'one'}]}}));
    await fs.writeFile(path.join(root,'src/data/source-lesson.json'),JSON.stringify({groups:[]}));
    const manifest={animations:{one:{atlas:'media/one.png',frameCount:1,durations:[200]}}};
    await fs.writeFile(path.join(root,'public/media/manifest.json'),JSON.stringify(manifest));
    await assert.rejects(validateWorldMedia(root),/Missing runtime media.*one.png/);
    await fs.writeFile(path.join(root,'public/media/one.png'),'fixture');assert.equal(await validateWorldMedia(root),1);
    manifest.animations.one.durations=[];await fs.writeFile(path.join(root,'public/media/manifest.json'),JSON.stringify(manifest));
    await assert.rejects(validateWorldMedia(root),/Invalid frame timings/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
