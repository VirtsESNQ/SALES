// Bootstrap: build the engine, wire the systems, expose the ?test=1 hook.
import { Engine, bus, TEST, QUERY, settings } from './core.js';
import { Environment } from './environment.js';
import { startShowcase } from './showcase.js';

const status = document.getElementById('boot-status');
function setStatus(text) { if (status) status.textContent = text; }

function boot() {
  const canvas = document.getElementById('game');
  let engine;
  try {
    engine = new Engine(canvas);
  } catch (e) {
    setStatus('WebGL is not available in this browser.');
    throw e;
  }
  const env = new Environment(engine.scene, engine.renderer);
  const show = startShowcase(engine, env, QUERY.get('showcase') || 'lineup');
  engine.add(show);

  engine.start();
  document.getElementById('boot')?.classList.add('gone');

  if (TEST) {
    window.__game = {
      engine, bus, settings, show,
      /** Fast-forward the simulation without rendering. */
      sim(seconds, dt = 1 / 30) {
        const n = Math.ceil(seconds / dt);
        for (let i = 0; i < n; i++) engine.step(dt);
        return engine.time.sim;
      },
      state() { return { time: engine.time.sim, frame: engine.time.frame, ...show.info() }; },
    };
  }
  return engine;
}

try {
  boot();
} catch (e) {
  console.error(e);
  setStatus(`Startup failed: ${e.message}`);
}
