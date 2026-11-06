import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WaterFill } from '../src/water-fill.js';
import { LessonSession } from '../src/session.js';
import { risingBridge, courtyardRiver } from '../src/river-bridge.js';
import { buildHub } from '../src/hub-world.js';
import worlds from '../src/data/worlds.json' with { type: 'json' };

function fill(clock,id) {
  for (let i=0;i<40;i++) { const result=clock.pour(id,.05); if(result) return result; }
  return null;
}
test('a vessel needs sustained contact; misses, release, and trigger latching cannot double-submit',()=> {
  const clock=new WaterFill(); clock.setQuestion('q1',['a','b']);
  assert.equal(clock.pour('miss',.05),null);
  assert.equal(clock.pour('a',.05,false),null);
  assert.equal(clock.levels.get('a'),0);
  clock.pour('a',.05); assert.ok(clock.levels.get('a')>0 && clock.levels.get('a')<1);
  assert.equal(fill(clock,'a'),'a'); assert.equal(fill(clock,'a'),null);
  clock.reject('a'); assert.equal(fill(clock,'a'),null);
  clock.release(); assert.equal(fill(clock,'b'),'b');
  clock.setQuestion('q2',['a','b']); assert.equal(fill(clock,'a'),null,'held trigger does not spill into the next question');
  clock.release(); assert.equal(fill(clock,'a'),'a');
  clock.reset(); assert.equal(clock.question,null); assert.equal(clock.levels.size,0);
});

test('water answers use the original errors, two-error hint, order and completion state',()=> {
  const session=new LessonSession(null,()=>.3), clock=new WaterFill();
  const answer=id=> {
    clock.setQuestion(session.current.id,session.choices.map(s=>s.id));
    const current=session.current.id, result=fill(clock,id);
    if (!result) return null;
    session.choose(result); return session.target(current);
  };
  const wrong=session.choices.find(s=>s.id!==session.current.id).id;
  assert.equal(answer(wrong).type,'wrong'); clock.reject(wrong); clock.release();
  assert.equal(answer(wrong).type,'wrong'); assert.equal(session.hasHint(),true); assert.equal(session.localCount,0);
  clock.release();
  while(!session.sceneComplete){
    const result=answer(session.current.id); assert.equal(result.type,'matched');
    assert.equal(session.finishReveal(result.token),true); clock.release();
  }
  assert.equal(session.localCount,4); assert.equal(session.unlocked,true);
  session.enter('talanta'); clock.reset();
  while(!session.sceneComplete){const result=answer(session.current.id);session.finishReveal(result.token);clock.release();}
  assert.equal(session.localCount,3); assert.equal(session.count,7);
});

test('the first crossing is ready and each answer opens only the next crossing',()=> {
  const scene=new THREE.Scene(), river=courtyardRiver(scene,0,3);
  assert.equal(river.canWalk(-5.5,3),true,'entry bridge starts open');
  assert.equal(river.onLand(-5.5,3),false,'the entry deck is distinct from the destination bank');
  for (const station of worlds.talanta.stations) assert.equal(river.onLand(...station.landing),true);
  assert.equal(river.canWalk(-3.15,.8),false); assert.equal(river.canWalk(3.15,.8),false);
  assert.equal(river.canWalk(5.5,3),false,'exit bridge starts closed');
  assert.equal(river.canWalk(0,3),false,'water outside a bridge stays blocked');
  river.update(1,1,1,true);
  assert.equal(river.canWalk(-3.15,.8),true); assert.equal(river.canWalk(3.15,.8),false);
  river.update(2,2,1,true); assert.equal(river.canWalk(3.15,.8),true); assert.equal(river.canWalk(5.5,3),false);
  river.update(3,3,1,true); assert.equal(river.canWalk(5.5,3),true);
  river.update(4,0,1,true); assert.equal(river.canWalk(-3.15,.8),false); assert.equal(river.canWalk(-5.5,3),true);
  const bridge=risingBridge(new THREE.Scene(),{from:[-4,-4],to:[4,4],segments:4,progress:2});
  assert.equal(bridge.panels.length,4); assert.equal(bridge.exclude.size,8,'two material batches per animated section');
  assert.equal(bridge.allows(-2,-2),true); assert.equal(bridge.allows(2,2),false);
});

test('the map opens the entry first, then one complete station crossing per answer',()=> {
  const config=worlds.main, hub=buildHub(new THREE.Scene(),config,{segments:4,progress:0});
  assert.equal(hub.bridges[0].panels[0].value,1);
  for(let count=0;count<=4;count++){
    hub.update(0,true,count,1);
    hub.bridges.forEach((bridge,index)=>assert.equal(bridge.panels[0].value,Number(index===0 || count>=index)));
  }
});

test('every map station activates at the incoming bridge entry, including the three side approaches',()=> {
  const config=worlds.main, hub=buildHub(new THREE.Scene(),config,{segments:4,progress:0});
  for(let index=0;index<config.stations.length;index++) {
    hub.update(0,true,index,1);
    const bridge=hub.bridges[index], approach=hub.approaches[index];
    const dx=bridge.to[0]-bridge.from[0],dz=bridge.to[1]-bridge.from[1],length=Math.hypot(dx,dz);
    const ux=dx/length,uz=dz/length;
    const entry=[bridge.from[0]+ux*.08,bridge.from[1]+uz*.08];
    assert.equal(approach.contains(...entry),true,config.stations[index].id+' bridge entry');
    for(const t of [.2,.5,.8,1]) assert.equal(approach.contains(bridge.from[0]+dx*t,bridge.from[1]+dz*t),true);
    assert.equal(approach.contains(...config.stations[index].position),true,'destination island stays active');
    assert.equal(approach.contains(...approach.viewpoint),true,'quick travel uses the same approach');
    assert.ok((approach.quizPosition[0]-bridge.to[0])*ux+(approach.quizPosition[1]-bridge.to[1])*uz>0,'vessels are ahead toward the station');
    if(index>0) assert.ok(Math.hypot(entry[0]-config.stations[index].landing[0],entry[1]-config.stations[index].landing[1])>2.5,'old landing-radius check missed this approach');
    if(index<config.stations.length-1) assert.equal(hub.approaches[index+1].contains(...config.stations[index+1].position),false,'future closed station stays locked');
  }
});

test('focus vessels activate on each incoming deck and remain active across its bank without leaking into earlier stages',()=> {
  const river=courtyardRiver(new THREE.Scene(),0,3);
  for(let index=0;index<3;index++) {
    river.update(0,index,1,true);
    const bridge=river.bridges[index],approach=river.approaches[index];
    const dx=bridge.to[0]-bridge.from[0],dz=bridge.to[1]-bridge.from[1];
    for(const t of [.02,.3,.7,1]) assert.equal(approach.contains(bridge.from[0]+dx*t,bridge.from[1]+dz*t),true,'entry through exit');
    assert.equal(approach.contains(...worlds.talanta.stations[index].landing),true,'bank stays active');
    assert.equal(approach.contains(...approach.viewpoint),true);
    if(index>0) {
      const earlier=river.bridges[index-1];
      assert.equal(approach.contains((earlier.from[0]+earlier.to[0])/2,(earlier.from[1]+earlier.to[1])/2),false,'previous bridge does not enable the next question');
    }
  }
});
