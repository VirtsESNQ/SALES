// Operation Black Tide: fleet layout, objectives and script (script/objectives arrive in M6).
// Either side is playable. The player commands one hull of the chosen side; the rest are AI.
import * as THREE from 'three';

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
