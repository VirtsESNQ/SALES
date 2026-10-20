// Geometry helpers and faction materials shared by all procedural models.
// Pieces are merged per material into a few meshes; each piece can carry a vertex tint.
import * as THREE from 'three';
import { hullTextures, plumeTexture, glowTexture } from '../textures.js';

export const V3 = THREE.Vector3;
export const TILE = 260; // metres covered by one hull texture tile (sets window/panel scale)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();

/** Box with world-scaled UVs so plating density is constant on every face. */
export function boxGeo(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  const ox = (w * 0.37) % 1, oy = (d * 0.11) % 1;
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    uv.setXY(i, uv.getX(i) * dims[f][0] / TILE + ox, uv.getY(i) * dims[f][1] / TILE + oy);
  }
  return g;
}
export function cylGeo(rt, rb, h, seg = 12, open = false) {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv, s = Math.max(rt, rb) * Math.PI * 2 / TILE;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * s, uv.getY(i) * h / TILE);
  return g;
}
export function sphereGeo(r, ws = 14, hs = 9) {
  const g = new THREE.SphereGeometry(r, ws, hs);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * 6 / TILE, uv.getY(i) * r * 3 / TILE);
  return g;
}
/** Four-sided spire (pyramid) with its base at y=0. */
export function spireGeo(r, h, sides = 4) {
  const g = new THREE.ConeGeometry(r, h, sides, 1, false);
  g.rotateY(Math.PI / sides);
  g.translate(0, h / 2, 0);
  return g;
}
/** Triangular prism plate (a fin) in the YZ plane: base length along Z, height along Y. */
export function finGeo(len, height, thick, sweep = 0.5) {
  const s = new THREE.Shape();
  s.moveTo(-len / 2, 0); s.lineTo(len / 2, 0); s.lineTo(-len / 2 + len * sweep, height); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
  g.translate(0, 0, -thick / 2);
  g.rotateY(-Math.PI / 2); // shape X -> world Z
  return g;
}

/**
 * Loft between cross-sections along +Z. sections: [{z, pts:[[x,y]...]}], same point count,
 * points ordered counter-clockwise when viewed from +Z.
 */
export function loftGeo(sections, capStart = true, capEnd = true) {
  const pos = [], uvs = [];
  const n = sections[0].pts.length;
  const P = (s, i) => { const p = s.pts[i % n]; return [p[0], p[1], s.z]; };
  for (let si = 0; si < sections.length - 1; si++) {
    const A = sections[si], B = sections[si + 1];
    let uA = 0, uB = 0;
    for (let i = 0; i < n; i++) {
      const a0 = P(A, i), a1 = P(A, i + 1), b0 = P(B, i), b1 = P(B, i + 1);
      const la = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]), lb = Math.hypot(b1[0] - b0[0], b1[1] - b0[1]);
      const va = A.z / TILE, vb = B.z / TILE;
      pos.push(...a0, ...b1, ...b0, ...a0, ...a1, ...b1);
      uvs.push(uA / TILE, va, (uB + lb) / TILE, vb, uB / TILE, vb, uA / TILE, va, (uA + la) / TILE, va, (uB + lb) / TILE, vb);
      uA += la; uB += lb;
    }
  }
  const cap = (S, flip) => {
    let cx = 0, cy = 0;
    for (const p of S.pts) { cx += p[0]; cy += p[1]; }
    cx /= n; cy /= n;
    const c = [cx, cy, S.z];
    for (let i = 0; i < n; i++) {
      const a = P(S, i), b = P(S, i + 1);
      if (flip) pos.push(...c, ...a, ...b); else pos.push(...c, ...b, ...a);
      uvs.push(c[0] / TILE, c[1] / TILE, a[0] / TILE, a[1] / TILE, b[0] / TILE, b[1] / TILE);
    }
  };
  if (capStart) cap(sections[0], false);
  if (capEnd) cap(sections[sections.length - 1], true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}

/** Collects geometry pieces per material key (and per fore/aft half) and merges them. */
export class GeoBuilder {
  constructor(split = null) {
    this.split = split;        // z where the hull breaks in two during destruction (null = one part)
    this.parts = { fore: {}, aft: {} };
  }
  /** add(geo, key, [x,y,z], [rx,ry,rz], [sx,sy,sz], tint) */
  add(geo, key, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1], tint = null) {
    _m.compose(_p.set(p[0], p[1], p[2]), _q.setFromEuler(_e.set(r[0], r[1], r[2])), _s.set(s[0], s[1], s[2]));
    return this.addM(geo, key, _m, tint, p[2]);
  }
  addM(geo, key, m, tint = null, z = null) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    const c = new THREE.Color(tint ?? 0xffffff);
    const col = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (z == null) { g.computeBoundingBox(); z = (g.boundingBox.min.z + g.boundingBox.max.z) / 2; }
    const half = this.split == null || z >= this.split ? 'fore' : 'aft';
    (this.parts[half][key] ||= []).push(g);
    return this;
  }
  static merge(list) {
    let n = 0;
    for (const g of list) n += g.attributes.position.count;
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), U = new Float32Array(n * 2), C = new Float32Array(n * 3);
    let o = 0;
    for (const g of list) {
      P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
      U.set(g.attributes.uv.array, o * 2); C.set(g.attributes.color.array, o * 3);
      o += g.attributes.position.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    geo.setAttribute('color', new THREE.BufferAttribute(C, 3));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    return geo;
  }
  /** Returns { fore: Group, aft: Group|null } */
  build(mats) {
    const out = {};
    for (const half of ['fore', 'aft']) {
      const keys = Object.keys(this.parts[half]);
      if (!keys.length) { out[half] = null; continue; }
      const grp = new THREE.Group();
      grp.name = half;
      for (const key of keys) {
        const mesh = new THREE.Mesh(GeoBuilder.merge(this.parts[half][key]), mats[key]);
        mesh.userData.matKey = key;
        grp.add(mesh);
      }
      out[half] = grp;
    }
    return out;
  }
  /** Single merged geometry (all keys) — used for small craft. */
  mergedAll() {
    const list = [];
    for (const half of ['fore', 'aft']) for (const k in this.parts[half]) list.push(...this.parts[half][k]);
    return GeoBuilder.merge(list);
  }
}

/* ---------------- materials ---------------- */
export const FACTION_STYLE = {
  concord: {
    base: [138, 148, 160], variance: 0.07, gothic: false, seed: 3,
    windowColors: [[255, 226, 180], [210, 232, 255], [235, 245, 255]],
    emissive: 0xfff2e0, engine: 0x8fd0ff, lights: 0xdfeaff, trim: 0xc9d2da, dark: 0x3a4148, metal: 0x59616b, accent: 0x9fd8ff,
  },
  hegemony: {
    base: [78, 70, 66], variance: 0.12, gothic: true, seed: 11,
    windowColors: [[255, 170, 90], [255, 200, 120], [255, 140, 70]],
    emissive: 0xffb070, engine: 0xff7a30, lights: 0xffa860, trim: 0x8a7a70, dark: 0x2a2220, metal: 0x3d322c, accent: 0xffa860,
  },
};
const MATS = {};
const SHARED = {};
export function sharedTextures() {
  if (!SHARED.plume) { SHARED.plume = plumeTexture(); SHARED.glow = glowTexture(); }
  return SHARED;
}
export function materials(faction) {
  if (MATS[faction]) return MATS[faction];
  const f = FACTION_STYLE[faction];
  const t = hullTextures({ base: f.base, variance: f.variance, windows: 26, windowColors: f.windowColors, seed: f.seed, gothic: f.gothic });
  const plain = hullTextures({ base: f.base, variance: f.variance * 0.8, windows: 0, seed: f.seed + 50, decals: false, gothic: f.gothic });
  const m = {
    // big hull surfaces with lit windows
    hull: new THREE.MeshStandardMaterial({ map: t.map, emissiveMap: t.emissive, emissive: new THREE.Color(f.emissive), emissiveIntensity: 1.6, roughness: 0.55, metalness: 0.45, vertexColors: true }),
    // superstructure, turrets, greebles (no windows)
    plain: new THREE.MeshStandardMaterial({ map: plain.map, roughness: 0.5, metalness: 0.45, vertexColors: true }),
    metal: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.75, vertexColors: true }),
    void: new THREE.MeshBasicMaterial({ color: 0x040506, vertexColors: false }),
    lights: new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true, toneMapped: false }),
    gold: new THREE.MeshStandardMaterial({ color: 0xc9a14f, roughness: 0.32, metalness: 0.9, emissive: 0x2a1a04, vertexColors: true }),
    glow: new THREE.MeshBasicMaterial({ color: f.engine, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  };
  MATS[faction] = m;
  return m;
}
export const style = (faction) => FACTION_STYLE[faction];

/* ---------------- mount helpers ---------------- */
const DEG = Math.PI / 180;
const lerpN = (a, b, t) => a + (b - a) * t;
/** Weapon mount spec. face = rest yaw (rad), flip = ventral, side = 'port'|'stbd' for flank guns. */
export function M(type, x, y, z, o = {}) {
  return { type, pos: new V3(x, y, z), face: o.face ?? 0, flip: !!o.flip, side: o.side ?? null,
    yawLim: o.yawLim ?? [-160 * DEG, 160 * DEG], pitchLim: o.pitchLim ?? [-8 * DEG, 85 * DEG], fixed: !!o.fixed };
}
/** n values evenly spread between a and b. */
export const spread = (a, b, n) => Array.from({ length: n }, (_, i) => (n === 1 ? (a + b) / 2 : lerpN(a, b, i / (n - 1))));
