// Damage model: directional shields, facing-dependent armour, weapon mounts and subsystems.
// applyHit() is the single entry point every weapon uses.
import * as THREE from 'three';
import { bus, settings, rand } from './core.js';
import { SECTORS } from './ships.js';
import { audio, falloff } from './audio.js';

/** Mount toughness by type (hit points). */
export const MOUNT_HP = {
  heavy: 900, macro: 950, secondary: 240, broadside: 520, gundeck: 560, plasma: 700, ion: 420, massdriver: 600,
  pd: 140, flak: 200, vls: 260, torpedo: 400, mine: 300, lance: 4000, siege: 4200, ram: 2600,
};
/** Mount hit radius in metres (for splash). */
export const MOUNT_R = { heavy: 90, macro: 95, secondary: 30, broadside: 45, gundeck: 45, plasma: 75, ion: 50, massdriver: 60, pd: 16, flak: 26, vls: 20, torpedo: 24, mine: 26, lance: 60, siege: 70, ram: 50 };
/** Incoming damage multiplier on the player by difficulty, and outgoing on enemies. */
export const DIFFICULTY = {
  cadet: { taken: 0.55, regen: 1.5, aiSkill: 0.7, enemyHull: 0.85 },
  captain: { taken: 0.8, regen: 1.0, aiSkill: 1.0, enemyHull: 1.0 },
  admiral: { taken: 1.1, regen: 0.8, aiSkill: 1.3, enemyHull: 1.2 },
};
export const diff = () => DIFFICULTY[settings.difficulty] || DIFFICULTY.captain;

/** Facing of a local hit point: fore / aft / port / stbd (for armour). */
function facing(ship, local) {
  const hz = ship.length / 2;
  if (local.z > hz * 0.35) return 'fore';
  if (local.z < -hz * 0.55) return 'aft';
  return local.x > 0 ? 'port' : 'stbd';
}

/**
 * Apply a hit. h = { local, point, shield, sector } from Ship.raycast.
 * def = weapon definition (multipliers, splash, pierce, disable).
 * Returns { shieldDmg, hullDmg }.
 */
export function applyHit(ship, h, dmg, def, src) {
  if (!ship.alive) return { shieldDmg: 0, hullDmg: 0 };
  if (ship.isPlayer && src && src.team !== ship.team) dmg *= diff().taken;
  let rem = dmg, shieldDmg = 0;
  if (h.shield) {
    const sec = h.sector, mul = def.shieldMul || 1;
    const sd = dmg * mul * (1 - (def.pierce || 0)) * (ship.shieldBoost === sec ? 0.8 : 1); // a boosted sector holds better
    const absorbed = Math.min(sd, ship.shields[sec]);
    ship.shields[sec] -= absorbed; shieldDmg = absorbed;
    ship.shieldDelay[sec] = 3.5;
    rem = (sd - absorbed) / mul + dmg * (def.pierce || 0);
    bus.emit('hit:shield', { ship, h, dmg: absorbed, src, def });
    if (ship.shields[sec] <= 0 && absorbed > 0) bus.emit('shield:down', { ship, sector: sec, name: SECTORS[sec], src });
    if (rem <= 0.5) { tally(src, ship, absorbed); return { shieldDmg, hullDmg: 0 }; }
  }
  const armour = ship.C.armour?.[facing(ship, h.local)] ?? 1;
  const hd = rem * (def.hullMul || 1) * armour;
  ship.hull -= hd;
  ship.recentDamage = (ship.recentDamage || 0) + hd;
  tally(src, ship, shieldDmg + hd);
  bus.emit('hit:hull', { ship, h, dmg: hd, src, def });

  // splash damage to nearby mounts and subsystems
  const splash = (def.splash || 0) + 40;
  for (const t of ship.mounts) {
    if (!t.alive) continue;
    const r = (MOUNT_R[t.type] || 30) + splash * 0.5, d = t.m.pos.distanceTo(h.local);
    if (d < r) damageMount(ship, t, hd * (1 - d / r) * (def.sysMul || 1) * 0.9, src);
  }
  const sysMul = def.sysMul || 1;
  for (const [key, s] of Object.entries(ship.subs)) {
    const r = ship.length * 0.12 + splash, d = s.pos.distanceTo(h.local);
    if (d < r) {
      const before = s.hp;
      s.hp = Math.max(0, s.hp - hd * (1 - d / r) * sysMul * 0.6);
      if (def.disable) s.offline = Math.max(s.offline, def.disable * (1 - d / r));
      if (before > 0 && s.hp <= 0) bus.emit('subsystem', { ship, key, state: 'destroyed', src });
      else if (before > s.max * 0.5 && s.hp <= s.max * 0.5) bus.emit('subsystem', { ship, key, state: 'damaged', src });
    }
  }
  if (def.disable && h.shield) {
    // ion bolts disrupt the shield generator even when they splash on the shield
    const sg = ship.subs.shieldgen;
    if (sg) sg.offline = Math.max(sg.offline, def.disable * 0.4);
  }
  ship.lastHitBy = src;
  if (ship.hull <= 0) { ship.hull = 0; ship.killer = src; bus.emit('ship:killed', { ship, src }); }
  return { shieldDmg, hullDmg: hd };
}

export function damageMount(ship, t, dmg, src) {
  if (!t.alive) return;
  t.hp -= dmg / (MOUNT_HP[t.type] || 300);
  if (t.hp <= 0) {
    t.hp = 0; t.alive = false;
    bus.emit('mount:lost', { ship, mount: t, src });
  }
}

function tally(src, ship, dmg) {
  if (!src || !src.stats) return;
  src.stats.dealt += dmg;
  src.stats.hits++;
  ship.stats.taken += dmg;
}

/* ======================================================================
   Damage system: shield recharge and sector boost, subsystem repair,
   critical hits and fires, shield bubble visuals, staged destruction.
   ====================================================================== */

const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _e = new THREE.Euler();
export const SUB_LABEL = { engines: 'ENGINES', shieldgen: 'SHIELD GENERATOR', sensors: 'SENSORS', reactor: 'REACTOR', hangar: 'HANGAR', bridge: 'BRIDGE', siege: 'SIEGE CANNON' };

/** Shield bubble: invisible until hit; impacts flare and ripple, sector strength tints it. */
function shieldMaterial(color) {
  const imps = Array.from({ length: 10 }, () => new THREE.Vector4(0, 0, 1, -100));
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uTime: { value: 0 }, uAct: { value: 0 }, uImp: { value: imps }, uSect: { value: new THREE.Vector4(1, 1, 1, 1) } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vL; varying vec3 vV;
      void main(){
        vL = normalize(position);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uTime; uniform float uAct; uniform vec4 uImp[10]; uniform vec4 uSect;
      varying vec3 vN; varying vec3 vL; varying vec3 vV;
      void main(){
        #include <logdepthbuf_fragment>
        float rim = pow(1.0 - abs(dot(vN, vV)), 2.5);
        float a = rim * uAct * 0.35;
        for (int i = 0; i < 10; i++) {
          float age = uTime - uImp[i].w;
          if (age < 0.0 || age > 1.6) continue;
          float d = acos(clamp(dot(vL, normalize(uImp[i].xyz)), -1.0, 1.0));
          float ring = exp(-pow((d - age * 0.9) * 9.0, 2.0)) * (1.0 - age / 1.6);
          float core = exp(-d * d * 60.0) * exp(-age * 5.0);
          a += ring * 0.7 + core * 1.6;
        }
        // which sector this fragment belongs to (fore, aft, port, starboard)
        float ang = atan(vL.x, vL.z);
        float s = abs(ang) < 0.785 ? uSect.x : abs(ang) > 2.356 ? uSect.y : ang > 0.0 ? uSect.z : uSect.w;
        vec3 c = mix(vec3(1.0, 0.35, 0.2), uColor, s);
        gl_FragColor = vec4(c * a, a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

let WRECK_MAT = null;
function wreckMaterial() {
  if (!WRECK_MAT) WRECK_MAT = new THREE.MeshStandardMaterial({ color: 0x3a3532, roughness: 0.95, metalness: 0.15, emissive: 0x220800, vertexColors: true });
  return WRECK_MAT;
}

export class DamageSystem {
  constructor(game) {
    this.game = game;
    this.fx = game.fx;
    bus.on('game:start', () => { for (const s of game.ships) this.attach(s); });
    bus.on('ship:spawned', ({ ship }) => this.attach(ship));
    bus.on('fx:shield', ({ ship, local, big }) => this.shieldImpact(ship, local, big));
    bus.on('hit:hull', (e) => this.onHullHit(e));
    bus.on('ship:killed', ({ ship, src }) => this.kill(ship, src));
  }
  attach(ship) {
    if (ship.shieldMesh) return;
    const mat = shieldMaterial(ship.faction === 'concord' ? 0x7fc4ff : 0xff9a50);
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), mat);
    m.scale.copy(ship.shieldR); m.position.copy(ship.shieldC);
    m.renderOrder = 7;
    ship.root.add(m);
    ship.shieldMesh = m; ship.shieldMat = mat; ship.impIdx = 0;
    ship.fires = []; ship.scars = [];
    if (ship.team !== this.game.player?.team && !ship.isPlayer) {
      const k = diff().enemyHull; ship.hull = ship.maxHull = ship.C.hull * k;
    }
  }
  shieldImpact(ship, local, big) {
    if (!ship.shieldMat) return;
    const u = ship.shieldMat.uniforms;
    _v1.copy(local).sub(ship.shieldC).divide(ship.shieldR).normalize();
    u.uImp.value[ship.impIdx].set(_v1.x, _v1.y, _v1.z, u.uTime.value);
    ship.impIdx = (ship.impIdx + 1) % 10;
    u.uAct.value = Math.min(1, u.uAct.value + (big ? 0.5 : 0.1));
  }
  onHullHit({ ship, h, dmg, src }) {
    if (!ship.alive) return;
    if (dmg > 200 && ship.scars.length < 24) ship.scars.push({ p: h.local.clone(), rate: rand(1, 4) });
    // critical hits: big hits and low hull raise the odds
    const lowHull = ship.hull < ship.maxHull * 0.4;
    const chance = (dmg / ship.maxHull) * 9 + (lowHull ? 0.03 : 0);
    if (Math.random() < chance) this.critical(ship, h.local, dmg, src);
  }
  critical(ship, local, dmg, src) {
    if (Math.random() < 0.55 && ship.fires.length < 6) {
      ship.fires.push({ p: local.clone(), t: rand(10, 20), dps: ship.maxHull * 0.0011 });
      bus.emit('critical', { ship, kind: 'fire', src });
    } else {
      let near = null, nd = Infinity;
      for (const [k, s] of Object.entries(ship.subs)) { const d = s.pos.distanceTo(local); if (d < nd && s.hp > 0) { nd = d; near = k; } }
      if (near) {
        const s = ship.subs[near];
        s.hp = Math.max(0, s.hp - s.max * 0.45);
        bus.emit('critical', { ship, kind: 'system', key: near, src });
        if (s.hp <= 0) bus.emit('subsystem', { ship, key: near, state: 'destroyed', src });
      }
    }
    if (ship.isPlayer) bus.emit('shake', { amount: 0.3 });
  }

  /** Shift shield power: sector index 0..3 boosted, or -1 for balanced. */
  boostSector(ship, sec) {
    ship.shieldBoost = ship.shieldBoost === sec ? -1 : sec;
    bus.emit('shield:boost', { ship, sector: ship.shieldBoost });
  }

  update(dt) {
    const T = this.game.engine.time.sim;
    for (const s of this.game.ships) {
      if (!s.shieldMat) continue;
      s.shieldMat.uniforms.uTime.value = T;
      s.shieldMat.uniforms.uAct.value = Math.max(0, s.shieldMat.uniforms.uAct.value - dt * 0.8);
      if (s.dying) { this.updateDeath(s, dt); continue; }
      if (!s.alive) continue;
      this.updateShields(s, dt);
      this.updateSystems(s, dt);
      this.updateFires(s, dt);
      if (s.hull <= 0 && s.alive) { s.hull = 0; bus.emit('ship:killed', { ship: s, src: s.lastHitBy }); }
    }
  }
  updateShields(s, dt) {
    const sg = s.subs.shieldgen;
    const gen = !sg ? 1 : sg.offline > 0 || sg.hp <= 0 ? 0 : 0.35 + 0.65 * (sg.hp / sg.max);
    const regen = s.C.regen * gen * (s.isPlayer ? diff().regen : 1);
    for (let i = 0; i < 4; i++) {
      if (s.shieldDelay[i] > 0) { s.shieldDelay[i] -= dt; continue; }
      const boost = s.shieldBoost < 0 ? 1 : s.shieldBoost === i ? 2.4 : 0.55;
      const cap = s.maxShield * (s.shieldBoost === i ? 1.25 : 1);
      if (s.shields[i] < cap) {
        const wasDown = s.shields[i] <= 0;
        s.shields[i] = Math.min(cap, s.shields[i] + regen * boost * dt);
        if (wasDown && s.shields[i] > 0) bus.emit('shield:up', { ship: s, sector: i });
      } else if (s.shields[i] > cap) s.shields[i] = Math.max(cap, s.shields[i] - s.maxShield * 0.05 * dt);
    }
    const u = s.shieldMat.uniforms.uSect.value, m = s.maxShield;
    u.set(s.shields[0] / m, s.shields[1] / m, s.shields[2] / m, s.shields[3] / m);
    s.shieldMesh.visible = s.shieldsUp();
  }
  updateSystems(s, dt) {
    for (const [k, sub] of Object.entries(s.subs)) {
      if (sub.offline > 0) {
        sub.offline -= dt;
        if (sub.offline <= 0) { sub.offline = 0; bus.emit('subsystem', { ship: s, key: k, state: 'restored' }); }
      }
      if (sub.hp <= 0) {
        // damage control brings a destroyed system back to partial function
        sub.repairT = (sub.repairT || 0) + dt;
        if (sub.repairT > (s.isPlayer ? 24 : 32)) { sub.hp = sub.max * 0.3; sub.repairT = 0; bus.emit('subsystem', { ship: s, key: k, state: 'restored' }); }
      } else if (sub.hp < sub.max) sub.hp = Math.min(sub.max, sub.hp + sub.max * 0.006 * dt);
    }
    s.recentDamage = Math.max(0, (s.recentDamage || 0) - dt * s.maxHull * 0.01);
  }
  updateFires(s, dt) {
    for (let i = s.fires.length - 1; i >= 0; i--) {
      const f = s.fires[i];
      f.t -= dt;
      s.hull -= f.dps * dt; s.stats.taken += f.dps * dt;
      if (f.t <= 0) { s.fires.splice(i, 1); bus.emit('fire:out', { ship: s }); }
    }
  }
  /** Visual fires, sparks and smoke (per rendered frame). */
  render(dt) {
    const cam = this.game.engine.camera.position;
    for (const s of this.game.ships) {
      if (s.gone || !s.fires) continue;
      const near = s.pos.distanceToSquared(cam) < 6e8;
      for (const f of s.fires) {
        if (Math.random() > dt * 18) continue;
        const p = s.toWorld(f.p, _v2);
        const big = s.dying ? 3 : 1;
        this.fx.add.spawn(p, _v1.set(rand(-8, 8), rand(-8, 8), rand(-8, 8)).add(s.vel), rand(0.4, 1.0), 20 * big, 60 * big, [1, 0.7, 0.35], [0.5, 0.12, 0.02], 0.9, 0.2);
        if (near && Math.random() < 0.4) this.fx.smoke.spawn(p, _v1.set(rand(-14, 14), rand(-14, 14), rand(-14, 14)).add(s.vel), rand(2, 4), 30 * big, 160 * big, [0.3, 0.29, 0.28], [0.08, 0.08, 0.09], 0.4, 0.1);
      }
      if (!near) continue;
      for (const sc of s.scars) {
        if (Math.random() > dt * sc.rate) continue;
        this.fx.add.spawn(s.toWorld(sc.p, _v2), _v1.set(rand(-30, 30), rand(-30, 30), rand(-30, 30)).add(s.vel), rand(0.2, 0.7), 5, 1, [1, 0.85, 0.5], [0.6, 0.2, 0], 1, 0.5);
      }
    }
  }

  /* ---------- staged destruction ---------- */
  kill(ship, src) {
    if (ship.dying || ship.gone) return;
    ship.alive = false; ship.dying = true; ship.deathT = 0; ship.killer = src;
    ship.boost = false;
    if (ship.shieldMesh) ship.shieldMesh.visible = false;
    ship.big = ship.length > 1000;
    ship.spin = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(ship.big ? 0.012 : 0.06);
    if (src?.stats) src.stats.kills++;
    bus.emit('ship:destroyed', { ship, src });
  }
  updateDeath(s, dt) {
    s.deathT += dt;
    const T = s.deathT, big = s.big;
    s.root.position.addScaledVector(s.vel, dt);
    s.vel.multiplyScalar(1 - 0.03 * dt);
    _q.setFromEuler(_e.set(s.spin.x * dt, s.spin.y * dt, s.spin.z * dt)); s.root.quaternion.multiply(_q);
    s.root.updateMatrixWorld(); s.inv.copy(s.root.matrixWorld).invert();
    const cam = this.game.engine.camera.position;
    const cascadeEnd = big ? 4.5 : 0.9;
    if (T < cascadeEnd) {
      // stage 1: secondary explosions ripple through the hull
      if (Math.random() < dt * (big ? 7 : 10)) {
        const b = s.hitBoxes[Math.floor(Math.random() * s.hitBoxes.length)];
        const p = s.toWorld(_v1.set(rand(b.min.x, b.max.x), rand(b.min.y, b.max.y), rand(b.min.z, b.max.z)), new THREE.Vector3());
        this.fx.explosion(p, (big ? 140 : 50) * rand(0.7, 1.5), s.vel, { debris: 2 });
        if (big) this.fx.lights.flash(p, 0xffa060, 200, 6000, 0.5);
        audio.explosion(1.4, falloff(p.distanceTo(cam)) * 0.8);
        if (big && p.distanceTo(cam) < 12000) bus.emit('shake', { amount: 0.12 });
      }
    } else if (!s.blown) {
      // stage 2: the reactor goes
      s.blown = true;
      const rp = s.toWorld(s.subs.reactor?.pos || s.shieldC, new THREE.Vector3());
      const sz = big ? 600 : 160;
      this.fx.explosion(rp, sz, s.vel, { debris: big ? 30 : 8, ring: big, ringQ: s.root.quaternion });
      this.fx.lights.flash(rp, 0xffd0a0, big ? 2500 : 400, sz * 60, 1.4);
      audio.explosion(big ? 5 : 2.5, Math.max(0.25, falloff(rp.distanceTo(cam), 20000)));
      bus.emit('shake', { amount: rp.distanceTo(cam) < 20000 ? (big ? 0.8 : 0.25) : 0.05 });
      bus.emit('ship:reactor', { ship: s });
      // stage 3: the hull breaks in two and goes dark
      const wm = wreckMaterial();
      for (const part of [s.model.fore, s.model.aft]) {
        if (!part) continue;
        part.traverse((o) => { if (o.isMesh && o.material?.isMeshStandardMaterial) o.material = wm; else if (o.isMesh && o.userData.matKey === 'lights') o.visible = false; });
      }
      s.model.engineFx.set(0); for (const c of (s.model.aft || s.model.fore).children) if (c.isSprite || (c.isMesh && !c.userData.matKey)) c.visible = false;
      for (const t of s.mounts) { t.alive = false; if (t.h) this.game.turrets.hide(t.h); }
      if (big && s.model.aft) {
        s.foreV = new THREE.Vector3(rand(-6, 6), rand(-3, 3), 22 + rand(0, 10));
        s.aftV = new THREE.Vector3(rand(-6, 6), rand(-3, 3), -16 - rand(0, 8));
        s.foreW = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.02);
        s.aftW = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(0.015);
        const sz2 = s.design.split ?? 0;
        for (let i = 0; i < 7; i++) s.fires.push({ p: new THREE.Vector3(rand(-120, 120), rand(-80, 80), sz2 + rand(-80, 80)), t: rand(60, 120), dps: 0 });
        s.wreck = true;
      } else {
        // escorts are torn apart: the hull disappears into debris
        s.root.visible = false; s.gone = true;
        for (let i = 0; i < 4; i++) this.fx.explosion(_v1.copy(rp).add(_v2.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(s.length * 0.3)), 90, s.vel, { debris: 3 });
      }
    } else if (s.foreV) {
      // drifting halves, burning at the break
      s.model.fore.position.addScaledVector(s.foreV, dt); s.model.aft.position.addScaledVector(s.aftV, dt);
      _q.setFromEuler(_e.set(s.foreW.x * dt, s.foreW.y * dt, s.foreW.z * dt)); s.model.fore.quaternion.multiply(_q);
      _q.setFromEuler(_e.set(s.aftW.x * dt, s.aftW.y * dt, s.aftW.z * dt)); s.model.aft.quaternion.multiply(_q);
      if (Math.random() < dt * 0.4 && T < 40) {
        const b = s.hitBoxes[Math.floor(Math.random() * s.hitBoxes.length)];
        this.fx.explosion(s.toWorld(_v1.set(rand(b.min.x, b.max.x), rand(b.min.y, b.max.y), rand(b.min.z, b.max.z)), new THREE.Vector3()), 70, s.vel, { debris: 1 });
      }
      for (const f of s.fires) f.t -= dt * 0.2;
    }
  }
}
