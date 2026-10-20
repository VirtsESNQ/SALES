// Damage model: directional shields, facing-dependent armour, weapon mounts and subsystems.
// applyHit() is the single entry point every weapon uses.
import { bus, settings } from './core.js';
import { SECTORS } from './ships.js';

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
    const mul = def.shieldMul || 1, sd = dmg * mul * (1 - (def.pierce || 0)), sec = h.sector;
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
