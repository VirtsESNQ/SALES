// Turret geometry per weapon type and faction, drawn with InstancedMesh batches so that
// hundreds of independently traversing turrets cost a few dozen draw calls.
// Turret local frame: base at origin, rests facing +Z, +Y up. Barrels pivot at (0, pivotY, pivotZ).
import * as THREE from 'three';
import { GeoBuilder, boxGeo, cylGeo, sphereGeo, spireGeo, materials, style } from './geo.js';

const HALF_PI = Math.PI / 2;
const CACHE = {};

/** Types with a visible traversing turret. Everything else is a fixed hull fitting. */
export const TURRET_TYPES = new Set(['heavy', 'macro', 'secondary', 'broadside', 'gundeck', 'plasma', 'ion', 'massdriver', 'pd', 'flak']);

function build(type, faction) {
  const heg = faction === 'hegemony';
  const st = style(faction);
  const base = new GeoBuilder(), bar = new GeoBuilder();
  const trim = st.trim, dark = st.dark, metal = st.metal;
  const gold = 0xc9a14f;
  let d = { pivotY: 0, pivotZ: 0, len: 20, xs: [0] };
  const barrel = (x, len, r0, r1, y = 0, z0 = 0) => {
    bar.add(cylGeo(r0, r1, len, 10), 'metal', [x, y, z0 + len / 2], [HALF_PI, 0, 0], [1, 1, 1], metal);
  };
  switch (type) {
    case 'heavy': { // Concord twin turbolaser: low armoured wedge housing
      d = { pivotY: 42, pivotZ: 40, len: 230, xs: [-22, 22] };
      base.add(cylGeo(72, 82, 22, 20), 'plain', [0, 11, 0], [0, 0, 0], [1, 1, 1], dark);
      base.add(boxGeo(140, 52, 150), 'plain', [0, 46, -10], [0, 0, 0], [1, 1, 1], trim);
      base.add(boxGeo(140, 30, 50), 'plain', [0, 40, 76], [-0.55, 0, 0], [1, 1, 1], trim);
      base.add(boxGeo(46, 16, 60), 'plain', [-38, 80, -40], [0, 0, 0], [1, 1, 1], dark);
      base.add(cylGeo(3, 3, 60, 6), 'plain', [40, 100, -50], [0, 0, 0], [1, 1, 1], trim);
      for (const x of d.xs) {
        barrel(x, d.len, 10, 13);
        bar.add(cylGeo(18, 18, 30, 12), 'metal', [x, 0, 16], [HALF_PI, 0, 0], [1, 1, 1], dark);
        bar.add(cylGeo(14, 14, 10, 12), 'metal', [x, 0, d.len - 6], [HALF_PI, 0, 0], [1, 1, 1], dark);
      }
      break;
    }
    case 'macro': { // Hegemony triple cannon: tall gothic housing with crenellations
      d = { pivotY: 50, pivotZ: 46, len: 210, xs: [-30, 0, 30] };
      base.add(cylGeo(76, 88, 26, 8), 'plain', [0, 13, 0], [0, Math.PI / 8, 0], [1, 1, 1], dark);
      base.add(boxGeo(150, 70, 140), 'plain', [0, 58, -8], [0, 0, 0], [1, 1, 1], trim);
      for (let i = -2; i <= 2; i++) base.add(boxGeo(18, 22, 18), 'plain', [i * 30, 104, -60], [0, 0, 0], [1, 1, 1], trim);
      base.add(spireGeo(16, 70), 'plain', [0, 92, -50], [0, 0, 0], [1, 1, 1], dark);
      base.add(sphereGeo(5, 8, 6), 'metal', [0, 165, -50], [0, 0, 0], [1, 1, 1], gold);
      base.add(boxGeo(156, 8, 8), 'metal', [0, 92, 64], [0, 0, 0], [1, 1, 1], gold);
      for (const x of d.xs) { barrel(x, d.len, 9, 12); bar.add(cylGeo(16, 16, 22, 8), 'metal', [x, 0, d.len - 10], [HALF_PI, 0, 0], [1, 1, 1], dark); }
      break;
    }
    case 'secondary': {
      d = { pivotY: 18, pivotZ: 12, len: 86, xs: [-8, 8] };
      base.add(cylGeo(26, 30, 10, 14), 'plain', [0, 5, 0], [0, 0, 0], [1, 1, 1], dark);
      base.add(boxGeo(46, 22, 50), 'plain', [0, 20, 0], [0, 0, 0], [1, 1, 1], heg ? trim : 0xd8dee3);
      if (heg) base.add(spireGeo(8, 26), 'plain', [0, 31, -14], [0, 0, 0], [1, 1, 1], dark);
      for (const x of d.xs) barrel(x, d.len, 3.6, 4.4);
      break;
    }
    case 'broadside': { // Concord casemate gun set into the flank trench
      d = { pivotY: 0, pivotZ: 20, len: 130, xs: [0] };
      base.add(boxGeo(70, 64, 46), 'plain', [0, 0, 0], [0, 0, 0], [1, 1, 1], trim);
      base.add(cylGeo(26, 26, 18, 14), 'plain', [0, 0, 22], [HALF_PI, 0, 0], [1, 1, 1], dark);
      barrel(0, d.len, 10, 13);
      bar.add(cylGeo(15, 15, 14, 12), 'metal', [0, 0, d.len - 8], [HALF_PI, 0, 0], [1, 1, 1], dark);
      break;
    }
    case 'gundeck': { // Hegemony gun-deck port: arched shield plate
      d = { pivotY: 0, pivotZ: 22, len: 120, xs: [0] };
      base.add(boxGeo(66, 70, 44), 'plain', [0, 0, 0], [0, 0, 0], [1, 1, 1], trim);
      base.add(cylGeo(33, 33, 44, 12, false), 'plain', [0, 35, 0], [HALF_PI, 0, 0], [1, 0.5, 1], trim);
      base.add(boxGeo(70, 6, 6), 'metal', [0, -34, 24], [0, 0, 0], [1, 1, 1], gold);
      barrel(0, d.len, 10, 14);
      bar.add(cylGeo(17, 17, 18, 8), 'metal', [0, 0, d.len - 8], [HALF_PI, 0, 0], [1, 1, 1], dark);
      break;
    }
    case 'plasma': {
      d = { pivotY: 52, pivotZ: 20, len: 190, xs: [0] };
      base.add(cylGeo(64, 74, 24, 20), 'plain', [0, 12, 0], [0, 0, 0], [1, 1, 1], dark);
      base.add(sphereGeo(58, 18, 10), 'plain', [0, 36, 0], [0, 0, 0], [1, 0.78, 1], trim);
      barrel(0, d.len, 20, 26);
      for (let i = 0; i < 6; i++) bar.add(cylGeo(32, 32, 9, 14), 'metal', [0, 0, 50 + i * 24], [HALF_PI, 0, 0], [1, 1, 1], dark);
      bar.add(cylGeo(16, 16, 5, 14), 'metal', [0, 0, d.len + 2], [HALF_PI, 0, 0], [1, 1, 1], 0x9dffc4);
      break;
    }
    case 'ion': {
      d = { pivotY: 30, pivotZ: 14, len: 130, xs: [0] };
      base.add(cylGeo(40, 46, 14, 16), 'plain', [0, 7, 0], [0, 0, 0], [1, 1, 1], dark);
      base.add(boxGeo(70, 34, 74), 'plain', [0, 28, -6], [0, 0, 0], [1, 1, 1], trim);
      barrel(0, d.len, 11, 15);
      for (let i = 0; i < 4; i++) bar.add(cylGeo(22, 22, 6, 14), 'metal', [0, 0, 40 + i * 20], [HALF_PI, 0, 0], [1, 1, 1], 0x6fa8ee);
      break;
    }
    case 'massdriver': { // twin-rail railgun, long and narrow
      d = { pivotY: 30, pivotZ: 0, len: 380, xs: [0] };
      base.add(cylGeo(52, 60, 18, 16), 'plain', [0, 9, 0], [0, 0, 0], [1, 1, 1], dark);
      base.add(boxGeo(80, 40, 110), 'plain', [0, 30, -20], [0, 0, 0], [1, 1, 1], trim);
      for (const x of [-11, 11]) bar.add(boxGeo(9, 14, d.len), 'metal', [x, 0, d.len / 2], [0, 0, 0], [1, 1, 1], metal);
      for (let i = 0; i < 7; i++) bar.add(boxGeo(42, 30, 12), 'metal', [0, 0, 40 + i * 48], [0, 0, 0], [1, 1, 1], i % 2 ? dark : 0xa99ad8);
      break;
    }
    case 'pd': {
      d = { pivotY: 12, pivotZ: 0, len: 34, xs: [-3, 3] };
      base.add(sphereGeo(13, 10, 6), 'plain', [0, 4, 0], [0, 0, 0], [1, 0.8, 1], heg ? trim : 0xd8dee3);
      for (const x of d.xs) barrel(x, d.len, 1.6, 1.8);
      break;
    }
    case 'flak': {
      d = { pivotY: 16, pivotZ: 4, len: 44, xs: [-10, -3.5, 3.5, 10] };
      base.add(cylGeo(22, 26, 10, 12), 'plain', [0, 5, 0], [0, 0, 0], [1, 1, 1], dark);
      base.add(boxGeo(40, 20, 34), 'plain', [0, 16, 0], [0, 0, 0], [1, 1, 1], trim);
      for (const x of d.xs) barrel(x, d.len, 2.6, 3);
      break;
    }
    default: return null;
  }
  return { base: base.mergedAll(), barrels: bar.mergedAll(), ...d };
}

export function turretGeometry(type, faction) {
  const key = `${type}:${faction}`;
  if (!(key in CACHE)) CACHE[key] = TURRET_TYPES.has(type) ? build(type, faction) : null;
  return CACHE[key];
}

/** Instanced turret batches. alloc() returns a handle; set() writes matrices each frame. */
export class TurretRenderer {
  constructor(scene) {
    this.scene = scene;
    this.batches = new Map(); // key -> { base, barrels, free:[], used }
    this._hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  _batch(type, faction) {
    const key = `${type}:${faction}`;
    let b = this.batches.get(key);
    if (!b) {
      const geo = turretGeometry(type, faction);
      const m = materials(faction);
      b = { key, geo, cap: 0, used: 0, free: [], base: null, barrels: null, mats: [m.plain, m.metal] };
      this._grow(b, 32);
      this.batches.set(key, b);
    }
    return b;
  }
  _grow(b, cap) {
    const old = [b.base, b.barrels];
    const mk = (geo, mat, prev) => {
      const im = new THREE.InstancedMesh(geo, mat, cap);
      im.frustumCulled = false;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < cap; i++) im.setMatrixAt(i, this._hidden);
      if (prev) { im.instanceMatrix.array.set(prev.instanceMatrix.array.subarray(0, prev.instanceMatrix.array.length)); this.scene.remove(prev); prev.dispose(); }
      this.scene.add(im);
      return im;
    };
    b.base = mk(b.geo.base, b.mats[0], old[0]);
    b.barrels = mk(b.geo.barrels, b.mats[1], old[1]);
    b.cap = cap;
  }
  alloc(type, faction) {
    if (!TURRET_TYPES.has(type)) return null;
    const b = this._batch(type, faction);
    let i = b.free.pop();
    if (i === undefined) {
      if (b.used >= b.cap) this._grow(b, b.cap * 2);
      i = b.used++;
    }
    return { b, i, geo: b.geo };
  }
  set(h, baseMatrix, barrelMatrix) {
    h.b.base.setMatrixAt(h.i, baseMatrix);
    h.b.barrels.setMatrixAt(h.i, barrelMatrix);
  }
  hide(h) { this.set(h, this._hidden, this._hidden); }
  release(h) { this.hide(h); h.b.free.push(h.i); }
  flush() {
    for (const b of this.batches.values()) {
      b.base.instanceMatrix.needsUpdate = true;
      b.barrels.instanceMatrix.needsUpdate = true;
      b.base.count = b.used; b.barrels.count = b.used;
    }
  }
  clear() {
    for (const b of this.batches.values()) { this.scene.remove(b.base, b.barrels); b.base.dispose(); b.barrels.dispose(); }
    this.batches.clear();
  }
}
