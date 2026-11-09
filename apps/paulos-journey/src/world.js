import * as THREE from 'three';
import { buildHub } from '../../../shared/journey/hub-world.js';
import { panel, setText } from '../../../shared/journey/text-panels.js';
import { risingBridge } from '../../../shared/journey/river-bridge.js';
import { IslandPuzzle } from './puzzle-board.js';
import worlds from './data/worlds.json' with { type: 'json' };
import { lesson } from './session.js';

const material=color=>new THREE.MeshStandardMaterial({color,roughness:.8});
export const HUB=worlds.islands;
export const CITY={spawn:[0,5.8],lookAt:[0,1.5,-3],bounds:{minX:-7.5,maxX:7.5,minZ:-9,maxZ:8}};
function add(parent,geo,mat,x,y,z){const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function billboard(root,head){root.lookAt(head.x,root.position.y,head.z);}
async function skybox(scene,path,rotation){
  const texture=await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+path);
  texture.colorSpace=THREE.SRGBColorSpace;texture.mapping=THREE.EquirectangularReflectionMapping;
  scene.background=texture;scene.backgroundRotation.y=rotation;
}
export async function buildIslands(scene,session,onSolved){
  // Exactly the same geometry, water, flowers and materials as the Talanta hub.
  const landscape=buildHub(scene,HUB,{segments:5,progress:session.completedCities});
  await skybox(scene,HUB.skybox,2.25);
  const textures=await Promise.all(lesson.cities.map(c=>new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+c.media.puzzle)));
  const boards=new Map();
  lesson.cities.forEach((city,index)=>{
    textures[index].colorSpace=THREE.SRGBColorSpace;
    const board=new IslandPuzzle(scene,session.activity(city.id),textures[index],HUB.stations[index],city,id=>onSolved(id));
    board.setEnabled(session.islandAvailable(city.id));boards.set(city.id,board);
  });
  const welcome=panel('Η πορεία του Παύλου · Πέντε νησίδες',4.8,.65,null,{dark:true});
  welcome.position.set(0,2.9,4.4);scene.add(welcome);
  const next=panel('',4.8,.65,null,{dark:true,paragraph:true});next.position.set(0,2,4.4);scene.add(next);
  let elapsed=0,lastCopy='';
  return {...landscape,boards,pickables:[...boards.values()].flatMap(b=>b.pickables),
    update(dt,head,reduced){
      elapsed+=reduced?0:dt;landscape.update(elapsed,reduced,session.completedCities,dt);
      for(const [id,board]of boards){board.setEnabled(session.islandAvailable(id));board.setUnlocked(session.city(id).unlocked);board.update(dt,reduced);}
      billboard(welcome,head);billboard(next,head);
      const copy=session.complete?lesson.finalQuestion:'Συναρμολόγησε την εικόνα στη νησίδα '+session.next.title+' · άνοιξε την πόλη';
      if(copy!==lastCopy){setText(next,copy,{dark:true,paragraph:true});lastCopy=copy;}
    },dispose(){for(const board of boards.values())board.dispose();}
  };
}
export async function buildCity(scene,city,state){
  scene.fog=new THREE.Fog(0xbdd7ce,24,100);
  scene.add(new THREE.HemisphereLight(0xfff3d5,0x487b72,2.5));
  const sun=new THREE.DirectionalLight(0xffedcf,2.7);sun.position.set(-5,11,7);scene.add(sun);
  const stone=material(0xdfcba3),edge=material(0xb9a076);
  for(const[length,z]of [[6.5,4.5],[8,-5]])add(scene,new THREE.BoxGeometry(15,.45,length),stone,0,-.22,z);
  const ocean=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform float uTime;varying vec2 vUv;void main(){float a=sin(vUv.y*6000.+sin(vUv.x*2400.+uTime*.4)*2.+uTime);float b=sin(vUv.x*4100.-vUv.y*3600.+uTime*.6);float sparkle=smoothstep(.93,1.,a)*.10+smoothstep(.97,1.,b)*.06;vec3 c=vec3(.04,.40,.54)+sparkle*vec3(.8,.9,.5);gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  const sea=add(scene,new THREE.PlaneGeometry(1000,1000),ocean,0,-.48,0);sea.rotation.x=-Math.PI/2;let oceanTime=0;
  const bridge=risingBridge(scene,{from:[0,1.7],to:[0,-1.7],width:2.3,segments:1,progress:Number(state.biography)});
  for(const z of [-1.65,1.65])for(const x of [-4.3,4.3])add(scene,new THREE.BoxGeometry(6,.4,.2),edge,x,.1,z);
  await skybox(scene,city.media.skybox,Math.PI/2);
  const title=panel(city.title+' · '+city.theme,5.8,.6,null,{dark:true});title.position.set(0,4.2,-7.6);scene.add(title);
  const story=panel(city.story,4.6,.95,null,{dark:true,paragraph:true});story.position.set(0,2.85,2.8);scene.add(story);
  const back=panel('Στις νησίδες',2.6,.46,{type:'hub'},{dark:true});back.position.set(-4.6,1.4,4.3);scene.add(back);
  return {bridge,story,pickables:[back],update(dt,head,reduced){oceanTime+=reduced?0:dt;ocean.uniforms.uTime.value=reduced?0:oceanTime;bridge.update(Number(state.biography),dt,reduced);billboard(back,head);story.visible=!state.biography;billboard(story,head);},
    canWalk(x,z){return z>1.7||z< -1.7||bridge.allows(x,z);}
  };
}
export function disposeScene(scene){
  const geometries=new Set(),materials=new Set(),textures=new Set();if(scene.background?.isTexture)textures.add(scene.background);
  scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const mat of(Array.isArray(o.material)?o.material:[o.material]))if(mat){materials.add(mat);if(mat.map)textures.add(mat.map);for(const uniform of Object.values(mat.uniforms||{}))if(uniform.value?.isTexture)textures.add(uniform.value);}});
  geometries.forEach(v=>v.dispose());materials.forEach(v=>v.dispose());textures.forEach(v=>v.dispose());
}
