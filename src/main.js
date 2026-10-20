// Bootstrap: engine, environment, start menu (side/ship choice), then the battle.
// ?showcase=<model> shows a model turntable instead. ?test=1 exposes window.__game for tests;
// with ?side=…&ship=… the menu is skipped.
import { Engine, bus, TEST, QUERY, settings } from './core.js';
import { Environment } from './environment.js';
import { startShowcase } from './showcase.js';
import { Game } from './game.js';
import { Controls, WeaponGrid, FighterPanel } from './controls.js';
import { HUD, ShipStatus, Comms, Objectives, Alerts, EndScreen } from './hud.js';
import { showMenu, PauseMenu } from './menu.js';
import { PLAYABLE } from './mission.js';

const status = document.getElementById('boot-status');
function setStatus(text) { if (status) status.textContent = text; }

function boot() {
  const canvas = document.getElementById('game');
  const ui = document.getElementById('ui');
  let engine;
  try {
    engine = new Engine(canvas);
  } catch (e) {
    setStatus('WebGL is not available in this browser.');
    throw e;
  }
  const env = new Environment(engine.scene, engine.renderer);
  const hook = TEST ? (window.__game = { engine, bus, settings }) : null;
  if (hook) {
    /** Fast-forward the simulation without rendering. */
    hook.sim = (seconds, dt = 1 / 30) => { const n = Math.ceil(seconds / dt); for (let i = 0; i < n; i++) engine.step(dt); return engine.time.sim; };
  }

  if (QUERY.get('showcase')) {
    const show = engine.add(startShowcase(engine, env, QUERY.get('showcase')));
    if (hook) hook.state = () => ({ time: engine.time.sim, frame: engine.time.frame, ...show.info() });
    engine.start();
    document.getElementById('boot')?.classList.add('gone');
    return;
  }

  // menu backdrop: the whole order of battle, slowly orbiting
  const backdrop = engine.add(startShowcase(engine, env, 'lineup'));
  engine.start();
  document.getElementById('boot')?.classList.add('gone');

  const game = new Game(engine, env);
  if (hook) { hook.game = game; hook.state = () => ({ time: engine.time.sim, frame: engine.time.frame, ...(game.state() || { menu: true }) }); }

  const begin = (choice) => {
    engine.systems.splice(engine.systems.indexOf(backdrop), 1);
    backdrop.dispose();
    const controls = new Controls(game, ui);
    game.addSystem(controls);
    game.controls = controls;
    const right = document.createElement('div'); right.className = 'rightcol'; ui.appendChild(right);
    game.hud = new HUD(game, ui, right);
    game.fpanel = new FighterPanel(game, right);
    game.grid = new WeaponGrid(game, right);
    game.status = new ShipStatus(game, ui);
    game.comms = new Comms(game, ui);
    game.pause = new PauseMenu(game, ui);
    game.objectives = new Objectives(game, ui);
    game.alerts = new Alerts(game, ui);
    game.end = new EndScreen(game, ui);
    game.autoplay = TEST && QUERY.get('autoplay') === '1';
    game.start(choice);
    const uiParts = [controls, game.hud, game.fpanel, game.grid, game.status, game.comms, game.alerts];
    engine.add({ update: (dt) => game.update(dt), render: (dt) => { game.render(dt); for (const u of uiParts) u.render(dt); } });
  };
  const side = QUERY.get('side'), ship = QUERY.get('ship');
  if (side && PLAYABLE[side]?.some((p) => p.cls === ship)) begin({ side, ship });
  else showMenu(ui).then(begin);
}

try {
  boot();
} catch (e) {
  console.error(e);
  setStatus(`Startup failed: ${e.message}`);
}
