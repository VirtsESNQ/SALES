# FIELD COMMAND — DESIGN KNOWLEDGE, IMPLEMENTATION PATTERNS & EXAMPLES

This document is a practical reference for the coding agent. It is intentionally explicit: do not rely on vague phrases such as “make combat better,” “improve formations,” or “make the 3D feel good.” Convert each into observable player behaviour, an implementation hypothesis, and a test.

This is not permission to impose every mechanic described below. Inspect the actual source, identify what already exists, choose changes appropriate to the current architecture, and implement them incrementally. Treat all example values as illustrative unless verified against the source and playtesting.

## 1. The correct mental model for a tactical game

A tactical game is a chain of understandable causes and effects:

1. The player observes the battlefield.
2. The player selects units and issues an order.
3. The game validates the order and communicates any restrictions.
4. Units move, orient, form up, acquire targets, and fight according to simulation rules.
5. The simulation changes state: position, health/strength, ammunition/readiness if modelled, morale, fatigue, suppression, cohesion, ownership, objective control.
6. Rendering, audio, UI, and effects communicate those changes.
7. The player can infer why the result happened and make a better next decision.

If any link is unclear, the game feels random or unresponsive. Do not add spectacle without fixing cause-and-effect clarity.

### Example: why a shot did not happen

A player orders a rifle unit to attack an enemy. Nothing happens. A poor implementation simply leaves the unit standing. A good implementation checks the actual reasons:

- Is the order valid and still active?
- Is the unit alive, routed, stunned, reloading, or otherwise unable to act?
- Has the target been detected, if spotting exists?
- Is the target inside the correct range?
- Does the weapon category affect this target?
- Is line of sight clear if this weapon requires it?
- Is the unit moving and unable to fire while moving?
- Is there a cooldown or turn-based phase restriction?

The UI should expose the most important blocking reason when practical: OUT OF RANGE, NO LINE OF SIGHT, TARGET NOT SPOTTED, REFORMING, or SUPPRESSED. Do not show all of these constantly; show them contextually for selected units or failed commands.

## 2. How to inspect an unfamiliar codebase without making a mess

The project is large and has a substantial main JavaScript file. Do not read or rewrite the entire file in one pass.

### Required investigation technique

1. Search for the state field or user-facing action.
2. Find its definition and every writer.
3. Find every reader and side effect.
4. Trace one complete lifecycle from input to simulation to rendering.
5. Check whether real-time, turn-based, 2D, 3D, editor, and multiplayer paths differ.
6. Make the smallest coherent change.
7. Test both the intended path and one nearby failure case.

For example, when investigating attack range, search for:

- unit type definitions and their range fields;
- real-time target acquisition and damage resolution;
- turn-based targeting and line-of-sight functions;
- range-circle or target-preview drawing;
- tooltips and unit-stat panels;
- scenario overrides or mode-specific scaling.

Never assume one range field is consumed consistently by every subsystem. Verify it.

### Before modifying a central function

Write down:

- Inputs and their coordinate spaces.
- State read and state mutated.
- Whether it runs per frame, per unit, per target, or per turn.
- Whether it is shared across modes.
- What callers expect as a return value.
- Whether it creates timers, event handlers, Three.js resources, or persistent state.
- What breaks if it runs twice.

Do not perform a broad text replacement across a large file unless every match has been checked. Avoid introducing new global variables when a local or existing shared state structure is appropriate.

## 3. Coordinate spaces: screen, world, and 3D

Many tactical-game bugs are actually coordinate-space bugs.

Common spaces include:

- **Screen space:** browser/canvas pixels; origin generally at top-left.
- **World/map space:** game coordinates independent of camera zoom or rotation.
- **Three.js world space:** scene coordinates, potentially with a different axis convention or scale.
- **Minimap space:** a scaled projection of the world into a small rectangle.

Do not compare coordinates from different spaces directly.

### Required invariants

- A point clicked on the battlefield maps to the same logical world point at every zoom level.
- Rotating the camera changes how the world is displayed, not the actual target or formation position.
- Minimap clicks and drag navigation map to the intended world position.
- The formation preview and final formation use the same world-space result.
- The 2D and 3D views issue equivalent logical orders for equivalent clicks.

### Example test

Choose a visible landmark or unit at a known world position. Test clicking near it at low zoom, high zoom, after panning, and after rotating the camera. If the resulting command position drifts, fix the transform chain rather than adding a compensating offset in the movement code.

**Common bad fix:** “3D movement was offset, so subtract 12 from the x coordinate.” Why it is bad: the offset may only mask one zoom or camera angle and break every other case.

**Better fix:** Trace screen-to-ray or screen-to-world conversion, identify the incorrect transform or plane intersection, and fix that single conversion. Add regression cases for zoom and rotation.

## 4. Weapon range and scale: tune the system, not one number

A range value has no meaning without the world scale, movement speed, target detection, projectile behaviour, terrain, and battle layout.

### A range audit table should contain

For each unit archetype:

- era and role;
- movement speed and acceleration if relevant;
- maximum range and minimum range if applicable;
- attack type: melee, direct fire, indirect fire, guided projectile, area effect;
- target categories it can damage;
- line-of-sight requirement;
- spotting requirement;
- time to impact or projectile speed if represented;
- reload/cooldown behaviour;
- how range is displayed to the player;
- which simulation paths consume the value.

Do not globally scale all ranges unless there is evidence the coordinate system itself is wrong. A sword, a bow, a tank gun, a mortar, and an air-defence system should not all be balanced by the same simplistic multiplier.

### A useful range design vocabulary

- **Nominal range:** the authored or documented reach of the weapon.
- **Effective range:** the range at which the weapon is expected to perform well in this game's abstraction.
- **Minimum range:** a close-in area where a weapon cannot engage, if that is appropriate to the weapon.
- **Detection range:** how far the unit can identify a target under current conditions.
- **Line of sight:** whether intervening terrain blocks a direct shot.
- **Engagement eligibility:** the full set of conditions required to fire.

These distinctions can improve clarity, but only add new fields when the game needs them. Do not create a complicated weapon simulation just because the terms exist.

### Example: a modern battlefield is too small

Observed symptom: several long-range units can immediately threaten almost any position on a 1000 × 640 map.

Investigate before choosing a fix:

1. Does target acquisition happen at the weapon's full maximum range?
2. Does the attacker require spotting?
3. Does terrain block direct-fire weapons?
4. Can artillery fire indirectly, and how does the player counter it?
5. Is projectile travel instantaneous?
6. Can units reposition or use cover before being destroyed?
7. Does the scenario provide meaningful approaches and protected areas?

Possible fixes, selected based on evidence:

- Adjust weapon-specific ranges.
- Increase modern map dimensions while retaining reasonable movement pacing.
- Add or improve spotting and line-of-sight distinctions.
- Add projectile travel or artillery warning time.
- Give indirect fire counterplay such as relocation, cover, spotting denial, or counter-battery opportunities.
- Redesign a scenario's terrain and deployment zones.

Do not apply all fixes by default. Select the smallest set that restores meaningful decisions.

### Range/eligibility pseudocode pattern

This is conceptual pseudocode, not code to paste blindly:

```js
function getAttackEligibility(attacker, target, context) {
  if (!attacker || !target) return { ok: false, reason: 'INVALID_TARGET' };
  if (attacker.destroyed || target.destroyed) return { ok: false, reason: 'UNIT_DESTROYED' };
  if (attacker.side === target.side) return { ok: false, reason: 'FRIENDLY_TARGET' };
  if (!weaponCanDamageTarget(attacker.type, target.type)) {
    return { ok: false, reason: 'TARGET_NOT_VULNERABLE' };
  }
  const distance = worldDistance(attacker.position, target.position);
  if (distance < weaponMinRange(attacker, target)) return { ok: false, reason: 'TOO_CLOSE' };
  if (distance > weaponMaxRange(attacker, target)) return { ok: false, reason: 'OUT_OF_RANGE' };
  if (requiresSpotting(attacker, target) && !isSpotted(attacker, target, context)) {
    return { ok: false, reason: 'TARGET_NOT_SPOTTED' };
  }
  if (requiresDirectLOS(attacker, target) && !hasLineOfSight(attacker, target, context)) {
    return { ok: false, reason: 'NO_LINE_OF_SIGHT' };
  }
  if (!isReadyToFire(attacker, context)) return { ok: false, reason: 'NOT_READY' };
  return { ok: true, reason: null };
}
```

The actual game may have different architecture. Reuse existing state and conventions. The key lesson is to make the rules explicit and avoid separate contradictory versions of the same eligibility check.

## 5. Formations: geometry, order semantics, and movement

A formation is not merely an icon or a label. It is a mapping from a group of units to positions and orientations in world space, plus rules for moving and maintaining that arrangement.

### A formation order needs to define

- Selected group and deterministic unit ordering.
- Formation type.
- Anchor point.
- Facing direction.
- Frontage or spacing.
- Slot positions.
- Pathing and obstacle handling.
- Whether units maintain formation while moving or reform on arrival.
- Behaviour if a unit dies, becomes blocked, or cannot reach its slot.

### Example: line formation

Given N selected units and a line segment from point A to point B:

1. Compute the line direction vector `d = normalize(B - A)`.
2. Compute the perpendicular vector `p = (-d.y, d.x)` in a 2D world.
3. Determine the line midpoint and desired frontage.
4. Sort units deterministically (e.g., by their current projection along p, or stable selection order) so repeated previews do not shuffle them.
5. Assign each unit a slot distributed across the frontage.
6. Derive the formation facing from the line direction or the explicit facing input. Be clear which convention the game uses.
7. Preview those exact slots.
8. On confirmation, send the same slots to movement; do not recompute with different logic.

Conceptual slot spacing for N units across frontage W can use `spacing = W / max(1, N - 1)` with positions distributed around the midpoint. Handle N=1 separately. The exact convention depends on whether W represents total span or distance between outer unit centers.

### Formation examples by purpose

- **Line:** broad frontage, good for holding or distributing fire; may be slower to pivot as a group.
- **Column:** narrow and deep, suitable for constrained routes; limited immediate frontage.
- **Wedge:** forward-oriented group shape; useful for directionally focused movement, but avoid granting magical combat bonuses just because a unit has a wedge label.
- **Skirmish:** wider individual spacing; may reduce vulnerability to area fire or improve local movement but weakens concentrated melee cohesion, depending on the era.
- **Defensive/hold:** prioritizes facing, cohesion, and position retention. This is an order/stance as much as a geometric shape.

Do not force every formation into every era. A Roman shield wall, Napoleonic infantry line, medieval archer deployment, and modern dispersed squad have different historical logic.

### Example: formation preview correctness

The player selects 8 units, draws a diagonal line, rotates the camera, and confirms.

Pass criteria:

- Preview and final unit slots overlap within a small world-space tolerance.
- The units face the intended direction.
- The left-to-right order does not randomly swap after confirmation.
- Repeating the same order produces the same slot layout.
- The order still works after zoom, pan, and camera rotation.
- Units do not collapse into one point if the line length is zero or near zero; handle degenerate input safely.

### Formation movement and pathfinding

Do not have every unit blindly chase the exact slot if a building blocks the direct path. That can produce jitter, stacking, and permanent movement loops.

A practical incremental approach:

1. Give each unit a desired slot.
2. Compute a path or steering direction toward its slot using existing movement logic.
3. Use local separation so units do not occupy the same space.
4. Detect lack of progress over a time window or number of simulation ticks.
5. If blocked, try a bounded alternative path/slot or mark the unit as blocked.
6. If the order cannot be fulfilled, communicate that state rather than moving forever.
7. Once the group arrives, reform within a tolerance and stop oscillating.

Do not implement a full pathfinding framework if a small correction to the current system solves the demonstrated problem.

## 6. Combat feedback: model events, not random decoration

A strong combat feedback loop has distinct stages:

1. **Intent:** unit has a valid attack order and target.
2. **Wind-up/readiness:** aim, reload, or prepare if appropriate.
3. **Fire:** weapon visibly discharges and audio plays.
4. **Travel:** projectile or tracer represents the shot when useful.
5. **Resolution:** hit, miss, blocked shot, or area impact is resolved by the simulation.
6. **Reaction:** target receives damage, suppression, morale effect, or no effect according to the rules.
7. **Aftermath:** smoke, debris, damage visuals, casualty changes, or morale indicators appear.

Do not let the renderer independently determine whether a shot hits. The simulation owns truth; the renderer visualizes it.

### Recommended event shape

Use the project's existing event conventions if present. If there is no suitable pattern, consider a small plain-object event model such as:

```js
{
  type: 'weapon_fired',
  eventId: uniqueId,
  time: simulationTime,
  sourceUnitId,
  targetUnitId,
  weaponKind,
  origin: { x, y },
  targetPosition: { x, y },
  projectileKind,
  result: 'pending' // or resolved event with hit/miss/blocked outcome
}
```

And a separate resolution event:

```js
{
  type: 'projectile_resolved',
  eventId: uniqueId,
  shotId,
  result: 'hit', // 'miss', 'blocked', or 'area_impact'
  impactPosition: { x, y },
  damageApplied,
  suppressionApplied
}
```

These are illustrative shapes. Do not add a generic event bus if a direct, clear function call fits the current code better. The important properties are: unique identity, one authoritative resolution, predictable lifecycle, and no duplicate damage when rendering updates.

### Good and bad effects

- **Bad:** a tank plays a muzzle flash every render frame while its attack order exists. **Good:** one muzzle flash plays for one actual shot event, with a cooldown and cleanup.
- **Bad:** a projectile animation hits an enemy and directly subtracts health while the simulation also applies damage. **Good:** the simulation resolves damage once; the projectile animation is cosmetic and listens for the result.
- **Bad:** every weapon creates a new geometry, material, and texture per shot. **Good:** reuse materials and geometry; pool short-lived particles/projectiles where appropriate; dispose resources only when truly no longer needed.

### Effects should communicate weapon identity

- **Melee:** brief weapon swing, contact reaction, dust/metallic impact as appropriate.
- **Arrows:** visible arrow flight at useful zoom, impact into ground/shield/unit, distinct sound.
- **Rifle fire:** short muzzle flash, restrained recoil, tracer only for selected shots or appropriate weapons, impact dust.
- **Machine guns:** sustained bursts, repeated impacts, heat/reload rhythm if modelled.
- **Cannons/artillery:** stronger muzzle effect, projectile travel, delayed impact, dust/smoke and a readable blast radius if the game supports area damage.
- **Missiles/ATGM:** visible launch and trail, enough flight time for counterplay if intended, distinct impact.
- **Aircraft:** aircraft movement and attack should be readable; avoid drawing a large explosion that hides the entire battle.

These are visual conventions, not rigid requirements. Adapt them to the game's art style and zoom.

### Event deduplication

A single simulation shot must not create repeated effects if a renderer updates more than once or the game switches between 2D and 3D. Store/consume event IDs or use a robust queue/lifecycle. Clean up old effects without mutating authoritative simulation state.

## 7. Morale, suppression, fatigue, and routing

These mechanics must be legible, internally consistent, and not punitive in a way the player cannot understand.

Separate concepts when the game supports them:

- **Strength/casualties:** how many soldiers or how much unit health remains.
- **Morale:** willingness to continue fighting.
- **Suppression:** short-term disruption from incoming fire.
- **Fatigue:** longer-term reduction in effectiveness after exertion or combat.
- **Cohesion:** how well the unit maintains formation and coordination.

Do not create five overlapping bars if one or two clear indicators can communicate the important state.

### Example: suppression

An infantry unit receives sustained nearby fire:

1. The simulation applies suppression based on the relevant attack outcome, not merely because a bullet effect is drawn nearby.
2. Suppression reduces one or more defined behaviours, such as accuracy, movement speed, or willingness to advance.
3. The unit's visual state communicates the change: more cover-seeking, slower movement, less precise firing, or a small selected-unit status label.
4. Suppression decays or recovers according to a defined rule when the threat decreases.
5. The player can issue an appropriate order, such as hold, withdraw, or rally, depending on the game's design.
6. A test proves suppression changes behaviour and eventually recovers; it does not accumulate forever accidentally.

Do not apply a large universal suppression penalty to every era. Ancient melee troops, longbowmen, Napoleonic line infantry, and modern rifle squads should respond differently where the game models those distinctions.

### Routing state machine

If routing already exists, document and test it before rewriting it. A useful conceptual state machine is:

`steady → shaken → wavering → routing → rallied or destroyed`

The actual game may use fewer states. Define transition conditions and recovery conditions clearly. Avoid units flipping between routing and steady every tick because morale sits on a threshold. Hysteresis or a cooldown can help prevent oscillation.

### Example test

A unit takes losses and drops below its morale threshold. It routes. A rally order is issued while the enemy is still close. The unit should follow a predictable rule: either rally is rejected, the rally attempt fails under pressure, or it succeeds with a clear cost. It must not instantly become fully effective with no consequence unless that is intentional design.

## 8. Facing, flanking, and contact

Facing should be represented in a consistent coordinate convention and should not change when the camera rotates.

If a unit has a heading vector and the vector toward the attacker, a directional relationship can be estimated from their dot product. Do not invent a flanking bonus until the game has reliable orientation and attacker direction.

Conceptual example:

```js
const toThreat = normalize(subtract(threat.position, unit.position));
const facing = normalize(unit.facingVector);
const alignment = dot(facing, toThreat);
// alignment near +1: threat is in front, if facingVector points forward
// near 0: threat is roughly to the side
// near -1: threat is behind
```

Verify the convention in the existing game. Some engines define heading angle zero along +X, others along +Z, and some invert screen Y. Never assume the sign.

### Design rules

- Telegraph facing and flanking consequences clearly.
- Avoid arbitrary enormous bonuses that make a small angle difference decisive.
- Consider unit type: a shield-bearing infantry formation, cavalry, a turreted tank, and a fixed-direction artillery piece have different facing constraints.
- Separate weapon arc limitations from morale/formation flanking effects.
- Test front, side, and rear attack cases, plus a camera rotation to prove results are world-space based.

## 9. AI: make it purposeful, not omniscient

A useful tactical AI does not need to be genius. It needs to be consistent, legible, and capable of making a few meaningful decisions.

Prioritize in this order:

1. Do not issue contradictory orders every tick.
2. Do not choose impossible targets.
3. Do not run into known terrain blockers indefinitely.
4. Prefer valid targets the unit can actually attack.
5. Maintain or reform formations when appropriate.
6. Protect vulnerable support units if the game supports such behaviour.
7. Use terrain, cover, range, and objectives when they provide real advantages.
8. Attempt flanking or coordinated attacks only after basic movement and targeting are reliable.

### Example: target scoring

If current AI target selection is poor, consider a transparent score rather than a huge untestable ruleset. Candidate factors might include:

- Is target valid and attackable?
- Distance and time to engage.
- Threat posed to this unit or its allies.
- Whether the target is already being engaged by enough friendly units.
- Objective relevance.
- Risk of crossing exposed terrain.

Normalize factors and keep weights in one place. Add debug output for a selected unit showing why a target won. Do not make AI depend on hidden information the player would not have unless omniscience is an intentional difficulty setting.

### Prevent order churn

If an AI unit changes target or destination every update, it may jitter and look unintelligent. Use a decision interval, commitment period, or switch threshold. Re-evaluate immediately when the current order becomes invalid or the battlefield changes significantly.

## 10. Visual design and camera: readability at all zoom levels

The player must be able to understand the fight without zooming in constantly.

### Strategic zoom

Prioritize: unit identity and side; strength and morale state; formation shape and facing; movement/attack order indicators; objectives and important terrain; selected-unit highlight. Do not render individual tiny muzzle flashes or detailed equipment if they become visual noise.

### Tactical zoom

Prioritize: recognizable unit types; soldier spacing and formation shape; target engagement and firing direction; cover and terrain boundaries; suppression, routing, and incoming fire; readable projectile paths and impact effects.

### Close zoom

Prioritize: model detail and animation; weapon handling; firing and impact feedback; small terrain details; localized audio and effects.

### Camera interaction principles

- Keep pan speed useful at both high and low zoom; it may need to scale with zoom.
- Zoom toward the cursor when feasible, rather than always toward the map centre.
- Ensure drag-to-pan cannot accidentally select units or draw orders.
- Keep the map within sensible camera bounds, with clear handling for maps smaller than the viewport.
- Fit-map must include the actual playable world and respect aspect ratio.
- Avoid camera smoothing so strong that orders feel delayed.
- Keep the 2D/3D toggle from changing the logical selected units or orders unexpectedly.

### Camera acceptance test

Repeat the same order at four camera states: default, zoomed in, zoomed out, and rotated. The same world target should receive the order in every state. Test both left-handed and right-handed drags if the gesture supports direction.

## 11. Three.js performance and resource lifecycle

Instancing is valuable when many units share geometry and materials. More polygons are not automatically better.

### Inspect before optimizing

Look for:

- creating vectors, arrays, geometries, or materials inside hot per-frame loops;
- new meshes for every soldier when instancing is already used;
- repeated raycasts or expensive line-of-sight tests for every unit every frame;
- repeated DOM updates at frame rate;
- forgotten animation frames, event listeners, or controls on scene teardown;
- duplicate render loops after switching battles or views;
- materials/textures/geometries not reused or disposed correctly;
- unbounded particle/projectile lists;
- shadows enabled on every tiny object;
- unnecessary transparency and overdraw.

### Practical optimizations

- Reuse geometry and materials.
- Use instanced meshes for repeated static or similarly animated objects when appropriate.
- Use simple low-cost representations at strategic zoom.
- Pool temporary projectiles and particle objects when creation/destruction is expensive.
- Cap simultaneous effects and expire them deterministically.
- Update only changed DOM/UI elements rather than rebuilding large panels each frame.
- Stagger expensive AI or visibility calculations across ticks when this does not create visible inconsistency.
- Use spatial partitioning only if profiling shows target search or collision checks are a bottleneck.

### Never optimize by breaking truth

Do not lower simulation frequency in a way that makes hit resolution depend on render FPS. Do not skip state changes that determine damage, objective control, or multiplayer synchronization. Cosmetic updates can be throttled; authoritative simulation rules need deterministic behaviour appropriate to the game mode.

### Resource lifecycle test

Switch 2D → 3D → 2D repeatedly, restart a battle, and load a different scenario. Check for duplicate effects, increasing memory use, duplicate input handling, stale selection, and multiple animation loops.

## 12. Historical eras and modern warfare need distinct identities

Do not make every era a reskinned version of the same combat system. Share code where appropriate, but keep data and presentation distinct.

### Ancient warfare examples

- Formation cohesion and facing can be more important than individual long-range accuracy.
- Shields, spear reach, melee contact, fatigue, morale, and flank/rear attacks can define engagements.
- Missile troops need clear ammunition/range tradeoffs if ammunition is modelled.
- Cavalry can exploit routing or vulnerable flanks, but should not be an automatic counter to every unit.

### Medieval warfare examples

- Archers and crossbowmen need distinct firing rhythms and tactical roles if the game models them.
- Terrain, defensive positions, stakes or fortifications (if present), and approach routes can shape scenarios.
- Armoured units should interact with damage categories differently only if the game has clear and balanced armour rules.

### Napoleonic warfare examples

- Line infantry, skirmishers, cavalry, and artillery should have different engagement and formation roles.
- Formation deployment and facing should matter; turning a formed line should not feel identical to moving an individual soldier.
- Artillery should create area pressure and timing decisions rather than acting as a generic long-range rifle.

### Modern warfare examples

- Detection, cover, direct versus indirect fire, anti-armour weapons, vehicle armour, and artillery counterplay are especially important.
- Range alone should not guarantee a valid shot if spotting or line of sight is required.
- Infantry, IFVs, tanks, ATGM teams, artillery, aircraft, and air defence should have counters and vulnerabilities.
- Long-range weapons need counterplay: cover, concealment, repositioning, spotting denial, warning time, or other mechanics appropriate to the game's abstraction.

Do not add historical simulation complexity beyond what the current game can communicate. A small number of understandable rules is better than a complicated system whose effects players cannot infer.

## 13. UI patterns: communicate state without overwhelming the screen

A unit information panel should answer the player's immediate questions quickly:

- What unit is this?
- How strong is it?
- What is its morale/readiness?
- What is it currently doing?
- What is it targeting?
- What prevents it from doing what I asked?
- What orders are available?

### Good contextual feedback

- Selected unit out of range: show distance and effective range, if both are meaningful.
- Attack blocked by terrain: show NO LINE OF SIGHT and optionally a short visual indicator to the blocker.
- Formation cannot fit: preview invalid slots and offer a smaller frontage or a clear warning.
- Unit routing: make the status visible and provide the available recovery action.
- Unit path blocked: show the blocked destination or a brief status, not a permanent flashing warning.

### Bad contextual feedback

- Show every unit's full statistics permanently.
- Draw range circles for every unit at once.
- Flash multiple warnings that compete with combat effects.
- Use colour alone to distinguish states; support shape, icon, outline, text, or animation as well.
- Tell the player an order succeeded when it was rejected or silently changed.

## 14. Testing: prove behaviour, not just syntax

A syntax check is necessary but not sufficient. If no automated test framework exists, create small deterministic test functions or a documented manual test checklist that fits the project. Avoid introducing a large test dependency solely for a few simple checks unless justified.

### Core controls matrix

Test: click select; shift-add selection; drag-box selection; double-click same type; group/wing selection; move order; attack order; halt/advance/charge/retreat/rally where supported; battle-line order and facing; minimap navigation; camera pan, zoom, rotation, fit-map; 2D/3D switching; accidental input conflicts between camera gestures and orders.

### Simulation matrix

Test: valid target in range; valid target out of range; target behind a blocker; weapon unable to damage target category; attacker unable to act; unit reaches a destination; unit cannot reach a destination; formation with one unit; formation with many units; zero-length/near-zero-length formation line; morale threshold crossing; routing and rally recovery; unit destruction during movement or attack; target destruction while an attack order remains active.

### Scenario matrix

At minimum, verify representative scenarios from ancient warfare, medieval warfare, Napoleonic warfare, and modern warfare. Then check all listed scenarios that are practical to launch, particularly Cannae, Agincourt, Hastings, Austerlitz, Ironbridge, and Glass Sky. Verify objectives, sides, starting positions, and era-specific unit data.

### Visual and performance matrix

- 2D rendering at strategic and tactical zoom.
- 3D rendering at strategic, tactical, and close zoom.
- large army with many effects.
- frequent weapon fire.
- repeated battle restart and view switching.
- missing or failed external 3D dependency if fallback is supported.
- browser resize and different viewport aspect ratios.

### Do not fake visual testing

If you cannot launch a browser or inspect the running game, say so. Run available static checks, unit tests, and code-path verification, and clearly label what remains unverified. Never claim the game “looks great” from source inspection alone.

## 15. Good versus bad implementation examples

### Example A: range balance

**Bad:** Change every weapon range to 40% because the modern battlefield feels too small. Why bad: it destroys era-specific roles and may make archers, artillery, and rifles equally wrong in different ways.

**Good:** Audit ranges and consumers; identify which units can attack nearly every location; inspect spotting, LOS, projectile travel, counterplay, and scenario geometry; tune only the values or systems that cause the observed problem; test a representative scenario.

### Example B: formations

**Bad:** Add a dropdown with Line, Wedge, and Column, but all three call the same move function with no different slots. Why bad: it is UI theatre, not a game mechanic.

**Good:** Each formation generates a distinct slot arrangement; facing, spacing and movement rules are explicit; the preview uses the same slot calculation as the confirmed order; tests verify the shapes.

### Example C: combat VFX

**Bad:** Spawn random explosions near all units every second. Why bad: effects do not correspond to the simulation, hide information, and make combat feel fake.

**Good:** Each real shot/impact creates one appropriately typed effect. The hit/miss/damage result comes from the simulation. Effects are cleaned up and performance-capped.

### Example D: detail

**Bad:** Replace simple models with extremely high-poly assets at all zoom levels. Why bad: performance tanks and strategic readability gets worse.

**Good:** Improve silhouettes and weapon identity first; use instancing and zoom-dependent detail; profile before adding more complexity.

### Example E: movement stuck

**Bad:** Increase movement speed until the unit appears to get past a building. Why bad: it masks pathing/collision problems and can create new overshoot or jitter.

**Good:** Detect lack of progress; inspect collision and target slot; try a bounded alternate route or slot; report blocked orders clearly; test in an open field and around obstacles.

### Example F: UI order feedback

**Bad:** Show a green “Order issued” message when the target is invalid or the unit cannot execute it. Why bad: the player cannot trust the interface.

**Good:** Separate command receipt from command execution. Acknowledge the order, then communicate if it is blocked, queued, rejected, or completed.

### Example G: multiplayer

**Bad:** Make the local visual state determine damage or order results in a multiplayer battle. Why bad: clients may disagree and the game can desynchronize.

**Good:** Preserve the project's authoritative turn/state flow. Visual effects are local presentation of resolved state/events. Do not modify multiplayer protocol casually; add regression tests for any shared-state change.

## 16. A practical per-task workflow

For each task, the agent must write a compact internal checklist before changing code:

- **Observed problem:** What can the player actually see or reproduce?
- **Likely cause:** Which function/state relationship could produce it? What evidence supports this?
- **Scope:** Which files and systems are involved? Which modes might regress?
- **Implementation:** What is the smallest coherent fix? Which existing abstraction should be reused?
- **Acceptance tests:** What exact actions and states demonstrate success?
- **Regression risks:** What neighbouring features might break?
- **Result:** Which checks passed, which failed, and which checks were not possible?

### Example task record

```
Task: Formation preview differs from final placement.
Observed: After drawing a diagonal line with 6 selected units, the preview shows evenly spaced slots, but the confirmed units cluster near the midpoint.
Hypothesis: Preview and order confirmation use different coordinate transforms or slot calculations.
Scope: right-drag input, screen-to-world conversion, slot generation, move-order application, 2D and 3D views.
Fix: Extract/reuse one world-space slot calculation; make preview and final order consume the same slot list.
Acceptance: diagonal, horizontal, vertical, rotated-camera, zoomed, one-unit, and zero-length cases.
Regression: ordinary right-click movement and attack targeting still work.
Evidence: record exact checks run; do not mark complete if only syntax was checked.
```

## 17. Acceptance rubric: would a player notice the improvement?

Score each dimension from 0 to 3 after implementation:

- **0 — Broken:** behaviour is incorrect or feature fails.
- **1 — Cosmetic/partial:** some visible change, but intended behaviour is unreliable or superficial.
- **2 — Working:** feature behaves as intended in normal cases and has reasonable feedback.
- **3 — Robust:** edge cases are handled, regression checks pass, and the feature improves clarity or tactical choice.

Dimensions: correctness; player feedback/readability; control usability; tactical impact; performance; cross-mode compatibility; test evidence.

A visual feature may not need a high tactical-impact score, but it should not reduce readability or performance. Do not call a major feature complete if correctness or cross-mode compatibility is 0 or 1.

## 18. Final rules

- Do not assume the current implementation is wrong solely because a design convention suggests another approach. Reproduce the issue and inspect the code.
- Do not assume a feature works just because a function exists.
- Do not invent functions, APIs, files, dependencies, or test results.
- Do not replace the project wholesale.
- Do not add mechanics that the UI cannot explain.
- Do not let effects become the source of truth for combat.
- Do not let camera transforms alter simulation coordinates.
- Do not create different combat rules in 2D and 3D accidentally.
- Do not mark tasks complete without evidence.

Prefer a small, working, tested improvement over a large, half-finished subsystem. When in doubt, preserve existing behaviour and investigate before changing it.
