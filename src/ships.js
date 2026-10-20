// Ship entity: physics/inertia and helm (shared by player and AI), engine FX, turret pose.
// Damage model fields (shields, armour, subsystems) are filled in by the damage system.
import * as THREE from 'three';
import { DEG, clamp, bus } from './core.js';
import { CLASSES } from './data/ships.js';
import { instantiateShip, turretMatrices } from './models.js';

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _e = new THREE.Euler();
const _b = new THREE.Matrix4(), _p = new THREE.Matrix4();
export const AX_Y = new THREE.Vector3(0, 1, 0);

/** Throttle detents: Full Reverse / Stop / 25 / 50 / 75 / 100 (Boost is a separate switch). */
export const DETENTS = [
  { label: 'FULL REV', value: -0.4 }, { label: 'STOP', value: 0 }, { label: '25%', value: 0.25 },
  { label: '50%', value: 0.5 }, { label: '75%', value: 0.75 }, { label: '100%', value: 1 },
];

let NEXT_ID = 1;
export class Ship {
  constructor(cls, { name, team, position, heading = 0, scene, turrets }) {
    this.id = NEXT_ID++;
    this.cls = cls;
    this.C = CLASSES[cls];
    this.name = name;
    this.team = team;                 // 'concord' | 'hegemony'
    this.faction = this.C.faction;
    this.model = instantiateShip(cls);
    this.design = this.model.design;
    this.root = this.model.root;
    this.root.position.copy(position);
    this.root.rotation.set(0, heading, 0, 'YXZ');
    scene.add(this.root);
    this.root.updateMatrixWorld(true);
    this.inv = new THREE.Matrix4().copy(this.root.matrixWorld).invert();
    this.radius = this.design.radius;
    this.length = this.design.length;

    // motion state
    this.vel = new THREE.Vector3();
    this.angVel = new THREE.Vector3();   // local rad/s: x pitch (+ nose down), y yaw (+ left), z roll
    this.detent = 1;                     // index into DETENTS
    this.throttle = 0;
    this.boost = false; this.boosting = false; this.boostHeat = 0; this.boostLock = false;
    this.ctl = { yaw: 0, pitch: 0, roll: 0, vert: 0, lat: 0, steer: null, level: false, hold: null, slowdown: false, sens: 1 };

    // health (the damage system owns these)
    this.alive = true; this.dying = false; this.gone = false;
    this.hull = this.C.hull; this.maxHull = this.C.hull;
    this.maxShield = this.C.shield;
    this.shields = [this.C.shield, this.C.shield, this.C.shield, this.C.shield]; // fore, aft, port, stbd
    this.subs = {};
    for (const [k, s] of Object.entries(this.C.subsystems)) this.subs[k] = { hp: s.hp, max: s.hp, offline: 0, pos: this.design.subsystems[k]?.clone() || new THREE.Vector3() };

    // turrets: one entry per mount (fixed fittings have no turret handle)
    this.turretRenderer = turrets;
    this.mounts = this.design.mounts.map((m, i) => ({
      i, m, type: m.type, alive: true, hp: 1,
      yaw: 0, pitch: 0.04, recoil: 0,
      h: turrets ? turrets.alloc(m.type, this.faction) : null,
    }));
  }

  /* ---- frames & helpers ---- */
  get pos() { return this.root.position; }
  get quat() { return this.root.quaternion; }
  fwd(out = new THREE.Vector3()) { return out.set(0, 0, 1).applyQuaternion(this.root.quaternion); }
  up(out = new THREE.Vector3()) { return out.set(0, 1, 0).applyQuaternion(this.root.quaternion); }
  right(out = new THREE.Vector3()) { return out.set(-1, 0, 0).applyQuaternion(this.root.quaternion); }
  toWorld(local, out = new THREE.Vector3()) { return out.copy(local).applyMatrix4(this.root.matrixWorld); }
  toLocal(world, out = new THREE.Vector3()) { return out.copy(world).applyMatrix4(this.inv); }
  heading() { const f = this.fwd(_v1); return Math.atan2(f.x, f.z); }
  speed() { return this.vel.dot(this.fwd(_v2)); }
  /** 0..1 engine effectiveness (damage system overrides via subsystem state). */
  engineFactor() {
    const e = this.subs.engines;
    if (!e) return 1;
    if (e.offline > 0) return 0.15;
    return 0.35 + 0.65 * (e.hp / e.max);
  }

  /* ---- helm ---- */
  setDetent(i) {
    this.detent = clamp(i, 0, DETENTS.length - 1);
    this.ctl.slowdown = false;
    bus.emit('helm', { ship: this, what: 'detent' });
  }
  /** Engage controlled slowdown: throttle to STOP with full retro thrust. */
  slowdown() { this.detent = 1; this.ctl.slowdown = true; bus.emit('helm', { ship: this, what: 'slowdown' }); }

  physics(dt) {
    const C = this.C, c = this.ctl, ef = this.engineFactor(), q = this.root.quaternion;
    this.throttle = DETENTS[this.detent].value;
    // linear motion in the ship frame
    const vl = _v1.copy(this.vel).applyQuaternion(_q1.copy(q).invert());
    let boost = this.boost && !this.boostLock && this.throttle > 0;
    const top = boost ? (C.boostSpeed || C.maxSpeed * 1.45) : C.maxSpeed;
    const target = this.throttle * top * ef;
    const braking = vl.z > target;
    const acc = C.accel * ef * (boost ? 1.8 : 1) * (braking ? (c.slowdown ? 2.2 : 1.25) : 1);
    vl.z = approach(vl.z, target, acc * dt);
    // lateral drift bleeds off slowly: big ships slide through their turns
    vl.x = approach(vl.x, c.lat * C.vert * ef, C.accel * 0.3 * dt);
    vl.y = approach(vl.y, c.vert * C.vert * ef, C.accel * 0.45 * dt);
    if (c.slowdown && Math.abs(vl.z) < 0.5) c.slowdown = false;
    this.vel.copy(vl.applyQuaternion(q));
    this.boostHeat = clamp(this.boostHeat + (boost ? dt / 9 : -dt / 14), 0, 1.05);
    if (this.boostHeat >= 1 && !this.boostLock) { this.boostLock = true; bus.emit('overheat', { ship: this }); }
    if (this.boostHeat < 0.35) this.boostLock = false;
    this.boosting = boost && !this.boostLock;

    // angular motion
    const sens = c.sens;
    let tYaw = c.yaw * C.yawRate * DEG * ef * sens;
    let tPitch = c.pitch * C.pitchRate * DEG * ef * sens;
    let tRoll = c.roll * C.rollRate * DEG * ef * sens;
    const steer = c.steer || c.hold;
    if (steer && c.yaw === 0 && c.pitch === 0) { // steer toward a world direction (autopilot / AI / mouse steering)
      const dl = _v2.copy(steer).applyQuaternion(_q1.copy(q).invert());
      const ey = Math.atan2(dl.x, dl.z), ep = Math.atan2(dl.y, Math.hypot(dl.x, dl.z));
      // proportional with braking margin so the hull settles without overshooting
      const kp = 1.6 * sens;
      tYaw = clamp(ey * kp, -1, 1) * C.yawRate * DEG * ef * sens;
      tPitch = clamp(-ep * kp, -1, 1) * C.pitchRate * DEG * ef * sens;
    }
    if (c.level) { // auto-level: roll and pitch back to the battle plane
      const upL = _v2.copy(AX_Y).applyQuaternion(_q1.copy(q).invert());
      const rollErr = Math.atan2(upL.x, upL.y);
      const f = this.fwd(_v1);
      tRoll = clamp(-rollErr * 1.5, -1, 1) * C.rollRate * DEG;
      if (c.pitch === 0 && !steer) tPitch = clamp(f.y * 2.5, -1, 1) * C.pitchRate * DEG;
      if (Math.abs(rollErr) < 0.004 && Math.abs(f.y) < 0.004 && !steer) { c.level = false; bus.emit('helm', { ship: this, what: 'levelled' }); }
    }
    const aY = C.yawAcc * DEG * ef * dt, aP = C.yawAcc * 0.8 * DEG * ef * dt, aR = C.yawAcc * 1.2 * DEG * ef * dt;
    this.angVel.y = approach(this.angVel.y, tYaw, aY);
    this.angVel.x = approach(this.angVel.x, tPitch, aP);
    this.angVel.z = approach(this.angVel.z, tRoll, aR);
    _q1.setFromEuler(_e.set(this.angVel.x * dt, this.angVel.y * dt, this.angVel.z * dt, 'YXZ'));
    q.multiply(_q1).normalize();
    this.root.position.addScaledVector(this.vel, dt);
  }

  update(dt) {
    if (this.gone) return;
    if (!this.dying) this.physics(dt);
    this.root.updateMatrixWorld();
    this.inv.copy(this.root.matrixWorld).invert();
    // engines visibly intensify with thrust and while turning
    const turning = Math.min(1, (Math.abs(this.angVel.y) + Math.abs(this.angVel.x)) / (this.C.yawRate * DEG + 1e-6)) * 0.25;
    const thr = this.dying ? 0 : Math.max(0.1, Math.abs(this.throttle) + turning) * this.engineFactor();
    this.model.engineFx.set(thr, this.boosting, this.subs.engines?.offline > 0 ? 0.6 : 0);
    for (const t of this.mounts) t.recoil = Math.max(0, t.recoil - dt * 30);
  }

  /** Write turret matrices (called once per rendered frame). */
  poseTurrets() {
    if (!this.turretRenderer) return;
    const W = this.root.matrixWorld;
    for (const t of this.mounts) {
      if (!t.h) continue;
      if (!t.alive || this.gone) { this.turretRenderer.hide(t.h); continue; }
      turretMatrices(W, t.m, t.h.geo, t.yaw, t.pitch, _b, _p, t.recoil);
      this.turretRenderer.set(t.h, _b, _p);
    }
  }

  dispose(scene) {
    scene.remove(this.root);
    for (const t of this.mounts) if (t.h) this.turretRenderer.release(t.h);
  }
}
