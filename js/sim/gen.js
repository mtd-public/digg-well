// The seeded well generator. Pure: Node runs it in tools/sim-check.mjs.
//
// The well is one continuous voxel volume: depths stacked top to bottom, each depth a stack of
// stories. A story is a floor slab plus six cells of air; its ceiling is the floor of the story
// above. Every floor has a way down (a 2×2 hole, a shaft's big drop, or the depth's collar hole).
// Side paths are carved into the bedrock ring round the 13 × 13 well: treasure rooms, shops
// (with a shopkeeper), stashes, and chutes that drop to a lower story (sometimes into the next depth).
//
// Spelunky's rule, in 3D: the main way down is guaranteed without digging (proof.js checks it,
// and generate() re-rolls a layout that fails), and dirt is diggable, so nothing is a dead end.

import { T, DEPTHS, POP, UPGRADES, SHOP_STOCK } from './tuning.js';
import { Grid, B } from './grid.js';
import { makeRand } from './rng.js';
import { prove } from './proof.js';

const { W0, W1 } = T;
const CX = (W0 + W1 + 1) / 2; // 14.5: the well's centre line

export function generate(seed, { maxTries = 12 } = {}) {
  let last = null;
  for (let attempt = 0; attempt < maxTries; attempt++) {
    const lv = build(seed, attempt);
    const p = prove(lv);
    lv.proof = p;
    lv.attempt = attempt;
    if (p.ok) return lv;
    last = lv;
  }
  return last; // (sim-check fails loudly if this ever happens)
}

function build(seed, attempt) {
  const r = makeRand((seed * 2654435761 + attempt * 97) >>> 0);
  // ---------------------------------------------------------------- story list, top to bottom
  const stories = [];
  let total = T.TOP_AIR + 1;
  DEPTHS.forEach((d, di) => {
    for (let k = 0; k < d.stories; k++) {
      const H = d.shrine ? T.SHRINE_H : T.STORY_H;
      stories.push({ depth: di, k, H, last: k === d.stories - 1, theme: d.theme });
      total += H;
    }
  });
  const NY = total;
  const g = new Grid(T.NX, NY, T.NZ);
  g.c.fill(B.ROCK);
  let cursor = NY - T.TOP_AIR;
  stories.forEach((s, i) => { s.i = i; s.top = cursor; s.y0 = cursor - s.H; cursor = s.y0; });

  // kinds: the first story of each depth is a landing, the last has the collar floor;
  // shafts (a big drop with perches) go between, never two in a row
  for (const s of stories) {
    const d = DEPTHS[s.depth];
    if (d.shrine) { s.kind = 'shrine'; s.floor = 'stone'; continue; }
    if (s.k === 0) { s.kind = s.depth === 0 ? 'wellhead' : 'landing'; s.floor = 'dirt'; continue; }
    s.kind = 'chamber'; s.floor = s.last ? 'collar' : 'dirt';
  }
  for (let i = 1; i < stories.length - 1; i++) {
    const s = stories[i], prev = stories[i - 1];
    if (s.kind !== 'chamber' || s.last || prev.kind === 'shaft') continue;
    if (r.chance(s.depth === 0 ? 0.35 : 0.42)) { s.kind = 'shaft'; s.floor = 'shaft'; }
  }

  // dark stories: the lamp sputters; find the lanterns, throw flares, use fire (more of them deeper)
  const DARK = [0, 0.12, 0.25, 0.3, 0.6];
  for (const s of stories) {
    if ((s.kind === 'chamber' || s.kind === 'shaft') && !(s.depth === 0 && s.k <= 1)) s.dark = r.chance(DARK[s.depth] || 0);
  }

  const spawns = [];      // entities: {type, x, y, z, ...}
  const lanterns = [];    // {x, y, z, nx, nz, room}
  const signs = [];       // {x, y, z, nx, nz, text}
  const rooms = [];       // side paths, for the HUD / render
  const decor = [];       // render-only props: {type, x, y, z, rot, ...}
  const used = new Set(); // upgrades already placed this run
  const carves = [];      // ring boxes taken: {side, ylo, yhi, vlo, vhi}
  const add = (type, x, y, z, extra) => { const e = { type, x, y, z, ...extra }; spawns.push(e); return e; };

  const mats = (theme) => {
    // the floor and mesa mix of a theme: [block, weight]
    switch (theme) {
      case 0: return [[B.DIRT, 8], [B.CLAY, 1]];
      case 1: return [[B.DIRT, 6], [B.CLAY, 3]];
      case 2: return [[B.OIL, 6], [B.DIRT, 3]];
      case 3: return [[B.CLAY, 6], [B.OIL, 2], [B.DIRT, 1]];
      case 4: return [[B.OIL, 5], [B.CLAY, 3]];
      default: return [[B.STONE, 1]];
    }
  };
  const pickMat = (theme) => {
    const m = mats(theme); let tot = 0; for (const [, w] of m) tot += w;
    let x = r.f() * tot; for (const [b, w] of m) { if ((x -= w) < 0) return b; } return m[0][0];
  };
  const inRect = (x, z, h, pad = 0) => x >= h.x0 - pad && x <= h.x1 + pad && z >= h.z0 - pad && z <= h.z1 + pad;
  const center = (h) => ({ x: (h.x0 + h.x1 + 1) / 2, z: (h.z0 + h.z1 + 1) / 2 });

  // ---------------------------------------------------------------- carve every story's volume
  for (const s of stories) {
    const slab = s.floor === 'collar' ? 2 : 1;
    s.slab = slab;
    s.floorTop = s.y0 + slab; // y of the walkable surface
    g.fill(W0, s.y0 + slab, W0, W1, s.top - 1, W1, B.AIR);
    for (let yy = s.y0; yy < s.y0 + slab; yy++) {
      for (let z = W0; z <= W1; z++) for (let x = W0; x <= W1; x++) {
        g.set(x, yy, z, s.floor === 'collar' ? B.ROCK : s.floor === 'stone' ? B.STONE : pickMat(s.theme));
      }
    }
  }
  // the well mouth: open to the sky above the first story
  g.fill(W0, stories[0].top, W0, W1, NY - 1, W1, B.AIR);

  // ---------------------------------------------------------------- holes, top to bottom
  let entry = { x: CX, z: CX, r: 1 };
  for (const s of stories) {
    s.entry = entry;
    s.holes = [];
    if (s.kind === 'shrine') break;
    if (s.floor === 'shaft') {
      const m = r.int(2, 3);
      const h = { x0: W0 + m, z0: W0 + m, x1: W1 - m, z1: W1 - m, big: true };
      s.holes.push(h);
      entry = { x: CX, z: CX, r: (W1 - W0 - 2 * m) / 2 };
    } else {
      const size = s.floor === 'collar' ? 3 : 2;
      const h = placeHole(r, entry, size);
      s.holes.push(h);
      entry = { ...center(h), r: size / 2 };
      if (s.floor === 'dirt' && s.kind === 'chamber' && r.chance(0.5)) {
        // a second, smaller way down: an alternate line (or a trap above a crowd)
        for (let t = 0; t < 20; t++) {
          const w = r.int(1, 2), x0 = r.int(W0 + 1, W1 - w), z0 = r.int(W0 + 1, W1 - 1);
          const h2 = { x0, z0, x1: x0 + w - 1, z1: z0 };
          if (inRect(x0, z0, h, 2) || inRect(h2.x1, z0, h, 2)) continue;
          if (Math.hypot(x0 + 0.5 - s.entry.x, z0 + 0.5 - s.entry.z) < 3) continue;
          s.holes.push(h2); break;
        }
      }
    }
    for (const h of s.holes) {
      for (let yy = s.y0; yy < s.y0 + s.slab; yy++) g.fill(h.x0, yy, h.z0, h.x1, yy, h.z1, B.AIR);
      if (s.floor === 'collar') {
        // hazard stripes round the way down
        for (let z = h.z0 - 1; z <= h.z1 + 1; z++) for (let x = h.x0 - 1; x <= h.x1 + 1; x++) {
          if (!inRect(x, z, h)) g.set(x, s.y0 + 1, z, B.COLLAR);
        }
      }
    }
  }

  // a story's floor cell is "open" if it is a hole of this story
  const isHole = (s, x, z) => s.holes.some((h) => inRect(x, z, h));
  const nearHole = (s, x, z, pad) => s.holes.some((h) => inRect(x, z, h, pad));
  const prevOf = (s) => stories[s.i - 1];
  const underAboveHole = (s, x, z, pad = 0) => { const p = prevOf(s); return p ? p.holes.some((h) => inRect(x, z, h, pad)) : Math.hypot(x + 0.5 - CX, z + 0.5 - CX) < 2.5; };

  // ---------------------------------------------------------------- terrain features
  for (const s of stories) {
    s.mesas = []; s.ledges = [];
    if (s.kind === 'shrine') { buildShrine(s); continue; }
    const theme = s.theme;
    const fy = s.floorTop;
    if (s.kind === 'shaft') {
      // perches: short ledges out of the walls, at different heights, and a timber rib or two
      const n = r.int(3, 5);
      for (let i = 0; i < n; i++) {
        const side = r.int(0, 3), L = r.int(2, 3), D = r.int(1, 2), yy = fy + r.int(1, 4);
        const v0 = r.int(W0 + 1, W1 - L);
        const box = sideBox(side, D, v0, L);
        g.fill(box.x0, yy, box.z0, box.x1, yy, box.z1, theme <= 1 ? B.WOOD : pickMat(theme));
        s.ledges.push({ ...box, y: yy });
      }
      if (r.chance(0.6)) {
        const yy = fy + r.int(2, 4), along = r.chance(0.5), v = r.int(W0 + 3, W1 - 3);
        if (along) g.fill(W0, yy, v, W1, yy, v, B.WOOD); else g.fill(v, yy, W0, v, yy, W1, B.WOOD);
        s.ledges.push(along ? { x0: W0, z0: v, x1: W1, z1: v, y: yy, rib: true } : { x0: v, z0: W0, x1: v, z1: W1, y: yy, rib: true });
      }
      continue;
    }
    const nM = s.kind === 'chamber' ? r.int(3, 6) : r.int(1, 2);
    for (let i = 0, tries = 0; i < nM && tries < 60; tries++) {
      const w = r.int(2, 4), d = r.int(2, 4), h = r.chance(0.55) ? 1 : 2;
      const x0 = r.int(W0, W1 - w + 1), z0 = r.int(W0, W1 - d + 1);
      const m = { x0, z0, x1: x0 + w - 1, z1: z0 + d - 1, h };
      let bad = false;
      for (let z = m.z0; z <= m.z1 && !bad; z++) for (let x = m.x0; x <= m.x1 && !bad; x++) if (nearHole(s, x, z, 1)) bad = true;
      if (bad) continue;
      const mat = pickMat(theme);
      for (let yy = fy; yy < fy + h; yy++) for (let z = m.z0; z <= m.z1; z++) for (let x = m.x0; x <= m.x1; x++) {
        g.set(x, yy, z, yy === fy + h - 1 && r.chance(0.07) ? B.GOLD : mat);
      }
      s.mesas.push(m); i++;
    }
    if (s.kind === 'chamber') {
      // ledges up the walls, each with a step to climb onto it
      const nL = r.int(1, 2);
      for (let i = 0; i < nL; i++) {
        const side = r.int(0, 3), L = r.int(3, 5), D = r.int(1, 2), hl = r.int(3, 4);
        const v0 = r.int(W0 + 1, W1 - L);
        const box = sideBox(side, D, v0, L);
        const yy = s.y0 + hl;
        g.fill(box.x0, yy, box.z0, box.x1, yy, box.z1, theme <= 1 ? B.WOOD : pickMat(theme));
        const led = { ...box, y: yy, side };
        s.ledges.push(led);
        // the step: a mesa in front of the ledge, (hl − 2) high
        const sh = hl - 2;
        const step = sideBox(side, 2, v0 + r.int(0, L - 2), 2, D);
        let ok = true;
        for (let z = step.z0; z <= step.z1; z++) for (let x = step.x0; x <= step.x1; x++) if (isHole(s, x, z)) ok = false;
        if (ok) { const mat = pickMat(theme); for (let k = 0; k < sh; k++) g.fill(step.x0, fy + k, step.z0, step.x1, fy + k, step.z1, mat); }
      }
      // pillars: floor to ceiling, never under a hole above or beside one here
      const nP = r.int(0, 2);
      for (let i = 0, tries = 0; i < nP && tries < 30; tries++) {
        const w = r.chance(0.5) ? 1 : 2;
        const x0 = r.int(W0 + 2, W1 - 1 - w), z0 = r.int(W0 + 2, W1 - 1 - w);
        let bad = false;
        for (let z = z0; z < z0 + w; z++) for (let x = x0; x < x0 + w; x++) if (nearHole(s, x, z, 1) || underAboveHole(s, x, z, 1)) bad = true;
        if (bad) continue;
        g.fill(x0, fy, z0, x0 + w - 1, s.top - 1, z0 + w - 1, pickMat(theme)); i++;
      }
    }
    // Pipeworks: steel bands in the walls (looks only: the walls never break anyway)
    if (theme === 1) {
      const yy = s.y0 + r.int(3, 5);
      for (let v = W0 - 1; v <= W1 + 1; v++) {
        for (const [x, z] of [[W0 - 1, v], [W1 + 1, v], [v, W0 - 1], [v, W1 + 1]]) if (g.get(x, yy, z) === B.ROCK) g.set(x, yy, z, B.PIPE);
      }
    }
  }

  // The Bedrock Boardroom: a long table down the middle (stand on it to stomp the Chairman), the
  // Golden Shovel in a glass case on a dais at the head of the room, the crew along the far wall.
  function buildShrine(s) {
    const fy = s.floorTop;
    for (let yy = s.y0; yy < s.top; yy++) for (let v = W0 - 1; v <= W1 + 1; v++) {
      for (const [x, z] of [[W0 - 1, v], [W1 + 1, v], [v, W0 - 1], [v, W1 + 1]]) g.set(x, yy, z, B.STONE);
    }
    // the dais (3 × 3) and the table (3 × 6, timber: bombs splinter it)
    g.fill(13, fy, W0, 15, fy, W0 + 2, B.STONE);
    s.mesas.push({ x0: 13, z0: W0, x1: 15, z1: W0 + 2, h: 1 });
    g.fill(13, fy, 12, 15, fy, 17, B.WOOD);
    s.mesas.push({ x0: 13, z0: 12, x1: 15, z1: 17, h: 1 });
    add('goldenShovel', CX, fy + 1, W0 + 1.5);
    add('boss', CX, fy, W0 + 4.2);
    decor.push({ type: 'case', x: CX, y: fy + 1, z: W0 + 1.5 });
    for (let z = 12.5; z <= 17.5; z += 1.25) for (const sx of [-1, 1]) decor.push({ type: 'chair', x: CX + sx * 2.2, y: fy, z, face: sx > 0 ? -Math.PI / 2 : Math.PI / 2 });
    decor.push({ type: 'chair', x: CX, y: fy, z: 18.9, face: Math.PI, big: true });
    decor.push({ type: 'chart', x: CX, y: fy + 4.2, z: W0 + 0.06, dx: 0, dz: 1 });
    decor.push({ type: 'plant', x: W0 + 0.8, y: fy, z: W0 + 0.8 }, { type: 'plant', x: W1 + 0.2, y: fy, z: W0 + 0.8 });
    decor.push({ type: 'cooler', x: W1 + 0.25, y: fy, z: CX + 2 });
    decor.push({ type: 'portrait', x: W0 + 0.06, y: fy + 3.2, z: CX, dx: 1, dz: 0 });
    // the crew: drowned in crude, chained to the job (they don't fight)
    for (const [x, z] of [[W0 + 1.5, W1 - 1], [CX + 0.2, W1 - 0.5], [W1 - 0.5, W1 - 1.5]]) add('worker', x, fy, z, { crew: true });
    for (const [x, z] of [[W0 + 1.1, CX + 1], [W1 - 0.1, CX - 1], [W0 + 1.1, W1 - 3], [W1 - 0.1, W1 - 3]]) lanterns.push({ x, y: fy + 0.05, z, nx: 0, nz: 0, brazier: true });
    for (let i = 0; i < 14; i++) {
      const x = r.range(W0 + 0.6, W1 + 0.4), z = r.range(CX, W1 + 0.4);
      if (g.get(Math.floor(x), fy, Math.floor(z)) === B.AIR) add('gold', x, fy, z, { value: 4, bill: i % 2 === 0 });
    }
  }

  // ---------------------------------------------------------------- side paths
  for (let di = 0; di < DEPTHS.length - 1; di++) {
    const ds = stories.filter((s) => s.depth === di);
    const plan = SIDE_PLAN[di].slice();
    r.shuffle(plan);
    for (const kind of plan) {
      for (let tries = 0; tries < 24; tries++) {
        const s = r.pick(ds.filter((q) => q.kind === 'chamber' || q.kind === 'landing' || (q.kind === 'wellhead' && kind !== 'chute')));
        if (!s) break;
        if (kind === 'chute' ? carveChute(s, di) : carveRoom(s, kind, di)) break;
      }
    }
  }

  function wallCells(side, u, v) {
    // local (u outward from the well's edge, v along the wall) → grid x, z
    switch (side) {
      case 0: return [W0 - u, v];      // west
      case 1: return [W1 + u, v];      // east
      case 2: return [v, W0 - u];      // north
      default: return [v, W1 + u];     // south
    }
  }
  function doorFace(side, vc) { // the middle of a 2-wide doorway, on the well's wall face
    return [{ x: W0, z: vc + 1 }, { x: W1 + 1, z: vc + 1 }, { x: vc + 1, z: W0 }, { x: vc + 1, z: W1 + 1 }][side];
  }
  function inward(side) { return [[1, 0], [-1, 0], [0, 1], [0, -1]][side]; }
  function freeRing(side, ylo, yhi, vlo, vhi) {
    for (const c of carves) if (c.side === side && ylo <= c.yhi + 1 && yhi >= c.ylo - 1 && vlo <= c.vhi + 1 && vhi >= c.vlo - 1) return false;
    return true;
  }
  function carveLocal(side, u0, u1, v0, v1, ylo, yhi, b) {
    for (let u = u0; u <= u1; u++) for (let v = v0; v <= v1; v++) {
      const [x, z] = wallCells(side, u, v);
      for (let yy = ylo; yy <= yhi; yy++) g.set(x, yy, z, b);
    }
  }
  // the 2 × 3 doorway in the well wall; clear the floor in front of it inside the well
  function doorway(s, side, vc, boarded) {
    const fy = s.floorTop;
    carveLocal(side, 1, 3, vc, vc + 1, fy, fy + 2, B.AIR);
    if (boarded) carveLocal(side, 1, 1, vc, vc + 1, fy, fy + 2, B.PLANK);
    // inside the well: two cells deep, keep it walkable
    for (let u = 0; u >= -1; u--) for (let v = vc; v <= vc + 1; v++) {
      const [x, z] = wallCells(side, u, v);
      for (let yy = fy; yy <= fy + 2; yy++) if (g.get(x, yy, z) !== B.AIR && yy < s.top) g.set(x, yy, z, B.AIR);
    }
    const [dx, dz] = inward(side);
    const f = doorFace(side, vc);
    decor.push({ type: 'timber', side, x: f.x, y: fy, z: f.z, dx, dz, boarded });
  }
  function doorOk(s, side, vc) {
    for (let v = vc; v <= vc + 1; v++) for (let u = 0; u >= -1; u--) {
      const [x, z] = wallCells(side, u, v);
      if (isHole(s, x, z)) return false;
    }
    return true;
  }

  function carveRoom(s, kind, di) {
    const side = r.int(0, 3), vc = r.int(W0 + 2, W1 - 3);
    const fy = s.floorTop;
    if (s.ledges.some((l) => l.side === side && l.y <= fy + 3)) return false;
    if (!doorOk(s, side, vc)) return false;
    const shop = kind === 'shop';
    const vlo = shop ? vc - 2 : vc - 1, vhi = shop ? vc + 3 : vc + 3;
    if (!freeRing(side, fy - 1, fy + 4, vlo, vhi)) return false;
    carves.push({ side, ylo: fy - 1, yhi: fy + 4, vlo, vhi });
    doorway(s, side, vc, !shop && r.chance(0.75));
    carveLocal(side, shop ? 3 : 4, 7, vlo, vhi, fy, fy + 3, B.AIR);
    const at = (u, v) => { const [x, z] = wallCells(side, u, v); return { x: x + 0.5, z: z + 0.5 }; };
    const room = { kind, story: s.i, depth: di, side, door: doorFace(side, vc) };
    rooms.push(room);
    const [nx, nz] = inward(side);
    const back = at(7, vc + 1);
    lanterns.push({ x: back.x - nx * 0.45, y: fy + 2.6, z: back.z - nz * 0.45 + (shop ? 1.6 * Math.abs(nx) : 0), nx, nz, room: true });
    if (kind === 'treasure') {
      const picks = pickUpgrades(2);
      const group = `ch${s.i}-${side}`;
      picks.forEach((id, i) => { const p = at(5.5, vc - 0.5 + i * 3); add('upgrade', p.x, fy, p.z, { id, group }); });
      for (let i = 0; i < 4; i++) { const p = at(r.range(4.3, 6.8), r.range(vc - 0.7, vc + 2.7)); add('gold', p.x, fy, p.z, { value: 2 }); }
      if (r.chance(0.35)) { const p = at(6.6, vc + 1); add('item', p.x, fy, p.z, { id: 'shard' }); }
    } else if (kind === 'shop') {
      // a counter across the back, the shopkeeper behind it, four wares in a row
      const k = at(6.4, vc + 1);
      const stock = drawStock(4);
      // the better the stock, the bigger the shopkeeper's whiskers: a tell you read from the door
      const good = stock.filter((w) => ['shard', 'upgrade', 'shotgun', 'pickaxe', 'heart'].includes(w)).length;
      add('shopkeeper', k.x, fy, k.z, { shop: rooms.length - 1, face: Math.atan2(nx, nz), beard: good >= 3 ? 2 : good >= 2 ? 1 : 0 });
      decor.push({ type: 'counter', x: at(5.6, vc + 1).x, y: fy, z: at(5.6, vc + 1).z, dx: nx, dz: nz });
      decor.push({ type: 'shopsign', x: back.x - nx * 0.45, y: fy + 2.2, z: back.z - nz * 0.45, dx: nx, dz: nz });
      const mult = 1 + T.PRICE_PER_DEPTH * di;
      stock.forEach((w, i) => {
        const p = at(4.5, vc - 1 + i * 1.5 + 0.25);
        const extra = { ware: w, price: Math.round(T.PRICE[w] * mult / 5) * 5, shop: rooms.length - 1 };
        if (w === 'upgrade') extra.id = pickUpgrades(1)[0];
        add('ware', p.x, fy, p.z, extra);
      });
      // the shop's floor plan, for "did you walk out with it?"
      const a = at(3, vc - 2), b = at(7, vc + 3);
      room.box = { x0: Math.min(a.x, b.x) - 0.5, x1: Math.max(a.x, b.x) + 0.5, z0: Math.min(a.z, b.z) - 0.5, z1: Math.max(a.z, b.z) + 0.5, y0: fy - 0.5, y1: fy + 4 };
    } else { // stash: gold veins in the walls, a weapon, a crate
      for (let u = 4; u <= 8; u++) for (let v = vc - 2; v <= vc + 4; v++) {
        const [x, z] = wallCells(side, u, v);
        for (let yy = fy; yy <= fy + 4; yy++) if (g.get(x, yy, z) === B.ROCK && r.chance(0.3)) g.set(x, yy, z, B.GOLD);
      }
      const p = at(6, vc + 0.5);
      add('weapon', p.x, fy, p.z, { id: di === 0 ? 'shotgun' : r.pick(['shotgun', 'bombs', 'pickaxe']) });
      const c = at(4.6, vc - 0.4); add('crate', c.x, fy, c.z, { loot: 'gold' });
      if (di === 0) s.depthHasShotgun = true;
    }
    return true;
  }

  function carveChute(s, di) {
    if (s.kind !== 'chamber' && s.kind !== 'landing') return false;
    const j = s.i + r.int(1, 2);
    const t = stories[j];
    if (!t || t.kind === 'shrine' || t.kind === 'shaft' && !stories[j + 1]) return false;
    const side = r.int(0, 3), vc = r.int(W0 + 2, W1 - 3);
    const fy = s.floorTop, ty = t.floorTop;
    if (s.ledges.some((l) => l.side === side && l.y <= fy + 3)) return false;
    if (t.ledges.some((l) => l.side === side && l.y <= ty + 3)) return false;
    if (!doorOk(s, side, vc) || !doorOk(t, side, vc)) return false;
    if (t.kind === 'shaft') { // the chute must come out onto floor, not into the drop
      for (let v = vc; v <= vc + 1; v++) { const [x, z] = wallCells(side, 0, v); if (isHole(t, x, z)) return false; }
    }
    if (!freeRing(side, ty - 1, fy + 4, vc - 1, vc + 2)) return false;
    carves.push({ side, ylo: ty - 1, yhi: fy + 4, vlo: vc - 1, vhi: vc + 2 });
    doorway(s, side, vc, true);
    doorway(t, side, vc, true);
    carveLocal(side, 3, 4, vc, vc + 1, ty, fy + 2, B.AIR);
    const at = (u, v) => { const [x, z] = wallCells(side, u, v); return { x: x + 0.5, z: z + 0.5 }; };
    // gold down the drop, a lantern at the bottom
    for (let yy = ty + 2; yy < fy; yy += 2) { const p = at(r.chance(0.5) ? 3 : 4, vc + r.int(0, 1)); add('gold', p.x, yy, p.z, { value: 2, float: true }); }
    const [nx, nz] = inward(side);
    const b = at(4, vc + 0.5);
    lanterns.push({ x: b.x - nx * 0.45, y: ty + 2.2, z: b.z - nz * 0.45, nx, nz, room: true });
    if (r.chance(0.5)) { const p = at(3.5, vc + 0.5); add('item', p.x, ty, p.z, { id: 'gin' }); }
    rooms.push({ kind: 'chute', story: s.i, to: j, depth: di, side, door: doorFace(side, vc), exit: doorFace(side, vc), crossesDepth: t.depth !== s.depth });
    return true;
  }

  function drawStock(n) {
    const pool = SHOP_STOCK.map(([k, w]) => [k, w]);
    const out = [];
    while (out.length < n && pool.length) {
      let tot = 0; for (const [, w] of pool) tot += w;
      let x = r.f() * tot, i = 0;
      for (; i < pool.length; i++) if ((x -= pool[i][1]) < 0) break;
      out.push(pool[Math.min(i, pool.length - 1)][0]);
      pool.splice(Math.min(i, pool.length - 1), 1);
    }
    return out;
  }

  function pickUpgrades(n) {
    const all = Object.keys(UPGRADES).filter((k) => !used.has(k));
    const pool = all.length >= n ? all : Object.keys(UPGRADES);
    r.shuffle(pool);
    const out = pool.slice(0, n);
    out.forEach((k) => used.add(k));
    return out;
  }

  function sideBox(side, D, v0, L, uOff = 0) {
    // a box against the inside of wall `side`, D deep (from uOff), L long from v0
    switch (side) {
      case 0: return { x0: W0 + uOff, x1: W0 + uOff + D - 1, z0: v0, z1: v0 + L - 1 };
      case 1: return { x0: W1 - uOff - D + 1, x1: W1 - uOff, z0: v0, z1: v0 + L - 1 };
      case 2: return { z0: W0 + uOff, z1: W0 + uOff + D - 1, x0: v0, x1: v0 + L - 1 };
      default: return { z0: W1 - uOff - D + 1, z1: W1 - uOff, x0: v0, x1: v0 + L - 1 };
    }
  }

  // ---------------------------------------------------------------- what stands where
  const taken = [];
  const free = (x, y, z, d) => taken.every((p) => Math.abs(p.y - y) > 1.5 || Math.hypot(p.x - x, p.z - z) > d);
  const take = (p) => { taken.push(p); return p; };
  function surfaces(s, { floorOnly = false, raisedOnly = false } = {}) {
    const out = [];
    for (let z = W0; z <= W1; z++) for (let x = W0; x <= W1; x++) {
      for (let yy = s.top - 2; yy >= s.floorTop; yy--) {
        if (g.get(x, yy, z) === B.AIR && g.get(x, yy + 1, z) === B.AIR && g.solid(x, yy - 1, z)) {
          const raised = yy > s.floorTop;
          if ((floorOnly && raised) || (raisedOnly && !raised)) continue;
          out.push({ x: x + 0.5, y: yy, z: z + 0.5, raised });
        }
      }
    }
    return out;
  }
  function place(s, list, n, type, { minEntry = 3.2, spacing = 1.6, extra } = {}) {
    let placed = 0;
    for (let tries = 0; tries < n * 30 && placed < n && list.length; tries++) {
      const p = r.pick(list);
      if (Math.hypot(p.x - s.entry.x, p.z - s.entry.z) < minEntry && p.y <= s.floorTop + 1) continue;
      if (!free(p.x, p.y, p.z, spacing)) continue;
      take(p);
      add(type, p.x + r.range(-0.1, 0.1), p.y, p.z + r.range(-0.1, 0.1), typeof extra === 'function' ? extra() : extra);
      placed++;
    }
    return placed;
  }

  for (const s of stories) {
    if (s.kind === 'shrine') continue;
    const di = s.depth;
    const floor = surfaces(s, { floorOnly: true }), raised = surfaces(s, { raisedOnly: true }), all = floor.concat(raised);
    // lanterns on the walls
    const nLan = s.kind === 'chamber' || s.kind === 'shaft' ? POP.lanterns[di] + (s.dark ? 2 : 0) : 1;
    for (let i = 0; i < nLan; i++) {
      const side = (i + s.i) % 4, v = r.range(W0 + 1.5, W1 - 0.5);
      const [nx, nz] = inward(side);
      const wx = side === 0 ? W0 : side === 1 ? W1 + 1 : v, wz = side === 2 ? W0 : side === 3 ? W1 + 1 : v;
      lanterns.push({ x: wx + nx * 0.18, y: s.floorTop + r.range(2.6, 3.6), z: wz + nz * 0.18, nx, nz, unlit: !!s.dark });
    }
    if (s.dark) {
      // a lantern post beside each way down, waiting for a match
      for (const h of s.holes) {
        const c = center(h), opts = [];
        for (let z = h.z0 - 1; z <= h.z1 + 1; z++) for (let x = h.x0 - 1; x <= h.x1 + 1; x++) {
          if (inRect(x, z, h) || x < W0 || z < W0 || x > W1 || z > W1) continue;
          if (g.get(x, s.floorTop, z) === B.AIR && g.solid(x, s.floorTop - 1, z)) opts.push([x, z]);
        }
        if (!opts.length) continue;
        const [x, z] = r.pick(opts);
        lanterns.push({ x: x + 0.5, y: s.floorTop, z: z + 0.5, nx: Math.sign(x + 0.5 - c.x), nz: Math.sign(z + 0.5 - c.z), post: true, unlit: true });
        take({ x: x + 0.5, y: s.floorTop, z: z + 0.5 });
      }
      if (r.chance(0.6)) { const near = surfaces(s, { floorOnly: true }).filter((q) => Math.hypot(q.x - s.entry.x, q.z - s.entry.z) < 4); const q = r.pick(near); if (q && free(q.x, q.y, q.z, 0.8)) { take(q); add('item', q.x, q.y, q.z, { id: 'flare' }); } }
    }
    // office gags on the walls of the well
    if (s.kind === 'landing' || s.kind === 'wellhead' || r.chance(0.3)) {
      const side = (s.i + 2) % 4, [nx, nz] = inward(side), v = r.range(W0 + 2, W1 - 1);
      const wx = side === 0 ? W0 : side === 1 ? W1 + 1 : v, wz = side === 2 ? W0 : side === 3 ? W1 + 1 : v;
      const gag = s.kind === 'landing' ? 'accident' : r.pick(['employee', 'safety', 'hang', 'oilco', 'accident', 'suggest']);
      decor.push({ type: 'poster', gag, x: wx + nx * 0.06, y: s.floorTop + 2.2, z: wz + nz * 0.06, dx: nx, dz: nz });
    }
    if (s.kind === 'wellhead' || s.kind === 'landing') {
      const side = (s.i + 1) % 4, [nx, nz] = inward(side);
      const v = CX + (r.chance(0.5) ? -3.5 : 3.5);
      const wx = side === 0 ? W0 : side === 1 ? W1 + 1 : v, wz = side === 2 ? W0 : side === 3 ? W1 + 1 : v;
      signs.push({ x: wx + nx * 0.12, y: s.floorTop + 1.6, z: wz + nz * 0.12, nx, nz, depth: di, text: s.kind === 'wellhead' ? 'DIGG WELL No.1' : `DEPTH ${di + 1}`, sub: DEPTHS[di].name });
      if (s.kind === 'wellhead') {
        decor.push({ type: 'rope', x: CX + 0.4, y: s.floorTop, z: CX - 1.6 });
        place(s, floor, 4, 'gold', { minEntry: 2, spacing: 1, extra: { value: 1 } });
      } else {
        place(s, all, 3, 'gold', { minEntry: 1.5, spacing: 1, extra: { value: 2 } });
      }
      if (s.kind === 'landing' && di >= 1) place(s, floor, 1, 'crate', { extra: { loot: 'gin' } });
      continue;
    }
    if (s.kind === 'shaft') {
      const n = POP.shaftFlies[di];
      for (let i = 0; i < n; i++) {
        const x = r.range(W0 + 2, W1 - 1), z = r.range(W0 + 2, W1 - 1), y = s.floorTop + r.range(1.5, 4.5);
        add('fly', x, y, z);
      }
      // gold on the perches, a beetle or two on the rim
      const perch = raised.length ? raised : all;
      place(s, perch, r.int(2, 4), 'gold', { minEntry: 0, spacing: 0.8, extra: { value: 2 } });
      place(s, floor, Math.min(2, POP.beetles[di]), 'beetle', { minEntry: 0, spacing: 2.5 });
      if (POP.shaftImps[di]) place(s, perch, POP.shaftImps[di], 'imp', { minEntry: 0, spacing: 2 });
      if (POP.snakes[di] && raised.length) place(s, raised, 1, 'snake', { minEntry: 0, spacing: 3 });
      continue;
    }
    // chamber
    placeHazards(s, floor);
    if (POP.imps[di]) place(s, all, POP.imps[di] + r.int(0, 1) - 1, 'imp', { spacing: 2, minEntry: 3 });
    // bats roost under the ceiling (rock overhead, open air down to the floor)
    for (let i = 0, t = 0; i < POP.bats[di] && t < 30; t++) {
      const p = r.pick(floor); if (!p) break;
      const x = Math.floor(p.x), z = Math.floor(p.z);
      if (!g.solid(x, s.top, z) || g.get(x, s.top - 1, z) !== B.AIR || Math.hypot(p.x - s.entry.x, p.z - s.entry.z) < 2.5) continue;
      add('bat', x + 0.5, s.top - 0.42, z + 0.5); i++;
    }
    const mul = s.last ? 1.4 : 1;
    // the welcome stomp: someone right under the hole you fell through
    if (s.i > 1 && r.chance(0.4)) {
      const under = all.filter((p) => Math.hypot(p.x - s.entry.x, p.z - s.entry.z) < 1.2 + s.entry.r * 0.5);
      if (under.length) { const p = take(r.pick(under)); add(r.chance(0.5) && di > 0 ? 'worker' : 'beetle', p.x, p.y, p.z); }
    }
    place(s, all, Math.round(POP.workers[di] * mul) + r.int(0, 1) - (s.k === 1 ? 1 : 0), 'worker', { spacing: 2.6, minEntry: 3.5 });
    place(s, floor, POP.beetles[di] + r.int(0, 1), 'beetle', { spacing: 2.2 });
    place(s, raised.length ? raised : floor, POP.snakes[di] + (s.last ? 1 : 0), 'snake', { spacing: 2.5 });
    for (let i = 0; i < POP.flies[di]; i++) add('fly', r.range(W0 + 2, W1 - 1), s.floorTop + r.range(2.5, 4.5), r.range(W0 + 2, W1 - 1));
    // barrels like company: clusters of two or three
    let nb = POP.barrels[di];
    while (nb > 0) {
      const c = r.pick(floor);
      if (!c || !free(c.x, c.y, c.z, 1.2) || Math.hypot(c.x - s.entry.x, c.z - s.entry.z) < 3) { nb--; continue; }
      const k = Math.min(nb, r.int(1, 3));
      for (let i = 0; i < k; i++) {
        const x = c.x + (i === 1 ? 0.9 : i === 2 ? 0.45 : 0), z = c.z + (i === 2 ? 0.8 : 0);
        if (!g.solid(Math.floor(x), c.y - 1, Math.floor(z)) || g.solid(Math.floor(x), c.y, Math.floor(z))) continue;
        add('barrel', x, c.y, z);
      }
      take(c); nb -= k;
    }
    place(s, floor, POP.tnt[di], 'tnt', { spacing: 2.4, minEntry: 4 });
    place(s, all, POP.crates[di] + r.int(-1, 1), 'crate', { spacing: 1.4, minEntry: 2, extra: () => ({ loot: r.f() < 0.24 ? r.pick(s.dark ? ['flare', 'flare', 'gin', 'bombs'] : ['gin', 'gin', 'bombs', 'shells', 'shard', 'flare']) : 'gold' }) });
    // loose gold in little runs
    const runs = r.int(2, 3);
    for (let i = 0; i < runs; i++) {
      const p = r.pick(all);
      if (!p) break;
      const ang = r.range(0, Math.PI * 2);
      for (let k = 0; k < 3; k++) {
        const x = p.x + Math.cos(ang) * k * 0.7, z = p.z + Math.sin(ang) * k * 0.7;
        if (g.get(Math.floor(x), p.y, Math.floor(z)) !== B.AIR || !g.solid(Math.floor(x), p.y - 1, Math.floor(z))) break;
        add('gold', x, p.y, z, { value: 1 + di });
      }
    }
    // ledges carry the good stuff
    for (const l of s.ledges) {
      const lx = (l.x0 + l.x1 + 1) / 2, lz = (l.z0 + l.z1 + 1) / 2;
      if (g.get(Math.floor(lx), l.y + 1, Math.floor(lz)) !== B.AIR) continue;
      add('gold', lx, l.y + 1, lz, { value: 3 + di });
    }
  }

  // ---------------------------------------------------------------- hazards (dr-mow's, gone underground)
  function placeHazards(s, floor) {
    const di = s.depth;
    const pr = (k) => HAZ[k][di] || 0;
    const ok = (p, d = 2.6) => Math.hypot(p.x - s.entry.x, p.z - s.entry.z) > 2.6 && free(p.x, p.y, p.z, d);
    const open = (x, y, z) => g.get(x, y, z) === B.AIR && g.get(x, y + 1, z) === B.AIR && g.solid(x, y - 1, z) && !isHole(s, x, z);
    if (r.chance(pr('saw'))) {
      for (let t = 0; t < 12; t++) {
        const p = r.pick(floor); if (!p || !ok(p)) continue;
        const ax = r.chance(0.5), x = Math.floor(p.x), z = Math.floor(p.z), y = p.y;
        let lo = 0, hi = 0;
        while (lo > -4 && open(ax ? x + lo - 1 : x, y, ax ? z : z + lo - 1)) lo--;
        while (hi < 4 && open(ax ? x + hi + 1 : x, y, ax ? z : z + hi + 1)) hi++;
        if (hi - lo < 3) continue;
        const a0 = lo + 0.5, a1 = hi + 0.5;
        take(p);
        add('saw', ax ? x + a0 : x + 0.5, y, ax ? z + 0.5 : z + a0, { x0: ax ? x + a0 : x + 0.5, z0: ax ? z + 0.5 : z + a0, x1: ax ? x + a1 : x + 0.5, z1: ax ? z + 0.5 : z + a1, y });
        break;
      }
    }
    if (r.chance(pr('vent'))) {
      for (let t = 0; t < 12; t++) {
        const p = r.pick(floor); if (!p || !ok(p)) continue;
        const x = Math.floor(p.x), z = Math.floor(p.z), y = p.y;
        const kind = r.pick(['h', 'v', 'x']);
        const dirs = kind === 'h' ? [[1, 0], [-1, 0]] : kind === 'v' ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const arms = dirs.map(([dx, dz]) => { let n = 0; while (n < 4 && g.get(x + dx * (n + 1), y, z + dz * (n + 1)) === B.AIR) n++; return { x: dx, z: dz, len: Math.min(3.6, n + 0.4) }; }).filter((a) => a.len > 1);
        if (!arms.length) continue;
        take(p); add('vent', x + 0.5, y, z + 0.5, { arms, first: r.range(0, 4) }); break;
      }
    }
    if (r.chance(pr('vat'))) {
      for (let t = 0; t < 12; t++) {
        const p = r.pick(floor); if (!p || !ok(p, 3)) continue;
        take(p); add('vat', p.x, p.y, p.z, { first: r.range(0, 3) }); break;
      }
    }
    const nStal = r.chance(pr('stal')) ? r.int(1, di >= 3 ? 3 : 2) : 0;
    for (let i = 0, t = 0; i < nStal && t < 30; t++) {
      const p = r.pick(floor); if (!p) break;
      const x = Math.floor(p.x), z = Math.floor(p.z);
      if (!g.solid(x, s.top, z)) continue; // needs rock overhead
      let clear = true; for (let yy = p.y; yy < s.top; yy++) if (g.get(x, yy, z) !== B.AIR) clear = false;
      if (!clear || Math.hypot(p.x - s.entry.x, p.z - s.entry.z) < 2) continue;
      add('stal', x + 0.5, s.top, z + 0.5); i++;
    }
    if (r.chance(pr('thumper'))) {
      for (let t = 0; t < 12; t++) {
        const p = r.pick(floor); if (!p || !ok(p, 3)) continue;
        take(p); add('thumper', p.x, p.y, p.z, { first: r.range(0, 3) }); break;
      }
    }
  }

  // ---------------------------------------------------------------- guaranteed finds per depth
  for (let di = 0; di < DEPTHS.length - 1; di++) {
    const ds = stories.filter((s) => s.depth === di && (s.kind === 'chamber' || s.kind === 'shaft'));
    const want = [];
    if (di === 0 && !ds.some((s) => s.depthHasShotgun)) want.push(['weapon', { id: 'shotgun' }]);
    if (di === 0 || di === 1) want.push(['weapon', { id: 'bombs' }]);
    if (di === 1) want.push(['weapon', { id: 'pickaxe' }]);
    if (di >= 2) want.push(['weapon', { id: r.pick(['shotgun', 'bombs', 'pickaxe']) }]);
    want.push(['item', { id: 'gin' }]);
    if (di % 2 === 0) want.push(['item', { id: 'shard' }]);
    if (di >= 1) want.push(['ammo', { id: r.pick(['shells', 'bombs']) }]);
    for (const [type, extra] of want) {
      for (let tries = 0; tries < 40; tries++) {
        const s = r.pick(ds);
        const list = surfaces(s, { raisedOnly: r.chance(0.6) });
        if (!list.length) continue;
        const p = r.pick(list);
        if (!free(p.x, p.y, p.z, 1.0)) continue;
        take(p); add(type, p.x, p.y, p.z, extra); break;
      }
    }
  }

  // ---------------------------------------------------------------- one piggy bank per depth
  for (let di = 0; di < DEPTHS.length - 1; di++) {
    const ds = stories.filter((s) => s.depth === di && s.kind === 'chamber' && !s.last);
    const pool = ds.length ? ds : stories.filter((s) => s.depth === di && s.kind === 'chamber');
    for (let tries = 0; tries < 60; tries++) {
      const s = r.pick(pool);
      const list = surfaces(s, { floorOnly: r.chance(0.6) });
      const p = r.pick(list);
      if (!p || !free(p.x, p.y, p.z, 1.6) || Math.hypot(p.x - s.entry.x, p.z - s.entry.z) < 2.5) continue;
      if (spawns.some((e) => (e.type === 'barrel' || e.type === 'tnt') && Math.abs(e.y - p.y) < 2 && Math.hypot(e.x - p.x, e.z - p.z) < 3)) continue;
      take(p); add('piggy', p.x, p.y, p.z, { depth: di }); break;
    }
  }

  const s0 = stories[0];
  const spawn = { x: CX, y: s0.floorTop, z: CX - 2.5 };
  return { seed, NY, grid: g, stories, spawns, lanterns, signs, rooms, decor, spawn, shrine: stories[stories.length - 1] };
}

// hazard odds per chamber, by depth
const HAZ = {
  saw: [0.45, 0.6, 0.55, 0.7, 0.8],
  vent: [0, 0.6, 0.5, 0.7, 0.7],
  vat: [0, 0, 0.65, 0.5, 0.6],
  stal: [0.45, 0.5, 0.7, 0.7, 0.9],
  thumper: [0, 0, 0.35, 0.55, 0.65],
};

// how a depth's side paths are laid out (shuffled; a failed carve is just skipped)
const SIDE_PLAN = [
  ['stash', 'treasure', 'shop'],
  ['shop', 'treasure', 'chute'],
  ['treasure', 'stash', 'chute', 'shop'],
  ['shop', 'treasure', 'chute'],
  ['treasure', 'shop', 'chute', 'stash'],
];

function placeHole(r, entry, size) {
  let best = null, bestS = -1e9;
  for (let i = 0; i < 40; i++) {
    const x0 = r.int(W0 + 1, W1 - size), z0 = r.int(W0 + 1, W1 - size);
    const cx = x0 + size / 2, cz = z0 + size / 2;
    const d = Math.hypot(cx - entry.x, cz - entry.z);
    const sc = -Math.abs(d - 7) + r.range(0, 2.5) - (d < entry.r + 2.2 ? 20 : 0);
    if (sc > bestS) { bestS = sc; best = { x0, z0, x1: x0 + size - 1, z1: z0 + size - 1 }; }
  }
  return best;
}
