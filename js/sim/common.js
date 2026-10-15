// Shared rules: events, blocks, damage, death, gold, explosions. Pure.
import { T } from './tuning.js';
import { B, HP, breakable } from './grid.js';

export const emit = (w, type, data) => { w.events.push({ type, ...data }); };

export const power = (p) => Math.min(T.POWER_CAP, 1 + p.gold * T.POWER_PER_GOLD * (p.upgrades.has('teeth') ? 1.5 : 1));

export function storyAt(w, y) {
  const st = w.lv.stories;
  for (let i = 0; i < st.length; i++) if (y >= st[i].y0 && y < st[i].top) return i;
  return y >= st[0].top ? 0 : st.length - 1;
}

export function markDirty(w, x, y, z) {
  const i = storyAt(w, y);
  w.dirty.add(i);
  // a change on a story's edge row also changes the faces of the neighbour's mesh
  const s = w.lv.stories[i];
  if (y === s.y0 && i + 1 < w.lv.stories.length) w.dirty.add(i + 1);
  if (y === s.top - 1 && i > 0) w.dirty.add(i - 1);
}

export function setBlock(w, x, y, z, b) {
  w.grid.set(x, y, z, b);
  markDirty(w, x, y, z);
}

// One hit on a block. Returns 'broke' | 'cracked' | 'clank' | null (air).
export function hitBlock(w, x, y, z, n = 1, src = 'pick') {
  const g = w.grid;
  const b = g.get(x, y, z);
  if (b === B.AIR) return null;
  if (!breakable(b)) { emit(w, 'clank', { x: x + 0.5, y: y + 0.5, z: z + 0.5, src }); return 'clank'; }
  const i = g.idx(x, y, z);
  const d = (g.dmg.get(i) || 0) + n;
  if (d < HP[b]) { g.dmg.set(i, d); emit(w, 'crack', { x: x + 0.5, y: y + 0.5, z: z + 0.5, b }); markDirty(w, x, y, z); return 'cracked'; }
  breakBlock(w, x, y, z, src);
  return 'broke';
}

export function breakBlock(w, x, y, z, src = 'pick') {
  const g = w.grid;
  const b = g.get(x, y, z);
  if (!breakable(b)) return false;
  g.dmg.delete(g.idx(x, y, z));
  setBlock(w, x, y, z, B.AIR);
  w.stats.dug++;
  emit(w, 'dig', { x: x + 0.5, y: y + 0.5, z: z + 0.5, b, src });
  if (b === B.GOLD) for (let i = 0; i < 3; i++) spawnGold(w, x + 0.5, y + 0.3, z + 0.5, 2 + w.depthIdx, { burst: 3 });
  if (b === B.PLANK) emit(w, 'planks', { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
  // anything resting on the block wakes up and falls
  for (const e of w.ents) if (e.rest && Math.abs(e.y - (y + 1)) < 0.05 && Math.abs(e.x - (x + 0.5)) < 1 && Math.abs(e.z - (z + 0.5)) < 1) e.rest = false;
  return true;
}

let ID = 1;
export function addEnt(w, e) {
  e.id = ID++;
  e.alive = true;
  e.vx ??= 0; e.vy ??= 0; e.vz ??= 0;
  w.ents.push(e);
  return e;
}

// Money: coins, and dollar bills for the bigger amounts (bills flutter down slowly).
// (The entity kind stays 'gold' in the rules; it is drawn as coins and bills.)
export function spawnGold(w, x, y, z, value, { burst = 0, spill = false, bill = null } = {}) {
  const a = w.rand() * Math.PI * 2, s = burst * (0.5 + w.rand() * 0.6);
  return addEnt(w, {
    kind: 'gold', x, y, z, hw: 0.14, h: 0.25, value, bill: bill ?? value >= 5,
    vx: Math.cos(a) * s, vy: burst ? 4 + w.rand() * 3 : 0, vz: Math.sin(a) * s,
    life: spill ? T.SPILL_LIFE : Infinity, grab: spill ? T.SPILL_GRAB_DELAY : 0, rest: !burst, spin: w.rand() * 6,
  });
}

export function hurtPlayer(w, dmg, from, cause) {
  const p = w.player;
  if (w.state !== 'play' || p.golden > 0 || p.iframes > 0 || dmg <= 0) return false;
  p.hp = Math.max(0, p.hp - dmg);
  p.iframes = T.HURT_IFRAMES;
  p.plunge = false;
  if (from) {
    let dx = p.x - from.x, dz = p.z - from.z; const d = Math.hypot(dx, dz) || 1;
    dx /= d; dz /= d;
    p.vx = dx * T.HURT_KNOCK; p.vz = dz * T.HURT_KNOCK; p.vy = Math.max(p.vy, 6);
  }
  // gold spills out like rings
  const lose = Math.min(p.gold, Math.max(T.SPILL_MIN, Math.round(p.gold * T.SPILL_FRAC)));
  if (lose > 0) {
    p.gold -= lose;
    const n = Math.min(T.SPILL_MAX_NUGGETS, lose);
    for (let i = 0; i < n; i++) spawnGold(w, p.x, p.y + 0.5, p.z, Math.floor(lose / n) + (i < lose % n ? 1 : 0), { burst: 4.5, spill: true });
  }
  w.stats.hits++;
  emit(w, 'hurt', { x: p.x, y: p.y, z: p.z, dmg, cause, lost: lose });
  if (p.hp <= 0) { w.state = 'dead'; w.endT = 0; w.cause = cause; emit(w, 'die', { x: p.x, y: p.y, z: p.z, cause }); }
  return true;
}

// Fire catches on oil: a worker hit by fire lights up (dr-mow's propane, but people-shaped).
export function ignite(w, e, src) {
  if (!e.alive || e.saved || e.burning) return false;
  if (e.kind === 'worker' && !e.crew) {
    e.burning = true; e.state = 'chase';
    emit(w, 'ignite', { id: e.id, x: e.x, y: e.y, z: e.z, src });
    emit(w, 'say', { id: e.id, text: ['HOT HOT HOT!', 'AAAAH!', 'it burns, boss!', 'I’M ON FIRE!'][Math.floor(w.rand() * 4)], loud: true });
    return true;
  }
  return false;
}
export function burnPlayer(w, from, cause = 'fire') {
  const p = w.player;
  if (p.golden > 0 || w.state !== 'play') return;
  if (!(p.burn > 0)) emit(w, 'onFire', {});
  p.burn = T.PLAYER_BURN;
  hurtPlayer(w, 1, from, cause);
}

export function damageEnemy(w, e, dmg, src, from) {
  if (!e.alive || e.saved) return false;
  if (e.boss) {
    const d = w.bossDamage(w, e, dmg);
    if (!d) return false;
    e.hurtT = 0.18;
    emit(w, 'hit', { x: e.x, y: e.y + e.h * 0.6, z: e.z, kind: e.kind, src, id: e.id, boss: true });
    return true;
  }
  if (e.kind === 'shopkeeper') w.angerShop('violence', e);
  e.hp -= dmg;
  e.hurtT = 0.22;
  if (from) {
    let dx = e.x - from.x, dz = e.z - from.z; const d = Math.hypot(dx, dz) || 1;
    const k = e.kind === 'worker' || e.kind === 'shopkeeper' ? 3.2 : 4.5;
    e.vx = (dx / d) * k; e.vz = (dz / d) * k;
    if (e.kind !== 'fly') e.vy = Math.max(e.vy, 2.5);
  }
  if (e.state === 'windup' && e.kind === 'worker') { e.state = 'recover'; e.t = 0.5; } // a hit interrupts the grab
  emit(w, 'hit', { x: e.x, y: e.y + e.h * 0.5, z: e.z, kind: e.kind, src, id: e.id });
  if (e.hp <= 0) killEnemy(w, e, src);
  return true;
}

export function killEnemy(w, e, src) {
  e.alive = false;
  const def = T[e.kind.toUpperCase()];
  const [a, b] = def.gold;
  const n = a + Math.floor(w.rand() * (b - a + 1));
  for (let i = 0; i < n; i++) spawnGold(w, e.x, e.y + e.h * 0.5, e.z, 1 + w.depthIdx, { burst: 2.5, bill: i === 0 && e.kind === 'worker' });
  if (e.kind === 'shopkeeper') addEnt(w, { kind: 'weapon', what: 'shotgun', x: e.x, y: e.y + 0.3, z: e.z, hw: 0.22, h: 0.45, vy: 4, rest: false });
  w.stats.kills++;
  const p = w.player;
  const air = !p.ground;
  if (air) { p.combo++; w.stats.bestCombo = Math.max(w.stats.bestCombo, p.combo); }
  // workers aren't killed: they're knocked out cold (stars, a dropped hard hat) and lie there
  const ko = e.kind === 'worker' || e.kind === 'shopkeeper';
  emit(w, 'kill', { x: e.x, y: e.y, z: e.z, kind: e.kind, src, id: e.id, combo: air ? p.combo : 0, ko, face: e.face, name: e.name });
  w.hitstop = Math.max(w.hitstop, ko ? 0.07 : 0.04);
  if (ko) addEnt(w, { kind: 'knocked', who: e.kind, name: e.name, x: e.x, y: e.y, z: e.z, face: e.face, life: 9, fx: true, oil: e.oil, look: e.look, burnt: !!e.burning });
  if (e.burning) { // a lit worker goes up in a burst that catches the next one
    addEnt(w, { kind: 'fire', x: e.x, y: e.y, z: e.z, r: T.BURNING.burstR, life: T.BURNING.burstLife, fx: true, tick: 0 });
    emit(w, 'burst', { x: e.x, y: e.y + 0.5, z: e.z });
  }
}

// Explosions: blocks, everyone, chains. src: 'bomb' | 'tnt' | 'barrel'.
export function explode(w, x, y, z, r, dmg, src) {
  const g = w.grid;
  emit(w, 'boom', { x, y, z, r, src });
  w.shake = Math.max(w.shake, src === 'tnt' ? 0.9 : 0.6);
  const rr = r * r;
  for (let yy = Math.floor(y - r); yy <= Math.floor(y + r); yy++) for (let zz = Math.floor(z - r); zz <= Math.floor(z + r); zz++) for (let xx = Math.floor(x - r); xx <= Math.floor(x + r); xx++) {
    const dx = xx + 0.5 - x, dy = yy + 0.5 - y, dz = zz + 0.5 - z;
    if (dx * dx + dy * dy + dz * dz <= rr && breakable(g.get(xx, yy, zz))) breakBlock(w, xx, yy, zz, 'boom');
  }
  for (const e of w.ents) {
    if (!e.alive || e.fx) continue;
    const d = Math.hypot(e.x - x, (e.y + (e.h || 0.5) * 0.5) - y, e.z - z);
    if (d > r + 0.6) continue;
    const k = d < r * 0.6 ? 1 : 0.5;
    if (e.enemy) { ignite(w, e, 'boom'); damageEnemy(w, e, dmg * k, 'boom', { x, z }); }
    else if (e.kind === 'piggy' && !e.carried) w.hurtPiggy(e, 2, 'boom');
    else if (e.kind === 'barrel' && !e.boom) { e.boom = T.BARREL_CHAIN * (0.7 + w.rand() * 0.6); }
    else if (e.kind === 'tnt' && !(e.fuse > 0)) { e.fuse = 0.35 + w.rand() * 0.25; emit(w, 'fuse', { id: e.id }); }
    else if (e.kind === 'crate') breakCrate(w, e);
    else if (e.kind === 'gold' || e.kind === 'bomb') {
      const ax = e.x - x, az = e.z - z, n = Math.hypot(ax, az) || 1;
      e.vx += (ax / n) * 5; e.vz += (az / n) * 5; e.vy += 5; e.rest = false;
    }
  }
  const p = w.player;
  const dp = Math.hypot(p.x - x, p.y + 0.45 - y, p.z - z);
  if (dp < r + 0.35) {
    const own = src === 'bomb' && p.upgrades.has('gloves');
    if (!own) hurtPlayer(w, src === 'bomb' ? T.BOMB_SELF : T.BLAST_PLAYER, { x, z }, src);
    if (p.golden > 0 || own) { const n = dp || 1; p.vx += ((p.x - x) / n) * 4; p.vz += ((p.z - z) / n) * 4; }
  }
}

export function breakCrate(w, e) {
  if (!e.alive) return;
  e.alive = false;
  emit(w, 'crate', { x: e.x, y: e.y + 0.4, z: e.z });
  const loot = e.loot || 'gold';
  if (loot === 'gold') { const n = 3 + Math.floor(w.rand() * 4); for (let i = 0; i < n; i++) spawnGold(w, e.x, e.y + 0.4, e.z, 1 + w.depthIdx, { burst: 2.5 }); }
  else if (loot === 'gin' || loot === 'shard') addEnt(w, { kind: 'item', what: loot, x: e.x, y: e.y + 0.1, z: e.z, hw: 0.2, h: 0.4, vy: 4, rest: false });
  else addEnt(w, { kind: 'ammo', what: loot, x: e.x, y: e.y + 0.1, z: e.z, hw: 0.2, h: 0.4, vy: 4, rest: false });
}

// Slab test: ray (o, d) against an entity's box. Returns t or Infinity.
export function rayBox(ox, oy, oz, dx, dy, dz, e) {
  const hw = e.hw || 0.3, h = e.h || 0.6;
  let t0 = 0, t1 = Infinity;
  for (const [o, d, lo, hi] of [[ox, dx, e.x - hw, e.x + hw], [oy, dy, e.y, e.y + h], [oz, dz, e.z - hw, e.z + hw]]) {
    if (Math.abs(d) < 1e-9) { if (o < lo || o > hi) return Infinity; continue; }
    let a = (lo - o) / d, b = (hi - o) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return Infinity;
  }
  return t0;
}

export const overlap = (a, b) => Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.z - b.z) < a.hw + b.hw && a.y < b.y + b.h && b.y < a.y + a.h;
