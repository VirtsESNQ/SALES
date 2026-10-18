# Field Command — Ralph Implementation Plan

This file is persistent project memory for the Ralph loop. Re-check the source before trusting any task or status. Never mark a task complete without evidence.

## Baseline and stability

- [x] **FC-001 — Map the architecture** (`DONE`, iteration 1): see "Architecture map" below.
- [x] **FC-002 — Establish validation** (`DONE`, iteration 1): no test setup existed. Added `tests/harness.js` (local static server + Playwright Chromium with SwiftShader WebGL; all external network blocked; fails on any page error) and `tests/smoke.test.js`. Run: `node --check game.js && node tests/harness.js tests/smoke.test.js` and `FC_NO_WEBGL=1 node tests/harness.js tests/smoke.test.js` (2D fallback). Uses the globally installed `playwright` (falls back to `/opt/node22/lib/node_modules/playwright`). three.js r128 is now vendored at `vendor/three.min.js` (copied from npm `three@0.128.0`, MIT licence in `vendor/three.LICENSE`) so the game and tests no longer need cdnjs.
- [~] **FC-003 — Verify startup and mode launch** (`DONE` for the listed scope; other modes are FC-072..074): smoke test covers menu cards, WebGL init, Cannae and Ironbridge launch into deployment, 2D->3D->2D switching, begin, two resolved turns with attack orders, finite unit state, restart, back to menu. Also passes with WebGL disabled (3D request stays on 2D). Screenshots inspected manually (`ironbridge_turn3.png`): renders correctly. Not covered: Endless War, editor, multiplayer, mobile/touch layouts.

## Core interaction

- [x] **FC-010 — Audit selection and orders** (`DONE`, iteration 3): reworked mouse controls. Left click selects (Shift adds, box drag, double-click selects the same type in view). Left click on empty ground clears the selection and never gives an order. Right click orders: an enemy means attack, ground means move, Ctrl or J means attack-move. Right drag draws a battle line. Touch keeps tap-unit-then-tap-target. `tests/forms.test.js` drives real mouse events for select, deselect, right-click move and J attack-move. Halt, advance, charge, fall back and rally are unchanged (smoke-tested via turns only).
  - Acceptance: each action has one clear result; UI feedback matches the resulting state; camera gestures do not accidentally issue orders.
- [~] **FC-011 — Audit camera and coordinate transforms** (`IN_PROGRESS`, iteration 3): the 3D camera now smooths zoom (`distT`), zooms toward the cursor (anchor), tilts (PgUp/PgDn, Shift+middle-drag orbit), glides on `centerOn`, edge-scrolls, and keeps the view centre when switching between 2D and 3D. `L` focuses the selection; `Home` fits the map. `tests/forms.test.js` checks in 2D that the right-click world point matches `vToWorld` within 10 units. Not yet tested: pointer-to-world under 3D rotation/tilt, minimap drag.
  - Acceptance: pointer-to-world conversion remains correct at different zooms/rotations and in both views.
- [~] **FC-012 — Improve order feedback** (`IN_PROGRESS`, iteration 3): unreachable slots answer "Cannot go there" or "No route there" at order time. A move that stalls for two rounds is dropped with a message and a red X at the blocked destination. The unit card shows formation (its trade-off as a tooltip), reforming, a suppression bar and PINNED status. Identical toasts are refreshed instead of stacked. Still missing: drawing the blocked sight line for a refused attack.
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

- [x] **FC-030 — Trace battle-line formation code** (`DONE`, iteration 3): one orders block replaced the old `issue`/`formationSlots`/`applyFormation` (see FC-031).
- [x] **FC-031 — Shared formation preview and deployment** (`DONE`, iteration 3): `planGroupMove(sel,p,face,frontage,kind)` is the only slot planner. The drag preview (`previewMoves` in `drawOverlay`), right-click orders, drawn battle lines, formation buttons and wheeling (`rotateSel`) all call it; `commitMoves` turns slots into orders. This fixes a bug that predates this work: the pull-drag preview offset arrows from the dragged unit while the order used the group centroid. Test: preview slots equal committed orders (max offset 0.0).
  - Acceptance: line, diagonal, vertical, and rotated-camera cases produce the same preview and final arrangement.
- [x] **FC-032 — Add formation choices** (`DONE`, iteration 3): the `FORM` table holds line, column, wedge, skirmish and hold. `formsFor(u)` lists the drills each unit kind can use, `groupSlots` gives the geometry per drill, and `setForm` changes each unit's footprint.
  - Simulation effects: movement (`tbMoveRange`), turning cost (`tbPlanRange`), outgoing and incoming fire and splash (`tbRangedHit`), melee and flank exposure (`melee`), charge shock (`tbMeleeHit`). Reforming costs 30% of the turn's movement.
  - UI: formation bar (Shift+0–5), spacing with −/+ or [ ].
  - Tests: geometry per drill, footprint, movement rates.
  - Acceptance: formations affect spacing, frontage, facing, movement, and/or combat in documented ways, not just labels.
- [x] **FC-033 — Prevent movement jams** (`DONE`, iteration 3): `openGround` moves a slot to the nearest passable spot, or refuses it. `tbEndRound` drops a move that has made no progress for two rounds and reports it; melee, suppression, or an attack-move that is busy firing do not count as stalling. A group move keeps to its slowest member's pace (`o.grp`). Test: a stalled move is dropped, marked and reported.
  - Acceptance: valid destinations are reached where possible; impossible orders fail visibly and safely.

## Combat presentation

- [x] **FC-040 — Trace combat event lifecycle** (`DONE`, iteration 3). The path of an attack:
  1. Attack order, then `tbPlan`, then `tbStrike`.
  2. `tbRangedHit` or `tbMeleeHit` adds damage to `dmg`/`mdmg`/`sdmg`; `tbApply` applies it once.
  3. `shotFx` pushes effect records into `b.fx`, and the main loop ages them.
  4. When a record goes live it calls `fxSound`, and in 3D `fx3spawn`. `fx3frame` draws projectiles from the record's progress; `drawFx` draws them in 2D.
  Effects never feed back into the simulation.
- [x] **FC-041 — Weapon-specific fire and impact feedback** (`DONE`, iteration 3): new three.js effects layer (the `FX3` block before the theatre environments). It uses pooled additive and alpha point-sprite particles, line segments for tracers and beams, shock rings and 3 pooled point lights.
  - Musket volleys: flashes along the frontage and white black-powder smoke that hangs.
  - Cannon: flash, large smoke cloud, shock ring and the ball in flight.
  - Blasts: flash, fireball, smoke column, falling debris, dust ring, shock ring and a light flash.
  - Also: tracers with impacts, missiles with smoke trails, shells with a trail and an incoming whistle, arrows, beams, orbs and wakes.
  - Weapon-specific sounds are placed by distance and stereo pan (`sndPlace`). Camera shake is halved in 3D.
  - Test: `tests/fx.test.js`; Ironbridge, Austerlitz and Agincourt produce particles within the pool caps.
- [x] **FC-042 — Morale/suppression/routing feedback** (`DONE`, iteration 3): the unit card shows suppression (a bar, and PINNED) and the status "Pinned down"; a toast reports when a unit is pinned. In 3D, pinned figures crouch, front ranks level their weapons when firing, spearmen thrust in melee, and routing figures turn and run.
- [~] **FC-043 — Effect performance** (`IN_PROGRESS`, iteration 3): fixed-size pools (2200 additive and 2400 alpha particles, 700 lines, 12 rings, 3 lights; smaller on low-end devices). The particle loop allocates nothing per frame, and emission drops at far zoom (`fx3lod`). The test measured at most 31 draw calls with post-processing off. Not measured on a real GPU: headless SwiftShader runs at about 1 fps for both the old and the new build, so frame-time comparisons here mean nothing.

## Models, animation, and rendering

- [ ] **FC-050 — Audit 3D rendering costs** (`TODO`): inspect instancing, materials, geometry reuse, shadows, per-frame allocations, resource cleanup, and external dependencies.
- [~] **FC-051 — Improve troop/vehicle silhouettes and detail** (`IN_PROGRESS`, iteration 3): modern infantry carry packs, and guns and vehicles recoil when they fire. Fallen soldiers stay on the field (pooled, at most 1700, hidden at far zoom). Destroyed vehicles and guns leave wrecks that burn and smoke for a while. Not done: new merged geometry per era, a prone pose, horse gaits.
- [ ] **FC-052 — Add/repair zoom-level detail** (`TODO`): strategic readability, tactical silhouettes, close-up animation/effects.
- [ ] **FC-053 — Preserve fallback and mode switching** (`TODO`): verify 2D fallback and no resource leaks when toggling views or changing battles.

## Tactical depth and AI

- [ ] **FC-060 — Audit facing and flanking** (`TODO`): verify calculations use world-space orientation and are camera-independent.
- [ ] **FC-061 — Audit morale, fatigue, cohesion, routing** (`TODO`): document existing state transitions and add regression tests before extending mechanics.
- [x] **FC-062 — Improve AI decisions** (`DONE`, iteration 3): the AI plans only against units it can see (`sideSees`); otherwise it searches where the enemy was last seen. `aiTactics` adds role behaviour before target choice:
  - guns that cannot hit a fast threat pull back; guns that can, fire on it;
  - melee troops screen a threatened gun;
  - shooters step back from approaching melee troops and look for cover when suppressed;
  - cavalry rides for the flank or rear of engaged targets;
  - badly shaken units without a scripted regroup fall back.
  Target commitment: a unit switches only for a target at least 35% better. The scripted modes (general, escort, regroup, feint, waypoints) are untouched. Test: `tests/ai.test.js`.
- [x] **FC-063 — Add tactical mechanics only when justified** (`DONE`, iteration 3).
  - **Fog of war:** sight range per era and type, terrain line of sight, firing reveals a unit, last-seen ghosts. Hidden units cannot be picked or targeted.
  - **Suppression** (`suppGain`): depends on weapon, armour, cover, formation and flank. Above 75 a unit is pinned: 20% movement and poor aim. It decays by 30 a round when not under fire and by 12 while still under fire. Morale does not recover above 50.
  - **Ranged flank and rear fire:** +15% from the flank, +35% from the rear; no bonus against an all-round defence.

## Existing modes and regression coverage

- [~] **FC-070/071 — Scenario regression** (`IN_PROGRESS`, iteration 3): `tests/ai.test.js` runs every non-custom scenario (22) for three synchronous rounds with both sides given orders and checks that state stays finite. This is not a balance check.
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
- **Iteration 3 — overhaul brief: controls, fog of war, formations, suppression, 3D effects, animation, tactical AI; then the user's morale and fog follow-up.**
  - Changes (all in `game.js` unless noted):
    - Controls and camera (FC-010/011).
    - Visibility: `SIGHT`, `seesUnit`, `sideSees`, `hiddenFromPlayer`, last-seen ghosts.
    - Formations: `FORM`, `groupSlots`, `planGroupMove`, `commitMoves`, plus their simulation hooks.
    - Stall handling; suppression (`suppGain`, `PINNED`); ranged flank fire.
    - Effects: `FX3` layer, `fxSound`/`sndPlace`. Animation: poses, recoil, fallen soldiers, wrecks.
    - AI: `aiTactics`, target commitment.
    - Toast de-duplication.
    - Formation bar, attack-move and focus buttons (`index.html`, `style.css`).
    - Help text (`index.html`) and `README.txt`.
    - New tests: `tests/forms.test.js`, `tests/fx.test.js`, `tests/ai.test.js`.
  - User follow-up (same iteration):
    - Morale scales combat effectiveness (`moraleK`: ×0.7 at 0, ×1.0 at 50, ×1.3 at 100) for melee and fire.
    - Casualties among nearby friends and the destruction of a nearby friendly unit cost morale (on top of the existing rout cascade).
    - Below 20 morale a unit not in melee is "Wavering" and falls back 70 per round; it breaks at 0 as before.
    - Fog of war: a discovered enemy stays revealed for the rest of the battle (`b.known`).
    - A "Fog of war: ON/OFF" button on the deployment screen (stored in localStorage `fc-fog`). Online games always keep fog on so both machines run the same rule.
  - Tests run (all PASS):
    - `node --check game.js`.
    - `tests/smoke.test.js` (WebGL, and `FC_NO_WEBGL=1`).
    - `tests/engage.test.js`; one check changed: a target hidden behind the hill now reports "unseen" under fog, and LOS itself is checked with `losInfo`.
    - `tests/forms.test.js` (WebGL, and `FC_NO_WEBGL=1` before the morale additions).
    - `tests/ai.test.js` (22 scenarios × 3 rounds); `tests/fx.test.js`.
  - Unverified:
    - Real-GPU frame times: headless SwiftShader runs at about 1 fps for the old and new builds alike.
    - The look of the effects in motion (judged from stills only).
    - Balance of morale, suppression and the new AI over full battles.
    - Multiplayer sync of the new fields (formation, suppression and fog are carried in snapshots, but not exercised).
    - Editor and Endless War.
  - Next: a playtest pass per era for balance; the blocked sight line on the map (FC-012); pointer-to-world under 3D tilt (FC-011); per-era model geometry (FC-051).
