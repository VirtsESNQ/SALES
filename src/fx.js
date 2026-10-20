// Effects: pooled billboard particles (fire, sparks, smoke), camera-facing streaks (bolts, beams,
// missile trails), pooled flash lights, and composite effects (muzzle flash, impact, explosion).
// Everything is instanced; nothing allocates per frame once warmed up.
import * as THREE from 'three';
import { rand } from './core.js';
import { glowTexture } from './textures.js';

const VS_COMMON = `
  #include <common>
  #include <logdepthbuf_pars_vertex>
`;

function smokeTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  for (let i = 0; i < 26; i++) {
    const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, r = 14 + Math.random() * 26;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** Billboard particle pool. Each particle interpolates size and colour over its life. */
class Particles {
  constructor(scene, max, { additive = true, map }) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
    this.a0 = new Float32Array(max); this.drag = new Float32Array(max); this.rot = new Float32Array(max);
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.aOff = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSz = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aOff', this.aOff); geo.setAttribute('aCol', this.aCol); geo.setAttribute('aSz', this.aSz);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map } },
      vertexShader: `${VS_COMMON}
        attribute vec3 aOff; attribute vec4 aCol; attribute vec2 aSz;
        varying vec2 vUv; varying vec4 vCol;
        void main(){
          vUv = position.xy * 0.5 + 0.5; vCol = aCol;
          float c = cos(aSz.y), s = sin(aSz.y);
          vec2 q = vec2(c * position.x - s * position.y, s * position.x + c * position.y) * aSz.x;
          vec4 mv = modelViewMatrix * vec4(aOff, 1.0);
          mv.xy += q;
          gl_Position = projectionMatrix * mv;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D map; varying vec2 vUv; varying vec4 vCol;
        void main(){
          #include <logdepthbuf_fragment>
          vec4 t = texture2D(map, vUv);
          gl_FragColor = vec4(vCol.rgb * t.rgb, vCol.a * t.a);
          ${additive ? 'gl_FragColor.rgb *= gl_FragColor.a;' : ''}
        }`,
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 5 : 4;
    scene.add(this.mesh);
  }
  /** spawn(pos, vel, life, size0, size1, color0 [r,g,b], color1, alpha, drag) */
  spawn(pos, vel, life, s0, s1, c0, c1, a = 1, drag = 0) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.p[i * 3] = pos.x; this.p[i * 3 + 1] = pos.y; this.p[i * 3 + 2] = pos.z;
    if (vel) { this.v[i * 3] = vel.x; this.v[i * 3 + 1] = vel.y; this.v[i * 3 + 2] = vel.z; } else { this.v[i * 3] = this.v[i * 3 + 1] = this.v[i * 3 + 2] = 0; }
    this.life[i] = this.maxLife[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.c0.set(c0, i * 3); this.c1.set(c1, i * 3); this.a0[i] = a; this.drag[i] = drag; this.rot[i] = Math.random() * 6.28;
  }
  update(dt) {
    let i = 0;
    while (i < this.n) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._move(this.n - 1, i); this.n--; continue; }
      const k = Math.exp(-this.drag[i] * dt);
      for (let j = 0; j < 3; j++) { this.v[i * 3 + j] *= k; this.p[i * 3 + j] += this.v[i * 3 + j] * dt; }
      i++;
    }
  }
  _move(from, to) {
    if (from === to) return;
    for (const arr of [this.p, this.v, this.c0, this.c1]) { arr[to * 3] = arr[from * 3]; arr[to * 3 + 1] = arr[from * 3 + 1]; arr[to * 3 + 2] = arr[from * 3 + 2]; }
    for (const arr of [this.life, this.maxLife, this.s0, this.s1, this.a0, this.drag, this.rot]) arr[to] = arr[from];
  }
  upload() {
    const off = this.aOff.array, col = this.aCol.array, sz = this.aSz.array;
    for (let i = 0; i < this.n; i++) {
      const t = 1 - this.life[i] / this.maxLife[i];
      off[i * 3] = this.p[i * 3]; off[i * 3 + 1] = this.p[i * 3 + 1]; off[i * 3 + 2] = this.p[i * 3 + 2];
      for (let j = 0; j < 3; j++) col[i * 4 + j] = this.c0[i * 3 + j] + (this.c1[i * 3 + j] - this.c0[i * 3 + j]) * t;
      col[i * 4 + 3] = this.a0[i] * (1 - t) * Math.min(1, t * 12 + 0.2);
      sz[i * 2] = this.s0[i] + (this.s1[i] - this.s0[i]) * t; sz[i * 2 + 1] = this.rot[i];
    }
    this.geo.instanceCount = this.n;
    this.aOff.needsUpdate = this.aCol.needsUpdate = this.aSz.needsUpdate = true;
  }
  clear() { this.n = 0; }
}

/** Camera-facing streaks between two points (bolts, beams, trails). Immediate mode: push() per frame. */
class Streaks {
  constructor(scene, max) {
    this.max = max; this.n = 0;
    const geo = new THREE.InstancedBufferGeometry();
    // x: 0 = start, 1 = end; y: side -1..1
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.aA = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); // start xyz + width
    this.aB = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); // end xyz + tail fade
    this.aC = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage); // rgba
    geo.setAttribute('aA', this.aA); geo.setAttribute('aB', this.aB); geo.setAttribute('aC', this.aC);
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      vertexShader: `${VS_COMMON}
        attribute vec4 aA; attribute vec4 aB; attribute vec4 aC;
        varying vec4 vC; varying vec2 vP; varying float vTail;
        void main(){
          vec4 a = modelViewMatrix * vec4(aA.xyz, 1.0), b = modelViewMatrix * vec4(aB.xyz, 1.0);
          vec4 p = mix(a, b, position.x);
          vec3 d = normalize(b.xyz - a.xyz + vec3(1e-5));
          vec3 side = normalize(cross(d, normalize(-p.xyz)));
          p.xyz += side * position.y * aA.w;
          vC = aC; vP = position.xy; vTail = aB.w;
          gl_Position = projectionMatrix * p;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <logdepthbuf_pars_fragment>
        varying vec4 vC; varying vec2 vP; varying float vTail;
        void main(){
          #include <logdepthbuf_fragment>
          float across = 1.0 - abs(vP.y);
          float core = pow(across, 3.0);
          float along = mix(1.0, vP.x, vTail);
          float a = (across * 0.6 + core) * along * vC.a;
          vec3 c = mix(vC.rgb, vec3(1.0), core * 0.7);
          gl_FragColor = vec4(c * a, a);
        }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 6;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  /** push(start, end, width, [r,g,b], alpha, tailFade 0..1) */
  push(a, b, w, c, alpha = 1, tail = 1) {
    if (this.n >= this.max) return;
    const i = this.n++;
    this.aA.array.set([a.x, a.y, a.z, w], i * 4);
    this.aB.array.set([b.x, b.y, b.z, tail], i * 4);
    this.aC.array.set([c[0], c[1], c[2], alpha], i * 4);
  }
  end() {
    this.geo.instanceCount = this.n;
    this.aA.needsUpdate = this.aB.needsUpdate = this.aC.needsUpdate = true;
  }
}

/** A few pooled point lights for muzzle flashes and explosions lighting nearby hulls. */
class Flashes {
  constructor(scene, n = 6) {
    this.list = [];
    for (let i = 0; i < n; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 1, 1);
      l.visible = false;
      scene.add(l);
      this.list.push({ l, t: 0, dur: 1, i0: 0 });
    }
  }
  flash(pos, color, intensity, distance, dur) {
    let best = this.list[0];
    for (const f of this.list) if (f.t <= 0 || f.i0 * (f.t / f.dur) < best.i0 * (best.t / best.dur)) { best = f; if (f.t <= 0) break; }
    best.l.position.copy(pos); best.l.color.set(color); best.l.distance = distance;
    best.i0 = intensity; best.t = best.dur = dur; best.l.visible = true;
  }
  update(dt) {
    for (const f of this.list) {
      if (f.t <= 0) continue;
      f.t -= dt;
      const k = Math.max(0, f.t / f.dur);
      f.l.intensity = f.i0 * k * k;
      if (f.t <= 0) { f.l.visible = false; f.l.intensity = 0; }
    }
  }
}

export const COL = {
  fire: [1, 0.75, 0.35], fireEnd: [0.5, 0.12, 0.02], spark: [1, 0.85, 0.5], smoke: [0.32, 0.3, 0.3], smokeEnd: [0.08, 0.08, 0.09],
  concord: [0.6, 0.85, 1], hegemony: [1, 0.55, 0.25],
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _r = new THREE.Vector3();
function rnd(r, out) { do { out.set(rand(-1, 1), rand(-1, 1), rand(-1, 1)); } while (out.lengthSq() > 1); return out.multiplyScalar(r); }

export class FX {
  constructor(scene) {
    const glow = glowTexture();
    this.add = new Particles(scene, 9000, { additive: true, map: glow });
    this.smoke = new Particles(scene, 3000, { additive: false, map: smokeTexture() });
    this.streaks = new Streaks(scene, 4000);
    this.lights = new Flashes(scene, 6);
    this.persistent = []; // streak producers that live for several frames (beams): { update(dt, streaks) -> alive }
  }
  muzzle(pos, dir, size, color, vel) {
    this.add.spawn(pos, vel, 0.12, size * 0.6, size * 1.6, [1, 1, 1], color, 1.2, 0);
    for (let i = 0; i < 4; i++) {
      _a.copy(dir).multiplyScalar(size * (2 + i * 1.5));
      if (vel) _a.add(vel);
      this.add.spawn(pos, _a, 0.18 + i * 0.05, size * 0.5, size * 0.1, color, [0.2, 0.1, 0], 0.8, 2);
    }
  }
  impact(pos, normal, size, color, vel) {
    this.add.spawn(pos, vel, 0.25, size * 0.4, size * 1.4, [1, 1, 1], color, 1, 0);
    for (let i = 0; i < 6; i++) {
      rnd(1, _a).add(normal).normalize().multiplyScalar(size * rand(2, 6));
      if (vel) _a.add(vel);
      this.add.spawn(pos, _a, rand(0.3, 0.8), size * 0.12, size * 0.02, COL.spark, [0.6, 0.2, 0], 1, 1.5);
    }
  }
  /** opts: { smoke, debris, ring } */
  explosion(pos, size, vel, opts = {}) {
    const v = vel || _r.set(0, 0, 0);
    this.add.spawn(pos, v, 0.35, size * 0.5, size * 2.2, [1, 1, 0.9], [1, 0.6, 0.2], 1.4, 0);
    const n = Math.min(14, 5 + Math.floor(size / 30));
    for (let i = 0; i < n; i++) {
      rnd(size * 0.5, _a); _b.copy(_a).multiplyScalar(rand(0.6, 1.6)).add(v);
      this.add.spawn(_a.add(pos), _b, rand(0.6, 1.5), size * rand(0.3, 0.6), size * rand(0.9, 1.6), COL.fire, COL.fireEnd, 0.9, 0.6);
    }
    for (let i = 0; i < n; i++) {
      rnd(1, _a).multiplyScalar(size * rand(3, 8)).add(v);
      this.add.spawn(pos, _a, rand(0.6, 1.6), size * 0.05 + 2, 1, COL.spark, [0.7, 0.2, 0], 1, 0.4);
    }
    if (opts.smoke !== false) for (let i = 0; i < Math.ceil(n / 2); i++) {
      rnd(size * 0.4, _a); _b.copy(_a).multiplyScalar(0.3).add(v);
      this.smoke.spawn(_a.add(pos), _b, rand(2.5, 5), size * 0.6, size * 2.2, COL.smoke, COL.smokeEnd, 0.5, 0.15);
    }
    if (opts.debris) for (let i = 0; i < opts.debris * 6; i++) {
      rnd(1, _a).multiplyScalar(size * rand(0.8, 2.5)).add(v);
      this.add.spawn(pos, _a, rand(2, 5), size * 0.06 + 3, size * 0.03, [0.9, 0.5, 0.2], [0.15, 0.05, 0.02], 0.9, 0.05);
    }
    if (opts.ring) {
      const q = opts.ringQ;
      for (let i = 0; i < 48; i++) {
        const ang = (i / 48) * Math.PI * 2;
        _a.set(Math.cos(ang), 0, Math.sin(ang));
        if (q) _a.applyQuaternion(q);
        _a.multiplyScalar(size * 3.5).add(v);
        this.add.spawn(pos, _a, 2.4, size * 0.4, size * 1.2, [1, 0.85, 0.6], [0.4, 0.1, 0.02], 0.8, 0.3);
      }
    }
  }
  /** Register a multi-frame streak producer (beams, charge-ups). */
  addPersistent(p) { this.persistent.push(p); }
  update(dt) {
    this.add.update(dt); this.smoke.update(dt); this.lights.update(dt);
  }
  /** Called once per rendered frame, after weapons have pushed their streaks. */
  render(dt) {
    for (let i = this.persistent.length - 1; i >= 0; i--) if (!this.persistent[i].update(dt, this.streaks)) this.persistent.splice(i, 1);
    this.streaks.end();
    this.add.upload(); this.smoke.upload();
  }
  clear() { this.add.clear(); this.smoke.clear(); this.persistent.length = 0; this.streaks.begin(); }
}
