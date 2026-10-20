// HUD: reticle with per-battery ready/aligned indicator, lead marker and firing solution,
// target brackets, target panel (class, range, heading, closing speed, shields, hull, threat,
// subsystem aim), contact list. Kept deliberately quiet; detail sits in panels, not on the view.
import * as THREE from 'three';
import { bus, fmtKm, DEG } from './core.js';
import { WEAPONS } from './data/arsenal.js';
import { SECTORS } from './ships.js';
import { audio } from './audio.js';
import { tactile } from './controls.js';

const h = (tag, cls, html = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
const _v = new THREE.Vector3(), _w = new THREE.Vector3();
const STATE_CLASS = { ready: 'ok', traversing: 'warn', reload: 'dim', range: 'warn', arc: 'crit', nolock: 'warn', empty: 'crit', dead: 'crit', firing: 'info' };
const SUB_NAMES = { hull: 'HULL', weapons: 'WEAPONS', engines: 'ENGINES', shieldgen: 'SHIELDS', sensors: 'SENSORS', reactor: 'REACTOR', hangar: 'HANGAR', siege: 'SIEGE GUN' };

export class HUD {
  constructor(game, ui) {
    this.game = game;
    this.ui = ui;
    this.leadScreen = { visible: false, x: 0, y: 0, world: new THREE.Vector3() };
    // reticle + indicator follow the cursor
    this.reticle = h('div', 'reticle', `<svg viewBox="-30 -30 60 60"><circle r="13"/><path d="M-26 0H-17M17 0H26M0 -26V-17M0 17V26"/><circle r="1.5" class="dot"/></svg>
      <div class="rdy"><div class="rdy-main"><b></b><span></span></div><div class="rdy-bar"><i></i></div><div class="rdy-others"></div></div>`);
    ui.appendChild(this.reticle);
    this.lead = h('div', 'lead', '<svg viewBox="-14 -14 28 28"><path d="M0 -10L10 0L0 10L-10 0Z"/></svg><span>LEAD</span>');
    ui.appendChild(this.lead);
    this.bracket = h('div', 'bracket', '<i class="tl"></i><i class="tr"></i><i class="bl"></i><i class="br"></i><span></span>');
    ui.appendChild(this.bracket);
    // target panel
    this.panel = h('div', 'card tgt');
    this.panel.innerHTML = `
      <div class="tgt-h"><span>TARGET</span><button class="btn btn-lock" title="Lock the enemy nearest the cursor">LOCK NEAREST</button></div>
      <div class="tgt-none">No target locked. Click a contact below, or LOCK NEAREST.</div>
      <div class="tgt-body">
        <div class="tgt-name"><b></b><small></small></div>
        <div class="tgt-grid">
          <span><small>RANGE</small><b class="t-rng"></b></span><span><small>CLOSING</small><b class="t-cls"></b></span>
          <span><small>BEARING</small><b class="t-brg"></b></span><span><small>THREAT</small><b class="t-thr"></b></span>
        </div>
        <div class="tgt-sh">${SECTORS.map((s, i) => `<span><small>${s}</small><i data-s="${i}"><em></em></i></span>`).join('')}</div>
        <div class="tgt-hull"><small>HULL</small><i><em></em></i><b></b></div>
        <div class="tgt-subs"><small>AIM AT</small><div class="subs"></div></div>
      </div>
      <div class="tgt-contacts"><small>CONTACTS</small><div class="clist"></div></div>`;
    ui.appendChild(this.panel);
    this.panel.addEventListener('pointerdown', (e) => e.stopPropagation());
    tactile(this.panel.querySelector('.btn-lock'), 'press').addEventListener('click', () => this.lockNearest());
    this.contactsT = 0;
    bus.on('key', ({ action }) => { if (action === 'cycleTarget') this.cycleTarget(); });
  }

  get player() { return this.game.player; }

  /** Lock the hostile ship closest to the cursor direction. */
  lockNearest() {
    const p = this.player; if (!p) return;
    const ray = this.game.camera.aimRay();
    let best = null, ba = Infinity;
    for (const s of this.game.ships) {
      if (!s.alive || s.team === p.team) continue;
      const a = ray.direction.angleTo(_v.subVectors(s.center(_w), ray.origin));
      if (a < ba) { ba = a; best = s; }
    }
    this.lock(best);
  }
  cycleTarget() {
    const p = this.player; if (!p) return;
    const hostiles = this.game.ships.filter((s) => s.alive && s.team !== p.team).sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos));
    if (!hostiles.length) return;
    const i = hostiles.indexOf(p.target);
    this.lock(hostiles[(i + 1) % hostiles.length]);
  }
  lock(s) {
    const p = this.player; if (!p || !s) return;
    if (p.target !== s) { p.target = s; p.targetSub = 'hull'; audio.radio(); bus.emit('target', { ship: s }); }
  }

  project(world, out) {
    const cam = this.game.engine.camera;
    _v.copy(world).project(cam);
    out.visible = _v.z < 1 && _v.z > -1;
    out.x = (_v.x * 0.5 + 0.5) * innerWidth; out.y = (-_v.y * 0.5 + 0.5) * innerHeight;
    out.behind = _v.z >= 1;
    return out;
  }

  render() {
    const g = this.game, p = this.player;
    if (!p) return;
    const W = g.weapons, m = g.engine.input.mouse;
    const scope = g.scopeActive;
    // reticle follows the cursor (centre of the scope while scoped)
    const rx = scope ? innerWidth / 2 : m.x, ry = scope ? innerHeight / 2 : m.y;
    const showRet = scope || (g.mode !== 'nav' && m.overCanvas);
    this.reticle.style.display = showRet && p.alive ? '' : 'none';
    this.reticle.style.transform = `translate(${rx}px, ${ry}px)`;
    const sel = W.selected, st = W.groupState[sel];
    if (st) {
      this.reticle.className = `reticle ${STATE_CLASS[st.state] || ''} ${W.solution ? 'solution' : ''}`;
      this.reticle.querySelector('.rdy-main b').textContent = `${st.name.toUpperCase()} ${st.alive}/${st.total}`;
      this.reticle.querySelector('.rdy-main span').textContent = (W.solution && st.state === 'ready' ? 'SOLUTION · ' : '') + st.label;
      const bar = this.reticle.querySelector('.rdy-bar i');
      bar.style.width = `${(st.readyFrac || 0) * 100}%`;
      // the other batteries, one compact line each
      const others = Object.values(W.groupState).filter((o) => o.type !== sel);
      this.reticle.querySelector('.rdy-others').innerHTML = others.map((o) => `<span class="${STATE_CLASS[o.state] || ''}"><i></i>${o.short} ${o.state === 'ready' ? 'READY' : o.state === 'reload' ? `${o.reload.toFixed(0)}s` : o.state === 'traversing' ? 'TRAV' : o.state === 'arc' ? 'ARC' : o.state === 'range' ? 'RNG' : o.state === 'nolock' ? 'LOCK' : o.state === 'firing' ? 'FIRE' : o.state === 'empty' ? 'EMPTY' : '—'}</span>`).join('');
    }
    // lead marker for the selected battery
    const tg = p.target && p.target.alive ? p.target : null;
    const lp = tg ? W.leadFor(sel) : null;
    if (lp && !(WEAPONS[sel]?.kind === 'missile') && WEAPONS[sel]?.kind !== 'mine') {
      this.project(lp, this.leadScreen);
      this.leadScreen.world.copy(lp);
      this.lead.style.display = this.leadScreen.visible ? '' : 'none';
      this.lead.style.transform = `translate(${this.leadScreen.x}px, ${this.leadScreen.y}px)`;
      this.lead.className = `lead ${W.solution ? 'on' : ''}`;
      this.lead.querySelector('span').textContent = W.solution ? 'SOLUTION' : 'LEAD';
    } else { this.lead.style.display = 'none'; this.leadScreen.visible = false; }
    // target bracket
    if (tg) {
      const c = this.project(tg.center(_w), {});
      const dist = tg.pos.distanceTo(g.engine.camera.position);
      const px = Math.max(26, (tg.radius / dist) * innerHeight * 0.9);
      this.bracket.style.display = c.visible ? '' : 'none';
      this.bracket.style.transform = `translate(${c.x}px, ${c.y}px)`;
      this.bracket.style.width = this.bracket.style.height = `${Math.min(px * 1.6, innerHeight * 0.8)}px`;
      this.bracket.querySelector('span').textContent = `${tg.name} · ${fmtKm(p.pos.distanceTo(tg.pos))}`;
    } else this.bracket.style.display = 'none';
    this.renderPanel(tg);
  }

  renderPanel(tg) {
    const p = this.player, P = this.panel;
    P.classList.toggle('has', !!tg);
    if (tg) {
      P.querySelector('.tgt-name b').textContent = tg.name;
      P.querySelector('.tgt-name small').textContent = `${tg.C.cname} · ${tg.C.length >= 1000 ? (tg.C.length / 1000).toFixed(2) + ' km' : tg.C.length + ' m'}`;
      const d = p.pos.distanceTo(tg.pos);
      P.querySelector('.t-rng').textContent = fmtKm(d);
      const closing = -_v.subVectors(tg.vel, p.vel).dot(_w.subVectors(tg.pos, p.pos).normalize());
      P.querySelector('.t-cls').textContent = `${closing >= 0 ? '+' : ''}${Math.round(closing)} m/s`;
      const rel = _v.subVectors(tg.pos, p.pos);
      const brg = ((Math.atan2(-rel.x, rel.z) / DEG) % 360 + 360) % 360;
      P.querySelector('.t-brg').textContent = String(Math.round(brg)).padStart(3, '0');
      const thr = tg.C.threat + (tg.target === p ? 2 : 0);
      const te = P.querySelector('.t-thr');
      te.textContent = thr >= 6 ? 'EXTREME' : thr >= 4 ? 'HIGH' : thr >= 2 ? 'MEDIUM' : 'LOW';
      te.className = `t-thr ${thr >= 4 ? 'crit' : thr >= 2 ? 'warn' : 'ok'}`;
      for (const el of P.querySelectorAll('.tgt-sh i')) {
        const k = tg.shields[Number(el.dataset.s)] / tg.maxShield;
        el.firstChild.style.width = `${k * 100}%`;
        el.className = k <= 0 ? 'down' : k < 0.3 ? 'low' : '';
      }
      const hk = tg.hull / tg.maxHull;
      P.querySelector('.tgt-hull em').style.width = `${hk * 100}%`;
      P.querySelector('.tgt-hull b').textContent = `${Math.round(hk * 100)}%`;
      // subsystem aim buttons (rebuilt when the target changes)
      const subs = P.querySelector('.subs');
      if (subs.dataset.for !== String(tg.id)) {
        subs.dataset.for = tg.id;
        subs.innerHTML = tg.subList().map((k) => `<button class="btn" data-sub="${k}">${SUB_NAMES[k] || k.toUpperCase()}</button>`).join('');
        for (const b of subs.querySelectorAll('[data-sub]')) tactile(b, 'click').addEventListener('click', () => { p.targetSub = b.dataset.sub; bus.emit('target:sub', { sub: p.targetSub }); });
      }
      for (const b of subs.querySelectorAll('[data-sub]')) {
        b.classList.toggle('on', b.dataset.sub === p.targetSub);
        const s = tg.subs[b.dataset.sub];
        b.classList.toggle('dead', !!s && (s.hp <= 0 || s.offline > 0));
      }
    }
    // contact list (refreshed a few times a second)
    this.contactsT -= 1 / 60;
    if (this.contactsT <= 0) {
      this.contactsT = 0.3;
      const list = this.game.ships.filter((s) => s.alive && s.team !== p.team).sort((a, b) => a.pos.distanceTo(p.pos) - b.pos.distanceTo(p.pos)).slice(0, p.target ? 4 : 7);
      const cl = P.querySelector('.clist');
      cl.innerHTML = list.map((s) => `<button class="contact ${s === p.target ? 'on' : ''}" data-id="${s.id}"><b>${s.name}</b><small>${s.C.label}</small><em>${fmtKm(s.pos.distanceTo(p.pos))}</em></button>`).join('');
      for (const b of cl.querySelectorAll('[data-id]')) {
        b.addEventListener('pointerdown', () => { audio.click(); this.lock(this.game.ships.find((s) => s.id === Number(b.dataset.id))); });
      }
    }
  }
}
