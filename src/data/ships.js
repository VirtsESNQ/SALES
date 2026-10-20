// Ship and small-craft blueprints. Sizes, crews, shields, hull and speeds follow
// the design sheets (design/*.html). Handling values are ported from v1 and retuned for v2 scale.
//
// length/beam/height in metres. Ship-local axes: +Z bow, +Y dorsal, +X port, -X starboard.
// shield: per sector (fore/aft/port/stbd) · regen: shield points per second per sector
// maxSpeed m/s · accel m/s² · yawRate/pitchRate/rollRate deg/s max · yawAcc deg/s² · vert m/s lateral thrust
// armour: hull damage multiplier by facing (lower = thicker). Bow plating is thickest.
// subsystems: hp and position along the hull (z as a fraction of length, -0.5 stern .. +0.5 bow)
import { LOADOUTS, mountTotal } from './arsenal.js';

const SUB = (hp, z, y = 0.1) => ({ hp, z, y });

export const CLASSES = {
  halberd: {
    faction: 'concord', label: 'DREADNOUGHT', cname: 'Dominion-class Dreadnought', model: 'halberd',
    length: 3020, beam: 1370, height: 520, crew: 41000,
    hull: 36000, shield: 7500, regen: 140, maxSpeed: 140, boostSpeed: 203,
    accel: 3.2, yawRate: 3.6, yawAcc: 0.9, pitchRate: 2.6, rollRate: 4, vert: 40,
    armour: { fore: 0.55, aft: 1.15, port: 0.85, stbd: 0.85 },
    hangar: { squadrons: 6, craft: 35 }, missileMagazine: 64,
    subsystems: {
      engines: SUB(5200, -0.47), shieldgen: SUB(4200, -0.1, 0.4), sensors: SUB(2600, -0.22, 0.6),
      reactor: SUB(6000, -0.25), hangar: SUB(3600, 0.05, -0.3), bridge: SUB(3000, -0.32, 0.7),
    },
    threat: 5,
  },
  rampart: {
    faction: 'concord', label: 'BATTLECRUISER', cname: 'Bastion-class Battlecruiser', model: 'rampart',
    length: 1580, beam: 720, height: 300, crew: 12000,
    hull: 12500, shield: 3200, regen: 70, maxSpeed: 170, accel: 5, yawRate: 6, yawAcc: 1.8, pitchRate: 4, rollRate: 7, vert: 55,
    armour: { fore: 0.65, aft: 1.15, port: 0.9, stbd: 0.9 },
    subsystems: { engines: SUB(2200, -0.47), shieldgen: SUB(1800, -0.1, 0.4), sensors: SUB(1200, -0.2, 0.6), reactor: SUB(2600, -0.25) },
    threat: 3,
  },
  warden: {
    faction: 'concord', label: 'FRIGATE', cname: 'Warden-class Frigate', model: 'warden',
    length: 430, beam: 150, height: 120, crew: 900,
    hull: 2600, shield: 900, regen: 35, maxSpeed: 250, accel: 14, yawRate: 15, yawAcc: 7, pitchRate: 10, rollRate: 16, vert: 90,
    armour: { fore: 0.85, aft: 1.1, port: 1, stbd: 1 },
    subsystems: { engines: SUB(700, -0.45), shieldgen: SUB(500, 0), reactor: SUB(800, -0.2) },
    threat: 1,
  },
  varr: {
    faction: 'hegemony', label: 'SIEGE DREADNOUGHT', cname: 'Varr-class Siege Dreadnought', model: 'varr',
    length: 2480, beam: 640, height: 1310, crew: 88000,
    hull: 34000, shield: 5600, regen: 100, maxSpeed: 115, accel: 3, yawRate: 3.4, yawAcc: 0.8, pitchRate: 2.4, rollRate: 3, vert: 35,
    // "Its stern castle is the weak spot: the engines sit under thin armour."
    armour: { fore: 0.45, aft: 1.45, port: 0.8, stbd: 0.8 },
    subsystems: {
      engines: SUB(4200, -0.48), shieldgen: SUB(3600, 0, 0.5), sensors: SUB(2200, -0.3, 0.9),
      reactor: SUB(5600, -0.2), siege: SUB(3000, 0.45, 0),
    },
    threat: 5,
  },
  kesh: {
    faction: 'hegemony', label: 'HEAVY CRUISER', cname: 'Kesh-class Heavy Cruiser', model: 'kesh',
    length: 1250, beam: 330, height: 420, crew: 9000,
    hull: 9000, shield: 2500, regen: 55, maxSpeed: 175, accel: 5.5, yawRate: 6.5, yawAcc: 2.0, pitchRate: 4, rollRate: 7, vert: 55,
    armour: { fore: 0.6, aft: 1.2, port: 0.9, stbd: 0.9 },
    subsystems: { engines: SUB(1800, -0.47), shieldgen: SUB(1400, 0, 0.4), sensors: SUB(900, -0.15, 0.7), reactor: SUB(2200, -0.2) },
    threat: 3,
  },
  ulthane: {
    faction: 'hegemony', label: 'FLEET CARRIER', cname: 'Ulthane-class Fleet Carrier', model: 'ulthane',
    length: 1620, beam: 1100, height: 760, crew: 31000,
    hull: 19000, shield: 3800, regen: 70, maxSpeed: 120, accel: 3, yawRate: 4, yawAcc: 1.1, pitchRate: 3, rollRate: 4, vert: 40,
    armour: { fore: 0.8, aft: 1.1, port: 0.95, stbd: 0.95 },
    hangar: { squadrons: 6, craft: 36 },
    subsystems: { engines: SUB(3000, -0.47), shieldgen: SUB(2400, 0, 0.5), sensors: SUB(1400, -0.1, 0.8), reactor: SUB(3600, -0.2), hangar: SUB(3200, 0.1, 0) },
    threat: 4,
  },
  talon: {
    faction: 'hegemony', label: 'ESCORT', cname: 'Talon-class Escort', model: 'talon',
    length: 430, beam: 130, height: 140, crew: 700,
    hull: 2000, shield: 750, regen: 30, maxSpeed: 270, accel: 15, yawRate: 16, yawAcc: 7, pitchRate: 10, rollRate: 16, vert: 90,
    armour: { fore: 0.85, aft: 1.1, port: 1, stbd: 1 },
    subsystems: { engines: SUB(600, -0.45), shieldgen: SUB(450, 0), reactor: SUB(700, -0.2) },
    threat: 1,
  },
};
for (const [key, c] of Object.entries(CLASSES)) {
  c.key = key;
  c.loadout = LOADOUTS[key];
  c.mounts = mountTotal(key);
}

/** Small craft. role decides AI behaviour; weapons reference src/data/arsenal.js. */
export const CRAFT = {
  viper:  { faction: 'concord', role: 'interceptor', name: 'Viper',  label: 'Interceptor',   length: 14, speed: 280, wing: 8, hp: 90,  turn: 2.6, weapons: { flaser: 2 }, desc: 'Fast dogfighter. Hunts enemy fighters and bombers before they reach the fleet.', arms: 'Twin lasers ×2' },
  falcon: { faction: 'concord', role: 'strike',      name: 'Falcon', label: 'Strike fighter', length: 19, speed: 235, wing: 6, hp: 140,  turn: 2.0, weapons: { flaser: 2, rocket: 8 }, desc: 'Strafes capital ships with rocket pods aimed at engines and turrets.', arms: 'Lasers ×2 · rockets ×8' },
  hammer: { faction: 'concord', role: 'bomber',      name: 'Hammer', label: 'Bomber',         length: 24, speed: 185, wing: 5, hp: 260, turn: 1.3, weapons: { ftorp: 2, flaser: 1 }, desc: 'Slow and armoured. Flies a torpedo run, then returns to rearm.', arms: 'Torpedoes ×2 · tail gun ×1' },
  wardengs: { faction: 'concord', role: 'gunboat',     name: 'Warden', label: 'Gunship',        length: 36, speed: 150, wing: 3, hp: 320, turn: 1.0, weapons: { fflak: 2, flaser: 1 }, desc: 'Flying flak tower. Escorts the wing and shoots in every direction.', arms: 'Flak turrets ×2 · cannon ×1' },
  razor:  { faction: 'hegemony', role: 'interceptor', name: 'Razor', label: 'Interceptor',   length: 15, speed: 285, wing: 8, hp: 85,  turn: 2.7, weapons: { flaser: 2 }, desc: 'Hook-winged hunter, fragile but quick.', arms: 'Las-cannons ×2' },
  wasp:   { faction: 'hegemony', role: 'strike',      name: 'Wasp',  label: 'Strike fighter', length: 20, speed: 230, wing: 6, hp: 135,  turn: 2.0, weapons: { flaser: 2, rocket: 8 }, desc: 'Dives at turrets with bunches of seeker rockets.', arms: 'Las-cannons ×2 · rockets ×8' },
  scythe: { faction: 'hegemony', role: 'bomber',      name: 'Scythe', label: 'Bomber',        length: 26, speed: 180, wing: 5, hp: 270, turn: 1.25, weapons: { ftorp: 2, fflak: 1 }, desc: 'Heavy hull with a torpedo bay along the spine.', arms: 'Torpedoes ×2 · flak ×1' },
  maul:   { faction: 'hegemony', role: 'gunboat',     name: 'Maul',  label: 'Gunship',        length: 38, speed: 145, wing: 3, hp: 340, turn: 0.95, weapons: { fflak: 3, flaser: 1 }, desc: 'A small cathedral with engines. Soaks damage for the bombers.', arms: 'Flak turrets ×3 · macro gun ×1' },
};

/** Halberd hangar: 6 squadrons · 35 craft (8+8+6+5+5+3). Reserve refills losses. */
export const HALBERD_WING = [
  { name: 'Viper 1', type: 'viper' }, { name: 'Viper 2', type: 'viper' },
  { name: 'Falcon', type: 'falcon' },
  { name: 'Hammer 1', type: 'hammer' }, { name: 'Hammer 2', type: 'hammer' },
  { name: 'Warden', type: 'wardengs' },
];
export const HALBERD_RESERVE = 12;
/** Ulthane hangar: 6 squadrons · 36 craft. */
export const ULTHANE_WING = [
  { name: 'Razor 1', type: 'razor' }, { name: 'Razor 2', type: 'razor' },
  { name: 'Wasp', type: 'wasp' }, { name: 'Scythe 1', type: 'scythe' },
  { name: 'Scythe 2', type: 'scythe' }, { name: 'Maul', type: 'maul' },
];
