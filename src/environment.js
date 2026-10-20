// Battlefield environment: sky (nebula + milky way), starfield, sun, gas giant with rings and
// atmosphere rim, moon, asteroid belts, drifting derelicts, and near-camera dust for motion cues.
import * as THREE from 'three';
import { rng } from './core.js';
import { nebulaTexture, gasGiantTexture, ringTexture, moonTexture, glowTexture } from './textures.js';
import { getDesign } from './models.js';

export const SUN_DIR = new THREE.Vector3(0.55, 0.42, -0.72).normalize();

function rimMaterial(color, power = 3.2, strength = 1.4) {
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uStrength: { value: strength }, uSun: { value: SUN_DIR.clone() } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      varying vec3 vN; varying vec3 vV; varying vec3 vWN;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        vWN = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <logdepthbuf_pars_fragment>
      uniform vec3 uColor; uniform float uPower; uniform float uStrength; uniform vec3 uSun;
      varying vec3 vN; varying vec3 vV; varying vec3 vWN;
      void main(){
        #include <logdepthbuf_fragment>
        float f = pow(1.0 - max(dot(vN, vV), 0.0), uPower);
        float lit = smoothstep(-0.35, 0.6, dot(vWN, uSun));
        gl_FragColor = vec4(uColor * f * uStrength * (0.15 + lit), f * (0.2 + lit));
      }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.FrontSide,
  });
}

function rock(r, seed) {
  const g = new THREE.IcosahedronGeometry(r, 1);
  const p = g.attributes.position, rr = rng(seed), v = new THREE.Vector3();
  const offs = new Map();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const key = `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
    if (!offs.has(key)) offs.set(key, 0.72 + rr() * 0.5);
    v.multiplyScalar(offs.get(key));
    p.setXYZ(i, v.x, v.y * 0.8, v.z);
  }
  g.computeVertexNormals();
  return g;
}

/** Small procedural equirect sky for image-based lighting: cool gradient, sun hotspot, planet glow. */
function envMap(renderer) {
  const W = 256, H = 128, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d'), id = g.createImageData(W, H), d = id.data, v = new THREE.Vector3();
  const planetDir = new THREE.Vector3(-520, -140, 980).normalize();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, w = y / H, phi = u * Math.PI * 2, th = w * Math.PI;
    v.set(-Math.cos(phi) * Math.sin(th), Math.cos(th), Math.sin(phi) * Math.sin(th));
    const up = v.y * 0.5 + 0.5;
    const sun = Math.pow(Math.max(0, v.dot(SUN_DIR)), 24) * 4 + Math.pow(Math.max(0, v.dot(SUN_DIR)), 3) * 0.35;
    const pl = Math.pow(Math.max(0, v.dot(planetDir)), 6) * 0.35;
    const i = (y * W + x) * 4;
    d[i] = Math.min(255, (14 + up * 26 + sun * 255 + pl * 120));
    d[i + 1] = Math.min(255, (17 + up * 30 + sun * 240 + pl * 140));
    d[i + 2] = Math.min(255, (22 + up * 40 + sun * 220 + pl * 170));
    d[i + 3] = 255;
  }
  g.putImageData(id, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromEquirectangular(tex);
  pm.dispose(); tex.dispose();
  return rt.texture;
}

export class Environment {
  constructor(scene, renderer) {
    this.scene = scene;
    if (renderer) { scene.environment = envMap(renderer); scene.environmentIntensity = 0.9; }
    this.group = new THREE.Group();
    scene.add(this.group);
    this.followers = new THREE.Group(); // things that stay centred on the camera (sky, stars)
    scene.add(this.followers);

    // sky sphere
    const sky = new THREE.Mesh(new THREE.SphereGeometry(3.0e6, 48, 24), new THREE.MeshBasicMaterial({ map: nebulaTexture(), side: THREE.BackSide, depthWrite: false, toneMapped: false }));
    sky.renderOrder = -10;
    this.followers.add(sky);

    // stars: many faint + few bright, coloured by temperature
    const r = rng(77);
    const mkStars = (n, size, bright) => {
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
        // concentrate some stars toward the galactic band
        const band = r() < 0.4 ? (r() - 0.5) * 0.35 : u;
        const uu = band, ss = Math.sqrt(1 - uu * uu);
        const R = 2.6e6;
        pos[i * 3] = Math.cos(th) * ss * R; pos[i * 3 + 1] = uu * R; pos[i * 3 + 2] = Math.sin(th) * ss * R;
        void s;
        const t = r();
        c.setHSL(t < 0.3 ? 0.6 : t < 0.8 ? 0.12 : 0.05, t < 0.8 ? 0.25 : 0.6, (0.55 + r() * 0.45) * bright);
        col.set([c.r, c.g, c.b], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const pts = new THREE.Points(g, new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthWrite: false, transparent: true, toneMapped: false }));
      pts.renderOrder = -9;
      this.followers.add(pts);
    };
    mkStars(9000, 1.3, 0.8);
    mkStars(900, 2.4, 1.0);
    this.followers.rotation.set(0.4, 0.2, 0.15);

    // sun disc glow (in the follower frame, so it stays at infinity)
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,250,240,1)', 'rgba(255,220,170,0.18)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    this.sunSprite = sun;
    sun.scale.setScalar(4.2e5);
    scene.add(sun);

    // lights
    const key = new THREE.DirectionalLight(0xfff1de, 3.0);
    key.position.copy(SUN_DIR).multiplyScalar(1e5);
    scene.add(key, key.target);
    this.sun = key;
    scene.add(new THREE.HemisphereLight(0x6d7f96, 0x3a2a22, 0.6));
    const fill = new THREE.DirectionalLight(0x7f96b8, 0.7); // planet-shine from the opposite side
    fill.position.set(-0.6, -0.3, 0.7).multiplyScalar(1e5);
    scene.add(fill, fill.target);

    // gas giant with rings and an atmosphere rim
    const planet = new THREE.Group();
    planet.position.set(-520e3, -140e3, 980e3);
    const pr = 300e3;
    const body = new THREE.Mesh(new THREE.SphereGeometry(pr, 96, 64), new THREE.MeshStandardMaterial({ map: gasGiantTexture(), roughness: 1, metalness: 0 }));
    body.rotation.set(0.1, 0.4, 0.22);
    planet.add(body);
    planet.add(new THREE.Mesh(new THREE.SphereGeometry(pr * 1.025, 96, 64), rimMaterial(0x9ab8e8, 2.6, 1.6)));
    const ringGeo = new THREE.RingGeometry(pr * 1.35, pr * 2.3, 160, 1);
    const ruv = ringGeo.attributes.uv, rp = ringGeo.attributes.position, tv = new THREE.Vector3();
    for (let i = 0; i < ruv.count; i++) { tv.fromBufferAttribute(rp, i); ruv.setXY(i, (tv.length() - pr * 1.35) / (pr * 0.95), 0.5); }
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ map: ringTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: 0.9 }));
    ring.rotation.set(Math.PI / 2 - 0.32, 0.12, 0);
    planet.add(ring);
    this.planet = planet;
    this.group.add(planet);

    const moon = new THREE.Mesh(new THREE.SphereGeometry(52e3, 64, 48), new THREE.MeshStandardMaterial({ map: moonTexture(), roughness: 1, metalness: 0 }));
    moon.position.set(260e3, 70e3, 640e3);
    this.group.add(moon);

    // asteroid belts flanking the battle space (gives parallax and scale)
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x5a5450, roughness: 0.95, metalness: 0.05, flatShading: true });
    const belts = [
      { n: 260, cx: -26000, cy: -3000, cz: 6000, sx: 10000, sy: 4000, sz: 40000, rmin: 30, rmax: 420 },
      { n: 120, cx: 30000, cy: 4000, cz: 22000, sx: 12000, sy: 6000, sz: 26000, rmin: 40, rmax: 600 },
    ];
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.rocks = [];
    let seed = 5;
    for (const b of belts) {
      for (const geoSeed of [1, 2, 3]) {
        const n = Math.floor(b.n / 3);
        const im = new THREE.InstancedMesh(rock(1, seed++ * 31 + geoSeed), rockMat, n);
        for (let i = 0; i < n; i++) {
          const rad = b.rmin + Math.pow(r(), 3) * (b.rmax - b.rmin);
          p.set(b.cx + (r() - 0.5) * b.sx, b.cy + (r() - 0.5) * b.sy, b.cz + (r() - 0.5) * b.sz);
          q.setFromEuler(e.set(r() * 6, r() * 6, r() * 6));
          s.set(rad, rad * (0.6 + r() * 0.5), rad * (0.7 + r() * 0.6));
          im.setMatrixAt(i, m4.compose(p, q, s));
        }
        im.computeBoundingSphere();
        this.group.add(im);
        this.rocks.push(im);
      }
    }
    // a few huge rocks
    for (let i = 0; i < 4; i++) {
      const big = new THREE.Mesh(rock(1, 900 + i), rockMat);
      big.scale.set(1800 + i * 500, 1300 + i * 300, 1600 + i * 400);
      big.position.set(-22000 - i * 7000, -6000 + i * 2500, -8000 + i * 16000);
      big.rotation.set(i, i * 2, 0);
      this.group.add(big);
    }

    // derelicts: broken halves of old warships, burnt and drifting
    this.derelicts = [];
    const wreckMat = new THREE.MeshStandardMaterial({ color: 0x3d3835, roughness: 0.95, metalness: 0.15, emissive: 0x1a0700 });
    const wreck = (cls, half, pos, rot, scale = 1) => {
      const d = getDesign(cls), grp = d.parts[half] || d.parts.fore, o = new THREE.Group();
      for (const m of grp.children) if (m.userData.matKey !== 'lights') o.add(new THREE.Mesh(m.geometry, m.userData.matKey === 'void' ? m.material : wreckMat));
      o.position.copy(pos); o.rotation.copy(rot); o.scale.setScalar(scale);
      o.userData.spin = new THREE.Vector3((r() - 0.5) * 0.004, (r() - 0.5) * 0.004, (r() - 0.5) * 0.004);
      this.group.add(o); this.derelicts.push(o);
    };
    wreck('rampart', 'fore', new THREE.Vector3(-9000, -2200, 4000), new THREE.Euler(0.4, 1.1, 0.9));
    wreck('rampart', 'aft', new THREE.Vector3(-10200, -1500, 2600), new THREE.Euler(-0.3, 2.2, -0.5));
    wreck('kesh', 'fore', new THREE.Vector3(11000, 2600, 15000), new THREE.Euler(0.8, -0.6, 1.4));
    wreck('kesh', 'aft', new THREE.Vector3(12500, 1800, 13200), new THREE.Euler(-1.1, 0.4, 0.2));

    // near-camera dust (wraps in a box around the camera, shows motion)
    const DUST = 1400, BOX = 3000;
    const dpos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST * 3; i++) dpos[i] = (r() - 0.5) * BOX;
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
    this.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0x9aa4ad, size: 2.2, sizeAttenuation: true, transparent: true, opacity: 0.55, depthWrite: false }));
    this.dust.frustumCulled = false;
    this.dustBox = BOX;
    scene.add(this.dust);
  }

  update(dt, camera) {
    this.followers.position.copy(camera.position);
    this.sunSprite.position.copy(camera.position).addScaledVector(SUN_DIR, 2.4e6);
    for (const o of this.derelicts) { o.rotation.x += o.userData.spin.x * dt; o.rotation.y += o.userData.spin.y * dt; o.rotation.z += o.userData.spin.z * dt; }
    // wrap dust around the camera
    const p = this.dust.geometry.attributes.position, B = this.dustBox, h = B / 2, c = camera.position;
    const a = p.array;
    for (let i = 0; i < a.length; i += 3) {
      for (let k = 0; k < 3; k++) {
        const cc = k === 0 ? c.x : k === 1 ? c.y : c.z;
        let v = a[i + k] - cc;
        if (v > h) a[i + k] -= B; else if (v < -h) a[i + k] += B;
      }
    }
    p.needsUpdate = true;
  }
}
