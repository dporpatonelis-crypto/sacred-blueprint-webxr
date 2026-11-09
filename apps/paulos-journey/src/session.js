import { PuzzleActivity } from '../../../shared/puzzles/puzzle-activity.js';
import lesson from './data/lesson.json' with { type: 'json' };
export { lesson };
// The islands edition starts afresh, as requested. Previous saves are not read.
export const SAVE_KEY = 'paulos-journey-webxr.v2';
const emptyCity = () => ({ biography:false, teaching:false, wrongBio:0, wrongMeaning:0, unlocked:false, puzzle:null });

export class PaulSession {
  constructor(storage) {
    this.storage=storage; this.canStore=Boolean(storage); this.onChange=()=>{}; this.activities=new Map();
    let saved; try { saved=JSON.parse(storage?.getItem(SAVE_KEY)||'null'); } catch { /* Fresh, playable state. */ }
    this.state={version:2,cities:{},view:'islands',returnIsland:null};
    for(const city of lesson.cities) {
      const value=saved?.version===2?saved.cities?.[city.id]:null;
      this.state.cities[city.id]={...emptyCity(),biography:value?.biography===true,teaching:value?.biography===true&&value?.teaching===true,
        unlocked:value?.unlocked===true||value?.biography===true,wrongBio:Math.max(0,Math.min(99,Number(value?.wrongBio)||0)),wrongMeaning:Math.max(0,Math.min(99,Number(value?.wrongMeaning)||0)),puzzle:value?.puzzle||null};
    }
    if(saved?.version===2&&(saved.view==='islands'||lesson.cities.some(c=>c.id===saved.view)))this.state.view=saved.view;
    if(lesson.cities.some(c=>c.id===saved?.returnIsland))this.state.returnIsland=saved.returnIsland;
    // DOM and 3D boards share these activities and the same serialized save.
    for(const city of lesson.cities) {
      const storageAdapter={getItem:()=>JSON.stringify(this.city(city.id).puzzle),setItem:(_,value)=>{const puzzle=JSON.parse(value),state=this.city(city.id);state.puzzle=puzzle;if(puzzle.tiles.every((tile,index)=>tile===(index===5?null:index)))state.unlocked=true;this.persist();}};
      this.activities.set(city.id,new PuzzleActivity({key:city.id,storage:storageAdapter,rows:2,columns:3}));
    }
    this.persist();
  }
  get count(){return Object.values(this.state.cities).reduce((n,c)=>n+Number(c.biography)+Number(c.teaching),0);}
  get complete(){return this.count===10;}
  get next(){return lesson.cities.find(c=>!this.done(c.id));}
  get nextPuzzle(){return lesson.cities.find(c=>!this.allowed(c.id));}
  get unlockedCount(){return lesson.cities.filter(c=>this.allowed(c.id)).length;}
  done(id){return this.city(id)?.teaching===true;}
  activity(id){return this.activities.get(id);}
  islandAvailable(id){return lesson.cities.some(c=>c.id===id);}
  allowed(id){return this.islandAvailable(id)&&(this.city(id).unlocked||this.activity(id)?.puzzle.solved===true);}
  city(id){return this.state.cities[id];}
  persist(){try{this.storage?.setItem(SAVE_KEY,JSON.stringify(this.state));}catch{this.canStore=false;}this.onChange();}
  answer(id,phase,choice){
    if(!this.allowed(id))return 'locked';const state=this.city(id),key=phase==='bio'?'biography':'teaching';
    if(state[key])return 'review';if(phase!=='bio'&&!state.biography)return 'locked';
    if(choice!==id){state[phase==='bio'?'wrongBio':'wrongMeaning']++;this.persist();return 'wrong';}
    state[key]=true;this.persist();return 'correct';
  }
  enter(id){if(id!=='islands'&&!this.allowed(id))return false;this.state.view=id;if(id!=='islands')this.state.returnIsland=id;this.persist();return true;}
  reset(id){
    const ids=id==='all'?lesson.cities.map(c=>c.id):[id];
    for(const key of ids){this.state.cities[key]=emptyCity();this.activity(key).restart();}
    this.state.view='islands';this.state.returnIsland=id==='all'?null:id;this.persist();
  }
}
