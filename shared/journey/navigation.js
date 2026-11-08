import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

function readXRStick(input, target) {
  const axes = input?.gamepad?.axes || [];
  // xr-standard reserves 0/1 for a touchpad and 2/3 for a thumbstick.
  // Controllers with just one pair expose that pair at 0/1.
  const offset = axes.length >= 4 ? 2 : 0;
  target.set(axes[offset] || 0, axes[offset + 1] || 0);
}

export function allowedPosition(x, z, bounds, obstacles, radius = 0.34, walkable = null) {
  if (x < bounds.minX + radius || x > bounds.maxX - radius || z < bounds.minZ + radius || z > bounds.maxZ - radius) return false;
  if (walkable && !walkable.circles.some(c => Math.hypot(x - c.x, z - c.z) <= c.radius - radius) &&
      !walkable.paths.some(p => {
        const dx = p.to[0] - p.from[0], dz = p.to[1] - p.from[1];
        const t = THREE.MathUtils.clamp(((x - p.from[0]) * dx + (z - p.from[1]) * dz) / (dx * dx + dz * dz), 0, 1);
        return Math.hypot(x - p.from[0] - t * dx, z - p.from[1] - t * dz) <= p.width / 2 - radius;
      })) return false;
  return !obstacles.some(o => o.type === 'circle'
    ? Math.hypot(x - o.x, z - o.z) < o.radius + radius
    : x > o.minX - radius && x < o.maxX + radius && z > o.minZ - radius && z < o.maxZ + radius);
}

export class Navigation {
  constructor(camera, renderer, world, obstacles, hooks, rig = camera.parent) {
    this.camera = camera;
    this.renderer = renderer;
    this.world = world;
    this.obstacles = obstacles;
    this.hooks = hooks;
    this.rig = rig;
    this.keys = new Set();
    this.enabled = false;
    this.controls = new PointerLockControls(camera, renderer.domElement);
    this.controls.pointerSpeed = 0.8;
    this.controls.minPolarAngle = 0.2;
    this.controls.maxPolarAngle = Math.PI - 0.2;
    this.drag = null;
    this.lastMoved = 0;
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.travel = new THREE.Vector3();
    this.headPosition = new THREE.Vector3();
    this.xrMoveAxes = new THREE.Vector2();
    this.xrTurnAxes = new THREE.Vector2();
    this.turnLatched = false;
    this.xrLanding = null;
    this.touchAxes = new THREE.Vector2();
    this.touchPointer = null;
    this.touchPad = document.getElementById('touch-walk');
    this.touchBase = this.touchPad?.querySelector('.touch-walk-pad');
    this.touchStick = document.getElementById('touch-walk-stick');
    this.spawn();
    document.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code) && this.enabled) {
        this.keys.add(e.code); e.preventDefault();
      }
      if (e.code === 'Escape') { this.keys.clear(); hooks.escape(); }
    });
    document.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => {
      this.keys.clear(); this.drag = null; this.clearTouchWalk();
    });
    document.addEventListener('visibilitychange', () => {
      this.keys.clear(); this.clearTouchWalk();
    });
    this.touchPad?.addEventListener('pointerdown', e => {
      if (!this.enabled || renderer.xr.isPresenting || e.button !== 0 || this.touchPointer !== null) return;
      e.preventDefault(); e.stopPropagation();
      this.touchPointer = e.pointerId;
      this.touchPad.setPointerCapture(e.pointerId);
      this.updateTouchAxes(e);
    });
    this.touchPad?.addEventListener('pointermove', e => {
      if (e.pointerId !== this.touchPointer) return;
      e.preventDefault(); e.stopPropagation();
      this.updateTouchAxes(e);
    });
    const stopTouchWalk = e => {
      if (e.pointerId !== this.touchPointer) return;
      e.preventDefault(); e.stopPropagation();
      this.clearTouchWalk();
    };
    this.touchPad?.addEventListener('pointerup', stopTouchWalk);
    this.touchPad?.addEventListener('pointercancel', stopTouchWalk);
    this.touchPad?.addEventListener('lostpointercapture', stopTouchWalk);
    renderer.domElement.addEventListener('pointerdown', e => {
      if (!this.enabled || renderer.xr.isPresenting || e.button !== 0) return;
      if (this.controls.isLocked) { hooks.pick(null); return; }
      this.drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
      renderer.domElement.setPointerCapture(e.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', e => {
      if (!this.drag || !this.enabled || renderer.xr.isPresenting) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      this.drag.moved ||= Math.hypot(e.clientX - this.drag.startX, e.clientY - this.drag.startY) > 5;
      const rotation = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
      rotation.y -= dx * 0.004;
      rotation.x = THREE.MathUtils.clamp(rotation.x - dy * 0.004, -1.25, 1.25);
      camera.quaternion.setFromEuler(rotation);
      this.drag.x = e.clientX; this.drag.y = e.clientY;
    });
    renderer.domElement.addEventListener('pointerup', e => {
      if (!this.drag) return;
      const moved = this.drag.moved;
      this.drag = null;
      if (renderer.domElement.hasPointerCapture(e.pointerId)) renderer.domElement.releasePointerCapture(e.pointerId);
      if (!moved) hooks.pick({ x: e.clientX, y: e.clientY });
    });
    renderer.domElement.addEventListener('pointercancel', () => { this.drag = null; });
    this.controls.addEventListener('lock', () => hooks.lock(true));
    this.controls.addEventListener('unlock', () => { this.keys.clear(); hooks.lock(false); });
  }
  spawn() {
    this.camera.position.set(this.world.spawn[0], 1.65, this.world.spawn[1]);
    this.camera.lookAt(...(this.world.lookAt || [0, 1.65, -5]));
    this.keys.clear();
    this.clearTouchWalk();
  }
  clearTouchWalk() {
    const pointerId = this.touchPointer;
    this.touchPointer = null;
    this.touchAxes.set(0, 0);
    if (this.touchStick) this.touchStick.style.transform = '';
    if (pointerId !== null && this.touchPad?.hasPointerCapture(pointerId)) {
      this.touchPad.releasePointerCapture(pointerId);
    }
  }
  updateTouchAxes(event) {
    if (!this.touchBase) return;
    const rect = this.touchBase.getBoundingClientRect();
    const handleSize = this.touchStick?.getBoundingClientRect().width || 38;
    const radius = Math.max(1, (Math.min(rect.width, rect.height) - handleSize) / 2 - 3);
    const dx = event.clientX - (rect.left + rect.width / 2);
    const dy = event.clientY - (rect.top + rect.height / 2);
    const length = Math.hypot(dx, dy);
    const amount = Math.min(length / radius, 1);
    const deadZone = 0.12;
    const strength = amount <= deadZone ? 0 : (amount - deadZone) / (1 - deadZone);
    this.touchAxes.set(
      length ? dx / length * strength : 0,
      length ? dy / length * strength : 0,
    );
    const offset = Math.min(length, radius);
    const x = length ? dx / length * offset : 0;
    const y = length ? dy / length * offset : 0;
    if (this.touchStick) this.touchStick.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, 0)`;
  }
  update(dt) {
    if (this.renderer.xr.isPresenting) {
      this.keys.clear();
      this.clearTouchWalk();
      this.drag = null;
      // Refresh the tracked pose before movement, proximity checks and rays.
      // The XR ArrayCamera has no rig parent; use the scene camera for world poses.
      this.rig.updateMatrixWorld(true);
      this.renderer.xr.updateCamera(this.camera);
      const session = this.renderer.xr.getSession();
      if (!this.enabled || !session || session.visibilityState !== 'visible') {
        this.turnLatched = false;
        return;
      }
      if (this.xrLanding) {
        // Place the headset itself on the landing, including its room-scale offset.
        this.camera.getWorldPosition(this.headPosition);
        this.rig.position.x += this.xrLanding.x - this.headPosition.x;
        this.rig.position.z += this.xrLanding.y - this.headPosition.z;
        this.xrLanding = null;
        this.rig.updateMatrixWorld(true);
        this.renderer.xr.updateCamera(this.camera);
      }
      this.updateXR(dt, session);
      return;
    }
    this.turnLatched = false;
    this.xrLanding = null;
    if (!this.enabled) {
      this.keys.clear();
      this.clearTouchWalk();
      this.drag = null;
      return;
    }
    const f = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) -
      Number(this.keys.has('KeyS') || this.keys.has('ArrowDown')) - this.touchAxes.y;
    const r = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) -
      Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft')) + this.touchAxes.x;
    this.walk(f, r, dt, 3.0, this.camera);
  }
  updateXR(dt, session) {
    this.xrMoveAxes.set(0, 0);
    this.xrTurnAxes.set(0, 0);
    // Roles depend on handedness, never on connection order or an idle axis.
    for (const input of session.inputSources) {
      if (!input.gamepad) continue;
      if (input.handedness === 'left') readXRStick(input, this.xrMoveAxes);
      if (input.handedness === 'right') readXRStick(input, this.xrTurnAxes);
    }
    const turn = this.xrTurnAxes.x;
    if (Math.abs(turn) > 0.72 && !this.turnLatched) {
      const delta = -Math.sign(turn) * Math.PI / 4;
      this.camera.getWorldPosition(this.headPosition);
      this.rig.position.sub(this.headPosition).applyAxisAngle(THREE.Object3D.DEFAULT_UP, delta).add(this.headPosition);
      this.rig.rotation.y += delta;
      this.rig.updateMatrixWorld(true);
      this.turnLatched = true;
    } else if (Math.abs(turn) < 0.3) this.turnLatched = false;

    const length = this.xrMoveAxes.length(), deadZone = 0.18;
    if (length > deadZone) {
      const strength = (Math.min(length, 1) - deadZone) / (1 - deadZone);
      this.walk(-this.xrMoveAxes.y / length * strength, this.xrMoveAxes.x / length * strength, dt, 2.0, this.rig);
    }
    this.rig.updateMatrixWorld(true);
    this.renderer.xr.updateCamera(this.camera);
  }
  walk(f, r, dt, speed, mover) {
    if (Math.abs(f) < 0.001 && Math.abs(r) < 0.001) return;
    this.camera.getWorldDirection(this.forward); this.forward.y = 0; this.forward.normalize();
    this.right.crossVectors(this.forward, this.camera.up).normalize();
    this.travel.copy(this.forward).multiplyScalar(f).addScaledVector(this.right, r);
    if (this.travel.lengthSq() > 1) this.travel.normalize();
    this.travel.multiplyScalar(speed * Math.min(dt, 0.04));
    this.camera.getWorldPosition(this.headPosition);
    const p = this.headPosition;
    if (allowedPosition(p.x + this.travel.x, p.z, this.world.bounds, this.obstacles, 0.34, this.world.walkable) && this.hooks.canWalk?.(p.x + this.travel.x,p.z) !== false) {
      mover.position.x += this.travel.x; p.x += this.travel.x;
    }
    if (allowedPosition(p.x, p.z + this.travel.z, this.world.bounds, this.obstacles, 0.34, this.world.walkable) && this.hooks.canWalk?.(p.x,p.z + this.travel.z) !== false) mover.position.z += this.travel.z;
  }
  landXR(point) {
    // Apply on the next XR frame, once the current tracked pose is available.
    this.xrLanding = new THREE.Vector2(point[0], point[1]);
  }
  goTo(station) {
    const [x, z] = station.landing;
    this.camera.position.set(x, 1.65, z);
    this.camera.lookAt(station.position[0], station.lookHeight ?? 1.0, station.position[1]);
    this.clearTouchWalk();
    this.keys.clear();
  }
}
