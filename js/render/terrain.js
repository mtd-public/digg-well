// The well's terrain: one merged mesh per story, rebuilt when a block in it changes.
// Faces only where a solid cell meets air; per-vertex ambient occlusion darkens corners (it reads as
// a cartoon's soft contact shadow). Tiles are painted on a canvas atlas, ink-bordered.
import * as THREE from 'three';
import { B, SOLID } from '../sim/grid.js';
import { cutaway, prng } from './materials.js';

const TILE = 64, COLS = 4, ROWS = 4, SIZE = TILE * COLS;
// tile index per block: [top, side, bottom]
const TILES = {
  [B.DIRT]: [0, 1, 1], [B.CLAY]: [2, 3, 3], [B.OIL]: [4, 4, 4], [B.GOLD]: [5, 5, 5], [B.ROCK]: [6, 7, 7],
  [B.PLANK]: [8, 8, 8], [B.COLLAR]: [9, 7, 7], [B.STONE]: [10, 11, 11], [B.PIPE]: [12, 12, 12], [B.WOOD]: [13, 14, 14],
};
// per-depth tint (multiplies the atlas): the well gets colder and darker as you go
const TINT = [[1.0, 0.96, 0.9], [0.86, 0.9, 1.0], [0.78, 0.74, 0.86], [1.0, 0.78, 0.72], [0.62, 0.58, 0.8], [1, 1, 1]];

function paintAtlas() {
  const c = document.createElement('canvas');
  c.width = c.height = SIZE;
  const g = c.getContext('2d');
  const R = prng(77);
  const tile = (i, fn) => { const x = (i % COLS) * TILE, y = Math.floor(i / COLS) * TILE; g.save(); g.translate(x, y); g.beginPath(); g.rect(0, 0, TILE, TILE); g.clip(); fn(g); g.restore(); };
  const ink = (col = '#140a08', w = 3) => { g.strokeStyle = col; g.lineWidth = w; g.strokeRect(w / 2, w / 2, TILE - w, TILE - w); };
  const blobs = (n, cols, rmin, rmax) => { for (let k = 0; k < n; k++) { g.fillStyle = cols[Math.floor(R() * cols.length)]; g.beginPath(); g.ellipse(R() * TILE, R() * TILE, rmin + R() * (rmax - rmin), rmin * 0.7 + R() * (rmax - rmin) * 0.6, R() * 3, 0, Math.PI * 2); g.fill(); } };
  const pebbles = (n, col, rim) => { for (let k = 0; k < n; k++) { const x = 6 + R() * 52, y = 6 + R() * 52, r = 2 + R() * 3.5; g.fillStyle = col; g.strokeStyle = rim; g.lineWidth = 1.5; g.beginPath(); g.ellipse(x, y, r * 1.3, r, R() * 3, 0, Math.PI * 2); g.fill(); g.stroke(); } };
  const bevel = (hi, lo) => { g.fillStyle = hi; g.fillRect(3, 3, TILE - 6, 4); g.fillStyle = lo; g.fillRect(3, TILE - 7, TILE - 6, 4); };
  // 0 dirt top
  tile(0, () => { g.fillStyle = '#6a4329'; g.fillRect(0, 0, TILE, TILE); blobs(14, ['#5a3820', '#74492c', '#4e301c'], 4, 10); pebbles(4, '#8a6a52', '#2a1a10'); g.strokeStyle = '#3a2214'; g.lineWidth = 2; g.beginPath(); g.moveTo(12, 40); g.lineTo(22, 34); g.lineTo(30, 38); g.stroke(); ink(); });
  // 1 dirt side
  tile(1, () => { g.fillStyle = '#5b3a24'; g.fillRect(0, 0, TILE, TILE); g.fillStyle = '#4a2e1c'; for (let y = 12; y < TILE; y += 16) g.fillRect(0, y, TILE, 5); blobs(10, ['#4e301c', '#684227'], 3, 8); pebbles(3, '#7a5a44', '#2a1a10'); bevel('#7a5236', '#3a2214'); ink(); });
  // 2 clay top, 3 clay side
  tile(2, () => { g.fillStyle = '#9a4e34'; g.fillRect(0, 0, TILE, TILE); blobs(12, ['#8a422a', '#a8603e'], 4, 9); ink('#2a0e08'); });
  tile(3, () => { g.fillStyle = '#8a4430'; g.fillRect(0, 0, TILE, TILE); for (let y = 6; y < TILE; y += 11) { g.fillStyle = y % 22 ? '#9c5238' : '#743624'; g.fillRect(0, y, TILE, 5); } bevel('#b06a48', '#5a2416'); ink('#2a0e08'); });
  // 4 oil sand: black, glossy streaks
  tile(4, () => { g.fillStyle = '#1c1820'; g.fillRect(0, 0, TILE, TILE); blobs(10, ['#24202a', '#15121a'], 5, 12); g.strokeStyle = '#4a4260'; g.lineWidth = 2.5; for (let k = 0; k < 4; k++) { const x = R() * 50 + 6, y = R() * 50 + 6; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 6, y - 4, x + 12, y + 2); g.stroke(); } g.fillStyle = '#8a80a8'; for (let k = 0; k < 3; k++) g.fillRect(R() * 56 + 4, R() * 56 + 4, 3, 2); ink('#06040a'); });
  // 5 gold vein: dirt with fat gold nuggets
  tile(5, () => { g.fillStyle = '#5b3a24'; g.fillRect(0, 0, TILE, TILE); blobs(8, ['#4e301c', '#684227'], 3, 8); for (let k = 0; k < 6; k++) { const x = 8 + R() * 48, y = 8 + R() * 48, r = 4 + R() * 4; g.fillStyle = '#ffc93a'; g.strokeStyle = '#3a2208'; g.lineWidth = 2; g.beginPath(); for (let a = 0; a < 6; a++) { const rr = r * (0.75 + R() * 0.45); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); g.stroke(); g.fillStyle = '#fff4b0'; g.fillRect(x - r * 0.4, y - r * 0.5, 2.5, 2.5); } ink(); });
  // 6 rock top, 7 rock side: the well's bedrock, chunky bricks
  const rock = (top) => { g.fillStyle = '#2c2836'; g.fillRect(0, 0, TILE, TILE); g.strokeStyle = '#0e0b14'; g.lineWidth = 3; const rows = top ? 2 : 3; for (let r = 0; r < rows; r++) { const y = (r * TILE) / rows; g.strokeRect(0, y, TILE, TILE / rows); const off = r % 2 ? TILE / 2 : TILE / 4; g.beginPath(); g.moveTo(off, y); g.lineTo(off, y + TILE / rows); g.moveTo(off + TILE / 2, y); g.lineTo(off + TILE / 2, y + TILE / rows); g.stroke(); } g.fillStyle = '#3c3848'; for (let k = 0; k < 6; k++) g.fillRect(R() * 58, R() * 58, 6, 3); ink('#08060c', 4); };
  tile(6, () => rock(true)); tile(7, () => rock(false));
  // 8 planks: a boarded-up tunnel (an optional side path): pale boards, a cross brace, nails
  tile(8, () => { g.fillStyle = '#2a1a10'; g.fillRect(0, 0, TILE, TILE); for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#c89a5a' : '#b88a4c'; g.fillRect(2, 2 + k * 15.5, TILE - 4, 13); g.fillStyle = '#e0b878'; g.fillRect(2, 2 + k * 15.5, TILE - 4, 2); } g.save(); g.translate(32, 32); g.rotate(-0.7); g.fillStyle = '#a07040'; g.fillRect(-40, -6, 80, 12); g.strokeStyle = '#2a1a10'; g.lineWidth = 2; g.strokeRect(-40, -6, 80, 12); g.restore(); g.fillStyle = '#d8d8e0'; for (const [x, y] of [[8, 8], [56, 8], [8, 56], [56, 56], [32, 32]]) g.fillRect(x - 1.5, y - 1.5, 3, 3); ink('#1a0e06'); });
  // 9 collar top: hazard stripes (the way down)
  tile(9, () => { g.fillStyle = '#ffc93a'; g.fillRect(0, 0, TILE, TILE); g.fillStyle = '#16121c'; for (let i = -2; i < 4; i++) { g.beginPath(); g.moveTo(i * 22, 0); g.lineTo(i * 22 + 11, 0); g.lineTo(i * 22 + 11 + TILE, TILE); g.lineTo(i * 22 + TILE, TILE); g.fill(); } g.fillStyle = '#6a6478'; for (const [x, y] of [[6, 6], [58, 6], [6, 58], [58, 58]]) { g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); } ink('#16121c', 4); });
  // 10 boardroom carpet, 11 boardroom wood panelling with gold trim
  tile(10, () => { g.fillStyle = '#5a1420'; g.fillRect(0, 0, TILE, TILE); g.strokeStyle = '#7a2030'; g.lineWidth = 2; for (let k = 0; k < TILE; k += 16) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 8, 8); g.lineTo(k, 16); g.stroke(); } g.fillStyle = '#c8a040'; g.fillRect(0, 30, TILE, 3); ink('#22060c', 2); });
  tile(11, () => { g.fillStyle = '#4a2a18'; g.fillRect(0, 0, TILE, TILE); g.fillStyle = '#5a3420'; g.fillRect(8, 8, 48, 40); g.strokeStyle = '#2a160c'; g.lineWidth = 3; g.strokeRect(8, 8, 48, 40); g.fillStyle = '#d0a848'; g.fillRect(0, 54, TILE, 4); g.fillRect(0, 0, TILE, 2); ink('#1a0c06', 2); });
  // 12 pipe steel: riveted plate with a pipe band
  tile(12, () => { g.fillStyle = '#5a6070'; g.fillRect(0, 0, TILE, TILE); g.fillStyle = '#7a8090'; g.fillRect(0, 22, TILE, 20); g.fillStyle = '#3a4050'; g.fillRect(0, 40, TILE, 3); g.fillStyle = '#9a5a3a'; for (let k = 0; k < 5; k++) g.fillRect(R() * 56, R() * 56, 5, 4); g.fillStyle = '#c8ccd8'; for (let x = 6; x < TILE; x += 13) { g.beginPath(); g.arc(x, 6, 2, 0, 7); g.arc(x, 58, 2, 0, 7); g.fill(); } ink('#16181e', 3); });
  // 13 timber top, 14 timber side
  tile(13, () => { for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#8a5a32' : '#7a4e2a'; g.fillRect(0, k * 16, TILE, 16); g.fillStyle = '#4a2c14'; g.fillRect(0, k * 16 + 14, TILE, 2); } g.fillStyle = '#c8ccd8'; for (let k = 0; k < 4; k++) { g.fillRect(6, k * 16 + 6, 3, 3); g.fillRect(55, k * 16 + 6, 3, 3); } ink('#2a1608'); });
  tile(14, () => { g.fillStyle = '#6a4224'; g.fillRect(0, 0, TILE, TILE); g.strokeStyle = '#4a2c14'; g.lineWidth = 2; for (let y = 8; y < TILE; y += 9) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(20, y + 3, 40, y - 3, TILE, y); g.stroke(); } ink('#2a1608'); });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
  return t;
}

// face definitions: normal, the 4 corners (unit cube), and the two in-plane axes for AO
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], u: [0, 0, -1], v: [0, 1, 0], k: 1 },
  { n: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], u: [0, 0, 1], v: [0, 1, 0], k: 1 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], u: [1, 0, 0], v: [0, 0, -1], k: 0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], u: [1, 0, 0], v: [0, 0, 1], k: 2 },
  { n: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], u: [1, 0, 0], v: [0, 1, 0], k: 1 },
  { n: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], u: [-1, 0, 0], v: [0, 1, 0], k: 1 },
];
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];

export class Terrain {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.atlas = paintAtlas();
    this.mat = new THREE.MeshToonMaterial({ map: this.atlas, vertexColors: true, side: THREE.DoubleSide, gradientMap: rampTex() });
    cutaway(this.mat, { caps: true, edge: true, glow: true });
    this.meshes = new Map(); // story index → mesh
    this.group = new THREE.Group();
    scene.add(this.group);
  }

  dispose() { for (const m of this.meshes.values()) m.geometry.dispose(); this.group.removeFromParent(); this.mat.dispose(); this.atlas.dispose(); }

  // build the stories near `si` (one above, three below), rebuild dirty ones, hide the rest
  update(si) {
    const w = this.world;
    for (const i of w.dirty) { const m = this.meshes.get(i); if (m) { m.geometry.dispose(); m.removeFromParent(); this.meshes.delete(i); } }
    w.dirty.clear();
    const lo = si - 1, hi = si + 3;
    for (let i = Math.max(0, lo); i <= Math.min(w.lv.stories.length - 1, hi); i++) if (!this.meshes.has(i)) this.build(i);
    for (const [i, m] of this.meshes) {
      m.visible = i >= lo && i <= hi;
      if (i < lo - 2 || i > hi + 3) { m.geometry.dispose(); m.removeFromParent(); this.meshes.delete(i); }
    }
  }

  build(i) {
    const w = this.world, g = w.grid, s = w.lv.stories[i];
    const y0 = s.y0, y1 = s.top - 1 + (i === 0 ? w.lv.NY - s.top : 0);
    const pos = [], nor = [], uv = [], col = [], glow = [], idx = [];
    const tint = TINT[s.depth] || TINT[0];
    const solid = (x, y, z) => SOLID[g.get(x, y, z)] === 1;
    const inset = 2 / SIZE;
    for (let y = y0; y <= y1; y++) for (let z = 0; z < g.nz; z++) for (let x = 0; x < g.nx; x++) {
      const b = g.get(x, y, z);
      if (!SOLID[b]) continue;
      const tl = TILES[b] || TILES[B.ROCK];
      const cracked = g.dmg.get(g.idx(x, y, z)) ? 0.72 : 1;
      for (const f of FACES) {
        const nx = x + f.n[0], ny = y + f.n[1], nz = z + f.n[2];
        if (!g.in(nx, ny, nz) || solid(nx, ny, nz)) continue;
        const ti = tl[f.k], tu = (ti % COLS) / COLS, tv = 1 - (Math.floor(ti / COLS) + 1) / ROWS;
        const base = pos.length / 3;
        for (let k = 0; k < 4; k++) {
          const c = f.c[k];
          pos.push(x + c[0], y + c[1], z + c[2]);
          nor.push(f.n[0], f.n[1], f.n[2]);
          const [a, bb] = UVS[k];
          uv.push(tu + inset + a * (1 / COLS - 2 * inset), tv + inset + bb * (1 / ROWS - 2 * inset));
          // AO: the two in-plane neighbours of this corner and the diagonal, one step out along the normal
          const su = (c[0] - 0.5) * 2 * f.u[0] + (c[1] - 0.5) * 2 * f.u[1] + (c[2] - 0.5) * 2 * f.u[2] > 0 ? 1 : -1;
          const sv = (c[0] - 0.5) * 2 * f.v[0] + (c[1] - 0.5) * 2 * f.v[1] + (c[2] - 0.5) * 2 * f.v[2] > 0 ? 1 : -1;
          const ox = nx + f.u[0] * su, oy = ny + f.u[1] * su, oz = nz + f.u[2] * su;
          const px = nx + f.v[0] * sv, py = ny + f.v[1] * sv, pz = nz + f.v[2] * sv;
          const s1 = solid(ox, oy, oz) ? 1 : 0, s2 = solid(px, py, pz) ? 1 : 0;
          const s3 = solid(nx + f.u[0] * su + f.v[0] * sv, ny + f.u[1] * su + f.v[1] * sv, nz + f.u[2] * su + f.v[2] * sv) ? 1 : 0;
          const ao = s1 && s2 ? 0 : 3 - s1 - s2 - s3;
          const shade = (0.42 + ao * 0.193) * cracked * (f.n[1] < 0 ? 0.7 : 1);
          col.push(tint[0] * shade, tint[1] * shade, tint[2] * shade);
          glow.push(b === B.GOLD ? 0.55 : b === B.COLLAR && f.k === 0 ? 0.35 : 0);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('aGlow', new THREE.Float32BufferAttribute(glow, 1));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, this.mat);
    m.matrixAutoUpdate = false;
    this.group.add(m);
    this.meshes.set(i, m);
    return m;
  }
}

let _ramp = null;
function rampTex() {
  if (_ramp) return _ramp;
  const d = new Uint8Array([70, 70, 70, 255, 140, 140, 140, 255, 210, 210, 210, 255, 255, 255, 255, 255]);
  _ramp = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  _ramp.magFilter = _ramp.minFilter = THREE.NearestFilter; _ramp.needsUpdate = true;
  return _ramp;
}
