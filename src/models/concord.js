// Concord ships: clean angular wedges in grey-blue armour.
// One parametric wedge (flank trench, dorsal ridge, ventral keel, stepped citadel, engine block)
// produces the Halberd, the Rampart and the Warden frigates.
// Local frame: +Z bow, +Y dorsal, +X port, -X starboard. Units: metres.
import * as THREE from 'three';
import { GeoBuilder, V3, boxGeo, cylGeo, sphereGeo, finGeo, loftGeo, style, M, spread } from './geo.js';
import { LOADOUTS } from '../data/arsenal.js';

const DEG = Math.PI / 180;
const HALF_PI = Math.PI / 2;
const lerp = (a, b, t) => a + (b - a) * t;

/** Wedge hull shape functions. */
function wedgeShape(s) {
  const z0 = -s.L / 2, z1 = s.L / 2;
  const t = (z) => Math.min(1, Math.max(0, (z - s.hullStart) / (z1 - s.hullStart)));
  const hw = (z) => lerp(s.beam / 2, s.bowW / 2, t(z));
  const H = (z) => lerp(s.ridgeH, s.bowH, Math.pow(t(z), 0.85));
  const D = (z) => lerp(s.keelD, s.bowH * 0.8, Math.pow(t(z), 0.9));
  const e = s.edge, lip = s.edge * 0.9;
  const topY = (x, z) => {
    const w = hw(z), u = Math.min(1, Math.abs(x) / w), h = H(z);
    if (u <= 0.07) return h;
    if (u <= 0.34) return lerp(h, h * 0.82, (u - 0.07) / 0.27);
    if (u <= 0.93) return lerp(h * 0.82, e + lip, (u - 0.34) / 0.59);
    return lerp(e + lip, e, (u - 0.93) / 0.07);
  };
  const botY = (x, z) => {
    const w = hw(z), u = Math.min(1, Math.abs(x) / w), d = D(z);
    if (u <= 0.1) return -d;
    if (u <= 0.36) return lerp(-d, -d * 0.8, (u - 0.1) / 0.26);
    if (u <= 0.93) return lerp(-d * 0.8, -e - lip, (u - 0.36) / 0.57);
    return lerp(-e - lip, -e, (u - 0.93) / 0.07);
  };
  const section = (z) => {
    const w = hw(z), h = H(z), d = D(z), tr = Math.min(s.trench, w * 0.4), et = e * 0.45;
    return {
      z, pts: [
        [w, e], [w * 0.93, e + lip], [w * 0.34, h * 0.82], [w * 0.07, h], [-w * 0.07, h], [-w * 0.34, h * 0.82], [-w * 0.93, e + lip], [-w, e],
        [-(w - tr), et], [-(w - tr), -et], [-w, -e],
        [-w * 0.93, -e - lip], [-w * 0.36, -d * 0.8], [-w * 0.1, -d], [w * 0.1, -d], [w * 0.36, -d * 0.8], [w * 0.93, -e - lip], [w, -e],
        [w - tr, -et], [w - tr, et],
      ],
    };
  };
  return { z0, z1, hw, H, D, topY, botY, section, t };
}

/** Raked superstructure tier: trapezoid section, forward face raked back. */
function tierGeo(z0, z1, w, yBase, yTop, rake = 0.35) {
  const h = yTop - yBase;
  const sec = (z, ww, hh) => ({ z, pts: [[ww / 2, yBase], [ww / 2 * 0.88, yBase + hh], [-ww / 2 * 0.88, yBase + hh], [-ww / 2, yBase]] });
  const zr = z1 - (z1 - z0) * rake * 0.35;
  return loftGeo([sec(z0, w * 0.9, h * 0.9), sec(z0 + (z1 - z0) * 0.08, w, h), sec(zr, w, h), sec(z1, w * 0.72, h * 0.55)]);
}

/**
 * Build a Concord wedge ship.
 * spec: hull params + citadel tiers + engines + mount placement callbacks.
 */
function buildWedge(spec) {
  const st = style('concord');
  const W = wedgeShape(spec);
  const g = new GeoBuilder(spec.split);
  const tint = { hull: 0xffffff, trim: st.trim, dark: st.dark, metal: st.metal, light: 0xbfe6ff, warm: 0xffe2b0 };

  // --- main hull (split fore/aft) ---
  const stations = [];
  const N = 16;
  for (let i = 0; i <= N; i++) stations.push(lerp(spec.hullStart, W.z1, i / N));
  if (spec.split != null && !stations.includes(spec.split)) { stations.push(spec.split); stations.sort((a, b) => a - b); }
  const aft = stations.filter((z) => spec.split == null || z <= spec.split).map(W.section);
  const fore = stations.filter((z) => spec.split != null && z >= spec.split).map(W.section);
  if (spec.split == null) g.add(loftGeo(aft), 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], null);
  else {
    g.addM(loftGeo(aft, true, true), 'hull', new THREE.Matrix4(), null, spec.split - 1);
    g.addM(loftGeo(fore, true, true), 'hull', new THREE.Matrix4(), null, spec.split + 1);
  }
  // trench floor glow strip (running lights deep in the flank trench)
  for (const sd of [-1, 1]) {
    const za = spec.hullStart + 60, zb = W.z1 - spec.L * 0.12;
    const segs = 8;
    for (let i = 0; i < segs; i++) {
      const zA = lerp(za, zb, i / segs), zB = lerp(za, zb, (i + 1) / segs), zm = (zA + zB) / 2;
      const x = sd * (W.hw(zm) - Math.min(spec.trench, W.hw(zm) * 0.4) + 2);
      const ang = Math.atan2(W.hw(zA) - W.hw(zB), zB - zA) * sd;
      g.add(boxGeo(3, 4, (zB - zA) * 0.94), 'lights', [x, 0, zm], [0, ang, 0], [1, 1, 1], tint.warm);
    }
  }
  // dorsal trenches: two dark grooves following the wedge lines
  for (const sd of [-1, 1]) {
    const f = 0.5, za = spec.hullStart + spec.L * 0.12, zb = W.z1 - spec.L * 0.18;
    const xa = sd * W.hw(za) * f, xb = sd * W.hw(zb) * f, zm = (za + zb) / 2, xm = (xa + xb) / 2;
    const len = Math.hypot(zb - za, xb - xa), yaw = Math.atan2(xb - xa, zb - za);
    g.add(boxGeo(spec.L * 0.008 + 4, 6, len), 'void', [xm, W.topY(xm, zm) - 1, zm], [0, yaw, 0]);
  }
  // transverse armour ribs on the dorsal slopes
  for (let z = spec.hullStart + spec.L * 0.08; z < W.z1 - spec.L * 0.1; z += spec.ribStep) {
    for (const sd of [-1, 1]) {
      const xIn = sd * W.hw(z) * 0.36, xOut = sd * W.hw(z) * 0.9;
      const yIn = W.topY(xIn, z), yOut = W.topY(xOut, z);
      const len = Math.hypot(xOut - xIn, yOut - yIn), roll = Math.atan2(yOut - yIn, xOut - xIn);
      g.add(boxGeo(len, spec.L * 0.002 + 2, spec.L * 0.004 + 3), 'plain', [(xIn + xOut) / 2, (yIn + yOut) / 2 + 2, z], [0, 0, roll], [1, 1, 1], tint.trim);
    }
  }
  // greebles: deterministic scatter of plates, vents and boxes on the dorsal slopes
  let seed = spec.seed || 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < spec.greebles; i++) {
    const z = lerp(spec.hullStart + 80, W.z1 - spec.L * 0.1, rnd());
    const sd = rnd() < 0.5 ? -1 : 1, u = lerp(0.12, 0.88, rnd());
    const x = sd * W.hw(z) * u, y = W.topY(x, z);
    const w = lerp(8, 40, rnd()) * spec.greebleScale, d = lerp(10, 70, rnd()) * spec.greebleScale, h = lerp(3, 14, rnd()) * spec.greebleScale;
    const slope = Math.atan2(W.topY(x + sd * 10, z) - y, sd * 10);
    g.add(boxGeo(w, h, d), rnd() < 0.2 ? 'metal' : 'plain', [x, y + h * 0.3, z], [0, 0, slope], [1, 1, 1], rnd() < 0.5 ? tint.trim : tint.dark);
  }
  // ventral greebles + docking ports with lights
  for (let i = 0; i < spec.greebles * 0.4; i++) {
    const z = lerp(spec.hullStart + 80, W.z1 - spec.L * 0.15, rnd());
    const sd = rnd() < 0.5 ? -1 : 1, u = lerp(0.15, 0.85, rnd());
    const x = sd * W.hw(z) * u, y = W.botY(x, z);
    const w = lerp(10, 50, rnd()) * spec.greebleScale, d = lerp(10, 80, rnd()) * spec.greebleScale;
    g.add(boxGeo(w, 8 * spec.greebleScale, d), 'plain', [x, y - 2, z], [0, 0, 0], [1, 1, 1], tint.dark);
  }
  for (let i = 0; i < spec.docks; i++) {
    const z = lerp(spec.hullStart + spec.L * 0.15, W.z1 - spec.L * 0.3, (i + 0.5) / spec.docks);
    for (const sd of [-1, 1]) {
      const x = sd * W.hw(z) * 0.62, y = W.botY(x, z);
      g.add(boxGeo(24 * spec.greebleScale, 6, 18 * spec.greebleScale), 'void', [x, y - 2, z]);
      g.add(boxGeo(26 * spec.greebleScale, 2, 2), 'lights', [x, y - 4, z + 10 * spec.greebleScale], [0, 0, 0], [1, 1, 1], tint.light);
    }
  }

  // --- citadel tiers ---
  for (const tr of spec.tiers) {
    const yBase = W.H(tr.z1) - 10;
    g.add(tierGeo(tr.z0, tr.z1, tr.w, yBase, tr.top, 0.4), tr.windows === false ? 'plain' : 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], tr.tint ?? 0xf0f3f5);
    // lit window bands on the raked front face
    const zFront = tr.z1 - (tr.z1 - tr.z0) * 0.07;
    for (let k = 0; k < (tr.bands ?? 2); k++) {
      const y = tr.top - (tr.top - yBase) * (0.25 + k * 0.22);
      g.add(boxGeo(tr.w * 0.7, Math.max(2, spec.L * 0.0012), 2), 'lights', [0, y, zFront], [0, 0, 0], [1, 1, 1], k % 2 ? tint.light : tint.warm);
    }
    // deck edge trim
    g.add(boxGeo(tr.w * 0.9, 4, (tr.z1 - tr.z0) * 0.6), 'plain', [0, tr.top + 2, (tr.z0 + tr.z1) / 2 - (tr.z1 - tr.z0) * 0.12], [0, 0, 0], [1, 1, 1], tint.trim);
  }
  // --- command tower & bridge ---
  if (spec.tower) {
    const T = spec.tower;
    g.add(boxGeo(T.neckW, T.y - T.base, T.neckD), 'hull', [0, (T.y + T.base) / 2, T.z], [0, 0, 0], [1, 1, 1], 0xe6eaee);
    // forward-raked blade bridge
    const sec = (z, w, h) => ({ z, pts: [[w / 2, T.y], [w / 2 * 0.8, T.y + h], [-w / 2 * 0.8, T.y + h], [-w / 2, T.y]] });
    g.add(loftGeo([sec(T.z - T.len * 0.5, T.w * 0.85, T.h * 0.8), sec(T.z - T.len * 0.3, T.w, T.h), sec(T.z + T.len * 0.25, T.w * 0.92, T.h), sec(T.z + T.len * 0.5, T.w * 0.5, T.h * 0.45)]), 'plain', [0, 0, 0], [0, 0, 0], [1, 1, 1], 0xf2f5f7);
    g.add(boxGeo(T.w * 0.78, T.h * 0.12, 3), 'lights', [0, T.y + T.h * 0.55, T.z + T.len * 0.38], [-0.5, 0, 0], [1, 1, 1], tint.light);
    g.add(boxGeo(T.w * 0.6, T.h * 0.08, 3), 'lights', [0, T.y + T.h * 0.3, T.z + T.len * 0.44], [-0.5, 0, 0], [1, 1, 1], tint.warm);
    // sensor fins and mast with halo ring
    for (const sd of [-1, 1]) g.add(finGeo(T.len * 0.9, T.finH, 6, 0.05), 'plain', [sd * T.w * 0.36, T.y + T.h, T.z - T.len * 0.2], [0, 0, sd * 0.35], [1, 1, 1], tint.trim);
    g.add(cylGeo(3, 5, T.mast, 6), 'metal', [0, T.y + T.h + T.mast / 2, T.z - T.len * 0.25], [0, 0, 0], [1, 1, 1], tint.metal);
    g.add(new THREE.TorusGeometry(T.mast * 0.32, 3, 6, 28), 'metal', [0, T.y + T.h + T.mast * 0.6, T.z - T.len * 0.25], [HALF_PI, 0, 0], [1, 1, 1], tint.trim);
    g.add(cylGeo(1.5, 1.5, T.mast * 0.5, 4), 'metal', [0, T.y + T.h + T.mast * 0.55, T.z - T.len * 0.25], [0, 0, HALF_PI], [1, 1, 1], tint.metal);
    g.add(sphereGeo(5, 6, 4), 'lights', [0, T.y + T.h + T.mast + 4, T.z - T.len * 0.25], [0, 0, 0], [1, 1, 1], 0xff4a3a);
  }
  // --- engine block and nozzles ---
  const E = spec.engineBlock;
  const ebz = (W.z0 + spec.hullStart) / 2, ebd = spec.hullStart - W.z0 + 20;
  g.add(boxGeo(E.w, E.h, ebd), 'plain', [0, E.y, ebz], [0, 0, 0], [1, 1, 1], tint.trim);
  g.add(boxGeo(E.w * 1.04, E.h * 0.16, ebd * 0.8), 'plain', [0, E.y + E.h * 0.5, ebz], [0, 0, 0], [1, 1, 1], tint.dark);
  g.add(boxGeo(E.w * 0.9, E.h * 0.1, ebd * 1.05), 'plain', [0, E.y - E.h * 0.45, ebz], [0, 0, 0], [1, 1, 1], tint.dark);
  for (const sd of [-1, 1]) g.add(boxGeo(E.w * 0.06, E.h * 1.1, ebd * 1.1), 'plain', [sd * E.w * 0.5, E.y, ebz], [0, 0, 0], [1, 1, 1], tint.dark);
  const engines = [];
  for (const n of spec.nozzles) {
    const [x, y, r] = n, len = r * 0.9;
    g.add(cylGeo(r * 1.08, r * 0.92, len, 24, true), 'metal', [x, y, W.z0 - len / 2 + 4], [HALF_PI, 0, 0], [1, 1, 1], tint.metal);
    g.add(cylGeo(r * 1.16, r * 1.16, len * 0.14, 24), 'plain', [x, y, W.z0 - len * 0.1], [HALF_PI, 0, 0], [1, 1, 1], tint.dark);
    g.add(cylGeo(r * 0.86, r * 0.86, 3, 24), 'lights', [x, y, W.z0 - len * 0.7], [HALF_PI, 0, 0], [1, 1, 1], 0x9fd8ff);
    engines.push({ pos: new V3(x, y, W.z0 - len + 4), r });
  }

  // --- fixed fittings (hangar, lance, tubes, cells, racks) ---
  let hangar = null;
  if (spec.hangar) {
    const Hh = spec.hangar, y = W.botY(0, Hh.z);
    g.add(boxGeo(Hh.w, 24, Hh.d), 'void', [0, y + 6, Hh.z]);
    g.add(boxGeo(Hh.w + 40, 10, 14), 'plain', [0, y - 3, Hh.z + Hh.d / 2 + 7], [0, 0, 0], [1, 1, 1], tint.dark);
    for (const sd of [-1, 1]) g.add(boxGeo(4, 4, Hh.d * 0.95), 'lights', [sd * (Hh.w / 2 - 6), y - 4, Hh.z], [0, 0, 0], [1, 1, 1], tint.warm);
    for (let k = -2; k <= 2; k++) g.add(boxGeo(Hh.w * 0.9, 2, 3), 'lights', [0, y - 3, Hh.z + k * Hh.d * 0.2], [0, 0, 0], [1, 1, 1], tint.light);
    hangar = { pos: new V3(0, y - 10, Hh.z), dir: new V3(0, -0.6, 0.8).normalize(), w: Hh.w, d: Hh.d };
  }
  if (spec.lance) {
    const La = spec.lance;
    const a = new V3(0, -W.D(La.z0) - La.r * 0.6, La.z0), b = new V3(0, -W.D(W.z1) - La.r * 0.2, W.z1 + 10);
    const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b), pitch = Math.atan2(b.y - a.y, b.z - a.z);
    g.add(cylGeo(La.r, La.r * 1.25, len, 16), 'plain', [0, mid.y, mid.z], [HALF_PI - pitch, 0, 0], [1, 1, 1], tint.trim);
    for (let k = 0; k < 9; k++) {
      const p = a.clone().lerp(b, 0.1 + k * 0.09);
      g.add(cylGeo(La.r * 1.5, La.r * 1.5, La.r * 0.35, 16), 'metal', [0, p.y, p.z], [HALF_PI - pitch, 0, 0], [1, 1, 1], k % 3 === 0 ? 0x9fd8ff : tint.dark);
    }
    g.add(sphereGeo(La.r * 0.8, 12, 8), 'lights', [0, b.y, b.z + 4], [0, 0, 0], [1, 1, 1], 0xd6f4ff);
    spec._lanceTip = new V3(0, b.y, b.z + 8);
  }

  // --- weapon mounts ---
  const mounts = spec.mounts(W, spec);
  for (const m of mounts) {
    if (m.type === 'vls') {
      const s = spec.greebleScale;
      g.add(boxGeo(26 * s, 6, 26 * s), 'plain', [m.pos.x, m.pos.y, m.pos.z], [0, 0, 0], [1, 1, 1], tint.dark);
      g.add(boxGeo(20 * s, 2, 2), 'lights', [m.pos.x, m.pos.y + 3, m.pos.z - 10 * s], [0, 0, 0], [1, 1, 1], 0xffb070);
    } else if (m.type === 'torpedo') {
      g.add(boxGeo(30, 30, 60), 'plain', [m.pos.x, m.pos.y, m.pos.z - 30], [0, 0, 0], [1, 1, 1], tint.trim);
      g.add(cylGeo(9, 9, 4, 12), 'void', [m.pos.x, m.pos.y, m.pos.z + 1], [HALF_PI, 0, 0]);
    } else if (m.type === 'mine') {
      g.add(boxGeo(40, 24, 50), 'plain', [m.pos.x, m.pos.y, m.pos.z + 25], [0, 0, 0], [1, 1, 1], tint.dark);
      g.add(boxGeo(28, 14, 4), 'lights', [m.pos.x, m.pos.y, m.pos.z - 1], [0, 0, 0], [1, 1, 1], 0xa98cff);
    } else if (m.type === 'broadside') {
      g.add(boxGeo(90, 80, 70), 'void', [m.pos.x - Math.sign(m.pos.x) * 30, m.pos.y, m.pos.z]);
    }
  }
  if (spec.extra) spec.extra(g, W, tint);

  // --- subsystem anchors, hit boxes, shield ---
  const hitBoxes = [];
  for (let z = spec.hullStart; z < W.z1; z += spec.L / 10) {
    const zm = z + spec.L / 20, hw = W.hw(z);
    hitBoxes.push([new V3(-hw, -W.D(z), z), new V3(hw, W.H(z), Math.min(W.z1, z + spec.L / 10))]);
  }
  hitBoxes.push([new V3(-E.w / 2, E.y - E.h / 2, W.z0 - 40), new V3(E.w / 2, E.y + E.h / 2, spec.hullStart)]);
  for (const tr of spec.tiers) hitBoxes.push([new V3(-tr.w / 2, W.H(tr.z1) - 10, tr.z0), new V3(tr.w / 2, tr.top, tr.z1)]);
  if (spec.tower) { const T = spec.tower; hitBoxes.push([new V3(-T.w / 2, T.base, T.z - T.len / 2), new V3(T.w / 2, T.y + T.h, T.z + T.len / 2)]); }
  const topMax = Math.max(spec.ridgeH, ...spec.tiers.map((t) => t.top), spec.tower ? spec.tower.y + spec.tower.h : 0);
  return {
    faction: 'concord', builder: g, mounts, engines, hangar, split: spec.split, length: spec.L,
    bridge: spec.tower ? new V3(0, spec.tower.y + spec.tower.h * 0.55, spec.tower.z + spec.tower.len * 0.3) : new V3(0, spec.ridgeH, 0),
    subsystems: spec.subsystems(W, spec), hitBoxes,
    radius: Math.hypot(spec.L / 2, spec.beam / 2, topMax),
    shield: { center: new V3(0, (topMax - spec.keelD) * 0.35, 0), radii: new V3(spec.beam * 0.62, (topMax + spec.keelD) * 0.75, spec.L * 0.56) },
    lanceTip: spec._lanceTip || null,
    dims: { beam: spec.beam, top: topMax, keel: spec.keelD },
  };
}

/* ================= CSV HALBERD ================= */
export function buildHalberd() {
  const L = 3020;
  const lo = LOADOUTS.halberd;
  const spec = {
    L, beam: 1370, bowW: 14, bowH: 10, ridgeH: 240, keelD: 230, edge: 30, trench: 46, hullStart: -L / 2 + 120,
    split: -260, ribStep: 120, greebles: 420, greebleScale: 1.6, docks: 6, seed: 101,
    tiers: [
      { z0: -1420, z1: -380, w: 760, top: 320 },
      { z0: -1410, z1: -620, w: 540, top: 400 },
      { z0: -1400, z1: -900, w: 370, top: 470, bands: 3 },
      { z0: -1390, z1: -1090, w: 230, top: 530, bands: 2, windows: false },
    ],
    tower: { z: -1210, base: 520, y: 650, neckW: 70, neckD: 110, w: 300, h: 56, len: 210, finH: 70, mast: 190 },
    engineBlock: { w: 1180, h: 400, y: 30 },
    nozzles: [[0, 50, 150], [-330, 90, 128], [330, 90, 128], [-330, -95, 108], [330, -95, 108], [-560, 10, 62], [560, 10, 62], [-150, -150, 56], [150, -150, 56]],
    hangar: { z: -560, w: 420, d: 420 },
    lance: { z0: 200, r: 34 },
    mounts: (W) => {
      const m = [];
      // heavy turbolasers ×8: two superfiring on the forward ridge, three pairs on the slopes
      const hz = [[0, 920], [0, 680]];
      for (const [x, z] of hz) m.push(M('heavy', x, W.topY(x, z) + (z === 680 ? 26 : 0), z, { yawLim: [-150 * DEG, 150 * DEG] }));
      for (const z of [380, 80, -220]) for (const sd of [-1, 1]) { const x = sd * W.hw(z) * 0.34; m.push(M('heavy', x, W.topY(x, z), z)); }
      // secondary ×16: rows along the outer slopes
      for (const z of spread(-1150, 760, lo.secondary / 2)) for (const sd of [-1, 1]) { const x = sd * W.hw(z) * 0.7; m.push(M('secondary', x, W.topY(x, z), z, { face: sd * HALF_PI, pitchLim: [-30 * DEG, 85 * DEG] })); }
      // broadside ×20 in the flank trench, 10 per side
      for (const z of spread(-1250, 520, lo.broadside / 2)) for (const sd of [-1, 1]) {
        const x = sd * (W.hw(z) - 36);
        m.push(M('broadside', x, 0, z, { face: sd * HALF_PI, side: sd > 0 ? 'port' : 'stbd', yawLim: [-40 * DEG, 40 * DEG], pitchLim: [-30 * DEG, 30 * DEG] }));
      }
      // plasma ×2 on the second tier
      for (const sd of [-1, 1]) m.push(M('plasma', sd * 180, 400, -700, { yawLim: [-150 * DEG, 150 * DEG] }));
      // ion ×4 on the first tier
      for (const [x, z] of [[300, -830], [260, -500]]) for (const sd of [-1, 1]) m.push(M('ion', sd * x, 320, z));
      // mass drivers ×2 flanking the bow ridge, limited traverse
      for (const sd of [-1, 1]) { const z = 1080, x = sd * W.hw(z) * 0.45; m.push(M('massdriver', x, W.topY(x, z), z, { yawLim: [-30 * DEG, 30 * DEG], pitchLim: [-5 * DEG, 25 * DEG] })); }
      // torpedo tubes ×4 near the bow, fixed
      for (const sd of [-1, 1]) for (const y of [14, -14]) { const z = 1180; m.push(M('torpedo', sd * W.hw(z) * 0.55, y > 0 ? W.topY(W.hw(z) * 0.55, z) * 0.5 : W.botY(W.hw(z) * 0.55, z) * 0.5, z, { fixed: true })); }
      // gravity mine racks ×8 under the engine block, facing aft
      for (const x of [-480, -170, 170, 480]) for (const y of [-190, -130]) m.push(M('mine', x, y, W.z0 + 20, { fixed: true, face: Math.PI }));
      // VLS ×16 on the first tier, outboard of tier two
      for (const z of spread(-1340, -940, lo.vls / 2)) for (const sd of [-1, 1]) m.push(M('vls', sd * 330, 322, z, { fixed: true }));
      // flak ×6
      for (const p of [[340, 322, -440], [240, 402, -1300]]) for (const sd of [-1, 1]) m.push(M('flak', sd * p[0], p[1], p[2]));
      for (const sd of [-1, 1]) { const z = -100, x = sd * W.hw(z) * 0.3; m.push(M('flak', x, W.botY(x, z), z, { flip: true })); }
      // point defence ×14
      for (const z of [-980, -420, 220, 760]) for (const sd of [-1, 1]) {
        const x = sd * W.hw(z) * 0.86; m.push(M('pd', x, W.topY(x, z), z));
      }
      for (const sd of [-1, 1]) m.push(M('pd', sd * 150, 470, -1000));
      for (const z of [-900, 100]) for (const sd of [-1, 1]) { const x = sd * W.hw(z) * 0.45; m.push(M('pd', x, W.botY(x, z), z, { flip: true })); }
      // spinal lance ×1
      m.push(M('lance', 0, -W.D(W.z1) - 10, W.z1 + 10, { fixed: true, yawLim: [-4 * DEG, 4 * DEG] }));
      return m;
    },
    subsystems: (W) => ({
      engines: new V3(0, 30, W.z0 + 70), shieldgen: new V3(0, 420, -1000), sensors: new V3(0, 720, -1240),
      reactor: new V3(0, 40, -820), hangar: new V3(0, W.botY(0, -560), -560), bridge: new V3(0, 680, -1180),
    }),
  };
  return buildWedge(spec);
}

/* ================= CSV RAMPART (Bastion-class) ================= */
export function buildRampart() {
  const L = 1580, lo = LOADOUTS.rampart;
  const spec = {
    L, beam: 720, bowW: 10, bowH: 8, ridgeH: 150, keelD: 140, edge: 22, trench: 32, hullStart: -L / 2 + 80,
    split: -120, ribStep: 90, greebles: 200, greebleScale: 1.1, docks: 3, seed: 202,
    tiers: [
      { z0: -735, z1: -150, w: 400, top: 200 },
      { z0: -730, z1: -420, w: 300, top: 250, bands: 3 },
    ],
    tower: { z: -600, base: 250, y: 320, neckW: 46, neckD: 70, w: 200, h: 40, len: 140, finH: 90, mast: 120 },
    engineBlock: { w: 640, h: 300, y: 10 },
    nozzles: [[-150, 30, 104], [150, 30, 104], [-150, -80, 70], [150, -80, 70], [0, -30, 60]],
    extra: (g, W, t) => {
      // twin battlement blocks flanking the tower
      for (const sd of [-1, 1]) g.add(boxGeo(70, 70, 150), 'plain', [sd * 110, 285, -620], [0, 0, 0], [1, 1, 1], t.trim);
    },
    mounts: (W) => {
      const m = [];
      for (const [x, z, lift] of [[0, 430, 0], [0, 270, 18]]) m.push(M('heavy', x, W.topY(x, z) + lift, z));
      for (const sd of [-1, 1]) { const z = 20, x = sd * W.hw(z) * 0.34; m.push(M('heavy', x, W.topY(x, z), z)); }
      for (const z of spread(-640, 300, lo.broadside / 2)) for (const sd of [-1, 1]) m.push(M('broadside', sd * (W.hw(z) - 26), 0, z, { face: sd * HALF_PI, side: sd > 0 ? 'port' : 'stbd', yawLim: [-40 * DEG, 40 * DEG], pitchLim: [-30 * DEG, 30 * DEG] }));
      for (const z of spread(-560, 380, lo.secondary / 2)) for (const sd of [-1, 1]) { const x = sd * W.hw(z) * 0.7; m.push(M('secondary', x, W.topY(x, z), z, { face: sd * HALF_PI })); }
      for (const z of spread(-700, -500, lo.vls / 2)) for (const sd of [-1, 1]) m.push(M('vls', sd * 175, 202, z, { fixed: true }));
      for (const sd of [-1, 1]) { const z = 560, x = sd * W.hw(z) * 0.45; m.push(M('massdriver', x, W.topY(x, z), z, { yawLim: [-30 * DEG, 30 * DEG], pitchLim: [-5 * DEG, 25 * DEG] })); }
      for (const p of [[170, 202, -250], [120, 252, -700]]) for (const sd of [-1, 1]) m.push(M('flak', sd * p[0], p[1], p[2]));
      for (const z of [-500, -50, 350]) for (const sd of [-1, 1]) { const x = sd * W.hw(z) * 0.86; m.push(M('pd', x, W.topY(x, z), z)); }
      for (const sd of [-1, 1]) { const z = -300, x = sd * W.hw(z) * 0.4; m.push(M('pd', x, W.botY(x, z), z, { flip: true })); }
      return m;
    },
    subsystems: (W) => ({ engines: new V3(0, 10, W.z0 + 50), shieldgen: new V3(0, 230, -560), sensors: new V3(0, 380, -620), reactor: new V3(0, 30, -420), bridge: new V3(0, 340, -580) }),
  };
  return buildWedge(spec);
}

/* ================= Warden-class frigate ================= */
export function buildWarden() {
  const L = 430;
  const spec = {
    L, beam: 150, bowW: 4, bowH: 4, ridgeH: 38, keelD: 30, edge: 7, trench: 8, hullStart: -L / 2 + 30,
    split: null, ribStep: 40, greebles: 60, greebleScale: 0.35, docks: 1, seed: 303,
    tiers: [{ z0: -190, z1: -40, w: 74, top: 74, bands: 2 }],
    tower: { z: -150, base: 70, y: 90, neckW: 14, neckD: 22, w: 54, h: 12, len: 44, finH: 22, mast: 50 },
    engineBlock: { w: 130, h: 70, y: 4 },
    nozzles: [[0, 8, 30], [-44, 4, 16], [44, 4, 16]],
    mounts: (W) => {
      const m = [];
      m.push(M('secondary', 0, W.topY(0, 60), 60));
      for (const sd of [-1, 1]) m.push(M('secondary', sd * 34, 76, -100, { face: sd * HALF_PI }));
      for (const sd of [-1, 1]) m.push(M('vls', sd * 22, W.topY(22, 0), 0, { fixed: true }));
      for (const sd of [-1, 1]) m.push(M('flak', sd * 26, 76, -170));
      for (const sd of [-1, 1]) { const z = -20, x = sd * W.hw(z) * 0.4; m.push(M('pd', x, W.botY(x, z), z, { flip: true })); }
      return m;
    },
    subsystems: (W) => ({ engines: new V3(0, 4, W.z0 + 20), shieldgen: new V3(0, 60, -110), reactor: new V3(0, 10, -60) }),
  };
  return buildWedge(spec);
}
