import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { panel, setText } from '../../../shared/journey/text-panels.js';
import { risingBridge } from '../../../shared/journey/river-bridge.js';
import geography from './data/geography.json' with { type: 'json' };
import { lesson } from './session.js';

const material = color => new THREE.MeshStandardMaterial({ color, roughness: .8 });
export const HUB = { id: 'observatory', spawn: [0,7], lookAt: [0,1,-1], bounds: { minX:-10,maxX:10,minZ:-10,maxZ:9 } };
export const CITY = { spawn: [0,5.8], lookAt: [0,1.5,-3], bounds: { minX:-7.5,maxX:7.5,minZ:-9,maxZ:8 } };
function add(parent, geo, mat, x,y,z) { const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.receiveShadow=true;parent.add(m);return m; }
function lights(scene) { scene.add(new THREE.HemisphereLight(0xfff3d5,0x487b72,2.5));const sun=new THREE.DirectionalLight(0xffedcf,2.7);sun.position.set(-5,11,7);scene.add(sun); }
function billboard(root, cameraPosition) { root.lookAt(cameraPosition.x,root.position.y,cameraPosition.z); }
export async function buildObservatory(scene,session) {
  scene.background=new THREE.Color(0xb4d1c8);scene.fog=new THREE.Fog(0xb4d1c8,24,75);lights(scene);
  const stone=material(0xdac99f),gold=material(0xc49a4d),dark=material(0x234d43);
  add(scene,new THREE.CylinderGeometry(11,11.3,.5,64),stone,0,-.25,0);
  add(scene,new THREE.CylinderGeometry(6.6,6.8,.7,64),dark,0,.35,-1.8);
  const map=await new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'media/mediterranean.glb');map.scene.scale.setScalar(2);map.scene.position.set(-.8,.76,-1.6);scene.add(map.scene);
  const title=panel('Η πορεία του Παύλου',5.4,.78,null,{dark:true});title.position.set(0,4.4,-6.3);scene.add(title);
  const subtitle=panel('Μια συνάντηση · ένα μήνυμα για όλους',5.2,.52,null,{dark:true});subtitle.position.set(0,3.4,-6.3);scene.add(subtitle);
  const pickables=[],pins=new Map(),gearRoots=[],slots=[];
  const linePoints=geography.stations.map(s=>new THREE.Vector3(s.x*2-.8,1.42,s.z*2-1.6));
  const route=new THREE.Line(new THREE.BufferGeometry().setFromPoints(linePoints),new THREE.LineBasicMaterial({color:0xc9ad69,transparent:true,opacity:.4}));scene.add(route);
  const pawn=add(scene,new THREE.ConeGeometry(.14,.44,16),gold,...linePoints[0].toArray());pawn.position.y=1.65;
  geography.stations.forEach((s,i)=>{
    const root=new THREE.Group();root.position.copy(linePoints[i]);scene.add(root);
    const pin=panel(String(i+1).padStart(2,'0'),.36,.36,{type:'city',id:s.id},{dark:true,square:true});pin.position.y=.22;root.add(pin);pickables.push(pin);pins.set(s.id,{root,pin});
    const label=panel(lesson.cities[i].title,1.5,.38,{type:'city',id:s.id},{dark:true});
    label.position.set(...[[4.25,2.05,-2.9],[.5,2.85,-1.0],[-.7,2.05,-1.9],[2.25,2.5,-1.8],[-2.6,2.05,-1.0]][i]);scene.add(label);pickables.push(label);
    const leader=new THREE.Line(new THREE.BufferGeometry().setFromPoints([linePoints[i],label.position]),new THREE.LineBasicMaterial({color:0xc9ad69,transparent:true,opacity:.55}));scene.add(leader);pins.get(s.id).label=label;
  });
  function gear(index){const g=new THREE.Group();const bronze=material([0xcc9b50,0xb88b46,0xe1b86e][index]);add(g,new THREE.TorusGeometry(.31,.08,8,24),bronze,0,0,0);for(let i=0;i<12;i++){const a=i/12*Math.PI*2;const tooth=add(g,new THREE.BoxGeometry(.13,.13,.11),bronze,.37*Math.cos(a),.37*Math.sin(a),0);tooth.rotation.z=a;}
    const hit=add(g,new THREE.CircleGeometry(.46,24),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}),0,0,.07);hit.userData.action={type:'gear',index};pickables.push(hit);return g;}
  for(let i=0;i<3;i++){
    const x=-4.2+i*1.05;
    const g=gear(i);g.position.set(x,1.2,3.7);scene.add(g);gearRoots.push(g);
    const slot=panel(String(i+1),.75,.75,{type:'slot',index:i},{dark:true,square:true});slot.position.set(x,1.9,2.7);scene.add(slot);slots.push(slot);pickables.push(slot);
  }
  const gearSign=panel('1 · Διάλεξε γρανάζι και υποδοχή',3.5,.42,null,{dark:true});gearSign.position.set(-3.1,2.65,2.7);scene.add(gearSign);
  const crank=new THREE.Group();crank.position.set(3.25,1.65,3);scene.add(crank);
  add(crank,new THREE.TorusGeometry(.65,.055,10,40),gold,0,0,0);add(crank,new THREE.BoxGeometry(1.2,.07,.07),gold,0,0,0);add(crank,new THREE.BoxGeometry(.07,1.2,.07),gold,0,0,0);
  const handle=add(crank,new THREE.CylinderGeometry(.11,.11,.35,12),dark,.56,0,.2);handle.rotation.x=Math.PI/2;
  const hit=add(crank,new THREE.CircleGeometry(.78,32),new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}),0,0,.4);hit.userData.action={type:'crank'};pickables.push(hit);
  const crankLabel=panel('2 · Μανιβέλα — δύο περιστροφές',3.6,.44,{type:'crank'}, {dark:true});crankLabel.position.set(3.25,.95,4.25);scene.add(crankLabel);pickables.push(crankLabel);
  const summary=panel('',5.9,.9,null,{dark:true,paragraph:true});summary.position.set(0,2.1,-7.3);scene.add(summary);
  return {pickables,crank,pawn,crankCenter:crank.position,
    update(dt,head,turns,selected,travel){
      crank.rotation.z=-turns*Math.PI*2;
      gearRoots.forEach((g,i)=>{const placed=session.state.gears.includes(i);g.position.set(slots[i].position.x,placed?1.9:1.2,placed?2.8:3.7);g.rotation.z=placed?crank.rotation.z*(i%2?-1:1):selected===i?Math.sin(performance.now()/300)*.08:0;});
      for(const [id,v]of pins){billboard(v.root,head);billboard(v.label,head);v.pin.material.opacity=v.label.material.opacity=session.allowed(id)?1:.3;v.pin.userData.disabled=v.label.userData.disabled=!session.allowed(id);}
      const done=lesson.cities.filter(c=>session.done(c.id));const text=done.length?done.map(c=>c.theme).join(' · '):'Πέντε πόλεις · δέκα συνδέσεις · ένας κόσμος ανοιχτός σε όλους';
      if(summary.userData.text!==text){setText(summary,text,{dark:true,paragraph:true});summary.userData.text=text;}
      if(travel){const n=lesson.cities.findIndex(c=>c.id===travel.id),a=linePoints[Math.max(0,n-1)],b=linePoints[n];pawn.position.lerpVectors(a,b,travel.progress);pawn.position.y=1.75;}
    },canWalk:(x,z)=>Math.hypot(x,z)<10.4 && !(Math.hypot(x,z+1.8)<6.9 && z<3.8)};
}
export async function buildCity(scene,city,state) {
  scene.background=new THREE.Color(0xbdd7ce);scene.fog=new THREE.Fog(0xbdd7ce,23,75);lights(scene);
  const stone=material(0xdfcba3),edge=material(0xb9a076);
  for(const [length,z]of [[6.5,4.5],[8,-5]])add(scene,new THREE.BoxGeometry(15,.45,length),stone,0,-.22,z);
  const water=add(scene,new THREE.PlaneGeometry(15,3),new THREE.MeshStandardMaterial({color:0x328a91,metalness:.3,roughness:.25}),0,-.1,0);water.rotation.x=-Math.PI/2;
  const bridge=risingBridge(scene,{from:[0,1.7],to:[0,-1.7],width:2.3,segments:1,progress:Number(state.biography)});
  for(const z of [-1.65,1.65])for(const x of [-4.3,4.3])add(scene,new THREE.BoxGeometry(6,.4,.2),edge,x,.1,z);
  const tex=await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+city.media.panorama);tex.colorSpace=THREE.SRGBColorSpace;
  // Unity's panorama is calibrated for a half sphere; never stretch it over 360°.
  const backdrop=new THREE.Mesh(new THREE.SphereGeometry(28,64,32,Math.PI,Math.PI,.18,Math.PI*.72),new THREE.MeshBasicMaterial({map:tex,side:THREE.BackSide,toneMapped:false}));backdrop.position.y=1.5;scene.add(backdrop);
  const title=panel(city.title+' · '+city.theme,5.8,.6,null,{dark:true});title.position.set(0,4.2,-7.6);scene.add(title);
  const story=panel(city.story,4.6,.95,null,{dark:true,paragraph:true});story.position.set(0,2.85,2.8);scene.add(story);
  const returnButton=panel('Στο Παρατηρητήριο',2.6,.46,{type:'hub'},{dark:true});returnButton.position.set(-4.6,1.4,4.3);scene.add(returnButton);
  return {bridge,pickables:[returnButton],update(dt,head,reduced){bridge.update(Number(state.biography),dt,reduced);billboard(returnButton,head);story.visible=!state.biography;billboard(story,head);},canWalk(x,z){return z>1.7 || z< -1.7 || bridge.allows(x,z);}};
}
export function disposeScene(scene){const g=new Set(),m=new Set(),t=new Set();scene.traverse(o=>{if(o.geometry)g.add(o.geometry);for(const mat of (Array.isArray(o.material)?o.material:[o.material]))if(mat){m.add(mat);if(mat.map)t.add(mat.map);for(const u of Object.values(mat.uniforms||{}))if(u.value?.isTexture)t.add(u.value);}});g.forEach(v=>v.dispose());m.forEach(v=>v.dispose());t.forEach(v=>v.dispose());}
