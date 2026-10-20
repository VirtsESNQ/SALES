// Capital-ship AI (ported from v1, extended): target choice with spread fire, preferred range,
// broadside turning, formations, escorts screening their ward, carriers hanging back,
// shield management, withdrawal when badly damaged, siege-cannon bow alignment.
// Runs at a throttled "think" tick; helm and gunnery run every step.
import * as THREE from 'three';
import { bus, clamp, rand } from './core.js';
import { WEAPONS } from './data/arsenal.js';
import { AX_Y } from './ships.js';

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const approach = (v, t, d) => (v < t ? Math.min(v + d, t) : Math.max(v - d, t));

/** Role and preferred engagement range per class. */
const PROFILE = {
  halberd: { role: 'flagship', range: 11000 }, rampart: { role: 'line', range: 9000 }, warden: { role: 'escort', range: 4000 },
  varr: { role: 'flagship', range: 10000 }, kesh: { role: 'line', range: 7000 }, ulthane: { role: 'carrier', range: 14000 }, talon: { role: 'escort', range: 3800 },
};

export class CapitalAI {
  constructor(game, ship, opt = {}) {
    this.game = game; this.ship = ship; ship.ai = this;
    const pr = PROFILE[ship.cls] || { role: 'line', range: 8000 };
    this.role = opt.role || pr.role;
    this.range = opt.range || pr.range;
    this.ward = opt.ward || null;
    this.leader = opt.leader || null;
    this.offset = opt.offset ? opt.offset.clone() : null;
    this.alt = opt.alt ?? ship.pos.y;
    this.thinkT = rand(0, 0.5);
    this.desired = new THREE.Vector3();
    this.throttle = 0.4;
    this.withdraw = false; this.gone = false;
    this.underFire = [0, 0, 0, 0];
    this.hold = opt.hold || 0; // seconds before engaging (reinforcements arriving)
    bus.on('hit:shield', ({ ship: s, h }) => { if (s === ship) this.underFire[h.sector] += 1; });
    bus.on('hit:hull', ({ ship: s, h }) => { if (s === ship) this.underFire[h.sector] += 2; });
  }
  enemies() { return this.game.ships.filter((s) => s.alive && s.team !== this.ship.team); }
  chooseTarget() {
    const me = this.ship;
    let best = null, bs = -Infinity;
    for (const s of this.enemies()) {
      const d = s.pos.distanceTo(me.pos);
      let sc = (s.C.threat * 1000 + (s.isPlayer ? 700 : 0) + (s.flagship ? 500 : 0)) / (d + 4000);
      // spread fire: fewer ships piling onto the same target
      const crowd = this.game.ships.filter((o) => o !== me && o.alive && o.team === me.team && o.target === s && o.length > 1000).length;
      sc /= 1 + crowd * 0.45;
      if (this.role === 'escort') sc = (s.length < 600 ? 3000 : 700) / (d + 2000);
      if (s.hull < s.maxHull * 0.3) sc *= 1.25;
      if (me.target === s) sc *= 1.3;
      if (sc > bs) { bs = sc; best = s; }
    }
    if (best !== me.target) {
      me.target = best;
      if (best) {
        const r = Math.random();
        me.targetSub = best.length < 600 ? 'hull' : r < 0.55 ? 'hull' : r < 0.78 ? 'weapons' : r < 0.9 ? 'engines' : 'shieldgen';
      }
    }
  }
  think() {
    const me = this.ship, g = this.game;
    this.chooseTarget();
    const tg = me.target;
    // shields: reinforce the sector taking the most fire
    let mx = 0, mi = -1;
    this.underFire.forEach((v, i) => { if (v > mx) { mx = v; mi = i; } });
    me.shieldBoost = mx > 3 ? mi : -1;
    this.underFire = this.underFire.map((v) => v * 0.6);
    // badly damaged ships (not flagships) disengage
    if (!this.withdraw && me.hull < me.maxHull * 0.2 && this.role !== 'flagship' && Math.random() < 0.5) {
      this.withdraw = true;
      bus.emit('ai:withdraw', { ship: me });
    }
    const pos = me.pos, des = this.desired.set(0, 0, 0);
    let thr = 0.6;
    const en = this.enemies();
    const enemyC = _v3.set(0, 0, 0);
    for (const e of en) enemyC.add(e.pos);
    if (en.length) enemyC.divideScalar(en.length);
    if (this.withdraw) {
      des.subVectors(pos, enemyC).normalize(); thr = 1;
      me.boost = me.boostHeat < 0.6;
      if (!en.length || pos.distanceTo(enemyC) > 38000) this.jumpOut();
    } else if (this.leader && this.leader.alive && (!tg || tg.pos.distanceTo(pos) > 19000)) {
      // hold formation on the leader until the enemy is close
      const slot = _v1.copy(this.offset).applyQuaternion(this.leader.quat).add(this.leader.pos);
      const to = _v2.subVectors(slot, pos), d = to.length();
      des.copy(this.leader.fwd(new THREE.Vector3())).multiplyScalar(1500).add(to).normalize();
      thr = clamp(this.leader.throttle + (to.dot(this.leader.fwd(_v1)) > 0 ? d / 6000 : -d / 6000), 0.1, 1);
    } else if (this.role === 'carrier') {
      // hang back behind the flagship, flank to the enemy
      const fl = g.ships.find((s) => s.team === me.team && s.alive && s.flagship);
      const anchor = (fl ? fl.pos : pos).clone();
      const away = _v1.subVectors(pos, enemyC).setY(0).normalize();
      anchor.addScaledVector(away, 6000); anchor.y += 900;
      const to = _v2.subVectors(anchor, pos), d = to.length();
      des.copy(to).normalize(); thr = clamp(d / 5000, 0.05, 0.7);
      if (d < 1500) { des.copy(away).multiplyScalar(-1); thr = 0.1; }
    } else if (this.role === 'escort' && this.ward && this.ward.alive) {
      const w = this.ward, threat = g.weapons.nearestCraft(me, w.pos, 6000, true);
      if (threat) { des.subVectors(threat.pos, pos).normalize(); thr = 1; }
      else if (tg && tg.pos.distanceTo(w.pos) < 11000) { this.broadside(tg, this.range, des); thr = 0.8; }
      else {
        const slot = _v1.copy(this.offset || _v2.set(1500, 200, 1500)).applyQuaternion(w.quat).add(w.pos);
        des.subVectors(slot, pos); const d = des.length(); des.normalize(); thr = clamp(d / 3000, 0.2, 1);
        if (d < 800) des.copy(w.fwd(new THREE.Vector3()));
      }
    } else if (tg) {
      const d = tg.pos.distanceTo(pos);
      const siege = me.mounts.find((t) => (t.type === 'siege' || t.type === 'lance' || t.type === 'ram') && t.alive);
      const spinalReady = siege && siege.cd <= 0 && siege.charge <= 0 && siege.beam <= 0 && d < WEAPONS[siege.type].range * 0.95;
      if (spinalReady || (siege && (siege.charge > 0 || siege.beam > 0))) {
        des.subVectors(tg.center(_v1), pos).normalize(); thr = 0.35; // bring the bow weapon to bear
      } else if (d > this.range + 2500) { des.subVectors(tg.pos, pos).normalize(); thr = this.role === 'escort' ? 1 : 0.75; }
      else { this.broadside(tg, this.range, des); thr = 0.5; }
    } else { des.copy(me.fwd(new THREE.Vector3())); thr = 0.3; }
    // altitude keeping and collision avoidance
    const altErr = (this.alt + (tg && !this.withdraw ? (tg.pos.y - this.alt) * 0.4 : 0)) - pos.y;
    des.y += clamp(altErr / 6000, -0.25, 0.25);
    for (const s of g.ships) {
      if (s === me || !(s.alive || s.wreck) || s.gone) continue;
      const away = _v1.subVectors(pos, s.pos), d = away.length(), lim = me.radius + s.radius + 600;
      if (d < lim) des.addScaledVector(away.normalize(), (1 - d / lim) * 3);
    }
    des.normalize();
    this.throttle = thr;
  }
  /** Steer to put a flank toward the target at the given range. */
  broadside(tg, range, out) {
    const me = this.ship, b = _v1.subVectors(tg.pos, me.pos), d = b.length();
    b.normalize();
    const p1 = _v2.crossVectors(AX_Y, b).normalize(), f = me.fwd(new THREE.Vector3());
    if (p1.dot(f) < 0) p1.multiplyScalar(-1);
    return out.copy(p1).addScaledVector(b, clamp((d - range) / 2500, -0.9, 0.9));
  }
  jumpOut() {
    const me = this.ship;
    if (this.gone) return;
    this.gone = true;
    me.alive = false; me.gone = true; me.withdrawn = true;
    this.game.fx.explosion(me.pos, 200, me.vel, { smoke: false });
    this.game.fx.lights.flash(me.pos, 0xbfe6ff, 400, 8000, 0.6);
    me.root.visible = false;
    for (const t of me.mounts) if (t.h) this.game.turrets.hide(t.h);
    bus.emit('ship:withdrawn', { ship: me });
  }
  update(dt) {
    const me = this.ship;
    if (!me.alive) return;
    this.thinkT -= dt;
    if (this.thinkT <= 0) { this.thinkT = 0.5; this.think(); }
    me.ctl.steer = this.desired.lengthSq() > 0 ? this.desired : null;
    me.aiThrottle = approach(me.aiThrottle ?? this.throttle, this.throttle, dt * 0.2);
    if (this.hold > 0) { this.hold -= dt; return; }
    this.game.weapons.autoEngage(me, dt, { doctrine: 'concentrate' });
  }
}

/** Creates AI for every non-player ship, with formations and escort assignments. */
export class FleetAI {
  constructor(game) {
    this.game = game;
    this.list = [];
    bus.on('game:start', () => this.setup());
    bus.on('ship:spawned', ({ ship, opt }) => { if (!ship.isPlayer) this.list.push(new CapitalAI(game, ship, opt || {})); });
    bus.on('weapon:launch', ({ ship, target }) => { if (target?.isPlayer && ship.team !== target.team) bus.emit('alert', { text: 'MISSILE LAUNCH DETECTED', level: 'warn', from: ship }); });
    bus.on('weapon:charge', ({ ship, mount }) => {
      const p = game.player;
      if (mount.type === 'siege' && p && ship.team !== p.team) bus.emit('siege:charging', { ship });
    });
  }
  setup() {
    const g = this.game;
    this.list = [];
    for (const side of ['concord', 'hegemony']) {
      const fleet = g.ships.filter((s) => s.team === side);
      const flag = fleet.find((s) => s.flagship) || fleet[0];
      let ei = 0;
      for (const s of fleet) {
        if (s.isPlayer && !s.autopilot) continue;
        const opt = {};
        if (s !== flag && flag) {
          opt.leader = flag;
          opt.offset = flag.toLocal(s.pos, new THREE.Vector3());
          if (s.length < 600) { opt.ward = flag; opt.offset = flag.toLocal(s.pos, new THREE.Vector3()); ei++; }
        }
        this.list.push(new CapitalAI(g, s, opt));
      }
    }
  }
  update(dt) { if (this.enabled !== false) for (const a of this.list) a.update(dt); }
}
