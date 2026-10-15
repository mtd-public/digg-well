// Entities ↔ meshes: makes a model when something comes near, animates it from the world's state,
// drops it when it goes. Coins and bills are two instanced meshes. Renderers own no game state.
import * as THREE from 'three';
import { makeTycoon, makeTool, makeWorker, makeBeetle, makeSnake, makeFly, makeBat, makeImp, makeShopkeeper, makePiggy, makeBoss } from './models.js';
import * as P from './props.js';
import { glowMat, basicCut, toon } from './materials.js';
import { G } from './kit.js';
import { HZ } from '../sim/hazards.js';
import { BOSS } from '../sim/boss.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const MAX_COINS = 500;
const lerpAng = (a, b, k) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * k; };

export class Actors {
  constructor(scene, world, fx) {
    this.scene = scene; this.w = world; this.fx = fx;
    this.root = new THREE.Group(); scene.add(this.root);
    this.map = new Map();
    // the Tycoon
    this.hero = makeTycoon();
    this.root.add(this.hero.group);
    this.heroTool = null; this.heroToolKey = '';
    this.heroFace = Math.PI;
    this.walk = 0;
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), basicCut({ color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.renderOrder = 2;
    this.root.add(this.shadow);
    this.burnGlow = null;
    // money
    this.coins = new THREE.InstancedMesh(P.coinGeo, P.coinMat, MAX_COINS);
    this.bills = new THREE.InstancedMesh(P.billGeo, P.billMat, 200);
    for (const im of [this.coins, this.bills]) { im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; im.count = 0; this.root.add(im); }
    // hazards
    this.hz = new Map();
  }

  dispose() { this.root.removeFromParent(); }

  get(e) {
    let a = this.map.get(e.id);
    if (a) return a;
    a = this.make(e);
    if (!a) return null;
    a.e = e; a.seen = true;
    this.root.add(a.obj);
    this.map.set(e.id, a);
    return a;
  }

  make(e) {
    let m, extra = {};
    switch (e.kind) {
      case 'worker': m = makeWorker({ name: e.name, oil: e.oil, look: e.look, side: e.id % 2, saved: e.saved }); extra.saved = !!e.saved; break;
      case 'beetle': m = makeBeetle(); break;
      case 'snake': m = makeSnake(); break;
      case 'fly': m = makeFly(); break;
      case 'bat': m = makeBat(); break;
      case 'imp': m = makeImp(); break;
      case 'shopkeeper': m = makeShopkeeper({ beard: e.beard }); break;
      case 'boss': m = makeBoss(); break;
      case 'piggy': m = makePiggy(); break;
      case 'barrel': return { obj: P.makeBarrel() };
      case 'tnt': { const o = P.makeTNT(); return { obj: o, spark: o.userData.spark }; }
      case 'crate': return { obj: P.makeCrate(e.id % 4 === 0) };
      case 'item': return { obj: e.what === 'gin' ? P.makeGin() : e.what === 'shard' ? P.makeShard() : P.makeFlare(), bob: true };
      case 'weapon': return { obj: P.makeWeaponPickup(e.what), bob: true, ring: true };
      case 'ammo': return { obj: e.what === 'flare' ? P.makeFlare() : P.makeWeaponPickup(e.what === 'bombs' ? 'bombs' : 'shells'), bob: true };
      case 'upgrade': { const g = new THREE.Group(); g.add(P.makePedestal()); const b = P.makeBadge(e.what); b.position.y = 0.2; g.add(b); return { obj: g, spin: b.userData.spin }; }
      case 'ware': {
        const g = new THREE.Group();
        const item = e.ware === 'gin' ? P.makeGin() : e.ware === 'shard' ? P.makeShard() : e.ware === 'flares' ? P.makeFlare() : ['shotgun', 'bombs', 'pickaxe', 'shells'].includes(e.ware) ? P.makeWeaponPickup(e.ware) : P.makeBadge(e.ware === 'upgrade' ? e.what : e.ware);
        g.add(item);
        const tag = P.priceTag(`$${e.price}`); tag.position.set(0, 0.95, 0); g.add(tag);
        return { obj: g, tag, item };
      }
      case 'goldenShovel': { const g = new THREE.Group(); const s = P.makeShard(); s.scale.setScalar(2.4); g.add(s); return { obj: g, spin: s, big: true }; }
      case 'bomb': { const t = makeTool('bombs'); return { obj: t, spark: t.userData.spark }; }
      case 'flare': { const f = P.makeFlare(true); return { obj: f, flame: f.userData.flame }; }
      case 'fireball': { const g = new THREE.Group(); const b = new THREE.Mesh(G.ico(e.big ? 0.22 : 0.14, 1), glowMat(e.src === 'memo' ? 0xff3a1a : 0xff8a2a)); g.add(b); if (e.src === 'memo') { const paper = new THREE.Mesh(G.box(0.26, 0.02, 0.2), toon(0xf4ecd8)); g.add(paper); } return { obj: g, ball: b }; }
      case 'ember': return { obj: new THREE.Mesh(G.ico(0.13, 1), glowMat(0xffb04a)) };
      case 'fire': { const g = new THREE.Group(); return { obj: g, fire: true }; }
      case 'knocked': {
        const k = makeWorker({ name: e.name, oil: e.oil ?? 0.5, look: e.look ?? 0, saved: false });
        if (e.who === 'shopkeeper') { const s = makeShopkeeper(); s.root.rotation.x = -Math.PI / 2; s.group.position.y = 0.2; return { obj: s.group, ko: true }; }
        k.root.rotation.x = -Math.PI / 2; k.root.position.y = 0.17; k.group.rotation.y = e.face || 0;
        return { obj: k.group, ko: true };
      }
      case 'puddle': { const p = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16), basicCut({ color: 0x050308, transparent: true, opacity: 0.85 })); p.rotation.x = -Math.PI / 2; p.position.y = 0.02; const g = new THREE.Group(); g.add(p); return { obj: g }; }
      default: return null;
    }
    return { obj: m.group, m, ...extra };
  }

  drop(id) {
    const a = this.map.get(id);
    if (!a) return;
    a.obj.removeFromParent();
    a.obj.traverse((q) => { if (q.geometry && q.geometry !== P.coinGeo && q.geometry !== P.billGeo && q.isMesh && q.material?.vertexColors) q.geometry.dispose(); });
    this.map.delete(id);
  }

  update(w, dt, t, focus, cutY) {
    this.w = w;
    for (const a of this.map.values()) a.seen = false;
    let nc = 0, nb = 0;
    for (const e of w.ents) {
      if (!e.alive || e.kind === 'hz') continue;
      if (Math.abs(e.y - focus.y) > 12 && !e.boss) continue;
      if (e.kind === 'gold') {
        const spin = (e.spin || 0) + t * 3;
        if (e.y > focus.y + 2.5 || (e.x - focus.x + e.z - focus.z) * 0.707 > 6.5) continue; // above the cut, or right under the camera
        if (e.bill) {
          if (nb >= 200) continue;
          const flutter = e.rest ? 0 : Math.sin(t * 9 + e.id) * 0.6;
          _e.set(e.rest ? -Math.PI / 2 : -Math.PI / 2 + flutter, spin * 0.5, 0);
          _m.compose(_p.set(e.x, e.y + (e.rest ? 0.03 : 0.12), e.z), _q.setFromEuler(_e), _s.set(1, 1, 1));
          this.bills.setMatrixAt(nb++, _m);
        } else {
          if (nc >= MAX_COINS) continue;
          const bob = e.rest || e.float ? 0.16 + Math.sin(t * 2.5 + e.id) * 0.05 : 0.11;
          _e.set(0, spin, 0);
          const s = e.value >= 3 ? 1.25 : 1;
          _m.compose(_p.set(e.x, e.y + bob, e.z), _q.setFromEuler(_e), _s.set(s, s, s));
          this.coins.setMatrixAt(nc++, _m);
        }
        continue;
      }
      const a = this.get(e);
      if (!a) continue;
      a.seen = true; a.e = e;
      this.animate(a, e, dt, t);
      // anything above the cutaway goes with it (glows and sprites aren't cut by the shader)
      if (!e.boss && (e.y > focus.y + 2.5 || (e.x - focus.x + e.z - focus.z) * 0.707 > 6.5)) a.obj.visible = false;
      else if (a.tag) a.tag.visible = !e.carried && Math.hypot(e.x - focus.x, e.z - focus.z) < 7 && Math.abs(e.y - focus.y) < 1.5;
    }
    this.coins.count = nc; this.bills.count = nb;
    this.coins.instanceMatrix.needsUpdate = true; this.bills.instanceMatrix.needsUpdate = true;
    for (const [id, a] of this.map) if (!a.seen) this.drop(id);
    this.updateHero(w, dt, t);
  }

  animate(a, e, dt, t) {
    const o = a.obj;
    o.position.set(e.x, e.y, e.z);
    const m = a.m;
    if (e.enemy || e.kind === 'piggy') {
      a.face = a.face == null ? e.face || 0 : lerpAng(a.face, e.face || 0, Math.min(1, dt * 12));
      o.rotation.y = a.face;
      o.visible = !(e.hurtT > 0 && Math.floor(t * 30) % 2 === 0);
    }
    const sp = Math.hypot(e.vx || 0, e.vz || 0);
    a.ph = (a.ph || 0) + dt * sp * 4.2;
    switch (e.kind) {
      case 'worker': {
        if (e.saved && !a.saved) { // washed: swap in a clean model
          this.drop(e.id); const b = this.get(e); if (b) { b.saved = true; this.animate(b, e, dt, t); }
          return;
        }
        humanoid(m, a.ph, sp, e, t);
        if (e.state === 'windup') { m.armL.rotation.x = m.armR.rotation.x = -2.6; }
        if (e.state === 'grab') { m.armL.rotation.x = m.armR.rotation.x = -1.5; }
        if (e.burning) { if (Math.random() < 0.6) this.fx.fire(e.x + (Math.random() - 0.5) * 0.4, e.y + 0.4 + Math.random() * 0.6, e.z + (Math.random() - 0.5) * 0.4, 1); m.armL.rotation.x = -2.8 + Math.sin(t * 20) * 0.4; m.armR.rotation.x = -2.8 + Math.cos(t * 20) * 0.4; }
        else if (!e.saved && Math.random() < dt * 2) this.fx.burst(1, 'drip', e.x + (Math.random() - 0.5) * 0.3, e.y + 0.7, e.z + (Math.random() - 0.5) * 0.3, { color: 0x0a080c, speed: 0.1, up: 0, size: 0.04, life: 0.6 });
        if (e.saved) m.armL.rotation.x = m.armR.rotation.x = -2.9 + Math.sin(t * 12 + e.id) * 0.3;
        break;
      }
      case 'shopkeeper':
        humanoid(m, a.ph, sp, e, t);
        if (e.state === 'calm') { m.armR.rotation.x = -0.3; m.gun.visible = false; }
        else { m.gun.visible = true; m.armR.rotation.x = e.aim > 0 ? -1.5 : -1.1; m.head.rotation.z = Math.sin(t * 9) * 0.06; }
        break;
      case 'beetle': m.legs.forEach((l, i) => { l.rotation.y = Math.sin(t * 16 + i * 2) * 0.5; }); m.body.position.y = Math.abs(Math.sin(t * 16)) * 0.02; break;
      case 'snake': m.segs.forEach((s, i) => { s.position.x = Math.sin(t * 6 - i * 0.9) * 0.08 * (i ? 1 : 0.3); s.position.y = s.userData.y ??= s.position.y; if (i === 0 && e.state === 'rear') s.position.y = s.userData.y + 0.18; else if (i === 0) s.position.y = s.userData.y; }); m.tongue.visible = Math.sin(t * 8) > 0.3; break;
      case 'fly': m.wings.forEach((w, i) => { w.rotation.z = Math.sin(t * 60) * 0.6 * (i ? 1 : -1); }); o.position.y += 0.1; break;
      case 'bat': {
        const roost = e.state === 'roost';
        o.rotation.z = roost ? Math.PI : 0; o.position.y += roost ? 0.4 : 0.15;
        m.wings.forEach((w, i) => { w.rotation.z = roost ? (i ? -1.2 : 1.2) : Math.sin(t * 24) * 0.9 * (i ? 1 : -1); });
        break;
      }
      case 'imp': {
        m.root.position.y = e.ground ? 0 : 0.04; m.root.scale.set(1, e.ground ? 0.92 + Math.sin(t * 10) * 0.04 : 1.08, 1);
        m.wings.forEach((w, i) => { w.rotation.y = Math.sin(t * 18) * 0.5 * (i ? 1 : -1); });
        m.tail.rotation.y = Math.sin(t * 5) * 0.6;
        break;
      }
      case 'boss': {
        humanoid(m, a.ph * 0.6, sp, e, t);
        m.root.scale.setScalar(2.2);
        const st = e.state;
        if (st === 'volley') { m.armL.rotation.x = -2.4; m.armR.rotation.x = -0.6; }
        if (st === 'summon') { m.armL.rotation.x = m.armR.rotation.x = -2.8; }
        if (st === 'charge') { m.body.rotation.x = e.charging ? 0.55 : 0.3; }
        else m.body.rotation.x = 0;
        if (st === 'stunned') { m.head.rotation.z = Math.sin(t * 10) * 0.25; if (Math.random() < dt * 8) this.fx.stars(e.x, e.y + BOSS.h + 0.2, e.z, 1); }
        if (st === 'slam' && !e.leapt) m.root.scale.y = 2.2 * 0.85;
        if (st === 'dying') { m.root.rotation.z = Math.sin(t * 30) * 0.15; m.root.rotation.y += dt * 9; if (Math.random() < dt * 20) this.fx.sparks(e.x, e.y + 1.2, e.z, 3, 0xff4a2a); }
        m.wing.rotation.y = 0.4 + Math.sin(t * 3) * 0.25;
        m.tail.rotation.y = Math.sin(t * 2.5) * 0.5;
        // the shock rings of a slam
        a.rings ||= [];
        while (a.rings.length < e.rings.length) { const r = new THREE.Mesh(P.RING_GEO, P.ringMat()); this.root.add(r); a.rings.push(r); }
        a.rings.forEach((r, i) => { const R = e.rings[i]; r.visible = R != null; if (R != null) { r.position.set(e.x, e.y + 0.25, e.z); r.scale.set(R, 1, R); r.material.opacity = 0.85 * (1 - R / BOSS.ringMax); } });
        break;
      }
      case 'piggy': {
        o.position.y += e.carried ? 0 : 0;
        m.body.rotation.z = e.carried ? Math.sin(t * 8) * 0.1 : 0;
        m.cracks.forEach((c, i) => { c.visible = e.hp <= e.maxHp - 1 - i; });
        if (e.carried) o.rotation.y = this.heroFace;
        break;
      }
      case 'tnt': if (a.spark) { a.spark.visible = e.fuse > 0; if (e.fuse > 0) { a.spark.scale.setScalar(1 + Math.sin(t * 40) * 0.4); if (Math.random() < 0.5) this.fx.sparks(e.x + 0.09, e.y + 0.85, e.z, 1); } } break;
      case 'barrel': if (e.boom > 0) o.rotation.z = Math.sin(t * 50) * 0.05; break;
      case 'item': case 'weapon': case 'ammo':
        o.position.y += 0.12 + Math.sin(t * 2.4 + e.id) * 0.06; o.rotation.y = t * 1.4 + e.id;
        break;
      case 'upgrade': if (a.spin) a.spin.rotation.z = t * 1.6; o.position.y += 0; break;
      case 'ware': if (a.item) { a.item.position.y = 0.2 + Math.sin(t * 2 + e.id) * 0.04; a.item.rotation.y = t; } break;
      case 'goldenShovel':
        if (a.spin) a.spin.rotation.y = t * 1.2;
        o.position.y += 0.3 + Math.sin(t * 1.5) * 0.08;
        if (!e.locked && Math.random() < dt * 20) this.fx.coins(e.x, e.y + 1, e.z, 1);
        break;
      case 'bomb': o.rotation.set(t * 4, t * 2, 0); if (a.spark && Math.random() < 0.6) this.fx.sparks(e.x, e.y + 0.2, e.z, 1); break;
      case 'flare': if (a.flame) a.flame.scale.setScalar(1 + Math.sin(t * 30) * 0.25); if (Math.random() < 0.8) this.fx.burst(1, 'spark', e.x, e.y + 0.25, e.z, { glow: true, color: 0xff7a6a, speed: 1, up: 2, size: 0.04, life: 0.4, grav: 3 }); break;
      case 'fireball': if (Math.random() < 0.7) this.fx.fire(e.x, e.y, e.z, 1); if (a.ball) a.ball.scale.setScalar(1 + Math.sin(t * 25) * 0.15); break;
      case 'ember': if (Math.random() < 0.4) this.fx.fire(e.x, e.y, e.z, 1); break;
      case 'fire': if (Math.random() < dt * 40) this.fx.fire(e.x + (Math.random() - 0.5) * e.r * 1.6, e.y + 0.1, e.z + (Math.random() - 0.5) * e.r * 1.6, 1); break;
      case 'knocked': if (Math.random() < dt * 5) this.fx.stars(e.x + Math.cos(t * 4) * 0.3, e.y + 0.55, e.z + Math.sin(t * 4) * 0.3, 1); if (e.life < 1.5) o.visible = Math.floor(t * 12) % 2 === 0; break;
      case 'puddle': o.scale.setScalar(Math.min(1, (6 - e.life) * 3) * Math.min(1, e.life)); break;
    }
  }

  updateHero(w, dt, t) {
    const p = w.player, h = this.hero;
    h.group.position.set(p.x, p.y, p.z);
    this.heroFace = lerpAng(this.heroFace, p.face, Math.min(1, dt * 16));
    h.group.rotation.y = this.heroFace;
    const sp = Math.hypot(p.vx, p.vz);
    this.walk += dt * sp * 4.6;
    // the tool in hand
    const toolKey = (p.carry ? 'none' : p.weapon) + (p.golden > 0 ? 'g' : '');
    if (toolKey !== this.heroToolKey) {
      this.heroToolKey = toolKey;
      if (this.heroTool) { this.heroTool.removeFromParent(); }
      this.heroTool = p.carry ? null : makeTool(p.weapon, p.golden > 0 && (p.weapon === 'shovel' || p.weapon === 'pickaxe'));
      if (this.heroTool) { h.hand.add(this.heroTool); this.heroTool.rotation.x = p.weapon === 'shotgun' ? -Math.PI / 2 : 0; }
    }
    humanoid(h, this.walk, sp, { ground: p.ground, vy: p.vy }, t);
    // squash on landing, stretch in the air
    const sq = p.landT > 0 ? 1 - p.landT * 1.2 * Math.min(1, p.fallV / 14) : p.ground ? 1 : 1 + Math.min(0.12, Math.abs(p.vy) * 0.008);
    h.root.scale.set(2 - sq, sq, 2 - sq);
    if (p.swing > 0) { const k = 1 - p.swing / 0.24; h.armR.rotation.x = -2.6 + k * 3.4; h.body.rotation.y = 0.3 - k * 0.6; }
    else h.body.rotation.y = 0;
    if (p.plunge) { h.armR.rotation.x = h.armL.rotation.x = -3.0; h.root.rotation.x = 0; }
    if (p.carry) { h.armL.rotation.x = h.armR.rotation.x = -2.9; }
    if (p.weapon === 'shotgun' && !p.carry && !(p.swing > 0)) { h.armR.rotation.x = p.ground ? -1.4 : 0.3; }
    // blink when hurt, shimmer when golden
    h.group.visible = !(p.iframes > 0 && Math.floor(t * 24) % 2 === 0);
    if (p.golden > 0 && Math.random() < 0.6) this.fx.burst(1, 'gold', p.x + (Math.random() - 0.5) * 0.6, p.y + Math.random() * 1.1, p.z + (Math.random() - 0.5) * 0.6, { glow: true, color: [0xffd040, 0xff7ad0, 0x7ae0ff, 0x9aff7a][Math.floor(Math.random() * 4)], speed: 0.6, up: 1.2, size: 0.05, life: 0.6, grav: 0 });
    if (p.burn > 0 && Math.random() < 0.8) this.fx.fire(p.x + (Math.random() - 0.5) * 0.4, p.y + 0.3 + Math.random() * 0.6, p.z + (Math.random() - 0.5) * 0.4, 1);
    // the blob shadow straight down (3D platforming needs it)
    const g = w.grid;
    let fy = Math.floor(p.y + 0.01);
    const cx = Math.floor(p.x), cz = Math.floor(p.z);
    while (fy > 0 && !g.solid(cx, fy - 1, cz) && p.y - fy < 30) fy--;
    this.shadow.position.set(p.x, fy + 0.03, p.z);
    const hgt = p.y - fy;
    this.shadow.scale.setScalar(Math.max(0.45, 1 - hgt * 0.06));
    this.shadow.material.opacity = Math.max(0.2, 0.55 - hgt * 0.03);
  }

  // ------------------------------------------------------------------ hazards
  syncHazards(w, focusY, t, dt) {
    for (const h of w.hazards) {
      let a = this.hz.get(h);
      const near = Math.abs(h.y - focusY) < 14;
      if (!near || !h.alive) { if (a) { a.obj.removeFromParent(); this.hz.delete(h); } continue; }
      if (!a) {
        let obj;
        if (h.kind === 'saw') { obj = new THREE.Group(); const track = P.makeSawTrack(Math.hypot(h.x1 - h.x0, h.z1 - h.z0)); track.position.set((h.x0 + h.x1) / 2, h.y + 0.02, (h.z0 + h.z1) / 2); track.rotation.y = Math.atan2(h.x1 - h.x0, h.z1 - h.z0); this.root.add(track); const saw = P.makeSaw(HZ.SAW_R); obj.add(saw); a = { obj, saw, track }; }
        else if (h.kind === 'vent') { obj = P.makeVent(h.arms); a = { obj }; }
        else if (h.kind === 'vat') { obj = P.makeVat(); a = { obj }; }
        else if (h.kind === 'stal') { obj = P.makeStalactite(h.id); a = { obj }; }
        else if (h.kind === 'thumper') { obj = P.makeThumper(); a = { obj, rings: [] }; }
        else continue;
        this.root.add(a.obj);
        this.hz.set(h, a);
      }
      const o = a.obj;
      if (h.kind === 'saw') {
        o.position.set(h.x, h.y, h.z);
        o.rotation.y = Math.atan2(h.x1 - h.x0, h.z1 - h.z0) + Math.PI / 2;
        a.saw.userData.blade.rotation.z -= dt * 18 * h.dir;
        if (Math.random() < dt * 14) this.fx.sparks(h.x, h.y + 0.05, h.z, 1);
      } else if (h.kind === 'vent') {
        o.position.set(h.x, h.y, h.z);
        const ud = o.userData;
        ud.hot.material.color.setRGB(0.23 + h.warn * 0.77, 0.2 + h.warn * 0.1, 0.25 - h.warn * 0.2);
        ud.body.position.y = h.warn > 0 ? Math.sin(t * 60) * 0.015 * h.warn : 0;
        for (const j of ud.jets) { j.j.visible = h.blast > 0; j.j.scale.set(1, 1, j.len * h.reach); j.outer.material.opacity = 0.85 * (1 - h.blast * 0.5); }
        if (h.blast > 0 && Math.random() < 0.8) for (const arm of h.arms) this.fx.fire(h.x + arm.x * arm.len * Math.random(), h.y + 0.4, h.z + arm.z * arm.len * Math.random(), 1);
      } else if (h.kind === 'vat') {
        o.position.set(h.x, h.y, h.z);
        const ud = o.userData;
        ud.bubbles.forEach((b, i) => { const k = (t * (1 + h.warn * 2) + i * 0.37) % 1; b.position.y = 0.85 + k * 0.15; b.scale.setScalar(0.6 + k * (0.6 + h.warn)); });
        ud.tar.material.color.setRGB(1, 0.42 + h.warn * 0.3, 0.1);
        if (Math.random() < dt * 4) this.fx.smoke(h.x, h.y + 1, h.z, 1);
      } else if (h.kind === 'stal') {
        o.position.set(h.x + (h.state === 'wobble' ? Math.sin(t * 50) * 0.05 : 0), h.y, h.z);
        if (h.state === 'wobble' && Math.random() < dt * 20) this.fx.dirt(h.x, h.y - 0.2, h.z, 0x4a4250, 1);
      } else if (h.kind === 'thumper') {
        o.position.set(h.x, h.y, h.z);
        o.userData.light.material.color.setRGB(0.44 + h.warn * 0.56, 0.06 + h.warn * 0.3, 0.06);
        while (a.rings.length < h.rings.length) { const r = new THREE.Mesh(P.RING_GEO, P.ringMat()); this.root.add(r); a.rings.push(r); }
        a.rings.forEach((r, i) => { const R = h.rings[i]; r.visible = R != null; if (R != null) { r.position.set(h.x, h.y + 0.22, h.z); r.scale.set(R, 0.9, R); r.material.opacity = 0.8 * (1 - R / HZ.RING_MAX); } });
      }
    }
  }
}

// walk / idle / air poses for anything with legs and arms
function humanoid(m, ph, sp, e, t) {
  if (!m.legL) return;
  const walk = Math.min(1, sp / 2.5);
  const air = e.ground === false;
  const s = Math.sin(ph * 1.0);
  if (air) {
    m.legL.rotation.x = -0.5; m.legR.rotation.x = 0.35;
    m.armL.rotation.x = -2.2; m.armR.rotation.x = -2.0;
  } else {
    m.legL.rotation.x = s * 0.8 * walk; m.legR.rotation.x = -s * 0.8 * walk;
    m.armL.rotation.x = -s * 0.7 * walk; m.armR.rotation.x = s * 0.7 * walk;
  }
  m.armL.rotation.z = -0.12; m.armR.rotation.z = 0.12;
  m.body.position.y = (m.body.userData.y ??= m.body.position.y) + (air ? 0 : Math.abs(s) * 0.03 * walk + Math.sin(t * 2.2) * 0.006);
  m.head.rotation.z = Math.sin(t * 1.3 + (e.id || 0)) * 0.04;
}
