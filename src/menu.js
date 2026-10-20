// Start screen: choose a side (Concord or Hegemony), a ship, and a difficulty.
import { settings, saveSettings, resetKeys } from './core.js';
import { CLASSES } from './data/ships.js';
import { PLAYABLE, FLEETS } from './mission.js';
import { audio } from './audio.js';
import { tactile } from './controls.js';

const SIDES = {
  concord: { name: 'Concord Navy', blurb: 'Clean grey-blue wedges. Long-range turbolasers, flank broadsides, a spinal lance. Stop the Hegemony siege fleet.', goal: 'Destroy the Varr Tolun. Keep the CSV Halberd alive.' },
  hegemony: { name: 'Hegemony Battle Fleet', blurb: 'Gothic battle cathedrals. Massed gun decks, macro cannons and the siege cannon. Break the Concord line.', goal: 'Destroy the CSV Halberd. Keep the Varr Tolun alive.' },
};
const DIFF = [['cadet', 'Cadet', 'Enemies hit softer, your shields recharge faster.'], ['captain', 'Captain', 'The intended battle.'], ['admiral', 'Admiral', 'Enemies are tougher and more accurate.']];

/** Shows the menu; resolves with { side, ship } when the player begins. */
export function showMenu(ui) {
  return new Promise((resolve) => {
    let side = settings.lastSide && PLAYABLE[settings.lastSide] ? settings.lastSide : 'concord';
    let ship = settings.lastShip;
    const el = document.createElement('div');
    el.className = 'menu';
    ui.appendChild(el);
    const render = () => {
      if (!PLAYABLE[side].some((p) => p.cls === ship)) ship = PLAYABLE[side][0].cls;
      const nameOf = (cls) => FLEETS[side].find((u) => u.cls === cls)?.name || CLASSES[cls].cname;
      el.innerHTML = `
        <div class="menu-in">
          <div class="menu-kick">Operation Black Tide</div>
          <h1>HALBERD FLEET COMMAND</h1>
          <div class="menu-step">1 · Choose your side</div>
          <div class="sides">${Object.entries(SIDES).map(([k, s]) => `
            <button class="side ${k} ${k === side ? 'on' : ''}" data-side="${k}"><b>${s.name}</b><span>${s.blurb}</span><em>${s.goal}</em></button>`).join('')}
          </div>
          <div class="menu-step">2 · Choose your ship</div>
          <div class="shiplist">${PLAYABLE[side].map((p) => { const c = CLASSES[p.cls]; return `
            <button class="shipc ${side} ${p.cls === ship ? 'on' : ''}" data-ship="${p.cls}">
              <span class="sc-top"><b>${nameOf(p.cls)}</b>${p.recommended ? '<i>FLAGSHIP</i>' : ''}</span>
              <small>${c.cname}</small>
              <span class="sc-role">${p.role}</span>
              <span class="sc-stats"><span><small>LENGTH</small>${(c.length / 1000).toFixed(2)} km</span><span><small>SPEED</small>${c.maxSpeed} m/s</span><span><small>WEAPONS</small>${c.mounts}</span><span><small>HULL</small>${c.hull.toLocaleString('en-US')}</span></span>
            </button>`; }).join('')}
          </div>
          <div class="menu-step">3 · Difficulty</div>
          <div class="diff">${DIFF.map(([k, n, d]) => `<button data-diff="${k}" class="${settings.difficulty === k ? 'on' : ''}"><b>${n}</b><span>${d}</span></button>`).join('')}</div>
          <button class="go">TAKE COMMAND</button>
          <div class="menu-foot">Everything works with the mouse. <a href="design/index.html" target="_blank" rel="noopener">Ship design sheets</a></div>
        </div>`;
      for (const b of el.querySelectorAll('[data-side]')) tactile(b, 'switch').addEventListener('click', () => { side = b.dataset.side; render(); });
      for (const b of el.querySelectorAll('[data-ship]')) tactile(b, 'click').addEventListener('click', () => { ship = b.dataset.ship; render(); });
      for (const b of el.querySelectorAll('[data-diff]')) tactile(b, 'click').addEventListener('click', () => { settings.difficulty = b.dataset.diff; saveSettings(); render(); });
      tactile(el.querySelector('.go'), 'detent').addEventListener('click', () => {
        settings.lastSide = side; settings.lastShip = ship; saveSettings();
        audio.init();
        el.classList.add('gone');
        setTimeout(() => el.remove(), 500);
        resolve({ side, ship });
      });
    };
    render();
  });
}

const KEY_LABELS = {
  throttleUp: 'Throttle up', throttleDown: 'Throttle down', yawLeft: 'Turn port', yawRight: 'Turn starboard', rollLeft: 'Roll left', rollRight: 'Roll right',
  thrustUp: 'Thrust up', thrustDown: 'Thrust down', boost: 'Boost', slowdown: 'Slow down', cycleTarget: 'Next target', fireSecondary: 'Fire missiles',
  shieldFore: 'Boost fore shield', shieldAft: 'Boost aft shield', shieldPort: 'Boost port shield', shieldStbd: 'Boost starboard shield',
  fighters: 'Fighter panel', launch: 'Launch squadron', camera: 'Next view', pause: 'Pause menu',
};
const ARROWS = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };
const keyName = (code) => ARROWS[code] || (code || '—').replace(/^Key/, '').replace(/^Digit/, '').replace('Left', ' L').replace('Right', ' R');

/** Pause menu: difficulty, camera shake, volume, controls guide, key rebinding, restart. */
export class PauseMenu {
  constructor(game, ui) {
    this.game = game;
    this.open = false;
    this.btn = document.createElement('button');
    this.btn.className = 'btn pause-btn';
    this.btn.textContent = 'MENU';
    ui.appendChild(this.btn);
    tactile(this.btn, 'press').addEventListener('click', () => this.toggle());
    this.el = document.createElement('div');
    this.el.className = 'pause';
    ui.appendChild(this.el);
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.capture = null;
    window.addEventListener('keydown', (e) => {
      if (this.capture) {
        e.preventDefault();
        if (e.code !== 'Escape') { settings.keys[this.capture] = e.code; saveSettings(); }
        this.capture = null; this.render();
        return;
      }
      if (e.code === settings.keys.pause || e.code === 'Escape') this.toggle();
    }, true);
  }
  toggle(force) {
    this.open = force ?? !this.open;
    this.game.engine.time.paused = this.open;
    this.el.classList.toggle('on', this.open);
    if (this.open) this.render();
  }
  render() {
    const s = settings;
    const choice = this.game.choice || {};
    this.el.innerHTML = `
      <div class="pause-in">
        <div class="menu-kick">Paused</div>
        <h2>Fleet command</h2>
        <div class="p-row"><button class="btn p-resume on">RESUME</button><button class="btn p-restart">RESTART BATTLE</button><button class="btn p-change">CHANGE SHIP</button></div>
        <div class="p-grid">
          <div>
            <div class="menu-step">Difficulty</div>
            <div class="diff small">${DIFF.map(([k, n]) => `<button data-diff="${k}" class="${s.difficulty === k ? 'on' : ''}"><b>${n}</b></button>`).join('')}</div>
            <div class="menu-step">Camera shake</div>
            <div class="p-slider"><input type="range" min="0" max="1" step="0.05" value="${s.shake}" class="p-shake" ${s.shakeOn ? '' : 'disabled'}><button class="btn p-shakeoff ${s.shakeOn ? '' : 'on'}">${s.shakeOn ? 'TURN OFF' : 'OFF'}</button></div>
            <div class="menu-step">Sound volume</div>
            <div class="p-slider"><input type="range" min="0" max="1" step="0.05" value="${s.volume}" class="p-vol"><span>${Math.round(s.volume * 100)}%</span></div>
            <div class="menu-step">How to command</div>
            <ul class="p-guide">
              <li><b>Throttle lever</b> sets speed. The ship takes time to speed up and slow down.</li>
              <li><b>Wheel</b> sets the rudder; it stays put until you centre it. <b>Planes</b> climb or dive.</li>
              <li><b>Combat mode</b>: the cursor aims the selected battery. Hold <b>left mouse</b> to fire, hold <b>right mouse</b> for the scope.</li>
              <li>The text next to the reticle tells you if the guns are <b>aligned and ready</b>, still <b>traversing</b>, or which way to turn.</li>
              <li><b>Broadsides</b> fire to the sides. The <b>lance</b> and <b>torpedoes</b> need the bow on the target.</li>
              <li>Click a <b>shield sector</b> (top left) to send it more power.</li>
            </ul>
          </div>
          <div>
            <div class="menu-step">Optional keys <small>(click, then press a key)</small></div>
            <div class="p-keys">${Object.entries(KEY_LABELS).map(([a, l]) => `<button class="pk ${this.capture === a ? 'cap' : ''}" data-k="${a}"><span>${l}</span><b>${this.capture === a ? 'press a key…' : keyName(s.keys[a])}</b></button>`).join('')}</div>
            <button class="btn p-resetkeys">RESET KEYS</button>
          </div>
        </div>
        <div class="p-foot">${choice.ship ? `Commanding ${this.game.player?.name || ''} · ${choice.side === 'concord' ? 'Concord Navy' : 'Hegemony Battle Fleet'}` : ''}</div>
      </div>`;
    const q = (sel) => this.el.querySelector(sel);
    tactile(q('.p-resume'), 'press').addEventListener('click', () => this.toggle(false));
    tactile(q('.p-restart'), 'press').addEventListener('click', () => restart(choice));
    tactile(q('.p-change'), 'press').addEventListener('click', () => { location.href = location.pathname; });
    for (const b of this.el.querySelectorAll('[data-diff]')) tactile(b, 'click').addEventListener('click', () => { settings.difficulty = b.dataset.diff; saveSettings(); this.render(); });
    q('.p-shake').addEventListener('input', (e) => { settings.shake = Number(e.target.value); saveSettings(); });
    tactile(q('.p-shakeoff'), 'switch').addEventListener('click', () => { settings.shakeOn = !settings.shakeOn; saveSettings(); this.render(); });
    q('.p-vol').addEventListener('input', (e) => { settings.volume = Number(e.target.value); saveSettings(); e.target.nextElementSibling.textContent = `${Math.round(settings.volume * 100)}%`; });
    for (const b of this.el.querySelectorAll('[data-k]')) tactile(b, 'click').addEventListener('click', () => { this.capture = b.dataset.k; this.render(); });
    tactile(q('.p-resetkeys'), 'press').addEventListener('click', () => { resetKeys(); this.render(); });
  }
}

/** Restart the battle with the same side and ship (a clean reload keeps every system honest). */
export function restart(choice) {
  const qs = new URLSearchParams(location.search);
  const keep = qs.get('test') ? `test=${qs.get('test')}&` : '';
  location.href = `${location.pathname}?${keep}side=${choice.side}&ship=${choice.ship}`;
}
