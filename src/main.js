// Bootstrap: build the engine, wire the systems, expose the ?test=1 hook.
import * as THREE from 'three';
import { Engine, bus, TEST, settings } from './core.js';

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
  const { scene } = engine;

  // M0 placeholder scene: light and a reference block so the loop is visibly running.
  scene.add(new THREE.AmbientLight(0x8899aa, 0.4));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
  sun.position.set(1, 0.6, 0.4);
  scene.add(sun);
  const block = new THREE.Mesh(new THREE.BoxGeometry(3000, 300, 800), new THREE.MeshStandardMaterial({ color: 0x8a96a0, metalness: 0.5, roughness: 0.6 }));
  scene.add(block);
  engine.camera.position.set(2600, 1400, 4200);
  engine.camera.lookAt(0, 0, 0);
  engine.add({ update(dt) { block.rotation.y += dt * 0.05; } });

  engine.start();
  document.getElementById('boot')?.classList.add('gone');

  if (TEST) {
    window.__game = {
      engine, bus, settings,
      /** Fast-forward the simulation without rendering. */
      sim(seconds, dt = 1 / 30) {
        const n = Math.ceil(seconds / dt);
        for (let i = 0; i < n; i++) engine.step(dt);
        return engine.time.sim;
      },
      state() { return { time: engine.time.sim, frame: engine.time.frame }; },
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
