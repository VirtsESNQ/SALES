// Test scenarios run by tests/smoke.mjs. Each milestone adds its checks here.
const waitGame = (page) => page.waitForFunction(() => window.__game && window.__game.engine.time.frame > 5, null, { timeout: 30000 });

export const scenarios = [
  {
    name: 'boot',
    async run(page, t) {
      await waitGame(page);
      const s = await page.evaluate(() => { window.__game.sim(5); return window.__game.state(); });
      t.assert(s.time >= 5, 'sim fast-forward advances time');
      await t.shot('boot');
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
];
