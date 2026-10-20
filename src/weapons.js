// Weapons: turret traverse and arcs, lead solutions, every weapon behaviour (bolts, shells, slugs,
// beams, missiles, torpedoes, flak, mines, point defence), projectile flight and hit detection,
// auto fire-control (AI ships and the player's unselected batteries), and player group fire.
import * as THREE from 'three';
import { bus, DEG, clamp, rand } from './core.js';
import { WEAPONS, GRID_ORDER } from './data/arsenal.js';
import { mountMatrix, turretMatrices } from './models.js';
import { applyHit, diff } from './damage.js';
import { segPointDistSq } from './ships.js';
import { audio, falloff } from './audio.js';

const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _v4 = new THREE.Vector3();
const _q = new THREE.Quaternion(), _mb = new THREE.Matrix4(), _mp = new THREE.Matrix4(), _mi = new THREE.Matrix4();
const AXES = { fwd: new THREE.Vector3(0, 0, 1), aft: new THREE.Vector3(0, 0, -1), up: new THREE.Vector3(0, 1, 0) };

/** Weapons the player commands as groups (everything except automatic defence). */
export const isGroup = (type) => !!WEAPONS[type]?.group;

/** Time for a projectile of speed s to meet a target at relative position P moving at relative velocity V. */
export function interceptTime(P, V, s) {
  const a = V.dot(V) - s * s, b = 2 * P.dot(V), c = P.dot(P);
  if (Math.abs(a) < 1e-6) { const t = -c / b; return t > 0 ? t : -1; }
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const sq = Math.sqrt(disc), t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
  const t = Math.min(t1, t2) > 0 ? Math.min(t1, t2) : Math.max(t1, t2);
  return t > 0 ? t : -1;
}
const _lp = new THREE.Vector3(), _lv = new THREE.Vector3();
/** World aim point that leads a moving target. speed 0 = hitscan (no lead). Safe for out === tPos. */
export function leadPoint(from, fromVel, tPos, tVel, speed, out = new THREE.Vector3()) {
  if (!speed) return out.copy(tPos);
  const P = _lp.subVectors(tPos, from), V = _lv.subVectors(tVel, fromVel);
  const t = interceptTime(P, V, speed);
  return t < 0 ? out.copy(tPos) : out.copy(tPos).addScaledVector(V, t);
}

/** Faction-tinted bolt colour. */
function boltColor(type, faction) {
  const heg = faction === 'hegemony';
  switch (type) {
    case 'ion': return [0.45, 0.7, 1];
    case 'massdriver': return [0.95, 0.97, 1];
    case 'plasma': return heg ? [1, 0.55, 0.2] : [0.5, 1, 0.75];
    case 'pd': case 'flak': case 'fflak': return heg ? [1, 0.6, 0.3] : [1, 0.85, 0.55];
    case 'flaser': return heg ? [1, 0.5, 0.3] : [0.7, 0.95, 1];
    case 'secondary': return heg ? [1, 0.6, 0.35] : [0.7, 0.92, 1];
    default: return heg ? [1, 0.55, 0.25] : [0.6, 0.85, 1];
  }
}
const STREAK = { heavy: [9, 0.06], macro: [9, 0.06], broadside: [8, 0.05], gundeck: [8, 0.05], secondary: [3.5, 0.04], pd: [1.6, 0.03], massdriver: [4, 0.05], ion: [7, 0.05], plasma: [26, 0.03], ram: [22, 0.03], flaser: [1.4, 0.03], flak: [3, 0.03], fflak: [2, 0.03] };
const FLASH = { heavy: 70, macro: 70, broadside: 55, gundeck: 55, secondary: 20, pd: 6, massdriver: 60, ion: 40, plasma: 90, ram: 90, flak: 16, flaser: 4, fflak: 6 };

class Projectile {
  constructor() { this.pos = new THREE.Vector3(); this.prev = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.alive = false; }
}

export class Weapons {
  constructor(game) {
    this.game = game;
    this.fx = game.fx;
    this.list = []; this.pool = [];
    this.mines = [];
    this.missiles = [];   // live missiles/torpedoes (targets for point defence)
    this.doctrine = 'concentrate'; // player's unselected batteries: concentrate | split | threats | hold
    this.selected = null;          // player's selected group type
    this.trigger = false;          // player holding the fire button
    this.manualAim = new THREE.Vector3();
    this.hasManualAim = false;
    this.solution = false;         // reticle is on the lead marker
    this.groupState = {};          // per-group status for the HUD
    bus.on('game:start', () => this.onStart());
  }
  onStart() {
    const p = this.game.player;
    const groups = this.groupsOf(p);
    this.selected = groups[0]?.type || null;
  }

  /* ---------- mount geometry ---------- */
  geoOf(t) { return t.h ? t.h.geo : null; }
  /** Mount base position in world space. */
  mountWorld(ship, t, out = new THREE.Vector3()) { return out.copy(t.m.pos).applyMatrix4(ship.root.matrixWorld); }
  /** Muzzle position and direction for barrel i. */
  muzzle(ship, t, i, out, dirOut) {
    const geo = this.geoOf(t);
    if (geo) {
      turretMatrices(ship.root.matrixWorld, t.m, geo, t.yaw, t.pitch, _mb, _mp);
      out.set(geo.xs[i % geo.xs.length], 0, geo.len).applyMatrix4(_mp);
      if (dirOut) dirOut.set(0, 0, 1).transformDirection(_mp);
    } else {
      out.copy(t.m.pos).applyMatrix4(ship.root.matrixWorld);
      if (dirOut) {
        const W = WEAPONS[t.type];
        dirOut.copy(AXES[W.arc.axis] || AXES.fwd).transformDirection(ship.root.matrixWorld);
      }
    }
    return out;
  }
  /** Mount-frame yaw/pitch to a world point. */
  solve(ship, t, world) {
    const l = _v1.copy(world).applyMatrix4(ship.inv);
    if (!t.m._inv) t.m._inv = mountMatrix(t.m).clone().invert();
    l.applyMatrix4(t.m._inv);
    const geo = this.geoOf(t);
    if (geo) { l.y -= geo.pivotY; l.z -= geo.pivotZ; }
    return [Math.atan2(l.x, l.z), Math.atan2(l.y, Math.hypot(l.x, l.z))];
  }
  /** Is a world point inside this mount's firing arc? */
  arcOK(ship, t, world) {
    const W = WEAPONS[t.type];
    if (this.geoOf(t)) {
      const [y, p] = this.solve(ship, t, world);
      t._sy = y; t._sp = p;
      const L = t.m.yawLim, P = t.m.pitchLim;
      if (W.arc.axis === 'any') return true;
      return y >= L[0] && y <= L[1] && p >= P[0] && p <= P[1];
    }
    if (W.arc.axis === 'any' || W.arc.half >= 180) return true;
    const dir = ship.toLocal(world, _v1).sub(t.m.pos).normalize();
    const ax = AXES[W.arc.axis] || AXES.fwd;
    return Math.acos(clamp(dir.dot(ax), -1, 1)) <= W.arc.half * DEG;
  }
  /** Traverse toward a world point; updates t.inArc / t.aligned. */
  aim(ship, t, world, dt) {
    const W = WEAPONS[t.type];
    t.aimPoint.copy(world); t.hasAim = true;
    t.inArc = this.arcOK(ship, t, world);
    if (!this.geoOf(t)) {
      // fixed weapons are aligned when the target sits inside the (narrow) bow/stern cone
      if (W.spinal || t.type === 'torpedo' || t.type === 'ram') {
        const dir = ship.toLocal(world, _v1).sub(t.m.pos).normalize();
        t.err = Math.acos(clamp(dir.z, -1, 1)) / DEG;
        t.aligned = t.err <= W.tol;
      } else t.aligned = t.inArc;
      return;
    }
    if (W.arc.axis === 'any') { // point-defence style: effectively instant traverse
      const [y, p] = this.solve(ship, t, world);
      t.yaw = y; t.pitch = clamp(p, -0.3, 1.5); t.aligned = true; t.err = 0;
      return;
    }
    const L = t.m.yawLim, P = t.m.pitchLim;
    const y = t._sy, p = t._sp;
    const pw = ship.powerFactor ? ship.powerFactor() : 1;
    const rate = W.traverse * DEG * pw * dt;
    t.yaw = approach(t.yaw, clamp(y, L[0], L[1]), rate);
    t.pitch = approach(t.pitch, clamp(p, P[0], P[1]), rate * 0.9);
    t.err = Math.max(Math.abs(t.yaw - y), Math.abs(t.pitch - p)) / DEG;
    t.aligned = t.inArc && t.err < W.tol;
  }
  idle(ship, t, dt) {
    t.hasAim = false; t.inArc = false; t.aligned = false;
    if (!this.geoOf(t)) return;
    const W = WEAPONS[t.type];
    const rate = Math.min(W.traverse, 60) * DEG * dt * 0.5;
    t.yaw = approach(t.yaw, 0, rate); t.pitch = approach(t.pitch, 0.04, rate);
  }
  ready(t) { return t.alive && t.cd <= 0 && t.salvo <= 0 && t.charge <= 0 && t.beam <= 0; }

  /* ---------- firing ---------- */
  /** Begin firing a mount at a world aim point. Returns true if a shot/salvo/charge started. */
  fire(ship, t, aim, target) {
    const W = WEAPONS[t.type];
    if (!this.ready(t)) return false;
    const isP = ship.isPlayer;
    // AI crews reload a little slower than the player's; difficulty sharpens enemy crews
    const enemy = this.game.player && ship.team !== this.game.player.team;
    const reloadMul = isP ? 1 : enemy ? 1.15 / diff().aiSkill : 1.1;
    if (W.kind === 'missile') {
      if (W.needsLock && !(target && target.alive !== false)) return false;
      if (W.ammo != null) {
        const mag = t.type === 'vls' ? 'vls' : t.type;
        if (ship.magazine[mag] == null) ship.magazine[mag] = W.ammo;
        if (ship.magazine[mag] <= 0) return false;
        ship.magazine[mag]--;
      }
      this.launchMissile(ship, t, t.type, target);
      t.cd = W.reload * rand(0.95, 1.08) * reloadMul;
      return true;
    }
    if (W.kind === 'mine') {
      if (ship.magazine.mine == null) ship.magazine.mine = W.ammo;
      if (ship.magazine.mine <= 0) return false;
      ship.magazine.mine--;
      this.dropMine(ship, t);
      t.cd = W.reload * reloadMul;
      return true;
    }
    if (W.kind === 'beam') {
      t.charge = W.charge; t.aimPoint.copy(aim);
      t.cd = W.reload * reloadMul;
      bus.emit('weapon:charge', { ship, mount: t, def: W });
      const from = this.muzzle(ship, t, 0, _v3);
      audio.charge(W.charge, isP ? 1 : falloff(from.distanceTo(this.game.engine.camera.position)) * 0.8);
      return true;
    }
    if (W.ammo != null) {
      if (ship.magazine[t.type] == null) ship.magazine[t.type] = W.ammo;
      if (ship.magazine[t.type] <= 0) return false;
      ship.magazine[t.type]--;
    }
    const geo = this.geoOf(t);
    t.salvo = geo ? geo.xs.length : 1; t.salvoT = 0; t.salvoTarget = target; t.aimPoint.copy(aim);
    t.cd = W.reload * rand(0.97, 1.05) * reloadMul;
    return true;
  }

  emitShot(ship, t) {
    const W = WEAPONS[t.type];
    const i = t.barrel++;
    const from = this.muzzle(ship, t, i, new THREE.Vector3());
    const dir = _v4.subVectors(t.aimPoint, from).normalize();
    const vsSmall = t.salvoTarget && t.salvoTarget.isCraft;
    let sp = (W.spread || 0) * (ship.isPlayer ? 1 : 1.6 / diff().aiSkill) * (vsSmall ? 2.5 : 1);
    if (ship.sensorFactor) sp *= 1 + (1 - ship.sensorFactor()) * 3;
    dir.x += rand(-sp, sp); dir.y += rand(-sp, sp); dir.z += rand(-sp, sp); dir.normalize();
    const p = this.spawn(t.type, ship, from, dir);
    if (W.kind === 'flak') p.fuse = Math.max(0.15, from.distanceTo(t.aimPoint) / W.speed);
    ship.stats.shots++;
    t.recoil = 1;
    const col = p.color, fs = FLASH[t.type] || 20;
    this.fx.muzzle(from, dir, fs, col, ship.vel);
    const cam = this.game.engine.camera.position, isP = ship.isPlayer;
    const vol = isP ? 1 : falloff(from.distanceTo(cam));
    switch (t.type) {
      case 'heavy': case 'macro': case 'broadside': case 'gundeck':
        audio.heavy(isP ? 0.85 : vol * 0.55);
        if (isP) { bus.emit('shake', { amount: 0.06 }); this.fx.lights.flash(from, ship.faction === 'concord' ? 0x9fd8ff : 0xffa060, 40, 2500, 0.15); }
        break;
      case 'plasma': case 'ram': audio.plasma(isP ? 1 : vol * 0.6); if (isP) bus.emit('shake', { amount: 0.1 }); break;
      case 'massdriver': audio.massDriver(isP ? 1 : vol * 0.6); if (isP) bus.emit('shake', { amount: 0.12 }); break;
      case 'ion': audio.ion(isP ? 0.8 : vol * 0.5); break;
      case 'secondary': audio.laser(isP ? 0.45 : vol * 0.3); break;
      case 'pd': audio.pd(isP ? 0.3 : vol * 0.2); break;
      case 'flak': audio.flak(isP ? 0.5 : vol * 0.3); break;
      default: break;
    }
  }

  spawn(type, owner, from, dir) {
    const W = WEAPONS[type];
    const p = this.pool.pop() || new Projectile();
    p.alive = true; p.type = type; p.W = W; p.owner = owner; p.team = owner.team; p.faction = owner.faction || (owner.team === 'concord' ? 'concord' : 'hegemony');
    p.pos.copy(from); p.prev.copy(from);
    p.vel.copy(dir).multiplyScalar(W.speed);
    if (owner.vel) p.vel.add(owner.vel);
    p.life = (W.range / W.speed) * 1.08;
    p.dmg = W.dmg; p.age = 0; p.missile = false; p.target = null; p.tgtLocal = null; p.hp = 0; p.fuse = 0;
    p.color = boltColor(type, p.faction);
    this.list.push(p);
    return p;
  }

  launchMissile(ship, t, type, target) {
    const W = WEAPONS[type];
    const from = this.muzzle(ship, t, 0, new THREE.Vector3());
    const up = type === 'vls' ? ship.up(_v1) : ship.fwd(_v1);
    const p = this.spawn(type, ship, from, up);
    p.missile = true; p.hp = W.mhp; p.life = W.life;
    p.vel.copy(up).multiplyScalar(type === 'torpedo' ? 160 : 140).add(ship.vel);
    p.speed = p.vel.length();
    p.target = target;
    p.tgtLocal = target && target.aimLocal ? target.aimLocal(ship.targetSub && target === ship.target ? ship.targetSub : 'hull', new THREE.Vector3()) : null;
    p.color = type === 'torpedo' ? (ship.faction === 'concord' ? [0.6, 0.85, 1] : [1, 0.4, 0.25]) : (ship.faction === 'concord' ? [1, 0.9, 0.7] : [1, 0.6, 0.35]);
    this.missiles.push(p);
    this.fx.add.spawn(from, ship.vel, 0.4, 50, 120, [1, 0.9, 0.7], [0.4, 0.2, 0.05], 1.4);
    for (let i = 0; i < 4; i++) this.fx.smoke.spawn(from, _v2.copy(up).multiplyScalar(30).add(ship.vel), rand(2, 4), 25, 110, [0.3, 0.3, 0.32], [0.1, 0.1, 0.1], 0.45, 0.3);
    audio.missile(ship.isPlayer ? 0.8 : falloff(from.distanceTo(this.game.engine.camera.position)) * 0.5);
    ship.stats.shots++;
    bus.emit('weapon:launch', { ship, type, target });
    return p;
  }
  /** Small craft weapons (fighters) use the same projectiles. */
  craftShot(craft, type, from, dir, target) {
    const p = this.spawn(type, craft, from, dir);
    const W = WEAPONS[type];
    if (W.kind === 'missile') {
      p.missile = true; p.hp = W.mhp; p.life = W.life; p.target = target; p.speed = p.vel.length();
      p.tgtLocal = target && target.aimLocal ? target.aimLocal(craft.subAim || 'hull', new THREE.Vector3()) : null;
      this.missiles.push(p);
    }
    if (W.kind === 'flak') p.fuse = target ? Math.max(0.1, from.distanceTo(target.pos) / W.speed) : 0.6;
    return p;
  }

  dropMine(ship, t) {
    const W = WEAPONS.mine;
    const pos = this.mountWorld(ship, t, new THREE.Vector3());
    const vel = ship.fwd(_v1).multiplyScalar(-W.speed).add(ship.vel).add(_v2.set(rand(-8, 8), rand(-8, 8), rand(-8, 8)));
    this.mines.push({ pos, vel, team: ship.team, owner: ship, life: W.life, arm: 3, W, pulse: Math.random() * 6 });
    audio.mine(ship.isPlayer ? 0.8 : 0.3);
  }

  /* ---------- per-mount firing updates (salvos, beams) ---------- */
  updateMount(ship, t, dt) {
    if (t.cd > 0) t.cd -= dt * (ship.powerFactor ? ship.powerFactor() : 1);
    if (t.salvo > 0) {
      t.salvoT -= dt;
      if (t.salvoT <= 0) {
        if (t.alive && ship.alive) this.emitShot(ship, t);
        t.salvo--; t.salvoT = t.type === 'heavy' || t.type === 'macro' ? 0.14 : 0.1;
      }
    }
    if (t.charge > 0) {
      t.charge -= dt;
      if (!t.alive || !ship.alive) { t.charge = 0; return; }
      if (t.charge <= 0) this.startBeam(ship, t);
    } else if (t.beam > 0) this.updateBeam(ship, t, dt);
  }
  startBeam(ship, t) {
    const W = WEAPONS[t.type];
    t.beam = W.beamDur;
    const from = this.muzzle(ship, t, 0, _v3);
    // beams fire along the bow, bent at most a little toward the aim point
    const dl = _v1.subVectors(t.aimPoint, from).normalize().applyQuaternion(_q.copy(ship.quat).invert());
    const lim = Math.sin(W.tol * DEG);
    dl.x = clamp(dl.x, -lim, lim); dl.y = clamp(dl.y, -lim, lim); dl.z = Math.max(dl.z, 0.5); dl.normalize();
    t.beamDir = dl.clone();
    audio.beam(ship.isPlayer ? 1 : Math.max(0.25, falloff(from.distanceTo(this.game.engine.camera.position))));
    if (ship.isPlayer) bus.emit('shake', { amount: 0.6 });
    this.fx.lights.flash(from, ship.faction === 'concord' ? 0x9fd8ff : 0xff7040, 400, 12000, 0.8);
    bus.emit('weapon:beam', { ship, mount: t, def: W });
  }
  updateBeam(ship, t, dt) {
    const W = WEAPONS[t.type];
    t.beam -= dt;
    const from = this.muzzle(ship, t, 0, new THREE.Vector3());
    const dir = _v4.copy(t.beamDir).applyQuaternion(ship.quat);
    const end = new THREE.Vector3().copy(from).addScaledVector(dir, W.range);
    let best = null, bs = null;
    for (const s of this.game.ships) {
      if (s.team === ship.team || !s.alive) continue;
      const h = s.raycast(from, end);
      if (h && (!best || h.t < best.t)) { best = h; bs = s; }
    }
    t.beamStart = from; t.beamEnd = best ? best.point.clone() : end; t.beamHit = !!best;
    if (best) {
      applyHit(bs, best, W.dps * dt, W, ship);
      if (Math.random() < dt * 20) this.fx.explosion(best.point, rand(60, 140), bs.vel, { smoke: false, debris: Math.random() < 0.2 ? 1 : 0 });
      if (ship.isPlayer) bus.emit('shake', { amount: 0.03 });
    }
    for (const f of this.game.fighters || []) if (f.alive && f.team !== ship.team && segPointDistSq(from, t.beamEnd, f.pos) < 3600) f.damage(9999, ship);
  }

  /* ---------- automatic fire control ---------- */
  hostileShips(ship) { return this.game.ships.filter((s) => s.alive && s.team !== ship.team); }
  nearestMissile(ship, from, range) {
    let best = null, bd = range * range;
    for (const m of this.missiles) if (m.alive && m.team !== ship.team) { const d = m.pos.distanceToSquared(from); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  nearestCraft(ship, from, range, preferBombers) {
    let best = null, bd = range * range;
    for (const f of this.game.fighters || []) {
      if (!f.alive || f.team === ship.team) continue;
      let d = f.pos.distanceToSquared(from);
      if (preferBombers && f.role === 'bomber') d *= 0.4;
      if (d < bd) { bd = d; best = f; }
    }
    return best;
  }
  /** Pick a capital-ship target for a mount according to doctrine. */
  pickTarget(ship, t, doctrine) {
    const W = WEAPONS[t.type], from = this.mountWorld(ship, t, _v3);
    const tgt = ship.target;
    const inReach = (s) => s.alive && s.pos.distanceTo(from) < W.range + s.radius * 0.5;
    if (doctrine === 'concentrate' && tgt && inReach(tgt) && this.arcOK(ship, t, tgt.center(_v2))) return tgt;
    const cands = this.hostileShips(ship).filter((s) => inReach(s) && this.arcOK(ship, t, s.center(_v2)));
    if (!cands.length) return null;
    if (doctrine === 'split') { cands.sort((a, b) => a.id - b.id); return cands[t.i % cands.length]; }
    if (doctrine === 'threats') {
      const score = (s) => (s.target === ship ? 3 : 0) + s.C.threat - s.pos.distanceTo(from) / 8000;
      cands.sort((a, b) => score(b) - score(a)); return cands[0];
    }
    if (tgt && cands.includes(tgt)) return tgt;
    cands.sort((a, b) => a.pos.distanceToSquared(from) - b.pos.distanceToSquared(from));
    return cands[0];
  }
  /** Aim point (with lead) on a ship or craft for a mount. */
  aimAt(ship, t, tg, out) {
    const W = WEAPONS[t.type], from = this.mountWorld(ship, t, _v3);
    let tp;
    if (tg.aimLocal) tp = tg.toWorld(tg.aimLocal(tg === ship.target ? ship.targetSub : 'hull', _v2), new THREE.Vector3());
    else tp = _v2.copy(tg.pos);
    return leadPoint(from, ship.vel, tp, tg.vel, W.kind === 'beam' ? 0 : W.speed, out);
  }
  /**
   * Engage with every mount except those in `skip` (a Set of types).
   * doctrine: concentrate | split | threats | hold. allowFire=false only tracks.
   */
  autoEngage(ship, dt, { doctrine = 'concentrate', skip = null, allowFire = true } = {}) {
    for (const t of ship.mounts) {
      if (!t.alive) continue;
      if (skip && skip.has(t.type)) continue;
      const W = WEAPONS[t.type];
      if (W.auto) { this.defend(ship, t, dt); continue; }
      if (t.type === 'secondary') {
        // secondaries defend against craft and missiles first
        const f = this.nearestCraft(ship, this.mountWorld(ship, t, _v3), 5000, true) || this.nearestMissile(ship, _v3, 3000);
        if (f) { this.engageSmall(ship, t, f, dt); continue; }
      }
      if (t.type === 'mine') {
        // drop mines when enemy craft are close astern
        const f = this.nearestCraft(ship, this.mountWorld(ship, t, _v3), 1800, false);
        if (f && allowFire && doctrine !== 'hold' && this.ready(t) && this.arcOK(ship, t, f.pos)) this.fire(ship, t, f.pos, null);
        continue;
      }
      // the player's free batteries only engage on their own under SPLIT or THREATS
      if (ship.isPlayer && (doctrine === 'hold' || (doctrine === 'concentrate' && !(ship.target && ship.target.alive)))) { this.idle(ship, t, dt); continue; }
      t.retarget = (t.retarget || 0) - dt;
      if (t.retarget <= 0 || !t.target || !t.target.alive) { t.target = this.pickTarget(ship, t, doctrine === 'hold' ? 'concentrate' : doctrine); t.retarget = rand(0.5, 1.0); }
      const tg = t.target;
      if (!tg || !tg.alive) { this.idle(ship, t, dt); continue; }
      const aim = this.aimAt(ship, t, tg, _v4);
      this.aim(ship, t, aim, dt);
      if (!allowFire || doctrine === 'hold' || !t.aligned || !this.ready(t)) continue;
      if (W.kind === 'beam') { if (Math.random() < dt * (ship.isPlayer ? 2 : 0.5)) this.fire(ship, t, aim, tg); }
      else this.fire(ship, t, aim, tg);
    }
  }
  engageSmall(ship, t, f, dt) {
    const W = WEAPONS[t.type];
    const aim = leadPoint(this.mountWorld(ship, t, _v3), ship.vel, f.pos, f.vel, W.speed, _v4);
    this.aim(ship, t, aim, dt);
    if (t.aligned && this.ready(t)) { t.salvoTarget = f; this.fire(ship, t, aim, f); t.salvoTarget = f; }
  }
  /** Point defence and flak: missiles first, then craft (bombers preferred). */
  defend(ship, t, dt) {
    const W = WEAPONS[t.type], from = this.mountWorld(ship, t, _v3);
    t.retarget = (t.retarget || 0) - dt;
    if (t.retarget <= 0 || !t.target || !t.target.alive) {
      t.target = this.nearestMissile(ship, from, W.range) || this.nearestCraft(ship, from, W.range, true);
      t.retarget = rand(0.15, 0.35);
    }
    if (!t.target) { this.idle(ship, t, dt); return; }
    this.engageSmall(ship, t, t.target, dt);
  }

  /* ---------- player batteries ---------- */
  groupsOf(ship) {
    if (!ship) return [];
    const by = {};
    for (const t of ship.mounts) if (isGroup(t.type)) (by[t.type] ||= []).push(t);
    return GRID_ORDER.filter((k) => by[k]).map((k) => ({ type: k, def: WEAPONS[k], mounts: by[k] }));
  }
  /** Player aim point: along the cursor ray at the target's range, or on whatever hull it crosses. */
  updateManualAim() {
    const g = this.game, p = g.player;
    if (!p) return;
    const ray = g.camera.aimRay();
    const tg = p.target && p.target.alive ? p.target : null;
    let dist = tg ? tg.pos.distanceTo(g.engine.camera.position) : 9000;
    // the cursor ray landing on a hull gives the exact range
    const far = _v1.copy(ray.origin).addScaledVector(ray.direction, 40000);
    let best = null;
    for (const s of g.ships) {
      if (s === p || !s.alive) continue;
      const h = s.raycast(ray.origin, far, true);
      if (h && (!best || h.t < best.t)) best = h;
    }
    if (best) dist = best.t * 40000;
    this.manualAim.copy(ray.origin).addScaledVector(ray.direction, dist);
    this.hasManualAim = true;
    // on the lead marker: the battery takes the computed firing solution
    this.solution = false;
    if (tg && this.selected && g.hud?.leadScreen) {
      const m = g.engine.input.mouse, ls = g.hud.leadScreen;
      if (ls.visible && Math.hypot(ls.x - m.x, ls.y - m.y) < 26) { this.solution = true; this.manualAim.copy(ls.world); }
    }
    if (g.scopeActive && g.camera.scopeAim) { this.manualAim.copy(g.camera.scopeAim); this.solution = !!g.camera.scopeSolution; }
  }
  /** Lead point for the selected group on the locked target (world), or null. */
  leadFor(type) {
    const p = this.game.player, tg = p?.target;
    if (!tg || !tg.alive || !type) return null;
    const W = WEAPONS[type];
    const tp = tg.toWorld(tg.aimLocal(p.targetSub, _v2), new THREE.Vector3());
    return leadPoint(p.center(_v3), p.vel, tp, tg.vel, W.kind === 'beam' ? 0 : W.kind === 'missile' ? 0 : W.speed, new THREE.Vector3());
  }
  firePlayerGroup(type = this.selected) {
    const p = this.game.player;
    if (!p || !p.alive || !type) return 0;
    let n = 0;
    const W = WEAPONS[type];
    for (const t of p.mounts) {
      if (t.type !== type || !t.alive) continue;
      if (W.kind === 'missile') { if (p.target && this.ready(t) && this.fire(p, t, p.target.pos, p.target)) n++; continue; }
      if (W.kind === 'mine') { if (this.ready(t) && this.fire(p, t, t.aimPoint, null)) n++; continue; }
      if (t.aligned && this.ready(t) && this.fire(p, t, t.aimPoint, p.target)) n++;
    }
    if (n) bus.emit('player:fired', { type, n });
    return n;
  }
  /** Aggregate state of a player group for the HUD. */
  computeGroupState(p, g) {
    const W = g.def, alive = g.mounts.filter((t) => t.alive);
    const st = { type: g.type, name: W.name, short: W.short, total: g.mounts.length, alive: alive.length, ready: 0, aligned: 0, inArc: 0, reload: 0, state: 'dead', ammo: null };
    if (W.ammo != null) st.ammo = p.magazine[g.type === 'vls' ? 'vls' : g.type] ?? W.ammo;
    if (!alive.length) { st.label = 'DESTROYED'; return st; }
    let minCd = Infinity;
    for (const t of alive) {
      const r = this.ready(t);
      if (r) st.ready++;
      if (r && t.aligned) st.aligned++;
      if (t.inArc) st.inArc++;
      if (!r) minCd = Math.min(minCd, t.charge > 0 ? t.charge : t.beam > 0 ? 0 : t.cd);
    }
    st.reload = minCd === Infinity ? 0 : Math.max(0, minCd);
    st.readyFrac = st.ready / alive.length;
    const tg = p.target && p.target.alive ? p.target : null;
    const range = tg ? p.pos.distanceTo(tg.pos) - tg.radius * 0.5 : null;
    const busy = alive.some((t) => t.charge > 0 || t.beam > 0);
    if (busy) { st.state = 'firing'; st.label = alive.some((t) => t.charge > 0) ? 'CHARGING · HOLD BOW ON TARGET' : 'FIRING'; }
    else if (W.ammo != null && st.ammo <= 0) { st.state = 'empty'; st.label = 'MAGAZINE EMPTY'; }
    else if (W.needsLock && !tg) { st.state = 'nolock'; st.label = 'NEEDS LOCKED TARGET'; }
    else if (st.ready === 0) { st.state = 'reload'; st.label = `RELOADING ${st.reload.toFixed(1)} s`; }
    else if (tg && range > W.range) { st.state = 'range'; st.label = `OUT OF RANGE · ${(range / 1000).toFixed(1)} / ${(W.range / 1000).toFixed(0)} km`; }
    else if (W.kind === 'missile' || W.kind === 'mine') { st.state = 'ready'; st.label = W.kind === 'mine' ? 'READY · DROPS ASTERN' : 'LOCKED · READY TO FIRE'; }
    else if (st.aligned > 0) { st.state = 'ready'; st.label = 'ALIGNED · READY TO FIRE'; }
    else if (st.inArc > 0) { st.state = 'traversing'; st.label = W.spinal || g.type === 'torpedo' || g.type === 'ram' ? `TURN BOW ONTO TARGET · ${Math.round(Math.min(...alive.map((t) => t.err ?? 99)))}°` : 'TRAVERSING'; }
    else {
      st.state = 'arc';
      st.label = 'OUT OF ARC';
      if (this.hasManualAim) {
        const l = p.toLocal(this.manualAim, _v1);
        if (W.arc.axis === 'side') st.label = `OUT OF ARC · TURN ${l.x > 0 ? 'PORT' : 'STARBOARD'} SIDE TO TARGET`;
        else if (W.arc.axis === 'fwd') st.label = 'OUT OF ARC · TURN BOW TO TARGET';
        else st.label = 'OUT OF ARC · TARGET MASKED BY HULL';
      }
    }
    return st;
  }

  /* ---------- main loop ---------- */
  update(dt) {
    const g = this.game, p = g.player;
    // player: selected battery follows the reticle, others follow doctrine
    if (p && p.alive && !p.autopilot) {
      this.updateManualAim();
      const sel = this.selected;
      for (const t of p.mounts) {
        if (!t.alive || t.type !== sel) continue;
        const W = WEAPONS[t.type];
        if (W.kind === 'missile' && W.arc.half >= 180 || W.kind === 'mine') { t.aligned = true; t.inArc = true; continue; }
        // fixed bow weapons are laid by turning the ship: measure them against the locked target
        if (!this.geoOf(t) && p.target && p.target.alive) this.aim(p, t, this.aimAt(p, t, p.target, _v4), dt);
        else this.aim(p, t, this.manualAim, dt);
      }
      this.autoEngage(p, dt, { doctrine: this.doctrine, skip: new Set([sel]) });
      if (this.trigger) this.firePlayerGroup(sel);
      this.groupState = {};
      for (const grp of this.groupsOf(p)) this.groupState[grp.type] = this.computeGroupState(p, grp);
    }
    for (const s of g.ships) {
      if (!s.alive) continue;
      for (const t of s.mounts) this.updateMount(s, t, dt);
    }
    this.updateProjectiles(dt);
    this.updateMines(dt);
  }

  updateProjectiles(dt) {
    const L = this.list, ships = this.game.ships, craft = this.game.fighters || [];
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      if (!p.alive) { L[i] = L[L.length - 1]; L.pop(); this.pool.push(p); continue; }
      p.prev.copy(p.pos); p.age += dt;
      if (p.missile) this.steerMissile(p, dt);
      p.pos.addScaledVector(p.vel, dt);
      p.life -= dt;
      const W = p.W;
      if (W.kind === 'flak') {
        p.fuse -= dt;
        if (p.fuse <= 0 || p.life <= 0) { this.flakBurst(p); continue; }
      }
      if (p.life <= 0) { if (p.missile) this.fx.explosion(p.pos, 30, p.vel, { smoke: false }); p.alive = false; continue; }
      // capital ships
      let best = null, bestShip = null;
      if (W.kind !== 'flak' && !(p.missile && p.age < 0.6)) {
        for (const s of ships) {
          if (s.team === p.team || !s.alive) continue;
          const h = s.raycast(p.prev, p.pos);
          if (h && (!best || h.t < best.t)) { best = h; bestShip = s; }
        }
      }
      if (best) { this.impact(p, bestShip, best); continue; }
      // small craft and missiles (lasers, PD, flak, fighter weapons)
      if (W.kind === 'bolt' || W.kind === 'flak' || p.type === 'pd') {
        let hitCraft = null;
        for (const f of craft) if (f.alive && f.team !== p.team && segPointDistSq(p.prev, p.pos, f.pos) < f.hitR2) { hitCraft = f; break; }
        if (hitCraft) {
          if (W.kind === 'flak') { this.flakBurst(p); continue; }
          hitCraft.damage(p.dmg, p.owner); this.fx.impact(hitCraft.pos, _v1.set(0, 1, 0), 6, p.color, hitCraft.vel); p.alive = false; continue;
        }
        if (W.antiMissile || p.type === 'secondary' || p.type === 'flaser') {
          for (const m of this.missiles) {
            if (!m.alive || m.team === p.team) continue;
            if (segPointDistSq(p.prev, p.pos, m.pos) < (m.type === 'torpedo' || m.type === 'ftorp' ? 500 : 260)) {
              if (W.kind === 'flak') { this.flakBurst(p); break; }
              m.hp -= p.dmg; this.fx.impact(m.pos, _v1.set(0, 1, 0), 5, p.color); p.alive = false;
              if (m.hp <= 0) this.killMissile(m, p.owner);
              break;
            }
          }
          if (!p.alive) continue;
        }
      }
      if (p.missile) {
        const tg = p.target;
        if (tg && tg.alive && tg.raycast && p.age > 0.8 && tg.surfaceDist(p.pos) < 24) {
          const h = tg.raycast(p.prev, _v3.copy(p.pos).addScaledVector(p.vel, 0.25)) || { t: 0, point: p.pos.clone(), local: tg.toLocal(p.pos, new THREE.Vector3()), shield: false, sector: tg.sectorOfLocal(tg.toLocal(p.pos, _v2)) };
          this.impact(p, tg, h);
          continue;
        }
        if (tg && tg.isCraft && tg.alive && p.pos.distanceToSquared(tg.pos) < 900) { tg.damage(p.dmg, p.owner); this.fx.explosion(p.pos, 26, tg.vel, { smoke: false }); p.alive = false; }
      }
    }
    for (let i = this.missiles.length - 1; i >= 0; i--) if (!this.missiles[i].alive) this.missiles.splice(i, 1);
  }
  impact(p, ship, h) {
    const W = p.W;
    if (p.missile) h.point.copy(p.pos);
    const r = applyHit(ship, h, p.dmg, W, p.owner);
    const big = W.kind === 'shell' || p.missile || p.type === 'massdriver';
    const size = p.type === 'torpedo' || p.type === 'ftorp' ? 150 : W.kind === 'shell' ? 170 : p.missile ? 70 : p.type === 'massdriver' ? 90 : 10 + Math.sqrt(p.dmg) * 4;
    if (h.shield) {
      bus.emit('fx:shield', { ship, local: h.local, big: p.dmg > 300 });
      this.fx.impact(h.point, _v1.copy(h.point).sub(ship.center(_v2)).normalize(), 18 + Math.sqrt(p.dmg) * 2.6, ship.faction === 'concord' ? [0.4, 0.75, 1] : [1, 0.5, 0.2], ship.vel);
      if (big) this.fx.explosion(h.point, size * 0.6, ship.vel, { smoke: false });
    } else {
      this.fx.explosion(h.point, size, ship.vel, { smoke: r.hullDmg > 120, debris: r.hullDmg > 400 ? 2 : 0 });
    }
    if (big) this.fx.lights.flash(h.point, W.kind === 'shell' ? 0x80ffd0 : 0xffa060, 120, 5000, 0.4);
    const cam = this.game.engine.camera.position;
    if (ship.isPlayer) {
      if (h.shield) audio.shieldHit(0.6 + Math.min(1, p.dmg / 400));
      else { audio.hullHit(Math.min(1.2, 0.5 + r.hullDmg / 500)); if (r.hullDmg > 250) bus.emit('shake', { amount: Math.min(0.45, r.hullDmg / 1800) }); }
    } else if (big) audio.explosion(1.2, falloff(h.point.distanceTo(cam)) * 0.7);
    p.alive = false;
  }
  flakBurst(p) {
    const W = p.W;
    this.fx.add.spawn(p.pos, null, 0.4, 20, W.splash * 0.7, [1, 0.9, 0.6], [0.3, 0.15, 0.05], 1.1);
    this.fx.smoke.spawn(p.pos, null, 2.5, 30, W.splash * 0.9, [0.3, 0.28, 0.26], [0.1, 0.1, 0.1], 0.5, 0.2);
    const r2 = W.splash * W.splash;
    for (const f of this.game.fighters || []) if (f.alive && f.team !== p.team && f.pos.distanceToSquared(p.pos) < r2) f.damage(p.dmg * (1 - f.pos.distanceTo(p.pos) / W.splash * 0.6), p.owner);
    for (const m of this.missiles) if (m.alive && m.team !== p.team && m.pos.distanceToSquared(p.pos) < r2) { m.hp -= p.dmg; if (m.hp <= 0) this.killMissile(m, p.owner); }
    p.alive = false;
  }
  killMissile(m, by) {
    m.alive = false;
    this.fx.explosion(m.pos, m.type === 'torpedo' || m.type === 'ftorp' ? 45 : 28, m.vel, { smoke: false });
    if (by?.stats) by.stats.intercepts = (by.stats.intercepts || 0) + 1;
    bus.emit('missile:intercepted', { missile: m, by });
  }
  steerMissile(p, dt) {
    const W = p.W, tg = p.target;
    const boost = p.age < (p.type === 'torpedo' ? 0.5 : 1.0);
    p.speed = Math.min(W.speed, (p.speed || p.vel.length()) + W.accel * dt);
    const dir = _v1.copy(p.vel).normalize();
    if (tg && tg.alive && !boost) {
      const tp = p.tgtLocal && tg.toWorld ? tg.toWorld(p.tgtLocal, _v3) : _v3.copy(tg.pos);
      const aim = leadPoint(p.pos, _v4.set(0, 0, 0), tp, tg.vel, Math.max(300, p.speed), _v2);
      const want = aim.sub(p.pos).normalize();
      const ang = Math.acos(clamp(dir.dot(want), -1, 1)), max = W.turn * DEG * dt;
      if (ang > 1e-4) dir.lerp(want, Math.min(1, max / ang)).normalize();
    }
    p.vel.copy(dir).multiplyScalar(p.speed);
  }
  updateMines(dt) {
    const craft = this.game.fighters || [];
    for (let i = this.mines.length - 1; i >= 0; i--) {
      const m = this.mines[i];
      m.life -= dt; m.arm -= dt; m.pulse += dt;
      m.vel.multiplyScalar(Math.exp(-0.15 * dt));
      m.pos.addScaledVector(m.vel, dt);
      let boom = m.life <= 0;
      if (m.arm <= 0 && !boom) {
        const W = m.W;
        for (const f of craft) {
          if (!f.alive || f.team === m.team) continue;
          const d2 = f.pos.distanceToSquared(m.pos);
          if (d2 < 600 * 600) { // gravity well drags craft in
            const d = Math.sqrt(d2);
            f.vel.addScaledVector(_v1.subVectors(m.pos, f.pos).normalize(), W.pull * dt * (1 - d / 600));
            if (d < 120) boom = true;
          }
        }
        for (const s of this.game.ships) if (s.alive && s.team !== m.team && s.surfaceDist(m.pos) < 160) boom = true;
      }
      if (boom) { this.detonateMine(m); this.mines.splice(i, 1); }
    }
  }
  detonateMine(m) {
    const W = m.W;
    this.fx.explosion(m.pos, 120, m.vel, { smoke: false });
    this.fx.add.spawn(m.pos, null, 0.8, 60, W.splash * 1.6, [0.8, 0.7, 1], [0.2, 0.1, 0.4], 1);
    for (const f of this.game.fighters || []) if (f.alive && f.team !== m.team && f.pos.distanceTo(m.pos) < W.splash) f.damage(W.dmg, m.owner);
    for (const s of this.game.ships) {
      if (!s.alive || s.team === m.team) continue;
      if (s.surfaceDist(m.pos) < W.splash) {
        const local = s.toLocal(m.pos, new THREE.Vector3());
        applyHit(s, { local, point: m.pos.clone(), shield: false, sector: s.sectorOfLocal(local) }, W.dmg, W, m.owner);
        s.vel.multiplyScalar(W.slow); // the gravity pulse drags the hull
      }
    }
    audio.explosion(1.4, falloff(m.pos.distanceTo(this.game.engine.camera.position)) * 0.6);
  }

  /* ---------- visuals (per rendered frame) ---------- */
  render() {
    const S = this.fx.streaks, add = this.fx.add;
    for (const p of this.list) {
      if (!p.alive) continue;
      const [w, k] = STREAK[p.type] || [3, 0.04];
      if (p.missile) {
        _v1.copy(p.vel).multiplyScalar(-0.06).add(p.pos);
        S.push(p.pos, _v1, p.type === 'torpedo' || p.type === 'ftorp' ? 7 : 4, p.color, 1, 1);
        if (Math.random() < 0.7) add.spawn(p.pos, null, 0.06, p.type === 'torpedo' ? 26 : 16, 4, [1, 1, 1], p.color, 1.4);
        if (Math.random() < 0.5) this.fx.smoke.spawn(p.pos, null, 2.2, 5, 30, [0.32, 0.32, 0.34], [0.08, 0.08, 0.09], 0.35, 0.2);
      } else if (p.W.kind === 'shell') {
        _v1.copy(p.vel).multiplyScalar(-k).add(p.pos);
        S.push(p.pos, _v1, w, p.color, 1, 1);
        if (Math.random() < 0.6) add.spawn(p.pos, null, 0.05, w * 3, w * 2, [1, 1, 1], p.color, 1.3);
      } else {
        _v1.copy(p.vel).multiplyScalar(-k).add(p.pos);
        S.push(p.pos, _v1, w, p.color, 1, 1);
      }
    }
    for (const m of this.mines) {
      const pulse = 0.5 + 0.5 * Math.sin(m.pulse * 4);
      add.spawn(m.pos, null, 0.05, 30 + pulse * 20, 30, [0.8, 0.7, 1], [0.4, 0.3, 0.9], 0.8 + pulse * 0.4);
    }
    // beams and charge-ups
    for (const s of this.game.ships) {
      if (!s.alive) continue;
      for (const t of s.mounts) {
        const W = WEAPONS[t.type];
        if (W.kind !== 'beam') continue;
        if (t.charge > 0) {
          const k = 1 - t.charge / W.charge;
          const from = this.muzzle(s, t, 0, _v3);
          const c = s.faction === 'concord' ? [0.6, 0.85, 1] : [1, 0.5, 0.15];
          add.spawn(from, s.vel, 0.08, 60 + k * 200, 80 + k * 260, [1, 1, 1], c, 0.6 + k);
          for (let i = 0; i < 2; i++) {
            _v1.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(300 * (1 - k) + 30);
            add.spawn(_v2.copy(from).add(_v1), _v4.copy(_v1).multiplyScalar(-2.5).add(s.vel), 0.4, 14, 4, c, [1, 1, 1], 1);
          }
        } else if (t.beam > 0 && t.beamStart) {
          const k = clamp(t.beam / W.beamDur, 0, 1), fl = 0.85 + Math.random() * 0.15;
          const c = s.faction === 'concord' ? [0.55, 0.85, 1] : [1, 0.45, 0.15];
          S.push(t.beamStart, t.beamEnd, 70 * k * fl, c, 0.9, 0);
          S.push(t.beamStart, t.beamEnd, 22 * k * fl, [1, 1, 1], 1, 0);
          add.spawn(t.beamStart, s.vel, 0.06, 160, 120, [1, 1, 1], c, 1.2);
          if (t.beamHit) add.spawn(t.beamEnd, null, 0.08, 200, 300, [1, 1, 1], c, 1.2);
        }
      }
    }
  }
  clear() { for (const p of this.list) p.alive = false; this.list.length = 0; this.missiles.length = 0; this.mines.length = 0; }
}
