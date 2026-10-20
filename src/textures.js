// Procedural canvas textures: clean hull plating with lit windows, glows, planet, moon, nebula.
// Everything is seeded so the look is identical between runs.
import * as THREE from 'three';
import { rng, clamp, lerp } from './core.js';

const smooth01 = (t) => t * t * (3 - 2 * t);

/** Seeded value noise + fBm. */
export function makeNoise(seed = 1) {
  const r = rng(seed);
  const P = new Uint8Array(512), G = new Float32Array(256);
  for (let i = 0; i < 256; i++) { P[i] = i; G[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [P[i], P[j]] = [P[j], P[i]]; }
  for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const h = (x, y) => G[P[(P[x & 255] + y) & 255]];
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), u = smooth01(x - xi), v = smooth01(y - yi);
    return lerp(lerp(h(xi, yi), h(xi + 1, yi), u), lerp(h(xi, yi + 1), h(xi + 1, yi + 1), u), v);
  }
  function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * n2(x * f, y * f); f *= 2; a *= 0.5; } return s; }
  return { n2, fbm };
}

function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
export function canvasTex(c, { repeat = true, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const rgb = (c, k = 1, a = 1) => `rgba(${clamp(c[0] * k, 0, 255) | 0},${clamp(c[1] * k, 0, 255) | 0},${clamp(c[2] * k, 0, 255) | 0},${a})`;

/**
 * Hull plating. Clean, large panels with crisp seams, a few access hatches and
 * warning-stripe decals, light grime, and window rows (albedo slot + emissive light).
 * opts: base [r,g,b], variance, windows (count of rows), windowColor, seed, decals
 */
export function hullTextures({ base, variance = 0.08, windows = 22, windowColors, seed = 1, decals = true, gothic = false }) {
  const S = 1024, r = rng(seed), N = makeNoise(seed + 7);
  const ri = (a, b) => Math.floor(a + r() * (b - a + 1));
  const c = canvas(S, S), g = c.getContext('2d');
  const e = canvas(S, S), ge = e.getContext('2d');
  g.fillStyle = rgb(base); g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);

  // large panels on a 16x16 grid, merging some cells into longer plates
  const cells = 16, cw = S / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells;) {
      const span = r() < 0.35 ? ri(2, 4) : 1;
      const k = 1 + (r() * 2 - 1) * variance;
      g.fillStyle = rgb(base, k);
      g.fillRect(x * cw + 1, y * cw + 1, span * cw - 2, cw - 2);
      x += span;
    }
  }
  // seams
  g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2;
  for (let i = 0; i <= cells; i++) { g.beginPath(); g.moveTo(0, i * cw); g.lineTo(S, i * cw); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1.5;
  for (let i = 0; i < 120; i++) { const x = ri(0, cells) * cw, y = ri(0, S); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + ri(1, 4) * cw); g.stroke(); }
  // highlights on top edges of panels (bevel feel)
  g.strokeStyle = 'rgba(255,255,255,0.07)'; g.lineWidth = 1;
  for (let i = 0; i <= cells; i++) { g.beginPath(); g.moveTo(0, i * cw + 2); g.lineTo(S, i * cw + 2); g.stroke(); }
  // hatches and small sub-panels
  for (let i = 0; i < 90; i++) {
    const x = ri(0, S - 60), y = ri(0, S - 30), w = ri(10, 50), h = ri(6, 24);
    g.fillStyle = rgb(base, 1 - variance * (0.5 + r()));
    g.fillRect(x, y, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.strokeRect(x + 0.5, y + 0.5, w, h);
  }
  if (gothic) {
    // vertical ribs and arched niches
    for (let i = 0; i < 26; i++) {
      const x = ri(0, S - 40), y = ri(0, S - 90), w = ri(14, 30), h = ri(40, 80);
      g.fillStyle = rgb(base, 0.55);
      g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.fill();
    }
  }
  if (decals) {
    // warning stripes near hatches and a few hull numbers
    for (let i = 0; i < 6; i++) {
      const x = ri(0, S - 120), y = ri(0, S - 16);
      for (let k = 0; k < 10; k++) {
        g.fillStyle = k % 2 ? 'rgba(20,20,20,0.7)' : (gothic ? 'rgba(170,130,60,0.55)' : 'rgba(200,170,80,0.5)');
        g.beginPath(); g.moveTo(x + k * 10, y); g.lineTo(x + k * 10 + 10, y); g.lineTo(x + k * 10 + 4, y + 10); g.lineTo(x + k * 10 - 6, y + 10); g.fill();
      }
    }
    g.font = 'bold 34px monospace'; g.fillStyle = 'rgba(230,236,240,0.16)';
    for (let i = 0; i < 4; i++) g.fillText(gothic ? ['XIV', 'VII', 'IX', 'III'][i] : `0${ri(1, 9)}${ri(0, 9)}`, ri(20, S - 120), ri(40, S - 20));
  }
  // grime (subtle on Concord, heavier on Hegemony)
  const id = g.getImageData(0, 0, S, S), d = id.data;
  const grime = gothic ? 0.34 : 0.18;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const n = 1 - grime / 2 + N.fbm(x / 140, y / 140, 4) * grime;
    const i = (y * S + x) * 4; d[i] *= n; d[i + 1] *= n; d[i + 2] *= n;
  }
  g.putImageData(id, 0, 0);
  // window rows: dark slot on albedo, light on emissive
  const wc = windowColors || [[255, 222, 170], [205, 228, 255], [255, 240, 210]];
  for (let s = 0; s < windows; s++) {
    const y = ri(4, S - 8), x0 = ri(0, S - 260), n = ri(8, 30), sp = ri(8, 11);
    const col = wc[ri(0, wc.length - 1)];
    for (let i = 0; i < n; i++) {
      if (r() < 0.25) continue;
      const x = x0 + i * sp;
      g.fillStyle = 'rgba(8,10,12,0.92)'; g.fillRect(x, y, 5, 3);
      ge.fillStyle = rgb(col, 1, 0.35 + r() * 0.65); ge.fillRect(x, y, 5, 3);
    }
  }
  return { map: canvasTex(c), emissive: canvasTex(e) };
}

/** Soft radial glow sprite. */
export function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.25)') {
  const c = canvas(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(0.3, mid); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return canvasTex(c, { repeat: false });
}

/** Engine plume gradient (along V). */
export function plumeTexture() {
  const c = canvas(16, 256), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 16, 256);
  return canvasTex(c, { repeat: false });
}

/** Banded gas giant with a storm. */
export function gasGiantTexture(seed = 5) {
  const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data, N = makeNoise(seed);
  const pal = [[70, 78, 92], [112, 120, 132], [150, 150, 150], [96, 104, 118], [58, 62, 74], [132, 136, 146], [176, 172, 166]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    const turb = N.fbm(u * 8, v * 30, 5) * 0.9 + N.fbm(u * 24, v * 60, 3) * 0.25;
    const band = v * 9 + turb * 1.4, t = band - Math.floor(band), k = Math.floor(band) % pal.length;
    const a = pal[(k + pal.length) % pal.length], b = pal[(k + 1) % pal.length], s = smooth01(t);
    let rr = lerp(a[0], b[0], s), gg = lerp(a[1], b[1], s), bb = lerp(a[2], b[2], s);
    const dx = (u - 0.62) * 2.2, dy = (v - 0.63) * 6, sd = Math.hypot(dx, dy);
    if (sd < 1) { const m = (1 - sd) * 0.5; rr = lerp(rr, 160, m); gg = lerp(gg, 120, m); bb = lerp(bb, 96, m); }
    const i = (y * W + x) * 4; d[i] = rr; d[i + 1] = gg; d[i + 2] = bb; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  const tex = canvasTex(c, { repeat: false }); tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export function ringTexture(seed = 9) {
  const W = 1024, c = canvas(W, 8), g = c.getContext('2d'), N = makeNoise(seed);
  for (let x = 0; x < W; x++) {
    const u = x / W;
    let a = N.fbm(u * 40, 0.5, 4);
    a = clamp((a - 0.3) * 1.6, 0, 1) * (u > 0.08 ? 1 : u / 0.08) * (u < 0.92 ? 1 : (1 - u) / 0.08);
    if (u > 0.55 && u < 0.6) a *= 0.15;
    const l = 140 + N.n2(u * 90, 3) * 70;
    g.fillStyle = `rgba(${l | 0},${(l * 0.95) | 0},${(l * 0.9) | 0},${a * 0.75})`; g.fillRect(x, 0, 1, 8);
  }
  return canvasTex(c, { repeat: false });
}

export function moonTexture(seed = 13) {
  const W = 512, H = 256, c = canvas(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data, N = makeNoise(seed), r = rng(seed);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const l = 70 + N.fbm(x / 40, y / 40, 6) * 110, i = (y * W + x) * 4;
    d[i] = l; d[i + 1] = l * 0.97; d[i + 2] = l * 0.93; d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  for (let i = 0; i < 80; i++) {
    const x = r() * W, y = 20 + r() * (H - 40), rad = 2 + r() * 16;
    const cg = g.createRadialGradient(x, y, 0, x, y, rad);
    cg.addColorStop(0, 'rgba(0,0,0,0.22)'); cg.addColorStop(0.75, 'rgba(0,0,0,0.12)'); cg.addColorStop(0.9, 'rgba(255,255,255,0.08)'); cg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cg; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  return canvasTex(c, { repeat: false });
}

/** Equirectangular nebula + milky-way band for the sky sphere. */
export function nebulaTexture(seed = 21) {
  const W = 1024, H = 512, c = canvas(W, H), g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data, N = makeNoise(seed);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H;
    // galactic band tilted across the sky
    const bandV = 0.5 + Math.sin(u * Math.PI * 2 + 0.6) * 0.12;
    const band = Math.exp(-((v - bandV) ** 2) / 0.006);
    const n = N.fbm(u * 6, v * 3, 6), n2 = N.fbm(u * 14 + 3, v * 7, 4);
    const dust = clamp(n2 * 1.6 - 0.55, 0, 1);
    // a cold blue-grey nebula and a faint rust cloud
    const neb1 = clamp((n - 0.45) * 2.4, 0, 1) * Math.exp(-(((u - 0.3) ** 2) / 0.02 + ((v - 0.42) ** 2) / 0.03));
    const neb2 = clamp((n2 - 0.4) * 2.2, 0, 1) * Math.exp(-(((u - 0.74) ** 2) / 0.015 + ((v - 0.58) ** 2) / 0.02));
    const b = band * (0.4 + n * 0.8) * (1 - dust * 0.7);
    const i = (y * W + x) * 4;
    d[i] = clamp(b * 42 + neb1 * 40 + neb2 * 70, 0, 255);
    d[i + 1] = clamp(b * 44 + neb1 * 58 + neb2 * 40, 0, 255);
    d[i + 2] = clamp(b * 52 + neb1 * 84 + neb2 * 34, 0, 255);
    d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  const tex = canvasTex(c, { repeat: false }); tex.wrapS = THREE.RepeatWrapping;
  return tex;
}
