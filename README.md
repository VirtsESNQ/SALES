# Halberd Fleet Command: Operation Black Tide (v2)

A 3D browser game where you command the CSV Halberd, a 3 km Concord dreadnought, in a fleet battle against the Hegemony. It plays like War Thunder naval battles, set in space.

## Run it

It is a static site with no build step and no backend. Three.js is vendored in `vendor/`.

```sh
python3 -m http.server 8000
# open http://localhost:8000/
```

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
