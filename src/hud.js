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

const SUB_EFFECT = { engines: 'speed and turning', shieldgen: 'shield recharge', sensors: 'accuracy and radar', reactor: 'reload and traverse', hangar: 'fighter launches', bridge: 'command', siege: 'siege cannon' };

/** Own-ship status: clickable 4-sector shield diagram (boost), hull, fires, subsystems. */
export class ShipStatus {
  constructor(game, ui) {
    this.game = game;
    this.root = h('div', 'card status');
    this.root.innerHTML = `
      <div class="st-h"><b class="st-name"></b><small class="st-cls"></small></div>
      <div class="st-row">
        <svg class="st-sh" viewBox="-60 -70 120 140">
          <path class="st-ship" d=""/>
          <path class="sec" data-s="0" d="M-36 -56 A70 70 0 0 1 36 -56"/>
          <path class="sec" data-s="1" d="M36 56 A70 70 0 0 1 -36 56"/>
          <path class="sec" data-s="2" d="M-48 -42 A70 70 0 0 0 -48 42"/>
          <path class="sec" data-s="3" d="M48 42 A70 70 0 0 0 48 -42"/>
          <circle class="hitflash" r="0"/>
        </svg>
        <div class="st-side">
          <div class="st-shv"></div>
          <button class="btn st-bal" title="Spread shield power evenly">BALANCE</button>
          <div class="st-hull"><small>HULL</small><i><em></em></i><b></b></div>
          <div class="st-fire"></div>
        </div>
      </div>
      <div class="st-subs"></div>
      <div class="st-hint">Click a shield sector to send it more power.</div>`;
    ui.appendChild(this.root);
    this.root.addEventListener('pointerdown', (e) => e.stopPropagation());
    for (const el of this.root.querySelectorAll('.sec')) {
      el.addEventListener('pointerdown', () => { audio.switch(); this.game.damage.boostSector(this.game.player, Number(el.dataset.s)); });
    }
    tactile(this.root.querySelector('.st-bal'), 'switch').addEventListener('click', () => { const p = this.game.player; if (p) p.shieldBoost = -1; });
    bus.on('key', ({ action }) => {
      const map = { shieldFore: 0, shieldAft: 1, shieldPort: 2, shieldStbd: 3 };
      if (action in map && this.game.player) { audio.switch(); this.game.damage.boostSector(this.game.player, map[action]); }
    });
    this.flash = [0, 0, 0, 0];
    bus.on('hit:shield', ({ ship, h: hit }) => { if (ship.isPlayer) this.flash[hit.sector] = 1; });
    bus.on('hit:hull', ({ ship, h: hit }) => { if (ship.isPlayer) this.flash[hit.sector] = 1.5; });
    this.built = null;
  }
  build(p) {
    // simple top-down silhouette of the player's class
    const wedge = p.faction === 'concord';
    this.root.querySelector('.st-ship').setAttribute('d', wedge ? 'M0 -46 L20 34 L-20 34 Z' : 'M0 -46 L12 -26 L12 38 L-12 38 L-12 -26 Z');
    this.root.querySelector('.st-name').textContent = p.name;
    this.root.querySelector('.st-cls').textContent = p.C.cname;
    this.built = p;
  }
  render(dt) {
    const p = this.game.player; if (!p) return;
    if (this.built !== p) this.build(p);
    const R = this.root;
    for (const el of R.querySelectorAll('.sec')) {
      const i = Number(el.dataset.s), k = p.shields[i] / p.maxShield;
      el.style.opacity = 0.25 + Math.min(1, k) * 0.75;
      el.classList.toggle('down', k <= 0);
      el.classList.toggle('low', k > 0 && k < 0.3);
      el.classList.toggle('boost', p.shieldBoost === i);
      el.classList.toggle('hit', this.flash[i] > 0);
      this.flash[i] = Math.max(0, this.flash[i] - dt * 3);
    }
    R.querySelector('.st-shv').innerHTML = SECTORS.map((s, i) => `<span class="${p.shields[i] <= 0 ? 'crit' : p.shields[i] < p.maxShield * 0.3 ? 'warn' : ''} ${p.shieldBoost === i ? 'b' : ''}"><small>${s}</small>${Math.round(p.shields[i] / p.maxShield * 100)}</span>`).join('');
    R.querySelector('.st-bal').classList.toggle('on', p.shieldBoost < 0);
    const hk = Math.max(0, p.hull / p.maxHull);
    const he = R.querySelector('.st-hull em');
    he.style.width = `${hk * 100}%`; he.className = hk < 0.3 ? 'crit' : hk < 0.6 ? 'warn' : '';
    R.querySelector('.st-hull b').textContent = `${Math.round(hk * 100)}%`;
    const fires = p.fires?.length || 0;
    R.querySelector('.st-fire').innerHTML = fires ? `<span class="crit">FIRE ×${fires} · damage control responding</span>` : '';
    R.querySelector('.st-subs').innerHTML = Object.entries(p.subs).filter(([k]) => k !== 'bridge').map(([k, s]) => {
      const st = s.offline > 0 ? ['crit', `OFFLINE ${Math.ceil(s.offline)}s`] : s.hp <= 0 ? ['crit', `DESTROYED · repair ${Math.max(0, Math.ceil((p.isPlayer ? 24 : 32) - (s.repairT || 0)))}s`] : s.hp < s.max * 0.5 ? ['warn', 'DAMAGED'] : ['ok', 'OK'];
      return `<div class="${st[0]}" title="Affects ${SUB_EFFECT[k] || k}"><span>${(SUB_NAMES[k] || k).replace('SHIELDS', 'SHIELD GEN')}</span><i><em style="width:${Math.max(0, s.hp / s.max) * 100}%"></em></i><b>${st[1]}</b></div>`;
    }).join('');
  }
}

/** Short radio callouts and a running combat log (most recent first, fades out). */
export class Comms {
  constructor(game, ui) {
    this.game = game;
    this.root = h('div', 'comms');
    ui.appendChild(this.root);
    this.lines = [];
    const P = () => game.player;
    const name = (s) => s.isPlayer ? 'we' : s.name;
    bus.on('radio', ({ from, text, level }) => this.say(from, text, level));
    bus.on('shield:down', ({ ship, name: sec }) => {
      if (ship.isPlayer) { this.say('SHIELDS', `${sec.toLowerCase()} shield down. Turn a fresh sector to the enemy or boost it.`, 'crit'); audio.alarm('crit'); }
      else if (P()?.target === ship) this.say('TACTICAL', `${ship.name}: ${sec.toLowerCase()} shield down.`, 'ok');
    });
    bus.on('subsystem', ({ ship, key, state }) => {
      const L = (SUB_NAMES[key] || key).toLowerCase();
      if (ship.isPlayer) {
        if (state === 'destroyed') { this.say('DAMAGE CONTROL', `${L} offline. Effect: ${SUB_EFFECT[key] || key} reduced. Crews dispatched.`, 'crit'); audio.alarm('crit'); }
        else if (state === 'damaged') this.say('DAMAGE CONTROL', `${L} damaged.`, 'warn');
        else if (state === 'restored') this.say('DAMAGE CONTROL', `${L} back online.`, 'ok');
      } else if (state === 'destroyed' && ship.team !== P()?.team) this.say('TACTICAL', `${ship.name}: ${L} disabled.`, 'ok');
    });
    bus.on('critical', ({ ship, kind, key }) => {
      if (!ship.isPlayer) return;
      if (kind === 'fire') { this.say('DAMAGE CONTROL', `Fire reported, deck ${3 + Math.floor(Math.random() * 38)}. Teams responding.`, 'warn'); audio.alarm('warn'); }
      else this.say('DAMAGE CONTROL', `Critical hit, ${(SUB_NAMES[key] || key).toLowerCase()}.`, 'crit');
    });
    bus.on('mount:lost', ({ ship, mount }) => {
      if (ship.isPlayer) this.say('GUNNERY', `${WEAPONS[mount.type].name} mount destroyed.`, 'warn');
    });
    bus.on('ship:destroyed', ({ ship, src }) => {
      const mine = src && (src.isPlayer || src.carrier?.isPlayer);
      if (ship.isPlayer) this.say('BRIDGE', 'Abandon ship. All hands, abandon ship.', 'crit');
      else this.say('TACTICAL', `${ship.name} destroyed${mine ? ' — confirmed kill' : ''}.`, ship.team === P()?.team ? 'crit' : 'ok');
    });
    bus.on('target', ({ ship }) => this.say('TACTICAL', `Target locked: ${ship.name}, ${ship.C.label.toLowerCase()}.`, 'info'));
    bus.on('overheat', ({ ship }) => { if (ship.isPlayer) this.say('ENGINEERING', 'Drives overheated. Boost locked out until they cool.', 'warn'); });
    void name;
  }
  say(from, text, level = 'info') {
    const el = h('div', `cm ${level}`, `<b>${from}</b>${text}`);
    this.root.prepend(el);
    this.lines.unshift({ el, t: 9 });
    if (level !== 'info') audio.radio();
    while (this.lines.length > 5) this.lines.pop().el.remove();
  }
  render(dt) {
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.t -= dt;
      if (l.t < 1.5) l.el.style.opacity = Math.max(0, l.t / 1.5);
      if (l.t <= 0) { l.el.remove(); this.lines.splice(i, 1); }
    }
  }
}
