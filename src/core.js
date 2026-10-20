// Core: renderer, scene, main loop, time, mouse-first input, event bus, settings.
import * as THREE from 'three';

const params = new URLSearchParams(location.search);
// Test hook is only ever active with ?test=1 (headless tests fast-forward through it).
export const TEST = params.get('test') === '1';
export const QUERY = params;

/* ---------------- event bus ---------------- */
export class Bus {
  constructor() { this.map = new Map(); }
  on(type, fn) {
    if (!this.map.has(type)) this.map.set(type, new Set());
    this.map.get(type).add(fn);
    return () => this.off(type, fn);
  }
  off(type, fn) { this.map.get(type)?.delete(fn); }
  emit(type, data) {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(data); } catch (e) { console.error(`[bus:${type}]`, e); }
    }
  }
}
export const bus = new Bus();

/* ---------------- settings ---------------- */
const SETTINGS_KEY = 'halberd.v2.settings';
export const DEFAULT_KEYS = {
  throttleUp: 'KeyW', throttleDown: 'KeyS', yawLeft: 'KeyA', yawRight: 'KeyD',
  rollLeft: 'KeyQ', rollRight: 'KeyE', thrustUp: 'KeyR', thrustDown: 'KeyF',
  boost: 'ShiftLeft', slowdown: 'KeyX', cycleTarget: 'Tab', fireSecondary: 'Space',
  shieldFore: 'ArrowUp', shieldAft: 'ArrowDown', shieldPort: 'ArrowLeft', shieldStbd: 'ArrowRight',
  fighters: 'KeyG', launch: 'KeyH', camera: 'KeyV', pause: 'Escape',
};
const DEFAULT_SETTINGS = {
  difficulty: 'captain',   // cadet | captain | admiral
  shake: 0.35,             // 0..1 camera-shake strength
  shakeOn: true,
  volume: 0.7,
  mouseSteer: false,
  hints: true,
  lastSide: null,
  lastShip: null,
  keys: { ...DEFAULT_KEYS },
};
function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; } catch { saved = {}; }
  return { ...DEFAULT_SETTINGS, ...saved, keys: { ...DEFAULT_KEYS, ...(saved.keys || {}) } };
}
export const settings = loadSettings();
export function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* storage unavailable */ }
  bus.emit('settings', settings);
}
export function resetKeys() { settings.keys = { ...DEFAULT_KEYS }; saveSettings(); }

/* ---------------- input (mouse first, keyboard optional) ---------------- */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.mouse = { x: 0, y: 0, nx: 0, ny: 0, dx: 0, dy: 0, wheel: 0, buttons: 0, overCanvas: false };
    this.down = new Set();     // physical key codes held
    this.pressed = new Set();  // key codes pressed this frame
    this.enabled = true;

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('pointermove', (e) => {
      const m = this.mouse;
      m.dx += e.movementX || 0; m.dy += e.movementY || 0;
      m.x = e.clientX; m.y = e.clientY;
      m.nx = (e.clientX / innerWidth) * 2 - 1;
      m.ny = -(e.clientY / innerHeight) * 2 + 1;
      m.overCanvas = e.target === canvas;
    });
    canvas.addEventListener('pointerdown', (e) => {
      this.mouse.buttons = e.buttons;
      bus.emit('pointerdown', { button: e.button, x: e.clientX, y: e.clientY, event: e });
    });
    window.addEventListener('pointerup', (e) => {
      this.mouse.buttons = e.buttons;
      bus.emit('pointerup', { button: e.button, x: e.clientX, y: e.clientY, event: e });
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.mouse.wheel += Math.sign(e.deltaY);
      bus.emit('wheel', { dir: Math.sign(e.deltaY) });
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (!this.enabled || e.target?.tagName === 'INPUT') return;
      if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      bus.emit('key', { code: e.code, action: this.actionFor(e.code) });
    });
    window.addEventListener('keyup', (e) => this.down.delete(e.code));
    window.addEventListener('blur', () => { this.down.clear(); this.mouse.buttons = 0; });
  }
  actionFor(code) {
    for (const [action, key] of Object.entries(settings.keys)) if (key === code) return action;
    return null;
  }
  held(action) { return this.enabled && this.down.has(settings.keys[action]); }
  get lmb() { return (this.mouse.buttons & 1) !== 0; }
  get rmb() { return (this.mouse.buttons & 2) !== 0; }
  endFrame() {
    this.mouse.dx = 0; this.mouse.dy = 0; this.mouse.wheel = 0;
    this.pressed.clear();
  }
}

/* ---------------- engine ---------------- */
export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x020305);
    // World units are metres. The far plane is long so ships 60 km away still render.
    this.camera = new THREE.PerspectiveCamera(55, 1, 2, 4e6);
    this.input = new Input(canvas);
    this.systems = [];
    this.time = { sim: 0, real: 0, scale: 1, paused: false, frame: 0 };
    this.fps = 60;
    this._last = 0;
    this._running = false;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    bus.emit('resize', { w, h });
  }
  /** A system is any object with update(dt, time) and optional render(dt) / reset(). */
  add(system) { this.systems.push(system); return system; }
  /** Advance the simulation by dt seconds (game time). */
  step(dt) {
    if (this.time.paused) return;
    dt *= this.time.scale;
    this.time.sim += dt;
    for (const s of this.systems) s.update?.(dt, this.time);
    bus.emit('tick', dt);
  }
  render(dt) {
    for (const s of this.systems) s.render?.(dt, this.time);
    this.renderer.render(this.scene, this.camera);
  }
  frame(now) {
    if (!this._running) return;
    requestAnimationFrame((t) => this.frame(t));
    const realDt = this._last ? Math.min((now - this._last) / 1000, 0.25) : 1 / 60;
    this._last = now;
    this.time.real += realDt;
    this.time.frame++;
    this.fps += ((1 / Math.max(realDt, 1e-3)) - this.fps) * 0.05;
    // Clamp the sim step so a stalled tab doesn't teleport 3 km ships.
    const dt = Math.min(realDt, 1 / 20);
    try {
      this.step(dt);
      this.render(realDt);
    } catch (e) {
      console.error(e);
      this._running = false;
      bus.emit('fatal', e);
    }
    this.input.endFrame();
  }
  start() {
    if (this._running) return;
    this._running = true;
    this._last = 0;
    requestAnimationFrame((t) => this.frame(t));
  }
  stop() { this._running = false; }
}

/* ---------------- small maths helpers ---------------- */
export const DEG = Math.PI / 180;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export function fmtKm(m) { return m >= 1000 ? `${(m / 1000).toFixed(m >= 10000 ? 1 : 2)} km` : `${Math.round(m)} m`; }
export function fmtTime(s) { s = Math.max(0, Math.floor(s)); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }
/** Seeded PRNG (mulberry32) so procedural models are stable between runs. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
