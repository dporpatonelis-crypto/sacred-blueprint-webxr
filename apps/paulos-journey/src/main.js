import * as THREE from 'three';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { Navigation } from '../../../shared/journey/navigation.js';
import { WaterQuiz } from '../../../shared/journey/water-quiz.js';
import { loadActors } from '../../../shared/journey/actors.js';
import { panel } from '../../../shared/journey/text-panels.js';
import { PaulSession, lesson } from './session.js';
import { HUB, CITY, buildCity, buildIslands, disposeScene } from './world.js';
import { manuscriptProfile, presentationSession, readingPages } from './manuscript.js';
import { PaulManuscript } from './manuscript-view.js';
import { XRMenu } from './xr-menu.js';
import { mountPuzzle } from '../../../shared/puzzles/puzzle-dom.js';
import { installInterface } from './ui.js';
import '../../../shared/puzzles/puzzle.css';
import './style.css';

const $=installInterface();

let storage;try{storage=localStorage;}catch{}
const session=new PaulSession(storage);
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(66,1,.08,140),rig=new THREE.Group();rig.add(camera);scene.add(rig);
const renderer=new THREE.WebGLRenderer({canvas:$('scene'),antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local-floor');
let level=null,environment=null,city=null,actors=null,water=null,manuscript=null,view='islands',started=false,changing=false,ready=false,menuOpen=false,selected=null,activeIsland=null,puzzleView=null,puzzlePointer=null,puzzleController=null,revealing=false,focus=null,motionOverride=null,waterAdapter=null,teleports=[],videoWorld=null,desktopPose=null,zoomFactor=1,messageUntil=0;
const head=new THREE.Vector3(),ray=new THREE.Raycaster(),pointer=new THREE.Vector2(),rotation=new THREE.Matrix4();
const reducedPreference=matchMedia('(prefers-reduced-motion: reduce)'),reduced=()=>motionOverride??reducedPreference.matches;
const compactScreen=()=>!renderer.xr.isPresenting&&($('scene').clientWidth<700||$('scene').clientHeight<500);
const compactLandscape=()=>compactScreen()&&$('scene').clientWidth>$('scene').clientHeight;
const closeLayout=()=>compactLandscape()?{book:[-3,1.9,-5.6],water:[-.2,.65,-5.05],landing:[-1.5,-1.9],position:[-1.5,-5.05],lookHeight:1.6,fov:46}:{book:[-2,2.35,-5.6],water:[-2,.55,-5.05],landing:[-2,-1.9],position:[-2,-5.05],lookHeight:1.25,fov:74};
let firing={active:false},feedback='Συναρμολόγησε το παζλ της πρώτης νησίδας.';
const navigation=new Navigation(camera,renderer,HUB,[],{pick:point=>pick(point),lock:()=>{},escape:()=>{selected=null;openMenu(true);},canWalk:(x,z)=>environment?.canWalk(x,z)??true});
const xrMenu=new XRMenu(scene,camera),xrPages=readingPages();
const film=$('film');film.src=import.meta.env.BASE_URL+'media/paul-journey.mp4';
if(import.meta.env.VITE_COLLECTION_URL){$('collection').href=import.meta.env.VITE_COLLECTION_URL;$('collection').hidden=false;}
function paused(){return !started||changing||document.hidden||Boolean(manuscript?.reading)||xrMenu.opened||Boolean(videoWorld)||Boolean(document.querySelector('dialog[open]'))||(renderer.xr.isPresenting&&renderer.xr.getSession()?.visibilityState!=='visible');}
function announce(text){feedback=text;$('feedback').textContent=text;$('announcement').textContent=text;$('world-feedback').textContent=text;messageUntil=performance.now()+5000;}
function syncInput(){navigation.enabled=started&&!changing&&!xrMenu.opened&&!videoWorld&&!puzzlePointer&&!puzzleController&&!document.querySelector('dialog[open]');if(!navigation.enabled){navigation.keys.clear();stopFire();}}
function openMenu(value){menuOpen=Boolean(value);$('menu').hidden=!menuOpen||renderer.xr.isPresenting;$('menu-toggle').textContent=menuOpen?'× Κλείσιμο':'☰ Μενού';$('menu-toggle').setAttribute('aria-expanded',String(menuOpen));if(menuOpen&&city&&session.done(city.id))$('menu').scrollTop=0;}
function dialog(id){finishPuzzle(false);$(id).showModal();syncInput();}
function closeDialog(id){$(id).close();syncInput();}
function continueExploration(){if($('completion').open)closeDialog('completion');openMenu(false);$('scene').focus();syncInput();}
function showCompletion(){if(renderer.xr.isPresenting){showWorldMenu(true);return;}openMenu(true);$('completion-title').textContent=session.complete?'Η πορεία φωτίστηκε':city.title+' · δύο συνδέσεις';$('completion-copy').textContent=session.complete?lesson.finalQuestion:city.teaching.interpretation;$('completion-video').hidden=!session.complete;dialog('completion');}
function showWorldMenu(completed=false){
  finishPuzzle(false);
  const item=(label,type,extra={})=>({label,action:{type,...extra}});
  const items=[item('Συνέχεια εξερεύνησης','xr-close')];
  if(city)items.unshift(item('Στις νησίδες','xr-hub'));else items.push(item('Νησίδες και πόλεις','xr-island-list'));
  if(city&&!session.done(city.id))items.push(item('Στα δοχεία','xr-go'));
  items.push(item('Κείμενα και πηγές','xr-read',{page:0}));
  if(city&&session.done(city.id)&&!revealing)items.push(item('Επανεξέταση','xr-replay'));
  items.push(item(reduced()?'Ενεργοποίηση κίνησης':'Μειωμένη κίνηση','xr-motion'),item('Νέα προσπάθεια','xr-reset'));
  if(session.complete)items.push(item('Βίντεο · 45″','xr-video'));
  items.push(item('Έξοδος VR','xr-exit'));
  xrMenu.show(completed?(session.complete?'Η πορεία φωτίστηκε':city.title+' · δύο συνδέσεις'):city?.title||'Οι νησίδες',completed?(session.complete?lesson.finalQuestion:city.teaching.interpretation):session.count+' / 10 · '+(city?.story||'Πέντε παζλ 3 × 2 ανοίγουν τις πέντε πόλεις.'),items);syncInput();
}
function handleXRMenu(e){
  if(!e.type.startsWith('xr-'))return false;
  if(e.type==='xr-menu'){if(xrMenu.opened){xrMenu.close();syncInput();}else showWorldMenu();}
  else if(e.type==='xr-close'){xrMenu.close();syncInput();}
  else if(e.type==='xr-hub'){xrMenu.close();enter('islands');}
  else if(e.type==='xr-go'){xrMenu.close();syncInput();goScene();}
  else if(e.type==='xr-island-list'){const items=lesson.cities.filter(c=>session.islandAvailable(c.id)).map(c=>({label:c.title+(session.allowed(c.id)?' →':' · Παζλ'),action:{type:'xr-island',id:c.id}}));items.push({label:'Μενού',action:{type:'xr-menu-back'}},{label:'Στην εξερεύνηση',action:{type:'xr-close'}});xrMenu.show('Οι νησίδες','Επίλεξε μια νησίδα για το παζλ ή την ανοιχτή πόλη της.',items);syncInput();}
  else if(e.type==='xr-island'){xrMenu.close();syncInput();visitIsland(e.id);}
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
  }else if(e.type==='xr-reset-confirm'){xrMenu.close();cancelPresentation();session.reset(e.scope);enter('islands',true);}
  else if(e.type==='xr-video'){xrMenu.close();openVideo();}
  else if(e.type==='xr-exit')renderer.xr.getSession()?.end();
  return true;
}
function showError(error){$('error-copy').textContent=error.message||String(error);$('error').hidden=false;announce('Η προβολή δεν ολοκληρώθηκε. Η πρόοδος διατηρείται.');}
function entryProfile(){return city?manuscriptProfile(city):null;}
function currentCameraPose(){return{position:camera.position.clone(),quaternion:camera.quaternion.clone(),fov:camera.fov};}
function cancelFocus(restore=false){if(focus&&restore&&!renderer.xr.isPresenting){camera.fov=focus.fov;camera.position.copy(focus.position);camera.quaternion.copy(focus.returnQuaternion||focus.quaternion);camera.updateProjectionMatrix();}else if(focus){camera.fov=focus.fov;camera.updateProjectionMatrix();}focus=null;}
function cancelPresentation(){finishPuzzle(false);manuscript?.cancel(false);revealing=false;cancelFocus(true);stopFire();}
function phaseChoices(c){return !session.city(c.id).biography?c.biography.choices:manuscriptProfile(c).entries.map((e,i)=>({id:e.stationId,word:(i+1)+' · Χωρίο '+(i+1),text:e.text}));}
function createWater(parent,c){
  const meaning=session.city(c.id).biography,qid=c.id+(meaning?'-meaning':'-bio'),position=meaning?[0,-1]:[0,3.1];
  const adapter={choices:phaseChoices(c),current:{id:qid},visibleStation:{id:qid,prompt:meaning?'Ποιο χωρίο συνδέεται με το νόημα;':c.biography.question},get busy(){return revealing;},sceneComplete:session.done(c.id),reviewId:null,solved:()=>false};
  return {adapter,water:new WaterQuiz(parent,{kind:'focus',stations:[{id:qid,position}]},adapter,camera,answerWater,[{quizPosition:position}])};
}
function disposeWater(quiz){if(!quiz)return;quiz.dispose();for(const root of [quiz.root,quiz.streamRoot]){disposeScene(root);root.removeFromParent();}}
function rebuildWater(){disposeWater(water);const next=createWater(level,city);water=next.water;waterAdapter=next.adapter;}
function makeTeleports(){
  for(const marker of teleports){marker.removeFromParent();marker.geometry.dispose();marker.material.dispose();}teleports=[];
  const points=city?[[0,5.8],...(session.city(city.id).biography?[[0,1.3]]:[])]:[HUB.spawn,...HUB.stations.filter(station=>session.islandAvailable(station.id)).map(station=>station.landing)];
  for(const point of points){const marker=new THREE.Mesh(new THREE.RingGeometry(.24,.34,24),new THREE.MeshBasicMaterial({color:0xe8c67e,side:THREE.DoubleSide,transparent:true,opacity:.8}));marker.rotation.x=-Math.PI/2;marker.position.set(point[0],.25,point[1]);marker.userData.action={type:'teleport',point};marker.visible=renderer.xr.isPresenting;level.add(marker);teleports.push(marker);}
}
async function enter(id,force=false){
  if(changing||(!force&&id===view&&level))return;if(id!=='islands'&&!session.allowed(id))return;
  changing=true;finishPuzzle(false);closePuzzle();xrMenu.close();closeVideo();stopFire();cancelPresentation();selected=null;zoomFactor=1;$('loading').hidden=!started;$('transition').style.opacity='1';syncInput();
  const next=new THREE.Scene(),c=lesson.cities.find(value=>value.id===id);let env,nextActors,nextWater,nextManuscript,adapter;
  try{
    if(!c)env=await buildIslands(next,session,islandSolved);else{
      env=await buildCity(next,c,session.city(id));const world={id,kind:'focus',stations:[{id,position:[1.4,-5],height:3.35,asset:id}]};
      nextActors=await loadActors(next,world,import.meta.env.BASE_URL);
      const quiz=createWater(next,c);nextWater=quiz.water;adapter=quiz.adapter;
      const present=presentationSession(session,c,()=>selected,()=>revealing||!session.city(id).biography);
      nextManuscript=new PaulManuscript(next,world,present,nextActors,[{quizPosition:[-2.25,-3.3]}],()=>finishReveal(),manuscriptProfile(c));nextManuscript.finalQuestion=lesson.finalQuestion;
      const target=panel('Γέμισε το σωστό χωρίο',2.4,.42,{type:'target',id},{dark:true});target.position.set(1.4,1.6,-3.75);next.add(target);env.target=target;env.pickables.push(target);
      const go=panel('Στο χειρόγραφο ↗',2.3,.4,{type:'go'},{dark:true});go.position.set(-2.8,1.1,1.9);next.add(go);env.go=go;env.pickables.push(go);
      const hub=panel('Στις νησίδες',2.2,.42,{type:'hub'},{dark:true});hub.position.set(-4.6,1.35,-3.6);next.add(hub);env.pickables.push(hub);
      const video=panel('Βίντεο ανακεφαλαίωσης',2.8,.42,{type:'video'},{dark:true});video.position.set(3.9,1.4,-3.4);video.visible=session.complete;next.add(video);env.pickables.push(video);
      const replay=panel('Επανεξέταση',2,.38,{type:'replay'},{dark:true});replay.position.set(4.4,2,-3.7);next.add(replay);env.replay=replay;env.pickables.push(replay);
    }
    disposeWater(water);manuscript?.dispose();environment?.dispose?.();if(level){scene.remove(level);disposeScene(level);}level=next;scene.add(level);environment=env;actors=nextActors||null;water=nextWater||null;manuscript=nextManuscript||null;city=c||null;waterAdapter=adapter||null;view=id;session.enter(id);
    scene.background=next.background;scene.backgroundRotation.copy(next.backgroundRotation);scene.fog=next.fog;navigation.world=c?{...CITY,id}:HUB;navigation.obstacles=env.obstacles||[];
    const returning=!c&&HUB.stations.find(station=>station.id===session.state.returnIsland);
    if(renderer.xr.isPresenting){navigation.landXR(returning?.landing||navigation.world.spawn);desktopPose=null;}else if(returning)navigation.goTo({...returning,lookHeight:1.95});else navigation.spawn();
    activeIsland=c?.id||session.state.returnIsland||session.nextPuzzle?.id||lesson.cities[0].id;makeTeleports();ready=true;changing=false;feedback=c?c.story:session.complete?lesson.finalQuestion:session.nextPuzzle?'Διάλεξε ελεύθερα νησίδα και συναρμολόγησε την εικόνα της.':'Όλες οι πόλεις άνοιξαν. Διάλεξε μια εικόνα ή χρησιμοποίησε το Μενού.';
    $('loading').hidden=true;$('transition').style.opacity='0';$('error').hidden=true;$('start').disabled=false;$('start').textContent='Στις νησίδες ↗';buildMenu();renderUI();resize();syncInput();$('menu').scrollTop=0;
    openMenu(false);if(c&&!session.done(id)&&(!renderer.xr.isPresenting&&(compactScreen()||session.city(id).biography)))goScene();
  }catch(error){disposeWater(nextWater);nextManuscript?.dispose();env?.dispose?.();disposeScene(next);changing=false;$('loading').hidden=true;$('transition').style.opacity='0';showError(error);syncInput();}
}
function buildMenu(){
  $('cities').replaceChildren();for(const c of lesson.cities){const button=document.createElement('button');button.dataset.city=c.id;button.addEventListener('click',()=>visitIsland(c.id));$('cities').append(button);}
  $('water-choices').dataset.phase='';$('water-choices').replaceChildren();
}
function buildAnswers(){
  if(!city)return;const phase=city.id+(session.city(city.id).biography?'-meaning':'-bio');if($('water-choices').dataset.phase===phase)return;
  $('water-choices').dataset.phase=phase;$('water-choices').replaceChildren();
  for(const[index,choice]of phaseChoices(city).entries()){const button=document.createElement('button');button.dataset.answer=choice.id;button.className=session.city(city.id).biography?'answer verse':'answer';button.textContent=(index+1)+' · '+(choice.text||choice.word);button.addEventListener('click',()=>aimAnswer(choice.id));$('water-choices').append(button);}
}
function renderUI(){
  if(!ready)return;$('place-title').textContent=city?city.title:'Οι νησίδες του Παύλου';$('progress').textContent=session.count+' / 10';$('save-note').textContent=session.canStore?'Η πρόοδός σου αποθηκεύεται σε αυτή τη συσκευή.':'Η πρόοδος κρατιέται όσο μένει ανοιχτή η σελίδα.';
  $('hub-activity').hidden=Boolean(city);$('city-activity').hidden=!city;$('hub').hidden=!city;$('video-open').hidden=!session.complete;$('motion').setAttribute('aria-pressed',String(reduced()));$('motion').textContent=reduced()?'Ενεργοποίηση κίνησης':'Μειωμένη κίνηση';
  $('hub-instruction').textContent=session.complete?'Οι πέντε πόλεις φωτίστηκαν. Επίλεξε ελεύθερα μια πόλη για επανεξέταση.':session.nextPuzzle?'Διάλεξε οποιαδήποτε νησίδα. Κάθε παζλ 3 × 2 ανοίγει την πόλη και τη γέφυρά του, χωρίς να χρειάζονται πρώτα οι απαντήσεις μέσα στην πόλη.':'Όλες οι πόλεις άνοιξαν. Επίλεξέ τες ελεύθερα, με όποια σειρά θέλεις.';
  $('next-island').hidden=!session.nextPuzzle;$('next-island').textContent=session.nextPuzzle?'Στη νησίδα '+session.nextPuzzle.title+' ↗':'Όλες οι πόλεις άνοιξαν';
  document.querySelectorAll('[data-city]').forEach(button=>{const id=button.dataset.city,c=lesson.cities.find(value=>value.id===id);button.disabled=!session.islandAvailable(id);button.textContent=(lesson.cities.indexOf(c)+1)+' · '+c.title+' · '+(session.done(id)?'Ολοκληρώθηκε':session.allowed(id)?'Στην πόλη':'Παζλ 3 × 2');button.classList.toggle('done',session.done(id));});
  if($('puzzle-dialog').open){$('puzzle-enter').disabled=!session.allowed(activeIsland);$('puzzle-enter').textContent='Στην πόλη '+lesson.cities.find(c=>c.id===activeIsland).title+' →';}
  if(city){
    const state=session.city(city.id),bio=!state.biography;buildAnswers();$('theme').textContent=city.theme;$('story').textContent=city.story;$('question').textContent=bio?city.biography.question:'Ποιο χωρίο συνδέεται με αυτό το νόημα;';$('phase-title').textContent=bio?'1 · ΤΟ ΓΕΓΟΝΟΣ':state.teaching?'ΟΛΟΚΛΗΡΩΘΗΚΕ · 2 / 2':'2 · ΑΠΟ ΤΟ ΓΕΓΟΝΟΣ ΣΤΟ ΝΟΗΜΑ';
    $('water-choices').hidden=$('answer-guide').hidden=state.teaching;$('go-scene').hidden=state.teaching;$('go-scene').textContent=bio?'Στα δοχεία ↗':'Στο χειρόγραφο και τα δοχεία ↗';$('replay').hidden=!state.teaching;$('replay').disabled=revealing;$('completed-actions').hidden=!state.teaching||revealing;
    $('interpretation').textContent=state.teaching?city.teaching.interpretation:'';$('hint').hidden=state.teaching;$('hint-copy').textContent=(bio?state.wrongBio:state.wrongMeaning)>=2?(bio?city.biography.hint:city.teaching.hint):'';
    document.querySelectorAll('[data-answer]').forEach(button=>{button.disabled=revealing;button.setAttribute('aria-pressed',String(button.dataset.answer===selected));});
    if(waterAdapter){waterAdapter.sceneComplete=state.teaching;water.sync(waterAdapter);}
  }
  $('feedback').textContent=feedback;updateWaterControls();
}
function action(event){
  if(!started||changing||document.querySelector('dialog[open]'))return;if(handleXRMenu(event))return;
  if(event.type==='hub'){enter('islands');return;}if(event.type==='video'){openVideo();return;}
  if(event.type==='teleport'){if(renderer.xr.isPresenting)navigation.landXR(event.point);return;}
  if(event.type.startsWith('puzzle-')){
    const board=environment?.boards?.get(event.id);if(!board||!session.islandAvailable(event.id))return;activeIsland=event.id;
    if(event.type==='puzzle-preview')board.togglePreview();else if(event.type==='puzzle-reset')session.activity(event.id).restart();else if(event.type==='puzzle-enter'&&session.allowed(event.id))enter(event.id);return;
  }
  if(!city)return;if(event.type==='hymn-block')return;if(event.type==='hymn-page'){stopFire();manuscript.setPage(event.page);return;}if(revealing)return;if(event.type==='hymn-choice'){stopFire();manuscript.setChoice(event.index);return;}
  if(event.type==='go'){goScene();return;}if(event.type==='replay'){startReveal(true);return;}
  if(event.type==='word'){if(!session.city(city.id).biography){announce('Πρώτα γέμισε τη σωστή απάντηση για το γεγονός.');return;}if(session.done(city.id)){if(event.id===city.id)startReveal(true);return;}aimAnswer(event.id);return;}
  if(event.type==='target'){if(session.done(city.id))startReveal(true);else announce('Γέμισε το δοχείο του σωστού χωρίου με νερό.');}
}
function answerWater(id){
  if(!city)return;const biography=!session.city(city.id).biography,result=session.answer(city.id,biography?'bio':'meaning',id);stopFire();
  if(result==='wrong'){water.reject(id,performance.now());selected=null;announce('Δοκίμασε ξανά. Άφησε τη βολή και στόχευσε άλλο δοχείο.');}
  else if(result==='correct'&&biography){selected=null;rebuildWater();layoutCity();makeTeleports();announce('Το πέρασμα ανοίγει. Διάβασε το χειρόγραφο και γέμισε το δοχείο του σωστού χωρίου.');if(!renderer.xr.isPresenting)goScene();}
  else if(result==='correct')startReveal(false);renderUI();
}
function goScene(){
  if(!city)return;cancelFocus(false);const meaning=session.city(city.id).biography,compact=compactScreen(),layout=closeLayout(),landing=meaning?compact?layout.landing:[0,1.3]:compact?[0,6.2]:[0,5.8],position=meaning?compact?layout.position:[0,-1]:[0,3.1];
  if(renderer.xr.isPresenting)navigation.landXR(landing);else navigation.goTo({landing,position,lookHeight:compact?meaning?layout.lookHeight:1.25:1.1});openMenu(false);
}
function aimAnswer(id){
  if(!city||changing||revealing||session.done(city.id))return;selected=id;if(renderer.xr.isPresenting){announce('Στόχευσε και γέμισε το δοχείο του επιλεγμένου χωρίου.');renderUI();return;}goScene();
  if(!renderer.xr.isPresenting){const target=water.getTarget(id);if(target)camera.lookAt(target);}
  announce('Στόχευση στο δοχείο. Κράτησε το κυκλικό «Νερό» για να το γεμίσεις.');renderUI();
}
function startReveal(review){
  if(!manuscript||revealing)return;selected=null;revealing=true;openMenu(false);manuscript.setPage(-1);camera.getWorldPosition(head);manuscript.start(city.id,reduced(),head);
  if(!renderer.xr.isPresenting){const returnQuaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position,new THREE.Vector3(-.3,1.6,-4),camera.up));if(reduced())camera.quaternion.copy(returnQuaternion);else focus={...currentCameraPose(),returnQuaternion,target:new THREE.Vector3(1.4,1.9,-5)};}
  announce(review?'Δες ξανά τη σύνδεση. Η πρόοδος διατηρείται.':'Οι λέξεις ταξιδεύουν στην εικόνα…');manuscript.userReview=review;renderUI();
}
function finishReveal(){const review=manuscript?.userReview;revealing=false;cancelFocus(true);if(compactScreen()){navigation.spawn();resize();}announce(city.teaching.interpretation);renderUI();if(!review)showCompletion();}
function visible(o){for(let n=o;n;n=n.parent)if(!n.visible)return false;return !o.userData.disabled;}
function pickables(){if(xrMenu.opened)return xrMenu.pickables.filter(visible);if(videoWorld)return videoWorld.pickables.filter(visible);return[...(environment?.pickables||[]),...(manuscript?.pickables||[]),...(actors?.pickables||[]),...(water?.root.visible?water.pickables:[]),...teleports,...xrMenu.pickables].filter(visible);}
function rayHit(){if(renderer.xr.isPresenting&&xrMenu.toggle.visible){const menu=ray.intersectObject(xrMenu.toggle,false)[0];if(menu?.distance<20)return menu;}return ray.intersectObjects(pickables(),false).find(h=>h.distance<20);}
function pick(point){if(!started||changing||renderer.xr.isPresenting||document.querySelector('dialog[open]'))return;if(point){const r=$('scene').getBoundingClientRect();pointer.set((point.x-r.left)/r.width*2-1,-(point.y-r.top)/r.height*2+1);}else pointer.set(0,0);ray.setFromCamera(pointer,camera);const hit=rayHit();if(hit)action(hit.object.userData.action);}

function canFire(){return Boolean(started&&ready&&city&&!changing&&!revealing&&!session.done(city.id)&&!manuscript?.reading&&!paused()&&(!menuOpen||renderer.xr.isPresenting));}
function beginFire(input){if(!canFire()||firing.active)return;firing={active:true,...input};$('fire-button').classList.add('firing');}
function stopFire(){firing={active:false};water?.fill.release();$('fire-button').classList.remove('firing');}
function vesselHit(){return water?.root.visible?ray.intersectObjects(water.pickables.filter(visible),false).find(hit=>hit.distance<=10):null;}
function centerVessel(){if(!water?.root.visible)return null;pointer.set(0,0);ray.setFromCamera(pointer,camera);return vesselHit()?.object.userData.action.id||null;}
function waterShot(stopped){
  const shot={...firing,active:firing.active&&!stopped,xr:renderer.xr.isPresenting,worldPrompt:!menuOpen||renderer.xr.isPresenting,direction:new THREE.Vector3()};camera.getWorldDirection(shot.direction);
  if(!shot.active)return shot;
  if(shot.mode==='xr'){controllerRay(shot.controller);shot.origin=ray.ray.origin.clone();}
  else{if(shot.mode==='canvas'){const rect=$('scene').getBoundingClientRect();pointer.set((shot.point.x-rect.left)/rect.width*2-1,-(shot.point.y-rect.top)/rect.height*2+1);}else pointer.set(0,0);ray.setFromCamera(pointer,camera);}
  shot.direction.copy(ray.ray.direction);shot.id=vesselHit()?.object.userData.action.id||null;return shot;
}
function updateWaterControls(){
  const visible=canFire()&&!renderer.xr.isPresenting;$('water-controls').hidden=!visible;if(!visible)return;
  const id=centerVessel(),choice=waterAdapter.choices.find(value=>value.id===id);$('reticle').classList.toggle('hot',Boolean(id));$('aim-label').textContent=choice?'Στόχος: '+choice.word:'Στόχευσε ένα δοχείο';$('fire-button').setAttribute('aria-pressed',String(firing.active));
}
function rayAt(event){const rect=$('scene').getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);}
function finishPuzzle(commit=false){
  const input=puzzlePointer,controller=puzzleController;puzzlePointer=null;puzzleController=null;
  const id=input?.action.id||controller?.id;environment?.boards?.get(id)?.finishDrag(commit);
  if(input&&$('scene').hasPointerCapture(input.pointerId))$('scene').releasePointerCapture(input.pointerId);syncInput();
}
function goIsland(id){
  if(city||!session.islandAvailable(id))return;finishPuzzle(false);activeIsland=id;const station=HUB.stations.find(value=>value.id===id);
  if(renderer.xr.isPresenting)navigation.landXR(station.landing);else navigation.goTo({landing:station.landing,position:station.position,lookHeight:1.95});openMenu(false);
}
function visitIsland(id){if(!session.islandAvailable(id))return;if(session.allowed(id))enter(id);else{goIsland(id);if(!renderer.xr.isPresenting)openPuzzle(id);}}
function openPuzzle(id){
  if(city||!session.islandAvailable(id))return;activeIsland=id;closePuzzle();const c=lesson.cities.find(value=>value.id===id);$('puzzle-title').textContent=c.title+' · Παζλ 3 × 2';
  puzzleView=mountPuzzle($('puzzle-mount'),session.activity(id),{image:import.meta.env.BASE_URL+c.media.puzzle,title:c.title,kicker:'ΤΡΕΙΣ ΣΤΗΛΕΣ · ΔΥΟ ΣΕΙΡΕΣ',solvedMessage:'Η εικόνα ολοκληρώθηκε. Η πόλη '+c.title+' άνοιξε.',onReset:()=>session.activity(id).restart()});
  const image=$('puzzle-mount').querySelector('.puzzle-reference'),grid=$('puzzle-mount').querySelector('.puzzle-grid');image.alt='Η ολοκληρωμένη εικόνα: '+c.title;const fit=()=>{grid.style.width='100%';grid.style.maxWidth=(50*image.naturalWidth/image.naturalHeight)+'dvh';};image.addEventListener('load',fit,{once:true});if(image.complete&&image.naturalWidth)fit();dialog('puzzle-dialog');renderUI();
}
function closePuzzle(){if($('puzzle-dialog').open)closeDialog('puzzle-dialog');puzzleView?.dispose();puzzleView=null;$('puzzle-mount').replaceChildren();}
function islandSolved(id){
  announce('Η εικόνα ολοκληρώθηκε. Η πόλη '+lesson.cities.find(value=>value.id===id).title+' άνοιξε.');renderUI();
  if(!renderer.xr.isPresenting&&$('puzzle-dialog').open&&activeIsland===id)$('puzzle-enter').focus();
}
$('scene').addEventListener('pointerdown',event=>{
  if(event.button!==0||!started||changing||document.querySelector('dialog[open]')||renderer.xr.isPresenting)return;
  rayAt(event);const hit=rayHit(),action=hit?.object.userData.action;
  if(action?.type.startsWith('puzzle-')){
    event.preventDefault();event.stopImmediatePropagation();if(puzzlePointer)return;
    puzzlePointer={pointerId:event.pointerId,action,startX:event.clientX,startY:event.clientY,moved:false};activeIsland=action.id;
    if(action.type==='puzzle-tile')environment.boards.get(action.id).beginDrag(action.tile,ray.ray);
    $('scene').setPointerCapture(event.pointerId);syncInput();return;
  }
  if(action?.type==='vessel'&&canFire()){event.preventDefault();event.stopImmediatePropagation();beginFire({mode:'canvas',point:{x:event.clientX,y:event.clientY},pointerId:event.pointerId});$('scene').setPointerCapture(event.pointerId);}
},true);
$('scene').addEventListener('pointermove',event=>{
  if(puzzlePointer?.pointerId===event.pointerId){event.preventDefault();puzzlePointer.moved ||= Math.hypot(event.clientX-puzzlePointer.startX,event.clientY-puzzlePointer.startY)>5;rayAt(event);environment.boards.get(puzzlePointer.action.id)?.drag(ray.ray);}
  if(firing.mode==='canvas'&&firing.pointerId===event.pointerId)firing.point={x:event.clientX,y:event.clientY};
  if(event.buttons&&navigation.drag?.moved)cancelFocus(false);
});
for(const name of ['pointerup','pointercancel','lostpointercapture'])window.addEventListener(name,event=>{
  if(puzzlePointer?.pointerId===event.pointerId){const input=puzzlePointer,commit=name==='pointerup';if(commit){rayAt(event);environment.boards.get(input.action.id)?.drag(ray.ray);}finishPuzzle(commit);if(commit&&!input.moved&&input.action.type!=='puzzle-tile')action(input.action);}
  if(firing.pointerId===event.pointerId)stopFire();
});
$('fire-button').addEventListener('pointerdown',event=>{if(event.button!==0||!canFire())return;event.preventDefault();beginFire({mode:'center',pointerId:event.pointerId});$('fire-button').setPointerCapture(event.pointerId);});
document.addEventListener('keydown',event=>{
  if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))cancelFocus(false);
  if(event.code==='Space'&&!event.repeat&&!/^(BUTTON|INPUT|TEXTAREA|SELECT|A)$/.test(event.target.tagName)&&canFire()){event.preventDefault();beginFire({mode:'center',keyboard:true});}
});
document.addEventListener('keyup',event=>{if(event.code==='Space'&&firing.keyboard)stopFire();});
window.addEventListener('blur',()=>{stopFire();finishPuzzle(false);});window.addEventListener('resize',()=>finishPuzzle(false));
document.addEventListener('visibilitychange',()=>{stopFire();if(document.hidden){finishPuzzle(false);film.pause();}});
$('next-island').addEventListener('click',()=>{if(session.nextPuzzle)visitIsland(session.nextPuzzle.id);});
for(const id of ['puzzle-close','puzzle-back'])$(id).addEventListener('click',closePuzzle);
$('puzzle-world').addEventListener('click',()=>{const id=activeIsland;closePuzzle();goIsland(id);});
$('puzzle-enter').addEventListener('click',()=>{const id=activeIsland;if(session.allowed(id)){closePuzzle();enter(id);}});
function sourceReader(){const id=$('reader-select').value,source=lesson.sources[id];$('reader-text').textContent=source.text;$('reader-source').replaceChildren();if(source.url){const a=document.createElement('a');a.href=source.url;a.textContent='Πηγή κειμένου';a.target='_blank';a.rel='noopener noreferrer';$('reader-source').append(a);}}
for(const[id,s]of Object.entries(lesson.sources)){const o=document.createElement('option');o.value=id;o.textContent=s.title;$('reader-select').append(o);}
$('reader-select').addEventListener('change',sourceReader);
$('read').addEventListener('click',()=>{sourceReader();dialog('reader');});for(const id of ['reader-close','reader-back'])$(id).addEventListener('click',()=>closeDialog('reader'));
$('menu-toggle').addEventListener('click',()=>openMenu(!menuOpen));$('start').addEventListener('click',()=>{started=true;$('welcome').hidden=true;$('menu-toggle').hidden=false;$('touch-walk').hidden=false;openMenu(false);syncInput();});
for(const id of ['hub','completed-hub'])$(id).addEventListener('click',()=>enter('islands'));
$('go-scene').addEventListener('click',goScene);$('replay').addEventListener('click',()=>startReveal(true));
$('hint').addEventListener('click',()=>{if(city){const s=session.city(city.id);s[s.biography?'wrongMeaning':'wrongBio']=Math.max(2,s[s.biography?'wrongMeaning':'wrongBio']);session.persist();renderUI();}});
$('motion').addEventListener('click',()=>{motionOverride=!reduced();cancelFocus(true);renderUI();});reducedPreference.addEventListener('change',renderUI);
for(const[id,factor]of [['zoom-in',.85],['zoom-out',1/.85]])$(id).addEventListener('click',()=>{if(renderer.xr.isPresenting)return;cancelFocus(false);zoomFactor=THREE.MathUtils.clamp(zoomFactor*factor,.5,1.4);resize();});
$('overview').addEventListener('click',()=>{cancelFocus(false);zoomFactor=1;if(renderer.xr.isPresenting){navigation.landXR(navigation.world.spawn);return;}navigation.spawn();if(!city){camera.position.set(0,17,19);camera.lookAt(0,0,-3);}resize();});
$('completion-hub').addEventListener('click',()=>{closeDialog('completion');enter('islands');});$('completion-explore').addEventListener('click',continueExploration);$('explore').addEventListener('click',continueExploration);
$('reset').addEventListener('click',()=>{$('reset-city').hidden=!city;dialog('reset-dialog');});$('reset-cancel').addEventListener('click',()=>closeDialog('reset-dialog'));
for(const [button,scope]of [['reset-city','city'],['reset-all','all']])$(button).addEventListener('click',()=>{closeDialog('reset-dialog');cancelPresentation();session.reset(scope==='all'?'all':city.id);enter('islands',true);});
$('retry').addEventListener('click',()=>enter(view,true));$('error-hub').addEventListener('click',()=>enter('islands',true));
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

const controllers=[];
for(let i=0;i<2;i++){
  const controller=renderer.xr.getController(i);rig.add(controller);
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(),new THREE.Vector3(0,0,-1)]),new THREE.LineBasicMaterial({color:0xf3d58c}));line.scale.z=8;controller.add(line);
  const cursor=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),new THREE.MeshBasicMaterial({color:0xffe5a3}));cursor.visible=false;scene.add(cursor);
  controller.addEventListener('selectstart',()=>{
    controllerRay(controller);const hit=rayHit(),event=hit?.object.userData.action;
    if(event?.type==='film-toggle'){if(film.error)film.load();film.paused?film.play().catch(()=>{}):film.pause();return;}
    if(event?.type==='film-close'){closeVideo();return;}
    if(event?.type==='puzzle-tile'&&!puzzleController){const board=environment.boards.get(event.id);if(board.beginDrag(event.tile,ray.ray)){puzzleController={controller,id:event.id};syncInput();}return;}
    if(event?.type==='vessel'){beginFire({mode:'xr',controller});return;}if(event)action(event);
  });
  controller.addEventListener('selectend',()=>{if(puzzleController?.controller===controller){controllerRay(controller);environment.boards.get(puzzleController.id)?.drag(ray.ray);finishPuzzle(true);}if(firing.controller===controller)stopFire();});
  controller.addEventListener('disconnected',()=>{if(puzzleController?.controller===controller)finishPuzzle(false);if(firing.controller===controller)stopFire();});controllers.push({controller,line,cursor});
}
function controllerRay(c){rotation.identity().extractRotation(c.matrixWorld);ray.ray.origin.setFromMatrixPosition(c.matrixWorld);ray.ray.direction.set(0,0,-1).applyMatrix4(rotation).normalize();}
renderer.xr.addEventListener('sessionstart',()=>{cancelPresentation();layoutCity();desktopPose=currentCameraPose();closeVideo();for(const d of document.querySelectorAll('dialog[open]'))d.close();const yaw=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ').y;rig.position.set(camera.position.x,0,camera.position.z);rig.rotation.y=yaw;camera.position.set(0,0,0);camera.quaternion.identity();navigation.landXR([desktopPose.position.x,desktopPose.position.z]);document.body.classList.add('xr');xrMenu.enable(true);$('menu-toggle').hidden=true;openMenu(false);teleports.forEach(t=>t.visible=true);started=true;$('welcome').hidden=true;syncInput();});
renderer.xr.addEventListener('sessionend',()=>{cancelPresentation();closeVideo();xrMenu.enable(false);rig.position.set(0,0,0);rig.rotation.set(0,0,0);if(desktopPose){camera.position.copy(desktopPose.position);camera.quaternion.copy(desktopPose.quaternion);}else navigation.spawn();document.body.classList.remove('xr');$('menu-toggle').hidden=false;openMenu(false);teleports.forEach(t=>t.visible=false);controllers.forEach(c=>c.cursor.visible=false);syncInput();resize();});
async function prepareVR(){if(!navigator.xr||!await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false))return;const button=VRButton.createButton(renderer,{optionalFeatures:['local-floor','bounded-floor']});button.style.cssText='';$('vr-slot').append(button);}
function layoutCity(){
  if(!city||revealing)return;const compact=compactScreen(),meaning=session.city(city.id).biography;
  const layout=closeLayout();manuscript?.setCompact(compact,compact?layout.book:undefined);
  water.root.scale.setScalar(compact ? .5 : .62);water.root.position.set(...(meaning&&compact?layout.water:[0,compact ? .55 : .3,meaning?-1:3.1]));water.question.scale.setScalar(compact ? .8 : 1);
}
let lastCompact='';
function resize(){if(renderer.xr.isPresenting)return;const w=$('scene').clientWidth,h=$('scene').clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;const compact=compactScreen(),mode=compact?compactLandscape()?'landscape':'portrait':'wide',changed=mode!==lastCompact;lastCompact=mode;layoutCity();if(!focus){const baseFov=city&&compact&&!session.done(city.id)?closeLayout().fov:Math.min(120,THREE.MathUtils.radToDeg(2*Math.atan(Math.tan(THREE.MathUtils.degToRad(66)/2)*Math.max(1,1.5/camera.aspect))));camera.fov=THREE.MathUtils.clamp(baseFov*zoomFactor,25,120);}camera.updateProjectionMatrix();if(changed&&city&&!revealing&&!session.done(city.id))goScene();}
new ResizeObserver(resize).observe($('stage'));window.addEventListener('pagehide',()=>{cancelPresentation();film.pause();navigation.keys.clear();});
let last=performance.now(),diagnostic=0;

renderer.setAnimationLoop(time=>{
  const now=typeof time==='number'?time:performance.now(),dt=Math.min(.06,Math.max(0,(now-last)/1000));last=now;const stopped=paused();navigation.update(dt);camera.getWorldPosition(head);
  if(environment&&!changing){
    if(!city){
      environment.update(stopped?0:dt,head,reduced());
      if(puzzleController){controllerRay(puzzleController.controller);environment.boards.get(puzzleController.id)?.drag(ray.ray);}
    }else{
      environment.update(stopped?0:dt,head,reduced());environment.go.visible=session.city(city.id).biography&&!session.done(city.id);environment.target.visible=session.city(city.id).biography&&!session.done(city.id)&&!revealing;environment.story.visible=renderer.xr.isPresenting&&!session.city(city.id).biography;environment.replay.visible=session.done(city.id)&&!revealing;
      for(const item of environment.pickables)item.lookAt(head.x,item.position.y,head.z);
      environment.title.visible=!(compactScreen()&&session.city(city.id).biography);manuscript.root.visible=session.city(city.id).biography;manuscript.update(dt,head,reduced(),stopped);actors.update(now,head,presentationSession(session,city,()=>selected,()=>revealing),reduced(),dt);
      const shot=waterShot(stopped);water.update(now,stopped?0:dt,waterAdapter,head,reduced(),started&&!changing&&!revealing&&!manuscript.reading,shot);if(compactScreen()&&session.city(city.id).biography){water.question.visible=false;water.instruction.visible=false;environment.target.visible=false;}
      if(focus&&navigation.touchAxes.lengthSq()>.02)cancelFocus(false);
      if(focus&&manuscript.active&&!stopped){const t=manuscript.active.elapsed/1000,entrance=Math.min(1,t/.8),exit=Math.min(1,Math.max(0,(t-4.5)/.5)),amount=entrance*(1-exit);const target=new THREE.Quaternion();camera.lookAt(focus.target);target.copy(camera.quaternion);const close=focus.quaternion.clone().slerp(target,compactScreen()?1:.55);camera.quaternion.copy(t<.8?focus.quaternion:close).slerp(t<.8?close:focus.returnQuaternion,t<.8?entrance:exit);camera.fov=focus.fov*(1-amount*.12);camera.updateProjectionMatrix();}
      const interpretation=manuscript.interpretationText;if(interpretation&&$('announcement').textContent!==interpretation)$('announcement').textContent=interpretation;
    }
  }
  updateWaterControls();$('world-feedback').hidden=!started||menuOpen||stopped||now>messageUntil||renderer.xr.isPresenting;
  if(renderer.xr.isPresenting){xrMenu.update(head);for(const input of controllers){controllerRay(input.controller);const hit=rayHit();input.line.scale.z=hit?hit.distance:8;input.cursor.visible=Boolean(hit);if(hit)input.cursor.position.copy(hit.point);}if(videoWorld)videoWorld.root.lookAt(head.x,videoWorld.root.position.y,head.z);}
  renderer.render(scene,camera);diagnostic+=dt;
  if(diagnostic>.3){diagnostic=0;Object.assign($('scene').dataset,{view,phase:changing?'loading':$('puzzle-dialog').open?'puzzle':manuscript?.reading?'reading':revealing?'reveal':city?session.city(city.id).teaching?'complete':session.city(city.id).biography?'meaning':'biography':'islands',elapsed:String(Math.round(manuscript?.active?.elapsed||0)),count:String(session.count),puzzles:String([...session.activities.values()].filter(a=>a.puzzle.solved).length),unlocked:String(session.unlockedCount),bridges:JSON.stringify((environment?.bridges||[]).map(b=>b.panels.every(p=>p.value>.97))),compact:String(compactScreen()),aim:!renderer.xr.isPresenting&&canFire()?centerVessel()||'':'',skybox:'360',position:camera.position.toArray().map(value=>value.toFixed(2)).join(','),frames:JSON.stringify(Object.fromEntries([...(actors?.actors||[])].map(([id,actor])=>[id,actor.frame])))});}
});

session.onChange=()=>{if(ready&&!changing)renderUI();};
const restored=session.state.view;void enter(restored==='islands'||session.allowed(restored)?restored:'islands',true).then(()=>prepareVR().catch(()=>{}));
