// Small craft: 4 classes per faction, real size in metres (14–38 m).
// Each craft is one merged geometry with vertex colours (hull) plus one for engine glow,
// so a whole class renders as two InstancedMeshes.
// Concord = angular grey-blue wedges. Hegemony = dark hulls, hooked wings, gold edges.
import * as THREE from 'three';
import { GeoBuilder, boxGeo, cylGeo, spireGeo, loftGeo } from './geo.js';

const HALF_PI = Math.PI / 2;
const C = { hull: 0xb9c3c8, dark: 0x4d575e, accent: 0x7f8b93, canopy: 0x2a4a66 };
const H = { hull: 0x4a423d, dark: 0x231c19, gold: 0xc9a45a, canopy: 0x5a2a14 };

/** Diamond fuselage loft from tail (z=-len/2) to nose (z=+len/2). */
function fuselage(len, w, h, noseW = 0.06, tailW = 0.7) {
  const sec = (z, ww, hh) => ({ z, pts: [[ww / 2, 0], [0, hh / 2], [-ww / 2, 0], [0, -hh / 2]] });
  return loftGeo([sec(-len / 2, w * tailW, h * tailW), sec(-len * 0.2, w, h), sec(len * 0.15, w * 0.8, h * 0.85), sec(len / 2, w * noseW, h * noseW)]);
}
/** Flat swept wing plate: root at x=0, tip at x=span, sweep = z offset of tip. */
function wing(g, side, span, chord, sweep, z, y, thick, tint, dihedral = 0) {
  // Outline in the XY plane (Y = chord, forward). Mirror by negating X and reversing the
  // winding, so both wings keep outward-facing normals.
  let pts = [[0, -chord / 2], [span, -chord * 0.25 - sweep], [span, chord * 0.15 - sweep], [0, chord / 2]];
  if (side < 0) pts = pts.map(([x, yy]) => [-x, yy]).reverse();
  const s = new THREE.Shape(pts.map(([x, yy]) => new THREE.Vector2(x, yy)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  geo.translate(0, 0, -thick / 2);
  geo.rotateX(HALF_PI); // shape +Y (chord) -> world +Z, thickness -> Y
  g.add(geo, 'hull', [0, y, z], [0, 0, side * dihedral], [1, 1, 1], tint);
}
function engine(g, x, y, z, r) {
  g.add(cylGeo(r, r * 0.8, r * 1.2, 8), 'hull', [x, y, z], [HALF_PI, 0, 0], [1, 1, 1], 0x2a2f33);
  g.add(cylGeo(r * 0.75, r * 0.75, r * 0.3, 8), 'glow', [x, y, z - r * 0.6], [HALF_PI, 0, 0], [1, 1, 1], 0xffffff);
}

const BUILDERS = {
  viper(g) { // 14 m interceptor
    g.add(fuselage(14, 2.2, 1.8), 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], C.hull);
    g.add(boxGeo(0.9, 0.6, 2.6), 'hull', [0, 0.85, 2.2], [0, 0, 0], [1, 1, 1], C.canopy);
    for (const sd of [-1, 1]) { wing(g, sd, 4.6, 4.2, 2.4, -1.5, 0, 0.25, C.hull); g.add(boxGeo(0.3, 0.3, 4), 'hull', [sd * 4.4, 0, -1.6], [0, 0, 0], [1, 1, 1], C.dark); }
    engine(g, 0, 0, -7, 0.9);
  },
  falcon(g) { // 19 m strike fighter, canard + rocket pods
    g.add(fuselage(19, 3, 2.4), 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], C.hull);
    g.add(boxGeo(1.1, 0.7, 3), 'hull', [0, 1.1, 3.5], [0, 0, 0], [1, 1, 1], C.canopy);
    for (const sd of [-1, 1]) {
      wing(g, sd, 6, 5.5, 3.2, -2, 0, 0.3, C.hull);
      wing(g, sd, 2.6, 2.2, 1.2, 5, 0, 0.2, C.accent);
      g.add(boxGeo(1, 1, 3.4), 'hull', [sd * 3.6, -0.6, -1.6], [0, 0, 0], [1, 1, 1], C.dark);
    }
    engine(g, -0.9, 0, -9.5, 0.9); engine(g, 0.9, 0, -9.5, 0.9);
  },
  hammer(g) { // 24 m bomber, armoured, torpedo bay
    g.add(fuselage(24, 5, 3.6, 0.25, 0.85), 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], C.hull);
    g.add(boxGeo(1.4, 0.9, 3.2), 'hull', [0, 1.6, 5.5], [0, 0, 0], [1, 1, 1], C.canopy);
    g.add(boxGeo(2, 1, 9), 'hull', [0, -1.7, 0], [0, 0, 0], [1, 1, 1], C.dark);
    for (const sd of [-1, 1]) { wing(g, sd, 7.5, 7, 4.5, -2.5, 0, 0.45, C.hull, 0.05); g.add(boxGeo(0.5, 2.4, 3), 'hull', [sd * 7.2, 0.8, -6], [0, 0, 0], [1, 1, 1], C.accent); }
    engine(g, -1.4, 0, -12, 1.2); engine(g, 1.4, 0, -12, 1.2);
  },
  wardengs(g) { // 36 m gunship: flying flak tower
    g.add(fuselage(36, 9, 6, 0.4, 0.9), 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], C.hull);
    for (const sd of [-1, 1]) {
      g.add(boxGeo(3.5, 2.6, 12), 'hull', [sd * 5.2, 0, -2], [0, 0, 0], [1, 1, 1], C.accent);
      g.add(cylGeo(1.6, 1.8, 1.2, 10), 'hull', [sd * 2, 3.2, 1 + sd * 4], [0, 0, 0], [1, 1, 1], C.dark);
      g.add(boxGeo(0.3, 0.3, 3), 'hull', [sd * 2 - 0.4, 3.8, 2.4 + sd * 4], [0, 0, 0], [1, 1, 1], C.dark);
    }
    g.add(boxGeo(2, 1.2, 4), 'hull', [0, 2.8, 9], [0, 0, 0], [1, 1, 1], C.canopy);
    engine(g, -2.6, 0, -18, 1.6); engine(g, 2.6, 0, -18, 1.6); engine(g, 0, 0, -18, 1.3);
  },
  razor(g) { // 15 m interceptor, hook wings
    g.add(fuselage(15, 1.8, 1.6), 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], H.hull);
    for (const sd of [-1, 1]) {
      wing(g, sd, 5.2, 3, -2.2, -1, 0, 0.25, H.hull); // forward-hooked
      g.add(boxGeo(0.25, 0.25, 3.2), 'hull', [sd * 5.1, 0, 0.6], [0, 0, 0], [1, 1, 1], H.gold);
      wing(g, sd, 1.6, 1.4, 0.8, 4.5, 0.2, 0.2, H.dark);
    }
    g.add(spireGeo(0.5, 2.4), 'hull', [0, 0.6, -4], [0, 0, 0], [1, 1, 1], H.gold);
    engine(g, 0, 0, -7.5, 0.8);
  },
  wasp(g) { // 20 m strike fighter
    g.add(fuselage(20, 2.6, 2.2), 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], H.hull);
    for (const sd of [-1, 1]) {
      wing(g, sd, 6.4, 5, 3.8, -1, 0, 0.3, H.hull, -0.1);
      g.add(boxGeo(0.9, 0.9, 3.6), 'hull', [sd * 3, -0.7, 0], [0, 0, 0], [1, 1, 1], H.dark);
      g.add(boxGeo(0.25, 0.25, 4.6), 'hull', [sd * 6.2, 0, -2.6], [0, 0, 0], [1, 1, 1], H.gold);
      wing(g, sd, 2.2, 1.6, 1, 6, 0.3, 0.2, H.dark);
    }
    engine(g, 0, 0, -10, 1);
  },
  scythe(g) { // 26 m bomber, torpedo bay along the spine
    g.add(fuselage(26, 5.4, 4, 0.2, 0.8), 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], H.hull);
    g.add(boxGeo(1.4, 0.8, 14), 'glow', [0, 2.05, 0], [0, 0, 0], [1, 1, 1], 0xff8a3a);
    for (const sd of [-1, 1]) { wing(g, sd, 6.5, 6, 2, -1, -0.5, 0.45, H.hull); g.add(boxGeo(0.35, 0.35, 6), 'hull', [sd * 6.3, -0.5, -1.4], [0, 0, 0], [1, 1, 1], H.gold); }
    g.add(spireGeo(0.8, 3.5), 'hull', [0, 2, -6], [0, 0, 0], [1, 1, 1], H.dark);
    engine(g, -1.3, 0, -13, 1.2); engine(g, 1.3, 0, -13, 1.2);
  },
  maul(g) { // 38 m gunship: a small cathedral with engines
    g.add(fuselage(38, 9.5, 7, 0.45, 0.9), 'hull', [0, 0, 0], [0, 0, 0], [1, 1, 1], H.hull);
    g.add(boxGeo(5, 5, 10), 'hull', [0, 4.5, -5], [0, 0, 0], [1, 1, 1], H.dark);
    g.add(spireGeo(1.6, 8), 'hull', [0, 7, -7], [0, 0, 0], [1, 1, 1], H.dark);
    g.add(spireGeo(1.1, 5), 'hull', [0, 4.5, 4], [0, 0, 0], [1, 1, 1], H.dark);
    for (const sd of [-1, 1]) {
      g.add(cylGeo(1.6, 1.8, 1.2, 8), 'hull', [sd * 3.4, 3.4, 6], [0, 0, 0], [1, 1, 1], H.dark);
      g.add(boxGeo(0.4, 0.4, 30), 'hull', [sd * 4.6, -0.2, 0], [0, 0, 0], [1, 1, 1], H.gold);
      g.add(boxGeo(0.6, 2, 1.4), 'glow', [sd * 4.7, 1.2, -2], [0, 0, 0], [1, 1, 1], 0xffa050);
    }
    g.add(cylGeo(1.6, 1.8, 1.2, 8), 'hull', [0, 4, 9], [0, 0, 0], [1, 1, 1], H.dark);
    engine(g, -2.8, 0, -19, 1.6); engine(g, 2.8, 0, -19, 1.6); engine(g, 0, 0, -19, 1.3);
  },
};

const CACHE = {};
/** { hull: BufferGeometry, glow: BufferGeometry } for a craft key (see src/data/ships.js CRAFT). */
export function craftGeometry(key) {
  if (CACHE[key]) return CACHE[key];
  const g = new GeoBuilder(null);
  BUILDERS[key](g);
  const parts = g.parts.fore;
  CACHE[key] = { hull: GeoBuilder.merge(parts.hull), glow: parts.glow ? GeoBuilder.merge(parts.glow) : null };
  return CACHE[key];
}
export const CRAFT_KEYS = Object.keys(BUILDERS);
