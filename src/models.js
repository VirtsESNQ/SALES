// Procedural ship/fighter/turret models (following design/*.html sheets).
// getDesign(cls) builds a class once; instantiateShip(cls) returns a scene-ready copy
// with fore/aft hull halves (for staged destruction) and throttle-driven engine plumes.
import * as THREE from 'three';
import { materials, sharedTextures, style } from './models/geo.js';
import { buildHalberd, buildRampart, buildWarden } from './models/concord.js';
import { buildVarr, buildKesh, buildUlthane, buildTalon } from './models/hegemony.js';
import { TURRET_TYPES, TurretRenderer, turretGeometry } from './models/turrets.js';
import { craftGeometry, CRAFT_KEYS } from './models/craft.js';
import { LOADOUTS } from './data/arsenal.js';

export { TurretRenderer, turretGeometry, TURRET_TYPES, craftGeometry, CRAFT_KEYS, materials };

const BUILD = { halberd: buildHalberd, rampart: buildRampart, warden: buildWarden, varr: buildVarr, kesh: buildKesh, ulthane: buildUlthane, talon: buildTalon };
export const SHIP_MODELS = Object.keys(BUILD);
const DESIGNS = {};

/** Built once per class: geometry groups + mount/subsystem/hitbox data in ship-local metres. */
export function getDesign(cls) {
  if (DESIGNS[cls]) return DESIGNS[cls];
  const d = BUILD[cls]();
  const parts = d.builder.build(materials(d.faction));
  delete d.builder;
  d.parts = parts;
  d.cls = cls;
  // The mount list must match the loadout on the design sheet exactly.
  const counts = {};
  for (const m of d.mounts) counts[m.type] = (counts[m.type] || 0) + 1;
  const want = LOADOUTS[cls];
  for (const k of new Set([...Object.keys(counts), ...Object.keys(want)])) {
    if ((counts[k] || 0) !== (want[k] || 0)) console.error(`[models] ${cls}: ${k} mounts ${counts[k] || 0} != loadout ${want[k] || 0}`);
  }
  DESIGNS[cls] = d;
  return d;
}

let PLUME_GEO = null;
function plumeGeometry() {
  if (PLUME_GEO) return PLUME_GEO;
  // unit cone pointing -Z, base at z=0 (radius 1), tip at z=-1; UV.v runs base->tip
  const g = new THREE.ConeGeometry(1, 1, 16, 1, true);
  g.rotateX(-Math.PI / 2);
  g.translate(0, 0, -0.5);
  PLUME_GEO = g;
  return g;
}

/** Soft additive exhaust: fades toward the tail and toward the silhouette edge. */
function plumeMaterial(color) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0.6 } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying float vAlong; varying float vEdge;
      void main(){
        vAlong = -position.z; // 0 at the nozzle, 1 at the tail
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        vEdge = abs(dot(n, normalize(-mv.xyz)));
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uOpacity;
      varying float vAlong; varying float vEdge;
      void main(){
        #include <logdepthbuf_fragment>
        float a = pow(1.0 - clamp(vAlong, 0.0, 1.0), 1.6) * pow(vEdge, 1.5) * uOpacity;
        vec3 c = mix(uColor, vec3(1.0), pow(1.0 - vAlong, 6.0) * 0.6);
        gl_FragColor = vec4(c * a, a);
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
}

/** A scene-ready ship. root contains { fore, aft } groups and engine FX. */
export function instantiateShip(cls) {
  const d = getDesign(cls);
  const root = new THREE.Group();
  root.name = cls;
  const clone = (grp) => {
    if (!grp) return null;
    const c = new THREE.Group(); c.name = grp.name;
    for (const m of grp.children) { const mm = new THREE.Mesh(m.geometry, m.material); mm.userData.matKey = m.userData.matKey; c.add(mm); }
    return c;
  };
  const fore = clone(d.parts.fore), aft = clone(d.parts.aft);
  root.add(fore); if (aft) root.add(aft);

  // engine FX: a glow sprite and a plume cone per nozzle, attached to the aft half
  const st = style(d.faction), tex = sharedTextures();
  const fxParent = aft || fore;
  const glowMat = new THREE.SpriteMaterial({ map: tex.glow, color: st.engine, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
  const plumeMat = plumeMaterial(st.engine);
  const plumes = [], glows = [];
  for (const e of d.engines) {
    const s = new THREE.Sprite(glowMat);
    s.position.copy(e.pos); s.scale.setScalar(e.r * 3.2);
    fxParent.add(s); glows.push({ s, r: e.r });
    const p = new THREE.Mesh(plumeGeometry(), plumeMat);
    p.position.copy(e.pos);
    fxParent.add(p); plumes.push({ p, r: e.r });
  }
  const engineFx = {
    plumeMat, glowMat,
    /** throttle 0..1 (negative = reverse), boost bool, damage 0..1 reduces glow */
    set(throttle, boost = false, flicker = 0) {
      const t = Math.max(0, throttle);
      for (const { p, r } of plumes) {
        const len = r * (0.6 + t * 4.5 + (boost ? 3 : 0));
        p.scale.set(r * (0.75 + t * 0.15), r * (0.75 + t * 0.15), len * (1 - flicker * Math.random()));
        p.visible = t > 0.02 || boost;
      }
      for (const { s, r } of glows) s.scale.setScalar(r * (2.2 + t * 2.4 + (boost ? 1.6 : 0)));
      plumeMat.uniforms.uOpacity.value = 0.35 + t * 0.45 + (boost ? 0.25 : 0);
      glowMat.opacity = 0.55 + t * 0.45;
    },
  };
  engineFx.set(0.3);
  return { root, fore, aft, engineFx, design: d };
}

/* ---- turret transforms ---- */
const _mm = new THREE.Matrix4(), _r = new THREE.Matrix4(), _t = new THREE.Matrix4();
/** Rest frame of a mount in ship space (position, ventral flip, rest yaw). Cached on the mount. */
export function mountMatrix(m) {
  if (m._mat) return m._mat;
  const mat = new THREE.Matrix4().makeTranslation(m.pos.x, m.pos.y, m.pos.z);
  if (m.flip) mat.multiply(_r.makeRotationZ(Math.PI));
  mat.multiply(_r.makeRotationY(m.face));
  m._mat = mat;
  return mat;
}
/** Writes turret base and barrel world matrices for a mount at yaw/pitch (radians, relative to rest). */
export function turretMatrices(shipWorld, m, geo, yaw, pitch, outBase, outBarrel, recoil = 0) {
  outBase.multiplyMatrices(shipWorld, mountMatrix(m)).multiply(_r.makeRotationY(yaw));
  outBarrel.copy(outBase).multiply(_t.makeTranslation(0, geo.pivotY, geo.pivotZ - recoil)).multiply(_r.makeRotationX(-pitch));
}
