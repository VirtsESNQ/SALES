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
for (let m = 1; m <= Number(mins); m++) {
  const t0 = Date.now();
  const s = await page.evaluate(() => { window.__game.sim(60, 1 / 20); return window.__game.state(); });
  console.log(`t=${m}m (${((Date.now() - t0) / 1000).toFixed(1)}s real) over=${s.over} ${s.result ? JSON.stringify(s.result) : ''}`);
  console.log('   ' + s.fleet.map((f) => `${f.team[0]}:${f.n}${f.alive ? '' : f.withdrawn ? '(W)' : '(X)'} ${f.hull}`).join(' | '));
  if (s.over) break;
}
await page.screenshot({ path: path.join(ROOT, 'tests/shots/battle-probe.png') });
await browser.close(); server.kill();
