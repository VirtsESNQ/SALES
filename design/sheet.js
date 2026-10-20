// Fills a design sheet's numbers from the game data, so sheets and game never disagree.
import { WEAPONS, LOADOUTS, CATALOGUE } from '../src/data/arsenal.js';
import { CLASSES, CRAFT } from '../src/data/ships.js';

export const COLORS = {
  heavy: '#7fb6c8', secondary: '#d7e2e4', broadside: '#d4b07a', plasma: '#7dbb8a', ion: '#6f9fe0', massdriver: '#a99ad8',
  torpedo: '#e08a5a', mine: '#9b86d6', vls: '#8fc9d9', flak: '#e0a050', pd: '#70808a', lance: '#e6f2f6',
  macro: '#c9a45a', gundeck: '#e07a40', siege: '#ffb070', ram: '#e0a070',
};
const km = (m) => (m >= 1000 ? `${+(m / 1000).toFixed(m % 1000 ? 2 : 0)} km` : `${m} m`);
const nf = (n) => n.toLocaleString('en-US');

export function weaponLine(key) {
  const w = WEAPONS[key];
  const bits = [];
  if (w.barrels > 1) bits.push(`${['', '', 'twin', 'triple'][w.barrels]} barrel`);
  bits.push(w.role);
  if (w.arc.axis === 'fwd' && w.arc.half <= 8) bits.push('bow axis only');
  else if (w.arc.axis === 'side') bits.push('flank arc');
  else if (w.arc.axis === 'aft') bits.push('dropped astern');
  bits.push(km(w.range));
  return bits.join(' · ');
}

export function armament(el, cls, { order } = {}) {
  const lo = LOADOUTS[cls];
  const keys = order || Object.keys(lo);
  el.innerHTML = keys.map((k) => `<li><i style="background:${COLORS[k] || '#888'}"></i><span><b>${WEAPONS[k].name}</b><small>${weaponLine(k)}</small></span><em>×${lo[k]}</em></li>`).join('')
    + `<li><i></i><span><b>Total weapon mounts</b></span><em class="total">${Object.values(lo).reduce((a, b) => a + b, 0)}</em></li>`;
}

export function stats(el, cls) {
  const c = CLASSES[cls];
  el.innerHTML = [
    ['Length', km(c.length)], [c.faction === 'hegemony' ? 'Height' : 'Beam', km(c.faction === 'hegemony' ? c.height : c.beam)],
    ['Crew', nf(c.crew)], ['Weapon mounts', c.mounts, 'acc'],
  ].map(([k, v, a]) => `<div class="stat"><div class="k">${k}</div><div class="v ${a || ''}">${v}</div></div>`).join('');
}

export function footline(cls) {
  const c = CLASSES[cls];
  return `Shields 4 × ${nf(c.shield)} · Hull ${nf(c.hull)} · ${c.maxSpeed} m/s · ${c.mounts} mounts`;
}

export function weaponCards(el) {
  el.innerHTML = CATALOGUE.map((k) => {
    const w = WEAPONS[k];
    return `<div class="card wcard"><div style="display:flex;justify-content:space-between"><span class="tag ${w.isNew ? 'new' : ''}">${w.isNew ? 'New' : 'Core'}</span><span class="tag">×${LOADOUTS.halberd[k]} on Halberd</span></div>
      <h2 style="font-size:24px">${w.name}</h2><p>${w.desc}</p>
      <div class="meta"><div><span>RANGE</span>${km(w.range)}</div><div><span>RELOAD</span>${w.reload < 1 ? w.reload.toFixed(2) : w.reload} s</div><div><span>BEST VS</span>${w.role}</div></div></div>`;
  }).join('');
}

export function craftMeta(key) {
  const c = CRAFT[key];
  return `<div class="meta"><div><span>LENGTH</span>${c.length} m</div><div><span>SPEED</span>${c.speed} m/s</div><div><span>PER WING</span>${c.wing}</div></div>`;
}

export function fillAll() {
  for (const el of document.querySelectorAll('[data-arm]')) armament(el, el.dataset.arm);
  for (const el of document.querySelectorAll('[data-stats]')) stats(el, el.dataset.stats);
  for (const el of document.querySelectorAll('[data-foot]')) el.textContent = footline(el.dataset.foot);
  for (const el of document.querySelectorAll('[data-weapons]')) weaponCards(el);
  for (const el of document.querySelectorAll('[data-craft]')) el.insertAdjacentHTML('beforeend', craftMeta(el.dataset.craft));
  const here = location.pathname.split('/').pop();
  for (const a of document.querySelectorAll('.nav a')) if (a.getAttribute('href') === here) a.classList.add('on');
}
fillAll();
