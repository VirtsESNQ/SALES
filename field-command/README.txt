FIELD COMMAND
Battle strategy in your browser: Cannae (216 BC), Agincourt (1415), Hastings (1066), Austerlitz (1805), and two fictional 21st-century battles (Ironbridge, Glass Sky), plus Endless War: pick a century, build an army, fight until you lose.

Deploy on Netlify: drag this folder or the zip onto app.netlify.com/drop
Run locally: open a terminal in this folder and run
  npx serve .        (or)  python3 -m http.server 8000
then open http://localhost:3000 (serve) or http://localhost:8000
three.js r128 is bundled (vendor/three.min.js); fonts load from the internet. Without WebGL it falls back to the 2D map.

Controls
  Left click                 select (Shift adds, double-click selects all of that type in view, drag = box)
  Left click empty ground    clear the selection (never an order)
  Q W E X / A                infantry, ranged, cavalry/armour, artillery/support / whole army
  Right click ground         march there in the group's formation
  Right drag                 draw a battle line: position, frontage and facing
  Right click an enemy       attack (ranged units halt in range and fire)
  J, or Ctrl + right click   attack-move: advance and engage anything in reach on the way
  Shift 0-5                  formation: custom, line, column, wedge, skirmish, hold
  [ ]  /  < >                formation spacing / wheel the group
  Enter                      end your turn (no clock: you move & attack, then the enemy does)
  V advance · C charge · S halt · B fall back · G stance · F fire · R rally · Z undo · N next idle
  Camera: wheel zooms to the cursor · arrows or screen edge pan · middle drag or Space+drag pan
          Shift+middle drag orbits · , . rotate · PgUp/PgDn tilt · L focus selection · Home fit map · T 2D/3D

Rules worth knowing
  Fog of war: you see only enemies your units have spotted (hills, woods and towns block sight);
    once spotted they stay revealed. Turn it ON/OFF on the deployment screen before the battle.
  Morale: steadier units fight harder; losses and destroyed friends nearby shake units; below 20 a unit
    wavers and falls back, at 0 it breaks.
  Artillery and mortars need someone who can see the target.
  Formations trade frontage, speed, firepower and protection; see the tooltip on each button.
  Suppression: heavy fire pins troops down (they barely move and shoot poorly) until it stops.
  Fire and charges into a flank or the rear hurt more, except against a unit in Hold (all-round defence).

Tests: node tests/harness.js tests/<name>.test.js   (smoke, engage, forms, fx, ai; FC_NO_WEBGL=1 for the 2D fallback)
