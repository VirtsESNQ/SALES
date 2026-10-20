// Hegemony ships: dark gothic hulls, gilded trim, spires, buttresses and lit arched windows.
// Varr Tolun (battle cathedral), Kesh (claw cruiser), Ulthane (hive carrier), Talon (blade escort).
// Local frame: +Z bow, +Y dorsal, +X port, -X starboard. Units: metres.
import * as THREE from 'three';
import { GeoBuilder, V3, boxGeo, cylGeo, sphereGeo, spireGeo, finGeo, loftGeo, style, M, spread } from './geo.js';

const DEG = Math.PI / 180;
const HALF_PI = Math.PI / 2;

/** Tall octagonal "nave" cross-section. */
function nave(z, w, h, yc = 0, cx = 0) {
  return { z, pts: [
    [cx + w / 2, yc - h * 0.32], [cx + w / 2, yc + h * 0.3], [cx + w * 0.34, yc + h / 2], [cx - w * 0.34, yc + h / 2],
    [cx - w / 2, yc + h * 0.3], [cx - w / 2, yc - h * 0.32], [cx - w * 0.3, yc - h / 2], [cx + w * 0.3, yc - h / 2],
  ] };
}
/** Pitched roof prism along Z. */
function roofGeo(z0, z1, w, yBase, ridge) {
  const sec = (z, ww, rr) => ({ z, pts: [[ww / 2, yBase], [0, yBase + rr], [-ww / 2, yBase]] });
  return loftGeo([sec(z0, w * 0.6, ridge * 0.5), sec(z0 + 40, w, ridge), sec(z1 - 40, w, ridge), sec(z1, w * 0.6, ridge * 0.5)]);
}
/** Gold strip between two points. */
function strip(g, a, b, w, key = 'gold', tint = null) {
  const mid = a.clone().add(b).multiplyScalar(0.5), len = a.distanceTo(b);
  const m = new THREE.Matrix4().lookAt(a, b, new V3(0, 1, 0));
  const geo = boxGeo(w, w, len);
  m.setPosition(mid);
  g.addM(geo, key, m, tint, mid.z);
}
/** Spire with gold tip and optional pinnacles. */
function spire(g, x, y, z, r, h, pinn = true, tint = 0x3c3431) {
  g.add(spireGeo(r, h), 'plain', [x, y, z], [0, 0, 0], [1, 1, 1], tint);
  g.add(boxGeo(r * 1.5, h * 0.12, r * 1.5), 'plain', [x, y + h * 0.06, z], [0, Math.PI / 4, 0], [1, 1, 1], 0x2a2220);
  g.add(sphereGeo(Math.max(3, r * 0.14), 8, 6), 'gold', [x, y + h + r * 0.1, z]);
  g.add(boxGeo(r * 0.12 + 1, h * 0.25, r * 0.12 + 1), 'gold', [x, y + h * 0.82, z]);
  if (pinn) for (const [dx, dz] of [[r * 1.1, 0], [-r * 1.1, 0], [0, r * 1.1], [0, -r * 1.1]]) g.add(spireGeo(r * 0.3, h * 0.35), 'plain', [x + dx, y, z + dz], [0, 0, 0], [1, 1, 1], tint);
}
/** Row of lit arched windows on a vertical side wall (x fixed). */
function windowRow(g, x, y, z0, z1, step, h, tint = 0xff9a50) {
  for (let z = z0; z <= z1; z += step) {
    g.add(boxGeo(2, h, step * 0.32), 'lights', [x, y, z], [0, 0, 0], [1, 1, 1], tint);
    g.add(boxGeo(2.4, step * 0.16, step * 0.16), 'lights', [x, y + h / 2, z], [Math.PI / 4, 0, 0], [1, 1, 1], tint);
  }
}

function finish(g, o) {
  return {
    faction: 'hegemony', builder: g, mounts: o.mounts, engines: o.engines, hangar: o.hangar || null, split: o.split,
    length: o.L, bridge: o.bridge, subsystems: o.subsystems, hitBoxes: o.hitBoxes, radius: o.radius,
    shield: o.shield, siegeTip: o.siegeTip || null, ramTip: o.ramTip || null, launch: o.launch || null, dims: o.dims,
  };
}
function nozzles(g, z, list, len = 1) {
  const st = style('hegemony');
  const out = [];
  for (const [x, y, r] of list) {
    const l = r * 0.8 * len;
    g.add(cylGeo(r * 1.15, r, l, 8, true), 'metal', [x, y, z - l / 2], [HALF_PI, 0, 0], [1, 1, 1], st.metal);
    g.add(cylGeo(r * 1.3, r * 1.3, l * 0.2, 8), 'plain', [x, y, z - l * 0.1], [HALF_PI, Math.PI / 8, 0], [1, 1, 1], 0x2a2220);
    g.add(cylGeo(r * 0.9, r * 0.9, 3, 16), 'lights', [x, y, z - l * 0.7], [HALF_PI, 0, 0], [1, 1, 1], 0xff8a40);
    out.push({ pos: new V3(x, y, z - l + 4), r });
  }
  return out;
}

/* ================= VARR TOLUN ================= */
export function buildVarr() {
  const L = 2480, z0 = -L / 2, z1 = L / 2, split = -200;
  const g = new GeoBuilder(split);
  const hullT = 0xffffff, dark = 0x2c2522, mid = 0x4a403b;
  // nave and ram prow
  const secs = [nave(-1180, 470, 380), nave(-1000, 520, 420), nave(split, 520, 420), nave(320, 520, 420), nave(520, 500, 400, -5),
    nave(800, 330, 280, -25), nave(1050, 150, 140, -35), nave(z1, 24, 40, -40)];
  g.addM(loftGeo(secs.filter((s) => s.z <= split)), 'hull', new THREE.Matrix4(), hullT, split - 1);
  g.addM(loftGeo(secs.filter((s) => s.z >= split)), 'hull', new THREE.Matrix4(), hullT, split + 1);
  // gold cladding along the prow edges, and a gold ram blade under the prow
  for (let k = 0; k < 8; k++) {
    const p = (s) => new V3(s.pts[k][0], s.pts[k][1], s.z);
    for (let i = 4; i < secs.length - 1; i++) strip(g, p(secs[i]), p(secs[i + 1]), 16);
  }
  g.add(finGeo(520, 70, 16, 0.2), 'gold', [0, -150, 860], [Math.PI, 0, 0]);
  for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) g.add(boxGeo(6, 220 - i * 30, 10), 'gold', [sd * (240 - i * 40), -5, 560 + i * 120], [0, 0, 0], [1, 1, 1], null);
  // siege cannon emitter at the tip
  g.add(cylGeo(46, 30, 140, 8), 'metal', [0, -40, z1 - 40], [HALF_PI, 0, 0], [1, 1, 1], dark);
  g.add(sphereGeo(30, 14, 10), 'lights', [0, -40, z1 + 30], [0, 0, 0], [1, 1, 1], 0xff8a3a);
  // roof ridge, buttresses, piers
  g.add(roofGeo(-760, 470, 340, 205, 95), 'plain', [0, 0, 0], [0, 0, 0], [1, 1, 1], mid);
  for (let z = -900; z <= 380; z += 160) {
    for (const sd of [-1, 1]) {
      g.add(boxGeo(26, 430, 30), 'plain', [sd * 262, 0, z], [0, 0, 0], [1, 1, 1], dark);
      strip(g, new V3(sd * 310, 70, z), new V3(sd * 190, 270, z), 18, 'plain', dark);
      g.add(spireGeo(14, 70), 'plain', [sd * 270, 210, z], [0, 0, 0], [1, 1, 1], mid);
    }
  }
  // two gun decks per flank: balconies with gun ports and lit windows
  const decks = [60, -90];
  for (const sd of [-1, 1]) {
    for (const y of decks) {
      g.add(boxGeo(56, 18, 1360), 'plain', [sd * 286, y - 34, -250], [0, 0, 0], [1, 1, 1], mid);
      g.add(boxGeo(6, 6, 1360), 'gold', [sd * 314, y - 26, -250]);
      windowRow(g, sd * 261, y + 32, -920, 420, 38, 16);
    }
    windowRow(g, sd * 261, 170, -900, 380, 46, 26, 0xffb070);
  }
  // ventral keel
  g.add(loftGeo([{ z: -700, pts: [[150, -205], [-150, -205], [-80, -300], [80, -300]] }, { z: 300, pts: [[150, -205], [-150, -205], [-80, -300], [80, -300]] }]), 'plain', [0, 0, 0], [0, 0, 0], [1, 1, 1], dark);
  // stern castle: three tiers and the great spire
  const tiers = [[480, 210, 430, -1200, -760], [380, 430, 590, -1170, -820], [260, 590, 710, -1140, -880]];
  for (const [w, y0, y1, za, zb] of tiers) {
    g.add(boxGeo(w, y1 - y0, zb - za), 'hull', [0, (y0 + y1) / 2, (za + zb) / 2], [0, 0, 0], [1, 1, 1], hullT);
    for (const sx of [-1, 1]) for (const zz of [za + 20, zb - 20]) spire(g, sx * (w / 2 - 14), y1, zz, 18, 70, false, mid);
    for (let x = -w / 2 + 20; x <= w / 2 - 20; x += 40) g.add(boxGeo(18, 20, 18), 'plain', [x, y1 + 10, zb - 6], [0, 0, 0], [1, 1, 1], mid);
    for (const sx of [-1, 1]) windowRow(g, sx * (w / 2 + 1), (y0 + y1) / 2, za + 40, zb - 40, 34, (y1 - y0) * 0.4, 0xffa050);
  }
  // rose window on the castle front
  g.add(cylGeo(78, 78, 6, 24), 'lights', [0, 330, -757], [HALF_PI, 0, 0], [1, 1, 1], 0xffa050);
  g.add(new THREE.TorusGeometry(84, 8, 6, 28), 'gold', [0, 330, -754]);
  for (let i = 0; i < 8; i++) g.add(boxGeo(6, 156, 4), 'plain', [0, 330, -752], [0, 0, (i * Math.PI) / 8], [1, 1, 1], dark);
  spire(g, 0, 710, -1010, 72, 300, true, mid);
  // roof spires along the spine
  for (const [z, h] of [[-560, 360], [-250, 240], [10, 300], [260, 190], [440, 140]]) spire(g, 0, 290, z, 34, h, true, mid);
  // engines (thin stern armour)
  g.add(boxGeo(520, 360, 70), 'plain', [0, 0, -1210], [0, 0, 0], [1, 1, 1], dark);
  const engines = nozzles(g, -1245, [[0, 0, 120], [-170, 70, 92], [170, 70, 92], [-170, -90, 92], [170, -90, 92], [-260, 175, 50], [260, 175, 50]]);

  const mounts = [];
  for (const z of [-400, -100, 170]) for (const sd of [-1, 1]) mounts.push(M('macro', sd * 150, 250, z));
  for (const sd of [-1, 1]) for (const y of decks) for (const z of spread(-860, 360, 6)) mounts.push(M('gundeck', sd * 282, y, z, { face: sd * HALF_PI, side: sd > 0 ? 'port' : 'stbd', yawLim: [-42 * DEG, 42 * DEG], pitchLim: [-30 * DEG, 30 * DEG] }));
  mounts.push(M('siege', 0, -40, z1 + 40, { fixed: true }));
  for (const sd of [-1, 1]) for (const y of [-70, -10, 50]) mounts.push(M('torpedo', sd * 205, y, 690, { fixed: true }));
  for (const sd of [-1, 1]) for (const z of spread(-700, 380, 5)) mounts.push(M('secondary', sd * 236, 205, z, { face: sd * HALF_PI }));
  for (const sd of [-1, 1]) mounts.push(M('ion', sd * 252, 360, -900, { face: sd * HALF_PI }));
  for (const sd of [-1, 1]) for (const z of [-1080, -960, -900]) mounts.push(M('vls', sd * 150, 592, z, { fixed: true }));
  for (const p of [[210, 432, -1150], [210, 432, -800], [300, 80, 470]]) for (const sd of [-1, 1]) mounts.push(M('flak', sd * p[0], p[1], p[2]));
  for (const p of [[250, 215, -950], [250, 215, 250]]) for (const sd of [-1, 1]) mounts.push(M('pd', sd * p[0], p[1], p[2]));
  for (const p of [[200, -215, -400], [150, -215, 350]]) for (const sd of [-1, 1]) mounts.push(M('pd', sd * p[0], p[1], p[2], { flip: true }));
  for (const m of mounts) if (m.type === 'torpedo' || m.type === 'vls') {
    g.add(boxGeo(36, 30, 40), 'plain', [m.pos.x, m.pos.y, m.pos.z - 20], [0, 0, 0], [1, 1, 1], dark);
    g.add(boxGeo(20, 12, 3), 'lights', [m.pos.x, m.pos.y, m.pos.z + 1], [0, 0, 0], [1, 1, 1], 0xff7a30);
  }

  const hitBoxes = [
    [new V3(-260, -210, -1240), new V3(260, 210, 520)], [new V3(-170, -150, 520), new V3(170, 150, 1000)], [new V3(-60, -80, 1000), new V3(60, 20, 1260)],
    [new V3(-320, -110, -920), new V3(320, 90, 420)], [new V3(-240, 210, -1200), new V3(240, 430, -760)], [new V3(-190, 430, -1170), new V3(190, 710, -820)],
    [new V3(-60, 710, -1080), new V3(60, 1010, -940)], [new V3(-150, -300, -700), new V3(150, -205, 300)], [new V3(-170, 205, -760), new V3(170, 300, 470)],
  ];
  return finish(g, {
    L, split, mounts, engines, hitBoxes, radius: 1400,
    bridge: new V3(0, 560, -800),
    subsystems: { engines: new V3(0, 0, -1180), shieldgen: new V3(0, 300, -200), sensors: new V3(0, 760, -1010), reactor: new V3(0, 0, -600), siege: new V3(0, -40, 1150) },
    shield: { center: new V3(0, 300, 0), radii: new V3(520, 900, 1450) },
    siegeTip: new V3(0, -40, z1 + 40), dims: { beam: 640, top: 1010, keel: 300 },
  });
}

/* ================= KESH-class heavy cruiser (claw bow) ================= */
export function buildKesh() {
  const L = 1250, z0 = -L / 2, z1 = L / 2, split = -50;
  const g = new GeoBuilder(split);
  const dark = 0x2c2522, mid = 0x4a403b;
  const secs = [nave(-600, 280, 240), nave(-450, 320, 280), nave(split, 320, 280), nave(150, 320, 280), nave(260, 300, 250)];
  g.addM(loftGeo(secs.filter((s) => s.z <= split)), 'hull', new THREE.Matrix4(), null, split - 1);
  g.addM(loftGeo(secs.filter((s) => s.z >= split)), 'hull', new THREE.Matrix4(), null, split + 1);
  // the claw: two forked tines curving inward
  for (const sd of [-1, 1]) {
    const tine = [nave(200, 120, 240, 0, sd * 100), nave(400, 92, 180, -5, sd * 112), nave(540, 54, 100, -10, sd * 96), nave(z1, 10, 22, -12, sd * 64)];
    g.addM(loftGeo(tine), 'hull', new THREE.Matrix4(), null, 400);
    for (const k of [2, 7]) for (let i = 0; i < tine.length - 1; i++) strip(g, new V3(tine[i].pts[k][0], tine[i].pts[k][1], tine[i].z), new V3(tine[i + 1].pts[k][0], tine[i + 1].pts[k][1], tine[i + 1].z), 9);
  }
  // talon ram cannon between the tines
  g.add(cylGeo(34, 44, 120, 8), 'metal', [0, 0, 290], [HALF_PI, 0, 0], [1, 1, 1], dark);
  g.add(sphereGeo(20, 12, 8), 'lights', [0, 0, 356], [0, 0, 0], [1, 1, 1], 0xff8a3a);
  // tower, spires, roof
  g.add(roofGeo(-520, 200, 200, 138, 50), 'plain', [0, 0, 0], [0, 0, 0], [1, 1, 1], mid);
  g.add(boxGeo(130, 120, 170), 'hull', [0, 200, -260]);
  g.add(boxGeo(160, 24, 90), 'plain', [0, 270, -230], [0, 0, 0], [1, 1, 1], mid);
  g.add(boxGeo(120, 10, 3), 'lights', [0, 272, -184], [0, 0, 0], [1, 1, 1], 0xffa050);
  spire(g, 0, 282, -270, 30, 220, true, mid);
  spire(g, 0, 170, 60, 18, 110, false, mid);
  spire(g, 0, 170, -480, 16, 90, false, mid);
  // gun deck balcony and windows
  for (const sd of [-1, 1]) {
    g.add(boxGeo(40, 14, 700), 'plain', [sd * 175, -40, -175], [0, 0, 0], [1, 1, 1], mid);
    g.add(boxGeo(5, 5, 700), 'gold', [sd * 196, -34, -175]);
    windowRow(g, sd * 161, 60, -560, 180, 34, 14);
    for (let z = -540; z <= 150; z += 115) g.add(boxGeo(18, 280, 22), 'plain', [sd * 160, 0, z], [0, 0, 0], [1, 1, 1], dark);
  }
  g.add(finGeo(520, 150, 16, 0.3), 'plain', [0, -138, -150], [Math.PI, 0, 0], [1, 1, 1], dark);
  g.add(boxGeo(300, 240, 40), 'plain', [0, 0, -610], [0, 0, 0], [1, 1, 1], dark);
  const engines = nozzles(g, -630, [[0, 0, 82], [-110, 55, 52], [110, 55, 52], [-110, -55, 52], [110, -55, 52]]);

  const mounts = [];
  for (const z of [-70, 120]) for (const sd of [-1, 1]) mounts.push(M('macro', sd * 82, 150, z));
  for (const sd of [-1, 1]) for (const z of spread(-520, 130, 8)) mounts.push(M('gundeck', sd * 176, -6, z, { face: sd * HALF_PI, side: sd > 0 ? 'port' : 'stbd', yawLim: [-42 * DEG, 42 * DEG], pitchLim: [-30 * DEG, 30 * DEG] }));
  mounts.push(M('ram', 0, 0, 360, { fixed: true }));
  for (const sd of [-1, 1]) mounts.push(M('ion', sd * 120, 140, -440));
  for (const sd of [-1, 1]) for (const z of [-360, -150, 40]) mounts.push(M('secondary', sd * 150, 100, z, { face: sd * HALF_PI }));
  for (const p of [[140, 128, -560], [96, 90, 260]]) for (const sd of [-1, 1]) mounts.push(M('pd', sd * p[0], p[1], p[2]));
  for (const sd of [-1, 1]) mounts.push(M('pd', sd * 120, -140, -100, { flip: true }));

  return finish(g, {
    L, split, mounts, engines, radius: 720,
    hitBoxes: [[new V3(-160, -140, -625), new V3(160, 140, 260)], [new V3(-180, 140, -350), new V3(180, 290, -170)], [new V3(-170, -120, 200), new V3(170, 120, 625)], [new V3(-200, -60, -530), new V3(200, 10, 180)]],
    bridge: new V3(0, 272, -200),
    subsystems: { engines: new V3(0, 0, -590), shieldgen: new V3(0, 160, -100), sensors: new V3(0, 300, -260), reactor: new V3(0, 0, -300) },
    shield: { center: new V3(0, 40, 0), radii: new V3(300, 360, 720) },
    ramTip: new V3(0, 0, 370), dims: { beam: 400, top: 500, keel: 290 },
  });
}

/* ================= ULTHANE-class fleet carrier ================= */
export function buildUlthane() {
  const L = 1620, z0 = -L / 2, z1 = L / 2, split = -100;
  const g = new GeoBuilder(split);
  const dark = 0x2c2522, mid = 0x4a403b;
  const secs = [nave(-800, 340, 380), nave(-700, 380, 420), nave(split, 380, 420), nave(560, 380, 420), nave(640, 300, 360)];
  g.addM(loftGeo(secs.filter((s) => s.z <= split)), 'hull', new THREE.Matrix4(), null, split - 1);
  g.addM(loftGeo(secs.filter((s) => s.z >= split)), 'hull', new THREE.Matrix4(), null, split + 1);
  g.add(roofGeo(-720, 560, 260, 205, 130), 'plain', [0, 0, 0], [0, 0, 0], [1, 1, 1], mid);
  // rose window on the bow face
  g.add(cylGeo(118, 118, 6, 28), 'lights', [0, 20, 642], [HALF_PI, 0, 0], [1, 1, 1], 0xffa050);
  g.add(new THREE.TorusGeometry(124, 10, 6, 32), 'gold', [0, 20, 646]);
  for (let i = 0; i < 6; i++) g.add(boxGeo(7, 236, 5), 'plain', [0, 20, 648], [0, 0, (i * Math.PI) / 6], [1, 1, 1], dark);
  spire(g, 0, 330, -200, 40, 260, true, mid);
  spire(g, 0, 300, 300, 22, 120, false, mid);
  // launch galleries under arches
  const GX = 370, GW = 230, launch = [];
  for (const sd of [-1, 1]) {
    const x = sd * GX;
    g.add(boxGeo(GW, 280, 1520), 'hull', [x, -30, 0]);
    const arch = new THREE.CylinderGeometry(GW / 2, GW / 2, 1520, 18, 1, false, -HALF_PI, Math.PI);
    g.add(arch, 'plain', [x, 110, 0], [HALF_PI, 0, 0], [1, 1, 1], mid);
    // dark arched mouth with lit launch rails
    g.add(boxGeo(GW * 0.74, 210, 20), 'void', [x, -40, 754]);
    g.add(cylGeo(GW * 0.37, GW * 0.37, 20, 16), 'void', [x, 65, 754], [HALF_PI, 0, 0]);
    for (let k = 0; k < 6; k++) g.add(boxGeo(GW * 0.6, 3, 4), 'lights', [x, -120 + k * 34, 760], [0, 0, 0], [1, 1, 1], 0xffa860);
    for (const sx of [-1, 1]) g.add(boxGeo(6, 260, 8), 'gold', [x + sx * GW * 0.42, -20, 765]);
    windowRow(g, x + sd * (GW / 2 + 1), 40, -680, 680, 40, 18);
    windowRow(g, x + sd * (GW / 2 + 1), -60, -680, 680, 40, 18);
    windowRow(g, x - sd * (GW / 2 + 1), 0, -680, 680, 60, 18);
    for (const z of [-720, -360, 0, 360, 720]) spire(g, x, 225, z, 16, 80, false, mid);
    for (const z of [-480, 0, 450]) for (const y of [120, -120]) strip(g, new V3(sd * 180, y * 0.6, z), new V3(sd * (GX - GW / 2), y, z), 30, 'plain', dark);
    launch.push({ pos: new V3(x, -40, 770), dir: new V3(0, 0, 1) });
  }
  const engines = nozzles(g, -810, [[0, 0, 104], [-GX, -30, 82], [GX, -30, 82], [0, 140, 50]]);

  const mounts = [];
  for (const sd of [-1, 1]) mounts.push(M('macro', sd * GX, 225, 300));
  for (const sd of [-1, 1]) for (const z of spread(-600, 600, 5)) mounts.push(M('secondary', sd * (GX + GW / 2 + 8), 30, z, { face: sd * HALF_PI }));
  for (const sd of [-1, 1]) { for (const z of [-600, -300, 0]) mounts.push(M('flak', sd * GX, 225, z)); mounts.push(M('flak', sd * 120, 250, -600)); }
  for (const sd of [-1, 1]) { mounts.push(M('pd', sd * 150, 250, 420)); for (const z of [-500, 0, 500]) mounts.push(M('pd', sd * GX, -170, z, { flip: true })); }

  return finish(g, {
    L, split, mounts, engines, radius: 1050, launch, hangar: { pos: launch[0].pos.clone(), dir: new V3(0, 0, 1) },
    hitBoxes: [[new V3(-190, -210, -810), new V3(190, 340, 650)], [new V3(-GX - GW / 2, -170, -760), new V3(-GX + GW / 2, 225, 760)], [new V3(GX - GW / 2, -170, -760), new V3(GX + GW / 2, 225, 760)]],
    bridge: new V3(0, 300, 400),
    subsystems: { engines: new V3(0, 0, -770), shieldgen: new V3(0, 260, 0), sensors: new V3(0, 560, -200), reactor: new V3(0, 0, -400), hangar: new V3(0, -40, 700) },
    shield: { center: new V3(0, 40, 0), radii: new V3(640, 520, 920) },
    dims: { beam: 1100, top: 590, keel: 210 },
  });
}

/* ================= TALON-class escort (blade hull) ================= */
export function buildTalon() {
  const L = 430, z0 = -L / 2, z1 = L / 2;
  const g = new GeoBuilder(null);
  const dark = 0x2c2522, mid = 0x4a403b;
  const blade = (z, w, h) => ({ z, pts: [[w / 2, 0], [w * 0.3, h / 2], [-w * 0.3, h / 2], [-w / 2, 0], [-w * 0.3, -h / 2], [w * 0.3, -h / 2]] });
  const secs = [blade(z0 + 20, 110, 60), blade(-100, 130, 70), blade(80, 90, 40), blade(z1, 4, 4)];
  g.add(loftGeo(secs), 'hull');
  for (const k of [0, 3]) for (let i = 1; i < secs.length - 1; i++) strip(g, new V3(secs[i].pts[k][0], 0, secs[i].z), new V3(secs[i + 1].pts[k][0], 0, secs[i + 1].z), 5);
  g.add(finGeo(170, 90, 8, 0.85), 'plain', [0, 28, -70], [0, 0, 0], [1, 1, 1], mid);
  g.add(finGeo(170, 90, 8, 0.85), 'plain', [0, -28, -70], [Math.PI, 0, 0], [1, 1, 1], mid);
  for (const sd of [-1, 1]) g.add(finGeo(120, 70, 6, 0.9), 'plain', [sd * 50, 0, -110], [0, 0, sd * -2.1], [1, 1, 1], dark);
  spire(g, 0, 30, -10, 10, 70, false, mid);
  windowRow(g, 56, 10, -150, 40, 22, 6);
  windowRow(g, -56, 10, -150, 40, 22, 6);
  const engines = nozzles(g, z0 + 20, [[0, 0, 30], [-36, 0, 16], [36, 0, 16]]);
  const mounts = [M('secondary', 0, 34, 50)];
  for (const sd of [-1, 1]) mounts.push(M('secondary', sd * 40, 26, -130, { face: sd * HALF_PI }));
  for (const sd of [-1, 1]) mounts.push(M('vls', sd * 26, 30, -20, { fixed: true }));
  for (const sd of [-1, 1]) mounts.push(M('flak', sd * 44, 22, -170));
  for (const sd of [-1, 1]) mounts.push(M('pd', sd * 30, -30, 0, { flip: true }));
  return finish(g, {
    L, split: null, mounts, engines, radius: 240,
    hitBoxes: [[new V3(-65, -35, z0), new V3(65, 35, 80)], [new V3(-45, -20, 80), new V3(45, 20, z1)], [new V3(-10, 30, -150), new V3(10, 110, 10)]],
    bridge: new V3(0, 40, -20),
    subsystems: { engines: new V3(0, 0, z0 + 30), shieldgen: new V3(0, 20, -60), reactor: new V3(0, 0, -100) },
    shield: { center: new V3(0, 10, 0), radii: new V3(110, 110, 250) },
    dims: { beam: 130, top: 110, keel: 110 },
  });
}
