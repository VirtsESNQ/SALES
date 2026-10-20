// Camera rig. Views: chase (orbitable command view), with target/tactical/scope/bridge added by
// later systems through registerView(). Looking and aiming are separate from steering:
//   - NAVIGATION: drag with the left button (or middle button anywhere) to orbit the view.
//   - COMBAT / PRECISION: the cursor is the aim; pushing it toward the screen edge pans the view.
//   - Mouse steering (toggle): the hull turns toward the cursor; the view trails behind the ship.
import * as THREE from 'three';
import { bus, settings, clamp, damp } from './core.js';

const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _ray = new THREE.Raycaster();

export class CameraRig {
  constructor(engine, game) {
    this.engine = engine;
    this.game = game;
    this.cam = engine.camera;
    this.view = 'chase';
    this.views = { chase: this };
    this.yaw = Math.PI; this.pitch = 0.22; this.zoom = 1;
    this.target = new THREE.Vector3();
    this.shakeAmp = 0; this.shakeT = 0;
    this.dragging = false; this.dragBtn = -1;
    this.looking = false; // true while the player is actively turning the view
    bus.on('pointerdown', ({ button }) => {
      if (button === 1 || (button === 0 && this.game.mode === 'nav' && !settings.mouseSteer)) { this.dragging = true; this.dragBtn = button; }
    });
    bus.on('pointerup', ({ button }) => { if (button === this.dragBtn) { this.dragging = false; this.dragBtn = -1; } });
    bus.on('wheel', ({ dir }) => { if (this.view === 'chase' && !this.game.scopeActive) this.zoom = clamp(this.zoom * (dir > 0 ? 1.12 : 1 / 1.12), 0.35, 4.5); });
    bus.on('shake', ({ amount }) => this.shake(amount));
  }
  registerView(name, view) { this.views[name] = view; }
  setView(name) {
    if (!this.views[name] || name === this.view) return;
    this.views[this.view]?.exit?.();
    this.view = name;
    this.views[name]?.enter?.();
    bus.emit('view', name);
  }
  /** Turn the chase view to sit behind the ship. */
  recenter() {
    const s = this.game.player;
    if (!s) return;
    this.yaw = s.heading() + Math.PI + 0.5; this.pitch = 0.3;
  }
  shake(amount) {
    if (!settings.shakeOn) return;
    this.shakeAmp = Math.min(1, this.shakeAmp + amount * settings.shake);
  }
  /** Ray from the camera through the cursor (the aim). */
  aimRay() {
    const m = this.engine.input.mouse;
    _ray.setFromCamera({ x: m.nx, y: m.ny }, this.cam);
    return _ray.ray;
  }

  update(dt) {
    const v = this.views[this.view];
    if (v !== this) v.update(dt);
    else this.updateChase(dt);
    // restrained shake: small, decays fast, never on by default for light hits
    if (this.shakeAmp > 0.001) {
      this.shakeT += dt * 38;
      const a = this.shakeAmp * this.shakeAmp * 0.006;
      this.cam.rotation.x += Math.sin(this.shakeT * 1.3) * a;
      this.cam.rotation.y += Math.sin(this.shakeT * 1.7 + 1) * a;
      this.shakeAmp = Math.max(0, this.shakeAmp - dt * 1.6);
    }
  }

  updateChase(dt) {
    const s = this.game.player;
    if (!s) return;
    const inp = this.engine.input, m = inp.mouse;
    this.looking = false;
    if (this.dragging) {
      this.yaw -= m.dx * 0.0042; this.pitch = clamp(this.pitch + m.dy * 0.0036, -1.2, 1.35);
      this.looking = m.dx !== 0 || m.dy !== 0;
    } else if (settings.mouseSteer) {
      // view trails behind the hull while the hull follows the cursor
      const want = s.heading() + Math.PI;
      let d = want - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-1.2 * dt));
    } else if (this.game.mode !== 'nav' && m.overCanvas) {
      // edge pan: the further past the dead zone, the faster the view turns toward the cursor
      const dead = 0.55, r = Math.hypot(m.nx, m.ny);
      if (r > dead) {
        const k = Math.min(1, (r - dead) / (1 - dead)) ** 2 * 1.1 * dt;
        this.yaw -= (m.nx / r) * k;
        this.pitch = clamp(this.pitch - (m.ny / r) * k * 0.7, -1.2, 1.35);
        this.looking = true;
      }
    }
    // keyboard-free orbit nudge (optional keys)
    const R = s.radius;
    _t.copy(s.pos).addScaledVector(s.up(_v), R * 0.1);
    this.target.lerp(_t, 1 - Math.exp(-8 * dt));
    if (this.target.distanceToSquared(_t) > R * R * 4) this.target.copy(_t);
    const dist = R * 1.5 * this.zoom;
    const cp = Math.cos(this.pitch);
    this.cam.position.set(
      this.target.x + Math.sin(this.yaw) * cp * dist,
      this.target.y + Math.sin(this.pitch) * dist,
      this.target.z + Math.cos(this.yaw) * cp * dist,
    );
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.target);
    if (this.cam.fov !== 55) { this.cam.fov = damp(this.cam.fov, 55, 10, dt); this.cam.updateProjectionMatrix(); }
  }
}
