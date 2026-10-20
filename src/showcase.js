// Model showcase (?showcase=halberd | varr | ... | viper | lineup): turntable view of one model in
// the real environment, used for design review and screenshot tests.
import * as THREE from 'three';
import { instantiateShip, getDesign, TurretRenderer, turretGeometry, turretMatrices, craftGeometry, CRAFT_KEYS, SHIP_MODELS, materials } from './models.js';
import { CRAFT } from './data/ships.js';
import { QUERY } from './core.js';

export function startShowcase(engine, env, name) {
  const { scene, camera } = engine;
  const turrets = new TurretRenderer(scene);
  const ships = [];
  const place = (cls, pos, yaw = 0) => {
    const s = instantiateShip(cls);
    s.root.position.copy(pos); s.root.rotation.y = yaw;
    scene.add(s.root);
    s.root.updateMatrixWorld(true);
    const hs = s.design.mounts.map((m) => ({ m, h: turretGeometry(m.type, s.design.faction) ? turrets.alloc(m.type, s.design.faction) : null }));
    ships.push({ s, hs });
    return s;
  };
  const craftMeshes = [];
  const placeCraft = (key, positions, yaw = 0) => {
    const geo = craftGeometry(key), fac = CRAFT[key].faction, m = materials(fac);
    const hull = new THREE.InstancedMesh(geo.hull, m.plain, positions.length);
    const glow = geo.glow ? new THREE.InstancedMesh(geo.glow, m.lights, positions.length) : null;
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), one = new THREE.Vector3(1, 1, 1);
    positions.forEach((p, i) => { mat.compose(p, q, one); hull.setMatrixAt(i, mat); glow?.setMatrixAt(i, mat); });
    scene.add(hull); if (glow) scene.add(glow);
    craftMeshes.push(hull);
  };

  let radius = 1000, target = new THREE.Vector3(), elev = 0.28, startAz = Number(QUERY.get('az') ?? 0.7);
  if (SHIP_MODELS.includes(name)) {
    const s = place(name, new THREE.Vector3());
    radius = s.design.radius;
    target.set(0, s.design.dims.top * 0.25, 0);
  } else if (CRAFT_KEYS.includes(name)) {
    const L = CRAFT[name].length;
    placeCraft(name, [new THREE.Vector3(0, 0, 0), new THREE.Vector3(-L * 1.4, -L * 0.3, -L * 1.6), new THREE.Vector3(L * 1.4, L * 0.25, -L * 1.8)]);
    radius = L * 1.4;
  } else { // lineup: the whole order of battle to scale
    place('halberd', new THREE.Vector3(0, 0, 0));
    place('rampart', new THREE.Vector3(1800, 150, -600));
    place('warden', new THREE.Vector3(-1100, 250, 900));
    place('warden', new THREE.Vector3(1300, -200, 1300));
    place('varr', new THREE.Vector3(-900, 300, 5200), Math.PI);
    place('kesh', new THREE.Vector3(1600, 200, 4600), Math.PI);
    place('ulthane', new THREE.Vector3(3400, 0, 5600), Math.PI);
    place('talon', new THREE.Vector3(600, 500, 3600), Math.PI);
    placeCraft('viper', [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(-300 + (i % 4) * 30, -320 - Math.floor(i / 4) * 25, 1700 + i * 12)));
    placeCraft('scythe', [0, 1, 2, 3, 4].map((i) => new THREE.Vector3(500 + i * 40, 420, 3000 - i * 20)), Math.PI);
    radius = 3600; target.set(800, 0, 2400); elev = 0.22;
  }
  const dist = Number(QUERY.get('dist') ?? 1) * radius * 1.9;
  let az = startAz;
  const _b = new THREE.Matrix4(), _p = new THREE.Matrix4();
  return {
    update(dt) {
      az += dt * 0.04;
      camera.position.set(target.x + Math.sin(az) * dist * Math.cos(elev), target.y + Math.sin(elev) * dist, target.z + Math.cos(az) * dist * Math.cos(elev));
      camera.lookAt(target);
      env.update(dt, camera);
      for (const { s, hs } of ships) {
        s.engineFx.set(0.5);
        for (const { m, h } of hs) {
          if (!h) continue;
          turretMatrices(s.root.matrixWorld, m, h.geo, 0, 0.05, _b, _p);
          turrets.set(h, _b, _p);
        }
      }
      turrets.flush();
    },
    info: () => ({ ships: ships.map(({ s }) => ({ cls: s.design.cls, mounts: s.design.mounts.length })), craft: craftMeshes.length }),
  };
}
