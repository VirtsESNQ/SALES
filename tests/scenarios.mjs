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
      await page.waitForFunction(() => document.querySelector('.look-badge').textContent.includes('STEERS'), null, { timeout: 15000 });
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
  {
    name: 'gunnery-halberd',
    url: 'index.html?test=1&side=concord&ship=halberd',
    async run(page, t) {
      await page.waitForFunction(() => window.__game?.state?.().ship, null, { timeout: 30000 });
      const st = () => page.evaluate(() => window.__game.state());
      const sim = (s) => page.evaluate((x) => window.__game.sim(x), s);
      // park the Varr Tolun 9 km off the bow, broadside on
      await page.evaluate(() => {
        const g = window.__game.game, v = g.ships.find((s) => s.cls === 'varr');
        v.root.position.set(0, 300, 9000); v.root.rotation.set(0, Math.PI / 2, 0); v.root.updateMatrixWorld(); v.inv.copy(v.root.matrixWorld).invert();
      });
      await sim(0.2);
      await page.waitForTimeout(500);
      // lock it from the contact list
      await page.locator('.contact', { hasText: 'Varr Tolun' }).dispatchEvent('pointerdown');
      let s = await st();
      t.assert(s.target === 'Varr Tolun', `locked target (${s.target})`);
      // select heavy turbolasers on the grid, put the cursor on the target
      await page.click('.wt[data-t="heavy"]');
      const tgt = await page.evaluate(() => { const g = window.__game.game, v = g.player.target; const p = v.center().project(g.engine.camera); return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight }; });
      await page.mouse.move(tgt.x, tgt.y);
      await sim(12);
      s = await st();
      t.assert(s.groups.heavy.alive === 8 && s.groups.heavy.total === 8, 'heavy battery shows 8/8');
      t.assert(s.groups.heavy.state === 'ready', `heavy battery aligned and ready (${s.groups.heavy.label})`);
      await page.waitForFunction(() => document.querySelector('.rdy-main span').textContent.includes('ALIGNED · READY TO FIRE'), null, { timeout: 15000 });
      await t.shot('gunnery-ready');
      // fire: hold the left button on the battlefield
      const hp = () => page.evaluate(() => { const v = window.__game.game.player.target; return v.hull + v.shields.reduce((a, b) => a + b, 0); });
      await page.click('[data-d="hold"]'); // other batteries hold fire so only this salvo counts
      const sh0 = await hp();
      await page.mouse.move(tgt.x, tgt.y);
      await sim(2);
      await page.mouse.down();
      await sim(0.6);
      await page.waitForTimeout(250);
      await t.shot('gunnery-salvo');
      await page.mouse.up();
      await sim(4);
      const sh1 = await hp();
      t.assert(sh1 < sh0 - 400, `turbolaser salvo hits (${Math.round(sh0)} -> ${Math.round(sh1)})`);
      s = await st();
      t.assert(s.groups.heavy.state === 'reload', `battery reloading after the salvo (${s.groups.heavy.state})`);
      // broadsides are out of arc with the bow on the target and say which side to turn
      await page.click('.wt[data-t="broadside"]');
      await sim(1);
      s = await st();
      t.assert(s.groups.broadside.state === 'arc' && /TURN (PORT|STARBOARD)/.test(s.groups.broadside.label), `broadside asks to turn a side (${s.groups.broadside.label})`);
      // turn the starboard side toward the Varr: broadsides come to bear
      await page.evaluate(() => { const p = window.__game.game.player; p.root.rotation.set(0, Math.PI / 2, 0, 'YXZ'); p.root.updateMatrixWorld(); p.inv.copy(p.root.matrixWorld).invert(); });
      await page.mouse.move(tgt.x, tgt.y);
      await page.evaluate(() => { const g = window.__game.game; g.weapons.manualAim.copy(g.player.target.center()); });
      await sim(8);
      s = await st();
      t.assert(s.groups.broadside.state === 'ready' || s.groups.broadside.state === 'traversing', `broadside bears when turned (${s.groups.broadside.label})`);
      // spinal lance: bow on target, charge then beam
      await page.evaluate(() => { const p = window.__game.game.player; p.root.rotation.set(0, 0, 0, 'YXZ'); p.root.updateMatrixWorld(); p.inv.copy(p.root.matrixWorld).invert(); p.angVel.set(0, 0, 0); });
      await page.click('.wt[data-t="lance"]');
      await page.evaluate(() => { const g = window.__game.game; g.player.targetSub = 'hull'; });
      await sim(1);
      s = await st();
      t.assert(s.groups.lance.state === 'ready', `lance ready with the bow on target (${s.groups.lance.label})`);
      const hull0 = await page.evaluate(() => window.__game.game.player.target.hull + window.__game.game.player.target.shields.reduce((a, b) => a + b, 0));
      await page.click('.wt[data-t="lance"] .wt-fire');
      await sim(1.2);
      s = await st();
      t.assert(s.groups.lance.state === 'firing', 'lance charging');
      await sim(1.8);
      await page.waitForTimeout(300);
      await t.shot('gunnery-lance');
      await sim(1.5);
      const hull1 = await page.evaluate(() => window.__game.game.player.target.hull + window.__game.game.player.target.shields.reduce((a, b) => a + b, 0));
      t.assert(hull1 < hull0 - 2000, `lance beam deals heavy damage (${Math.round(hull0 - hull1)})`);
      // missiles: launch a VLS salvo at the locked target
      await page.click('.wt[data-t="vls"] .wt-fire');
      s = await st();
      t.assert(s.missiles >= 10, `VLS salvo launched (${s.missiles} missiles)`);
      await sim(1.5);
      await page.waitForTimeout(300);
      await t.shot('gunnery-missiles');
      // gravity mines drop astern
      await page.click('.wt[data-t="mine"] .wt-fire');
      s = await st();
      t.assert(s.mines >= 6, `mines dropped (${s.mines})`);
      // enemy missiles get engaged by point defence
      const before = await page.evaluate(() => {
        const g = window.__game.game, v = g.player.target;
        v.target = g.player;
        for (const m of v.mounts.filter((x) => x.type === 'vls')) { m.cd = 0; g.weapons.fire(v, m, g.player.pos, g.player); }
        return g.weapons.missiles.filter((m) => m.team === 'hegemony').length;
      });
      t.assert(before >= 6, `enemy launched missiles (${before})`);
      await sim(30);
      const pdKills = await page.evaluate(() => window.__game.game.player.stats.intercepts || 0);
      t.assert(pdKills >= 1, `point defence shot down incoming missiles (${pdKills})`);
      // scope: hold right mouse
      await page.click('.wt[data-t="heavy"]');
      const tgt2 = await page.evaluate(() => { const g = window.__game.game, v = g.player.target; const p = v.center().project(g.engine.camera); return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight }; });
      await page.mouse.move(tgt2.x, tgt2.y);
      await sim(0.2);
      await page.mouse.down({ button: 'right' });
      await page.waitForFunction(() => window.__game.engine.camera.fov < 30, null, { timeout: 15000 });
      await page.waitForTimeout(300);
      const scoped = await page.evaluate(() => { const g = window.__game.game, c = g.engine.camera; const p = g.player.target.center().project(c); return { x: p.x, y: p.y, fov: c.fov }; });
      t.assert(scoped.fov < 30 && Math.abs(scoped.x) < 0.5 && Math.abs(scoped.y) < 0.5, `scope looks at the target (${JSON.stringify(scoped)})`);
      await page.waitForTimeout(600);
      s = await st();
      t.assert(s.scope && s.view === 'scope', 'right mouse opens the scope');
      await t.shot('gunnery-scope');
      await page.mouse.up({ button: 'right' });
      await page.waitForTimeout(200);
      s = await st();
      t.assert(!s.scope && s.view === 'chase', 'releasing right mouse closes the scope');
    },
  },
  {
    name: 'damage-model',
    url: 'index.html?test=1&side=concord&ship=halberd',
    async run(page, t) {
      await page.waitForFunction(() => window.__game?.state?.().ship, null, { timeout: 30000 });
      const st = () => page.evaluate(() => window.__game.state());
      const sim = (s) => page.evaluate((x) => window.__game.sim(x), s);
      // a hit on the fore shield sector, then recharge after the delay
      const hitFore = (dmg) => page.evaluate(async (d) => {
        const g = window.__game.game, p = g.player, { applyHit } = await import('./src/damage.js');
        const local = p.shieldC.clone(); local.z += p.shieldR.z;
        const src = g.ships.find((s) => s.team !== p.team);
        return applyHit(p, { local, point: p.toWorld(local), shield: true, sector: 0 }, d, { shieldMul: 1 }, src);
      }, dmg);
      await hitFore(3000);
      let s = await st();
      t.assert(s.shields[0] < 7500 * 0.8 && s.shields[1] === 7500, `fore sector absorbs the hit (${s.shields.map(Math.round)})`);
      const low = s.shields[0];
      await sim(2);
      t.assert((await st()).shields[0] === low, 'no recharge during the delay');
      await sim(8);
      t.assert((await st()).shields[0] > low + 300, 'sector recharges after the delay');
      // knock the fore sector flat: the next hit reaches the hull
      await hitFore(20000);
      s = await st();
      t.assert(s.shields[0] <= 0 && s.hull < s.maxHull, `shield collapse lets damage through (${Math.round(s.hull)})`);
      // boost a sector by clicking the diagram
      await page.locator('.sec[data-s="1"]').dispatchEvent('pointerdown');
      s = await st();
      t.assert(s.shieldBoost === 1, 'clicking the aft sector boosts it');
      await page.waitForTimeout(400);
      await t.shot('damage-status');
      // engines destroyed: top speed falls
      await page.evaluate(() => { const p = window.__game.game.player; p.subs.engines.hp = 0; p.vel.set(0, 0, 0); p.setDetent(5); });
      await sim(20);
      s = await st();
      t.assert(s.speed < 30, `engines out: ship accelerates far slower (${s.speed.toFixed(0)} m/s after 20 s, ~64 when intact)`);
      // critical hit starts a fire; damage control puts it out
      await page.evaluate(() => { const g = window.__game.game; g.damage.critical(g.player, g.player.subs.reactor.pos.clone(), 900, null); g.player.fires.push({ p: g.player.shieldC.clone(), t: 6, dps: 5 }); });
      s = await st();
      t.assert(s.fires >= 1, 'fire on board');
      await sim(25);
      t.assert((await st()).fires === 0, 'fires burn out / are contained');
      // staged destruction of a Kesh cruiser near the player
      await page.evaluate(() => {
        const g = window.__game.game, k = g.ships.find((s) => s.cls === 'kesh');
        k.root.position.set(1800, 600, 5200); k.root.updateMatrixWorld(); k.inv.copy(k.root.matrixWorld).invert();
        g.player.target = k; k.hull = 1;
        g.camera.yaw = Math.PI * 0.85; g.camera.pitch = 0.25; g.camera.zoom = 1.6;
      });
      await page.evaluate(async () => { const g = window.__game.game, k = g.player.target, { applyHit } = await import('./src/damage.js'); const local = k.shieldC.clone(); applyHit(k, { local, point: k.toWorld(local), shield: false, sector: 0 }, 99999, {}, g.player); });
      await sim(1);
      let k = await page.evaluate(() => { const k = window.__game.game.player.target; return { alive: k.alive, dying: k.dying, blown: !!k.blown }; });
      t.assert(!k.alive && k.dying && !k.blown, 'stage 1: explosion cascade');
      await page.waitForTimeout(500);
      await t.shot('death-cascade');
      await sim(4);
      k = await page.evaluate(() => { const k = window.__game.game.player.target; return { blown: !!k.blown, wreck: !!k.wreck, gap: k.model.fore.position.distanceTo(k.model.aft.position) }; });
      t.assert(k.blown && k.wreck, 'stage 2: reactor blast leaves a wreck');
      await sim(20);
      k = await page.evaluate(() => { const k = window.__game.game.player.target; return { gap: k.model.fore.position.distanceTo(k.model.aft.position) }; });
      t.assert(k.gap > 300, `stage 3: hull broken in two and drifting apart (${Math.round(k.gap)} m)`);
      await page.waitForTimeout(500);
      await t.shot('death-wreck');
      // pause menu: camera shake slider + off switch
      await page.click('.pause-btn');
      t.assert(await page.evaluate(() => window.__game.engine.time.paused), 'menu pauses the battle');
      await page.locator('.p-shake').fill('0.2');
      await page.click('.p-shakeoff');
      const set = await page.evaluate(() => ({ shake: window.__game.settings.shake, on: window.__game.settings.shakeOn }));
      t.assert(set.shake === 0.2 && set.on === false, `shake slider and off switch (${JSON.stringify(set)})`);
      await t.shot('pause-menu');
      await page.click('.p-shakeoff');
      await page.click('.p-resume');
      t.assert(!(await page.evaluate(() => window.__game.engine.time.paused)), 'resume unpauses');
    },
  },
];
