// Fighters: squadrons of four classes per side (interceptor, strike fighter, bomber, gunship),
// launch and recovery through real hangars/galleries, formations, seven orders with visual
// feedback, rearm from a limited reserve, AI carriers, instanced rendering.
import * as THREE from 'three';
import { bus, DEG, clamp, rand, lerp } from './core.js';
import { CRAFT, HALBERD_WING, HALBERD_RESERVE, ULTHANE_WING } from './data/ships.js';
import { WEAPONS } from './data/arsenal.js';
import { craftGeometry, materials } from './models.js';
import { leadPoint } from './weapons.js';
import { audio, falloff } from './audio.js';

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
const _cd = new THREE.Vector3(), _cp = new THREE.Vector3();
const AX_Y = new THREE.Vector3(0, 1, 0), AX_Z = new THREE.Vector3(0, 0, 1), ZERO = new THREE.Vector3();
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));
const rndDir = (r, out) => { do { out.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)); } while (out.lengthSq() > 1); return out.multiplyScalar(r); };

export const ORDERS = {
  attack: { label: 'ATTACK TARGET', short: 'ATTACK', help: 'Attack the locked enemy ship' },
  defend: { label: 'DEFEND SHIP', short: 'DEFEND', help: 'Patrol around your ship and engage anything that comes close' },
  screen: { label: 'SCREEN FORMATION', short: 'SCREEN', help: 'Hold a picket line between the fleet and the enemy' },
  intercept: { label: 'INTERCEPT FIGHTERS', short: 'INTERCEPT', help: 'Hunt enemy fighters and bombers anywhere' },
  escort: { label: 'ESCORT', short: 'ESCORT', help: 'Fly with your bombers (or your ship) and protect them' },
  regroup: { label: 'REGROUP', short: 'REGROUP', help: 'Form up beside the carrier' },
  rtb: { label: 'RETURN TO HANGAR', short: 'RTB', help: 'Land, rearm and repair' },
};
const DEFAULT_ORDER = { interceptor: 'defend', strike: 'attack', bomber: 'attack', gunboat: 'escort' };
const FORMATION = [[0, 0, 0], [-45, 0, -45], [45, 0, -45], [-90, 0, -90], [90, 0, -90], [0, 14, -120], [-135, 0, -135], [135, 0, -135]];

class Craft {
  constructor(sq, idx) {
    this.sq = sq; this.idx = idx; this.isCraft = true;
    this.key = sq.type; this.T = CRAFT[sq.type]; this.role = this.T.role;
    this.team = sq.team; this.faction = this.T.faction; this.carrier = sq.carrier; this.stats = sq.stats;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3(); this.q = new THREE.Quaternion();
    this.hp = this.T.hp; this.alive = true;
    this.state = 'launch'; this.stateT = 0; this.cd = rand(0, 1); this.cd2 = rand(1, 3);
    this.ammo = { ftorp: this.T.weapons.ftorp || 0, rocket: this.T.weapons.rocket || 0 };
    this.target = null; this.retarget = 0; this.breakT = 0; this.breakDir = new THREE.Vector3(); this.bank = 0; this.jink = new THREE.Vector3();
    const r = this.T.length * 0.6 + 4; this.hitR2 = r * r;
    this.turnRate = this.T.turn * 40 * DEG;
    this.name = `${sq.name}-${idx + 1}`;
  }
  damage(d, src) {
    if (!this.alive) return;
    this.hp -= d;
    if (this.hp <= 0) {
      this.alive = false;
      this.sq.fleet.fx.explosion(this.pos, this.T.length * 2.2, this.vel, { smoke: false, debris: 1 });
      audio.explosion(0.6, falloff(this.pos.distanceTo(this.sq.fleet.game.engine.camera.position)) * 0.4);
      if (src?.stats) src.stats.craftKills = (src.stats.craftKills || 0) + 1;
      this.sq.onLoss(this, src);
    }
  }
}

let SQ_ID = 0;
export class Squadron {
  constructor(fleet, carrier, { name, type }, bay = 0) {
    this.fleet = fleet; this.id = ++SQ_ID;
    this.name = name; this.type = type; this.T = CRAFT[type]; this.role = this.T.role;
    this.team = carrier.team; this.carrier = carrier; this.bay = bay;
    this.size = this.T.wing; this.ready = this.size;
    this.craft = []; this.status = 'READY';
    this.order = DEFAULT_ORDER[this.role]; this.orderTarget = null; this.orderShowT = 0;
    this.launchT = 0; this.toLaunch = 0; this.rearmT = 0; this.winchester = false;
    this.stats = { shots: 0, hits: 0, dealt: 0, kills: 0, craftKills: 0 };
  }
  get alive() { return this.craft.filter((c) => c.alive); }
  leader() { return this.craft.find((c) => c.alive && c.state !== 'launch') || null; }
  hangarOK() {
    const h = this.carrier.subs.hangar;
    return this.carrier.alive && (!h || (h.hp > 0 && !(h.offline > 0)));
  }
  launch() {
    if (this.status !== 'READY' || this.ready <= 0) return false;
    if (!this.hangarOK()) { bus.emit('squadron:blocked', { sq: this }); return false; }
    this.status = 'LAUNCHING'; this.toLaunch = this.ready; this.ready = 0; this.launchT = 0; this.craft = []; this.winchester = false;
    bus.emit('squadron:launched', { sq: this, carrier: this.carrier });
    return true;
  }
  setOrder(order, target = null, quiet = false) {
    this.order = order; this.orderTarget = target; this.orderShowT = 4;
    for (const c of this.craft) { c.target = null; c.retarget = 0; c.breakT = 0; }
    if (order === 'rtb' && this.status === 'ACTIVE') this.status = 'RTB';
    if (order !== 'rtb' && this.status === 'RTB') this.status = 'ACTIVE';
    if (!quiet) bus.emit('squadron:order', { sq: this, order, target });
  }
  onLoss(c, src) {
    bus.emit('craft:lost', { craft: c, sq: this, src });
    if (this.alive.length === 0 && this.toLaunch <= 0) {
      this.craft = [];
      const res = this.fleet.reserveOf(this.carrier);
      this.status = res > 0 ? 'REARMING' : 'LOST'; this.rearmT = 40;
      bus.emit('squadron:lost', { sq: this });
    }
  }
  update(dt) {
    const c = this.carrier;
    this.orderShowT = Math.max(0, this.orderShowT - dt);
    if (this.status === 'LAUNCHING') {
      this.launchT -= dt;
      if (!this.hangarOK()) this.toLaunch = 0;
      else if (this.launchT <= 0 && this.toLaunch > 0) {
        this.launchT = this.role === 'bomber' || this.role === 'gunboat' ? 0.9 : 0.55;
        this.toLaunch--;
        const f = new Craft(this, this.craft.length);
        const { pos, dir } = this.fleet.bayOf(c, this.bay + this.craft.length);
        f.pos.copy(pos); f.launchDir = dir.clone();
        f.vel.copy(dir).multiplyScalar(60).add(c.vel);
        f.q.copy(c.quat);
        this.craft.push(f); this.fleet.all.push(f);
        // catapult flash at the bay
        this.fleet.fx.add.spawn(pos, c.vel, 0.45, 40, 90, [1, 1, 1], this.team === 'concord' ? [0.4, 0.6, 1] : [1, 0.5, 0.2], 1.2);
      }
      if (this.toLaunch <= 0) {
        this.status = this.craft.some((x) => x.alive) ? 'ACTIVE' : 'READY';
        if (this.order === 'rtb') this.order = DEFAULT_ORDER[this.role];
      }
    }
    if (this.status === 'RTB' || (this.status === 'ACTIVE' && this.order === 'rtb')) {
      this.status = 'RTB';
      if (this.alive.length === 0) {
        this.craft = []; this.status = 'REARMING'; this.rearmT = this.role === 'bomber' ? 24 : 18;
        bus.emit('squadron:recovered', { sq: this });
      }
    }
    if (this.status === 'REARMING') {
      this.rearmT -= dt;
      if (this.rearmT <= 0) {
        const need = this.size - this.ready, add = this.fleet.takeReserve(c, need);
        this.ready += add;
        this.status = this.ready > 0 ? 'READY' : 'LOST';
        if (this.order === 'rtb') this.order = DEFAULT_ORDER[this.role];
        bus.emit('squadron:ready', { sq: this });
      }
    }
  }
}

export class FighterOps {
  constructor(game) {
    this.game = game; this.fx = game.fx;
    this.squadrons = []; this.all = [];
    this.reserve = new Map();
    game.fighters = this.all;
    this.renderer = null;
    this.frame = 0;
    bus.on('game:start', () => this.setup());
  }
  setup() {
    const g = this.game;
    this.squadrons = []; this.all.length = 0;
    for (const s of g.ships) this.attachWing(s);
    if (!this.renderer) this.renderer = new CraftRenderer(g.scene);
  }
  attachWing(ship) {
    const wing = ship.cls === 'halberd' ? HALBERD_WING : ship.cls === 'ulthane' ? ULTHANE_WING : null;
    if (!wing) return;
    wing.forEach((w, i) => this.squadrons.push(new Squadron(this, ship, w, i)));
    this.reserve.set(ship, HALBERD_RESERVE);
  }
  reserveOf(c) { return this.reserve.get(c) || 0; }
  takeReserve(c, n) { const r = this.reserveOf(c), k = Math.min(r, n); this.reserve.set(c, r - k); return k; }
  squadronsOf(ship) { return this.squadrons.filter((s) => s.carrier === ship); }
  /** World launch position and direction for a bay slot (Ulthane alternates its two galleries). */
  bayOf(c, i) {
    const d = c.design;
    if (d.launch) {
      const L = d.launch[i % d.launch.length];
      return { pos: c.toWorld(L.pos, new THREE.Vector3()), dir: L.dir.clone().transformDirection(c.root.matrixWorld) };
    }
    const hp = d.hangar.pos.clone(); hp.x += ((i % 4) - 1.5) * (d.hangar.w / 5);
    return { pos: c.toWorld(hp, new THREE.Vector3()), dir: d.hangar.dir.clone().transformDirection(c.root.matrixWorld) };
  }
  /** Approach and final points for recovery. */
  recoveryOf(c, i) {
    const b = this.bayOf(c, i);
    const app = b.pos.clone().addScaledVector(b.dir, 900);
    return { app, bay: b.pos };
  }

  /* ---------- AI wing commanders (enemy carriers, AI flagships) ---------- */
  aiCommand(dt) {
    for (const sq of this.squadrons) {
      const c = sq.carrier;
      if (c.isPlayer && !c.autopilot) continue;
      if (!c.alive) continue;
      const foes = this.game.ships.filter((s) => s.alive && s.team !== c.team);
      if (!foes.length) continue;
      const near = Math.min(...foes.map((s) => s.pos.distanceTo(c.pos)));
      if (sq.status === 'READY' && near < 22000) {
        sq.launch();
        const tgt = foes.find((s) => s.isPlayer) || foes.find((s) => s.flagship) || foes[0];
        if (sq.role === 'bomber' || sq.role === 'strike') sq.setOrder('attack', tgt, true);
        else if (sq.role === 'interceptor') sq.setOrder(sq.name.endsWith('1') ? 'intercept' : 'defend', null, true);
        else sq.setOrder('escort', null, true);
      }
      if (sq.status === 'ACTIVE' && sq.order === 'attack' && !(sq.orderTarget && sq.orderTarget.alive)) {
        const tgt = foes.find((s) => s.flagship) || foes[0];
        sq.setOrder('attack', tgt, true);
      }
    }
  }

  /* ---------- per-craft behaviour ---------- */
  enemyCraftNear(f, p, r) {
    let best = null, bd = r * r;
    for (const e of this.all) {
      if (!e.alive || e.team === f.team || e.state === 'launch') continue;
      let d = e.pos.distanceToSquared(p);
      if (e.role === 'bomber') d *= 0.5;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  screenPoint(sq, out) {
    const c = sq.carrier, en = this.game.ships.filter((s) => s.team !== sq.team && s.alive);
    const ce = _v3.set(0, 0, 0);
    for (const e of en) ce.add(e.pos);
    if (en.length) ce.divideScalar(en.length); else ce.copy(c.fwd(new THREE.Vector3())).multiplyScalar(10000).add(c.pos);
    return out.subVectors(ce, c.pos).normalize().multiplyScalar(4500).add(c.pos);
  }
  escortAnchor(sq) {
    const bombers = this.squadrons.find((s) => s !== sq && s.carrier === sq.carrier && s.role === 'bomber' && s.status === 'ACTIVE' && s.alive.length);
    if (bombers) return bombers.leader() || sq.carrier;
    return sq.orderTarget?.alive ? sq.orderTarget : sq.carrier;
  }
  /** Desired direction for a craft; returns { speed, fire, noAvoid }. */
  desire(f, dt, out) {
    const sq = f.sq, c = sq.carrier, T = f.T;
    let speed = T.speed, fire = null;
    f.retarget -= dt;
    let order = sq.status === 'RTB' ? 'rtb' : sq.order;
    if (order === 'attack') {
      const tg = sq.orderTarget && sq.orderTarget.alive ? sq.orderTarget : null;
      if (!tg) order = f.role === 'interceptor' ? 'intercept' : 'regroup';
      else return this.attackRun(f, tg, dt, out);
    }
    if (order === 'rtb') {
      if (!c.alive) order = 'regroup';
      else {
        const { app, bay } = this.recoveryOf(c, sq.bay + f.idx);
        const dA = f.pos.distanceTo(app);
        if (f.state !== 'final' && dA > 160) { out.subVectors(app, f.pos).normalize(); speed = clamp(dA / 6, 90, T.speed); }
        else {
          f.state = 'final';
          out.subVectors(bay, f.pos); const d = out.length(); out.normalize();
          speed = clamp(d / 3, 30, 120) + c.vel.length();
          if (!sq.hangarOK()) { f.state = 'active'; speed = 60; }
          else if (d < 45) { f.alive = false; f.docked = true; sq.ready++; this.fx.add.spawn(bay, c.vel, 0.3, 20, 50, [1, 1, 1], [0.5, 0.7, 1], 0.8); }
        }
        return { speed, fire: null, noAvoid: f.state === 'final' };
      }
    }
    // dogfight orders: pick an anchor, engage craft near it
    let anchor = null, engageR = 6000;
    if (order === 'defend') { anchor = c.alive ? c.pos : f.pos; engageR = 4500; }
    else if (order === 'escort') { const a = this.escortAnchor(sq); anchor = a.pos; engageR = 3000; }
    else if (order === 'screen') { anchor = this.screenPoint(sq, new THREE.Vector3()); engageR = 5500; }
    else if (order === 'intercept') { anchor = (sq.leader() || f).pos; engageR = 16000; }
    else if (order === 'regroup') { anchor = c.alive ? c.toWorld(_v1.set(-c.radius * 0.7, c.radius * 0.2, c.radius * 0.3), new THREE.Vector3()) : f.pos; engageR = 0; }
    if (engageR > 0 && (f.retarget <= 0 || !f.target || !f.target.alive)) { f.target = this.enemyCraftNear(f, anchor, engageR); f.retarget = rand(1, 2); }
    const tg = f.target && f.target.alive ? f.target : null;
    if (!tg && order === 'intercept') { anchor = this.screenPoint(sq, new THREE.Vector3()); order = 'screen'; }
    if (tg) {
      const aim = leadPoint(f.pos, f.vel, tg.pos, tg.vel, WEAPONS.flaser.speed, new THREE.Vector3());
      out.subVectors(aim, f.pos); const d = out.length(); out.normalize();
      if (d < 140) out.add(rndDir(1, _v1)).normalize();
      fire = { aim, craft: tg, d };
      if (f.role === 'bomber' && d > 700) fire = null;
      return { speed: speed * 1.05, fire };
    }
    // form up on the leader, or orbit the anchor
    const lead = sq.leader();
    if (lead && lead !== f && order !== 'intercept') {
      const k = f.role === 'bomber' || f.role === 'gunboat' ? 1.6 : 1;
      const slot = _v2.set(...FORMATION[f.idx % FORMATION.length]).multiplyScalar(k).applyQuaternion(lead.q).add(lead.pos);
      const to = _v3.subVectors(slot, f.pos), d = to.length();
      out.copy(lead.vel).normalize().multiplyScalar(200).add(to).normalize();
      return { speed: clamp(lead.vel.length() + d * 0.5, 60, T.speed * 1.25), fire: null };
    }
    const ap = anchor || c.pos;
    const R = order === 'regroup' ? 500 : order === 'screen' ? 900 : order === 'escort' ? 700 : (c.radius || 1000) * 1.1 + 400;
    const rel = _v1.subVectors(f.pos, ap), d = rel.length();
    const tang = _v2.crossVectors(AX_Y, rel).normalize();
    out.copy(tang).addScaledVector(rel.normalize(), clamp((R - d) / R, -1, 1) * 1.4).normalize();
    out.y += clamp((ap.y + 250 - f.pos.y) / 1500, -0.5, 0.5); out.normalize();
    return { speed: speed * 0.75, fire: null };
  }
  /** Runs against a capital ship: bombers drop torpedoes, strike craft fire rockets, others strafe. */
  attackRun(f, tg, dt, out) {
    const sq = f.sq, T = f.T, W = this.game.weapons;
    let speed = T.speed, fire = null;
    const sub = f.role === 'strike' ? (Math.random() < 0.5 ? 'weapons' : 'engines') : (this.game.player?.target === tg && sq.carrier.isPlayer ? this.game.player.targetSub : 'hull');
    f.subAim = sub;
    const ap = tg.toWorld(tg.aimLocal(sub, _v3), new THREE.Vector3());
    if (f.breakT > 0) { f.breakT -= dt; out.copy(f.breakDir); return { speed: speed * 1.15, fire: null }; }
    out.subVectors(ap, f.pos); out.normalize();
    // ranges are measured to the hull surface: a 3 km ship's centre is deep inside it
    const d = tg.surfaceDist(f.pos);
    if (f.role === 'bomber') {
      if (d < 3400 && f.ammo.ftorp > 0 && f.cd2 <= 0) {
        W.craftShot(f, 'ftorp', f.pos.clone(), out.clone(), tg);
        f.ammo.ftorp--; f.cd2 = 2.5;
        audio.missile(falloff(f.pos.distanceTo(this.game.engine.camera.position)) * 0.4);
        if (f.ammo.ftorp === 0 || Math.random() < 0.5) this.breakAway(f, out, 1);
      }
      if (d < 1800) this.breakAway(f, out, 0);
      if (sq.craft.every((x) => !x.alive || x.ammo.ftorp === 0) && !sq.winchester) {
        sq.winchester = true; sq.setOrder('rtb', null, true);
        bus.emit('squadron:winchester', { sq });
      }
      return { speed, fire };
    }
    if (f.role === 'strike' && d < 2800 && f.ammo.rocket > 0 && f.cd2 <= 0) {
      W.craftShot(f, 'rocket', f.pos.clone(), out.clone(), tg);
      f.ammo.rocket--; f.cd2 = 0.35;
      if (f.ammo.rocket % 4 === 0) f.cd2 = 3;
    }
    const aim = leadPoint(f.pos, f.vel, ap, tg.vel, WEAPONS.flaser.speed, new THREE.Vector3());
    fire = { aim, ship: tg, d };
    if (d < 350) this.breakAway(f, out, 0);
    return { speed, fire };
  }
  breakAway(f, out, side) {
    f.breakT = rand(4, 7);
    if (side) f.breakDir.crossVectors(out, AX_Y).normalize().multiplyScalar(Math.random() < 0.5 ? 1 : -1).addScaledVector(out, -0.4).normalize();
    else f.breakDir.copy(out).multiplyScalar(-0.5).add(rndDir(1, _v1).normalize()).normalize();
  }

  updateCraft(f, dt) {
    if (!f.alive) return;
    // private scratch vectors: desire() and friends use the shared _v1.._v3
    const T = f.T, dir = _cd.copy(f.vel).normalize();
    if (dir.lengthSq() < 0.5) dir.set(0, 0, 1).applyQuaternion(f.q);
    const want = new THREE.Vector3();
    let speed = T.speed, fire = null, noAvoid = false;
    f.stateT += dt; f.cd -= dt; f.cd2 -= dt;
    if (f.state === 'launch') {
      // catapult: out of the bay, then turn onto the carrier's heading
      want.copy(f.launchDir).lerp(f.carrier.fwd(_v2), clamp(f.stateT / 2.5, 0, 1) * 0.7).normalize();
      speed = 80 + f.stateT * 90; noAvoid = f.stateT < 1.6;
      if (f.stateT > 2.6) f.state = 'active';
    } else {
      if (f.state === 'final' && f.sq.status !== 'RTB') f.state = 'active';
      const r = this.desire(f, dt, want);
      speed = r.speed; fire = r.fire; noAvoid = r.noAvoid;
      if (f.docked) return;
    }
    // avoid capital hulls (checked every few frames)
    if (!noAvoid && (this.frame + f.idx) % 3 === 0) {
      f.avoid = null;
      for (const s of this.game.ships) {
        if (s.gone || !(s.alive || s.wreck)) continue;
        if (f.pos.distanceToSquared(s.pos) > (s.radius + 500) ** 2) continue;
        if (s.surfaceDist(f.pos) < 260) { f.avoid = new THREE.Vector3().subVectors(f.pos, s.center(_v3)).normalize(); break; }
      }
    }
    if (f.avoid && !noAvoid) want.addScaledVector(f.avoid, 2.2).normalize();
    if (Math.random() < dt * 0.8) rndDir(0.25, f.jink);
    if (f.state === 'active') want.add(f.jink).normalize();
    const ang = Math.acos(clamp(dir.dot(want), -1, 1)), max = f.turnRate * dt;
    const prev = _cp.copy(dir);
    if (ang > 1e-4) dir.lerp(want, Math.min(1, max / ang)).normalize();
    const sp = approach(f.vel.length(), speed, T.speed * 0.6 * dt);
    const turnY = new THREE.Vector3().crossVectors(prev, dir).y / Math.max(dt, 1e-3);
    f.vel.copy(dir).multiplyScalar(sp);
    f.pos.addScaledVector(f.vel, dt);
    f.bank = lerp(f.bank, clamp(-turnY * 0.9, -1.2, 1.2), Math.min(1, dt * 4));
    _m.lookAt(dir, ZERO, AX_Y); f.q.setFromRotationMatrix(_m); // Matrix4.lookAt points +Z from target to eye f.q.multiply(_q.setFromAxisAngle(AX_Z, f.bank));
    // guns
    if (fire && f.cd <= 0 && f.state === 'active') {
      const to = _v2.subVectors(fire.aim, f.pos);
      const d = fire.ship ? fire.d : to.length();
      to.normalize();
      const gunType = f.role === 'gunboat' && fire.craft ? 'fflak' : 'flaser';
      const W = WEAPONS[gunType];
      if (d < W.range && to.dot(dir) > (gunType === 'fflak' ? 0.5 : 0.985)) {
        f.cd = f.role === 'interceptor' ? 0.22 : f.role === 'gunboat' ? 0.5 : 0.36;
        const side = (f.shot = (f.shot || 0) + 1) % 2 ? 1 : -1;
        const from = new THREE.Vector3(side * T.length * 0.2, 0, T.length * 0.4).applyQuaternion(f.q).add(f.pos);
        this.game.weapons.craftShot(f, gunType, from, to.clone().add(rndDir(0.006, new THREE.Vector3())).normalize(), fire.craft || null);
        f.stats.shots++;
      }
    }
    // gunships throw flak at anything near the wing, all round
    if (f.role === 'gunboat' && f.state === 'active' && f.cd2 <= 0) {
      const e = this.enemyCraftNear(f, f.pos, 1300);
      if (e) {
        f.cd2 = 0.7;
        const aim = leadPoint(f.pos, f.vel, e.pos, e.vel, WEAPONS.fflak.speed, new THREE.Vector3());
        this.game.weapons.craftShot(f, 'fflak', f.pos.clone(), aim.sub(f.pos).normalize(), e);
      }
    }
  }

  update(dt) {
    this.frame++;
    this.aiCommand(dt);
    for (const sq of this.squadrons) sq.update(dt);
    for (const f of this.all) this.updateCraft(f, dt);
    // drop dead and docked craft from the flat list
    for (let i = this.all.length - 1; i >= 0; i--) if (!this.all[i].alive) this.all.splice(i, 1);
  }
  render(dt) {
    if (!this.renderer) return;
    this.renderer.update(this.all);
    const cam = this.game.engine.camera.position, add = this.fx.add, S = this.fx.streaks;
    for (const f of this.all) {
      if (!f.alive) continue;
      // engine glow trail up close; a small glint far away so tiny craft stay visible
      const d2 = f.pos.distanceToSquared(cam);
      if (d2 > 4e6) add.spawn(f.pos, null, 0.03, Math.sqrt(d2) * 0.0026, Math.sqrt(d2) * 0.0026, f.team === 'concord' ? [0.75, 0.9, 1] : [1, 0.65, 0.4], [0, 0, 0], 0.9);
      if (d2 < 6e7) {
        const c = f.team === 'concord' ? [0.5, 0.75, 1] : [1, 0.5, 0.25];
        _v1.set(0, 0, -f.T.length * 0.55).applyQuaternion(f.q).add(f.pos);
        add.spawn(_v1, _v2.copy(f.vel).multiplyScalar(0.7), 0.2, f.T.length * 0.45, f.T.length * 0.12, c, [0.05, 0.05, 0.2], 0.9);
      }
    }
    // order feedback: a line from the squadron leader to what it was told to do
    for (const sq of this.squadrons) {
      if (sq.orderShowT <= 0 || !sq.carrier.isPlayer) continue;
      const lead = sq.leader();
      if (!lead) continue;
      let to = null;
      if (sq.order === 'attack' && sq.orderTarget?.alive) to = sq.orderTarget.center(_v3);
      else if (sq.order === 'defend' || sq.order === 'regroup' || sq.order === 'rtb') to = sq.carrier.center(_v3);
      else if (sq.order === 'escort') to = this.escortAnchor(sq).pos;
      else if (sq.order === 'screen') to = this.screenPoint(sq, _v3);
      if (to) S.push(lead.pos, to, 6, sq.order === 'attack' ? [1, 0.45, 0.3] : [0.5, 0.9, 0.6], Math.min(1, sq.orderShowT) * 0.6, 0);
    }
  }
}

/** Instanced rendering of every craft: hull + glow mesh per class. */
class CraftRenderer {
  constructor(scene) {
    this.sets = {};
    for (const key of Object.keys(CRAFT)) {
      const geo = craftGeometry(key), m = materials(CRAFT[key].faction);
      const mk = (g, mat) => { const im = new THREE.InstancedMesh(g, mat, 64); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); return im; };
      this.sets[key] = [mk(geo.hull, m.plain), geo.glow ? mk(geo.glow, m.lights) : null].filter(Boolean);
    }
  }
  update(list) {
    const n = {};
    for (const k in this.sets) n[k] = 0;
    const one = _v2.set(1, 1, 1);
    for (const f of list) {
      if (!f.alive || n[f.key] >= 64) continue;
      _m.compose(f.pos, f.q, one);
      for (const im of this.sets[f.key]) im.setMatrixAt(n[f.key], _m);
      n[f.key]++;
    }
    for (const k in this.sets) for (const im of this.sets[k]) { im.count = n[k]; im.instanceMatrix.needsUpdate = true; }
  }
}
