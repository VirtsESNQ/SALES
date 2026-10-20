// Test scenarios run by tests/smoke.mjs. Each milestone adds its checks here.
const waitGame = (page) => page.waitForFunction(() => window.__game && window.__game.engine.time.frame > 5, null, { timeout: 30000 });

export const scenarios = [
  {
    name: 'menu-choose-hegemony',
    async run(page, t) {
      await page.waitForSelector('.menu .side', { timeout: 30000 });
      await page.waitForTimeout(900);
      await t.shot('menu');
      await page.click('.side.hegemony');
      await page.click('[data-ship="kesh"]');
      await t.shot('menu-hegemony');
      await page.click('.go');
      await page.waitForFunction(() => window.__game.state().ship, null, { timeout: 15000 });
      const s = await page.evaluate(() => window.__game.state());
      t.assert(s.team === 'hegemony' && s.cls === 'kesh' && s.ship === 'Kesh', `player is the Kesh (${JSON.stringify(s)})`);
      await page.waitForTimeout(600);
      await t.shot('play-kesh');
    },
  },
  {
    name: 'helm-halberd',
    url: 'index.html?test=1&side=concord&ship=halberd',
    async run(page, t) {
      await page.waitForFunction(() => window.__game?.state?.().ship, null, { timeout: 30000 });
      const st = () => page.evaluate(() => window.__game.state());
      const sim = (s) => page.evaluate((x) => window.__game.sim(x), s);
      // throttle lever: click the 100% detent label
      await page.click('.thr-l[data-i="5"]');
      await sim(20);
      let s = await st();
      t.assert(s.detent === 5 && s.speed > 40 && s.speed < 100, `accelerates slowly (speed ${s.speed.toFixed(1)} after 20 s)`);
      await sim(40);
      s = await st();
      t.assert(s.speed > 125 && s.speed <= 141, `reaches top speed (${s.speed.toFixed(1)})`);
      // drag the lever down to STOP
      const tr = await page.locator('.thr-track').boundingBox();
      await page.mouse.move(tr.x + tr.width / 2, tr.y + 10); await page.mouse.down();
      await page.mouse.move(tr.x + tr.width / 2, tr.y + tr.height * 0.8, { steps: 6 }); await page.mouse.up();
      s = await st();
      t.assert(s.detent === 1, `lever drag snaps to STOP (detent ${s.detent})`);
      await page.click('.thr-l[data-i="4"]');
      // turn the wheel to starboard by dragging around its hub
      const w = await page.locator('.wheel').boundingBox();
      const cx = w.x + w.width / 2, cy = w.y + w.height / 2;
      await page.mouse.move(cx, cy - 40); await page.mouse.down();
      await page.mouse.move(cx + 40, cy, { steps: 8 }); await page.mouse.up();
      const h0 = (await st()).heading;
      await sim(30);
      s = await st();
      t.assert(s.heading < h0 - 0.05, `wheel to starboard turns right (heading ${h0.toFixed(3)} -> ${s.heading.toFixed(3)})`);
      await page.waitForTimeout(400);
      await t.shot('helm-turning');
      // hold heading: wheel recentres and the turn stops
      await page.click('[data-ap="hold"]');
      await sim(30);
      const h1 = (await st()).heading; await sim(20); const h2 = (await st()).heading;
      t.assert(Math.abs(h2 - h1) < 0.01, `hold heading keeps course (${h1.toFixed(3)} vs ${h2.toFixed(3)})`);
      // boost heats up; slowdown brings the ship down
      await page.click('.sw-boost');
      await sim(6);
      s = await st();
      t.assert(s.boosting && s.boostHeat > 0.4, `boost on and heating (${s.boostHeat.toFixed(2)})`);
      await sim(10);
      s = await st();
      t.assert(!s.boosting, 'boost cuts out when overheated');
      await page.click('[data-ap="slow"]');
      const v0 = (await st()).speed; await sim(15); const v1 = (await st()).speed;
      t.assert(v1 < v0 - 30, `controlled slowdown (${v0.toFixed(0)} -> ${v1.toFixed(0)})`);
      // mode switch and mouse steering switch
      await page.click('[data-mode="precision"]');
      t.assert((await st()).mode === 'precision', 'mode switch to PRECISION');
      await page.click('[data-mode="nav"]');
      await page.click('[data-ms="steer"]');
      t.assert(await page.evaluate(() => window.__game.settings.mouseSteer), 'mouse steering on');
      await page.waitForFunction(() => document.querySelector('.look-badge').textContent.includes('STEERS'), null, { timeout: 5000 });
      await page.click('[data-ms="look"]');
      await page.waitForTimeout(300);
      await t.shot('helm-card');
    },
  },
  {
    name: 'play-varr',
    url: 'index.html?test=1&side=hegemony&ship=varr',
    async run(page, t) {
      await page.waitForFunction(() => window.__game?.state?.().ship, null, { timeout: 30000 });
      await page.waitForTimeout(800);
      const s = await page.evaluate(() => window.__game.state());
      t.assert(s.ship === 'Varr Tolun', 'commanding the Varr Tolun');
      await t.shot('play-varr');
    },
  },
  {
    name: 'no-test-hook',
    url: 'index.html',
    async run(page, t) {
      await page.waitForTimeout(1500);
      t.assert(await page.evaluate(() => window.__game === undefined), 'test hook must be off without ?test=1');
    },
  },
  ...['halberd', 'concord-line', 'varr-tolun', 'hegemony-line', 'arsenal', 'small-craft', 'index'].map((sheet) => ({
    name: `design-${sheet}`,
    url: `design/${sheet}.html`,
    viewport: { width: 1500, height: 1000 },
    async run(page, t) {
      await page.waitForFunction(() => document.querySelector('.arm li, .wcard, .craft .meta, .card'), null, { timeout: 10000 });
      if (sheet === 'halberd') {
        const total = await page.textContent('.arm .total');
        t.assert(total.trim() === '101', `Halberd total mounts = 101 (got ${total})`);
      }
      await t.shot(`design-${sheet}`);
    },
  })),
  {
    name: 'data-arsenal',
    url: 'design/index.html',
    async run(page, t) {
      const r = await page.evaluate(async () => {
        const a = await import('../src/data/arsenal.js');
        const s = await import('../src/data/ships.js');
        const tot = (k) => Object.values(a.LOADOUTS[k]).reduce((x, y) => x + y, 0);
        return { cat: a.CATALOGUE.length, halberd: tot('halberd'), md: a.LOADOUTS.halberd.massdriver, mine: a.LOADOUTS.halberd.mine,
          rampart: tot('rampart'), varr: tot('varr'), kesh: tot('kesh'), ulthane: tot('ulthane'), mounts: s.CLASSES.halberd.mounts };
      });
      t.assert(r.cat === 12, '12 catalogue weapons');
      t.assert(r.halberd === 101 && r.mounts === 101, 'Halberd = 101 mounts');
      t.assert(r.md > 0 && r.mine > 0, 'Halberd carries mass drivers and gravity mines');
      t.assert(r.rampart === 46 && r.varr === 69 && r.kesh === 35 && r.ulthane === 28, `sheet totals ${JSON.stringify(r)}`);
    },
  },
  ...['planet', 'lineup', 'halberd', 'rampart', 'warden', 'varr', 'kesh', 'ulthane', 'talon', 'viper', 'falcon', 'hammer', 'wardengs', 'razor', 'wasp', 'scythe', 'maul'].map((m) => ({
    name: `model-${m}`,
    url: m === 'planet' ? 'index.html?test=1&showcase=halberd&az=3.6&dist=1.3' : `index.html?test=1&showcase=${m}`,
    async run(page, t) {
      await waitGame(page);
      await page.waitForTimeout(900);
      const info = await page.evaluate(() => window.__game.state());
      t.assert(info.ships.length + info.craft > 0, `showcase has content ${JSON.stringify(info)}`);
      await t.shot(`model-${m}`);
    },
  })),
];
