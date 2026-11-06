import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { LessonSession, lesson, SAVE_KEY } from '../src/session.js';
import { SAVE_KEY as firstSaveKey } from '../../eikona-talanta-loukas/src/session.js';
import worlds from '../src/data/worlds.json' with { type:'json' };
import { buildCourtyard } from '../src/world.js';
import { WaterFill } from '../src/water-fill.js';

const finish=session=>{const id=session.current.id;session.choose(id);const result=session.target(id);assert.equal(result.type,'matched');session.finishReveal(result.token);return result;};
const unlock=session=>{while(!session.sceneComplete)finish(session);};
const storage=()=>{const map=new Map();return {getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value)};};

test('the original twenty IDs, text and engine are preserved; analogy remains distinct from three phases',()=>{
  assert.equal(lesson.scenes.length,5);assert.equal(lesson.scenes.flatMap(s=>s.stations).length,20);
  const ids=lesson.scenes.flatMap(s=>s.stations.map(t=>t.id));assert.equal(new Set(ids).size,20);
  assert.equal(lesson.groups.filter(g=>g.role==='analogy').length,1);assert.deepEqual(lesson.finalMindMap.phaseGroups,['old','new','church']);
  const baseline=JSON.parse(fs.readFileSync(new URL('source-baseline.json',import.meta.url)));
  for(const [file,hash] of Object.entries(baseline))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(new URL('../'+file,import.meta.url))).digest('hex'),hash);
  assert.notEqual(SAVE_KEY,firstSaveKey,'different worlds never share progress keys');
});

test('twenty water answers keep order, errors, hints, reveal latches and exact completion',()=>{
  const session=new LessonSession(null,()=>.3), fill=new WaterFill();
  const pour=id=>{const current=session.current.id;fill.setQuestion(current,session.choices.map(s=>s.id));let full;for(let i=0;i<40;i++){full=fill.pour(id,.05);if(full)break;}assert.equal(full,id);session.choose(id);return session.target(current);};
  assert.equal(session.enter('old'),false);
  const wrong=session.choices.find(s=>s.id!==session.current.id).id;
  for(let n=0;n<2;n++){assert.equal(pour(wrong).type,'wrong');fill.reject(wrong);fill.release();}
  assert.equal(session.hasHint(),true);assert.equal(session.count,0);
  for(const scene of lesson.scenes){
    if(scene.id!=='main')assert.equal(session.enter(scene.id),true);
    while(!session.sceneComplete){const result=pour(session.current.id);assert.equal(result.type,'matched');assert.equal(session.target(result.stationId).type,'busy');assert.equal(session.finishReveal(result.token),true);fill.release();}
  }
  assert.equal(session.count,20);assert.equal(session.complete,true);
  session.review('creation');assert.equal(session.reviewId,'creation');assert.equal(session.count,20);
});

test('reload restores shuffled choices, hints and the active phase; reset affects the selected scope',()=>{
  const store=storage(),session=new LessonSession(store,()=>.4);unlock(session);session.enter('old');finish(session);session.hint();
  const resumed=new LessonSession(store,()=>.8);assert.equal(resumed.count,5);assert.equal(resumed.sceneId,'old');assert.deepEqual(resumed.state.orders.old,session.state.orders.old);assert.equal(resumed.hasHint(),true);
  resumed.reset('scene');assert.equal(resumed.count,4);assert.equal(resumed.localCount,0);assert.equal(resumed.unlocked,true);
  resumed.reset('all');assert.equal(resumed.count,0);assert.equal(resumed.unlocked,false);assert.equal(resumed.sceneId,'main');
});

test('four-bank courtyards open one crossing per answer and activate from the incoming bridge',()=>{
  for(const scene of lesson.scenes.filter(s=>s.id!=='main')){
    const config=worlds[scene.id],env=buildCourtyard(new THREE.Scene(),config,{segments:4,progress:0});
    assert.equal(env.bridges.length,5);assert.equal(env.approaches.length,4);assert.equal(env.canWalk(0,3),false);
    for(let correct=0;correct<=4;correct++){
      env.update(0,true,correct,1);
      env.bridges.forEach((b,index)=>assert.equal(b.panels[0].value,Number(index===0||correct>=index)));
      if(correct<4){
        const b=env.bridges[correct],a=env.approaches[correct];
        for(const t of [.02,.5,1])assert.equal(a.contains(b.from[0]+(b.to[0]-b.from[0])*t,b.from[1]+(b.to[1]-b.from[1])*t),true);
        assert.equal(a.contains(...a.viewpoint),true);assert.equal(a.contains(...config.stations[correct].landing),true);
        if(correct<3)assert.equal(env.approaches[correct+1].contains(...config.stations[correct+1].landing),false);
      }
    }
  }
});
