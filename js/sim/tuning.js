// Every number the rules use, each with the reason it has that value (house rule).
// Units: 1 cell = 1 m, seconds, m/s. y is up; the well goes down toward y = 0.

export const T = {
  // ------------------------------------------------------------------ the well
  NX: 29, NZ: 29,            // 13-cell well + an 8-cell rock ring each side for side rooms
  W0: 8, W1: 20,             // the well's interior, inclusive (13 × 13: a 3 s run across)
  STORY_H: 7,                // 1 floor + 6 air: a ledge 3 up still has head room
  SHRINE_H: 11,              // the Bottom is a taller hall, so the reveal has room
  TOP_AIR: 8,                // open well mouth above the first story (the night sky)

  // ------------------------------------------------------------------ the digger
  P_HW: 0.3,                 // half width: slips through a 1-cell hole with room to spare
  P_H: 0.9,                  // chibi height: under 1 cell, so 1-high tunnels work
  RUN: 4.4,                  // crosses the well in ~3 s
  ACCEL_GROUND: 46,          // ~0.1 s to full speed: responsive without feeling weightless
  ACCEL_AIR: 20,             // some air control, so a fall can be steered onto a head
  FRICTION: 38,              // stops in ~0.12 s when the stick lets go
  GRAVITY: 30,               // snappy arcs; a story (7 m) falls in ~0.7 s
  GRAVITY_RISE_RELEASED: 62, // jump released early: the rise is cut (variable jump height)
  MAX_FALL: 17,              // terminal speed keeps landings readable at 60 fps
  JUMP_V: 11.9,              // apex v²/2g = 2.36 cells: clears a 2-high mesa
  SPRING_JUMP: 1.16,         // Spring Boots: apex ×1.35 (v ×1.16)
  COYOTE: 0.1,               // jump still works just after walking off a ledge
  JUMP_BUFFER: 0.13,         // a press just before landing still jumps
  LEDGE_POP: 0.5,            // feet within this of a ledge top while pushing into it: pop up (mantle assist)
  STOMP_BOUNCE: 9.5,         // bounce off a stomped head: back up ~1.5 cells
  STOMP_BOUNCE_HELD: 12.5,   // holding jump bounces higher (Downwell / Mario)
  HURT_IFRAMES: 1.3,         // blink after a hit; long enough to get clear of a crowd
  HURT_KNOCK: 6,             // knockback speed away from the source
  HP_START: 4,               // Spelunky's four hearts
  HP_CAP: 6,                 // Thick Overalls ×2 at most

  // ------------------------------------------------------------------ gold = power
  POWER_PER_GOLD: 1 / 250,   // 250 gold doubles damage
  POWER_CAP: 4,              // ×4 at 750 gold: strong, not invincible
  SPILL_FRAC: 0.12,          // a hit spills 12 % of your gold (Sonic rings)
  SPILL_MIN: 3,
  SPILL_MAX_NUGGETS: 14,     // the spill is drawn as at most this many nuggets (each worth a share)
  SPILL_GRAB_DELAY: 0.45,    // spilled gold can't be re-grabbed instantly (it has to fly out first)
  SPILL_LIFE: 3.2,           // spilled gold vanishes after this: grab it back quickly
  MAGNET_R: 1.1,             // nuggets drift in from this far
  MAGNET_BELT_R: 3.4,        // Magnet Belt range
  PICK_R: 0.55,              // pickup radius (generous: house rule 53)
  COMBO_MIN: 3,              // a combo pays from 3 air kills
  COMBO_GOLD: 2,             // gold per kill in a paid combo
  COMBO_HEAL: 8,             // 8 air kills in one fall also heal a heart

  // ------------------------------------------------------------------ weapons
  SHOVEL_CD: 0.3,            // the shovel: always in hand, quick
  SHOVEL_REACH: 1.05,        // swing reach from the digger's centre
  SHOVEL_DMG: 1,
  PICKAXE_CD: 0.42,          // the pickaxe pickup: slower, heavier
  PICKAXE_REACH: 1.2,
  PICKAXE_DMG: 2.2,
  PICKAXE_DIG: 3,            // hits a block takes from one swing (clay and gold veins go in one)
  PICKAXE_USES: 45,          // swings before the handle snaps
  PLUNGE_V: 15,              // the downward plunge (shovel or pickaxe)
  PLUNGE_DIG: 2,             // a plunge digs at most this many blocks before it stops
  PLUNGE_DMG: 1.6,
  STOMP_DMG: 1.5,
  STEELTOE: 2,               // Steel-Toe Boots stomp multiplier
  SHOT_CD: 0.5,
  SHOT_PELLETS: 7,
  SHOT_CHOKE_EXTRA: 3,
  SHOT_SPREAD: 0.42,         // cone half-angle (radians) on the ground
  SHOT_RANGE: 6.5,
  SHOT_DIG_RANGE: 3.2,       // pellets break dirt only this close
  SHOT_DMG: 0.55,            // per pellet: 7 at point blank ≈ 3.9
  SHOT_RECOIL_AIR: 8.5,      // firing down in the air: Downwell's gunboots hover
  SHOT_RECOIL_GROUND: 3,     // shoved back a little on the ground
  SHELLS_PICKUP: 12, SHELLS_BOX: 8, SHELLS_MAX: 30,
  BOMB_CD: 0.45,
  BOMB_THROW: [6.2, 5.2],    // forward, up (m/s): lands ~3–4 cells out
  BOMB_FUSE: 2.2,
  BOMB_R: 1.9,               // blocks inside this break
  BOMB_DMG: 4,
  BOMB_SELF: 2,              // Spelunky: your bombs hurt you (Blast Gloves: 0)
  BOMBS_PICKUP: 5, BOMBS_MAX: 12,

  // ------------------------------------------------------------------ hazards
  TNT_FUSE: 1.6,             // long enough to run 6 cells
  TNT_R: 2.6, TNT_DMG: 6,
  BARREL_R: 2.1, BARREL_DMG: 4,
  BARREL_CHAIN: 0.16,        // chained barrels pop one after another, not all in one frame
  FIRE_LIFE: 3,              // a burst barrel leaves fire this long
  FIRE_TICK: 0.6,            // fire hurts at most once per tick
  BLAST_PLAYER: 2,           // hearts an explosion takes from the digger

  // ------------------------------------------------------------------ items
  GIN_HEAL: 2,
  GIN_MAX: 3,
  SHARD_MAX: 2,
  GOLDEN_TIME: 8,            // Golden Shovel status: Mario Kart's star
  GOLDEN_SPEED: 1.25,

  // ------------------------------------------------------------------ enemies (base; × depth scale)
  ENEMY_HP_PER_DEPTH: 0.35,  // +35 % HP per depth: keeps pace with the gold you collect
  WORKER: { hp: 3, hw: 0.32, h: 0.95, speed: 1.4, chase: 2.1, sight: 7.5, reach: 0.95, windup: 0.5, recover: 0.7, gold: [4, 7] },
  BEETLE: { hp: 1, hw: 0.3, h: 0.45, speed: 1.3, gold: [1, 2] },
  SNAKE: { hp: 2, hw: 0.3, h: 0.5, speed: 1.0, lunge: 5.5, lungeT: 0.32, rear: 0.45, range: 2.4, gold: [2, 3] },
  FLY: { hp: 1, hw: 0.28, h: 0.5, speed: 1.6, swoop: 5.2, sight: 6, gold: [1, 2] },
  BAT: { hp: 1, hw: 0.26, h: 0.4, wake: 4.2, speed: 3.4, wobble: 2.2, gold: [1, 2] }, // roosts on the ceiling, drops, flutters at you (Spelunky)
  IMP: { hp: 1.5, hw: 0.26, h: 0.62, hop: [7.2, 2.6], hopGap: [0.5, 1.0], sight: 8, throwCd: 2.6, throwRange: 7, fireV: 5, gold: [2, 4] }, // cute, bouncy, throws tiny fireballs
  CONTACT_DMG: 1,
  BURNING: { chance: [0, 0, 0.18, 0.25, 0.3], chase: 3.0, burstR: 1.3, burstLife: 2.2 }, // lit oil workers (Tar Pits on): panicked, fast, catching
  PLAYER_BURN: 2.4,          // seconds the Tycoon burns after catching fire (it spreads to whatever he touches)

  // ------------------------------------------------------------------ the piggy bank (Spelunky's damsel)
  PIGGY: { hp: 4, hw: 0.28, h: 0.5 },   // four hits and it shatters: fragile, but one slip isn't the end
  PIGGY_PICK_R: 0.95,        // USE within this picks it up
  PIGGY_CARRY_SPEED: 0.9,    // carrying slows you a little
  PIGGY_THROW: [5.2, 4.2],   // ATTACK while carrying throws it (forward, up)
  PIGGY_FALL_HURT: 13.5,     // landing faster than this cracks it (a one-story drop on its own does)
  PIGGY_SAVE_GOLD: [30, 12], // saving pays 30 + 12 per depth…
  PIGGY_SAVE_HEAL: 1,        // …and a heart (Spelunky's kiss)
  PIGGY_BREAK_GOLD: 8,       // a broken piggy only spills this much

  // ------------------------------------------------------------------ the dark
  DARK_LAMP: 0.12,           // in a dark story the carbide lamp sputters to this fraction: a circle you can just see your feet in
  LANTERN_LIGHT_R: 1.3,      // walk this close to an unlit lantern and you strike it
  FLARE_LIFE: 24,            // a thrown flare burns this long
  FLARE_THROW: [5.5, 5.5],
  FLARE_MAX: 4,

  // ------------------------------------------------------------------ shops
  SHOPKEEPER: { hp: 14, hw: 0.36, h: 1.15, speed: 3.3, sight: 9, gold: [20, 30] },
  SHOP_SHOT_CD: 1.5,         // an angry shopkeeper's shotgun: one blast every 1.5 s
  SHOP_SHOT_WINDUP: 0.45,    // he raises it first (the tell)
  SHOP_SHOT_RANGE: 6,
  SHOP_SHOT_DMG: 1,
  PRICE_PER_DEPTH: 0.12,     // shop prices rise 12 % a depth
  PRICE: { gin: 40, bombs: 50, shells: 35, shard: 150, upgrade: 120, heart: 120, shotgun: 70, pickaxe: 55, flares: 30 },

  // ------------------------------------------------------------------ sim
  STEP: 1 / 120,             // fixed step: no tunnelling through 1-cell floors at max fall
  MAX_DT: 1 / 30,            // house rule 2: clamp dt at both ends
};

// The depths, top to bottom. `stories` counts the landing; the last story's floor is the collar.
export const DEPTHS = [
  { name: 'The Wellhead', theme: 0, stories: 4 },
  { name: 'The Pipeworks', theme: 1, stories: 5 },
  { name: 'Tar Pits', theme: 2, stories: 5 },
  { name: 'Gusher Galleries', theme: 3, stories: 6 },
  { name: 'Pitch Black Depths', theme: 4, stories: 6 },
  { name: 'Bedrock Boardroom', theme: 5, stories: 1, shrine: true },
];

// Per depth (index 0..4): how many of each thing a chamber story gets.
export const POP = {
  workers: [1, 2, 2, 3, 3],
  beetles: [2, 2, 2, 2, 2],
  snakes: [0, 1, 1, 2, 2],
  flies: [0, 0, 1, 1, 2],
  shaftFlies: [2, 3, 3, 4, 5],
  bats: [1, 1, 2, 2, 3],      // per chamber, hung from the ceiling
  imps: [0, 0, 0, 2, 3],      // the cute little demons arrive as you get near the bottom
  shaftImps: [0, 0, 0, 1, 2],
  barrels: [0, 1, 2, 3, 3],
  tnt: [0, 1, 1, 1, 2],
  crates: [2, 2, 2, 2, 2],
  lanterns: [3, 3, 2, 2, 1],
};

export const UPGRADES = {
  steeltoe: { name: 'Steel-Toe Boots', desc: 'Stomps hit twice as hard' },
  spring: { name: 'Spring Boots', desc: 'Jump a third higher' },
  overalls: { name: 'Thick Overalls', desc: '+1 heart, and heal one' },
  magnet: { name: 'Magnet Belt', desc: 'Gold flies to you' },
  lamp: { name: 'Big Lamp', desc: 'Your headlamp reaches twice as far' },
  rocket: { name: 'Rocket Boots', desc: 'Jump again in mid-air' },
  gloves: { name: 'Blast Gloves', desc: 'Your own bombs don’t hurt you' },
  teeth: { name: 'Gold Teeth', desc: 'Gold powers you 50 % more' },
  choke: { name: 'Choke Barrel', desc: 'The shotgun fires 3 more pellets' },
};

export const ITEMS = {
  gin: { name: 'Gin XXX', desc: 'Heals 2 hearts' },
  shard: { name: 'Golden Shovel', desc: '8 s: nothing can hurt you' },
  flare: { name: 'Flare', desc: 'Throw it to light the dark' },
};

export const WEAPONS = {
  shovel: { name: 'Shovel' },     // always in hand, never lost
  pickaxe: { name: 'Pickaxe' },
  shotgun: { name: 'Shotgun' },
  bombs: { name: 'Bombs' },
};

// What shops stock (each shop draws four; weights favour weapons and power-ups)
export const SHOP_STOCK = [['shotgun', 3], ['bombs', 3], ['pickaxe', 2], ['gin', 3], ['shard', 2], ['upgrade', 3], ['heart', 1], ['shells', 1], ['flares', 2]];
