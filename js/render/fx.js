// Effects: pooled particles (two instanced meshes: lit chunks and additive glows), shotgun tracers,
// explosions (a fireball, a shock ring, one pooled flash light), rings. Pools, not churn (house rule 7).
import * as THREE from 'three';
import { toon } from './materials.js';

const N_SOLID = 420, N_GLOW = 420, N_TRACER = 48, N_BOOM = 6;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color(), _e = new THREE.Euler();

export class FX {
  constructor(scene) {
    this.scene = scene;
    const sm = new THREE.MeshToonMaterial({ color: 0xffffff });
    this.solid = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), sm, N_SOLID);
    const gm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.glow = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), gm, N_GLOW);
    for (const im of [this.solid, this.glow]) {
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.frustumCulled = false;
      for (let i = 0; i < im.count; i++) { im.setMatrixAt(i, _m.makeScale(0, 0, 0)); im.setColorAt(i, _c.set(0xffffff)); }
      scene.add(im);
    }
    this.ps = { solid: Array.from({ length: N_SOLID }, () => ({ life: 0 })), glow: Array.from({ length: N_GLOW }, () => ({ life: 0 })) };
    this.next = { solid: 0, glow: 0 };
    // tracers
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N_TRACER * 6), 3));
    tg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N_TRACER * 6), 3));
    this.tracers = new THREE.LineSegments(tg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.tracers.frustumCulled = false;
    scene.add(this.tracers);
    this.tr = Array.from({ length: N_TRACER }, () => ({ life: 0 }));
    this.trNext = 0;
    // booms
    this.booms = Array.from({ length: N_BOOM }, () => {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 40), new THREE.MeshBasicMaterial({ color: 0xffd080, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
      ring.rotation.x = -Math.PI / 2;
      ball.visible = ring.visible = false;
      scene.add(ball, ring);
      return { ball, ring, t: 1, r: 1 };
    });
    this.boomNext = 0;
    this.flash = new THREE.PointLight(0xffa050, 0, 12, 1.4);
    scene.add(this.flash);
    this.flashT = 0;
  }

  dispose() {
    for (const o of [this.solid, this.glow, this.tracers, this.flash]) o.removeFromParent();
    for (const b of this.booms) { b.ball.removeFromParent(); b.ring.removeFromParent(); }
  }

  spawn(kind, x, y, z, o = {}) {
    const glow = !!o.glow;
    const pool = glow ? this.ps.glow : this.ps.solid;
    const key = glow ? 'glow' : 'solid';
    const i = this.next[key]; this.next[key] = (i + 1) % pool.length;
    const p = pool[i];
    const a = Math.random() * Math.PI * 2, sp = (o.speed ?? 3) * (0.4 + Math.random() * 0.8);
    Object.assign(p, {
      x, y, z,
      vx: Math.cos(a) * sp * (o.spread ?? 1) + (o.vx || 0), vy: (o.up ?? 3) * (0.5 + Math.random() * 0.8) + (o.vy || 0), vz: Math.sin(a) * sp * (o.spread ?? 1) + (o.vz || 0),
      life: (o.life ?? 0.7) * (0.6 + Math.random() * 0.6), max: 1, size: (o.size ?? 0.08) * (0.6 + Math.random() * 0.8),
      grav: o.grav ?? 14, drag: o.drag ?? 1.5, color: o.color ?? 0xffffff, grow: o.grow ?? 0, rx: Math.random() * 6, ry: Math.random() * 6,
    });
    p.max = p.life;
    if (pool === this.ps.glow) this.glow.setColorAt(i, _c.set(p.color)); else this.solid.setColorAt(i, _c.set(p.color));
  }
  burst(n, kind, x, y, z, o) { for (let i = 0; i < n; i++) this.spawn(kind, x, y, z, o); }

  // named bursts
  dirt(x, y, z, color = 0x6a4329, n = 10) { this.burst(n, 'dirt', x, y, z, { color, speed: 3, up: 4, size: 0.1, life: 0.8 }); }
  sparks(x, y, z, n = 8, color = 0xffd060) { this.burst(n, 'spark', x, y, z, { glow: true, color, speed: 4, up: 3, size: 0.045, life: 0.35, grav: 10 }); }
  fire(x, y, z, n = 3) { this.burst(n, 'fire', x, y, z, { glow: true, color: Math.random() < 0.5 ? 0xff7a2a : 0xffc04a, speed: 0.5, up: 2.2, grav: -1.5, size: 0.12, life: 0.55, grow: -0.12 }); }
  smoke(x, y, z, n = 4) { this.burst(n, 'smoke', x, y, z, { color: 0x2a2430, speed: 0.6, up: 1.4, grav: -0.8, size: 0.18, life: 1.1, grow: 0.25, drag: 1 }); }
  oil(x, y, z, n = 12) { this.burst(n, 'oil', x, y, z, { color: 0x0e0a12, speed: 3, up: 4, size: 0.09, life: 0.9 }); }
  coins(x, y, z, n = 6) { this.burst(n, 'glint', x, y, z, { glow: true, color: 0xffe080, speed: 1.6, up: 2.6, size: 0.05, life: 0.5, grav: 6 }); }
  stars(x, y, z, n = 6) { this.burst(n, 'star', x, y, z, { glow: true, color: 0xfff080, speed: 1.8, up: 2, size: 0.07, life: 0.8, grav: 2 }); }
  confetti(x, y, z, n = 30) { for (let i = 0; i < n; i++) this.spawn('conf', x, y, z, { color: [0xffc93a, 0xff6a5a, 0x6ad46a, 0x7ac8ff, 0xff9ac0][i % 5], speed: 4, up: 6, size: 0.07, life: 1.6, grav: 9 }); }
  gold(x, y, z, n = 20) { this.burst(n, 'gold', x, y, z, { glow: true, color: 0xffd040, speed: 2, up: 4, size: 0.06, life: 1.0, grav: 4 }); }

  tracer(x0, y0, z0, x1, y1, z1, color = 0xffe0a0) {
    const i = this.trNext; this.trNext = (i + 1) % N_TRACER;
    Object.assign(this.tr[i], { life: 0.09, x0, y0, z0, x1, y1, z1, color });
  }

  boom(x, y, z, r) {
    const b = this.booms[this.boomNext]; this.boomNext = (this.boomNext + 1) % N_BOOM;
    b.t = 0; b.r = r; b.ball.position.set(x, y, z); b.ring.position.set(x, y - 0.3, z);
    b.ball.visible = b.ring.visible = true;
    this.flash.position.set(x, y + 0.5, z); this.flash.intensity = 60; this.flashT = 0.35;
    this.burst(16, 'dirt', x, y, z, { color: 0x3a2a20, speed: 6, up: 6, size: 0.13, life: 1 });
    this.burst(18, 'fire', x, y, z, { glow: true, color: 0xff8a2a, speed: 3, up: 3, size: 0.2, life: 0.5, grav: -2, grow: -0.2 });
    this.smoke(x, y, z, 8);
  }

  update(dt) {
    for (const [key, im] of [['solid', this.solid], ['glow', this.glow]]) {
      const pool = this.ps[key];
      for (let i = 0; i < pool.length; i++) {
        const p = pool[i];
        if (p.life <= 0) { if (p.max) { im.setMatrixAt(i, _m.makeScale(0, 0, 0)); p.max = 0; } continue; }
        p.life -= dt;
        p.vy -= p.grav * dt;
        const d = Math.max(0, 1 - p.drag * dt);
        p.vx *= d; p.vz *= d;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.size = Math.max(0, p.size + p.grow * dt);
        const k = key === 'glow' ? Math.min(1, p.life / (p.max * 0.5)) : Math.min(1, p.life / 0.25);
        const s = p.size * k;
        _e.set(p.rx += dt * 5, p.ry += dt * 4, 0);
        _m.compose(_p.set(p.x, p.y, p.z), _q.setFromEuler(_e), _s.set(s, s, s));
        im.setMatrixAt(i, _m);
      }
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    const pos = this.tracers.geometry.getAttribute('position'), col = this.tracers.geometry.getAttribute('color');
    for (let i = 0; i < N_TRACER; i++) {
      const t = this.tr[i];
      if (t.life > 0) t.life -= dt;
      const k = Math.max(0, t.life / 0.09);
      _c.set(t.color || 0).multiplyScalar(k);
      pos.setXYZ(i * 2, t.x0 || 0, t.y0 || 0, t.z0 || 0); pos.setXYZ(i * 2 + 1, t.x1 || 0, t.y1 || 0, t.z1 || 0);
      col.setXYZ(i * 2, _c.r, _c.g, _c.b); col.setXYZ(i * 2 + 1, _c.r * 0.3, _c.g * 0.3, _c.b * 0.3);
    }
    pos.needsUpdate = col.needsUpdate = true;
    for (const b of this.booms) {
      if (b.t >= 1) continue;
      b.t += dt / 0.45;
      const k = Math.min(1, b.t);
      b.ball.scale.setScalar(b.r * (0.3 + k * 0.8));
      b.ball.material.opacity = (1 - k) * 0.9;
      b.ring.scale.setScalar(b.r * (0.2 + k * 1.5));
      b.ring.material.opacity = (1 - k) * 0.8;
      if (b.t >= 1) b.ball.visible = b.ring.visible = false;
    }
    if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity = Math.max(0, this.flashT / 0.35) * 60; } else this.flash.intensity = 0;
  }
}
