// Headless checks: the generator's proof over many seeds, then every rule through the real sim.
//   node tools/sim-check.mjs [seeds]
import { generate } from '../js/sim/gen.js';
import { createWorld, step, addWeapon, applyUpgrade } from '../js/sim/world.js';
import { T, DEPTHS } from '../js/sim/tuning.js';
import { B } from '../js/sim/grid.js';
import { addEnt, explode, damageEnemy, ignite, power } from '../js/sim/common.js';
import { makeEnemy } from '../js/sim/enemies.js';

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra); } };
const IDLE = { mx: 0, mz: 0, jump: false, jumpP: false, attackP: false, useP: false, cycleW: false, cycleI: false };
const run = (w, sec, c = {}, edge = true) => { for (let i = 0; i < Math.round(sec / T.STEP); i++) { const ctl = { ...IDLE, ...c }; if (!edge || i > 0) { ctl.jumpP = ctl.attackP = ctl.useP = ctl.cycleW = ctl.cycleI = false; } w._jumpHeld = ctl.jump; step(w, ctl, T.STEP); } };
const evs = (w) => { const e = w.events.map((q) => q.type); w.events.length = 0; return e; };

// a flat test pad: clear a story of everything and put the Tycoon in the middle of its floor
function pad(seed = 11, storyKind = 'chamber') {
  const w = createWorld(seed);
  const s = w.lv.stories.find((q) => q.kind === storyKind && q.depth === 1 && !q.dark) || w.lv.stories[1];
  const g = w.grid;
  for (let y = s.floorTop; y < s.top; y++) for (let z = T.W0; z <= T.W1; z++) for (let x = T.W0; x <= T.W1; x++) g.set(x, y, z, B.AIR);
  for (let z = T.W0; z <= T.W1; z++) for (let x = T.W0; x <= T.W1; x++) g.set(x, s.floorTop - 1, z, B.DIRT);
  w.ents = w.ents.filter((e) => Math.abs(e.y - s.floorTop) > 10);
  w.hazards = w.hazards.filter((h) => Math.abs(h.y - s.floorTop) > 10);
  const p = w.player;
  Object.assign(p, { x: 14.5, y: s.floorTop, z: 14.5, vx: 0, vy: 0, vz: 0 });
  run(w, 0.2);
  evs(w);
  w.s = s;
  return w;
}

// ------------------------------------------------------------------ the generator
const N = +(process.argv[2] || 40);
let retries = 0;
for (let seed = 1; seed <= N; seed++) {
  const lv = generate(seed * 7919);
  retries += lv.attempt;
  ok(lv.proof.ok, `seed ${seed * 7919} finishable without digging`, lv.proof.why);
  const st = lv.stories;
  for (let d = 0; d < DEPTHS.length - 1; d++) {
    const ds = st.filter((s) => s.depth === d);
    const col = ds.filter((s) => s.floor === 'collar');
    ok(col.length === 1 && col[0].holes.length === 1 && col[0].holes[0].x1 - col[0].holes[0].x0 === 2, `seed ${seed}: depth ${d + 1} ends in one 3×3 collar hole`);
    ok(lv.spawns.filter((e) => e.type === 'piggy' && e.depth === d).length === 1, `seed ${seed}: depth ${d + 1} has its piggy bank`);
    ok(ds.every((s) => s.floor === 'collar' || s.holes.length >= 1), `seed ${seed}: every story of depth ${d + 1} has a way down`);
  }
  ok(lv.spawns.some((e) => e.type === 'boss') && lv.spawns.some((e) => e.type === 'goldenShovel'), `seed ${seed}: the Boardroom has the Chairman and the Shovel`);
  ok(lv.rooms.some((r) => r.kind === 'shop'), `seed ${seed}: at least one shop`);
}
console.log(`generator: ${N} seeds, ${retries} re-rolls`);

// ------------------------------------------------------------------ movement
{
  const w = pad();
  const p = w.player, y0 = p.y;
  let top = y0;
  for (let i = 0; i < 120; i++) { step(w, { ...IDLE, jump: true, jumpP: i === 0 }, T.STEP); w._jumpHeld = true; top = Math.max(top, p.y); }
  ok(top - y0 > 2.2 && top - y0 < 2.5, 'jump apex clears a 2-high step', (top - y0).toFixed(2));
  run(w, 1);
  const x0 = p.x; run(w, 1, { mx: 1 }); ok(Math.abs(p.x - x0 - T.RUN) < 0.8, 'run speed', (p.x - x0).toFixed(2));
  // variable jump: a tap is lower
  run(w, 0.5); const yb = p.y; let tap = yb;
  for (let i = 0; i < 120; i++) { step(w, { ...IDLE, jump: i < 6, jumpP: i === 0 }, T.STEP); tap = Math.max(tap, p.y); }
  ok(tap - yb < 1.6, 'a tapped jump is shorter', (tap - yb).toFixed(2));
}
// mantle: a jump into a 2-high ledge pops you on top
{
  const w = pad(); const p = w.player, g = w.grid, fy = w.s.floorTop;
  g.set(16, fy, 14, B.DIRT); g.set(16, fy + 1, 14, B.DIRT);
  run(w, 0.05, { mx: 1, jump: true, jumpP: true });
  run(w, 0.55, { mx: 1, jump: true }, false);
  run(w, 0.8);
  ok(p.y >= fy + 2 - 0.01 && Math.floor(p.x) === 16, 'jump onto a 2-high block', `${(p.y - fy).toFixed(2)} at x ${p.x.toFixed(2)}`);
}

// ------------------------------------------------------------------ shovel, plunge, stomp
{
  const w = pad(); const p = w.player, g = w.grid, fy = w.s.floorTop;
  g.set(15, fy, 14, B.DIRT); p.face = Math.PI / 2;
  run(w, 0.1, { attackP: true });
  ok(g.get(15, fy, 14) === B.AIR, 'the shovel digs the block in front');
  g.set(15, fy, 14, B.CLAY); run(w, 0.4); run(w, 0.1, { attackP: true });
  ok(g.get(15, fy, 14) === B.CLAY, 'clay takes two shovel hits'); run(w, 0.4); run(w, 0.1, { attackP: true });
  ok(g.get(15, fy, 14) === B.AIR, 'clay breaks on the second');
  // plunge digs down
  run(w, 0.3); const yb = p.y;
  run(w, 0.15, { jump: true, jumpP: true }); run(w, 0.05, { attackP: true }); run(w, 1.2);
  ok(p.y < yb - 0.5, 'jump + attack plunges through the dirt floor', (yb - p.y).toFixed(2));
}
{
  const w = pad(); const p = w.player;
  const b = addEnt(w, makeEnemy('beetle', 14.5, p.y, 14.5, 0)); p.y += 3; p.vy = 0;
  run(w, 1);
  ok(!b.alive && evs(w).includes('stomp'), 'falling on a beetle stomps it');
  ok(p.hp === T.HP_START, 'a stomp costs no health');
  const wk = addEnt(w, makeEnemy('worker', p.x, p.y, p.z, 0)); p.y += 5; p.vy = 0; p.iframes = 0;
  for (let i = 0; i < 6 && wk.alive; i++) { p.y = wk.y + 3; p.vy = -2; run(w, 0.5); }
  ok(!wk.alive, 'oil workers go down to stomps (knocked out)');
  ok(w.ents.some((e) => e.kind === 'knocked' && e.alive), 'a knocked-out worker lies there');
}
// combo pays on landing
{
  const w = pad(); const p = w.player;
  for (let i = 0; i < 4; i++) addEnt(w, makeEnemy('bat', p.x, p.y + 0.4 + i * 1.15, p.z, 0, { state: 'roost' }));
  p.y += 4.95; p.vy = 0; const g0 = p.gold;
  run(w, 2.5, { jump: false });
  const e = evs(w);
  ok(e.includes('combo'), 'four air kills pay a combo on landing', e.filter((q) => q === 'kill').length);
  ok(p.gold > g0, 'the combo pays money');
}

// ------------------------------------------------------------------ money is power
{
  const w = pad(); const p = w.player;
  ok(power(p) === 1, 'no money, ×1');
  p.gold = 250; ok(Math.abs(power(p) - 2) < 1e-9, '$250 doubles damage');
  p.gold = 5000; ok(power(p) === T.POWER_CAP, 'power is capped');
  p.gold = 100; p.iframes = 0;
  const wk = addEnt(w, makeEnemy('worker', p.x + 0.5, p.y, p.z, 0)); wk.state = 'grab'; wk.t = 0.2;
  run(w, 0.3);
  ok(p.hp === T.HP_START - 1 && p.gold < 100, 'a hit costs a heart and spills money', `${p.hp} ${p.gold}`);
  ok(w.ents.filter((e) => e.kind === 'gold' && e.life < 99).length > 0, 'spilled money can be grabbed back');
}

// ------------------------------------------------------------------ weapons
{
  const w = pad(); const p = w.player, g = w.grid;
  addWeapon(w, 'shotgun');
  ok(p.weapon === 'shotgun' && p.ammo.shotgun === T.SHELLS_PICKUP, 'shotgun pickup');
  const wk = addEnt(w, makeEnemy('worker', p.x + 2, p.y, p.z, 0)); p.face = Math.PI / 2;
  run(w, 0.1, { attackP: true });
  ok(wk.hp < wk.maxHp && p.ammo.shotgun === T.SHELLS_PICKUP - 1, 'the shotgun hits and uses a shell');
  run(w, 0.6);
  run(w, 0.55, { jump: true, jumpP: true }); const vyBefore = p.vy;
  run(w, 0.02, { attackP: true });
  ok(vyBefore < 0 && p.vy > 5, 'firing down in the air holds you up (gunboots)', `${vyBefore.toFixed(1)} → ${p.vy.toFixed(1)}`);
  p.ammo.shotgun = 1; run(w, 1); run(w, 0.05, { attackP: true });
  ok(p.weapon === 'shovel' && !p.weapons.includes('shotgun'), 'out of shells: back to the shovel');
  ok(p.weapons.includes('shovel'), 'the shovel is always there');
  addWeapon(w, 'pickaxe');
  Object.assign(p, { x: 14.5, z: 14.5, vx: 0, vz: 0 }); run(w, 1.5);
  const fy = Math.floor(p.y + 0.01); g.set(15, fy, 14, B.CLAY); p.face = Math.PI / 2; run(w, 0.1, { attackP: true });
  ok(g.get(15, fy, 14) === B.AIR && p.ammo.pickaxe === T.PICKAXE_USES - 1, 'the pickaxe breaks clay in one swing and wears', `${g.get(15, fy, 14)} ${p.ammo.pickaxe}`);
}
{
  const w = pad(); const p = w.player, g = w.grid, fy = w.s.floorTop;
  addWeapon(w, 'bombs'); p.face = Math.PI / 2;
  run(w, 0.05, { attackP: true });
  ok(w.ents.some((e) => e.kind === 'bomb'), 'dynamite is thrown');
  run(w, 0.4, { mx: -1 }); run(w, 3);
  const e = evs(w);
  ok(e.includes('boom'), 'it blows');
  let holes = 0; for (let z = 12; z <= 17; z++) for (let x = 15; x <= 20; x++) if (g.get(x, fy - 1, z) === B.AIR) holes++;
  ok(holes > 2, 'and breaks the floor', holes);
}
{
  const w = pad(); const fy = w.s.floorTop;
  const b1 = addEnt(w, { kind: 'barrel', x: 11, y: fy, z: 11, hw: 0.34, h: 0.82, rest: true });
  const b2 = addEnt(w, { kind: 'barrel', x: 12.2, y: fy, z: 11, hw: 0.34, h: 0.82, rest: true });
  const t = addEnt(w, { kind: 'tnt', x: 13.4, y: fy, z: 11, hw: 0.34, h: 0.7, rest: true, fuse: 0 });
  explode(w, 10.5, fy + 0.4, 11, 1.4, 1, 'bomb');
  run(w, 2.5);
  ok(!b1.alive && !b2.alive, 'barrels chain');
  ok(!t.alive, 'and set off the dynamite crate');
  ok(w.ents.some((e) => e.kind === 'fire') || evs(w).includes('boom'), 'casks leave fire');
}

// ------------------------------------------------------------------ items
{
  const w = pad(); const p = w.player;
  p.hp = 1; p.items.gin = 1; p.itemSel = 'gin';
  run(w, 0.05, { useP: true });
  ok(p.hp === 1 + T.GIN_HEAL && p.items.gin === 0, 'Gin XXX heals');
  p.items.shard = 1; p.itemSel = 'shard'; run(w, 0.05, { useP: true });
  ok(p.golden > 0, 'the Golden Shovel shard: golden status');
  const wk = addEnt(w, makeEnemy('worker', p.x + 0.3, p.y, p.z, 0)); wk.state = 'grab'; wk.t = 0.2;
  run(w, 0.4);
  ok(p.hp === 3 && wk.saved, 'golden: no damage, and touching a worker washes the oil off', `${p.hp} ${wk.saved}`);
  p.items.flare = 1; p.itemSel = 'flare'; run(w, 0.05, { useP: true });
  ok(w.ents.some((e) => e.kind === 'flare' && e.alive), 'a flare is thrown');
}
// dark: lanterns light when you walk up to them
{
  const w = pad(); const p = w.player;
  const l = { x: p.x + 1, y: p.y + 1.2, z: p.z, lit: false, id: 999 };
  w.lanterns.push(l);
  run(w, 0.5, { mx: 1 });
  ok(l.lit, 'walking up to an unlit lantern strikes it');
}

// ------------------------------------------------------------------ the piggy bank
{
  const w = createWorld(23);
  const pig = w.ents.find((e) => e.kind === 'piggy' && e.depth === 0);
  const p = w.player;
  Object.assign(p, { x: pig.x - 0.5, y: pig.y, z: pig.z, vx: 0, vy: 0, vz: 0 });
  run(w, 0.1, { useP: true });
  ok(p.carry === pig, 'USE picks the piggy up');
  // carry it into the collar hole
  const col = w.lv.stories.find((s) => s.depth === 0 && s.floor === 'collar');
  const h = col.holes[0];
  Object.assign(p, { x: (h.x0 + h.x1 + 1) / 2, z: (h.z0 + h.z1 + 1) / 2, y: col.floorTop + 0.5, vy: 0 });
  run(w, 2.5);
  ok(w.piggies[0] === 'saved', 'carried through the collar: saved', w.piggies[0]);
  const pig2 = w.ents.find((e) => e.kind === 'piggy' && e.depth === 1);
  for (let i = 0; i < 5; i++) { pig2.hurtT = 0; w.hurtPiggy(pig2, 1, 'player'); }
  ok(!pig2.alive && w.piggies[1] === 'broken', 'enough hits break it');
}

// ------------------------------------------------------------------ shops
{
  const w = createWorld(31);
  const k = w.ents.find((e) => e.kind === 'shopkeeper');
  const room = w.lv.rooms[k.shop];
  const ware = w.ents.find((e) => e.kind === 'ware' && e.shop === k.shop);
  const p = w.player;
  Object.assign(p, { x: ware.x, y: ware.y, z: ware.z + 0.01, vx: 0, vy: 0, vz: 0, gold: 1000 });
  run(w, 0.05, { useP: true });
  ok(p.carry === ware, 'USE picks up a ware');
  run(w, 0.05, { useP: true });
  ok(!ware.alive && p.gold === 1000 - ware.price, 'USE again pays for it');
  const w2 = ware.shop, ware2 = w.ents.find((e) => e.kind === 'ware' && e.shop === w2 && e.alive);
  Object.assign(p, { x: ware2.x, y: ware2.y, z: ware2.z + 0.01 });
  run(w, 0.05, { useP: true });
  ok(p.carry === ware2, 'pick up another');
  // walk it out of the shop: teleport to the doorway, then into the well
  Object.assign(p, { x: room.door.x + (room.side === 0 ? 1.5 : room.side === 1 ? -1.5 : 0), z: room.door.z + (room.side === 2 ? 1.5 : room.side === 3 ? -1.5 : 0) });
  run(w, 0.1);
  ok(w.stats.stolen === 1 && k.state === 'angry' && w.shopAnger, 'walking out unpaid is theft: the shopkeeper turns', `${w.stats.stolen} ${k.state}`);
  // every later shopkeeper shoots on sight
  const k2 = w.ents.find((e) => e.kind === 'shopkeeper' && e !== k);
  if (k2) {
    Object.assign(p, { x: k2.x + 2 * Math.sin(k2.face), z: k2.z + 2 * Math.cos(k2.face), y: k2.y });
    run(w, 0.5);
    ok(k2.state === 'angry', 'the next shopkeeper knows your face');
  }
  // violence also counts
  const w3 = createWorld(31), k3 = w3.ents.find((e) => e.kind === 'shopkeeper');
  damageEnemy(w3, k3, 1, 'pick', w3.player);
  ok(k3.state === 'angry' && w3.shopAnger, 'hitting a shopkeeper angers him');
}

// ------------------------------------------------------------------ fire
{
  const w = pad(); const p = w.player, fy = w.s.floorTop;
  const a = addEnt(w, makeEnemy('worker', 11, fy, 11, 2)), b = addEnt(w, makeEnemy('worker', 11.5, fy, 11.2, 2));
  a.burning = false; b.burning = false;
  ignite(w, a, 'test');
  run(w, 0.5);
  ok(a.burning && b.burning, 'a burning worker catches the next one');
  p.iframes = 0; Object.assign(p, { x: a.x, z: a.z + 0.2 });
  run(w, 0.2);
  ok(p.burn > 0, 'and catches you');
}

// ------------------------------------------------------------------ the Chairman
{
  const w = createWorld(41);
  const boss = w.ents.find((e) => e.boss), shovel = w.ents.find((e) => e.kind === 'goldenShovel');
  const s = w.lv.shrine, p = w.player;
  Object.assign(p, { x: 14.5, y: s.floorTop + 0.01, z: 19, hp: 99, maxHp: 99 });
  run(w, 3);
  ok(w.bossIntro && boss.state !== 'sleep', 'the Chairman wakes when you arrive');
  let phase2 = false;
  for (let i = 0; i < 400 && boss.alive && boss.state !== 'dying'; i++) { damageEnemy(w, boss, 2, 'test', p); phase2 ||= boss.phase === 2; boss.hurtT = 0; run(w, 0.05); }
  ok(phase2, 'below half he gets personal (phase 2)');
  run(w, 3.5);
  ok(!boss.alive && !shovel.locked, 'he falls and the case opens');
  Object.assign(p, { x: shovel.x, z: shovel.z + 0.3, y: shovel.y });
  run(w, 0.3);
  ok(w.reveal > 0, 'taking the Golden Shovel starts the reveal');
  ok(w.ents.filter((e) => e.kind === 'worker' && e.crew).every((e) => e.saved || !e.alive), 'the crew is washed clean');
  run(w, 5);
  ok(w.state === 'won', 'and the run is won');
}

// ------------------------------------------------------------------ a run of the real loop: no throws, nothing NaN
for (const seed of [3, 5, 8]) {
  const w = createWorld(seed);
  let threw = null;
  try {
    for (let i = 0; i < 4000; i++) {
      const a = i * 0.013;
      step(w, { ...IDLE, mx: Math.sin(a), mz: Math.cos(a * 0.7), jump: i % 90 < 20, jumpP: i % 90 === 0, attackP: i % 37 === 0, useP: i % 400 === 0 }, T.STEP);
      w.events.length = 0;
      if (w.state !== 'play') break;
    }
  } catch (e) { threw = e; }
  ok(!threw, `seed ${seed}: 33 s of random play doesn't throw`, threw?.stack);
  ok(Number.isFinite(w.player.x + w.player.y + w.player.z), `seed ${seed}: the Tycoon is somewhere`);
}

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
