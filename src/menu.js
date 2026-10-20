// Start screen: choose a side (Concord or Hegemony), a ship, and a difficulty.
import { settings, saveSettings } from './core.js';
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
