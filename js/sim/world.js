// The world: createWorld(seed) and step(world, control, dt). Pure (no three.js, no DOM).
//
// control = { mx, mz, jump, jumpP, attackP, useP, cycleW, cycleI }
//   (mx, mz): the wanted move in world x/z, length ≤ 1 (main.js turns the screen stick into it)
//   *P: pressed this step (edges; input latches them until a step consumes them)
import { T, DEPTHS, ITEMS } from './tuning.js';
import { moveBody, onGround, rayGrid, breakable } from './grid.js';
import { generate } from './gen.js';
import { mulberry32 } from './rng.js';
import { emit, power, storyAt, hitBlock, addEnt, spawnGold, hurtPlayer, damageEnemy, explode, breakCrate, rayBox, overlap, ignite, burnPlayer } from './common.js';
import { makeEnemy, stepEnemy } from './enemies.js';
import { stepHazard, stepEmber } from './hazards.js';
import { makeBoss, stepBoss, bossDamage } from './boss.js';

const CARRIABLE = (e) => e.kind === 'piggy' || e.kind === 'ware';
const PROP = (e) => e.kind === 'barrel' || e.kind === 'tnt' || e.kind === 'crate';
const PICKUP = (e) => e.kind === 'gold' || e.kind === 'item' || e.kind === 'weapon' || e.kind === 'ammo' || e.kind === 'upgrade';

export function createWorld(seed, opts = {}) {
  const lv = generate(seed);
  const w = {
    seed, lv, grid: lv.grid, t: 0, events: [], dirty: new Set(), ents: [], hazards: [],
    rand: mulberry32((seed ^ 0x5eed1e) >>> 0), state: 'play', endT: 0, hitstop: 0, shake: 0,
    depthIdx: 0, storyIdx: 0, deepest: 0, prompt: null, shopAnger: false, reveal: 0, bossIntro: 0,
    piggies: DEPTHS.slice(0, -1).map(() => 'waiting'),
    lanterns: lv.lanterns.map((l, i) => ({ ...l, id: i, lit: !l.unlit })),
    darkSeen: new Set(),
    stats: { kills: 0, dug: 0, hits: 0, gold: 0, bestCombo: 0, stomps: 0, time: 0, stolen: 0, bought: 0 },
  };
  w.hurtPiggy = (e, dmg, cause) => hurtPiggy(w, e, dmg, cause);
  w.angerShop = (why, keeper) => angerShop(w, why, keeper);
  w.bossDamage = bossDamage;
  const s = lv.spawn;
  w.player = {
    x: s.x, y: s.y, z: s.z, vx: 0, vy: 0, vz: 0, hw: T.P_HW, h: T.P_H, face: Math.PI, ground: true,
    coyote: 0, jumpBuf: 0, iframes: 0, hp: T.HP_START, maxHp: T.HP_START, gold: 0,
    weapons: ['shovel'], weapon: 'shovel', ammo: { shotgun: 0, bombs: 0, pickaxe: 0 },
    items: { gin: 0, shard: 0, flare: 0 }, itemSel: 'gin', upgrades: new Set(),
    golden: 0, plunge: false, plungeDug: 0, cd: 0, swing: 0, airJumps: 0, combo: 0, carry: null, landT: 0, fallV: 0,
  };
  for (const e of lv.spawns) spawnFrom(w, e);
  if (opts.debug) w.debug = true;
  return w;
}

function spawnFrom(w, s) {
  const di = Math.max(0, Math.min(4, storyOf(w, s.y).depth));
  switch (s.type) {
    case 'worker': case 'beetle': case 'snake': case 'fly': case 'imp': case 'bat':
      return addEnt(w, makeEnemy(s.type, s.x, s.y, s.z, di, s.crew ? { crew: true } : {}));
    case 'shopkeeper':
      return addEnt(w, makeEnemy('shopkeeper', s.x, s.y, s.z, di, { shop: s.shop, face: s.face, homeX: s.x, homeZ: s.z, state: 'calm', beard: s.beard || 0 }));
    case 'boss':
      return addEnt(w, makeBoss(s.x, s.y, s.z));
    case 'gold': return addEnt(w, { kind: 'gold', x: s.x, y: s.y, z: s.z, hw: 0.14, h: 0.25, value: s.value || 1, bill: !!s.bill || (s.value || 1) >= 5, rest: true, float: !!s.float, life: Infinity, grab: 0, spin: Math.random() * 6 });
    case 'barrel': return addEnt(w, { kind: 'barrel', x: s.x, y: s.y, z: s.z, hw: 0.34, h: 0.82, rest: true });
    case 'tnt': return addEnt(w, { kind: 'tnt', x: s.x, y: s.y, z: s.z, hw: 0.34, h: 0.7, rest: true, fuse: 0 });
    case 'crate': return addEnt(w, { kind: 'crate', x: s.x, y: s.y, z: s.z, hw: 0.36, h: 0.72, rest: true, loot: s.loot });
    case 'item': case 'weapon': case 'ammo': return addEnt(w, { kind: s.type, what: s.id, x: s.x, y: s.y, z: s.z, hw: 0.22, h: 0.45, rest: true });
    case 'upgrade': return addEnt(w, { kind: 'upgrade', what: s.id, group: s.group, x: s.x, y: s.y, z: s.z, hw: 0.25, h: 0.6, rest: true, float: true });
    case 'ware': return addEnt(w, { kind: 'ware', ware: s.ware, what: s.id, price: s.price, shop: s.shop, x: s.x, y: s.y, z: s.z, hw: 0.22, h: 0.45, rest: true, homeX: s.x, homeY: s.y, homeZ: s.z, paid: false });
    case 'piggy': return addEnt(w, { kind: 'piggy', depth: s.depth, x: s.x, y: s.y, z: s.z, hw: T.PIGGY.hw, h: T.PIGGY.h, hp: T.PIGGY.hp, maxHp: T.PIGGY.hp, rest: true, hurtT: 0, sayT: 3 });
    case 'goldenShovel': return addEnt(w, { kind: 'goldenShovel', x: s.x, y: s.y, z: s.z, hw: 0.4, h: 1.2, rest: true, float: true, locked: true });
    case 'saw': case 'vent': case 'vat': case 'stal': case 'thumper': {
      const h = { ...s, kind: s.type, t: 0, id: 0, alive: true, first: s.first || 0, u: 0, dir: 1, warn: 0, blast: 0, reach: 0, rings: [], state: 'hang' };
      h.id = addEnt(w, { kind: 'hz', fx: true }).id; // (an id for the renderer and sounds)
      w.hazards.push(h);
      return h;
    }
  }
  return null;
}

const storyOf = (w, y) => w.lv.stories[storyAt(w, y)];

// ---------------------------------------------------------------------------------------------- step
export function step(w, c, dt) {
  dt = Math.max(0, Math.min(dt, T.MAX_DT));
  w.t += dt;
  if (w.state === 'play') w.stats.time += dt;
  if (w.hitstop > 0) { w.hitstop -= dt; return; }
  w.shake = Math.max(0, w.shake - dt * 2.2);
  w.prompt = null;
  if (w.state === 'play') stepPlayer(w, c, dt);
  else { w.endT += dt; settlePlayer(w, dt); }
  const p = w.player;
  for (const h of w.hazards) if (h.alive && Math.abs(h.y - p.y) < 18) stepHazard(w, h, dt);
  for (let i = 0; i < w.ents.length; i++) {
    const e = w.ents[i];
    if (!e.alive) continue;
    if (Math.abs(e.y - p.y) > 16 && !e.boss) continue; // far away: asleep
    if (e.enemy) { if (e.boss) stepBoss(w, e, dt); else stepEnemy(w, e, dt); if (e.hzT > 0) e.hzT -= dt; }
    else if (e.kind === 'ember') stepEmber(w, e, dt);
    else stepThing(w, e, dt);
  }
  if (w.ents.length > 900 || (w.t % 2 < dt)) w.ents = w.ents.filter((e) => e.alive);
  // where are we?
  const si = storyAt(w, p.y), st = w.lv.stories[si];
  if (si !== w.storyIdx) {
    w.storyIdx = si;
    if (st.depth !== w.depthIdx && st.depth > w.depthIdx) { w.depthIdx = st.depth; emit(w, 'depth', { depth: st.depth, name: DEPTHS[st.depth].name }); }
    if (st.dark && !w.darkSeen.has(si)) { w.darkSeen.add(si); emit(w, 'dark', { story: si }); }
    if (st.kind === 'shrine' && !w.bossIntro) { w.bossIntro = 1; emit(w, 'bossIntro', {}); }
  }
  w.deepest = Math.max(w.deepest, si);
  if (w.reveal > 0) {
    w.reveal += dt;
    if (w.reveal > 4.2 && w.state === 'play') { w.state = 'won'; w.endT = 0; emit(w, 'won', {}); }
  }
}

function settlePlayer(w, dt) {
  const p = w.player;
  p.vx *= 1 - Math.min(1, 6 * dt); p.vz *= 1 - Math.min(1, 6 * dt);
  p.vy = Math.max(p.vy - T.GRAVITY * dt, -T.MAX_FALL);
  const hit = moveBody(w.grid, p, p.vx * dt, p.vy * dt, p.vz * dt);
  if (hit & 6) p.vy = 0;
  p.ground = (hit & 2) !== 0;
}

// ---------------------------------------------------------------------------------------------- the digger
function stepPlayer(w, c, dt) {
  const p = w.player, g = w.grid;
  p.iframes = Math.max(0, p.iframes - dt);
  if (p.golden > 0) { p.golden -= dt; if (p.golden <= 0) { p.golden = 0; emit(w, 'goldenEnd', {}); } }
  p.cd = Math.max(0, p.cd - dt); p.swing = Math.max(0, p.swing - dt); p.landT = Math.max(0, p.landT - dt);
  if (p.burn > 0) { p.burn -= dt; if (p.burn <= 0 || p.golden > 0) { p.burn = 0; emit(w, 'burnOut', {}); } }
  p.coyote = Math.max(0, p.coyote - dt); p.jumpBuf = Math.max(0, p.jumpBuf - dt);
  const carry = p.carry && p.carry.alive ? p.carry : (p.carry = null);

  if (c.cycleW) cycleWeapon(w);
  if (c.cycleI) cycleItem(w);

  // run
  const golden = p.golden > 0;
  const speed = T.RUN * (golden ? T.GOLDEN_SPEED : 1) * (carry ? T.PIGGY_CARRY_SPEED : 1);
  const m = Math.min(1, Math.hypot(c.mx, c.mz));
  if (m > 0.05) {
    const tx = c.mx * speed, tz = c.mz * speed, acc = (p.ground ? T.ACCEL_GROUND : T.ACCEL_AIR) * dt;
    p.vx += Math.max(-acc, Math.min(acc, tx - p.vx));
    p.vz += Math.max(-acc, Math.min(acc, tz - p.vz));
    if (m > 0.2) p.face = Math.atan2(c.mx, c.mz);
  } else if (p.ground) {
    const sp = Math.hypot(p.vx, p.vz), f = T.FRICTION * dt;
    if (sp <= f) { p.vx = 0; p.vz = 0; } else { p.vx -= (p.vx / sp) * f; p.vz -= (p.vz / sp) * f; }
  }

  // jump
  if (c.jumpP) p.jumpBuf = T.JUMP_BUFFER;
  const jv = T.JUMP_V * (p.upgrades.has('spring') ? T.SPRING_JUMP : 1);
  if (p.jumpBuf > 0 && (p.ground || p.coyote > 0) && !p.plunge) {
    p.vy = jv; p.ground = false; p.coyote = 0; p.jumpBuf = 0; p.jumped = true;
    emit(w, 'jump', { x: p.x, y: p.y, z: p.z });
  } else if (c.jumpP && !p.ground && p.coyote <= 0 && p.airJumps > 0 && !p.plunge) {
    p.airJumps--; p.vy = jv * 0.88; p.jumpBuf = 0; p.jumped = true;
    emit(w, 'jump2', { x: p.x, y: p.y, z: p.z });
  }

  // attack / use
  if (c.attackP && p.cd <= 0) {
    if (carry) dropCarry(w, true);
    else attack(w);
  }
  if (c.useP) use(w);

  // gravity (the rise is cut when jump is let go: variable height)
  if (p.plunge) p.vy = -T.PLUNGE_V;
  else {
    const gk = p.vy > 0 && !c.jump ? T.GRAVITY_RISE_RELEASED : T.GRAVITY;
    p.vy = Math.max(p.vy - gk * dt, -T.MAX_FALL);
  }

  // Golden Shovel: walk through dirt
  if (golden && m > 0.2) {
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    const bx = Math.floor(p.x + fx * (p.hw + 0.2)), bz = Math.floor(p.z + fz * (p.hw + 0.2));
    for (const row of [Math.floor(p.y + 0.15), Math.floor(p.y + 0.8)]) if (breakable(g.get(bx, row, bz))) hitBlock(w, bx, row, bz, 9, 'golden');
  }

  // move
  const wasGround = p.ground, fallV = p.vy, prevY = p.y;
  // the mantle assist only helps a jump (walking off into a narrow hole must not pop you back out)
  const hit = moveBody(g, p, p.vx * dt, p.vy * dt, p.vz * dt, !p.ground && p.jumped ? T.LEDGE_POP : 0);
  if (hit & 4) p.vy = Math.min(0, p.vy);
  if (hit & 16) emit(w, 'mantle', {});
  const onProp = propCollide(w, p, prevY);
  const landed = (hit & 2) !== 0 || onProp;
  if (landed) p.vy = 0;
  p.ground = landed || (p.vy <= 0 && onGround(g, p));

  if (p.plunge && (hit & 2)) plungeDig(w);
  if (p.ground && !wasGround) land(w, fallV);
  if (p.ground) p.jumped = false;
  if (!p.ground && wasGround && p.vy <= 0) p.coyote = T.COYOTE;
  if (p.ground) p.airJumps = p.upgrades.has('rocket') ? 1 : 0;

  // carried things ride above the digger's head
  if (carry) { carry.x = p.x + Math.sin(p.face) * 0.12; carry.z = p.z + Math.cos(p.face) * 0.12; carry.y = p.y + p.h + 0.02; carry.vx = p.vx; carry.vy = p.vy; carry.vz = p.vz; }

  touchEnemies(w);
  touchPickups(w);
  lanternsNear(w);
  shopChecks(w);
  if (carry && carry.kind === 'piggy') checkPiggySaved(w, carry);
}

function land(w, v) {
  const p = w.player;
  p.landT = 0.18; p.fallV = -v;
  emit(w, 'land', { x: p.x, y: p.y, z: p.z, v: -v });
  if (p.combo >= T.COMBO_MIN) {
    const gold = p.combo * T.COMBO_GOLD;
    p.gold += gold; w.stats.gold += gold;
    emit(w, 'combo', { n: p.combo, gold, heal: p.combo >= T.COMBO_HEAL });
    if (p.combo >= T.COMBO_HEAL) p.hp = Math.min(p.maxHp, p.hp + 1);
  }
  p.combo = 0;
}

function plungeDig(w) {
  const p = w.player, g = w.grid;
  const row = Math.floor(p.y - 0.5);
  const n = p.weapon === 'pickaxe' ? T.PICKAXE_DIG : 1;
  let broke = false, any = false;
  for (const x of new Set([Math.floor(p.x - p.hw + 0.02), Math.floor(p.x + p.hw - 0.02)])) for (const z of new Set([Math.floor(p.z - p.hw + 0.02), Math.floor(p.z + p.hw - 0.02)])) {
    const r = hitBlock(w, x, row, z, n, 'plunge');
    if (r) any = true;
    if (r === 'broke') broke = true;
  }
  if (broke && ++p.plungeDug < T.PLUNGE_DIG) { p.vy = -T.PLUNGE_V; return; }
  p.plunge = false; p.vy = 3.5;
  if (any) w.shake = Math.max(w.shake, 0.2);
  if (p.weapon === 'pickaxe') wearPickaxe(w);
}

// barrels, crates and TNT are solid enough to stand on and to bump into
function propCollide(w, p, prevY) {
  let on = false;
  for (const e of w.ents) {
    if (!e.alive || !PROP(e) || Math.abs(e.y - p.y) > 2) continue;
    if (!overlap(p, e)) {
      if (p.vy <= 0 && Math.abs(p.y - (e.y + e.h)) < 0.03 && Math.abs(p.x - e.x) < p.hw + e.hw - 0.02 && Math.abs(p.z - e.z) < p.hw + e.hw - 0.02) on = true;
      continue;
    }
    const top = e.y + e.h;
    if (prevY >= top - 0.15 && p.vy <= 0) { p.y = top; on = true; continue; }
    const ox = p.hw + e.hw - Math.abs(p.x - e.x), oz = p.hw + e.hw - Math.abs(p.z - e.z);
    if (ox < oz) { p.x += Math.sign(p.x - e.x || 1) * ox; p.vx = 0; } else { p.z += Math.sign(p.z - e.z || 1) * oz; p.vz = 0; }
  }
  return on;
}

// ---------------------------------------------------------------------------------------------- attacks
function attack(w) {
  const p = w.player;
  const wpn = p.weapon;
  if (wpn === 'shovel' || wpn === 'pickaxe') {
    if (!p.ground && !p.plunge) { p.plunge = true; p.plungeDug = 0; p.cd = 0.2; emit(w, 'plunge', { weapon: wpn }); return; }
    if (p.ground) swing(w, wpn);
  } else if (wpn === 'shotgun') shotgun(w);
  else if (wpn === 'bombs') throwBomb(w);
}

function swing(w, wpn) {
  const p = w.player, g = w.grid;
  const pick = wpn === 'pickaxe';
  p.cd = pick ? T.PICKAXE_CD : T.SHOVEL_CD; p.swing = 0.24;
  const reach = pick ? T.PICKAXE_REACH : T.SHOVEL_REACH;
  const dmg = (pick ? T.PICKAXE_DMG : T.SHOVEL_DMG) * power(p) * (p.golden > 0 ? 3 : 1);
  const fx = Math.sin(p.face), fz = Math.cos(p.face);
  emit(w, 'swing', { weapon: wpn, x: p.x, y: p.y, z: p.z, face: p.face });
  let struck = false;
  for (const e of w.ents) {
    if (!e.alive || e.carried || e === p.carry) continue;
    if (!(e.enemy || PROP(e) || e.kind === 'piggy')) continue;
    const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
    if (d > reach + e.hw) continue;
    const cy = e.y + (e.h || 0.6) * 0.5;
    if (Math.abs(cy - (p.y + 0.45)) > 0.75 + (e.h || 0.6) * 0.5) continue;
    if (d > 0.45 && (dx * fx + dz * fz) / d < 0.25) continue;
    struck = true;
    if (e.enemy) damageEnemy(w, e, dmg, wpn, p);
    else if (e.kind === 'piggy') hurtPiggy(w, e, 1, 'player');
    else hitProp(w, e);
  }
  // the ground in front: feet row and head row
  const n = pick ? T.PICKAXE_DIG : 1;
  const tx = p.x + fx * (p.hw + 0.5), tz = p.z + fz * (p.hw + 0.5);
  const cells = [[Math.floor(tx), Math.floor(tz)]];
  if (Math.abs(fx) > Math.abs(fz)) cells.push([Math.floor(tx), Math.floor(p.z)]); else cells.push([Math.floor(p.x), Math.floor(tz)]);
  for (const row of [Math.floor(p.y + 0.15), Math.floor(p.y + 1.05)]) {
    for (const [bx, bz] of cells) { if (g.get(bx, row, bz)) { hitBlock(w, bx, row, bz, n, wpn); struck = true; break; } }
  }
  for (const l of w.lanterns) if (!l.lit && Math.hypot(l.x - tx, l.z - tz) < 1.2 && Math.abs(l.y - p.y - 1) < 1.6) lightLantern(w, l);
  if (pick && struck) wearPickaxe(w);
}

function wearPickaxe(w) {
  const p = w.player;
  if (--p.ammo.pickaxe <= 0) { emit(w, 'snap', { x: p.x, y: p.y, z: p.z }); dropWeapon(w, 'pickaxe'); }
}

function hitProp(w, e) {
  if (e.kind === 'crate') breakCrate(w, e);
  else if (e.kind === 'barrel') e.boom ||= 0.08;
  else if (e.kind === 'tnt' && !(e.fuse > 0)) { e.fuse = T.TNT_FUSE; emit(w, 'fuse', { id: e.id, x: e.x, y: e.y, z: e.z }); }
}

function shotgun(w) {
  const p = w.player, g = w.grid;
  if (p.ammo.shotgun <= 0) { dropWeapon(w, 'shotgun'); return; }
  p.ammo.shotgun--; p.cd = T.SHOT_CD;
  const air = !p.ground;
  const n = T.SHOT_PELLETS + (p.upgrades.has('choke') ? T.SHOT_CHOKE_EXTRA : 0);
  const fx = Math.sin(p.face), fz = Math.cos(p.face);
  const ox = p.x + fx * 0.2, oy = p.y + (air ? 0.25 : 0.55), oz = p.z + fz * 0.2;
  const dmg = T.SHOT_DMG * power(p);
  const tracers = [];
  for (let i = 0; i < n; i++) {
    let dx, dy, dz;
    if (air) {
      const a = w.rand() * Math.PI * 2, r = Math.sqrt(w.rand()) * 0.4;
      dx = fx * 0.12 + Math.cos(a) * r; dy = -1; dz = fz * 0.12 + Math.sin(a) * r;
    } else {
      const yaw = p.face + T.SHOT_SPREAD * ((2 * i) / (n - 1) - 1) * 0.85 + (w.rand() - 0.5) * 0.08;
      dx = Math.sin(yaw); dy = (w.rand() - 0.5) * 0.12; dz = Math.cos(yaw);
    }
    const L = Math.hypot(dx, dy, dz); dx /= L; dy /= L; dz /= L;
    const bh = rayGrid(g, ox, oy, oz, dx, dy, dz, T.SHOT_RANGE);
    const tb = bh ? bh.t : T.SHOT_RANGE;
    let best = null, bt = tb;
    for (const e of w.ents) {
      if (!e.alive || e === p.carry || !(e.enemy || PROP(e) || e.kind === 'piggy')) continue;
      if (Math.abs(e.y - p.y) > T.SHOT_RANGE + 1) continue;
      const t = rayBox(ox, oy, oz, dx, dy, dz, e);
      if (t < bt) { bt = t; best = e; }
    }
    if (best) {
      if (best.enemy) damageEnemy(w, best, dmg, 'shot', { x: ox, z: oz });
      else if (best.kind === 'piggy') hurtPiggy(w, best, 1, 'player');
      else hitProp(w, best);
    } else if (bh && bh.t < T.SHOT_DIG_RANGE) hitBlock(w, bh.x, bh.y, bh.z, 1, 'shot');
    tracers.push([ox + dx * bt, oy + dy * bt, oz + dz * bt]);
  }
  emit(w, 'shotgun', { x: ox, y: oy, z: oz, air, tracers });
  w.shake = Math.max(w.shake, 0.22);
  if (air) { p.vy = Math.max(p.vy, T.SHOT_RECOIL_AIR); p.plunge = false; }
  else { p.vx -= fx * T.SHOT_RECOIL_GROUND; p.vz -= fz * T.SHOT_RECOIL_GROUND; }
  if (p.ammo.shotgun <= 0) dropWeapon(w, 'shotgun');
}

function throwBomb(w) {
  const p = w.player;
  if (p.ammo.bombs <= 0) { dropWeapon(w, 'bombs'); return; }
  p.ammo.bombs--; p.cd = T.BOMB_CD;
  const fx = Math.sin(p.face), fz = Math.cos(p.face);
  const air = !p.ground;
  const [f, u] = T.BOMB_THROW;
  addEnt(w, {
    kind: 'bomb', x: p.x + fx * 0.3, y: p.y + (air ? 0.1 : 0.7), z: p.z + fz * 0.3, hw: 0.16, h: 0.32,
    vx: air ? p.vx * 0.3 : fx * f + p.vx * 0.4, vy: air ? -4 : u, vz: air ? p.vz * 0.3 : fz * f + p.vz * 0.4, fuse: T.BOMB_FUSE, rest: false,
  });
  emit(w, 'throw', { x: p.x, y: p.y, z: p.z });
  if (p.ammo.bombs <= 0) dropWeapon(w, 'bombs');
}

export function addWeapon(w, id, amount) {
  const p = w.player;
  if (id === 'shotgun') p.ammo.shotgun = Math.min(T.SHELLS_MAX, p.ammo.shotgun + (amount ?? T.SHELLS_PICKUP));
  if (id === 'bombs') p.ammo.bombs = Math.min(T.BOMBS_MAX, p.ammo.bombs + (amount ?? T.BOMBS_PICKUP));
  if (id === 'pickaxe') p.ammo.pickaxe = Math.max(p.ammo.pickaxe, 0) + (amount ?? T.PICKAXE_USES);
  if (!p.weapons.includes(id)) p.weapons.push(id);
  p.weapon = id;
  emit(w, 'weapon', { id });
}
function dropWeapon(w, id) {
  const p = w.player;
  p.weapons = p.weapons.filter((k) => k !== id);
  if (p.weapon === id) p.weapon = p.weapons[p.weapons.length - 1] || 'shovel';
}
function cycleWeapon(w) {
  const p = w.player;
  const i = p.weapons.indexOf(p.weapon);
  p.weapon = p.weapons[(i + 1) % p.weapons.length];
  emit(w, 'cycle', { weapon: p.weapon });
}
function cycleItem(w) {
  const p = w.player;
  const order = Object.keys(ITEMS);
  const i = order.indexOf(p.itemSel);
  for (let k = 1; k <= order.length; k++) { const id = order[(i + k) % order.length]; if (p.items[id] > 0) { p.itemSel = id; break; } }
  emit(w, 'cycle', { item: p.itemSel });
}

// ---------------------------------------------------------------------------------------------- USE
function use(w) {
  const p = w.player;
  const carry = p.carry;
  if (carry) {
    if (carry.kind === 'ware' && !carry.paid) { buy(w, carry); return; }
    dropCarry(w, false); return;
  }
  // pick up the piggy, or a ware in a shop
  let best = null, bd = 1e9;
  for (const e of w.ents) {
    if (!e.alive || !CARRIABLE(e)) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < T.PIGGY_PICK_R && Math.abs(e.y - p.y) < 0.8 && d < bd) { best = e; bd = d; }
  }
  if (best) { pickUp(w, best); return; }
  useItem(w);
}

function useItem(w) {
  const p = w.player;
  let id = p.itemSel;
  if (!(p.items[id] > 0)) { const any = Object.keys(ITEMS).find((k) => p.items[k] > 0); if (!any) { emit(w, 'nope', { why: 'no item' }); return; } id = p.itemSel = any; }
  if (id === 'gin') {
    if (p.hp >= p.maxHp) { emit(w, 'nope', { why: 'full' }); return; }
    p.hp = Math.min(p.maxHp, p.hp + T.GIN_HEAL);
    emit(w, 'gin', { x: p.x, y: p.y, z: p.z });
  } else if (id === 'shard') {
    p.golden = T.GOLDEN_TIME; p.iframes = 0;
    emit(w, 'golden', { x: p.x, y: p.y, z: p.z });
  } else if (id === 'flare') {
    const fx = Math.sin(p.face), fz = Math.cos(p.face), [f, u] = T.FLARE_THROW;
    addEnt(w, { kind: 'flare', x: p.x, y: p.y + 0.8, z: p.z, hw: 0.1, h: 0.2, vx: fx * f + p.vx * 0.4, vy: u, vz: fz * f + p.vz * 0.4, life: T.FLARE_LIFE, rest: false });
    emit(w, 'flare', { x: p.x, y: p.y, z: p.z });
  }
  p.items[id]--;
  if (p.items[id] <= 0) { const next = Object.keys(ITEMS).find((k) => p.items[k] > 0); if (next) p.itemSel = next; }
}

function pickUp(w, e) {
  const p = w.player;
  p.carry = e; e.carried = true; e.rest = false;
  emit(w, 'pickupCarry', { kind: e.kind, ware: e.ware, price: e.price });
  if (e.kind === 'ware') {
    const k = shopkeeperOf(w, e.shop);
    if (k && k.state === 'calm') emit(w, 'say', { id: k.id, text: `That's ${e.price} gold.` });
  }
  if (e.kind === 'piggy') emit(w, 'say', { id: e.id, text: 'oink!', piggy: true });
}

function dropCarry(w, toss) {
  const p = w.player, e = p.carry;
  if (!e) return;
  p.carry = null; e.carried = false; e.rest = false;
  const fx = Math.sin(p.face), fz = Math.cos(p.face);
  if (toss && e.kind === 'piggy') {
    const [f, u] = T.PIGGY_THROW;
    e.vx = fx * f + p.vx * 0.5; e.vz = fz * f + p.vz * 0.5; e.vy = u; e.thrown = true;
    emit(w, 'throw', { x: p.x, y: p.y, z: p.z });
  } else {
    // set it down in front, if there's room; otherwise at your feet
    const nx = p.x + fx * 0.6, nz = p.z + fz * 0.6;
    const free = !w.grid.solidAt(nx, p.y + 0.2, nz) && !w.grid.solidAt(nx, p.y + 0.6, nz);
    e.x = free ? nx : p.x; e.z = free ? nz : p.z; e.y = p.y + 0.05;
    e.vx = e.vy = e.vz = 0;
  }
  p.cd = Math.max(p.cd, 0.2);
}

// ---------------------------------------------------------------------------------------------- shops
const shopkeeperOf = (w, shop) => w.ents.find((e) => e.alive && e.kind === 'shopkeeper' && e.shop === shop);
const inBox = (b, x, y, z) => b && x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.y0 && y < b.y1;

function buy(w, e) {
  const p = w.player;
  const k = shopkeeperOf(w, e.shop);
  const price = k ? e.price : 0; // no shopkeeper: it's free
  if (k && k.state !== 'calm') { emit(w, 'nope', { why: 'angry' }); return; }
  if (p.gold < price) { emit(w, 'nope', { why: 'gold', price }); if (k) emit(w, 'say', { id: k.id, text: 'Come back with gold.' }); return; }
  p.gold -= price;
  w.stats.bought++;
  e.paid = true;
  grantWare(w, e);
  emit(w, 'buy', { ware: e.ware, price });
  if (k) emit(w, 'say', { id: k.id, text: ['Pleasure!', 'Good choice.', 'Stay safe down there.'][Math.floor(w.rand() * 3)] });
}

function grantWare(w, e) {
  const p = w.player;
  e.alive = false; e.carried = false;
  if (p.carry === e) p.carry = null;
  switch (e.ware) {
    case 'shotgun': case 'bombs': case 'pickaxe': addWeapon(w, e.ware); break;
    case 'shells': addWeapon(w, 'shotgun', T.SHELLS_BOX); break;
    case 'gin': p.items.gin = Math.min(T.GIN_MAX + 1, p.items.gin + 1); p.itemSel = 'gin'; break;
    case 'shard': p.items.shard = Math.min(T.SHARD_MAX + 1, p.items.shard + 1); p.itemSel = 'shard'; break;
    case 'flares': p.items.flare = Math.min(T.FLARE_MAX + 2, p.items.flare + 3); p.itemSel = 'flare'; break;
    case 'heart': p.maxHp = Math.min(T.HP_CAP, p.maxHp + 1); p.hp = Math.min(p.maxHp, p.hp + 1); break;
    case 'upgrade': applyUpgrade(w, e.what); break;
  }
}

function shopChecks(w) {
  const p = w.player;
  const e = p.carry;
  // walking out of a shop with something you didn't pay for: theft
  if (e && e.kind === 'ware' && !e.paid) {
    const room = w.lv.rooms[e.shop];
    if (room && !inBox(room.box, p.x, p.y + 0.3, p.z)) {
      const k = shopkeeperOf(w, e.shop);
      w.stats.stolen++;
      grantWare(w, e);
      emit(w, 'steal', { ware: e.ware });
      if (k) angerShop(w, 'theft', k);
    }
  }
  // prompts for the HUD
  if (e) {
    if (e.kind === 'ware' && !e.paid) {
      const k = shopkeeperOf(w, e.shop);
      w.prompt = k && k.state === 'calm' ? { text: `USE: buy for ${e.price}g · walk out: steal it`, ware: e.ware, price: e.price } : { text: 'USE: take it (free)', ware: e.ware };
    } else if (e.kind === 'piggy') w.prompt = { text: 'Carry the piggy to the next depth · ATTACK: throw · USE: put down' };
    return;
  }
  for (const q of w.ents) {
    if (!q.alive || !CARRIABLE(q)) continue;
    if (Math.hypot(q.x - p.x, q.z - p.z) < T.PIGGY_PICK_R && Math.abs(q.y - p.y) < 0.8) {
      w.prompt = q.kind === 'piggy' ? { text: 'USE: pick up the piggy bank' } : { text: `USE: pick up · ${wareName(q)} ${q.price}g`, ware: q.ware, price: q.price };
      return;
    }
  }
}
export const wareName = (q) => ({ shotgun: 'Shotgun', bombs: 'Bomb bag', pickaxe: 'Pickaxe', shells: 'Shells', gin: 'Gin XXX', shard: 'Golden Shovel', flares: 'Flares ×3', heart: 'Heart', upgrade: 'Upgrade' })[q.ware] || q.ware;

function angerShop(w, why, keeper) {
  const first = !w.shopAnger;
  w.shopAnger = true;
  if (keeper && keeper.state === 'calm') {
    keeper.state = 'angry'; keeper.t = 0.6;
    emit(w, 'anger', { id: keeper.id, why, first });
    emit(w, 'say', { id: keeper.id, text: why === 'theft' ? 'THIEF!!' : 'YOU’LL PAY FOR THAT!', loud: true });
  } else if (first) emit(w, 'anger', { why, first });
}

// ---------------------------------------------------------------------------------------------- touching things
function touchEnemies(w) {
  const p = w.player;
  for (const e of w.ents) {
    if (!e.alive || !(e.enemy || e.kind === 'piggy') || e.carried) continue;
    if (Math.abs(e.y - p.y) > 3) continue;
    if (Math.abs(p.x - e.x) > p.hw + e.hw || Math.abs(p.z - e.z) > p.hw + e.hw) continue;
    if (p.y > e.y + e.h + 0.02 || p.y + p.h < e.y) continue;
    // from above, falling: a stomp
    const fromAbove = p.vy < -0.5 && p.y > e.y + e.h * 0.45;
    if (fromAbove) {
      if (e.kind === 'piggy') { hurtPiggy(w, e, 1, 'stomp'); p.vy = T.STOMP_BOUNCE * 0.8; p.y = e.y + e.h; continue; }
      if (e.kind === 'shopkeeper' && e.state === 'calm') angerShop(w, 'violence', e);
      if (e.burning && p.golden <= 0) burnPlayer(w, e, 'burning worker');
      if (p.burn > 0) ignite(w, e, 'spread');
      const k = (p.upgrades.has('steeltoe') ? T.STEELTOE : 1) * (p.plunge ? T.PLUNGE_DMG / T.STOMP_DMG * (p.weapon === 'pickaxe' ? 1.4 : 1) : 1);
      damageEnemy(w, e, T.STOMP_DMG * power(p) * k * (p.golden > 0 ? 3 : 1), 'stomp', null);
      w.stats.stomps++;
      p.plunge = false;
      p.vy = e.boss ? 13 : (w._jumpHeld ? T.STOMP_BOUNCE_HELD : T.STOMP_BOUNCE);
      p.y = Math.max(p.y, e.y + e.h);
      p.airJumps = p.upgrades.has('rocket') ? 1 : 0;
      emit(w, 'stomp', { x: e.x, y: e.y + e.h, z: e.z, kind: e.kind });
      continue;
    }
    if (e.kind === 'piggy') { if (p.burn > 0) hurtPiggy(w, e, 1, 'fire'); continue; }
    if (p.burn > 0) ignite(w, e, 'spread');
    if (p.golden > 0 && e.kind === 'worker' && !e.saved) { e.burning = false; washWorker(w, e); continue; }
    if (p.golden > 0 && !e.boss) { damageEnemy(w, e, 99, 'golden', p); continue; }
    if (e.kind === 'shopkeeper' && e.state === 'calm') continue;
    if (e.saved || e.crew && !e.hostile) continue;
    if (e.kind === 'worker') continue; // workers hurt with their grab, not by touch
    hurtPlayer(w, T.CONTACT_DMG, e, e.kind);
  }
}

function touchPickups(w) {
  const p = w.player;
  const magR = p.upgrades.has('magnet') ? T.MAGNET_BELT_R : T.MAGNET_R;
  for (const e of w.ents) {
    if (!e.alive) continue;
    if (e.kind === 'goldenShovel') {
      if (Math.hypot(e.x - p.x, e.z - p.z) < 0.9 && Math.abs(e.y - p.y) < 1.4) {
        if (e.locked) w.prompt = { text: 'The Golden Shovel is sealed. Beat the Chairman.' };
        else takeShovel(w, e);
      }
      continue;
    }
    if (!PICKUP(e)) continue;
    const dy = (e.y + 0.1) - (p.y + 0.4);
    if (Math.abs(dy) > 2.2) continue;
    const d = Math.hypot(e.x - p.x, dy, e.z - p.z);
    if (e.kind === 'gold') {
      if (e.grab > 0) continue;
      if (d < magR && d > T.PICK_R) { e.magnet = true; continue; }
    }
    if (d > T.PICK_R + 0.15) continue;
    collect(w, e);
  }
}

function collect(w, e) {
  const p = w.player;
  switch (e.kind) {
    case 'gold':
      p.gold += e.value; w.stats.gold += e.value;
      emit(w, 'gold', { x: e.x, y: e.y, z: e.z, value: e.value });
      break;
    case 'item': {
      const max = e.what === 'gin' ? T.GIN_MAX : e.what === 'shard' ? T.SHARD_MAX : T.FLARE_MAX;
      if (p.items[e.what] >= max) { w.prompt = { text: `${ITEMS[e.what].name}: your bag is full` }; return; }
      p.items[e.what]++;
      if (!(p.items[p.itemSel] > 0) || e.what !== 'gin') p.itemSel = e.what;
      emit(w, 'item', { id: e.what, x: e.x, y: e.y, z: e.z });
      break;
    }
    case 'weapon': addWeapon(w, e.what); break;
    case 'ammo':
      if (e.what === 'shells') addWeapon(w, 'shotgun', T.SHELLS_BOX);
      else if (e.what === 'bombs') addWeapon(w, 'bombs', 3);
      else if (e.what === 'flare') { p.items.flare = Math.min(T.FLARE_MAX, p.items.flare + 2); p.itemSel = 'flare'; emit(w, 'item', { id: 'flare' }); }
      break;
    case 'upgrade':
      applyUpgrade(w, e.what);
      for (const q of w.ents) if (q.alive && q !== e && q.kind === 'upgrade' && q.group && q.group === e.group) { q.alive = false; emit(w, 'vanish', { x: q.x, y: q.y, z: q.z }); }
      break;
  }
  e.alive = false;
}

export function applyUpgrade(w, id) {
  const p = w.player;
  p.upgrades.add(id);
  if (id === 'overalls') { p.maxHp = Math.min(T.HP_CAP, p.maxHp + 1); p.hp = Math.min(p.maxHp, p.hp + 1); }
  if (id === 'rocket') p.airJumps = 1;
  emit(w, 'upgrade', { id });
}

function takeShovel(w, e) {
  e.alive = false;
  w.reveal = 0.001;
  const p = w.player;
  p.golden = 99; // the real thing
  emit(w, 'reveal', { x: e.x, y: e.y, z: e.z });
  for (const q of w.ents) if (q.alive && q.kind === 'worker') { q.saved = true; q.state = 'saved'; q.sayT = 0.4 + w.rand() * 1.2; emit(w, 'washed', { id: q.id }); }
}

// Golden Shovel status: touching an oil-drowned employee washes the crude off them. Helping, not
// fighting, and they tip their boss for it.
function washWorker(w, e) {
  e.saved = true; e.state = 'saved'; e.sayT = 0.2;
  w.stats.saved = (w.stats.saved || 0) + 1;
  for (let i = 0; i < 4; i++) spawnGold(w, e.x, e.y + 0.8, e.z, 2 + w.depthIdx, { burst: 2.5, bill: i === 0 });
  emit(w, 'washed', { id: e.id, x: e.x, y: e.y, z: e.z, name: e.name });
}

function lanternsNear(w) {
  const p = w.player;
  for (const l of w.lanterns) {
    if (l.lit || Math.abs(l.y - p.y - 1) > 2) continue;
    if (Math.hypot(l.x - p.x, l.z - p.z) < T.LANTERN_LIGHT_R + 0.3) lightLantern(w, l);
  }
}
function lightLantern(w, l) { l.lit = true; emit(w, 'lantern', { id: l.id, x: l.x, y: l.y, z: l.z }); }

// ---------------------------------------------------------------------------------------------- the piggy bank
function hurtPiggy(w, e, dmg, cause) {
  if (!e.alive || e.hurtT > 0) return;
  e.hp -= dmg; e.hurtT = 0.45;
  emit(w, 'piggyHit', { id: e.id, x: e.x, y: e.y, z: e.z, hp: e.hp, cause });
  if (e.hp <= 0) {
    e.alive = false;
    if (w.player.carry === e) w.player.carry = null;
    w.piggies[e.depth] = 'broken';
    for (let i = 0; i < T.PIGGY_BREAK_GOLD; i++) spawnGold(w, e.x, e.y + 0.3, e.z, 1, { burst: 3 });
    emit(w, 'piggyBreak', { x: e.x, y: e.y, z: e.z, depth: e.depth, cause });
    if (cause === 'player' || cause === 'stomp' || cause === 'boom' || cause === 'fall') emit(w, 'say', { text: 'oops…', player: true });
  } else emit(w, 'say', { id: e.id, text: ['OINK!', 'eek!', 'careful!!', 'oink…'][Math.floor(w.rand() * 4)], piggy: true });
}

function checkPiggySaved(w, e) {
  const st = storyOf(w, e.y);
  if (st.depth > e.depth && e.alive) {
    e.alive = false;
    if (w.player.carry === e) w.player.carry = null;
    w.piggies[e.depth] = 'saved';
    const p = w.player;
    const gold = T.PIGGY_SAVE_GOLD[0] + T.PIGGY_SAVE_GOLD[1] * e.depth;
    p.gold += gold; w.stats.gold += gold;
    p.hp = Math.min(p.maxHp, p.hp + T.PIGGY_SAVE_HEAL);
    emit(w, 'piggySaved', { x: e.x, y: e.y, z: e.z, gold, depth: e.depth });
  }
}

// ---------------------------------------------------------------------------------------------- things
function stepThing(w, e, dt) {
  const g = w.grid, p = w.player;
  if (e.kind === 'hz' || e.kind === 'puddle') { if (e.life !== undefined && (e.life -= dt) <= 0) e.alive = false; return; }
  if (e.carried) return;
  if (e.kind === 'fire') {
    e.life -= dt; e.tick = (e.tick || 0) - dt;
    if (e.life <= 0) { e.alive = false; return; }
    if (e.tick <= 0) {
      e.tick = T.FIRE_TICK;
      if (Math.hypot(p.x - e.x, p.z - e.z) < e.r + p.hw && p.y < e.y + 1 && p.y > e.y - 0.5) burnPlayer(w, e, 'fire');
      for (const q of w.ents) {
        if (!q.alive || Math.abs(q.y - e.y) > 1 || Math.hypot(q.x - e.x, q.z - e.z) > e.r + 0.4) continue;
        if (q.enemy) { ignite(w, q, 'fire'); if (!q.burning) damageEnemy(w, q, 1.2, 'fire', e); }
        else if (q.kind === 'barrel') q.boom ||= 0.3;
        else if (q.kind === 'tnt' && !(q.fuse > 0)) q.fuse = T.TNT_FUSE * 0.6;
        else if (q.kind === 'piggy') hurtPiggy(w, q, 1, 'fire');
      }
    }
    return;
  }
  if (e.kind === 'flare') {
    e.life -= dt;
    if (e.life <= 0) { e.alive = false; return; }
  }
  if (e.kind === 'fireball') { stepFireball(w, e, dt); return; }
  // timers
  if (e.kind === 'barrel' && e.boom > 0) { e.boom -= dt; if (e.boom <= 0) { blowBarrel(w, e); return; } }
  if (e.kind === 'tnt' && e.fuse > 0) { e.fuse -= dt; if (e.fuse <= 0) { e.alive = false; explode(w, e.x, e.y + 0.4, e.z, T.TNT_R, T.TNT_DMG, 'tnt'); checkShopViolence(w, e); return; } }
  if (e.kind === 'bomb') { e.fuse -= dt; if (e.fuse <= 0) { e.alive = false; explode(w, e.x, e.y + 0.2, e.z, T.BOMB_R, T.BOMB_DMG * power(p), 'bomb'); checkShopViolence(w, e); return; } }
  if (e.kind === 'piggy') {
    e.hurtT = Math.max(0, e.hurtT - dt);
    if ((e.sayT -= dt) <= 0) {
      e.sayT = 5 + w.rand() * 6;
      if (Math.hypot(p.x - e.x, p.z - e.z) < 9 && Math.abs(p.y - e.y) < 4) emit(w, 'say', { id: e.id, text: ['oink? help!', 'save me!', 'over here!', 'oink oink!', 'take me down!'][Math.floor(w.rand() * 5)], piggy: true });
    }
    if (storyOf(w, e.y).depth > e.depth) { checkPiggySaved(w, e); return; }
  }
  if (e.kind === 'gold') {
    if (e.grab > 0) e.grab -= dt;
    if (e.life !== Infinity && (e.life -= dt) <= 0) { e.alive = false; return; }
    if (e.magnet) {
      const dx = p.x - e.x, dy = p.y + 0.45 - e.y, dz = p.z - e.z, d = Math.hypot(dx, dy, dz) || 1;
      const s = Math.min(d / dt, 9);
      e.x += (dx / d) * s * dt; e.y += (dy / d) * s * dt; e.z += (dz / d) * s * dt;
      if (d < T.PICK_R) collect(w, e);
      return;
    }
  }
  if (e.rest || e.float) return;
  // physics: fall, bounce, settle
  e.vy = Math.max(e.vy - T.GRAVITY * dt, -T.MAX_FALL);
  const vyBefore = e.vy;
  const hit = moveBody(g, e, e.vx * dt, e.vy * dt, e.vz * dt);
  if (hit & 1) e.vx *= -0.4;
  if (hit & 8) e.vz *= -0.4;
  if (hit & 4) e.vy = 0;
  if (hit & 2) {
    if (e.kind === 'piggy' && -vyBefore > T.PIGGY_FALL_HURT) hurtPiggy(w, e, 1, 'fall');
    const bouncy = e.kind === 'bomb' || e.kind === 'gold' || e.kind === 'flare';
    if (bouncy && -vyBefore > 2.5) { e.vy = -vyBefore * (e.kind === 'bomb' ? 0.35 : 0.3); e.vx *= 0.6; e.vz *= 0.6; }
    else {
      e.vy = 0; e.vx *= 0.5; e.vz *= 0.5;
      if (Math.hypot(e.vx, e.vz) < 0.2) { e.vx = e.vz = 0; e.rest = true; e.thrown = false; }
    }
    if (e.kind === 'barrel' && -vyBefore > 14) e.boom ||= 0.05; // a long drop sets a barrel off
  }
}

function blowBarrel(w, e) {
  e.alive = false;
  explode(w, e.x, e.y + 0.4, e.z, T.BARREL_R, T.BARREL_DMG, 'barrel');
  addEnt(w, { kind: 'fire', x: e.x, y: e.y, z: e.z, r: 1.1, life: T.FIRE_LIFE, fx: true, tick: 0.2 });
  checkShopViolence(w, e);
}

// an explosion inside a shop is violence
function checkShopViolence(w, e) {
  for (const room of w.lv.rooms) {
    if (room.kind !== 'shop' || !inBox(room.box, e.x, e.y + 0.3, e.z)) continue;
    const k = shopkeeperOf(w, w.lv.rooms.indexOf(room));
    if (k) angerShop(w, 'violence', k);
  }
}

export function stepFireball(w, e, dt) {
  e.life -= dt;
  e.vy = Math.max(e.vy - T.GRAVITY * 0.55 * dt, -T.MAX_FALL);
  const hit = moveBody(w.grid, e, e.vx * dt, e.vy * dt, e.vz * dt);
  const p = w.player;
  let done = hit !== 0 || e.life <= 0;
  if (!done && Math.hypot(p.x - e.x, p.z - e.z) < p.hw + 0.25 && e.y > p.y - 0.2 && e.y < p.y + p.h + 0.1) { burnPlayer(w, e, e.src || 'fireball'); done = true; }
  if (!done) for (const q of w.ents) if (q.alive && q.kind === 'worker' && !q.burning && Math.hypot(q.x - e.x, q.z - e.z) < q.hw + 0.2 && e.y > q.y && e.y < q.y + q.h) { ignite(w, q, 'fireball'); done = true; break; }
  if (!done) for (const q of w.ents) {
    if (q.alive && q.kind === 'piggy' && !q.carried && Math.hypot(q.x - e.x, q.z - e.z) < q.hw + 0.25 && Math.abs(q.y + 0.25 - e.y) < 0.5) { hurtPiggy(w, q, 1, 'fireball'); done = true; break; }
  }
  if (done) { e.alive = false; emit(w, 'fizzle', { x: e.x, y: e.y, z: e.z, fire: true }); }
}

// light sources the renderer pools: lit lanterns, flares, fires, embers, fireballs, vents (and the collars glow on their own)
export function lightsNear(w, x, y, z, out) {
  out.length = 0;
  for (const l of w.lanterns) if (l.lit && Math.abs(l.y - y) < 12) out.push({ x: l.x, y: l.y, z: l.z, k: l.brazier ? 'brazier' : 'lantern', id: 'l' + l.id });
  for (const e of w.ents) {
    if (!e.alive || Math.abs(e.y - y) > 12) continue;
    if (e.kind === 'flare' || e.kind === 'fire' || e.kind === 'fireball' || e.kind === 'ember') out.push({ x: e.x, y: e.y + 0.3, z: e.z, k: e.kind, id: e.id });
    else if (e.burning) out.push({ x: e.x, y: e.y + 0.8, z: e.z, k: 'fire', id: e.id });
  }
  for (const h of w.hazards) if (h.alive && (h.kind === 'vent' && (h.blast > 0 || h.warn > 0.3) || h.kind === 'vat') && Math.abs(h.y - y) < 12) out.push({ x: h.x, y: h.y + 0.9, z: h.z, k: h.kind, id: 'h' + h.id, warn: h.warn, blast: h.blast });
  return out;
}

export { storyOf };
