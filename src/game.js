// Game world: owns ships, the player, control mode, and the per-frame system order.
import * as THREE from 'three';
import { bus } from './core.js';
import { TurretRenderer } from './models.js';
import { Ship } from './ships.js';
import { CameraRig } from './camera.js';
import { spawnFleets, Mission } from './mission.js';
import { FleetAI } from './ai.js';
import { audio } from './audio.js';
import { FX } from './fx.js';
import { Weapons } from './weapons.js';
import { DamageSystem } from './damage.js';

export const MODES = {
  nav: { label: 'NAVIGATION', sens: 1 },
  combat: { label: 'COMBAT', sens: 1 },
  precision: { label: 'PRECISION', sens: 0.3 },
};

export class Game {
  constructor(engine, env) {
    this.engine = engine;
    this.scene = engine.scene;
    this.env = env;
    this.turrets = new TurretRenderer(this.scene);
    this.ships = [];
    this.player = null;
    this.mode = 'combat';
    this.scopeActive = false;
    this.choice = null;
    this.systems = [];   // extra systems registered by later modules: { update(dt), render?(dt) }
    this.fighters = [];  // small craft (filled by the fighter system)
    this.fx = new FX(this.scene);
    this.weapons = new Weapons(this);
    this.damage = new DamageSystem(this);
    this.ai = new FleetAI(this);
    this.mission = new Mission(this);
    this.autoplay = false; // tests: the player's ship is flown by the AI
    this.camera = new CameraRig(engine, this);
    // fire: hold the left button on the battlefield (combat / precision mode, or in the scope)
    bus.on('pointerdown', ({ button }) => {
      if (button === 0 && this.player?.alive && (this.mode !== 'nav' || this.scopeActive)) this.weapons.trigger = true;
    });
    bus.on('pointerup', ({ button }) => { if (button === 0) this.weapons.trigger = false; });
  }
  spawnShip(cls, opts) {
    const s = new Ship(cls, { ...opts, scene: this.scene, turrets: this.turrets });
    return s;
  }
  start(choice) {
    this.choice = choice;
    const { ships, player } = spawnFleets(this, choice);
    this.ships = ships;
    this.player = player;
    if (this.autoplay) player.autopilot = true;
    this.setMode('combat');
    this.camera.recenter();
    bus.emit('game:start', { game: this, choice });
  }
  setMode(m) {
    if (!MODES[m]) return;
    this.mode = m;
    if (this.player) this.player.ctl.sens = MODES[m].sens;
    bus.emit('mode', m);
  }
  addSystem(s) { this.systems.push(s); return s; }

  update(dt) {
    for (const s of this.systems) s.preUpdate?.(dt);
    for (const s of this.ships) s.update(dt);
    this.ai.update(dt);
    this.weapons.update(dt);
    this.damage.update(dt);
    this.mission.update(dt);
    this.fx.update(dt);
    for (const s of this.systems) s.update?.(dt);
    const p = this.player;
    audio.update(dt, p ? p.throttle : 0, p ? p.boosting : false);
  }
  render(dt) {
    this.camera.update(dt);
    this.env.update(dt, this.engine.camera);
    for (const s of this.ships) s.poseTurrets();
    this.turrets.flush();
    this.fx.streaks.begin();
    this.weapons.render(dt);
    this.damage.render(dt);
    this.fx.render(dt);
    for (const s of this.systems) s.render?.(dt);
  }
  /** Snapshot for tests and the HUD. */
  state() {
    const p = this.player;
    return p ? {
      ship: p.name, cls: p.cls, team: p.team, mode: this.mode, view: this.camera.view,
      speed: p.speed(), detent: p.detent, throttle: p.throttle, heading: p.heading(), boostHeat: p.boostHeat, boosting: p.boosting,
      pos: p.pos.toArray(), yawRate: p.angVel.y, ctl: { ...p.ctl, steer: !!p.ctl.steer, hold: !!p.ctl.hold },
      ships: this.ships.length,
      target: p.target?.name || null, targetSub: p.targetSub, selected: this.weapons.selected, doctrine: this.weapons.doctrine,
      groups: this.weapons.groupState, scope: this.scopeActive, hull: p.hull, maxHull: p.maxHull, alive: p.alive, shields: [...p.shields], shieldBoost: p.shieldBoost, fires: p.fires?.length || 0, subs: Object.fromEntries(Object.entries(p.subs).map(([k, v]) => [k, { hp: v.hp / v.max, offline: v.offline }])), stats: { ...p.stats },
      over: this.mission.over, result: this.mission.result, missionT: this.mission.t, reinforced: this.mission.reinforced,
      fleet: this.ships.map((s) => ({ n: s.name, team: s.team, alive: s.alive, hull: Math.round(s.hull), withdrawn: !!s.withdrawn })),
      projectiles: this.weapons.list.length, missiles: this.weapons.missiles.length, mines: this.weapons.mines.length,
    } : null;
  }
}
