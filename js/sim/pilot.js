// The pilot: plans a path with the moves proof.js allows (walk, step-jump up to 2, jump a gap,
// fall) and steers the real controls along it, one step at a time. tools/autopilot.mjs uses it to
// prove layouts with the actual physics; the title screen uses it as the attract mode.
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function plan(w, from, goalFn) {
  const g = w.grid;
  const air = (x, y, z) => !g.solid(x, y, z);
  const stand = (x, y, z) => air(x, y, z) && g.solid(x, y - 1, z);
  const drop = (x, y, z) => { for (let yy = y; yy >= 1; yy--) if (g.solid(x, yy - 1, z)) return air(x, yy, z) ? yy : null; return null; };
  const key = (x, y, z) => x + g.nx * (z + g.nz * y);
  const prev = new Map(), node = new Map();
  const s = [from.x, from.y, from.z], sk = key(...s);
  prev.set(sk, null); node.set(sk, s);
  const q = [sk];
  const goalY = w.lv.shrine.floorTop;
  const isGoal = goalFn || ((x, y) => y <= goalY + 1 && y >= goalY);
  let goal = null, n = 0;
  while (q.length && n++ < 60000) {
    const k = q.shift();
    const [x, y, z] = node.get(k);
    if (isGoal(x, y, z)) { goal = k; break; }
    let head = 0; for (let h = 1; h <= 3 && air(x, y + h, z); h++) head = h;
    const push = (nx, ny, nz, how) => { const nk = key(nx, ny, nz); if (!prev.has(nk)) { prev.set(nk, [k, how]); node.set(nk, [nx, ny, nz]); q.push(nk); } };
    for (const [dx, dz] of DIRS) {
      const nx = x + dx, nz = z + dz;
      if (air(nx, y, nz)) { const fy = drop(nx, y, nz); if (fy != null) push(nx, fy, nz, fy === y ? 'walk' : 'fall'); }
      for (let up = 1; up <= 2; up++) {
        if (head < up) break;
        if (stand(nx, y + up, nz) && air(x, y + up, z)) { push(nx, y + up, nz, 'up'); break; }
        if (!g.solid(nx, y + up - 1, nz)) break;
      }
      for (let d = 2; d <= 3; d++) {
        let clear = head >= 1;
        for (let i = 1; i < d && clear; i++) if (!air(x + dx * i, y, z + dz * i) || !air(x + dx * i, y + 1, z + dz * i)) clear = false;
        if (!clear) break;
        const tx = x + dx * d, tz = z + dz * d;
        if (air(tx, y, tz) && air(tx, y + 1, tz)) { const fy = drop(tx, y, tz); if (fy != null && fy >= y - 12) push(tx, fy, tz, 'gap'); }
        else if (stand(tx, y + 1, tz) && air(tx, y + 2, tz) && d === 2 && head >= 2) push(tx, y + 1, tz, 'gapup');
      }
    }
  }
  if (goal == null) return null;
  const path = [];
  for (let k = goal; k != null; k = prev.get(k)?.[0]) path.unshift({ c: node.get(k), how: prev.get(k)?.[1] });
  return path;
}

export class Pilot {
  constructor(w, { attack = false } = {}) { this.w = w; this.path = null; this.i = 0; this.t = 0; this.lastProg = 0; this.replans = 0; this.attack = attack; }
  cell() { const p = this.w.player; return { x: Math.floor(p.x), y: Math.floor(p.y + 0.02), z: Math.floor(p.z) }; }
  // the control for one sim step
  control(dt) {
    const w = this.w, p = w.player;
    const ctl = { mx: 0, mz: 0, jump: false, jumpP: false, attackP: false, useP: false, cycleW: false, cycleI: false };
    this.t += dt;
    if (!this.path) {
      if (!p.ground) return ctl;
      this.path = plan(w, this.cell()); this.i = 1; this.replans++; this.lastProg = this.t;
      if (!this.path) return ctl;
    }
    const tgt = this.path[Math.min(this.i, this.path.length - 1)];
    const [tx, ty, tz] = tgt.c;
    const c = this.cell();
    if (c.x === tx && c.z === tz && c.y === ty && p.ground) {
      this.i++; this.lastProg = this.t;
      if (this.i >= this.path.length) { this.path = null; return ctl; }
    }
    const next = this.path[Math.min(this.i, this.path.length - 1)];
    const [nx, , nz] = next.c;
    const dx = nx + 0.5 - p.x, dz = nz + 0.5 - p.z, d = Math.hypot(dx, dz);
    if (d > 0.08) { const k = Math.min(1, d / 0.35); ctl.mx = (dx / d) * k; ctl.mz = (dz / d) * k; }
    const jumpy = next.how === 'up' || next.how === 'gap' || next.how === 'gapup';
    const atEdge = next.how === 'up' ? d < 1.05 : d < (next.how === 'gapup' ? 1.9 : 2.4) && d > 0.9;
    if (jumpy && p.ground && atEdge) { ctl.jump = true; ctl.jumpP = true; }
    if (!p.ground && p.vy > 0) ctl.jump = true;
    // the attract mode swings at whatever is close and stomps the rest
    if (this.attack && p.ground && Math.random() < 0.05 && w.ents.some((e) => e.enemy && e.alive && !e.saved && Math.hypot(e.x - p.x, e.z - p.z) < 1.3 && Math.abs(e.y - p.y) < 1)) ctl.attackP = true;
    if (this.t - this.lastProg > 3) { this.path = null; this.lastProg = this.t; } // stuck: plan again from here
    return ctl;
  }
}
