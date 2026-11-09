import * as THREE from 'three';
import { panel } from '../../../shared/journey/text-panels.js';

/** Controller-accessible counterpart of the single native Menu button. */
export class XRMenu {
  constructor(scene, camera) {
    this.camera = camera;
    this.root = new THREE.Group();
    this.root.visible = false;
    scene.add(this.root);
    this.toggle = panel('Μενού', .65, .24, {type:'xr-menu'}, {dark:true});
    this.toggle.position.set(.65, -.5, -1.65);
    this.toggle.material.depthTest = false; this.toggle.renderOrder = 1000;
    this.toggle.visible = false;
    camera.add(this.toggle);
    this.buttons = [];
    this.direction = new THREE.Vector3();
    this.head = new THREE.Vector3();
  }
  get opened() { return this.root.visible; }
  get pickables() { return this.toggle.visible ? [this.toggle, ...(this.opened ? this.buttons : [])] : []; }
  enable(value) { this.toggle.visible = value; if (!value) this.close(); }
  close() { this.root.visible = false; }
  clear() {
    this.root.traverse(o => { o.geometry?.dispose(); if(o.material) { o.material.map?.dispose(); o.material.dispose(); } });
    this.root.clear(); this.buttons = [];
  }
  show(title, copy, items, reading = false) {
    const alreadyOpen = this.opened;
    this.clear();
    const background = panel('', 4.35, reading ? 3.1 : 3.5, null, {dark:true});
    background.position.set(0, -.05, -.035); this.root.add(background);
    const heading = panel(title, 4.05, .45, null, {dark:true}); heading.position.y = 1.25; this.root.add(heading);
    const text = panel(copy, 4.05, reading ? 1.5 : .8, null, {dark:true,paragraph:true});
    text.position.y = reading ? .22 : .57; this.root.add(text);
    items.forEach((item, index) => {
      const button = panel(item.label, 1.92, .38, item.action, {dark:true});
      button.position.set(index % 2 ? 1.02 : -1.02, (reading ? -.88 : -.08) - Math.floor(index / 2) * .46, .015);
      this.buttons.push(button); this.root.add(button);
    });
    this.camera.getWorldPosition(this.head);
    if (!alreadyOpen) {
      this.camera.getWorldDirection(this.direction); this.direction.y = 0;
      if(this.direction.lengthSq() < .001) this.direction.set(0,0,-1);
      this.direction.normalize();
      this.root.position.copy(this.head).addScaledVector(this.direction, 3.2);
      this.root.position.y = Math.max(1.55, this.head.y + .1);
    }
    this.root.lookAt(this.head);
    this.root.visible = true;
  }
  update(head) { if(this.opened) this.root.lookAt(head); }
}
