// Ship entity: physics/inertia and helm (shared by player and AI), engine FX, turret pose.
// Damage model fields (shields, armour, subsystems) are filled in by the damage system.
import * as THREE from 'three';
import { DEG, clamp, bus } from './core.js';
import { CLASSES } from './data/ships.js';
import { instantiateShip, turretMatrices } from './models.js';

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _e = new THREE.Euler();
const _b = new THREE.Matrix4(), _p = new THREE.Matrix4();
const RC0 = new THREE.Vector3(), RC1 = new THREE.Vector3(), RCD = new THREE.Vector3(), _u0 = new THREE.Vector3(), _ud = new THREE.Vector3();

/** Segment (origin + t*d, t in 0..1) vs axis-aligned box. Returns entry t or -1. */
function segAABB(o, d, min, max) {
  let tmin = 0, tmax = 1;
  for (const k of ['x', 'y', 'z']) {
    if (Math.abs(d[k]) < 1e-9) { if (o[k] < min[k] || o[k] > max[k]) return -1; continue; }
    let t1 = (min[k] - o[k]) / d[k], t2 = (max[k] - o[k]) / d[k];
    if (t1 > t2) { const x = t1; t1 = t2; t2 = x; }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return -1;
  }
  return tmin;
}
/** Segment vs unit sphere (already in unit space). Entry t or -1; starts inside never register. */
function segUnitSphere(p0, d) {
  const a = d.dot(d), b = 2 * p0.dot(d), c = p0.dot(p0) - 1;
  if (c < 0) return -1;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}
export function segPointDistSq(a, b, p) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l = abx * abx + aby * aby + abz * abz;
  let t = l > 0 ? ((p.x - a.x) * abx + (p.y - a.y) * aby + (p.z - a.z) * abz) / l : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const x = a.x + abx * t - p.x, y = a.y + aby * t - p.y, z = a.z + abz * t - p.z;
  return x * x + y * y + z * z;
}
export const SECTORS = ['FORE', 'AFT', 'PORT', 'STBD'];
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
    this.shieldC = this.design.shield.center; this.shieldR = this.design.shield.radii;
    this.hitBoxes = this.design.hitBoxes.map(([a, b]) => ({ min: a, max: b }));
    this.shieldBoost = -1;            // sector index receiving extra power, -1 = balanced
    this.shieldDelay = [0, 0, 0, 0];  // seconds until a sector starts recharging
    this.target = null; this.targetSub = 'hull';
    this.stats = { shots: 0, hits: 0, dealt: 0, taken: 0, kills: 0 };
    this.magazine = { vls: this.C.missileMagazine || (this.C.loadout.vls ? this.C.loadout.vls * 4 : 0) };
    this.subs = {};
    for (const [k, s] of Object.entries(this.C.subsystems)) this.subs[k] = { hp: s.hp, max: s.hp, offline: 0, pos: this.design.subsystems[k]?.clone() || new THREE.Vector3() };

    // turrets: one entry per mount (fixed fittings have no turret handle)
    this.turretRenderer = turrets;
    this.mounts = this.design.mounts.map((m, i) => ({
      i, m, type: m.type, alive: true, hp: 1,
      yaw: 0, pitch: 0.04, recoil: 0,
      cd: Math.random() * 2, salvo: 0, salvoT: 0, barrel: 0, charge: 0, beam: 0,
      aligned: false, inArc: false, hasAim: false, err: 99, aimPoint: new THREE.Vector3(), target: null, retarget: 0,
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
  center(out = new THREE.Vector3()) { return this.toWorld(this.shieldC, out); }
  sectorOfLocal(p) {
    const a = Math.atan2(p.x - this.shieldC.x, p.z - this.shieldC.z), aa = Math.abs(a);
    return aa < Math.PI / 4 ? 0 : aa > 3 * Math.PI / 4 ? 1 : a > 0 ? 2 : 3;
  }
  shieldsUp() { return this.shields.some((x) => x > 0); }
  /** Segment test in world space: { t, local, point, shield, sector } or null. */
  raycast(p0, p1, ignoreShield = false) {
    if (!this.alive) return null;
    if (segPointDistSq(p0, p1, this.root.position) > (this.radius + 80) ** 2) return null;
    const l0 = RC0.copy(p0).applyMatrix4(this.inv), l1 = RC1.copy(p1).applyMatrix4(this.inv);
    const d = RCD.subVectors(l1, l0);
    if (!ignoreShield && this.shieldsUp()) {
      _u0.copy(l0).sub(this.shieldC).divide(this.shieldR); _ud.copy(d).divide(this.shieldR);
      const t = segUnitSphere(_u0, _ud);
      if (t >= 0) {
        const lp = new THREE.Vector3().copy(l0).addScaledVector(d, t), sec = this.sectorOfLocal(lp);
        if (this.shields[sec] > 0) return { t, local: lp, point: this.toWorld(lp), shield: true, sector: sec };
      }
    }
    let best = 2;
    for (const b of this.hitBoxes) { const t = segAABB(l0, d, b.min, b.max); if (t >= 0 && t < best) best = t; }
    if (best > 1) return null;
    const lp = new THREE.Vector3().copy(l0).addScaledVector(d, best);
    return { t: best, local: lp, point: this.toWorld(lp), shield: false, sector: this.sectorOfLocal(lp) };
  }
  /** Distance from a world point to the nearest hull box. */
  surfaceDist(world) {
    const l = this.toLocal(world, _v2);
    let best = Infinity;
    for (const b of this.hitBoxes) {
      const dx = Math.max(b.min.x - l.x, 0, l.x - b.max.x), dy = Math.max(b.min.y - l.y, 0, l.y - b.max.y), dz = Math.max(b.min.z - l.z, 0, l.z - b.max.z);
      best = Math.min(best, Math.hypot(dx, dy, dz));
    }
    return best;
  }
  /** Ship-local aim point for a subsystem choice ('hull' | 'engines' | 'weapons' | 'shieldgen' | 'hangar' | ...). */
  aimLocal(sub, out = new THREE.Vector3()) {
    if (sub === 'weapons') {
      const t = this.mounts.find((m) => m.alive && ['heavy', 'macro', 'broadside', 'gundeck', 'plasma'].includes(m.type));
      return out.copy(t ? t.m.pos : this.shieldC);
    }
    if (sub && sub !== 'hull' && this.subs[sub]) return out.copy(this.subs[sub].pos);
    return out.copy(this.shieldC).setY(0);
  }
  subList() { return ['hull', 'weapons', ...Object.keys(this.subs).filter((k) => k !== 'bridge')]; }
  /** Weapon power: reactor damage slows traverse and reloads. */
  powerFactor() {
    const r = this.subs.reactor;
    if (!r) return 1;
    return r.offline > 0 ? 0.4 : 0.5 + 0.5 * (r.hp / r.max);
  }
  /** Sensor quality: damaged sensors widen the gun spread and shrink radar range. */
  sensorFactor() {
    const s = this.subs.sensors;
    if (!s) return 1;
    return s.offline > 0 ? 0.25 : 0.4 + 0.6 * (s.hp / s.max);
  }
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
