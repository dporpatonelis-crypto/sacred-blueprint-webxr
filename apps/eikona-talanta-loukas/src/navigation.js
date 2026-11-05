import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

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
  constructor(camera, renderer, world, obstacles, hooks) {
    this.camera = camera;
    this.renderer = renderer;
    this.world = world;
    this.obstacles = obstacles;
    this.hooks = hooks;
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
    this.spawn();
    document.addEventListener('keydown', e => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code) && this.enabled) {
        this.keys.add(e.code); e.preventDefault();
      }
      if (e.code === 'Escape') { this.keys.clear(); hooks.escape(); }
    });
    document.addEventListener('keyup', e => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.drag = null; });
    document.addEventListener('visibilitychange', () => this.keys.clear());
    renderer.domElement.addEventListener('pointerdown', e => {
      if (!this.enabled || renderer.xr.isPresenting || e.button !== 0) return;
      if (this.controls.isLocked) { hooks.pick(null); return; }
      this.drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moved: false };
      renderer.domElement.setPointerCapture(e.pointerId);
    });
    renderer.domElement.addEventListener('pointermove', e => {
      if (!this.drag) return;
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
  }
  update(dt) {
    if (!this.enabled || this.renderer.xr.isPresenting) return;
    const f = Number(this.keys.has('KeyW') || this.keys.has('ArrowUp')) - Number(this.keys.has('KeyS') || this.keys.has('ArrowDown'));
    const r = Number(this.keys.has('KeyD') || this.keys.has('ArrowRight')) - Number(this.keys.has('KeyA') || this.keys.has('ArrowLeft'));
    if (!f && !r) return;
    this.camera.getWorldDirection(this.forward); this.forward.y = 0; this.forward.normalize();
    this.right.crossVectors(this.forward, this.camera.up).normalize();
    this.travel.copy(this.forward).multiplyScalar(f).addScaledVector(this.right, r).normalize().multiplyScalar(3.0 * Math.min(dt, 0.04));
    const p = this.camera.position;
    if (allowedPosition(p.x + this.travel.x, p.z, this.world.bounds, this.obstacles, 0.34, this.world.walkable)) p.x += this.travel.x;
    if (allowedPosition(p.x, p.z + this.travel.z, this.world.bounds, this.obstacles, 0.34, this.world.walkable)) p.z += this.travel.z;
  }
  goTo(station) {
    const [x, z] = station.landing;
    this.camera.position.set(x, 1.65, z);
    this.camera.lookAt(station.position[0], 1.85, station.position[1]);
    this.keys.clear();
  }
}
