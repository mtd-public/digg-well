# Digg Well

**Downwell × Spelunky, in isometric 3D.** An oil tycoon falls down his own seemingly bottomless
well, story by story, to find the Golden Shovel at the bottom. The oil monsters on the way are his
own employees, half-drowned in crude and begging the boss for help. He hits them anyway.

1900s oil boom (*There Will Be Blood*: timber shoring, kerosene lanterns, wooden casks, dynamite)
drawn as a dark cartoon. The final boss is **Chairman Devil, Chief Hell Operator**: half pinstripe
robber baron, half devil, in the Bedrock Boardroom.

**Play:** https://mtd-public.github.io/digg-well/ (or the [single-file build on claude.ai](https://claude.ai/artifact/1G5hsSEQiVfTp3JSzZxqDu)) ·
art bible: [preview.html](https://mtd-public.github.io/digg-well/preview.html) · design: [GAME_DESIGN.md](GAME_DESIGN.md)

## How it plays

- **Down, story by story.** Each depth is several stories stacked up: chambers to explore and
  shafts to fall through. Every floor has a hole. Each depth ends at one hazard-striped **collar
  hole** with a coloured beacon; take it when you're ready and you drop into the next depth.
  Five depths, then the Bedrock Boardroom. Every run is a new seeded layout (`?seed=1234`).
- **Stomp.** Land on things to hurt them; kills in the air chain a combo that pays on landing.
- **Money is power.** Coins and dollar bills raise your damage multiplier (×2 at $250, ×4 cap).
  Getting hit spills money, and shops cost it.
- **Weapons:** the **shovel** is always in hand (swing; in the air it plunges and digs down).
  Pickups: the **pickaxe** (heavy, breaks anything diggable in one hit, wears out), a **coach
  shotgun** (fires down in the air and its recoil holds you up, like Downwell's gunboots) and
  **dynamite** (it hurts you too).
- **Items (USE):** **Gin XXX** heals two hearts, a **Golden Shovel** shard makes you invincible for
  8 seconds (Mario Kart's star) and washes the oil off any employee you touch, and **flares** light
  the dark.
- **The piggy bank** is each depth's damsel. Pick it up (USE) and carry it through the collar hole
  to save it for money and a heart. It's fragile: your swings, stomps, blasts, enemies and long
  drops all crack it.
- **Shops:** pick a ware up, then USE to pay. Walk out with it and you've stolen it. Theft or
  violence turns the shopkeeper (coach gun), and every shopkeeper after that shoots on sight. A
  bigger beard means better stock.
- **Side paths:** boarded tunnels in the well wall lead to treasure rooms (choose one of two
  upgrades), shops, stashes, and chutes that drop to a lower story or into the next depth.
- **Pitch dark** stories: your lamp sputters. Walk up to lanterns to light them, throw flares,
  and use fire.
- **Enemies:** oil workers (the burning ones spread fire), beetles, snakes, oil flies, bats, and
  near the bottom, cute little imps that lob fireballs. **Hazards** are dr-mow's, gone
  underground: drill saws, gas vents, boiling tar kettles, falling stalactites, seismic
  thumpers, plus oil casks and dynamite crates.

## Controls

| | Touch (dr-mow layout) | Keyboard + mouse | Gamepad |
|---|---|---|---|
| Move | floating stick, left side | WASD / arrows | left stick / D-pad |
| Jump | JUMP (or tap the right side) | Space / K | A |
| Attack | ⛏ button | J / X / left click | X / RT |
| Use item | USE button | E / L / right click | B / LT |
| Switch weapon · item | tap the weapon / item badge | Q · Tab | LB/RB · Y |
| Pause · mute | II · — | P or Esc · M | Start |

## Run it

No build step. Serve the folder (ES modules need a server) and open it:

```
python3 -m http.server 4210
open http://localhost:4210/
```

URL options: `?seed=N` (a layout), `?depth=N` (start at depth N with a kit, for testing; 6 is the
Boardroom), `?touch` (show the touch controls on desktop).

## Verify

```
node tools/sim-check.mjs [seeds]   # every seed finishable without digging; every rule (419 checks at 20 seeds)
python3 -m http.server 4210 &
node tools/smoke.mjs               # desktop, phone, phone landscape, tablet: 0 console errors, 0 page scroll, controls reach the sim
```

CI (`.github/workflows/pages.yml`) runs both on every push and deploys to GitHub Pages from `main`.

## Code map

```
js/sim/        the rules: pure, no three.js, no DOM (Node runs them)
  tuning.js      every number, with the reason it has that value
  gen.js         the seeded well: stories, holes, ledges, side rooms, chutes, hazards, who stands where
  proof.js       BFS proof: the bottom is reachable without digging, every piggy is reachable, no traps
  grid.js        voxel grid, axis-separated box collision, mantle assist, ray march
  world.js       createWorld(seed) · step(world, control, dt): the Tycoon, weapons, items, carry, shops, piggies
  common.js      events, blocks, damage, knock-outs, money, explosions, fire
  enemies.js     oil workers (and burning ones), beetles, snakes, flies, bats, imps, shopkeepers
  hazards.js     dr-mow's hazards underground
  boss.js        Chairman Devil
js/render/     three.js view (r160)
  view.js        camera (pulled-out iso), cutaway, lights (lamp + pool of five), decor, beacons
  terrain.js     per-story voxel meshes with AO, painted atlas, rebuilt when dug
  materials.js   toon ramp, ink hulls, the cutaway shader
  kit.js         merged vertex-coloured parts + welded hulls
  models.js      the cast · props.js props, pickups, decor, hazards · actors.js entities ↔ meshes · fx.js particles
js/input/      keyboard, mouse, gamepad, touch → one control object per step
js/audio/      sfx-synth.js (the kit) + audio.js (the game's sounds and voices)
js/ui/hud.js   HUD, speech bubbles, floating money
preview.html   the art bible: every model in a row
tools/         sim-check.mjs, smoke.mjs
```

## Lineage

| From | Reused |
|---|---|
| [mstr-gme-dsgn-tmpt](https://github.com/mtd-public/mstr-gme-dsgn-tmpt) | house rules (sim/render split, TUNING with reasons, verify before push), three.js r160, touch-zoom-guard, sfx-synth, floating stick, inverted-hull ink, mulberry32 |
| [dr-mow](https://github.com/mtd-public/dr-mow) | the touch layout (stick + JUMP pill), the pulled-out iso camera, the hazards and their art (saw and striped track, explosive spout, acid vat, icicle, ring mine) and their timings |
| [hell-hole](https://github.com/mtd-public/hell-hole) | depths you descend through, the light pool, gamepad handling and menus, the CI shape |
| [labyrinth-larry](https://github.com/mtd-public/labyrinth-larry) | the dark palette with one warm light, formant voices |
| [Vertical-Vantage](https://github.com/mtd-public/Vertical-Vantage) | proved levels (headless reachability) |
| [turn-tactics](https://github.com/mtd-public/turn-tactics) | the Pages deploy |
