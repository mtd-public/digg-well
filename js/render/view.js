// The three.js view: scene, the pulled-out isometric camera (dr-mow), the cutaway, lights (the
// Tycoon's carbide lamp, a fill, a pool of five for lanterns / flares / fire), decor, and the
// glue to terrain, actors and fx. Implements resize / update(world, dt, t) / dispose; owns no
// game state (house rule 1).
import * as THREE from 'three';
import { T, DEPTHS } from '../sim/tuning.js';
import { B } from '../sim/grid.js';
import { lightsNear } from '../sim/world.js';
import { Terrain } from './terrain.js';
import { Actors } from './actors.js';
import { FX } from './fx.js';
import { CUT, glowMat } from './materials.js';
import * as P from './props.js';

export const CAM = { yaw: Math.PI / 4, pitch: THREE.MathUtils.degToRad(56), fov: 32 };
const BG = 0x07050b;
const POOL = 5;
const BLOCK_COL = { [B.DIRT]: 0x6a4329, [B.CLAY]: 0x9a4e34, [B.OIL]: 0x1c1820, [B.GOLD]: 0xffc93a, [B.PLANK]: 0xc89a5a, [B.WOOD]: 0x8a5a32 };
const LIGHT_K = {
  lantern: [0xffb060, 9, 8.5], brazier: [0xffc880, 14, 11], flare: [0xff5040, 16, 10], fire: [0xff7a2a, 9, 7],
  fireball: [0xff8a3a, 4, 4.5], ember: [0xff9a3a, 2.5, 3.5], vent: [0xff6a1a, 10, 7], vat: [0xff8a3a, 5, 5.5],
};
const BEACON_COL = [0x7ad8ff, 0x9aff7a, 0xffb04a, 0xff5a8a, 0xffd040];

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: /[?&]capture/.test(location.search) });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, +(new URLSearchParams(location.search).get('dpr') || 2)));
    r.setClearColor(BG);
    this.r = r;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(BG, 18, 40);
    this.camera = new THREE.PerspectiveCamera(CAM.fov, 1, 0.5, 120);
    this.hemi = new THREE.HemisphereLight(0x6a5a8a, 0x1a1008, 0.9);
    this.scene.add(this.hemi);
    // the carbide lamp on the bowler: a warm cone ahead and down, plus a soft fill round the Tycoon
    this.lamp = new THREE.SpotLight(0xffdca0, 40, 13, 0.75, 0.55, 1.1);
    this.scene.add(this.lamp, this.lamp.target);
    this.fill = new THREE.PointLight(0xffc890, 7, 6.5, 1.1);
    this.scene.add(this.fill);
    this.pool = Array.from({ length: POOL }, () => { const l = new THREE.PointLight(0xffb060, 0, 8, 1.1); this.scene.add(l); return l; });
    this.lightBuf = [];
    this.focus = new THREE.Vector3();
    this.camPos = new THREE.Vector3();
    this.lookY = 0;
    this.dark = 0;
    this.dist = 22;
    this.mode = 'play';
    this.t = 0;
  }

  setWorld(w) {
    this.dispose(true);
    this.w = w;
    this.terrain = new Terrain(this.scene, w);
    this.fx = new FX(this.scene);
    this.actors = new Actors(this.scene, w, this.fx);
    this.buildDecor(w);
    const p = w.player;
    this.focus.set(p.x, p.y + 0.5, p.z);
    this.lookY = p.y;
  }

  dispose(keepRenderer) {
    this.terrain?.dispose(); this.actors?.dispose(); this.fx?.dispose();
    this.decor?.forEach((g) => g.removeFromParent());
    this.decor = null;
    if (!keepRenderer) this.r.dispose();
  }

  // ------------------------------------------------------------------ decor (static: lanterns, signs, frames, the Boardroom)
  buildDecor(w) {
    const lv = w.lv, st = lv.stories;
    this.decor = st.map(() => { const g = new THREE.Group(); this.scene.add(g); return g; });
    const at = (y) => this.decor[Math.max(0, Math.min(st.length - 1, storyIndex(st, y)))];
    const face = (o, nx, nz) => { o.rotation.y = Math.atan2(nx, nz); };
    this.lanterns = w.lanterns.map((l) => {
      const m = P.makeLantern({ post: l.post, brazier: l.brazier });
      m.position.set(l.x, l.y - (l.post || l.brazier ? 0 : 0.3), l.z);
      if (!l.post && !l.brazier) face(m, l.nx, l.nz);
      at(l.y).add(m);
      return { l, m, globe: m.userData.globe, lit: null };
    });
    for (const s of lv.signs) { const m = P.makeSign(s.text, s.sub); m.position.set(s.x, s.y, s.z); face(m, s.nx, s.nz); at(s.y).add(m); }
    for (const d of lv.decor) {
      let m = null;
      switch (d.type) {
        case 'timber': m = P.makeTimber(); face(m, d.dx, d.dz); m.rotation.y += Math.PI / 2 * 0; m.position.set(d.x, d.y, d.z); m.rotation.y = Math.atan2(d.dx, d.dz) + Math.PI / 2; break;
        case 'counter': m = P.makeCounter(); m.position.set(d.x, d.y, d.z); m.rotation.y = Math.atan2(d.dx, d.dz) + Math.PI / 2; break;
        case 'shopsign': m = P.makeShopSign(); m.position.set(d.x, d.y, d.z); face(m, d.dx, d.dz); break;
        case 'case': m = P.makeCase(); m.position.set(d.x, d.y, d.z); this.shovelCase = m; break;
        case 'chair': m = P.makeChair(d.big); m.position.set(d.x, d.y, d.z); m.rotation.y = d.face; break;
        case 'chart': m = P.makeChart(); m.position.set(d.x, d.y, d.z); face(m, d.dx, d.dz); break;
        case 'portrait': m = P.makePortrait(); m.position.set(d.x, d.y, d.z); face(m, d.dx, d.dz); break;
        case 'plant': m = P.makePlant(); m.position.set(d.x, d.y, d.z); break;
        case 'cooler': m = P.makeSpittoon(); m.position.set(d.x, d.y, d.z); break;
        case 'rope': m = P.makeRope(); m.position.set(d.x, d.y, d.z); break;
        case 'poster': m = P.makePoster(d.gag); m.position.set(d.x, d.y, d.z); face(m, d.dx, d.dz); break;
      }
      if (m) at(d.y + 0.5).add(m);
    }
    // timber shoring on plain stretches of wall (looks only), deterministic per story
    const g = w.grid;
    st.forEach((s, i) => {
      if (s.kind === 'shrine') return;
      for (let side = 0; side < 4; side++) for (const v of [T.W0 + 2.5, T.W0 + 6.5, T.W0 + 10.5]) {
        if (((i * 7 + side * 3 + v * 13) | 0) % 3 === 0) continue;
        const [nx, nz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][side];
        const wx = side === 0 ? T.W0 : side === 1 ? T.W1 + 1 : v, wz = side === 2 ? T.W0 : side === 3 ? T.W1 + 1 : v;
        const cx = Math.floor(wx - (nx < 0 ? 1 : 0) + nx * 0.5), cz = Math.floor(wz - (nz < 0 ? 1 : 0) + nz * 0.5);
        let ok = true;
        for (let k = -1; k <= 1 && ok; k++) for (let yy = s.floorTop; yy < s.floorTop + 3; yy++) {
          const x = side < 2 ? cx : cx + k, z = side < 2 ? cz + k : cz;
          if (g.get(x, yy, z) !== B.AIR) ok = false;
          const bx = side < 2 ? x - nx : x, bz = side < 2 ? z : z - nz;
          if (g.get(bx, yy, bz) === B.AIR) ok = false;
        }
        if (!ok || g.get(cx, s.floorTop - 1, cz) === B.AIR) continue;
        const h = Math.min(4.6, s.top - s.floorTop - 0.4);
        const m = P.makeShoring(h);
        m.position.set(wx + nx * 0.12, s.floorTop, wz + nz * 0.12);
        m.rotation.y = Math.atan2(nx, nz);
        this.decor[i].add(m);
      }
    });
    // the way down: a beacon over each depth's collar hole, in the colour of the depth below
    this.beacons = [];
    st.forEach((s, i) => {
      if (s.floor !== 'collar') return;
      const h = s.holes[0];
      const b = P.makeBeacon(h.x1 - h.x0 + 1, BEACON_COL[s.depth] || 0xffc93a);
      b.position.set((h.x0 + h.x1 + 1) / 2, s.floorTop + 0.02, (h.z0 + h.z1 + 1) / 2);
      this.decor[i].add(b);
      this.beacons.push(b);
    });
    // the derrick over the well mouth
    const der = P.makeDerrick();
    der.position.set((T.W0 + T.W1 + 1) / 2, st[0].top, (T.W0 + T.W1 + 1) / 2);
    this.decor[0].add(der);
  }

  resize(w, h) {
    this.cw = w; this.ch = h;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    const tan = 2 * Math.tan(THREE.MathUtils.degToRad(CAM.fov / 2));
    // keep about 9.2 m tall in landscape and 8.2 m wide in portrait in view (dr-mow's pulled-out iso)
    this.dist = Math.max(13, Math.min(30, Math.max(9.2 / tan, 8.2 / (tan * Math.min(1, this.camera.aspect)))));
    this.scene.fog.near = this.dist - 2; this.scene.fog.far = this.dist + 16;
  }

  onEvent(e) {
    const fx = this.fx;
    if (!fx) return;
    switch (e.type) {
      case 'dig': fx.dirt(e.x, e.y, e.z, BLOCK_COL[e.b] ?? 0x6a4329, 12); if (e.b === B.GOLD) fx.coins(e.x, e.y, e.z, 8); break;
      case 'crack': fx.dirt(e.x, e.y, e.z, BLOCK_COL[e.b] ?? 0x6a4329, 4); break;
      case 'clank': fx.sparks(e.x, e.y, e.z, 6); break;
      case 'boom': fx.boom(e.x, e.y, e.z, e.r); break;
      case 'shotgun': for (const [x, y, z] of e.tracers) fx.tracer(e.x, e.y, e.z, x, y, z); fx.sparks(e.x, e.y, e.z, 6, 0xffe0a0); fx.smoke(e.x, e.y, e.z, 2); break;
      case 'hit': if (e.kind === 'worker') fx.oil(e.x, e.y, e.z, 6); else fx.sparks(e.x, e.y, e.z, 5, 0xffffff); break;
      case 'kill': if (e.ko) { fx.oil(e.x, e.y + 0.5, e.z, 14); fx.stars(e.x, e.y + 0.8, e.z, 6); } else fx.burst(12, 'goo', e.x, e.y + 0.3, e.z, { color: e.kind === 'imp' ? 0xe8402a : e.kind === 'beetle' ? 0x6a5a9a : 0x3a2a4a, speed: 3, up: 3, size: 0.07, life: 0.6 }); break;
      case 'stomp': fx.burst(8, 'dust', e.x, e.y, e.z, { color: 0x8a7a6a, speed: 3, up: 0.8, size: 0.08, life: 0.4, grav: 2 }); fx.stars(e.x, e.y + 0.2, e.z, 3); break;
      case 'gold': fx.coins(e.x, e.y + 0.2, e.z, 3); break;
      case 'land': if (e.v > 8) fx.burst(6, 'dust', e.x, e.y + 0.05, e.z, { color: 0x6a5a4a, speed: 2.2, up: 0.6, size: 0.07, life: 0.35, grav: 2 }); break;
      case 'crate': case 'planks': fx.burst(14, 'wood', e.x, e.y, e.z, { color: 0xa07040, speed: 3.5, up: 4, size: 0.09, life: 0.9 }); break;
      case 'shatter': fx.dirt(e.x, e.y, e.z, 0x4a4250, 16); break;
      case 'piggyBreak': fx.burst(16, 'shard', e.x, e.y + 0.3, e.z, { color: 0xff9ac0, speed: 3, up: 4, size: 0.08, life: 0.9 }); fx.coins(e.x, e.y + 0.3, e.z, 8); break;
      case 'piggySaved': fx.confetti(e.x, e.y + 0.5, e.z, 40); fx.gold(e.x, e.y + 0.5, e.z, 24); break;
      case 'washed': fx.burst(14, 'water', e.x, e.y + 0.6, e.z, { glow: true, color: 0x9ae0ff, speed: 2.5, up: 3, size: 0.05, life: 0.6, grav: 8 }); fx.gold(e.x, e.y + 0.8, e.z, 8); break;
      case 'reveal': fx.gold(e.x, e.y + 1, e.z, 80); fx.confetti(e.x, e.y + 1, e.z, 60); break;
      case 'bossDown': fx.gold(e.x, e.y + 1.5, e.z, 90); fx.boom(e.x, e.y + 1, e.z, 3); break;
      case 'poof': fx.smoke(e.x, e.y + 0.3, e.z, 6); fx.sparks(e.x, e.y + 0.3, e.z, 6, 0xff5a3a); break;
      case 'ignite': case 'burst': fx.fire(e.x, e.y + 0.5, e.z, 10); break;
      case 'lantern': fx.sparks(e.x, e.y + 0.15, e.z, 10, 0xffd080); break;
      case 'golden': fx.gold(e.x, e.y + 0.6, e.z, 40); break;
      case 'enemyShot': fx.sparks(e.x + Math.sin(e.face) * 0.6, e.y, e.z + Math.cos(e.face) * 0.6, 10, 0xffe0a0); fx.smoke(e.x + Math.sin(e.face) * 0.6, e.y, e.z + Math.cos(e.face) * 0.6, 3); break;
      case 'fizzle': fx.smoke(e.x, e.y, e.z, 2); if (e.fire) fx.fire(e.x, e.y, e.z, 4); break;
      case 'bossSlam': fx.boom(e.x, e.y + 0.2, e.z, 2); break;
      case 'snap': fx.burst(8, 'wood', e.x, e.y + 0.6, e.z, { color: 0x8a5a32, speed: 2, up: 3, size: 0.06, life: 0.7 }); break;
    }
  }

  toScreen(x, y, z, out) {
    const v = (this._v ||= new THREE.Vector3()).set(x, y, z).project(this.camera);
    out.x = (v.x * 0.5 + 0.5) * this.cw; out.y = (-v.y * 0.5 + 0.5) * this.ch; out.on = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    return out;
  }

  update(w, dt, t, { attract = false } = {}) {
    if (!this.terrain) return;
    this.t = t;
    const p = w.player;
    const st = w.lv.stories[w.storyIdx];
    // camera: follow, lead below while falling, frame a little wider in the Boardroom
    const lead = Math.max(0, Math.min(2.4, -p.vy * 0.13));
    const tx = p.x, ty = p.y + 0.5 - lead, tz = p.z;
    const k = 1 - Math.exp(-dt * (attract ? 1.5 : 7));
    this.focus.x += (tx - this.focus.x) * k; this.focus.z += (tz - this.focus.z) * k;
    this.focus.y += (ty - this.focus.y) * (1 - Math.exp(-dt * (p.vy < -4 ? 10 : 6)));
    const boss = st.kind === 'shrine';
    const dist = this.dist * (boss ? 1.18 : 1) * (attract ? 1.15 : 1);
    const yaw = CAM.yaw + (attract ? Math.sin(t * 0.15) * 0.35 : 0);
    const off = new THREE.Vector3(Math.sin(yaw) * Math.cos(CAM.pitch), Math.sin(CAM.pitch), Math.cos(yaw) * Math.cos(CAM.pitch));
    const shake = w.shake * 0.35;
    this.camera.position.copy(this.focus).addScaledVector(off, dist).add(new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
    this.camera.lookAt(this.focus);
    // the cutaway follows the Tycoon (not the camera's lead)
    CUT.uFocus.value.set(p.x, p.y + 0.4, p.z);
    CUT.uCamDir.value.copy(off).normalize();
    CUT.uCut.value = boss ? 3.6 : attract ? 3.4 : 2.7;
    CUT.uRadius.value = 2.1;
    CUT.uTime.value = t;
    this.terrain.update(w.storyIdx);
    const lo = w.storyIdx - 1, hi = w.storyIdx + 3;
    this.decor.forEach((g, i) => { g.visible = i >= lo && i <= hi; });
    this.actors.update(w, dt, t, p, 0);
    this.actors.syncHazards(w, p.y, t, dt);
    this.fx.update(dt);
    // the beacons breathe
    for (const b of this.beacons) { const u = b.userData; u.beam.material.opacity = 0.14 + Math.sin(t * 2.2) * 0.06; u.ring.material.opacity = 0.55 + Math.sin(t * 4) * 0.25; u.ring.scale.setScalar(1 + Math.sin(t * 2) * 0.05); if (b.parent.visible && Math.random() < dt * 14) this.fx.burst(1, 'mote', b.position.x + (Math.random() - 0.5) * 2.4, b.position.y + 2.5, b.position.z + (Math.random() - 0.5) * 2.4, { glow: true, color: u.ring.material.color.getHex(), speed: 0.2, up: -1.5, size: 0.05, life: 1.6, grav: 1.2 }); }
    if (this.shovelCase) { const sh = w.ents.find((e) => e.kind === 'goldenShovel'); const open = !sh || !sh.locked; this.shovelCase.position.y += ((open ? st.floorTop + 2.2 : w.lv.shrine.floorTop + 1) - this.shovelCase.position.y) * Math.min(1, dt * 2); }
    // lanterns: lit or not
    for (const L of this.lanterns) {
      if (L.lit !== L.l.lit) { L.lit = L.l.lit; L.globe.material = L.lit ? glowMat(0xffd890) : glowMat(0x2a2018); }
    }
    this.light(w, dt, t, st);
    this.r.render(this.scene, this.camera);
  }

  light(w, dt, t, st) {
    const p = w.player;
    const darkT = st.dark ? 1 : 0;
    this.dark += (darkT - this.dark) * Math.min(1, dt * 2.5);
    const big = p.upgrades.has('lamp') ? 1.7 : 1;
    const dim = 1 - this.dark * (1 - T.DARK_LAMP);
    const flicker = 1 - (p.iframes > 0 ? Math.random() * 0.5 : 0) - this.dark * (Math.random() < 0.05 ? 0.4 : 0);
    const shrine = st.kind === 'shrine';
    this.hemi.intensity = (shrine ? 1.2 : 0.85) * (1 - this.dark * 0.97);
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    this.lamp.position.set(p.x + fx * 0.2, p.y + 1.3, p.z + fz * 0.2);
    this.lamp.target.position.set(p.x + fx * 4, p.y - 1.2, p.z + fz * 4);
    this.lamp.intensity = 46 * dim * flicker * (p.golden > 0 ? 1.4 : 1);
    this.lamp.distance = 13 * big * (0.25 + 0.75 * dim);
    this.fill.position.set(p.x, p.y + 1.7, p.z);
    this.fill.intensity = 8 * (0.22 + 0.78 * dim) * (p.burn > 0 ? 2 : 1);
    this.fill.distance = 7 * big * (0.32 + 0.68 * dim);
    this.fill.color.setHex(p.golden > 0 ? 0xffe070 : p.burn > 0 ? 0xff7a3a : 0xffc890);
    // the pool: nearest lit sources
    const L = lightsNear(w, p.x, p.y, p.z, this.lightBuf);
    // no shadows, so light would pass through floors: only this story's sources (and a little below, through a hole)
    for (const q of L) q.d = (q.x - p.x) ** 2 + ((q.y - p.y) * 1.6) ** 2 + (q.z - p.z) ** 2 + (q.y < st.y0 - 1.5 || q.y > st.top + 0.5 ? 1e4 : 0);
    L.sort((a, b) => a.d - b.d);
    for (let i = 0; i < POOL; i++) {
      const l = this.pool[i], q = L[i];
      if (!q || q.d > 1e4) { l.intensity = 0; continue; }
      const [col, I, D] = LIGHT_K[q.k] || LIGHT_K.lantern;
      l.color.setHex(col);
      l.position.set(q.x, q.y, q.z);
      let f = 1;
      if (q.k === 'flare' || q.k === 'fire') f = 0.8 + Math.random() * 0.35;
      if (q.k === 'vent') f = q.blast > 0 ? 1.3 : q.warn * 0.6;
      if (q.k === 'lantern') f = 0.95 + Math.sin(t * 7 + i) * 0.05;
      l.intensity = I * f;
      l.distance = D;
    }
  }
}

function storyIndex(st, y) { for (let i = 0; i < st.length; i++) if (y >= st[i].y0 && y < st[i].top) return i; return y >= st[0].top ? 0 : st.length - 1; }
