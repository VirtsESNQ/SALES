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
];
