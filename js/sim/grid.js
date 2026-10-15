// The voxel grid: block types, lookups, and axis-separated box collision. Pure (Node runs it).
// Cell (x, y, z) spans [x, x+1) × [y, y+1) × [z, z+1). Outside the grid is bedrock.

export const B = {
  AIR: 0,
  DIRT: 1,     // diggable, one hit
  CLAY: 2,     // diggable, two hits
  OIL: 3,      // oil sand: diggable, one hit
  GOLD: 4,     // gold vein: two hits, drops nuggets
  ROCK: 5,     // the well's bedrock: never breaks
  PLANK: 6,    // boarded side-tunnel entrance: one hit
  COLLAR: 7,   // hazard-striped steel round the way down: never breaks
  STONE: 8,    // the Bottom's dressed stone: never breaks
  PIPE: 9,     // Pipeworks steel: never breaks
  WOOD: 10,    // timber platform: one hit
};

export const SOLID = new Uint8Array(16);
export const HP = new Uint8Array(16);
for (const [b, hp] of [[B.DIRT, 1], [B.CLAY, 2], [B.OIL, 1], [B.GOLD, 2], [B.ROCK, 0], [B.PLANK, 1], [B.COLLAR, 0], [B.STONE, 0], [B.PIPE, 0], [B.WOOD, 1]]) {
  SOLID[b] = 1; HP[b] = hp;
}
export const breakable = (b) => HP[b] > 0;

export class Grid {
  constructor(nx, ny, nz) {
    this.nx = nx; this.ny = ny; this.nz = nz;
    this.c = new Uint8Array(nx * ny * nz);
    this.dmg = new Map(); // cell index → hits taken (multi-hit blocks)
  }
  idx(x, y, z) { return x + this.nx * (z + this.nz * y); }
  in(x, y, z) { return x >= 0 && y >= 0 && z >= 0 && x < this.nx && y < this.ny && z < this.nz; }
  get(x, y, z) { return this.in(x, y, z) ? this.c[x + this.nx * (z + this.nz * y)] : B.ROCK; }
  set(x, y, z, b) { if (this.in(x, y, z)) this.c[x + this.nx * (z + this.nz * y)] = b; }
  solid(x, y, z) { return SOLID[this.get(x, y, z)] === 1; }
  solidAt(px, py, pz) { return this.solid(Math.floor(px), Math.floor(py), Math.floor(pz)); }
  fill(x0, y0, z0, x1, y1, z1, b) { // inclusive box
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.set(x, y, z, b);
  }
  // the first solid cell at or below y in a column (−1 if none)
  floorBelow(x, y, z) {
    for (let yy = Math.min(y, this.ny - 1); yy >= 0; yy--) if (this.solid(x, yy, z)) return yy;
    return -1;
  }
}

const EPS = 1e-4;

// Does a box [x−hw, x+hw] × [y, y+h] × [z−hw, z+hw] overlap any solid cell?
export function boxSolid(g, x, y, z, hw, h) {
  const x0 = Math.floor(x - hw + EPS), x1 = Math.floor(x + hw - EPS);
  const y0 = Math.floor(y + EPS), y1 = Math.floor(y + h - EPS);
  const z0 = Math.floor(z - hw + EPS), z1 = Math.floor(z + hw - EPS);
  for (let yy = y0; yy <= y1; yy++) for (let zz = z0; zz <= z1; zz++) for (let xx = x0; xx <= x1; xx++) if (g.solid(xx, yy, zz)) return true;
  return false;
}

// Move a body {x, y, z, hw, h} by (dx, dy, dz), one axis at a time, stopping flush against cells.
// Returns a bit mask of what it hit: 1 = x, 2 = floor (moving down), 4 = ceiling, 8 = z.
// If `pop` > 0, a horizontal hit tries lifting the body by up to `pop` first (ledge mantle).
export function moveBody(g, b, dx, dy, dz, pop = 0) {
  let hit = 0;
  // y first: landing before sliding keeps edges from snagging
  if (dy !== 0) {
    const ny = b.y + dy;
    if (dy < 0) {
      // land only on what is under the feet (a head already inside a ceiling just keeps falling out of it)
      if (boxSolid(g, b.x, ny, b.z, b.hw, Math.min(b.h, -dy + 0.02))) { hit |= 2; b.y = Math.floor(ny + EPS) + 1; }
      else b.y = ny;
    } else if (boxSolid(g, b.x, ny, b.z, b.hw, b.h)) {
      hit |= 4;
      b.y = Math.max(b.y, Math.floor(ny + b.h - EPS) - b.h - EPS);
    } else b.y = ny;
  }
  if (dx !== 0) {
    const nx = b.x + dx;
    if (boxSolid(g, nx, b.y, b.z, b.hw, b.h)) {
      if (pop > 0 && tryPop(g, b, nx, b.z, pop)) { b.x = nx; hit |= 16; }
      else {
        hit |= 1;
        b.x = dx > 0 ? Math.floor(nx + b.hw - EPS) - b.hw - EPS : Math.floor(nx - b.hw + EPS) + 1 + b.hw + EPS;
      }
    } else b.x = nx;
  }
  if (dz !== 0) {
    const nz = b.z + dz;
    if (boxSolid(g, b.x, b.y, nz, b.hw, b.h)) {
      if (pop > 0 && tryPop(g, b, b.x, nz, pop)) { b.z = nz; hit |= 16; }
      else {
        hit |= 8;
        b.z = dz > 0 ? Math.floor(nz + b.hw - EPS) - b.hw - EPS : Math.floor(nz - b.hw + EPS) + 1 + b.hw + EPS;
      }
    } else b.z = nz;
  }
  return hit;
}

function tryPop(g, b, nx, nz, pop) {
  const top = Math.floor(b.y + EPS) + 1; // the top of the cell row the feet are in
  const lift = top - b.y;
  if (lift <= 0 || lift > pop) return false;
  if (boxSolid(g, nx, top + EPS, nz, b.hw, b.h)) return false;
  if (boxSolid(g, b.x, top + EPS, b.z, b.hw, b.h)) return false;
  b.y = top + EPS;
  return true;
}

// Standing on something? (a thin probe under the feet)
export function onGround(g, b) {
  return boxSolid(g, b.x, b.y - 0.04, b.z, b.hw * 0.92, 0.035);
}

// March a ray through the grid (Amanatides–Woo). Returns {t, x, y, z} of the first solid cell, or null.
export function rayGrid(g, ox, oy, oz, dx, dy, dz, maxT) {
  let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
  const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tx = dx !== 0 ? ((dx > 0 ? x + 1 - ox : ox - x) * tdx) : Infinity;
  let ty = dy !== 0 ? ((dy > 0 ? y + 1 - oy : oy - y) * tdy) : Infinity;
  let tz = dz !== 0 ? ((dz > 0 ? z + 1 - oz : oz - z) * tdz) : Infinity;
  let t = 0;
  for (let i = 0; i < 64 && t <= maxT; i++) {
    if (g.solid(x, y, z)) return { t, x, y, z };
    if (tx < ty && tx < tz) { x += sx; t = tx; tx += tdx; }
    else if (ty < tz) { y += sy; t = ty; ty += tdy; }
    else { z += sz; t = tz; tz += tdz; }
  }
  return null;
}
