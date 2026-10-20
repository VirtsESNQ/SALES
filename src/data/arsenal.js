// Weapon definitions (the 12-weapon Concord catalogue plus Hegemony-only guns)
// and per-ship mount counts. Numbers follow design/arsenal.html (source: design sheets PDF).
//
// Fields
//   range m · reload s · speed m/s (0 = beam/hitscan) · dmg per shot
//   shieldMul / hullMul / sysMul: damage multipliers vs shields, hull, subsystems
//   pierce: fraction of damage that ignores shields · splash: blast radius m
//   traverse: turret slew deg/s · tol: max aim error (deg) to count as ALIGNED
//   arc: default firing arc, ship-local axis + half-angle (deg). Mounts may override.
//   ammo: magazine size (null = energy weapon, unlimited)
//   auto: fires by itself at fighters/missiles (point defence, flak)
//   group: true = appears in the player's weapon grid
export const WEAPONS = {
  heavy: {
    name: 'Heavy turbolaser', short: 'HTL', role: 'capitals', desc: 'Twin turrets that swing on their own. Slow, heavy volleys at capital ships.',
    kind: 'bolt', range: 15000, reload: 6.5, speed: 3400, dmg: 150, splash: 30, spread: 0.0011,
    traverse: 10, tol: 1.3, arc: { axis: 'up', half: 100 }, barrels: 2, ammo: null, color: 0x9fd8ff, group: true, core: true,
  },
  secondary: {
    name: 'Secondary laser battery', short: 'SEC', role: 'fighters', desc: 'Fast lasers. Fire by themselves at fighters and escorts.',
    kind: 'bolt', range: 7500, reload: 1.5, speed: 3800, dmg: 26, spread: 0.0018,
    traverse: 40, tol: 2.5, arc: { axis: 'up', half: 110 }, barrels: 2, ammo: null, color: 0xb9e6ff, group: true, core: true, antiFighter: true,
  },
  broadside: {
    name: 'Broadside battery', short: 'BRD', role: 'capitals', desc: 'Fixed guns along each flank. Turn your side to the enemy, then fire all at once.',
    kind: 'bolt', range: 12000, reload: 9.5, speed: 3000, dmg: 210, splash: 30, spread: 0.0014,
    traverse: 18, tol: 1.6, arc: { axis: 'side', half: 40 }, barrels: 1, ammo: null, color: 0xffd28a, group: true, core: true,
  },
  plasma: {
    name: 'Heavy plasma cannon', short: 'PLS', role: 'shields', desc: 'Slow glowing shell. Huge splash, rips shields apart.',
    kind: 'shell', range: 10000, reload: 13, speed: 1250, dmg: 720, splash: 170, shieldMul: 1.6, hullMul: 1.1, sysMul: 1.6, spread: 0.0008,
    traverse: 8, tol: 1.1, arc: { axis: 'fwd', half: 75 }, barrels: 1, ammo: null, color: 0x7dffb0, group: true, core: true,
  },
  lance: {
    name: 'Spinal lance', short: 'LNC', role: 'capitals', desc: 'Beam along the bow. Point the ship at the target and charge for 2.6 s.',
    kind: 'beam', range: 18000, reload: 34, speed: 0, charge: 2.6, beamDur: 1.5, dps: 2300, splash: 80, shieldMul: 1.3, hullMul: 1.2, sysMul: 2.2,
    traverse: 0, tol: 4, arc: { axis: 'fwd', half: 4 }, barrels: 1, ammo: null, color: 0xd6f4ff, group: true, core: true, spinal: true,
  },
  vls: {
    name: 'Missile VLS cell', short: 'VLS', role: 'anything', desc: 'Guided salvo from deck cells. Needs a locked target. Can be shot down.',
    kind: 'missile', range: 16000, reload: 16, speed: 980, accel: 300, turn: 70, life: 26, mhp: 24, dmg: 160, splash: 60, shieldMul: 0.75, hullMul: 1.3,
    traverse: 0, tol: 180, arc: { axis: 'up', half: 180 }, barrels: 1, ammo: 64, color: 0xffb070, group: true, core: true, needsLock: true,
  },
  pd: {
    name: 'Point-defence turret', short: 'PD', role: 'missiles', desc: 'Automatic. Shoots incoming missiles and torpedoes out of the sky.',
    kind: 'bolt', range: 2600, reload: 0.08, speed: 4200, dmg: 7, spread: 0.004,
    traverse: 999, tol: 99, arc: { axis: 'any', half: 180 }, barrels: 1, ammo: null, color: 0xffe9b0, group: false, core: true, auto: true, antiFighter: true, antiMissile: true,
  },
  ion: {
    name: 'Ion cannon', short: 'ION', role: 'systems', desc: 'Blue bolt that does little hull damage but knocks engines, shields or guns offline.',
    kind: 'bolt', range: 11000, reload: 8, speed: 2600, dmg: 120, shieldMul: 1.8, hullMul: 0.15, sysMul: 3.0, disable: 9, spread: 0.0012,
    traverse: 12, tol: 1.4, arc: { axis: 'up', half: 100 }, barrels: 1, ammo: null, color: 0x6fb6ff, group: true, isNew: true,
  },
  massdriver: {
    name: 'Mass driver', short: 'MDR', role: 'armour', desc: 'Railgun slug at extreme speed. Almost no lead needed, half of it punches through shields.',
    kind: 'slug', range: 20000, reload: 11, speed: 9000, dmg: 420, pierce: 0.5, hullMul: 1.4, sysMul: 1.2, spread: 0.0004,
    traverse: 6, tol: 0.9, arc: { axis: 'fwd', half: 30 }, barrels: 1, ammo: 40, color: 0xe8eef2, group: true, isNew: true,
  },
  torpedo: {
    name: 'Torpedo tube', short: 'TRP', role: 'big ships', desc: 'Heavy torpedoes from the bow. Slow, homing, devastating if they reach the hull.',
    kind: 'missile', range: 6000, reload: 20, speed: 560, accel: 180, turn: 45, life: 22, mhp: 48, dmg: 950, pierce: 0.55, splash: 90, shieldMul: 0.6, hullMul: 1.2, sysMul: 1.3,
    traverse: 0, tol: 20, arc: { axis: 'fwd', half: 20 }, barrels: 1, ammo: 24, color: 0xff8a5a, group: true, isNew: true, needsLock: true,
  },
  flak: {
    name: 'Flak battery', short: 'FLK', role: 'bombers', desc: 'Bursting shells that fill the air near the ship. Shreds bombers in groups.',
    kind: 'flak', range: 3000, reload: 0.6, speed: 1800, dmg: 14, splash: 140, spread: 0.01,
    traverse: 120, tol: 99, arc: { axis: 'any', half: 180 }, barrels: 2, ammo: null, color: 0xffc070, group: false, isNew: true, auto: true, antiFighter: true, antiMissile: true,
  },
  mine: {
    name: 'Gravity mine', short: 'MIN', role: 'fighters', desc: 'Dropped behind the ship. Drags nearby fighters in and detonates.',
    kind: 'mine', range: 1500, reload: 25, speed: 40, dmg: 260, splash: 420, pull: 160, life: 90, slow: 0.5,
    traverse: 0, tol: 180, arc: { axis: 'aft', half: 180 }, barrels: 1, ammo: 16, color: 0xa98cff, group: true, isNew: true,
  },

  /* ---- Hegemony-only guns ---- */
  macro: {
    name: 'Macro cannon turret', short: 'MAC', role: 'capitals', desc: 'Triple-barrel gothic turret. Heavy shells at 15 km.',
    kind: 'bolt', range: 15000, reload: 7, speed: 3000, dmg: 135, splash: 34, spread: 0.0013,
    traverse: 9, tol: 1.4, arc: { axis: 'up', half: 100 }, barrels: 3, ammo: null, color: 0xffa860, group: true,
  },
  gundeck: {
    name: 'Broadside gun deck', short: 'GDK', role: 'capitals', desc: '12 ports per flank. Ripple-fires down the gun deck.',
    kind: 'bolt', range: 12000, reload: 10, speed: 2800, dmg: 190, splash: 30, spread: 0.0016,
    traverse: 14, tol: 1.8, arc: { axis: 'side', half: 42 }, barrels: 1, ammo: null, color: 0xff9a50, group: true,
  },
  siege: {
    name: 'Siege cannon', short: 'SGE', role: 'capitals', desc: 'Prow beam. Glows orange for 3 s before it fires.',
    kind: 'beam', range: 16000, reload: 30, speed: 0, charge: 3, beamDur: 1.8, dps: 2400, splash: 90, shieldMul: 1.2, hullMul: 1.2, sysMul: 1.8,
    traverse: 0, tol: 6, arc: { axis: 'fwd', half: 6 }, barrels: 1, ammo: null, color: 0xff7a2a, group: true, spinal: true,
  },
  ram: {
    name: 'Talon ram cannon', short: 'RAM', role: 'capitals', desc: 'Forked-prow cannon of the Kesh cruiser. Short, brutal, bow only.',
    kind: 'shell', range: 8000, reload: 12, speed: 1600, dmg: 520, splash: 120, shieldMul: 1.3, sysMul: 1.4, spread: 0.0009,
    traverse: 0, tol: 8, arc: { axis: 'fwd', half: 8 }, barrels: 1, ammo: null, color: 0xff8040, group: true,
  },

  /* ---- small-craft weapons ---- */
  flaser:  { name: 'Fighter laser', kind: 'bolt', range: 1100, speed: 2400, dmg: 9, spread: 0.006, color: 0xbfe8ff },
  rocket:  { name: 'Rocket pod', kind: 'missile', range: 3200, speed: 820, accel: 450, turn: 60, life: 6, mhp: 22, dmg: 70, splash: 25, sysMul: 1.8, color: 0xffc080 },
  ftorp:   { name: 'Fighter torpedo', kind: 'missile', range: 5000, speed: 700, accel: 260, turn: 40, life: 14, mhp: 60, dmg: 600, pierce: 0.55, splash: 70, shieldMul: 0.6, hullMul: 1.2, sysMul: 1.3, color: 0xff8a5a },
  fflak:   { name: 'Gunship flak', kind: 'flak', range: 1400, speed: 1500, dmg: 9, splash: 60, spread: 0.01, color: 0xffc070 },
};

/** Order of tiles in the player's weapon grid. */
export const GRID_ORDER = ['heavy', 'macro', 'broadside', 'gundeck', 'secondary', 'plasma', 'lance', 'siege', 'ram', 'ion', 'massdriver', 'vls', 'torpedo', 'mine'];
/** The 12 catalogue weapons, as shown on the arsenal sheet. */
export const CATALOGUE = ['heavy', 'secondary', 'broadside', 'plasma', 'lance', 'vls', 'pd', 'ion', 'massdriver', 'torpedo', 'flak', 'mine'];

/** Weapon mounts per ship class (keys match src/data/ships.js). */
export const LOADOUTS = {
  halberd:  { heavy: 8, secondary: 16, broadside: 20, plasma: 2, ion: 4, massdriver: 2, torpedo: 4, mine: 8, vls: 16, flak: 6, pd: 14, lance: 1 },
  rampart:  { heavy: 4, broadside: 12, vls: 8, pd: 8, secondary: 8, massdriver: 2, flak: 4 },
  warden:   { secondary: 3, vls: 2, flak: 2, pd: 2 },
  varr:     { macro: 6, gundeck: 24, siege: 1, torpedo: 6, secondary: 10, ion: 2, vls: 6, flak: 6, pd: 8 },
  kesh:     { macro: 4, gundeck: 16, ram: 1, ion: 2, secondary: 6, pd: 6 },
  ulthane:  { macro: 2, secondary: 10, flak: 8, pd: 8 },
  talon:    { secondary: 3, vls: 2, flak: 2, pd: 2 },
};

for (const [k, w] of Object.entries(WEAPONS)) w.key = k;

export function mountTotal(cls) {
  return Object.values(LOADOUTS[cls] || {}).reduce((a, b) => a + b, 0);
}
