import * as THREE from 'three';
import { panel, setText } from './text-panels.js';
import { WaterFill } from './water-fill.js';

export class WaterQuiz {
  constructor(scene, world, session, camera, onAnswer, approaches = []) {
    this.world = world; this.onAnswer = onAnswer; this.fill = new WaterFill();
    this.approaches = approaches;
    this.root = new THREE.Group(); scene.add(this.root);
    this.root.position.set(world.kind === 'hub' ? -.9 : -.8, world.kind === 'hub' ? .25 : .05, world.kind === 'hub' ? 5.7 : 4.3);
    this.root.scale.setScalar(world.kind === 'hub' ? .64 : .62);
    this.vessels = new Map(); this.pickables = []; this.lastQuestion = null; this.wrongUntil = new Map();
    const stone = new THREE.MeshStandardMaterial({ color: 0xa57743, roughness: .8 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8c57c, roughness: .45, metalness: .3 });
    session.choices.forEach((choice, i) => {
      const group = new THREE.Group(); group.position.x = (i - (session.choices.length - 1) / 2) * 1.4; this.root.add(group);
      const mesh = (geometry, material, y) => { const m = new THREE.Mesh(geometry, material); m.position.y = y; group.add(m); return m; };
      mesh(new THREE.CylinderGeometry(.2,.26,.4,16),stone,-.2);
      mesh(new THREE.CylinderGeometry(.45, .5, .13, 24), stone, .065);
      mesh(new THREE.CylinderGeometry(.37, .32, .83, 24, 1, true), new THREE.MeshPhysicalMaterial({ color: 0xc6f5eb, transparent: true, opacity: .22, roughness: .18, side: THREE.DoubleSide, depthWrite: false }), .57);
      const rim = mesh(new THREE.TorusGeometry(.37, .055, 8, 28), gold.clone(), .995); rim.rotation.x = Math.PI / 2;
      const liquidMaterial = new THREE.MeshStandardMaterial({ color: 0x39bfd0, transparent: true, opacity: .88, roughness: .19, metalness: .12 });
      const liquid = mesh(new THREE.CylinderGeometry(.335, .305, 1, 24), liquidMaterial, .14); liquid.scale.y = .001;
      const label = panel(choice.word, 1.33, .49, null, { dark: true }); label.position.set(0, 1.42, 0); group.add(label);
      const number = panel(String(i + 1), .25, .25, null, { dark: true, square: true }); number.position.set(0, .52, .381); group.add(number);
      const hit = mesh(new THREE.CylinderGeometry(.47, .47, 1.1, 16), new THREE.MeshBasicMaterial({ visible: false }), .55);
      hit.userData.action = { type: 'vessel', id: choice.id }; this.pickables.push(hit);
      this.vessels.set(choice.id, { group, liquid, label, hit, rim, fill: 0 });
    });
    this.question = panel('', 4.9, world.promptHeight || .64, null, { dark: true }); this.question.position.set(0, world.promptHeight ? 2.85 : 2.35, -.08); this.root.add(this.question);
    this.instruction = panel('Κράτησε τη βολή · γέμισε την απάντηση', 3.7, .38, null, { dark: true, small: true });
    this.instruction.position.set(0, -.01, .5); this.root.add(this.instruction);
    this.streamRoot = new THREE.Group(); scene.add(this.streamRoot);
    const dropMaterial = new THREE.MeshBasicMaterial({ color: 0x9bf3f4, toneMapped: false });
    this.drops = new THREE.InstancedMesh(new THREE.SphereGeometry(.035, 6, 4), dropMaterial, 44);
    this.drops.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.drops.frustumCulled = false; this.streamRoot.add(this.drops);
    this.splash = new THREE.Mesh(new THREE.TorusGeometry(.14, .022, 6, 20), dropMaterial); this.splash.rotation.x = Math.PI / 2; this.streamRoot.add(this.splash);
    this.matrix = new THREE.Matrix4(); this.point = new THREE.Vector3(); this.start = new THREE.Vector3(); this.end = new THREE.Vector3(); this.control = new THREE.Vector3();
    this.blaster = new THREE.Group(); this.blaster.position.set(.25, -.26, -.62); this.blaster.scale.setScalar(.6); camera.add(this.blaster);
    const toy = new THREE.MeshStandardMaterial({ color: 0x239d9d, roughness: .38, metalness: .12 });
    const piece = (geometry, material, x, y, z) => { const m = new THREE.Mesh(geometry, material); m.position.set(x,y,z); this.blaster.add(m); return m; };
    piece(new THREE.BoxGeometry(.13, .12, .26), toy, 0,0,0);
    const tank = piece(new THREE.CapsuleGeometry(.07, .15, 4, 10), gold, 0,.09,.045); tank.rotation.x = Math.PI / 2;
    const barrel = piece(new THREE.CylinderGeometry(.045,.055,.2,12), toy, 0,0,-.21); barrel.rotation.x = Math.PI / 2;
    const muzzle = piece(new THREE.TorusGeometry(.045,.012,6,16), gold,0,0,-.315);
    piece(new THREE.BoxGeometry(.07,.14,.08),toy,0,-.1,.06).rotation.x = -.3;
    this.nozzle = muzzle;
    this.sync(session);
  }
  sync(session) {
    session.choices.forEach((choice,index)=> {
      this.vessels.get(choice.id).group.position.x=(index-(session.choices.length-1)/2)*1.4;
    });
    if (!session.busy) this.fill.setQuestion(session.current?.id || null, session.choices.map(s => s.id));
    if (!session.busy && this.lastQuestion !== session.visibleStation.id) {
      const station = this.world.stations.find(s=>s.id===session.visibleStation.id);
      const approach = this.approaches[this.world.stations.indexOf(station)];
      const position = approach?.quizPosition || station.position;
      this.root.position.set(position[0],this.world.kind === 'hub' ? .4 : .3,position[1]);
      setText(this.question, session.visibleStation.prompt, { dark: true }); this.lastQuestion = session.visibleStation.id;
    }
    for (const [id, vessel] of this.vessels) vessel.hit.userData.disabled = session.solved(id);
  }
  reject(id, time) { this.fill.reject(id); this.wrongUntil.set(id, time + 950); }
  getTarget(id, out = new THREE.Vector3()) {
    const vessel = this.vessels.get(id); if (!vessel) return null;
    return vessel.group.localToWorld(out.set(0, 1.01, 0));
  }
  update(time, dt, session, cameraPosition, reduced, enabled, shot) {
    this.root.visible = enabled && !session.sceneComplete && !session.reviewId;
    this.blaster.visible = this.root.visible && !shot.xr;
    this.question.visible = this.instruction.visible = Boolean(shot.worldPrompt);
    if (this.root.visible) this.root.lookAt(cameraPosition.x, this.root.position.y, cameraPosition.z);
    // Propagate the billboard transform before evaluating mouths and raycasts.
    this.root.updateMatrixWorld(true);
    const id = shot.id, canFill = this.root.visible && !session.busy && !session.solved(id);
    const completed = shot.active ? this.fill.pour(id, dt, canFill) : null;
    if (completed) this.onAnswer(completed);
    for (const [choiceId, vessel] of this.vessels) {
      const solved = session.solved(choiceId), level = solved ? 1 : this.fill.levels.get(choiceId) || 0;
      vessel.fill = reduced ? level : THREE.MathUtils.damp(vessel.fill, level, 13, dt);
      const height = Math.max(.002, vessel.fill * .78);
      vessel.liquid.scale.y = height; vessel.liquid.position.y = .15 + height / 2;
      vessel.liquid.material.color.setHex(this.wrongUntil.get(choiceId) > time ? 0xe79264 : solved ? 0x83c778 : 0x39bfd0);
      vessel.rim.material.emissive.setHex(shot.active && id === choiceId ? 0x5b541e : 0x000000);
    }
    this.streamRoot.visible = this.root.visible && shot.active;
    if (!this.streamRoot.visible) return;
    if (shot.origin) this.start.copy(shot.origin); else this.nozzle.getWorldPosition(this.start);
    if (!this.getTarget(id, this.end)) {
      this.end.copy(shot.direction || new THREE.Vector3(0,0,-1)).multiplyScalar(5).add(this.start);
    }
    this.control.copy(this.start).lerp(this.end, .5); this.control.y += .25;
    for (let i = 0; i < this.drops.count; i++) {
      const t = reduced ? i / this.drops.count : ((time * .0017 + i / this.drops.count) % 1);
      this.point.copy(this.start).multiplyScalar((1-t)*(1-t)).addScaledVector(this.control,2*(1-t)*t).addScaledVector(this.end,t*t);
      this.matrix.makeScale(.65 + Math.sin(i * 3) * .18, .8, 1.25); this.matrix.setPosition(this.point); this.drops.setMatrixAt(i,this.matrix);
    }
    this.drops.instanceMatrix.needsUpdate = true;
    this.splash.visible = Boolean(id); this.splash.position.copy(this.end); this.splash.scale.setScalar(reduced ? 1 : 1 + Math.sin(time*.025)*.2);
  }
  dispose() { this.blaster.removeFromParent(); this.blaster.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); }
}
