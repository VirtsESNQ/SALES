// Camera rig. Views: chase (orbitable command view), with target/tactical/scope/bridge added by
// later systems through registerView(). Looking and aiming are separate from steering:
//   - NAVIGATION: drag with the left button (or middle button anywhere) to orbit the view.
//   - COMBAT / PRECISION: the cursor is the aim; pushing it toward the screen edge pans the view.
//   - Mouse steering (toggle): the hull turns toward the cursor; the view trails behind the ship.
import * as THREE from 'three';
import { bus, settings, clamp, damp, DEG } from './core.js';

const _v = new THREE.Vector3(), _t = new THREE.Vector3(), _up = new THREE.Vector3(), _ray = new THREE.Raycaster();

/** Gunnery scope (hold right mouse): looks along the selected battery with 2–10× zoom. */
class ScopeView {
  constructor(rig) {
    this.rig = rig; this.game = rig.game;
    this.zoom = 4; this.yaw = 0; this.pitch = 0; this.range = 9000;
    this.el = document.createElement('div');
    this.el.className = 'scope';
    const ticks = [];
    for (let i = -10; i <= 10; i++) if (i) ticks.push(`<path d="M${i * 20} -${i % 5 ? 4 : 9}V${i % 5 ? 4 : 9}"/><path d="M-${i % 5 ? 4 : 9} ${i * 20}H${i % 5 ? 4 : 9}"/>`);
    this.el.innerHTML = `<div class="scope-mask"></div><svg viewBox="-250 -250 500 500"><circle r="246"/><path d="M-246 0H-14M14 0H246M0 -246V-14M0 14V246"/>${ticks.join('')}<circle r="3"/><text x="104" y="-6">10</text><text x="204" y="-6">20</text></svg>
      <div class="scope-read"><span><small>RANGE</small><b class="sc-r">—</b></span><span><small>ZOOM</small><b class="sc-z"></b></span><span><small>MIL</small><b>0.5/tick</b></span></div>`;
    document.getElementById('ui').appendChild(this.el);
    bus.on('wheel', ({ dir }) => { if (this.game.scopeActive) this.zoom = clamp(this.zoom * (dir > 0 ? 1 / 1.25 : 1.25), 2, 10); });
  }
  enter() {
    // open looking from the battery straight at the current aim point (no parallax jump)
    const W = this.game.weapons, dir = _t;
    if (this.game.player && W.hasManualAim) dir.subVectors(W.manualAim, this.eye(_v)).normalize();
    else dir.copy(this.rig.aimRay().direction);
    this.yaw = Math.atan2(dir.x, dir.z);
    this.pitch = Math.asin(clamp(dir.y, -1, 1));
    this.el.classList.add('on');
    document.body.classList.add('scoped');
    // drop mouse movement accumulated before the scope opened
    const m = this.game.engine.input.mouse; m.dx = 0; m.dy = 0;
  }
  exit() { this.el.classList.remove('on'); document.body.classList.remove('scoped'); this.rig.scopeAim = null; }
  /** World position of the scope: the first live mount of the selected battery. */
  eye(out) {
    const g = this.game, p = g.player, W = g.weapons;
    const t = p.mounts.find((m) => m.alive && m.type === W.selected) || null;
    if (t) { W.muzzle(p, t, 0, out); out.addScaledVector(p.up(_up), 12); }
    else p.toWorld(p.design.bridge, out);
    return out;
  }
  update(dt) {
    const g = this.game, p = g.player, cam = this.rig.cam, m = g.engine.input.mouse;
    if (!p) return;
    const fov = 55 / this.zoom;
    const sens = 0.0025 * (fov / 55) * (g.mode === 'precision' ? 0.4 : 1);
    this.yaw -= m.dx * sens; this.pitch = clamp(this.pitch - m.dy * sens, -1.4, 1.4);
    this.eye(cam.position);
    const dir = _t.set(Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), Math.cos(this.yaw) * Math.cos(this.pitch));
    cam.up.set(0, 1, 0);
    cam.lookAt(_v.copy(cam.position).add(dir));
    if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
    // rangefinder: first hull along the line of sight, else the target's range
    const far = _v.copy(cam.position).addScaledVector(dir, 40000);
    let best = null;
    for (const s of g.ships) { if (s === p || !s.alive) continue; const h = s.raycast(cam.position, far, true); if (h && (!best || h.t < best.t)) best = h; }
    const tg = p.target && p.target.alive ? p.target : null;
    this.range = best ? best.t * 40000 : tg ? tg.pos.distanceTo(cam.position) : 9000;
    this.rig.scopeAim = (this.rig.scopeAim || new THREE.Vector3()).copy(cam.position).addScaledVector(dir, this.range);
    // firing solution when the lead marker sits on the cross
    const lead = g.weapons.leadFor(g.weapons.selected);
    this.rig.scopeSolution = false;
    if (lead) {
      const ang = dir.angleTo(_v.subVectors(lead, cam.position));
      if (ang < (fov * DEG) * 0.02) { this.rig.scopeSolution = true; this.rig.scopeAim.copy(lead); }
    }
    this.el.querySelector('.sc-r').textContent = best || tg ? `${(this.range / 1000).toFixed(2)} km` : '—';
    this.el.querySelector('.sc-z').textContent = `${this.zoom.toFixed(1)}×`;
  }
}

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
    this.registerView('scope', new ScopeView(this));
    // scope: hold the right mouse button on the battlefield
    bus.on('pointerdown', ({ button }) => {
      if (button !== 2 || !this.game.player?.alive || this.view === 'bridge') return;
      this.prevView = this.view;
      this.game.scopeActive = true;
      this.setView('scope');
      try { const r = engine.canvas.requestPointerLock?.(); r?.catch?.(() => {}); } catch { /* pointer lock unavailable */ }
    });
    bus.on('pointerup', ({ button }) => {
      if (button !== 2 || !this.game.scopeActive) return;
      this.game.scopeActive = false;
      this.setView(this.prevView || 'chase');
      try { if (document.pointerLockElement) document.exitPointerLock(); } catch { /* ignore */ }
    });
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
      // only the outer band of the screen turns the view, so aiming off-centre never drifts it
      const dead = 0.86, r = Math.max(Math.abs(m.nx), Math.abs(m.ny));
      if (r > dead) {
        const k = Math.min(1, (r - dead) / (1 - dead)) ** 1.5 * 1.2 * dt;
        this.yaw -= (m.nx / r) * k;
        this.pitch = clamp(this.pitch - (m.ny / r) * k * 0.7, -1.2, 1.35);
        this.looking = true;
      }
    }
    // after a few seconds without look input, drift back to the quarter view behind the hull
    this.idleT = this.looking ? 0 : (this.idleT || 0) + dt;
    if (this.idleT > 6 && !settings.mouseSteer) {
      let d = s.heading() + Math.PI + 0.5 - this.yaw; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.yaw += d * (1 - Math.exp(-0.35 * dt));
      this.pitch += (0.3 - this.pitch) * (1 - Math.exp(-0.35 * dt));
    }
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
