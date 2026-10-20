// Probe (not part of the suite): fast-forward an AI-vs-AI battle and print the state each minute.
//   node tests/battle-probe.mjs concord halberd [difficulty] [minutes]
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [side = 'concord', ship = 'halberd', diffc = 'captain', mins = '12'] = process.argv.slice(2);
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(path.join(execSync('npm root -g').toString().trim(), 'playwright')); }
const PORT = 9100 + Math.floor(Math.random() * 500);
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));
const browser = await pw.chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
await page.addInitScript((d) => localStorage.setItem('halberd.v2.settings', JSON.stringify({ difficulty: d })), diffc);
await page.goto(`http://127.0.0.1:${PORT}/index.html?test=1&autoplay=1&side=${side}&ship=${ship}`);
await page.waitForFunction(() => window.__game?.state?.().ship, null, { timeout: 30000 });
await page.evaluate(() => {
  const k = (window.__kills = {});
  window.__game.bus.on('craft:lost', ({ craft, src }) => { const key = `${craft.team[0]}<-${src ? (src.isCraft ? 'craft:' + src.role : src.cls) : '?'}`; k[key] = (k[key] || 0) + 1; });
  const w = (window.__weap = { torp: 0, torpKilled: 0, rocket: 0 });
  const W = window.__game.game.weapons, orig = W.craftShot.bind(W);
  const ok = W.killMissile.bind(W);
  W.killMissile = (m, by) => { if (m.type === 'ftorp') { const st = new Error().stack.split('\n')[2].trim().split(' ')[1]; w['via_' + st] = (w['via_' + st] || 0) + 1; } return ok(m, by); };
  W.craftShot = (c, type, ...a) => { const p = orig(c, type, ...a); if (type === 'ftorp') w.torp++; if (type === 'rocket') w.rocket++; return p; };
  window.__game.bus.on('missile:intercepted', ({ missile, by }) => { if (missile.type === 'ftorp') { w.torpKilled++; const k2 = 'by_' + (by ? (by.isCraft ? by.role : by.cls) : 'none') + '_age' + Math.round(missile.age); w[k2] = (w[k2] || 0) + 1; } });
});
for (let m = 1; m <= Number(mins); m++) {
  const t0 = Date.now();
  const s = await page.evaluate(() => { window.__game.sim(60, 1 / 20); return window.__game.state(); });
  console.log(`t=${m}m (${((Date.now() - t0) / 1000).toFixed(1)}s real) over=${s.over} ${s.result ? JSON.stringify(s.result) : ''}`);
  const fl = await page.evaluate(() => window.__game.game.flight.squadrons.map((q) => `${q.carrier.name[0]}:${q.name} ${q.status} ${q.order} a${q.alive.length} r${q.ready} k${q.stats.craftKills}/${Math.round(q.stats.dealt)} s${q.stats.shots} h${q.stats.hits}`).join(' | ') + ` · craft ${window.__game.game.fighters.length}`);
  console.log('   F ' + fl);
  console.log('   K ' + JSON.stringify(await page.evaluate(() => [window.__kills, window.__weap])));
  console.log('   D ' + await page.evaluate(() => { const g = window.__game.game; return g.flight.squadrons.filter((q) => q.name.startsWith('Viper') || q.name.startsWith('Razor')).map((q) => { const l = q.leader(); if (!l) return q.name + ' -'; let best = 1e9; for (const e of g.fighters) if (e.team !== l.team && e.alive) best = Math.min(best, e.pos.distanceTo(l.pos)); return `${q.name} st=${l.state} tgt=${!!l.target} near=${Math.round(best)} pos=${l.pos.toArray().map(Math.round)}`; }).join(' | '); }));
  console.log('   ' + s.fleet.map((f) => `${f.team[0]}:${f.n}${f.alive ? '' : f.withdrawn ? '(W)' : '(X)'} ${f.hull}`).join(' | '));
  if (s.over) break;
}
await page.screenshot({ path: path.join(ROOT, 'tests/shots/battle-probe.png') });
await browser.close(); server.kill();
