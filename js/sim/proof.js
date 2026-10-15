// The finishability proof: a BFS over the places the digger can stand, using only moves the
// real physics allows without digging (walk, step-jump up to 2 cells, jump a 1–2 cell gap,
// fall any distance). It must reach the Golden Shovel from the spawn.
//
// It also looks for traps: places you can reach but can't leave toward the bottom without
// digging, where there is nothing breakable to dig. Dirt is always diggable, so those can only
// be built from bedrock, collar steel or stone; any found is a generator bug.

import { T } from './tuning.js';
import { breakable } from './grid.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function prove(lv, { jumpUp = 2, gap = 2 } = {}) {
  const g = lv.grid;
  const air = (x, y, z) => !g.solid(x, y, z);
  const stand = (x, y, z) => air(x, y, z) && g.solid(x, y - 1, z);
  const key = (x, y, z) => x + g.nx * (z + g.nz * y);
  const drop = (x, y, z) => { // fall from (x, y, z) until something solid: the standing cell, or null
    for (let yy = y; yy >= 1; yy--) if (g.solid(x, yy - 1, z)) return air(x, yy, z) ? yy : null;
    return null;
  };
  const sx = Math.floor(lv.spawn.x), sz = Math.floor(lv.spawn.z);
  const sy = drop(sx, Math.floor(lv.spawn.y + 0.01), sz);
  const seen = new Map(); // key → [x, y, z]
  const edges = new Map(); // key → keys reachable in one move
  const q = [];
  const push = (from, x, y, z) => {
    const k = key(x, y, z);
    if (from !== null) { let e = edges.get(from); if (!e) edges.set(from, e = []); e.push(k); }
    if (!seen.has(k)) { seen.set(k, [x, y, z]); q.push(k); }
  };
  if (sy == null) return { ok: false, why: 'spawn in rock' };
  push(null, sx, sy, sz);
  while (q.length) {
    const k = q.shift();
    const [x, y, z] = seen.get(k);
    let head = 0; // free cells above the standing cell (jump head room)
    for (let h = 1; h <= jumpUp + 1 && air(x, y + h, z); h++) head = h;
    for (const [dx, dz] of DIRS) {
      // walk / step off
      const nx = x + dx, nz = z + dz;
      if (air(nx, y, nz)) { const fy = drop(nx, y, nz); if (fy != null) push(k, nx, fy, nz); }
      // jump up onto something 1–2 high
      for (let up = 1; up <= jumpUp; up++) {
        if (head < up + 0) break;
        if (stand(nx, y + up, nz) && air(x, y + up, z)) { push(k, nx, y + up, nz); break; }
        if (!g.solid(nx, y + up - 1, nz)) break; // nothing to land on at this height
      }
      // jump a gap: the cells in between must be open at foot and head height
      for (let d = 2; d <= gap + 1; d++) {
        let clear = head >= 1;
        for (let i = 1; i < d && clear; i++) if (!air(x + dx * i, y, z + dz * i) || !air(x + dx * i, y + 1, z + dz * i)) clear = false;
        if (!clear) break;
        const tx = x + dx * d, tz = z + dz * d;
        if (air(tx, y, tz) && air(tx, y + 1, tz)) { const fy = drop(tx, y, tz); if (fy != null && fy >= y - 12) push(k, tx, fy, tz); }
        else if (stand(tx, y + 1, tz) && air(tx, y + 2, tz) && d === 2 && head >= 2) push(k, tx, y + 1, tz);
      }
    }
  }
  // the goal: standing on the shrine floor (the plinth is a step up from it)
  const shr = lv.shrine;
  const goal = [];
  for (const [k, [, y]] of seen) if (y >= shr.floorTop && y <= shr.floorTop + 1) goal.push(k);
  if (!goal.length) return { ok: false, why: 'the Bottom is unreachable', reached: seen.size, deepest: deepest(seen) };
  // traps: reachable cells from which you can neither walk to the goal nor walk to somewhere
  // you could dig (dirt under you or beside you)
  const rev = new Map();
  for (const [a, list] of edges) for (const b of list) { let e = rev.get(b); if (!e) rev.set(b, e = []); e.push(a); }
  const reverse = (seeds) => {
    const set = new Set(seeds), rq = seeds.slice();
    while (rq.length) { const k = rq.pop(); for (const a of rev.get(k) || []) if (!set.has(a)) { set.add(a); rq.push(a); } }
    return set;
  };
  const good = reverse(goal);
  const canDig = [];
  for (const [k, [x, y, z]] of seen) {
    let dig = breakable(g.get(x, y - 1, z));
    for (const [dx, dz] of DIRS) if (breakable(g.get(x + dx, y, z + dz)) || breakable(g.get(x + dx, y + 1, z + dz))) dig = true;
    if (dig) canDig.push(k);
  }
  // every depth's piggy bank stands somewhere you can walk to
  for (const e of lv.spawns) {
    if (e.type !== 'piggy') continue;
    if (!seen.has(key(Math.floor(e.x), Math.floor(e.y + 0.01), Math.floor(e.z)))) return { ok: false, why: `piggy of depth ${e.depth + 1} unreachable`, reached: seen.size };
  }
  const escapable = reverse(goal.concat(canDig));
  const traps = [];
  for (const [k, c] of seen) if (!escapable.has(k)) traps.push(c);
  return { ok: traps.length === 0, why: traps.length ? `${traps.length} trap cells, e.g. ${traps[0]}` : '', reached: seen.size, good: good.size, traps };
}

function deepest(seen) { let m = 1e9; for (const [, [, y]] of seen) m = Math.min(m, y); return m; }

export const STORY_H = T.STORY_H;
