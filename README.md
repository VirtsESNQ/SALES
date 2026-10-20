# Halberd Fleet Command: Operation Black Tide (v2)

A 3D browser game where you command the CSV Halberd, a 3 km Concord dreadnought, in a fleet battle against the Hegemony. It plays like War Thunder naval battles, set in space.

## Run it

It is a static site with no build step and no backend. Three.js is vendored in `vendor/`.

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

## Play

1. Pick your side (Concord Navy or Hegemony Battle Fleet), your ship and a difficulty.
2. Everything works with the mouse. The control card (bottom left):
   - **Throttle lever**: drag it, or click a detent (Full Rev, Stop, 25/50/75/100%). **Boost** overheats if you hold it too long.
   - **Helm**: drag the ship's wheel round to set the rudder. It stays where you leave it, like a real rudder. **Planes** climb or dive. **Centre** (or double-click the wheel) puts the rudder midships.
   - **Autopilot**: Hold heading, Auto-level, Slow down.
   - **Mode**: Navigation (drag to look around), Combat (the cursor aims; push it toward the screen edge to look), Precision (fine helm control).
   - **Mouse: Look / Steer**: in Steer the hull turns toward the cursor. The badge at the top always says which one is active.
   - Mouse wheel zooms the view. Middle-drag orbits the view in any mode.
3. Optional keys (rebindable later in the pause menu): W/S throttle, A/D yaw, Q/E roll, R/F vertical thrust, Shift boost, X slow down.

## Test it

The headless Chromium smoke test (Playwright) serves the repo, opens every scenario, fails on any console error, and writes screenshots to `tests/shots/`.

```sh
node tests/smoke.mjs          # all scenarios
node tests/smoke.mjs boot     # only scenarios whose name contains "boot"
```

If Playwright isn't installed, run `npm i -g playwright && npx playwright install chromium`.
`?test=1` exposes `window.__game` (fast-forward simulation, state queries) for the tests. Normal play never exposes it.

## Layout

| Path | What |
|---|---|
| `index.html` | entry point, import map pointing to `vendor/three.module.js` |
| `src/core.js` | renderer, loop, mouse-first input, event bus, settings |
| `src/main.js` | bootstrap and wiring |
| `design/` | the six ship and weapon design sheets (`source_artboards.pdf` is the original) |
| `reference/v1.html` | the published v1 single-file build, kept for reference only |
| `tests/` | smoke harness and scenarios |
