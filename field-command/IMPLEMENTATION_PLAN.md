# Field Command — Ralph Implementation Plan

This file is persistent project memory for the Ralph loop. Re-check the source before trusting any task or status. Never mark a task complete without evidence.

## Baseline and stability

- [x] **FC-001 — Map the architecture** (`DONE`, iteration 1): see "Architecture map" below.
- [x] **FC-002 — Establish validation** (`DONE`, iteration 1): no test setup existed. Added `tests/harness.js` (local static server + Playwright Chromium with SwiftShader WebGL; all external network blocked; fails on any page error) and `tests/smoke.test.js`. Run: `node --check game.js && node tests/harness.js tests/smoke.test.js` and `FC_NO_WEBGL=1 node tests/harness.js tests/smoke.test.js` (2D fallback). Uses the globally installed `playwright` (falls back to `/opt/node22/lib/node_modules/playwright`). three.js r128 is now vendored at `vendor/three.min.js` (copied from npm `three@0.128.0`, MIT licence in `vendor/three.LICENSE`) so the game and tests no longer need cdnjs.
- [~] **FC-003 — Verify startup and mode launch** (`DONE` for the listed scope; other modes are FC-072..074): smoke test covers menu cards, WebGL init, Cannae and Ironbridge launch into deployment, 2D->3D->2D switching, begin, two resolved turns with attack orders, finite unit state, restart, back to menu. Also passes with WebGL disabled (3D request stays on 2D). Screenshots inspected manually (`ironbridge_turn3.png`): renders correctly. Not covered: Endless War, editor, multiplayer, mobile/touch layouts.

## Core interaction

- [ ] **FC-010 — Audit selection and orders** (`TODO`): verify click, shift-select, box select, double-click, group/wing selection, move, attack, halt, advance, charge, retreat, rally, and facing.
  - Acceptance: each action has one clear result; UI feedback matches the resulting state; camera gestures do not accidentally issue orders.
- [ ] **FC-011 — Audit camera and coordinate transforms** (`TODO`): zoom, pan, rotation, fit-map, minimap navigation, canvas scaling, and 2D/3D coordinate conversion.
  - Acceptance: pointer-to-world conversion remains correct at different zooms/rotations and in both views.
- [ ] **FC-012 — Improve order feedback** (`TODO`): display destination, facing, order state, blocked state, and selected-unit status clearly.
  - Acceptance: the player can understand why a selected unit is moving, stopped, unable to fire, or following another order.

## Simulation and scale

- [x] **FC-020 — Audit range and movement data** (`DONE` as an audit, iteration 1; no values changed yet): `tests/ranges.audit.js` dumps the live `TYPES` table after all runtime overrides (59 types). See "FC-020 audit findings" below.
  - Acceptance: create a verified table of relevant values and identify actual balance/consistency issues before changing values.
- [x] **FC-021 — Align range UI and simulation** (`DONE`, iteration 2; tooltip/ring wording verified by code reading only): `canEngage(b,a,t,p)` in `game.js` (ENGAGEMENT RULES block after the `chooseTarget` override) is the single rule: armour → range → min range → observer (indirect) → line of sight. Used by `tbLOS` (therefore `tbPlan`, `tbStrike`, `tbOverwatch`, `tbPreview`), the enemy's `chooseTarget`, the matchup tooltip (`showTip`, shows `ENG_WHY` reason and the observer's name) and the unit card's "Best target in reach". Range ring now draws the true `R.range` (the old `Math.min(R.range,900)` cap removed) plus a red inner ring for `R.min`.
  - Acceptance: test in-range, out-of-range, minimum-range, invalid-armour, and blocked-LOS cases. → `tests/engage.test.js` covers all five plus observer cases.
- [x] **FC-022 — Audit LOS and spotting** (`DONE`, iteration 2): rules now —
  - **Direct fire** (`losInfo`): blocked when the ground (`heightAt`, the same heights the 3D mesh uses) rises more than 2.5 units above the sight line between eye heights (foot 3, vehicles 4, mounted 5), ignoring 14 units at each end; or when the line crosses more than 24 units of woods, or of buildings (14 on city maps), ignoring 18 units at each end. Air units and sea/space theatres are exempt.
  - **Indirect fire** (`OBSERVED` weapons: shell, rocket, mortar, siege): needs an observer on the same side within `spotR(era)×1.6` (×1.7 for scouts/snipers, ×2.2 for drones/ornithopters) with line of sight to the target; the gun itself counts. Without one the unit holds still (`tbPlan` returns `noObs`) instead of driving toward the target.
  - Other `INDIRECT` weapons (fireball, breath, swarm, vls, airwing, bomb, zbomb) keep ignoring LOS. Napoleonic `cannon` removed from `INDIRECT`: it is direct fire now.
  - Concealment (`tbSpotted`, ×0.2 damage on unseen targets in woods/towns) is unchanged and separate.
  - The dead real-time `step()` path was not touched.
  - Acceptance: documented and tested rules; no UI promise of a valid shot when a hidden condition prevents it without explanation.
- [~] **FC-023 — Tune map scale by era** (`IN_PROGRESS`, iteration 2): weapon-specific ranges set in `RANGE_TUNE` (not a global multiplier). Modern direct fire now 75–240 (rifle 75, IFV 160, tank 220, ATGM 240, sniper 150), long-range systems 520–750 but gated by observers/LOS (howitzer 650, MLRS 750, SAM 520), gunships 260; historical: archers 150, cannon 300 (muskets 75 unchanged); fantasy/steam/naval/space long guns trimmed (e.g. dreadnought 480, carrier 600, battleship 420; flagship guns 400–500). Scenario briefs that promised whole-map artillery were rewritten. Not yet done: a playtest per era to confirm pacing (turns to first contact, whether AI artillery finds observers), movement-speed review for modern infantry.
  - Acceptance: no global multiplier without justification; representative battles retain meaningful positioning and counterplay.

## Formations and movement

- [ ] **FC-030 — Trace battle-line formation code** (`TODO`): find input handling, world-coordinate conversion, slot generation, movement orders, and facing.
- [ ] **FC-031 — Shared formation preview and deployment** (`TODO`): use the same calculated slots for preview and confirmed orders.
  - Acceptance: line, diagonal, vertical, and rotated-camera cases produce the same preview and final arrangement.
- [ ] **FC-032 — Add formation choices** (`TODO`): line, column, wedge, skirmish, defensive, subject to current unit types/era.
  - Acceptance: formations affect spacing, frontage, facing, movement, and/or combat in documented ways, not just labels.
- [ ] **FC-033 — Prevent movement jams** (`TODO`): detect no-progress, handle obstacles/bounds, prevent infinite jitter and unit stacking.
  - Acceptance: valid destinations are reached where possible; impossible orders fail visibly and safely.

## Combat presentation

- [ ] **FC-040 — Trace combat event lifecycle** (`TODO`): follow attack command through target choice, damage resolution, and rendering/audio feedback.
- [ ] **FC-041 — Weapon-specific fire and impact feedback** (`TODO`): connect effects to actual shots and impacts; prevent duplicate damage or effects.
- [ ] **FC-042 — Morale/suppression/routing feedback** (`TODO`): ensure visible states reflect simulation state and remain era-appropriate.
- [ ] **FC-043 — Effect performance** (`TODO`): inspect allocations, pooling, cleanup, zoom-dependent detail, and large-army behaviour.

## Models, animation, and rendering

- [ ] **FC-050 — Audit 3D rendering costs** (`TODO`): inspect instancing, materials, geometry reuse, shadows, per-frame allocations, resource cleanup, and external dependencies.
- [ ] **FC-051 — Improve troop/vehicle silhouettes and detail** (`TODO`): prioritize recognizability and consistent style over raw polygon count.
- [ ] **FC-052 — Add/repair zoom-level detail** (`TODO`): strategic readability, tactical silhouettes, close-up animation/effects.
- [ ] **FC-053 — Preserve fallback and mode switching** (`TODO`): verify 2D fallback and no resource leaks when toggling views or changing battles.

## Tactical depth and AI

- [ ] **FC-060 — Audit facing and flanking** (`TODO`): verify calculations use world-space orientation and are camera-independent.
- [ ] **FC-061 — Audit morale, fatigue, cohesion, routing** (`TODO`): document existing state transitions and add regression tests before extending mechanics.
- [ ] **FC-062 — Improve AI decisions** (`TODO`): identify concrete failure cases in target selection, regrouping, terrain use, flanking, and order churn.
- [ ] **FC-063 — Add tactical mechanics only when justified** (`TODO`): spotting, suppression, command effects, or new unit roles only after the core loop works.

## Existing modes and regression coverage

- [ ] **FC-070 — Historical scenario regression** (`TODO`): Cannae, Agincourt, Hastings, Austerlitz.
- [ ] **FC-071 — Modern scenario regression** (`TODO`): Ironbridge and Glass Sky.
- [ ] **FC-072 — Endless War persistence** (`TODO`): campaign progress, survivors/veterans, restart/continue.
- [ ] **FC-073 — Map editor regression** (`TODO`): place/edit terrain and units, save/export/import/play draft where supported.
- [ ] **FC-074 — Multiplayer regression** (`TODO`): inspect synchronization/turn state and test when a local test path exists.
- [ ] **FC-075 — Full integration pass** (`TODO`): representative play-through, performance check, and review of all changed files.

## Architecture map (FC-001, verified by reading `game.js`, iteration 1)

Single classic script `game.js` (~432 KB, ~4000 lines, dense one-line functions). Later sections extend earlier ones by reassigning globals (`const _x=x; x=function(){...}`), so always search for every definition of a function: e.g. `genTerrain/genHeight/genDecor/genPaint`, `makeBattle`, `blocked`, `tbMoveRange`, `tbPath`, `shotFx`, `glyph`, `figure`, `unitLayout`, `buildMirrorScenario`, `buildEndlessScenario`, `chooseTarget`, `matchWhy` are all redefined after first definition.

- **World**: `W=1000, H=640` world units (game.js:4) for every mode; hard-coded `1000-x`/`640-y` mirroring in `mirrorMap`, `buildMirrorScenario`, net code (`netMir`, `netApplyState`). Metres per unit per era in `MSCALE` (`mPer`): modern 5, napoleon 2, steam/sail 2, navy/dread 20, space 50, else 1. Spot radius `SPOT`/`spotR`.
- **Data**: `TYPES` (unit archetypes, game.js:5 + `Object.assign(TYPES,…)` ~1312), `WEAP` (weapon × armour multipliers), `ROLE`, `SPACING`, `TYPE_NOTE`, `BEATS/FEARS`, matchup table `MT` via `defM`/`matchCode`, `ROSTER` (buyable units per era), `MIRROR` (equal-army lists), `SCEN` (scenarios; `addScen` for later ones).
- **Simulation (live path = turn-based)**: `makeBattle` builds units. Round: `execTurn` -> `tbBuildRound` queue -> `tbTick`/`tbBegin` play it (`tbPhase` per side: everyone moves via `tbRunItem`, then strikes one by one via `tbStrike`), then `tbOverwatch`, `tbMeleeAll`, `tbEndRound` (morale recovery, dug-in, victory check). Orders resolved by `tbPlan` (move range `tbMoveRange`, path `tbPath` + A* `navAstar` for city/sea maps, range/LOS checks). Damage: `tbRangedHit`, `tbMeleeHit` -> `melee()`; applied in `tbApply` (morale, rout via `routUnit`). Enemy AI: `tbEnemyPlan`/`tbEnemyReplan`. Headless: `tbRoundSync`.
- **Dead code**: the real-time loop `step()` and `aiTick()` (between `// SIM-START` and `// SIM-END`) is never called. Do not tune it expecting effect; the live rules are the `tb*` functions.
- **Rendering**: 2D `render2d` (painted `terrainCv` + `drawUnit`); 3D three.js r128: `v3init`, `v3build` (terrain mesh from `heightAt`, instanced trees/houses, instanced unit-part meshes `V3.P`), `v3render` per frame (fills instances per figure; `v3extra` for non-classic types), `v3post` (blur/vignette pass). Shared overlay canvas `drawOverlay` (range rings, orders, selection, badges, floats) uses `P(x,y,h)` world->screen for both views. Combat effects are simulation-pushed records in `b.fx` (from `shotFx` and melee dust) drawn by `drawFx` on the 2D overlay in both views; sounds triggered in `loop` when an fx record starts.
- **Input**: pointer handlers on `#ov` (game.js ~3277-3340: `pointerdown/move/up`, `endPointer`), `vToWorld` (2D math or `v3ground` raycast), `pickUnit`, `issue`, `formationSlots`/`applyFormation` (right-drag battle line), `CMDS` (advance/charge/halt/back/stance/fire/rally), keyboard handler ~3341, `zoomBy`, `panBy`, minimap `miniJump`.
- **Modes/persistence**: menu `buildMenu`; Endless War `G.camp` + `openMuster`/`renderMuster`/`endlessResult` (localStorage `fc-best-*`); meta progression `loadProg/saveProg` (`fc-prog`); map editor `ED`/`ed*` (draft in `fc-map-draft`); online 1v1 via PeerJS (`netHost/netJoin/netData`, host authoritative).

## FC-020 audit findings (iteration 1, from `tests/ranges.audit.js`)

Move/turn = `speed × TB.MOVE(4.6)` before terrain. Map width 1000.

| type | era | move/turn | range | min | fire on move | range as % of map width | metres |
|---|---|---|---|---|---|---|---|
| minf rifle inf | modern | 37 | 90 | 0 | no | 9% | 450 |
| atgm AT team | modern | 32 | 560 | 0 | no | 56% | 2800 |
| tank | modern | 156 | 480 | 0 | yes | 48% | 2400 |
| ifv | modern | 184 | 320 | 0 | yes | 32% | 1600 |
| mortar | modern | 32 | 260 | 20 | no (indirect) | 26% | 1300 |
| sniper | modern | 32 | 200 | 0 | no | 20% | 1000 |
| howz | modern | 92 | 1400 | 100 | no (indirect) | 140% | 7000 |
| mlrs | modern | 129 | 1600 | 200 | no (indirect) | 160% | 8000 |
| sam | modern | 120 | 1300 | 0 | no | 130% | 6500 |
| heli | modern | 690 | 900 | 0 | yes | 90% | 4500 |
| arc archers | ancient | 92 | 200 | 0 | no | 20% | 200 |
| line musket | napoleon | 78 | 75 | 0 | no | 8% | 150 |
| art cannon | napoleon | 37 | 420 | 20 | no (treated as indirect) | 42% | 840 |

Consistency/balance issues found (not yet fixed):
1. **No terrain LOS on open maps.** `tbLOS` returns `true` unless `b.s.city`; hills and woods never block direct fire in field battles, so a tank (48% of map) or ATGM team (56%) engages from its start line. This, not the raw numbers alone, is why modern combat happens across the map (seen in `ironbridge_turn3.png`: fire across the river by turn 3).
2. **Indirect fire needs no observer.** `howz`/`mlrs` reach the whole map and only suffer `×0.2` against concealed unspotted targets (`tbRangedHit`); a target in the open is always hittable with no spotter.
3. **Napoleonic cannon is in `INDIRECT`**, so it ignores LOS where LOS exists (city maps). Historically direct fire.
4. **Range ring disagrees with the rule.** `drawOverlay` draws `Math.min(R.range,900)` (game.js ~3053) and never shows `R.min`; howitzer/MLRS/SAM rings understate the real reach, and minimum-range dead zones are invisible. → FC-021.
5. **Infantry speed vs. ranges.** Modern rifle infantry moves 37/turn but an ATGM team out-ranges it by 15 turns of walking; infantry cannot close under fire. Archers (2.2 turns), muskets (1 turn) are well proportioned; the historical eras look sound.
6. **Real-time `step()` duplicates rules** (ranged loop, melee, routing) but is dead code (see Architecture map).

## Iteration log

Append newest entries at the bottom. Record evidence, not assumptions.

- **Iteration 1 — FC-001, FC-002, FC-003, FC-020 (audit only).**
  - Changes: added `vendor/three.min.js` (+licence) and pointed `index.html` at it instead of cdnjs (PeerJS and Google Fonts still external); added `tests/harness.js`, `tests/smoke.test.js`, `tests/ranges.audit.js`; added `PROMPT.md`, `CLAUDE.md`, this plan. No game logic changed.
  - Tests run: `node --check game.js` OK. `node tests/harness.js tests/smoke.test.js` -> 18/18 PASS. `FC_NO_WEBGL=1 node tests/harness.js tests/smoke.test.js` -> 19/19 PASS (the expected three.js "Error creating WebGL context" console error is whitelisted only in that mode). `node tests/harness.js tests/ranges.audit.js` -> PASS, table above.
  - Unverified: real GPU performance (tests use SwiftShader), touch input, Endless War, editor, multiplayer.
  - Next (done in iteration 2): **FC-021/FC-022 as one slice** — a single `canEngage(b,a,t)` rule (range, min range, armour eligibility, LOS, spotting, readiness) used by `tbPlan`, `tbOverwatch`, the matchup tooltip and the range ring; terrain LOS on open maps (hills/woods); visible blocking reason in the tooltip. Then FC-023 (artillery needs an observer; modern direct-fire ranges tuned to the map).
- **Iteration 2 — FC-021, FC-022, FC-023 (ranges).** User report: attack ranges still too big.
  - Hypothesis: ranges were large *and* nothing but distance limited direct fire on open maps (no terrain LOS, no observer for artillery), and the range ring disagreed with the rule.
  - Changes: `game.js` — new ENGAGEMENT RULES block (`RANGE_TUNE`, `losInfo`, `observerFor`, `canEngage`, overrides of `tbLOS`, `tbPlan`, `chooseTarget`, updated `TYPE_NOTE` for howz/mlrs/mortar); tooltip in `showTip` shows the real blocking reason; range ring in `drawOverlay` uncapped and shows min range; unit card best-target uses `canEngage`; four briefing/notes strings updated. Added `FIELD_COMMAND_DESIGN_KNOWLEDGE.md` (from the user) and the matching lines in `PROMPT.md`/`CLAUDE.md`; added `tests/engage.test.js`.
  - Tests run: `node --check game.js` OK. `node tests/harness.js tests/engage.test.js` → 12/12 PASS (hill, woods, range, min range, armour, no observer, observer via recon, `tbPlan` holds/fires, open-ground false-block rate 2/456). `node tests/harness.js tests/smoke.test.js` → 18/18 PASS. `FC_NO_WEBGL=1 … smoke.test.js` → 19/19 PASS. `tests/ranges.audit.js` → PASS, new values confirmed live.
  - Unverified: how the new tooltip text and min-range ring look on screen (not screenshotted with a selection), balance/pacing across eras by actual play, AI artillery behaviour over a full battle, multiplayer (rules are deterministic and shared, but not exercised).
  - Next: **FC-012 / LOS feedback on the map** — when a selected unit's attack is blocked, draw the blocked sight line and a short label at the blocker; then FC-023 playtest pass (turns-to-first-contact per scenario) and FC-030/031 formation slots.
