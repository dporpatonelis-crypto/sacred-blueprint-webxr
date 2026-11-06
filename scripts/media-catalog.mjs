import fs from 'node:fs/promises';
import path from 'node:path';

export async function validateWorldMedia(directory) {
  const worlds=JSON.parse(await fs.readFile(path.join(directory,'src/data/worlds.json'),'utf8'));
  const manifest=JSON.parse(await fs.readFile(path.join(directory,'public/media/manifest.json'),'utf8'));
  const root=path.resolve(directory,'public');
  const required=new Set();
  for(const world of Object.values(worlds)){
    if(world.skybox)required.add(world.skybox);
    for(const station of world.stations){
      const asset=manifest.animations?.[station.asset];
      if(!asset)throw new Error(`Missing animation ${station.asset} in ${directory}`);
      if(!Number.isInteger(asset.frameCount)||asset.frameCount<1||asset.durations?.length!==asset.frameCount||!asset.durations.every(d=>Number.isFinite(d)&&d>0))throw new Error(`Invalid frame timings for ${station.asset}`);
      required.add(asset.atlas);
    }
  }
  const lesson=JSON.parse(await fs.readFile(path.join(directory,'src/data/source-lesson.json'),'utf8'));
  for(const group of lesson.groups||[])if(group.imageId&&lesson.images[group.imageId]?.src)required.add(lesson.images[group.imageId].src);
  for(const relative of required){
    if(typeof relative!=='string')throw new Error(`Invalid media path in ${directory}`);
    const file=path.resolve(root,relative);
    if(!file.startsWith(root+path.sep))throw new Error(`Media path escapes public/: ${relative}`);
    try{if(!(await fs.stat(file)).isFile()||(await fs.stat(file)).size===0)throw Error('empty');}
    catch{throw new Error(`Missing runtime media in ${directory}: ${relative}`);}
  }
  return required.size;
}
