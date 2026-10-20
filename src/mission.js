// Operation Black Tide: fleet layout, objectives and script.
// Either side is playable. The player commands one hull of the chosen side; the rest are AI.
import * as THREE from 'three';
import { bus, fmtTime } from './core.js';
import { SECTORS } from './ships.js';
import { audio } from './audio.js';

/** Order of battle. Positions in metres; the Concord fleet heads +Z toward the Hegemony line. */
export const FLEETS = {
  concord: [
    { cls: 'halberd', name: 'CSV Halberd', pos: [0, 0, 0], flagship: true },
    { cls: 'rampart', name: 'CSV Rampart', pos: [2600, 120, -1400] },
    { cls: 'warden', name: 'CSV Lancer', pos: [-1500, 200, 1600] },
    { cls: 'warden', name: 'CSV Sabre', pos: [1700, -150, 2100] },
    { cls: 'warden', name: 'CSV Pike', pos: [-2500, -100, -900] },
  ],
  hegemony: [
    { cls: 'varr', name: 'Varr Tolun', pos: [0, 200, 24000], flagship: true },
    { cls: 'kesh', name: 'Kesh', pos: [-2800, 0, 22400] },
    { cls: 'kesh', name: 'Morvai', pos: [3000, 300, 22700] },
    { cls: 'ulthane', name: 'Ulthane', pos: [1600, -400, 27600] },
    { cls: 'talon', name: 'Talon 1', pos: [-1400, 500, 21200] },
    { cls: 'talon', name: 'Talon 2', pos: [1500, -300, 21000] },
    { cls: 'talon', name: 'Talon 3', pos: [-4200, -200, 23800] },
    { cls: 'talon', name: 'Talon 4', pos: [4600, 200, 24500] },
  ],
};
export const HEADING = { concord: 0, hegemony: Math.PI };

/** Ships the player may command, per side, in menu order. */
export const PLAYABLE = {
  concord: [
    { cls: 'halberd', role: 'Flagship dreadnought. The heaviest guns in the fleet and a hangar of six squadrons.', recommended: true },
    { cls: 'rampart', role: 'Line battlecruiser. Strong broadsides and mass drivers, quicker to turn.' },
    { cls: 'warden', role: 'Screen frigate. Fast and agile, hunts fighters, fragile.' },
  ],
  hegemony: [
    { cls: 'varr', role: 'Siege flagship. Two gun decks and the prow siege cannon.', recommended: true },
    { cls: 'kesh', role: 'Claw cruiser. Brutal ram cannon in the forked prow, 16-gun deck.' },
    { cls: 'ulthane', role: 'Hive carrier. Launches six squadrons from its arched galleries.' },
    { cls: 'talon', role: 'Blade escort. The fastest hull in the battle, fragile.' },
  ],
};

/** Spawn both fleets. Returns { ships, player }. */
export function spawnFleets(game, choice) {
  const ships = [];
  let player = null;
  for (const side of ['concord', 'hegemony']) {
    for (const u of FLEETS[side]) {
      const s = game.spawnShip(u.cls, { name: u.name, team: side, position: new THREE.Vector3(...u.pos), heading: HEADING[side] });
      s.flagship = !!u.flagship;
      ships.push(s);
      if (!player && side === choice.side && u.cls === choice.ship) player = s;
    }
  }
  if (player) player.isPlayer = true;
  return { ships, player };
}

/* ======================================================================
   Operation Black Tide: objectives, step-by-step hints, reinforcements,
   victory and defeat. Mirrored when the player commands the Hegemony.
   ====================================================================== */

/** Reinforcements that jump in on the player's flank partway through. */
export const REINFORCEMENTS = {
  concord: [
    { cls: 'rampart', name: 'CSV Bulwark', off: [-9000, 400, 4000] },
    { cls: 'warden', name: 'CSV Glaive', off: [-8000, 900, 5200] },
    { cls: 'warden', name: 'CSV Partisan', off: [-10200, -200, 3000] },
  ],
  hegemony: [
    { cls: 'kesh', name: 'Vashk', off: [9000, 300, -4000] },
    { cls: 'talon', name: 'Talon 5', off: [8000, 800, -5200] },
    { cls: 'talon', name: 'Talon 6', off: [10200, -300, -3000] },
  ],
};

export class Mission {
  constructor(game) {
    this.game = game;
    this.t = 0; this.over = false; this.result = null;
    this.objectives = [];
    this.reinforced = false;
    this.losses = { concord: 0, hegemony: 0 };
    bus.on('game:start', () => this.start());
    bus.on('ship:destroyed', ({ ship }) => { this.losses[ship.team]++; });
    bus.on('ship:withdrawn', ({ ship }) => { this.losses[ship.team]++; bus.emit('radio', { from: 'TACTICAL', text: `${ship.name} has jumped out of the battle.`, level: ship.team === game.player?.team ? 'warn' : 'ok' }); });
    bus.on('ai:withdraw', ({ ship }) => { if (ship.team === game.player?.team) bus.emit('radio', { from: ship.name.toUpperCase(), text: 'Heavy damage. Disengaging from the line.', level: 'warn' }); else bus.emit('radio', { from: 'TACTICAL', text: `${ship.name} is breaking off.`, level: 'ok' }); });
    bus.on('target', () => this.complete('lock'));
    bus.on('player:fired', () => this.complete('fire'));
    bus.on('squadron:launched', ({ carrier }) => { if (carrier?.isPlayer) this.complete('fighters'); });
    bus.on('siege:charging', ({ ship }) => this.warnSpinal(ship));
    bus.on('weapon:charge', ({ ship, mount }) => {
      const p = game.player;
      if (p && mount.type === 'lance' && ship.team !== p.team && ship.target === p) this.warnSpinal(ship);
    });
    bus.on('alert', ({ text, level }) => { if (text.startsWith('MISSILE')) audio.alarm('missile'); });
  }
  get player() { return this.game.player; }
  start() {
    const g = this.game, p = this.player;
    const side = p.team, foe = side === 'concord' ? 'hegemony' : 'concord';
    this.side = side; this.foe = foe;
    this.ownFlag = g.ships.find((s) => s.team === side && s.flagship);
    this.enemyFlag = g.ships.find((s) => s.team === foe && s.flagship);
    const ef = this.enemyFlag.name, of = this.ownFlag.name;
    this.objectives = [
      { id: 'kill', main: true, text: `Destroy the ${ef}`, hint: 'Its stern and engines are the weak spot.' },
      { id: 'keep', main: true, text: p === this.ownFlag ? `Keep your ship, the ${of}, alive` : `Keep the ${of} alive`, hint: 'Watch your shields; turn a fresh sector toward heavy fire.' },
      { id: 'close', text: 'Close to firing range of the enemy line', hint: 'Drag the throttle lever up. Your heavy guns reach 15 km.' },
      { id: 'lock', text: 'Lock a target', hint: 'Click a contact in the target panel (top right), or LOCK NEAREST.' },
      { id: 'fire', text: 'Bring a battery to bear and fire', hint: 'Put the cursor on the target. When the reticle says ALIGNED · READY, hold the left mouse button.' },
    ];
    if (p.C.hangar) this.objectives.push({ id: 'fighters', text: 'Launch fighters', hint: 'Open the fighter panel and launch a squadron.' });
    for (const o of this.objectives) o.state = 'active';
    bus.emit('radio', { from: 'TACTICAL', text: `Contact. ${foe === 'hegemony' ? 'Hegemony battle fleet' : 'Concord battle line'} bearing 000, range 24 kilometres. ${ef} leads.`, level: 'info' });
    bus.emit('objectives', this.objectives);
  }
  complete(id) {
    const o = this.objectives.find((x) => x.id === id);
    if (!o || o.state !== 'active') return;
    o.state = 'done';
    bus.emit('objectives', this.objectives);
    bus.emit('objective:done', o);
  }
  warnSpinal(ship) {
    const p = this.player;
    if (!p || !p.alive) return;
    const sec = SECTORS[p.sectorOfLocal(p.toLocal(ship.pos))].toLowerCase();
    const weapon = ship.cls === 'varr' ? 'siege cannon' : 'spinal lance';
    bus.emit('alert', { text: `${weapon.toUpperCase()} CHARGING — ${ship.name.toUpperCase()}`, level: 'crit', from: ship });
    bus.emit('radio', { from: 'TACTICAL', text: `${ship.name} is charging its ${weapon}. Turn out of its bow line or boost the ${sec} shield.`, level: 'crit' });
    audio.alarm('crit');
  }
  reinforce() {
    if (this.reinforced) return;
    this.reinforced = true;
    const g = this.game, side = this.side, p = this.player;
    const base = (this.ownFlag?.alive ? this.ownFlag : p).pos;
    const dir = side === 'concord' ? 1 : -1;
    for (const r of REINFORCEMENTS[side]) {
      const pos = new THREE.Vector3(r.off[0], r.off[1], r.off[2] * dir).add(base);
      const s = g.spawnShip(r.cls, { name: r.name, team: side, position: pos, heading: side === 'concord' ? 0 : Math.PI });
      g.ships.push(s);
      s.arrive = 0.9;
      s.vel.copy(s.fwd(new THREE.Vector3())).multiplyScalar(s.C.maxSpeed * 0.6);
      bus.emit('ship:spawned', { ship: s, opt: { hold: 3 } });
      g.fx.lights.flash(pos, 0xbfe6ff, 600, 12000, 0.8);
      g.fx.explosion(pos, 160, s.vel, { smoke: false });
    }
    audio.jump();
    bus.emit('alert', { text: 'REINFORCEMENTS ON THE FLANK', level: 'ok' });
    bus.emit('radio', { from: REINFORCEMENTS[side][0].name.toUpperCase(), text: `Dropping out of jump on your ${side === 'concord' ? 'port' : 'starboard'} flank. Engaging.`, level: 'ok' });
  }
  update(dt) {
    if (this.over || !this.player) return;
    this.t += dt;
    const g = this.game, p = this.player;
    const foes = g.ships.filter((s) => s.alive && s.team !== p.team);
    if (p.alive && foes.some((s) => s.pos.distanceTo(p.pos) < 16000)) this.complete('close');
    // reinforcements: after 2.5 minutes, or sooner if the line is hurting
    const own = this.ownFlag;
    if (!this.reinforced && (this.t > 150 || this.losses[this.side] >= 2 || (own && own.hull < own.maxHull * 0.55))) this.reinforce();
    // outcome
    if (!this.enemyFlag.alive) this.end(true, `${this.enemyFlag.name} ${this.enemyFlag.withdrawn ? 'has fled the battle' : 'destroyed'}.`);
    else if (!p.alive) this.end(false, `${p.name} destroyed.`);
    else if (own && !own.alive) this.end(false, `${own.name} lost.`);
    else if (!foes.length) this.end(true, 'The enemy fleet is destroyed.');
  }
  end(victory, reason) {
    if (this.over) return;
    this.over = true;
    const kill = this.objectives.find((o) => o.id === 'kill'), keep = this.objectives.find((o) => o.id === 'keep');
    if (kill) kill.state = victory ? 'done' : kill.state === 'active' ? 'failed' : kill.state;
    if (keep) keep.state = victory ? 'done' : 'failed';
    bus.emit('objectives', this.objectives);
    this.result = { victory, reason, time: this.t };
    bus.emit('mission:end', this.result);
    bus.emit('alert', { text: victory ? 'VICTORY' : 'DEFEAT', level: victory ? 'ok' : 'crit' });
  }
  stats() {
    const p = this.player, s = p.stats;
    return {
      time: fmtTime(this.t), dealt: Math.round(s.dealt), taken: Math.round(s.taken), shots: s.shots, hits: s.hits,
      accuracy: s.shots ? Math.round((s.hits / s.shots) * 100) : 0, kills: s.kills, intercepts: s.intercepts || 0,
      lostOwn: this.losses[this.side], lostEnemy: this.losses[this.foe],
    };
  }
}
