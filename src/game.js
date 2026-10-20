// Game world: owns ships, the player, control mode, and the per-frame system order.
import * as THREE from 'three';
import { bus } from './core.js';
import { TurretRenderer } from './models.js';
import { Ship } from './ships.js';
import { CameraRig } from './camera.js';
import { spawnFleets } from './mission.js';
import { audio } from './audio.js';

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
    this.camera = new CameraRig(engine, this);
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
    for (const s of this.systems) s.update?.(dt);
    const p = this.player;
    audio.update(dt, p ? p.throttle : 0, p ? p.boosting : false);
  }
  render(dt) {
    this.camera.update(dt);
    this.env.update(dt, this.engine.camera);
    for (const s of this.ships) s.poseTurrets();
    this.turrets.flush();
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
    } : null;
  }
}
