# Digg Well: Game Design Document

> Downwell × Spelunky, in isometric 3D. An oil tycoon goes down his own seemingly bottomless well,
> story by story, to find the Golden Shovel at the bottom. The oil monsters on the way are his
> own employees, half-drowned in crude and asking the boss for help.

- **Play:** https://mtd-public.github.io/digg-well/ · **art bible:** `preview.html`
- **Built from:** [mstr-gme-dsgn-tmpt](https://github.com/mtd-public/mstr-gme-dsgn-tmpt) house
  rules and kits (three.js r160, touch-zoom-guard, sfx-synth, inverted-hull ink, floating stick,
  mulberry32), [dr-mow](https://github.com/mtd-public/dr-mow) (the touch layout, the pulled-out
  isometric camera, the hazards and their art and timings),
  [hell-hole](https://github.com/mtd-public/hell-hole) (depths you descend, the light pool, gamepad
  menus, CI), [labyrinth-larry](https://github.com/mtd-public/labyrinth-larry) (one warm light in
  the dark, formant voices), [Vertical-Vantage](https://github.com/mtd-public/Vertical-Vantage)
  (headless level proofs), [turn-tactics](https://github.com/mtd-public/turn-tactics) (Pages).
- **Stage:** first playable: five depths and the Bedrock Boardroom, seeded, proved finishable.

## 1. Pillars

1. **Always down.** A depth is several stories stacked up (chambers to explore, shafts to fall
   through); every floor has a hole into the story below. Each depth ends at one hazard-striped
   **collar hole** with a coloured beacon (the colour of the depth below): the way into the next
   depth, taken when you're ready. One continuous well, top to bottom.
2. **Stomp first.** Falling onto things hurts them and bounces you; air kills chain a combo that
   pays when you land.
3. **Money is power.** Coins and dollar bills are the Tycoon's lust for loot made literal: they
   are the damage multiplier. Spending them weakens you; getting hit spills them.
4. **Dark but cartoony.** A 1900s oil boom (There Will Be Blood: timber shoring, kerosene
   lanterns, wooden casks, dynamite, woodtype signs) drawn as a Simpsons-ish cartoon: bulgy eyes,
   big noses, toon shading, ink outlines. Some stories are **pitch dark**.
5. **Colour is a signal** (house rule): red = danger (fire, eyes, dynamite), gold = money and the
   way down, green = health (Gin XXX), boarded planks = an optional side path.

## 2. Core loop

```
 ┌── a story ─────────────────────────────────────────────────────────────┐
 │  land (stomp?) → fight / dig / grab money → find the hole → drop         │
 │      └→ boarded side tunnel → upgrade · shop · stash · chute             │
 │      └→ the piggy bank: carry it down (fragile)                          │
 └── the collar hole (beacon) → next depth ─ … ─ Bedrock Boardroom ─ boss ─┘
```

A run is one seed: five depths of 4–6 stories plus the Boardroom (`?seed=1234` replays one).
Death ends the run; retry the seed or roll a new one.

## 3. Controls

| Input | Move | Jump | Attack | Use item | Switch weapon · item | Pause |
|---|---|---|---|---|---|---|
| Touch (dr-mow layout) | floating stick, left 55 % (screen-relative) | JUMP pill, bottom-right (or tap the right side) | round button above JUMP | USE, above | tap the badges | II top-right |
| Keyboard + mouse | WASD / arrows | Space / K | J / X / left click | E / L / right click | Q · Tab | P / Esc, M mutes |
| Gamepad | left stick / D-pad | A | X / RT | B / LT | LB/RB · Y | Start |

Attack on the ground swings or fires forward; in the air the shovel or pickaxe **plunges** (digs
the blocks under you), the shotgun fires **down** and its recoil holds you up (Downwell's
gunboots), dynamite is dropped. USE picks up the piggy bank or a shop ware, pays for a ware you
hold, or uses the selected item.

## 4. Numbers (live in `js/sim/tuning.js`, each with its reason)

| Parameter | Value | Why |
|---|---|---|
| Cell · story | 1 m · 7 cells (1 floor + 6 air) | Room for a ledge 3 up and a stomp from a full story |
| Run · jump | 4.4 m/s · apex 2.36 cells, variable | Crosses the 13-cell well in 3 s; clears a 2-high step |
| Gravity · max fall | 30 · 17 m/s | A story falls in ~0.7 s, readable at 60 fps |
| Stomp bounce | 9.5 (12.5 holding jump) | Chains onto the next head |
| Hearts | 4 (6 max) | Spelunky's four |
| Power | × (1 + money / 250), cap × 4 | $250 doubles you |
| Hit spill | 12 % of money, re-collectable for 3.2 s | A hit costs power, not only health |
| Combo | ≥ 3 air kills pays $2 each; ≥ 8 heals a heart | Rewards staying airborne |
| Golden Shovel | 8 s invincible, contact washes workers, × 1.25 speed, digs by walking | Mario Kart's star |
| Piggy bank | 4 hits; saving pays $30 + $12 / depth and a heart | Spelunky's damsel, fragile |
| Dark story | the lamp drops to 12 % | You need lanterns, flares or fire |

Difficulty keys off the depth index, never the theme (house rule 6).

## 5. Cast

| Actor | Behaviour | Tell | Counter |
|---|---|---|---|
| **The Tycoon** | bowler hat with a brass carbide lamp, monocle, walrus mustache, three-piece suit; the shovel is always in hand | — | — |
| **Oil workers** (your employees) | yellow-skinned roughnecks half-drowned in crude, name tags ("HELLO my name is Gary"), a mug / HELP sign / lunch pail / wrench; shamble after you begging "Boss? It's me, Gary!" | arms up before the grab | stomp, shovel; knocked out (stars), never killed |
| **Burning workers** | lit oil (Tar Pits on, or set alight by vents, embers, fire, blasts): panic-charge, set fire to whatever they touch (other workers, the piggy, you) and burst when knocked out | flames, screaming | don't stomp them: shovel or range |
| Beetles · snakes | patrol floors and ledges; snakes rear and lunge | rearing | stomp |
| Oil flies · **bats** | flies hover in shafts and swoop; bats roost on ceilings and drop when you pass under | buzz · screech | air attack, stomp |
| **Imps** (deeper) | cute little demons: hop after you, lob tiny fireballs | a giggle | stomp |
| **Shopkeeper** | general store: visor, apron, beard (bigger beard = better stock); polite until theft or violence, then a coach gun; after that every shopkeeper shoots on sight | raises the gun | pay, or run |
| **Chairman Devil**, Chief Hell Operator | half pinstripe robber baron (top hat, briefcase), half cartoon devil (horn, wing, tail, pitchfork); volley of hellfire memos, leap + shock ring, summons imps, (2nd half) horn charge that stuns him on a wall | hand up · crouch · snap · head down | stomp his head, hit him while stunned (×2) |
| Hazards (dr-mow's) | drill saw on a striped track, gas vent (flame jets), boiling tar kettle (spits embers), stalactite (wobbles, drops), seismic thumper (shock rings), oil casks (chain, leave fire), dynamite crates | dr-mow's tells | jump, wait, go round |
| Pickups | coins, dollar bills, Gin XXX, Golden Shovel shard, flares, shotgun, dynamite, pickaxe, shells | glow | — |

The reveal: lifting the Golden Shovel washes the crude off everyone left in the Boardroom. They
were your crew all along, and they'd been asking for help the whole way down. (Golden Shovel
status does the same to any worker you touch on the way: helping, not fighting, and they tip.)

## 6. HUD

Hearts, money (with a POWER chip), the five piggy banks (saved / broken), upgrades top-left;
depth, name, a dot per story (the exit dot ringed in gold) and feet top-centre; pause top-right.
Weapon badge (icon + ammo) and item badge (icon + count, Golden Shovel timer ring) above the
right thumb, tap to cycle. A prompt line ("USE: buy for $40 · walk out: steal it"), banners
(DEPTH 2 · PITCH DARK · PIGGY BANK SAVED · WANTED · CHAIRMAN DEVIL), a combo pop, the boss bar.
Speech bubbles and floating money are DOM, projected from the 3D view.

## 7. Art direction: "Lamp-lit oil boom"

| Hex | Role |
|---|---|
| `#07050b` | the void, fog, background |
| `#5b3a24` · `#2c2836` | dirt · bedrock bricks |
| `#ffc93a` | money, the collar, the Tycoon's lamp |
| `#e8402a` · `#ff5a3a` | imps · danger |
| `#e8d8b0` | sepia paper chrome; Rye and Special Elite type |

Toon shading (4-band ramp), welded inverted-hull ink on characters and props, ink-bordered
painted terrain tiles with per-vertex AO, per-depth tint. The camera cuts away everything above
the Tycoon's head (sloping lower toward the camera, never below his floor) and drills a hole
between the camera and him; cut faces show a dark hatch with an ink edge.

## 8. Progression

| Depth | Name | New |
|---|---|---|
| 1 | The Wellhead | beetles, oil workers, bats, the shotgun, a derrick overhead |
| 2 | The Pipeworks | snakes, casks, dynamite crates, gas vents, the pickaxe, shops |
| 3 | Tar Pits | burning workers, tar kettles, thumpers, more dark stories |
| 4 | Gusher Galleries | imps, cask clusters |
| 5 | Pitch Black Depths | dark more often than not, everything |
| — | Bedrock Boardroom | Chairman Devil, the crew, the Golden Shovel |

Side paths (boarded tunnels in the well wall): **treasure** (choose one of two upgrades: Steel-Toe
Boots, Spring Boots, Thick Overalls, Magnet Belt, Big Lamp, Rocket Boots, Blast Gloves, Gold
Teeth, Choke Barrel), **shop**, **stash** (gold veins, a weapon) and **chute** (a narrow drop to
a lower story, sometimes into the next depth).

## 9. Verification

- `tools/sim-check.mjs`: the generator's proof over many seeds (the bottom reachable without
  digging, every piggy reachable, no traps) and every rule through the real sim.
- `tools/autopilot.mjs`: the pilot (`js/sim/pilot.js`) drives the real controls from the wellhead
  to the Boardroom. The same pilot is the title screen's attract mode (`?autoplay` in play).
- `tools/smoke.mjs`: desktop, phone, phone landscape, tablet; 0 console errors, 0 page scroll,
  touch stick and buttons reach the sim.

## 10. Performance budget

| Budget | Target |
|---|---|
| Real lights | lamp + fill + 5 pooled (lanterns, flares, fire; this story only) + 1 blast flash |
| Terrain | one merged mesh per story, rebuilt when dug; five stories drawn |
| Characters | one merged mesh + hull per moving part; money is two instanced meshes |
| DPR | ≤ 2 (`?dpr=1` for slow devices) |

## 11. Open questions

- Persistent unlocks between runs (a starting upgrade bought with banked money)?
- A daily seed with a shared board?
- A water level (the well floods) or a gusher that pushes you back up?

## Delta log

### claude/sharp-goldberg-hwk1tx: first playable

- Seeded generator with stories, shafts, collars, side rooms, chutes, dark stories, dr-mow
  hazards, the Boardroom; BFS proof with re-rolls; the autopilot proof.
- The Tycoon (shovel always; pickaxe, shotgun, dynamite pickups), stomps and combos, money as
  power, Gin XXX, Golden Shovel status, flares, upgrades, the piggy bank, shops with theft and a
  run-long grudge, burning workers, bats, imps, Chairman Devil.
- Cutaway isometric renderer, light pool and dark stories, toon + ink models, the art bible,
  synth audio and voices, dr-mow's touch layout, keyboard, gamepad, attract mode.
- Verified: sim checks (599 at 30 seeds), autopilot (12 seeds reach the Boardroom), smoke
  (desktop, phone, landscape, tablet) with 0 console errors and 0 page scroll.
