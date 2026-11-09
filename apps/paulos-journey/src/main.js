import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { Navigation } from '../../../shared/journey/navigation.js';
import { WaterQuiz } from '../../../shared/journey/water-quiz.js';
import { loadActors } from '../../../shared/journey/actors.js';
import { panel } from '../../../shared/journey/text-panels.js';
import { PaulSession, lesson } from './session.js';
import { HUB, CITY, buildCity, buildObservatory, disposeScene } from './world.js';
import { ManuscriptConnections, manuscriptProfile, presentationSession, readingPages } from './manuscript.js';
import { XRMenu } from './xr-menu.js';
import './style.css';

const $=id=>document.getElementById(id);
$('app').innerHTML=`<main id="stage"><canvas id="scene" tabindex="0" aria-label="Η πορεία του Παύλου. Σύρε για ματιά, WASD για κίνηση. Το Μενού ανοίγει τις δραστηριότητες."></canvas><div id="transition" aria-hidden="true"></div>
<button id="menu-toggle" aria-expanded="false" aria-controls="menu" hidden>☰ Μενού</button>
<section id="welcome"><p class="eyebrow">ΠΑΡΑΤΗΡΗΤΗΡΙΟ · ΠΕΝΤΕ ΠΟΛΕΙΣ</p><h1>Η πορεία<br>του Παύλου</h1><p>Από τη συνάντηση στην προσφορά.<br>Πέντε πόλεις, δέκα συνδέσεις, ένα μήνυμα για όλους.</p><p class="small">Συναρμολόγησε τον μηχανισμό, γύρισε τη μανιβέλα και επισκέψου τις πόλεις. Κάθε γεγονός γίνεται αφετηρία για ένα νόημα.</p><button id="start" class="primary" disabled>Ετοιμασία Παρατηρητηρίου…</button><p class="small">Υπολογιστής: σύρε για ματιά · WASD για βάδισμα.<br>Αφή: μοχλός για κίνηση · σύρε για ματιά.<br>VR: ακτίνα για επιλογή · μοχλοί για κίνηση και στροφή.</p></section>
<aside id="menu" hidden aria-label="Μενού μαθήματος"><header><p class="eyebrow">ΑΠΟ ΤΗ ΣΥΝΑΝΤΗΣΗ ΣΤΗΝ ΠΡΟΣΦΟΡΑ</p><h2 id="place-title"></h2><output id="progress">0 / 10</output></header>
<div class="toolbar"><button id="hub">Παρατηρητήριο</button><button id="read">Κείμενα</button><button id="motion" aria-pressed="false">Μειωμένη κίνηση</button><span id="vr-slot"></span></div>
<section id="hub-activity"><p id="hub-instruction"></p><div id="gears" class="gears"></div><div id="gear-slots" class="gears"></div><button id="turn" class="primary">Κράτησε τη μανιβέλα · 2 στροφές</button><button id="turn-step">¼ στροφής</button><progress id="turn-progress" max="2" value="0"></progress><nav id="cities" aria-label="Οι πέντε πόλεις"></nav></section>
<section id="city-activity" hidden><h3 id="theme"></h3><p id="story"></p><p id="phase-title" class="eyebrow"></p><h3 id="question"></h3><div id="water-choices" class="choices"></div><button id="go-scene">Στο χειρόγραφο ↗</button><div id="meaning-choices" class="choices"></div><button id="connect" class="primary">Σύνδεσε με την εικόνα</button><button id="hint">Μικρή υπόδειξη</button><p id="hint-copy" class="small"></p><p id="interpretation"></p><button id="replay" hidden>Επανεξέταση της σύνδεσης</button><div id="completed-actions" class="toolbar" hidden><button id="completed-hub" class="primary">Στο Παρατηρητήριο</button><button id="explore">Συνέχεια εξερεύνησης</button></div></section>
<p id="feedback" role="status" aria-live="polite"></p><footer><button id="video-open" hidden>Ανακεφαλαίωση · βίντεο 45″</button><button id="zoom-in">Μεγέθυνση +</button><button id="zoom-out">Σμίκρυνση −</button><button id="overview">Συνολική θέα</button><button id="reset">Νέα προσπάθεια</button><a id="collection" hidden>Όλοι οι κόσμοι</a><p id="save-note" class="small"></p></footer></aside>
<div id="touch-walk" class="touch-walk" hidden aria-label="Χειριστήριο κίνησης αφής"><div class="touch-walk-pad"><span id="touch-walk-stick" class="touch-walk-stick"></span></div><span>Κίνηση</span></div>
<p id="announcement" class="sr-only" role="status" aria-live="polite"></p><div id="loading" hidden role="status">Μετάβαση…</div><div id="error" hidden role="alert"><p id="error-copy"></p><button id="retry">Δοκίμασε ξανά</button><button id="error-hub">Στο Παρατηρητήριο</button></div></main>
<dialog id="completion" aria-labelledby="completion-title"><p class="eyebrow">Η ΣΥΝΔΕΣΗ ΦΩΤΙΣΤΗΚΕ</p><h2 id="completion-title"></h2><p id="completion-copy"></p><div class="toolbar"><button id="completion-hub" class="primary">Στο Παρατηρητήριο</button><button id="completion-explore">Συνέχεια εξερεύνησης</button></div><button id="completion-video" hidden>Ανακεφαλαίωση · 45″</button></dialog>
<dialog id="reader" aria-labelledby="reader-title"><div class="dialog-head"><h2 id="reader-title">Κείμενα και πηγές</h2><button id="reader-close" aria-label="Κλείσιμο ανάγνωσης">×</button></div><select id="reader-select" aria-label="Κείμενο ανάγνωσης"></select><article id="reader-text"></article><p id="reader-source"></p><button id="reader-back">Στην εξερεύνηση</button></dialog>
<dialog id="reset-dialog" aria-labelledby="reset-title"><h2 id="reset-title">Νέα προσπάθεια;</h2><p>Διάλεξε ποια πρόοδος θα ξεκινήσει ξανά.</p><div class="toolbar"><button id="reset-cancel">Ακύρωση</button><button id="reset-city">Αυτή η πόλη</button><button id="reset-all">Όλη η διαδρομή</button></div></dialog>
<dialog id="video-dialog" aria-labelledby="video-title"><div class="dialog-head"><h2 id="video-title">Η πορεία του Παύλου · 45″</h2><button id="video-close" aria-label="Έξοδος βίντεο">×</button></div><video id="film" controls playsinline preload="none"></video><p id="video-feedback" role="status"></p><div class="toolbar"><button id="video-replay">Επανάληψη</button><button id="video-back">Στην εξερεύνηση</button></div></dialog>`;

let storage;try{storage=localStorage;}catch{}
const session=new PaulSession(storage);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(66,1,.08,140),rig=new THREE.Group();rig.add(camera);scene.add(rig);
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
let level=null,environment=null,city=null,actors=null,water=null,manuscript=null,view='observatory',started=false,changing=false,ready=false,menuOpen=false,selected=null,selectedGear=null,turns=0,cranking=false,travel=null,revealing=false,focus=null,motionOverride=null,waterAdapter=null,teleports=[],videoWorld=null,desktopPose=null,zoomFactor=1;
const head=new THREE.Vector3(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),rotation=new THREE.Matrix4();
const reducedPreference=matchMedia('(prefers-reduced-motion: reduce)'),reduced=()=>motionOverride??reducedPreference.matches;
let firing={active:false},feedback='Συναρμολόγησε τα τρία γρανάζια.';
const navigation=new Navigation(camera,renderer,HUB,[],{pick:point=>pick(point),lock:()=>{},escape:()=>{selected=null;openMenu(true);},canWalk:(x,z)=>environment?.canWalk(x,z)??true});
const xrMenu=new XRMenu(scene,camera),xrPages=readingPages();
const film=$('film');film.src=import.meta.env.BASE_URL+'media/paul-journey.mp4';
if(import.meta.env.VITE_COLLECTION_URL){$('collection').href=import.meta.env.VITE_COLLECTION_URL;$('collection').hidden=false;}
function paused(){return !started||changing||document.hidden||xrMenu.opened||Boolean(videoWorld)||Boolean(document.querySelector('dialog[open]'))||(renderer.xr.isPresenting&&renderer.xr.getSession()?.visibilityState!=='visible');}
function announce(text){feedback=text;$('feedback').textContent=text;$('announcement').textContent=text;}
function syncInput(){navigation.enabled=started&&!changing&&!xrMenu.opened&&!videoWorld&&!document.querySelector('dialog[open]');if(!navigation.enabled){navigation.keys.clear();stopFire();cranking=false;}}
function openMenu(value){menuOpen=Boolean(value);$('menu').hidden=!menuOpen||renderer.xr.isPresenting;$('menu-toggle').textContent=menuOpen?'× Κλείσιμο':'☰ Μενού';$('menu-toggle').setAttribute('aria-expanded',String(menuOpen));if(menuOpen&&city&&session.done(city.id))$('menu').scrollTop=0;}
function dialog(id){$(id).showModal();syncInput();}
function closeDialog(id){$(id).close();syncInput();}
function continueExploration(){if($('completion').open)closeDialog('completion');openMenu(false);$('scene').focus();syncInput();}
function showCompletion(){if(renderer.xr.isPresenting){showWorldMenu(true);return;}openMenu(true);$('completion-title').textContent=session.complete?'Η πορεία φωτίστηκε':city.title+' · δύο συνδέσεις';$('completion-copy').textContent=session.complete?lesson.finalQuestion:city.teaching.interpretation;$('completion-video').hidden=!session.complete;dialog('completion');}
function showWorldMenu(completed=false){
  const item=(label,type,extra={})=>({label,action:{type,...extra}});
  const items=[item('Συνέχεια εξερεύνησης','xr-close')];
  if(city)items.unshift(item('Στο Παρατηρητήριο','xr-hub'));
  items.push(item('Κείμενα και πηγές','xr-read',{page:0}));
  if(city&&session.done(city.id)&&!revealing)items.push(item('Επανεξέταση','xr-replay'));
  items.push(item(reduced()?'Ενεργοποίηση κίνησης':'Μειωμένη κίνηση','xr-motion'),item('Νέα προσπάθεια','xr-reset'));
  if(session.complete)items.push(item('Βίντεο · 45″','xr-video'));
  items.push(item('Έξοδος VR','xr-exit'));
  xrMenu.show(completed?(session.complete?'Η πορεία φωτίστηκε':city.title+' · δύο συνδέσεις'):city?.title||'Παρατηρητήριο',completed?(session.complete?lesson.finalQuestion:city.teaching.interpretation):session.count+' / 10 · '+(city?.story||'Γρανάζια, μανιβέλα και πέντε πόλεις στον χάρτη.'),items);syncInput();
}
function handleXRMenu(e){
  if(!e.type.startsWith('xr-'))return false;
  if(e.type==='xr-menu'){if(xrMenu.opened){xrMenu.close();syncInput();}else showWorldMenu();}
  else if(e.type==='xr-close'){xrMenu.close();syncInput();}
  else if(e.type==='xr-hub'){xrMenu.close();enter('observatory');}
  else if(e.type==='xr-read'){
    const page=Math.max(0,Math.min(xrPages.length-1,e.page||0)),p=xrPages[page],items=[];
    if(page>0)items.push({label:'← Προηγούμενη',action:{type:'xr-read',page:page-1}});
    if(page<xrPages.length-1)items.push({label:'Επόμενη →',action:{type:'xr-read',page:page+1}});
    items.push({label:'Μενού',action:{type:'xr-menu-back'}},{label:'Στην εξερεύνηση',action:{type:'xr-close'}});
    xrMenu.show(p.title+' · '+(page+1)+' / '+xrPages.length,p.text,items,true);syncInput();
  }else if(e.type==='xr-menu-back')showWorldMenu();
  else if(e.type==='xr-replay'){xrMenu.close();syncInput();startReveal(true);}
  else if(e.type==='xr-motion'){motionOverride=!reduced();showWorldMenu();renderUI();}
  else if(e.type==='xr-reset'){
    const items=[{label:'Ακύρωση',action:{type:'xr-menu-back'}}];
    if(city)items.push({label:'Αυτή η πόλη',action:{type:'xr-reset-confirm',scope:city.id}});
    items.push({label:'Όλη η διαδρομή',action:{type:'xr-reset-confirm',scope:'all'}});
    xrMenu.show('Νέα προσπάθεια;','Διάλεξε ποια πρόοδος θα ξεκινήσει ξανά.',items);syncInput();
  }else if(e.type==='xr-reset-confirm'){xrMenu.close();cancelPresentation();session.reset(e.scope);enter(e.scope==='all'?'observatory':e.scope,true);}
  else if(e.type==='xr-video'){xrMenu.close();openVideo();}
  else if(e.type==='xr-exit')renderer.xr.getSession()?.end();
  return true;
}
function showError(error){$('error-copy').textContent=error.message||String(error);$('error').hidden=false;announce('Η προβολή δεν ολοκληρώθηκε. Η πρόοδος διατηρείται.');}
function entryProfile(){return city?manuscriptProfile(city):null;}
function currentCameraPose(){return{position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};}
function cancelFocus(restore=false){if(focus&&restore&&!renderer.xr.isPresenting){camera.fov=focus.fov;camera.position.copy(focus.position);camera.quaternion.copy(focus.quaternion);camera.updateProjectionMatrix();}else if(focus){camera.fov=focus.fov;camera.updateProjectionMatrix();}focus=null;}
function cancelPresentation(){manuscript?.cancel(false);revealing=false;cancelFocus(true);stopFire();}
function makeWaterAdapter(c){const data=session.city(c.id);return{choices:c.biography.choices,current:{id:c.id},visibleStation:{id:c.id,prompt:c.biography.question},busy:false,sceneComplete:data.biography,reviewId:null,solved:id=>id===c.id&&data.biography};}
function makeTeleports(){for(const m of teleports){m.removeFromParent();m.geometry.dispose();m.material.dispose();}teleports=[];const points=city?[[0,5.8],...(session.city(city.id).biography?[[0,1.3]]:[])]:[[0,7],[-5,4],[5,4]];for(const point of points){const m=new THREE.Mesh(new THREE.RingGeometry(.24,.34,24),new THREE.MeshBasicMaterial({color:0xe8c67e,side:THREE.DoubleSide,transparent:true,opacity:.8}));m.rotation.x=-Math.PI/2;m.position.set(point[0],.25,point[1]);m.userData.action={type:'teleport',point};m.visible=renderer.xr.isPresenting;level.add(m);teleports.push(m);}}
async function enter(id,force=false){
  if(changing||(!force&&id===view&&level))return;if(id!=='observatory'&&!session.allowed(id))return;
  changing=true;xrMenu.close();closeVideo();stopFire();cancelPresentation();cranking=false;travel=null;turns=0;selected=null;selectedGear=null;zoomFactor=1;$('loading').hidden=!started;$('transition').style.opacity='1';syncInput();
  const next=new THREE.Scene(),c=lesson.cities.find(v=>v.id===id);let env,nextActors,nextWater,nextManuscript,adapter;
  try{
    if(!c)env=await buildObservatory(next,session);else{
      env=await buildCity(next,c,session.city(id));const world={id,kind:'focus',stations:[{id,position:[1.4,-5],height:3.35,asset:id}]};
      nextActors=await loadActors(next,world,import.meta.env.BASE_URL);
      adapter=makeWaterAdapter(c);nextWater=new WaterQuiz(next,{kind:'focus',stations:[{id,position:[0,3.1]}]},adapter,camera,answerBiography,[{quizPosition:[0,3.1]}]);
      const present=presentationSession(session,c,()=>selected,()=>revealing||!session.city(id).biography);
      nextManuscript=new ManuscriptConnections(next,world,present,nextActors,[{quizPosition:[-2.25,-3.3]}],()=>finishReveal(),manuscriptProfile(c));nextManuscript.finalQuestion=lesson.finalQuestion;
      const target=panel('Σύνδεσε με την εικόνα',2.4,.42,{type:'target',id},{dark:true});target.position.set(1.4,1.6,-3.75);next.add(target);env.target=target;env.pickables.push(target);
      const go=panel('Στο χειρόγραφο ↗',2.3,.4,{type:'go'},{dark:true});go.position.set(0,1.15,1.9);next.add(go);env.go=go;env.pickables.push(go);
      const hub=panel('Παρατηρητήριο',2.2,.42,{type:'hub'},{dark:true});hub.position.set(-4.6,1.35,-3.6);next.add(hub);env.pickables.push(hub);
      const video=panel('Βίντεο ανακεφαλαίωσης',2.8,.42,{type:'video'},{dark:true});video.position.set(3.9,1.4,-3.4);video.visible=session.complete;next.add(video);env.pickables.push(video);
      const replay=panel('Επανεξέταση',2,.38,{type:'replay'},{dark:true});replay.position.set(4.4,2,-3.7);next.add(replay);env.replay=replay;env.pickables.push(replay);
    }
    water?.dispose();manuscript?.dispose();if(level){scene.remove(level);disposeScene(level);}level=next;scene.add(level);environment=env;actors=nextActors||null;water=nextWater||null;manuscript=nextManuscript||null;city=c||null;waterAdapter=adapter||null;view=id;session.enter(id);
    scene.background=next.background;scene.fog=next.fog;navigation.world=c?{...CITY,id}:HUB;navigation.obstacles=[];
    if(renderer.xr.isPresenting){navigation.landXR(navigation.world.spawn);desktopPose=null;}else { navigation.spawn(); if(!c){camera.position.set(0,5.2,8);camera.lookAt(0,.8,-1.6);} }
    makeTeleports();ready=true;changing=false;feedback=c?c.story:session.state.gears.length===3?'Κράτησε τη μανιβέλα για την επόμενη πόλη.':'Συναρμολόγησε τα τρία γρανάζια.';$('loading').hidden=true;$('transition').style.opacity='0';$('error').hidden=true;$('start').disabled=false;$('start').textContent='Στη διαδρομή ↗';buildMenu();renderUI();resize();syncInput();
    $('menu').scrollTop=0;
    if(started&&!renderer.xr.isPresenting)openMenu(true);
    if(started&&c&&session.done(id))showCompletion();
  }catch(error){nextWater?.dispose();nextManuscript?.dispose();disposeScene(next);changing=false;$('loading').hidden=true;$('transition').style.opacity='0';showError(error);syncInput();}
}
function buildMenu(){
  $('cities').replaceChildren();for(const c of lesson.cities){const b=document.createElement('button');b.dataset.city=c.id;b.textContent=c.title+' · '+c.theme;b.addEventListener('click',()=>{if(session.done(c.id))enter(c.id);else announce('Χρησιμοποίησε τη μανιβέλα για την επόμενη πόλη.');});$('cities').append(b);}
  $('gears').replaceChildren();$('gear-slots').replaceChildren();for(let i=0;i<3;i++){const b=document.createElement('button');b.textContent='Γρανάζι '+(i+1);b.dataset.gear=String(i);b.addEventListener('click',()=>action({type:'gear',index:i}));$('gears').append(b);const s=document.createElement('button');s.textContent='Υποδοχή '+(i+1);s.dataset.slot=String(i);s.addEventListener('click',()=>action({type:'slot',index:i}));$('gear-slots').append(s);}
  $('water-choices').replaceChildren();$('meaning-choices').replaceChildren();if(!city)return;
  for(const choice of city.biography.choices){const b=document.createElement('button');b.textContent=choice.word;b.dataset.pour=choice.id;b.className='pour';bindHold(b,()=>beginFire({mode:'guided',id:choice.id}),stopFire);$('water-choices').append(b);}
  for(const entry of entryProfile().entries){const b=document.createElement('button');b.textContent=entry.text;b.dataset.meaning=entry.stationId;b.addEventListener('click',()=>action({type:'word',id:entry.stationId}));$('meaning-choices').append(b);}
}
function renderUI(){
  if(!ready)return;$('place-title').textContent=city?city.title:lesson.title;$('progress').textContent=session.count+' / 10';$('save-note').textContent=session.canStore?'Η πρόοδός σου αποθηκεύεται σε αυτή τη συσκευή.':'Η πρόοδος κρατιέται όσο μένει ανοιχτή η σελίδα.';
  $('hub-activity').hidden=Boolean(city);$('city-activity').hidden=!city;$('hub').hidden=!city;$('video-open').hidden=!session.complete;$('motion').setAttribute('aria-pressed',String(reduced()));$('motion').textContent=reduced()?'Ενεργοποίηση κίνησης':'Μειωμένη κίνηση';
  $('hub-instruction').textContent=session.state.gears.length<3?'Διάλεξε ένα γρανάζι και την υποδοχή με τον ίδιο αριθμό.':session.complete?'Ο χάρτης των πέντε νοημάτων φωτίστηκε. Επισκέψου ξανά τις πόλεις ή δες την ανακεφαλαίωση.':'Η μανιβέλα σε οδηγεί στην επόμενη πόλη: '+session.next.title;
  document.querySelectorAll('[data-gear]').forEach(b=>{const n=Number(b.dataset.gear);b.disabled=session.state.gears.includes(n);b.setAttribute('aria-pressed',String(selectedGear===n));});
  document.querySelectorAll('[data-slot]').forEach(b=>b.disabled=session.state.gears.includes(Number(b.dataset.slot)));
  $('turn').disabled=$('turn-step').disabled=session.state.gears.length<3||session.complete||Boolean(travel);
  document.querySelectorAll('[data-city]').forEach(b=>{b.disabled=!session.allowed(b.dataset.city);b.classList.toggle('done',session.done(b.dataset.city));});
  if(city){const state=session.city(city.id),bio=!state.biography;$('theme').textContent=city.theme;$('story').textContent=city.story;$('question').textContent=bio?city.biography.question:'Ποιο χωρίο συνδέεται με αυτό το νόημα;';$('phase-title').textContent=bio?'1 · ΤΟ ΓΕΓΟΝΟΣ':state.teaching?'ΟΛΟΚΛΗΡΩΘΗΚΕ · 2 / 2':'2 · ΑΠΟ ΤΟ ΓΕΓΟΝΟΣ ΣΤΟ ΝΟΗΜΑ';
    $('water-choices').hidden=!bio;$('meaning-choices').hidden=bio||state.teaching;$('go-scene').hidden=bio;$('connect').hidden=bio||state.teaching;$('connect').disabled=!selected||revealing;$('replay').hidden=!state.teaching;$('replay').disabled=revealing;$('completed-actions').hidden=!state.teaching||revealing;
    $('interpretation').textContent=state.teaching?city.teaching.interpretation:'';$('hint').hidden=state.teaching;$('hint-copy').textContent=(bio?state.wrongBio:state.wrongMeaning)>=2?(bio?city.biography.hint:city.teaching.hint):'';
    document.querySelectorAll('[data-meaning]').forEach(b=>{b.disabled=revealing;b.setAttribute('aria-pressed',String(b.dataset.meaning===selected));});
    if(waterAdapter){waterAdapter.sceneComplete=state.biography;water.sync(waterAdapter);}
  }
  $('feedback').textContent=feedback;
}
function action(e){
  if(!started||changing||document.querySelector('dialog[open]'))return;
  if(handleXRMenu(e))return;
  if(e.type==='hub'){enter('observatory');return;}if(e.type==='video'){openVideo();return;}
  if(e.type==='teleport'){if(renderer.xr.isPresenting)navigation.landXR(e.point);return;}
  if(e.type==='gear'){if(session.state.gears.includes(e.index))return;selectedGear=e.index;announce('Διάλεξε την υποδοχή '+(e.index+1)+'.');renderUI();return;}
  if(e.type==='slot'){if(selectedGear===e.index){session.gear(e.index);selectedGear=null;announce(session.state.gears.length===3?'Ο μηχανισμός είναι έτοιμος. Κράτησε τη μανιβέλα.':'Το γρανάζι μπήκε στη θέση του.');}else announce('Διάλεξε πρώτα το γρανάζι με τον ίδιο αριθμό.');renderUI();return;}
  if(e.type==='crank'){cranking=true;return;}
  if(e.type==='city'){if(session.done(e.id))enter(e.id);else announce('Η επόμενη πόλη ανοίγει με δύο στροφές της μανιβέλας.');return;}
  if(!city)return;if(e.type==='hymn-block')return;
  if(e.type==='hymn-page'){manuscript.setPage(e.page);return;}
  if(revealing)return;
  if(e.type==='go'){goScene();return;}
  if(e.type==='replay'){startReveal(true);return;}
  if(e.type==='word'){if(!session.city(city.id).biography){announce('Πρώτα άνοιξε το πέρασμα με τη σωστή απάντηση.');return;}if(session.done(city.id)){if(e.id===city.id)startReveal(true);return;}selected=e.id;announce('Το χωρίο επιλέχθηκε. Σύνδεσέ το με την εικόνα.');renderUI();return;}
  if(e.type==='target'){if(!session.city(city.id).biography){announce('Πρώτα γέμισε τη σωστή απάντηση.');return;}if(session.done(city.id)){startReveal(true);return;}if(!selected){announce('Διάλεξε πρώτα ένα χωρίο.');return;}const result=session.answer(city.id,'meaning',selected);if(result==='correct')startReveal(false);else{selected=null;announce('Δοκίμασε άλλο χωρίο. Η πρόοδος διατηρείται.');renderUI();}}
}
function answerBiography(id){if(!city)return;const result=session.answer(city.id,'bio',id);stopFire();if(result==='wrong'){water.reject(id,performance.now());announce('Δοκίμασε ξανά. Άφησε τη βολή και διάλεξε άλλο δοχείο.');}else if(result==='correct'){announce('Το πέρασμα ανοίγει. Προχώρησε στο χειρόγραφο.');makeTeleports();}renderUI();}
function goScene(){if(!city||!session.city(city.id).biography)return;cancelFocus(false);if(renderer.xr.isPresenting)navigation.landXR([0,1.3]);else navigation.goTo({landing:[0,1.3],position:[-.3,-4],lookHeight:1.6});openMenu(false);}
function startReveal(review){if(!manuscript||revealing)return;selected=null;revealing=true;openMenu(false);manuscript.setPage(-1);camera.getWorldPosition(head);manuscript.start(city.id,reduced(),head);if(!renderer.xr.isPresenting&&!reduced()){focus={...currentCameraPose(),target:new THREE.Vector3(1.4,1.9,-5)};}announce(review?'Δες ξανά τη σύνδεση. Η πρόοδος διατηρείται.':'Οι λέξεις ταξιδεύουν στην εικόνα…');manuscript.userReview=review;renderUI();}
function finishReveal(){const review=manuscript?.userReview;revealing=false;cancelFocus(true);announce(city.teaching.interpretation);renderUI();if(!review)showCompletion();}
function visible(o){for(let n=o;n;n=n.parent)if(!n.visible)return false;return !o.userData.disabled;}
function pickables(){if(xrMenu.opened)return xrMenu.pickables.filter(visible);if(videoWorld)return videoWorld.pickables.filter(visible);return[...(environment?.pickables||[]),...(manuscript?.pickables||[]),...(actors?.pickables||[]),...(water?.root.visible?water.pickables:[]),...teleports,...xrMenu.pickables].filter(visible);}
function rayHit(){if(renderer.xr.isPresenting&&xrMenu.toggle.visible){const menu=ray.intersectObject(xrMenu.toggle,false)[0];if(menu?.distance<20)return menu;}return ray.intersectObjects(pickables(),false).find(h=>h.distance<20);}
function pick(point){if(!started||changing||renderer.xr.isPresenting||document.querySelector('dialog[open]'))return;if(point){const r=$('scene').getBoundingClientRect();pointer.set((point.x-r.left)/r.width*2-1,-(point.y-r.top)/r.height*2+1);}else pointer.set(0,0);ray.setFromCamera(pointer,camera);const hit=rayHit();if(hit)action(hit.object.userData.action);}
function bindHold(b,start,stop){b.addEventListener('pointerdown',e=>{if(e.button!==0||b.disabled)return;e.preventDefault();b.setPointerCapture(e.pointerId);start();});for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,stop);b.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)&&!e.repeat){e.preventDefault();start();}});b.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();stop();}});}
function beginFire(input){if(!city||session.city(city.id).biography||paused())return;firing={active:true,...input};}
function stopFire(){firing={active:false};water?.fill.release();}
$('scene').addEventListener('pointerdown',e=>{if(e.button!==0||!started||changing||document.querySelector('dialog[open]'))return;const r=$('scene').getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);ray.setFromCamera(pointer,camera);const hit=rayHit();if(hit?.object.userData.action?.type==='vessel'){e.preventDefault();e.stopImmediatePropagation();beginFire({mode:'world',id:hit.object.userData.action.id});$('scene').setPointerCapture(e.pointerId);}else if(hit?.object.userData.action?.type==='crank'){e.preventDefault();e.stopImmediatePropagation();cranking=true;$('scene').setPointerCapture(e.pointerId);}},true);
for(const name of ['pointerup','pointercancel','blur'])window.addEventListener(name,()=>{stopFire();cranking=false;});
$('scene').addEventListener('pointermove',e=>{if(e.buttons&&navigation.drag?.moved)cancelFocus(false);});
document.addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))cancelFocus(false);});
document.addEventListener('visibilitychange',()=>{stopFire();cranking=false;if(document.hidden)film.pause();});
function nextTravel(){if(travel||city||!session.next||session.state.gears.length<3)return;cranking=false;travel={id:session.next.id,progress:0};announce('Το πιόνι ταξιδεύει προς '+session.next.title+'.');renderUI();}
function sourceReader(){const id=$('reader-select').value,source=lesson.sources[id];$('reader-text').textContent=source.text;$('reader-source').replaceChildren();if(source.url){const a=document.createElement('a');a.href=source.url;a.textContent='Πηγή κειμένου';a.target='_blank';a.rel='noopener noreferrer';$('reader-source').append(a);}}
for(const[id,s]of Object.entries(lesson.sources)){const o=document.createElement('option');o.value=id;o.textContent=s.title;$('reader-select').append(o);}
$('reader-select').addEventListener('change',sourceReader);
$('read').addEventListener('click',()=>{sourceReader();dialog('reader');});for(const id of ['reader-close','reader-back'])$(id).addEventListener('click',()=>closeDialog('reader'));
$('menu-toggle').addEventListener('click',()=>openMenu(!menuOpen));$('start').addEventListener('click',()=>{started=true;$('welcome').hidden=true;$('menu-toggle').hidden=false;$('touch-walk').hidden=false;openMenu(true);syncInput();if(city&&session.done(city.id))showCompletion();});
for(const id of ['hub','completed-hub'])$(id).addEventListener('click',()=>enter('observatory'));
$('go-scene').addEventListener('click',goScene);$('connect').addEventListener('click',()=>action({type:'target',id:city.id}));$('replay').addEventListener('click',()=>startReveal(true));
$('hint').addEventListener('click',()=>{if(city){const s=session.city(city.id);s[s.biography?'wrongMeaning':'wrongBio']=Math.max(2,s[s.biography?'wrongMeaning':'wrongBio']);session.persist();renderUI();}});
bindHold($('turn'),()=>cranking=true,()=>cranking=false);$('turn-step').addEventListener('click',()=>{if(session.state.gears.length===3&&!travel){turns=Math.min(2,turns+.25);if(turns>=2)nextTravel();}});
$('motion').addEventListener('click',()=>{motionOverride=!reduced();cancelFocus(true);renderUI();});reducedPreference.addEventListener('change',renderUI);
for(const[id,factor]of [['zoom-in',.85],['zoom-out',1/.85]])$(id).addEventListener('click',()=>{if(renderer.xr.isPresenting)return;cancelFocus(false);zoomFactor=THREE.MathUtils.clamp(zoomFactor*factor,.5,1.4);resize();});
$('overview').addEventListener('click',()=>{cancelFocus(false);zoomFactor=1;if(renderer.xr.isPresenting){navigation.landXR(navigation.world.spawn);return;}navigation.spawn();if(!city){camera.position.set(0,5.2,8);camera.lookAt(0,.8,-1.6);}resize();});
$('completion-hub').addEventListener('click',()=>{closeDialog('completion');enter('observatory');});$('completion-explore').addEventListener('click',continueExploration);$('explore').addEventListener('click',continueExploration);
$('reset').addEventListener('click',()=>{$('reset-city').hidden=!city;dialog('reset-dialog');});$('reset-cancel').addEventListener('click',()=>closeDialog('reset-dialog'));
for(const [button,scope]of [['reset-city','city'],['reset-all','all']])$(button).addEventListener('click',()=>{closeDialog('reset-dialog');cancelPresentation();session.reset(scope==='all'?'all':city.id);enter(scope==='all'?'observatory':city.id,true);});
$('retry').addEventListener('click',()=>enter(view,true));$('error-hub').addEventListener('click',()=>enter('observatory',true));
function openVideo(){
  if(!session.complete||videoWorld)return;film.pause();if(film.error)film.load();else film.currentTime=0;$('video-feedback').textContent='';
  if(!renderer.xr.isPresenting){dialog('video-dialog');return;}
  xrMenu.enable(false);const root=new THREE.Group(),direction=new THREE.Vector3();camera.getWorldPosition(head);camera.getWorldDirection(direction);direction.y=0;if(direction.lengthSq()<.001)direction.set(0,0,-1);direction.normalize();root.position.copy(head).addScaledVector(direction,3.2);root.position.y=Math.max(1.4,head.y+.15);scene.add(root);
  const tex=new THREE.VideoTexture(film);tex.colorSpace=THREE.SRGBColorSpace;
  const screen=new THREE.Mesh(new THREE.PlaneGeometry(3.6,2.025),new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,toneMapped:false}));root.add(screen);
  const play=panel('Προβολή / Παύση',1.9,.35,{type:'film-toggle'},{dark:true});play.position.set(-1,-1.3,0);root.add(play);
  const back=panel('Έξοδος βίντεο',1.4,.35,{type:'film-close'},{dark:true});back.position.set(1,-1.3,0);root.add(back);
  videoWorld={root,tex,pickables:[play,back]};syncInput();film.play().catch(()=>announce('Πάτησε Προβολή για το βίντεο.'));
}
function closeVideo(){film.pause();if($('video-dialog').open)closeDialog('video-dialog');if(videoWorld){disposeScene(videoWorld.root);videoWorld.root.removeFromParent();videoWorld=null;}xrMenu.enable(renderer.xr.isPresenting);syncInput();}
film.addEventListener('error',()=>{const message='Το βίντεο δεν είναι διαθέσιμο. Μπορείς να συνεχίσεις την εξερεύνηση.';$('video-feedback').textContent=message;announce(message);if(videoWorld){const status=panel(message,3.8,.65,null,{dark:true,paragraph:true});status.position.y=1.45;videoWorld.root.add(status);}});
for(const id of ['video-open','completion-video'])$(id).addEventListener('click',()=>{if($('completion').open)closeDialog('completion');openVideo();});for(const id of ['video-close','video-back'])$(id).addEventListener('click',closeVideo);$('video-replay').addEventListener('click',()=>{if(film.error)film.load();else film.currentTime=0;$('video-feedback').textContent='';film.play().catch(()=>{});});
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('close',()=>{if(d.id==='video-dialog')film.pause();syncInput();}));
const controllers=[];for(let i=0;i<2;i++){const controller=renderer.xr.getController(i);rig.add(controller);const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0xf3d58c}));line.scale.z=8;controller.add(line);const cursor=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshBasicMaterial({color:0xffe5a3}));cursor.visible=false;scene.add(cursor);controller.addEventListener('selectstart',()=>{controllerRay(controller);const hit=rayHit(),e=hit?.object.userData.action;if(e?.type==='film-toggle'){if(film.error)film.load();film.paused?film.play().catch(()=>{}):film.pause();return;}if(e?.type==='film-close'){closeVideo();return;}if(e?.type==='vessel'){beginFire({mode:'xr',id:e.id,controller});return;}if(e?.type==='crank'){cranking=true;return;}if(e)action(e);});controller.addEventListener('selectend',()=>{stopFire();cranking=false;});controllers.push({controller,line,cursor});}
function controllerRay(c){rotation.identity().extractRotation(c.matrixWorld);ray.ray.origin.setFromMatrixPosition(c.matrixWorld);ray.ray.direction.set(0,0,-1).applyMatrix4(rotation).normalize();}
renderer.xr.addEventListener('sessionstart',()=>{cancelPresentation();desktopPose=currentCameraPose();closeVideo();for(const d of document.querySelectorAll('dialog[open]'))d.close();const yaw=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ').y;rig.position.set(camera.position.x,0,camera.position.z);rig.rotation.y=yaw;camera.position.set(0,0,0);camera.quaternion.identity();navigation.landXR([desktopPose.position.x,desktopPose.position.z]);document.body.classList.add('xr');xrMenu.enable(true);$('menu-toggle').hidden=true;openMenu(false);teleports.forEach(t=>t.visible=true);started=true;$('welcome').hidden=true;syncInput();});
renderer.xr.addEventListener('sessionend',()=>{cancelPresentation();closeVideo();xrMenu.enable(false);rig.position.set(0,0,0);rig.rotation.set(0,0,0);if(desktopPose){camera.position.copy(desktopPose.position);camera.quaternion.copy(desktopPose.quaternion);}else navigation.spawn();document.body.classList.remove('xr');$('menu-toggle').hidden=false;openMenu(false);teleports.forEach(t=>t.visible=false);controllers.forEach(c=>c.cursor.visible=false);syncInput();resize();});
async function prepareVR(){if(!navigator.xr||!await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false))return;const button=VRButton.createButton(renderer,{optionalFeatures:['local-floor','bounded-floor']});button.style.cssText='';$('vr-slot').append(button);}
function resize(){if(renderer.xr.isPresenting)return;const w=$('scene').clientWidth,h=$('scene').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;if(!focus){const baseFov=Math.min(120,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(66)/2)*Math.max(1,1.5/camera.aspect))));camera.fov=THREE.MathUtils.clamp(baseFov*zoomFactor,25,120);}camera.updateProjectionMatrix();}
new ResizeObserver(resize).observe($('stage'));window.addEventListener('pagehide',()=>{cancelPresentation();film.pause();navigation.keys.clear();});
let last=performance.now(),diagnostic=0;
renderer.setAnimationLoop(time=>{
  const now=typeof time==='number'?time:performance.now(),dt=Math.min(.06,Math.max(0,(now-last)/1000));last=now;const stopped=paused();navigation.update(dt);camera.getWorldPosition(head);
  if(environment&&!changing){if(!city){if(cranking&&!stopped&&session.state.gears.length===3&&!session.complete&&!travel){turns=Math.min(2,turns+dt*.7);if(turns>=2)nextTravel();}if(travel&&!stopped){travel.progress=Math.min(1,travel.progress+dt/1.5);if(travel.progress===1){const id=travel.id;travel=null;enter(id);}}environment.update(dt,head,turns,selectedGear,travel);$('turn-progress').value=turns;}else{
    environment.update(stopped?0:dt,head,reduced());environment.go.visible=session.city(city.id).biography;environment.target.visible=session.city(city.id).biography;environment.replay.visible=session.done(city.id)&&!revealing;
    for(const item of environment.pickables)item.lookAt(head.x,item.position.y,head.z);
    manuscript.update(dt,head,reduced(),stopped);actors.update(now,head,presentationSession(session,city,()=>selected,()=>revealing),reduced(),dt);
    const shot={active:firing.active&&!stopped,id:firing.id,xr:renderer.xr.isPresenting,worldPrompt:!menuOpen||renderer.xr.isPresenting};if(firing.controller){firing.controller.getWorldPosition(head);shot.origin=head.clone();}camera.getWorldPosition(head);
    water.update(now,stopped?0:dt,waterAdapter,head,reduced(),started&&!changing,shot);
    document.querySelectorAll('[data-pour]').forEach(b=>{const v=water.fill.levels.get(b.dataset.pour)||0;b.style.setProperty('--fill',Math.round(v*100)+'%');});
    if(focus&&manuscript.active&&!stopped){const t=manuscript.active.elapsed/1000,a=Math.min(1,t/.8)*Math.min(1,Math.max(0,(5-t)/.5));const target=new THREE.Quaternion();camera.lookAt(focus.target);target.copy(camera.quaternion);camera.quaternion.copy(focus.quaternion).slerp(target,a*.55);camera.fov=focus.fov*(1-a*.12);camera.updateProjectionMatrix();}
    const interpretation=manuscript.interpretationText;if(interpretation&&$('announcement').textContent!==interpretation)$('announcement').textContent=interpretation;
  }}
  if(renderer.xr.isPresenting){xrMenu.update(head);for(const c of controllers){controllerRay(c.controller);const hit=rayHit();c.line.scale.z=hit?hit.distance:8;c.cursor.visible=Boolean(hit);if(hit)c.cursor.position.copy(hit.point);}if(videoWorld)videoWorld.root.lookAt(head.x,videoWorld.root.position.y,head.z);}
  renderer.render(scene,camera);diagnostic+=dt;if(diagnostic>.3){diagnostic=0;Object.assign($('scene').dataset,{view,phase:changing?'loading':travel?'travel':manuscript?.reading?'reading':revealing?'reveal':city?session.city(city.id).teaching?'complete':session.city(city.id).biography?'meaning':'biography':'observatory',elapsed:String(Math.round(manuscript?.active?.elapsed||0)),count:String(session.count),gears:String(session.state.gears.length),position:camera.position.toArray().map(n=>n.toFixed(2)).join(','),frames:JSON.stringify(Object.fromEntries([...(actors?.actors||[])].map(([id,a])=>[id,a.frame])))});}
});
session.onChange=()=>{if(ready&&!changing)renderUI();};
const restored=session.state.view;void enter(restored==='observatory'||session.allowed(restored)?restored:'observatory',true).then(()=>prepareVR().catch(()=>{}));
