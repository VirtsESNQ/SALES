// Procedural WebAudio sound (ported from v1 and extended). Nothing is downloaded.
// Space is silent: weapon and impact sounds are what the crew hears through the hull.
import { settings, bus, clamp } from './core.js';

class Sound {
  constructor() { this.ctx = null; this.master = null; this.last = {}; this.muted = false; }
  /** Must run inside a user gesture (browsers block audio before one). */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = settings.volume;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 4; comp.attack.value = 0.005; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate * 2;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = c.createBuffer(1, len, c.sampleRate);
    const e = this.brown.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = (b + 0.02 * (Math.random() * 2 - 1)) / 1.02; e[i] = b * 3.5; }
    this.startAmbience();
    bus.on('settings', () => this.setVolume(settings.volume));
  }
  setVolume(v) { if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  ok(key, gap) {
    if (!this.ctx || this.muted) return false;
    const t = this.ctx.currentTime;
    if (this.last[key] && t - this.last[key] < gap) return false;
    this.last[key] = t;
    return true;
  }
  src(buf, loop = false) { const s = this.ctx.createBufferSource(); s.buffer = buf; s.loop = loop; return s; }
  env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  osc(type, f0, f1, t, dur, peak, a = 0.003, filt = null) {
    const c = this.ctx, o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); this.env(g, t, a, peak, dur);
    let node = o;
    if (filt) { const f = c.createBiquadFilter(); f.type = filt.type; f.frequency.value = filt.f; if (filt.q) f.Q.value = filt.q; o.connect(f); node = f; }
    node.connect(g); g.connect(this.master); o.start(t); o.stop(t + a + dur + 0.05);
  }
  burst(buf, t, dur, peak, type, f0, f1 = f0, q = 1) {
    const c = this.ctx, n = this.src(buf), f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); if (f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain(); this.env(g, t, 0.003, peak, dur);
    n.connect(f); f.connect(g); g.connect(this.master); n.start(t); n.stop(t + dur + 0.1);
  }

  startAmbience() {
    const c = this.ctx;
    // engine hum: low saw + sine + rumble through a lowpass that follows the throttle
    this.hum = c.createGain(); this.hum.gain.value = 0; this.hum.connect(this.master);
    this.humF = c.createBiquadFilter(); this.humF.type = 'lowpass'; this.humF.frequency.value = 120; this.humF.Q.value = 2; this.humF.connect(this.hum);
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 31; o1.connect(this.humF); o1.start();
    const o2 = c.createOscillator(); o2.frequency.value = 46.5; const g2 = c.createGain(); g2.gain.value = 0.6; o2.connect(g2); g2.connect(this.humF); o2.start();
    const rumble = this.src(this.brown, true), rf = c.createBiquadFilter(); rf.type = 'lowpass'; rf.frequency.value = 90;
    const rg = c.createGain(); rg.gain.value = 0.5; rumble.connect(rf); rf.connect(rg); rg.connect(this.humF); rumble.start();
    this.o1 = o1;
    // bridge ambience: faint air handling and an equipment tone
    const air = this.src(this.noise, true), af = c.createBiquadFilter(); af.type = 'bandpass'; af.frequency.value = 420; af.Q.value = 0.6;
    const ag = c.createGain(); ag.gain.value = 0.012; air.connect(af); af.connect(ag); ag.connect(this.master); air.start();
    const tone = c.createOscillator(); tone.frequency.value = 3150; const tg = c.createGain(); tg.gain.value = 0.0012; tone.connect(tg); tg.connect(this.master); tone.start();
    this.pingTimer = 4;
  }
  /** Per-frame: engine hum follows the player's throttle. */
  update(dt, throttle = 0, boost = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.hum.gain.setTargetAtTime(this.muted ? 0 : 0.16 + Math.abs(throttle) * 0.22 + (boost ? 0.12 : 0), t, 0.6);
    this.humF.frequency.setTargetAtTime(90 + Math.abs(throttle) * 140 + (boost ? 160 : 0), t, 0.8);
    this.o1.frequency.setTargetAtTime(29 + Math.abs(throttle) * 6 + (boost ? 5 : 0), t, 1.2);
    this.pingTimer -= dt;
    if (this.pingTimer <= 0) { this.pingTimer = 9 + Math.random() * 4; this.sonar(); }
  }
  sonar() {
    if (!this.ok('sonar', 2)) return;
    const c = this.ctx, t = c.currentTime, o = c.createOscillator(); o.frequency.value = 1240;
    const g = c.createGain(); this.env(g, t, 0.01, 0.025, 1.6);
    const d = c.createDelay(); d.delayTime.value = 0.32; const fb = c.createGain(); fb.gain.value = 0.3; d.connect(fb); fb.connect(d);
    o.connect(g); g.connect(this.master); g.connect(d); d.connect(this.master); o.start(t); o.stop(t + 2.4);
  }

  /* ---- UI: every control clicks, levers thunk into detents, switches clack ---- */
  click() { if (!this.ok('click', 0.03)) return; this.osc('square', 2400, 2400, this.ctx.currentTime, 0.03, 0.025, 0.001); }
  press() {
    if (!this.ok('press', 0.04)) return; const t = this.ctx.currentTime;
    this.osc('square', 1800, 900, t, 0.04, 0.03, 0.001, { type: 'lowpass', f: 3000 });
    this.burst(this.noise, t, 0.03, 0.03, 'bandpass', 3200, 3200, 4);
  }
  detent() {
    if (!this.ok('detent', 0.05)) return; const t = this.ctx.currentTime;
    this.osc('sine', 180, 70, t, 0.12, 0.22, 0.002);
    this.burst(this.noise, t, 0.05, 0.08, 'bandpass', 1400, 600, 3);
  }
  switch() {
    if (!this.ok('switch', 0.05)) return; const t = this.ctx.currentTime;
    this.burst(this.noise, t, 0.025, 0.12, 'highpass', 2500);
    this.osc('square', 520, 260, t + 0.01, 0.05, 0.05, 0.001, { type: 'lowpass', f: 1600 });
  }
  wheel() { if (!this.ok('wheel', 0.07)) return; this.burst(this.noise, this.ctx.currentTime, 0.03, 0.025, 'bandpass', 900, 900, 6); }

  /* ---- weapons (v = 0..1 loudness by distance) ---- */
  heavy(v = 1) {
    if (!this.ok('heavy', 0.07)) return; const t = this.ctx.currentTime;
    this.osc('sine', 110, 28, t, 0.9, 0.7 * v, 0.005);
    this.burst(this.noise, t, 0.6, 0.5 * v, 'lowpass', 1800, 120);
    this.osc('sawtooth', 700, 90, t, 0.25, 0.12 * v, 0.003, { type: 'lowpass', f: 1600 });
  }
  laser(v = 1) { if (!this.ok('laser', 0.05)) return; this.osc('square', 1300, 260, this.ctx.currentTime, 0.14, 0.07 * v, 0.003, { type: 'lowpass', f: 2400 }); }
  pd(v = 1) { if (!this.ok('pd', 0.09)) return; this.burst(this.noise, this.ctx.currentTime, 0.05, 0.08 * v, 'bandpass', 1900, 1900, 3); }
  flak(v = 1) {
    if (!this.ok('flak', 0.12)) return; const t = this.ctx.currentTime;
    this.burst(this.brown, t, 0.25, 0.25 * v, 'lowpass', 900, 200);
    this.osc('sine', 90, 50, t, 0.15, 0.15 * v);
  }
  plasma(v = 1) {
    if (!this.ok('plasma', 0.1)) return; const t = this.ctx.currentTime;
    this.osc('sawtooth', 70, 30, t, 1.1, 0.6 * v, 0.02, { type: 'lowpass', f: 700 });
    this.osc('sine', 240, 1600, t, 0.3, 0.05 * v, 0.01);
  }
  ion(v = 1) {
    if (!this.ok('ion', 0.1)) return; const t = this.ctx.currentTime;
    this.osc('triangle', 900, 120, t, 0.5, 0.18 * v, 0.004);
    this.osc('sine', 3000, 600, t, 0.3, 0.04 * v, 0.004);
  }
  massDriver(v = 1) {
    if (!this.ok('mdr', 0.1)) return; const t = this.ctx.currentTime;
    this.burst(this.noise, t, 0.08, 0.4 * v, 'highpass', 3000);
    this.osc('sine', 160, 24, t, 1.2, 0.8 * v, 0.002);
    this.osc('sawtooth', 2200, 300, t, 0.2, 0.06 * v, 0.002, { type: 'lowpass', f: 4000 });
  }
  missile(v = 1) {
    if (!this.ok('missile', 0.08)) return; const t = this.ctx.currentTime;
    this.burst(this.noise, t, 1.0, 0.22 * v, 'bandpass', 300, 2600, 1.2);
    this.osc('sine', 90, 40, t, 0.2, 0.3 * v);
  }
  mine(v = 1) {
    if (!this.ok('mine', 0.3)) return; const t = this.ctx.currentTime;
    this.osc('sine', 60, 30, t, 0.8, 0.3 * v, 0.05);
    this.osc('triangle', 300, 150, t, 0.4, 0.05 * v, 0.02);
  }
  explosion(size = 1, v = 1) {
    if (!this.ok(`expl${size > 2 ? 'L' : 'S'}`, size > 2 ? 0.2 : 0.06)) return; const t = this.ctx.currentTime;
    const dur = 0.8 + size * 0.7;
    this.burst(this.brown, t, dur, Math.min(1.2, 0.35 * v * (0.6 + size * 0.4)), 'lowpass', 600 + size * 200, 40);
    this.osc('sine', 60, 18, t, dur * 0.8, 0.5 * v * Math.min(1, size / 3), 0.01);
  }
  shieldHit(v = 1) {
    if (!this.ok('shield', 0.06)) return; const t = this.ctx.currentTime;
    this.burst(this.noise, t, 0.35, 0.12 * v, 'highpass', 900);
    this.osc('triangle', 380, 140, t, 0.5, 0.12 * v, 0.005);
  }
  hullHit(v = 1) {
    if (!this.ok('hull', 0.08)) return; const t = this.ctx.currentTime;
    this.osc('square', 140, 40, t, 0.5, 0.35 * v, 0.003, { type: 'lowpass', f: 500 });
    this.osc('sine', 523 + Math.random() * 80, null, t, 1.2, 0.05 * v, 0.002);
  }
  charge(dur, v = 1) {
    if (!this.ok('charge', 0.5)) return; const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(40, t); o.frequency.exponentialRampToValueAtTime(420, t + dur);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(3000, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * v, t + dur); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);
    o.connect(f); f.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.1);
  }
  beam(v = 1) {
    if (!this.ok('beam', 0.5)) return; const t = this.ctx.currentTime;
    this.osc('sawtooth', 55, 25, t, 2, 0.9 * v, 0.01, { type: 'lowpass', f: 1200 });
    this.osc('square', 82.5, 82.5, t, 2, 0.2 * v, 0.01, { type: 'lowpass', f: 600 });
    this.explosion(2.5, v * 0.7);
  }
  alarm(kind = 'warn') {
    if (!this.ok(`alarm${kind}`, kind === 'crit' ? 2.5 : 1.6)) return; const t = this.ctx.currentTime;
    const seq = kind === 'crit' ? [880, 660, 880, 660] : kind === 'missile' ? [1320, 0, 1320, 0, 1320] : [740, 554];
    seq.forEach((fq, i) => {
      if (!fq) return;
      const st = t + i * (kind === 'missile' ? 0.09 : 0.2);
      this.osc('square', fq, fq, st, kind === 'missile' ? 0.07 : 0.17, 0.045, 0.005, { type: 'lowpass', f: 2000 });
    });
  }
  radio() {
    if (!this.ok('radio', 0.25)) return; const t = this.ctx.currentTime;
    this.burst(this.noise, t, 0.12, 0.05, 'bandpass', 2200, 2200, 2);
    this.osc('sine', 1760, 1760, t + 0.02, 0.06, 0.025, 0.002);
  }
  jump() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.burst(this.noise, t, 1.6, 0.3, 'bandpass', 3000, 60, 2);
    this.osc('sine', 30, 30, t + 0.3, 1.5, 0.6, 0.02);
  }
}

export const audio = new Sound();
/** Loudness for a world event heard from the listener position (0..1). */
export function falloff(dist, ref = 8000) { return clamp(1 - dist / (ref * 4), 0, 1) ** 2; }
// first user gesture unlocks audio
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => audio.init(), { once: false, capture: true });
