// On-screen control card (mouse-first, tactile): throttle lever with detents, boost switch,
// ship's wheel (rudder), dive planes, autopilot, three-position mode switch, look/steer switch.
// Keyboard is optional and rebindable (settings.keys); nothing requires it.
import * as THREE from 'three';
import { bus, settings, saveSettings, clamp, DEG } from './core.js';
import { DETENTS } from './ships.js';
import { MODES } from './game.js';
import { audio } from './audio.js';

const h = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };

/** Press-in animation, glow and click sound for any control. */
export function tactile(el, sound = 'press') {
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    el.classList.add('pressed');
    audio[sound]?.();
  });
  const up = () => el.classList.remove('pressed');
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  return el;
}

export class Controls {
  constructor(game, ui) {
    this.game = game;
    this.rudder = 0;  // -1 port .. +1 starboard (stays where set, like a real rudder)
    this.planes = 0;  // -1 dive .. +1 climb
    this.keyYaw = 0;
    this.root = h('div', 'card ctl-card');
    this.root.innerHTML = `
      <div class="ctl-sec ctl-throttle">
        <div class="ctl-h">Throttle</div>
        <div class="thr">
          <div class="thr-labels">${DETENTS.map((d, i) => `<button class="thr-l" data-i="${i}">${d.label}</button>`).slice().reverse().join('')}</div>
          <div class="thr-track"><div class="thr-slot"></div>${DETENTS.map((_, i) => `<i class="thr-tick" style="bottom:${(i / (DETENTS.length - 1)) * 100}%"></i>`).join('')}<div class="thr-handle"><span></span></div></div>
        </div>
        <button class="sw sw-boost" title="Boost: overheats if held too long"><span class="sw-lever"></span><b>BOOST</b></button>
        <div class="heat"><i></i></div>
      </div>
      <div class="ctl-sec ctl-helm">
        <div class="ctl-h">Helm</div>
        <div class="helm-row">
          <div class="wheel" title="Drag to turn the wheel. Double-click to centre.">
            <svg viewBox="-60 -60 120 120"><circle r="50" class="w-rim"/><circle r="12" class="w-hub"/>
            ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<line class="w-spoke" x1="0" y1="0" x2="${Math.sin(a * DEG) * 58}" y2="${-Math.cos(a * DEG) * 58}"/>`).join('')}
            <circle r="4" cy="-50" class="w-mark"/></svg>
          </div>
          <div class="planes" title="Dive planes: drag up to climb, down to dive"><div class="pl-track"><i class="pl-zero"></i><div class="pl-handle"></div></div><small>PLANES</small></div>
        </div>
        <div class="helm-read"><span class="rud">RUDDER 0°</span><button class="btn btn-center">CENTRE</button></div>
      </div>
      <div class="ctl-sec ctl-auto">
        <div class="ctl-h">Autopilot</div>
        <button class="btn lamp" data-ap="hold"><i></i>HOLD HEADING</button>
        <button class="btn lamp" data-ap="level"><i></i>AUTO-LEVEL</button>
        <button class="btn lamp" data-ap="slow"><i></i>SLOW DOWN</button>
      </div>
      <div class="ctl-sec ctl-mode">
        <div class="ctl-h">Mode</div>
        <div class="rotary">${Object.entries(MODES).map(([k, m]) => `<button class="rot-pos" data-mode="${k}">${m.label}</button>`).join('')}<div class="rot-knob"></div></div>
        <div class="ctl-h" style="margin-top:8px">Mouse</div>
        <div class="toggle2"><button data-ms="look">LOOK</button><button data-ms="steer">STEER</button></div>
      </div>
      <div class="ctl-sec ctl-read">
        <div class="rd"><small>SPEED</small><b class="r-spd">0</b><em>m/s</em></div>
        <div class="rd"><small>ORDERED</small><b class="r-ord">0</b><em>m/s</em></div>
        <div class="rd"><small>HEADING</small><b class="r-hdg">000</b><em>°</em></div>
        <div class="rd"><small>PITCH</small><b class="r-pit">0</b><em>°</em></div>
      </div>`;
    ui.appendChild(this.root);
    this.badge = h('div', 'look-badge');
    ui.appendChild(this.badge);
    this.q = (s) => this.root.querySelector(s);
    this.wire();
    this.bindKeys();
  }

  get ship() { return this.game.player; }

  wire() {
    // throttle lever: drag snaps into detents; labels jump straight to a detent
    const track = this.q('.thr-track');
    const fromY = (clientY) => {
      const r = track.getBoundingClientRect();
      const t = clamp(1 - (clientY - r.top) / r.height, 0, 1);
      return Math.round(t * (DETENTS.length - 1));
    };
    let dragging = false;
    const setD = (i) => { if (this.ship && i !== this.ship.detent) { this.ship.setDetent(i); this.ship.ctl.slowdown = false; audio.detent(); } };
    track.addEventListener('pointerdown', (e) => { dragging = true; track.setPointerCapture(e.pointerId); this.q('.thr-handle').classList.add('pressed'); setD(fromY(e.clientY)); });
    track.addEventListener('pointermove', (e) => { if (dragging) setD(fromY(e.clientY)); });
    track.addEventListener('pointerup', () => { dragging = false; this.q('.thr-handle').classList.remove('pressed'); });
    for (const b of this.root.querySelectorAll('.thr-l')) tactile(b, 'click').addEventListener('click', () => setD(Number(b.dataset.i)));

    tactile(this.q('.sw-boost'), 'switch').addEventListener('click', () => { if (this.ship) this.ship.boost = !this.ship.boost; });

    // ship's wheel: rotate by dragging around its hub
    const wheel = this.q('.wheel');
    let wdrag = false, lastA = 0, ticks = 0;
    const ang = (e) => { const r = wheel.getBoundingClientRect(); return Math.atan2(e.clientX - (r.left + r.width / 2), -(e.clientY - (r.top + r.height / 2))); };
    wheel.addEventListener('pointerdown', (e) => { wdrag = true; lastA = ang(e); wheel.setPointerCapture(e.pointerId); wheel.classList.add('pressed'); audio.click(); this.releaseHold(); });
    wheel.addEventListener('pointermove', (e) => {
      if (!wdrag) return;
      const a = ang(e); let d = a - lastA; d = Math.atan2(Math.sin(d), Math.cos(d)); lastA = a;
      const before = this.rudder;
      this.rudder = clamp(this.rudder + d / (135 * DEG), -1, 1);
      ticks += Math.abs(this.rudder - before);
      if (ticks > 0.08) { ticks = 0; audio.wheel(); }
    });
    wheel.addEventListener('pointerup', () => { wdrag = false; wheel.classList.remove('pressed'); });
    wheel.addEventListener('dblclick', () => this.centre());
    tactile(this.q('.btn-center'), 'click').addEventListener('click', () => this.centre());

    // dive planes: vertical slider with a soft detent at zero
    const pt = this.q('.pl-track');
    let pdrag = false;
    const setP = (e) => {
      const r = pt.getBoundingClientRect();
      let v = clamp(1 - ((e.clientY - r.top) / r.height) * 2, -1, 1);
      if (Math.abs(v) < 0.12) { if (this.planes !== 0) audio.detent(); v = 0; }
      this.planes = v;
    };
    pt.addEventListener('pointerdown', (e) => { pdrag = true; pt.setPointerCapture(e.pointerId); audio.click(); this.releaseHold(); setP(e); });
    pt.addEventListener('pointermove', (e) => { if (pdrag) setP(e); });
    pt.addEventListener('pointerup', () => { pdrag = false; });

    // autopilot
    for (const b of this.root.querySelectorAll('[data-ap]')) {
      tactile(b, 'switch').addEventListener('click', () => {
        const s = this.ship; if (!s) return;
        const ap = b.dataset.ap;
        if (ap === 'hold') {
          if (s.ctl.hold) this.releaseHold();
          else { this.centre(true); s.ctl.hold = s.fwd(new THREE.Vector3()); bus.emit('radio', { from: 'HELM', text: 'Holding present heading.' }); }
        } else if (ap === 'level') { s.ctl.level = !s.ctl.level; if (s.ctl.level) bus.emit('radio', { from: 'HELM', text: 'Levelling to the battle plane.' }); }
        else if (ap === 'slow') { if (s.ctl.slowdown) s.ctl.slowdown = false; else { s.slowdown(); s.boost = false; bus.emit('radio', { from: 'HELM', text: 'All stop. Bringing her down easy.' }); } }
      });
    }
    // mode switch (three positions) and look/steer switch
    for (const b of this.root.querySelectorAll('[data-mode]')) tactile(b, 'switch').addEventListener('click', () => this.game.setMode(b.dataset.mode));
    for (const b of this.root.querySelectorAll('[data-ms]')) tactile(b, 'switch').addEventListener('click', () => { settings.mouseSteer = b.dataset.ms === 'steer'; saveSettings(); if (!settings.mouseSteer && this.ship) this.ship.ctl.steer = null; });
    // keep clicks on the card from reaching the battlefield
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
  }

  centre(silent = false) {
    this.rudder = 0; this.planes = 0;
    if (!silent) audio.detent();
  }
  releaseHold() { if (this.ship?.ctl.hold) { this.ship.ctl.hold = null; bus.emit('helm', { ship: this.ship, what: 'hold-off' }); } }

  bindKeys() {
    bus.on('key', ({ action }) => {
      const s = this.ship; if (!s || !action) return;
      if (action === 'throttleUp') { s.setDetent(s.detent + 1); audio.detent(); }
      else if (action === 'throttleDown') { s.setDetent(s.detent - 1); audio.detent(); }
      else if (action === 'slowdown') s.slowdown();
      else if (action === 'boost') s.boost = !s.boost;
    });
  }

  /** Called every sim step: turn control positions into helm commands. */
  preUpdate() {
    const s = this.ship; if (!s || s.autopilot) return;
    const inp = this.game.engine.input;
    // optional keys act as temporary overrides on top of the wheel and planes
    this.keyYaw = (inp.held('yawLeft') ? 1 : 0) - (inp.held('yawRight') ? 1 : 0);
    if (this.keyYaw) this.releaseHold();
    s.ctl.yaw = this.keyYaw || -this.rudder;
    s.ctl.pitch = -this.planes;
    s.ctl.roll = (inp.held('rollLeft') ? -1 : 0) + (inp.held('rollRight') ? 1 : 0);
    s.ctl.vert = (inp.held('thrustUp') ? 1 : 0) - (inp.held('thrustDown') ? 1 : 0);
    // mouse steering: the hull turns toward the cursor, but only while the cursor is on the battlefield
    if (settings.mouseSteer && inp.mouse.overCanvas && !this.game.scopeActive) {
      const ray = this.game.camera.aimRay();
      s.ctl.steer = (s.ctl.steer || new THREE.Vector3()).copy(ray.direction);
      if (this.rudder || this.planes) { this.rudder = 0; this.planes = 0; }
    } else if (!settings.mouseSteer) s.ctl.steer = null;
  }

  /** Refresh the card (called per rendered frame). */
  render() {
    const s = this.ship; if (!s) return;
    const n = DETENTS.length - 1;
    this.q('.thr-handle').style.bottom = `${(s.detent / n) * 100}%`;
    for (const b of this.root.querySelectorAll('.thr-l')) b.classList.toggle('on', Number(b.dataset.i) === s.detent);
    const bs = this.q('.sw-boost');
    bs.classList.toggle('on', s.boost); bs.classList.toggle('locked', s.boostLock);
    const heat = this.q('.heat i');
    heat.style.width = `${Math.min(100, s.boostHeat * 100)}%`;
    heat.className = s.boostHeat > 0.8 ? 'crit' : s.boostHeat > 0.5 ? 'warn' : '';
    this.q('.wheel svg').style.transform = `rotate(${this.rudder * 135}deg)`;
    this.q('.pl-handle').style.top = `${(1 - (this.planes + 1) / 2) * 100}%`;
    const rd = Math.round(this.rudder * 35);
    this.q('.rud').textContent = rd === 0 ? 'RUDDER MIDSHIPS' : `RUDDER ${Math.abs(rd)}° ${rd > 0 ? 'STBD' : 'PORT'}`;
    for (const b of this.root.querySelectorAll('[data-ap]')) {
      const ap = b.dataset.ap;
      b.classList.toggle('on', ap === 'hold' ? !!s.ctl.hold : ap === 'level' ? s.ctl.level : s.ctl.slowdown);
    }
    for (const b of this.root.querySelectorAll('[data-mode]')) b.classList.toggle('on', b.dataset.mode === this.game.mode);
    const mi = Object.keys(MODES).indexOf(this.game.mode);
    this.q('.rot-knob').style.transform = `rotate(${(mi - 1) * 50}deg)`;
    for (const b of this.root.querySelectorAll('[data-ms]')) b.classList.toggle('on', (b.dataset.ms === 'steer') === settings.mouseSteer);
    this.q('.r-spd').textContent = Math.round(s.speed());
    this.q('.r-ord').textContent = Math.round(s.throttle * (s.boosting ? (s.C.boostSpeed || s.C.maxSpeed * 1.45) : s.C.maxSpeed));
    this.q('.r-hdg').textContent = String(Math.round(((-s.heading() / DEG) % 360 + 360) % 360)).padStart(3, '0');
    this.q('.r-pit').textContent = Math.round(Math.asin(clamp(s.fwd(new THREE.Vector3()).y, -1, 1)) / DEG);
    // looking vs steering, always visible
    const cam = this.game.camera;
    const steering = settings.mouseSteer;
    this.badge.className = `look-badge ${steering ? 'steer' : 'look'}`;
    this.badge.innerHTML = `<b>${MODES[this.game.mode].label}</b><span>${steering ? 'MOUSE STEERS THE SHIP' : cam.looking ? 'LOOKING AROUND' : this.game.mode === 'nav' ? 'DRAG TO LOOK' : 'MOUSE AIMS · EDGE TO LOOK'}</span>`;
  }
}

const DOCTRINES = [['concentrate', 'CONCENTRATE', 'All other batteries fire on the locked target'], ['split', 'SPLIT', 'Batteries spread over every enemy in reach'], ['threats', 'THREATS', 'Batteries fire on whoever is shooting at you'], ['hold', 'HOLD', 'Other batteries hold fire']];

/** Weapon grid: one tile per battery with count, reload, ammo and ready state. Click selects, FIRE fires. */
export class WeaponGrid {
  constructor(game, ui) {
    this.game = game;
    this.root = h('div', 'card wgrid');
    ui.appendChild(this.root);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.built = null;
    bus.on('key', ({ code }) => {
      const m = /^Digit(\d)$/.exec(code || '');
      if (!m) return;
      const groups = this.game.weapons.groupsOf(this.game.player);
      const g = groups[Number(m[1]) - 1];
      if (g) this.select(g.type);
    });
    bus.on('key', ({ action }) => { if (action === 'fireSecondary') this.game.weapons.firePlayerGroup('vls') || this.game.weapons.firePlayerGroup('torpedo'); });
  }
  select(type) {
    if (this.game.weapons.selected !== type) { this.game.weapons.selected = type; audio.switch(); bus.emit('weapon:select', { type }); }
  }
  build() {
    const groups = this.game.weapons.groupsOf(this.game.player);
    this.root.innerHTML = `
      <div class="wg-h"><span class="ctl-h">Batteries</span><span class="wg-hint">Hold right mouse: scope</span></div>
      <div class="wg-tiles">${groups.map((g) => `
        <div class="wt" data-t="${g.type}" title="${g.def.desc}">
          <div class="wt-top"><b>${g.def.short}</b><em class="wt-n"></em></div>
          <div class="wt-name">${g.def.name}</div>
          <div class="wt-state"></div>
          <div class="wt-bar"><i></i></div>
          <button class="wt-fire">FIRE</button>
        </div>`).join('')}</div>
      <div class="ctl-h" style="margin-top:8px">Other batteries</div>
      <div class="doct">${DOCTRINES.map(([k, l, d]) => `<button data-d="${k}" title="${d}">${l}</button>`).join('')}</div>`;
    for (const el of this.root.querySelectorAll('.wt')) {
      tactile(el, 'click').addEventListener('click', (e) => { if (!e.target.classList.contains('wt-fire')) this.select(el.dataset.t); });
      const f = el.querySelector('.wt-fire');
      tactile(f, 'press').addEventListener('click', () => { this.select(el.dataset.t); this.game.weapons.firePlayerGroup(el.dataset.t); });
    }
    for (const b of this.root.querySelectorAll('[data-d]')) tactile(b, 'switch').addEventListener('click', () => { this.game.weapons.doctrine = b.dataset.d; });
    this.built = this.game.player;
  }
  render() {
    if (!this.game.player) return;
    if (this.built !== this.game.player) this.build();
    const W = this.game.weapons;
    for (const el of this.root.querySelectorAll('.wt')) {
      const st = W.groupState[el.dataset.t];
      if (!st) continue;
      el.classList.toggle('sel', el.dataset.t === W.selected);
      el.dataset.state = st.state;
      el.querySelector('.wt-n').textContent = `×${st.alive}/${st.total}${st.ammo != null ? ` · ${st.ammo}` : ''}`;
      el.querySelector('.wt-state').textContent = st.state === 'ready' ? 'READY' : st.state === 'reload' ? `RELOAD ${st.reload.toFixed(1)}s` : st.state === 'traversing' ? 'TRAVERSING' : st.state === 'arc' ? 'OUT OF ARC' : st.state === 'range' ? 'OUT OF RANGE' : st.state === 'nolock' ? 'NEEDS LOCK' : st.state === 'empty' ? 'EMPTY' : st.state === 'firing' ? 'FIRING' : 'DESTROYED';
      el.querySelector('.wt-bar i').style.width = `${(st.readyFrac || 0) * 100}%`;
    }
    for (const b of this.root.querySelectorAll('[data-d]')) b.classList.toggle('on', b.dataset.d === W.doctrine);
  }
}
