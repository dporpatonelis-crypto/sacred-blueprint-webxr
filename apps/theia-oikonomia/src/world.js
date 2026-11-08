import * as THREE from 'three';
import { batchStatic } from '../../../shared/journey/batch-static.js';
import { risingBridge, stationApproach } from '../../../shared/journey/river-bridge.js';

// Four learning banks, with an open entry and four answer-controlled crossings.
export function buildCourtyard(scene, config, quiz) {
  let puzzleBonus = Boolean(quiz.puzzleBonus);
  const columns=config.stations.map(s=>s.position[0]), cuts=[-7,0,7], obstacles=[];
  scene.background=new THREE.Color(config.theme==='church'?0xdde6d3:config.theme==='old'?0xe6ddbd:0xc2dde2);
  scene.fog=new THREE.Fog(0xcddfd5,32,105);
  scene.add(new THREE.HemisphereLight(0xeaf8ff,0xb99e68,2.3));
  const sun=new THREE.DirectionalLight(0xffecd0,2.4);sun.position.set(-10,18,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-20,right:20,top:16,bottom:-16});sun.shadow.normalBias=.05;scene.add(sun);
  const materials=new Map();
  const mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:true}));return materials.get(color);};
  const add=(geometry,color,x,y,z,parent=scene)=>{const m=new THREE.Mesh(geometry,mat(color));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m;};
  const box=(w,h,d,x,y,z,color=0xe1c595,parent=scene)=>add(new THREE.BoxGeometry(w,h,d),color,x,y,z,parent);
  const cylinder=(a,b,h,x,y,z,color=0xd0af76,parent=scene)=>add(new THREE.CylinderGeometry(a,b,h,24),color,x,y,z,parent);
  let seed=1897;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  box(32,.6,22,0,-.45,0,0xa4936a);
  box(31,.12,6.5,0,-.06,7.25);
  for(const x of columns)box(5.9,.12,12.5,x,-.06,-4.25);
  const pavement=new THREE.InstancedMesh(new THREE.BoxGeometry(.94,.035,.94),mat(0xffffff),31*21);
  const matrix=new THREE.Matrix4(),color=new THREE.Color();let count=0;
  for(let x=-15;x<=15;x++)for(let z=-10;z<=10;z++){
    if((z>1.5&&z<4.5)||(z<2.5&&cuts.some(c=>Math.abs(x-c)<1)))continue;
    matrix.makeTranslation(x,.012+random()*.006,z);pavement.setMatrixAt(count,matrix);
    color.setHSL(.11+random()*.013,.3+random()*.12,.70+random()*.06);pavement.setColorAt(count++,color);
  }
  pavement.count=count;pavement.receiveShadow=true;scene.add(pavement);
  for(const x of [-15.4,15.4]){
    box(.4,.7,21,x,.35,0,0xc6a575);box(.55,.13,21,x,.77,0,0xf0dcb3);
  }
  for(const station of config.stations){
    const x=station.position[0],z=station.position[1];
    cylinder(1.65,1.78,.16,x,.08,z);cylinder(1.6,1.6,.07,x,.195,z,0xf0d9ae);
    const arch=new THREE.Group();arch.position.set(x,0,-7.1);scene.add(arch);
    for(const side of [-1,1]){
      box(.48,2.5,.7,side*2.4,1.25,0,0xe2c491,arch);box(.68,.18,.9,side*2.4,2.45,0,0xf0dcb3,arch);
    }
    const arc=add(new THREE.TorusGeometry(2.4,.25,6,28,Math.PI),0xe2c491,0,2.45,0,arch);
    arc.scale.z=1.25;box(.48,.5,.85,0,4.85,0,0xf0dcb3,arch);
    obstacles.push({type:'circle',x,z,radius:.75});
  }
  const leaves=[];
  for(const [x,z] of [[-14,0],[14,0],[-12.8,7],[12.8,7]]){
    cylinder(.14,.3,2.8,x,1.4,z,0x80613c);
    for(let i=0;i<8;i++){
      const a=i/8*Math.PI*2,m=add(new THREE.IcosahedronGeometry(.7+random()*.3,1),[0x5d8146,0x7d9b52,0x8eab61][i%3],x+Math.cos(a)*.75,2.8+random()*.6,z+Math.sin(a)*.75);
      m.scale.y=.65;leaves.push({mesh:m,phase:random()*6});
    }
    cylinder(.85,1,.2,x,.1,z);obstacles.push({type:'circle',x,z,radius:.9});
  }
  for(const x of [-14,14]){
    box(2.1,.14,.7,x,.62,5.4,0xeed5a8);
    for(const dx of [-.7,.7])box(.3,.55,.5,x+dx,.28,5.4,0xc5a473);
    obstacles.push({type:'box',minX:x-1.1,maxX:x+1.1,minZ:4.95,maxZ:5.85});
  }
  // A low fountain anchors the entry bank without blocking either end bridge.
  cylinder(.9,1.05,.25,0,.125,5.3);cylinder(.82,.82,.04,0,.28,5.3,0x55b8b1);
  cylinder(.18,.28,.55,0,.5,5.3,0xe4c792);obstacles.push({type:'circle',x:0,z:5.3,radius:1.05});
  for(const x of columns)for(const side of [-1,1]){
    const px=x+side*2.1,z=-5.2;
    cylinder(.32,.22,.55,px,.275,z,0xb47c50);cylinder(.35,.35,.07,px,.56,z,0xd19a62);
    for(let j=0;j<5;j++){const l=add(new THREE.SphereGeometry(.22,6,4),0x789052,px+Math.sin(j*2)*.15,.83+random()*.15,z+Math.cos(j*2)*.15);l.scale.set(.55,1.8,.75);}
    obstacles.push({type:'circle',x:px,z,radius:.4});
  }
  const waterMaterial=new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float uTime;varying vec2 vUv;void main(){float r=sin(vUv.x*160.-uTime*1.7+sin(vUv.y*20.));gl_FragColor=vec4(vec3(.07,.52,.57)+smoothstep(.86,1.,r)*.17,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`});
  for(const [w,d,x,z] of [[31,2,0,3],...cuts.map(x=>[1.1,12.5,x,-4.25]),[180,180,0,-15]]){
    const water=new THREE.Mesh(new THREE.PlaneGeometry(w,d),waterMaterial);water.rotation.x=-Math.PI/2;water.position.set(x,w===180?-.53:-.075,z);scene.add(water);
  }
  const routes=[{from:[-10.5,4.4],to:[-10.5,1.6]},...cuts.map(x=>({from:[x-.95,.8],to:[x+.95,.8]})),{from:[10.5,1.6],to:[10.5,4.4]}];
  const bridges=routes.map((route,index)=>risingBridge(scene,{...route,width:2.1,segments:1,progress:Number(puzzleBonus||index===0||quiz.progress>=index)}));
  const onLand=(x,z)=>!((z>1.66&&z<4.34)||(z<2.34&&cuts.some(c=>Math.abs(x-c)<.89)));
  const bankRanges=[[-15,-7.89],[-6.11,-.89],[.89,6.11],[7.89,15]];
  const approaches=bankRanges.map(([left,right],index)=>stationApproach(bridges[index],(x,z)=>x>=left&&x<=right&&z>=-8&&z<=1.66));
  for(let i=0;i<18;i++){
    const a=i/18*Math.PI*2,r=45+random()*20;
    const hill=add(new THREE.ConeGeometry(12+random()*12,10+random()*9,7),[0x94b6a7,0xacc7b3,0x8aaea2][i%3],Math.cos(a)*r,0,Math.sin(a)*r-10);hill.scale.z=.6;hill.castShadow=false;
  }
  batchStatic(scene,new Set([...leaves.map(x=>x.mesh),...bridges.flatMap(b=>[...b.exclude])]));
  return {obstacles,bridges,approaches,onLand,
    setPuzzleBonus(solved){puzzleBonus=Boolean(solved);},
    canWalk(x,z){return onLand(x,z)||bridges.some(b=>b.allows(x,z));},
    update(time,reduced,correct=quiz.progress,dt=0){waterMaterial.uniforms.uTime.value=reduced?0:time;bridges.forEach((b,i)=>b.update(Number(puzzleBonus||i===0||correct>=i),dt,reduced));if(!reduced)leaves.forEach(l=>{l.mesh.rotation.z=Math.sin(time*.6+l.phase)*.02;});}
  };
}
