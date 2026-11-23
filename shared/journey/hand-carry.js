import * as THREE from 'three';

const pickReach = .16;
const dropReach = .21;

// Distances are measured to the physical surface, in metres after parent scaling.
export class HandCarry {
  constructor(scene) {
    this.point = new THREE.Vector3();
    this.local = new THREE.Vector3();
    this.held = null;
    this.contact = new THREE.Mesh(undefined, new THREE.MeshBasicMaterial({
      color: 0xffe397, opacity: .32, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false
    }));
    this.contact.visible = false;
    this.contact.renderOrder = 4;
    scene.add(this.contact);
  }

  nearest(point, objects, reach) {
    let best = null;
    let distance = reach * reach;
    for (const object of objects) {
      if (!object.visible || object.userData.disabled || object.userData.dropDisabled || object.userData.carried) continue;
      const local = object.worldToLocal(this.local.copy(point));
      const { width, height, innerRadius, outerRadius } = object.geometry.parameters;
      if (outerRadius !== undefined) {
        const radius = Math.hypot(local.x, local.y);
        const clamped = THREE.MathUtils.clamp(radius, innerRadius, outerRadius);
        local.set(radius ? local.x * clamped / radius : clamped, radius ? local.y * clamped / radius : 0, 0);
      } else {
        local.set(THREE.MathUtils.clamp(local.x, -width / 2, width / 2),
          THREE.MathUtils.clamp(local.y, -height / 2, height / 2), 0);
      }
      const measured = point.distanceToSquared(object.localToWorld(local));
      if (measured < distance) {
        best = object;
        distance = measured;
      }
    }
    return best;
  }

  near(pose, sources) {
    if (this.held || !pose.visible) return null;
    return this.nearest(pose.localToWorld(this.point.set(0, 0, -.07)), sources, pickReach);
  }

  grab(owner, key, pose, sources) {
    const object = this.near(pose, sources);
    if (!object) return false;
    this.held = {
      owner, key, pose, object, parent: object.parent,
      position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone()
    };
    object.userData.carried = true;
    pose.attach(object);
    return true;
  }

  target(targets) {
    if (!this.held?.pose.visible) return null;
    return this.nearest(this.held.object.getWorldPosition(this.point), targets, dropReach);
  }

  update(targets) {
    const target = this.target(targets);
    this.contact.visible = Boolean(target);
    if (target) {
      this.contact.geometry = target.geometry;
      this.contact.position.copy(target.localToWorld(this.local.set(0, 0, .055)));
      target.getWorldQuaternion(this.contact.quaternion);
      target.getWorldScale(this.contact.scale);
      this.contact.scale.multiplyScalar(1.045);
    }
  }

  release(owner, key, targets) {
    if (!this.held || this.held.owner !== owner || this.held.key !== key) return null;
    const { object } = this.held;
    const target = this.target(targets);
    this.restore(object.userData.action.type === 'tile');
    return { action: object.userData.action, target: target?.userData.action };
  }

  cancel(owner) {
    if (this.held && (!owner || this.held.owner === owner)) this.restore(false);
  }

  restore(keepDropPosition) {
    const { object, parent, position, quaternion, scale } = this.held;
    parent.attach(object);
    if (!keepDropPosition) object.position.copy(position);
    object.quaternion.copy(quaternion);
    object.scale.copy(scale);
    object.userData.carried = false;
    this.held = null;
    this.contact.visible = false;
  }
}
