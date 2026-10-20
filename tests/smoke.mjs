// Headless browser smoke test: serves the repo statically, opens each scenario in
// Chromium, fails on any console error / page error, and writes screenshots to tests/shots/.
//   node tests/smoke.mjs            run every scenario
//   node tests/smoke.mjs bridge     run scenarios whose name contains "bridge"
import { createRequire } from 'node:module';
import { execSync, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { scenarios } from './scenarios.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = path.join(ROOT, 'tests', 'shots');
const PORT = 8000 + Math.floor(Math.random() * 900);

function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try { return require('playwright'); } catch { /* fall through to the global install */ }
  const globalRoot = execSync('npm root -g').toString().trim();
  return require(path.join(globalRoot, 'playwright'));
}

function launchOptions() {
  const opts = {
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
  };
  // Cloud sandboxes ship Chromium here; elsewhere Playwright finds its own download.
  const local = '/opt/pw-browsers/chromium';
  if (!process.env.PLAYWRIGHT_BROWSERS_PATH && existsSync(local)) opts.executablePath = local;
  return opts;
}

async function waitForServer(url, tries = 50) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`static server did not start at ${url}`);
}

const filter = process.argv[2] || '';
const selected = scenarios.filter((s) => s.name.includes(filter));
const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
let failed = 0;
try {
  const base = `http://127.0.0.1:${PORT}/`;
  await waitForServer(base);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch(launchOptions());
  for (const sc of selected) {
    const page = await browser.newPage({ viewport: sc.viewport || { width: 1600, height: 900 } });
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
    const ctx = {
      base,
      shot: (name) => page.screenshot({ path: path.join(SHOTS, `${name}.png`) }),
      log: (...a) => console.log(`   ${sc.name}:`, ...a),
      assert(cond, msg) { if (!cond) throw new Error(`assert failed: ${msg}`); },
    };
    const t0 = Date.now();
    try {
      await page.goto(base + (sc.url || 'index.html?test=1'), { waitUntil: 'load' });
      await sc.run(page, ctx);
      if (errors.length) throw new Error(`${errors.length} browser error(s):\n     ${errors.slice(0, 12).join('\n     ')}`);
      console.log(`ok   ${sc.name} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    } catch (e) {
      failed++;
      console.log(`FAIL ${sc.name}: ${e.message}`);
      if (errors.length && !e.message.includes('browser error')) console.log(`     ${errors.slice(0, 12).join('\n     ')}`);
      await ctx.shot(`FAIL-${sc.name}`).catch(() => {});
    }
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
}
console.log(failed ? `\n${failed} scenario(s) failed` : `\nall ${selected.length} scenario(s) passed`);
process.exit(failed ? 1 : 0);
