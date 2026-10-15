// Hazards, repurposed from dr-mow's (js/sim.js there): the buzz saw on its striped track becomes a
// drill saw, the explosive spout a gas vent, the acid vat a boiling tar vat that spits embers, the
// falling icicle a stalactite, the ring mine a seismic thumper. Same tells and timings, a mine's look.
// They hurt everyone: lure oil workers into them. Fire from vents and embers is also light.
import { T } from './tuning.js';
import { moveBody } from './grid.js';
import { emit, hurtPlayer, damageEnemy, addEnt, ignite, burnPlayer } from './common.js';

export const HZ = {
  SAW_R: 0.62, SAW_SPEED: 2.4, SAW_H: 0.55,                                         // dr-mow SAW_R, speed
  VENT_R: 0.5, VENT_H: 1.05, VENT_HALF: 0.45, VENT_WARN: 0.9, VENT_BLAST: 0.65, VENT_GROW: 0.12, VENT_EVERY: 4.6, // dr-mow SPOUT_*
  VAT: { r: 0.6, h: 0.95, warn: 0.9, vx: 2.6, vy: 7.5, keep: 0.8, e: 0.55, bounces: 3, hit: 0.5, turn: 0.9, every: 3.4, n: 3 }, // dr-mow ACID
  STAL_WAKE: 2.6, STAL_WOBBLE: 0.75, STAL_DMG: 2,                                   // dr-mow ICICLE (wake, wobble) on a cave's scale
  RING_H: 0.45, RING_HALF: 0.35, MINE_R: 0.55, RING_SPEED: 3.5, RING_MAX: 2.8, RING_EVERY: 3.5, RING_WARN: 0.7, // dr-mow ring mines
};

// everyone a hazard can hurt: the digger, enemies, the piggy bank
const FIERY = new Set(['vent', 'ember', 'vat']);
function hurtAll(w, test, dmg, cause, from) {
  const p = w.player;
  if (test(p.x, p.y, p.z, p.hw)) { if (FIERY.has(cause)) burnPlayer(w, from, cause); else hurtPlayer(w, dmg, from, cause); }
  for (const e of w.ents) {
    if (!e.alive || !(e.enemy || e.kind === 'piggy') || e.carried) continue;
    if (Math.abs(e.y - p.y) > 14) continue;
    if (!test(e.x, e.y, e.z, e.hw || 0.3)) continue;
    if (e.enemy) { if (FIERY.has(cause)) ignite(w, e, cause); if (!(e.hzT > 0)) { damageEnemy(w, e, 2.5, cause, from); e.hzT = 0.6; } }
    else w.hurtPiggy(e, 1, cause);
  }
}

export function stepHazard(w, h, dt) {
  h.t += dt;
  if (h.kind === 'saw') {
    // ping-pong along the track
    const L = Math.hypot(h.x1 - h.x0, h.z1 - h.z0) || 1;
    h.u += (h.dir * HZ.SAW_SPEED * dt) / L;
    if (h.u > 1) { h.u = 1; h.dir = -1; } else if (h.u < 0) { h.u = 0; h.dir = 1; }
    h.x = h.x0 + (h.x1 - h.x0) * h.u; h.z = h.z0 + (h.z1 - h.z0) * h.u;
    hurtAll(w, (x, y, z, hw) => y < h.y + HZ.SAW_H && y > h.y - 0.6 && Math.hypot(x - h.x, z - h.z) < HZ.SAW_R + hw, T.CONTACT_DMG, 'saw', h);
  } else if (h.kind === 'vent') {
    const ph = (h.t + h.first) % HZ.VENT_EVERY, until = HZ.VENT_EVERY - ph;
    h.warn = until < HZ.VENT_WARN ? 1 - until / HZ.VENT_WARN : 0;
    const was = h.blast > 0;
    h.blast = ph < HZ.VENT_BLAST ? ph / HZ.VENT_BLAST : 0;
    h.reach = h.blast > 0 ? Math.min(1, ph / HZ.VENT_GROW) : 0;
    if (h.blast > 0 && !was) emit(w, 'vent', { id: h.id, x: h.x, y: h.y, z: h.z });
    if (h.blast > 0) {
      hurtAll(w, (x, y, z, hw) => {
        if (y > h.y + HZ.VENT_H || y < h.y - 0.6) return false;
        const dx = x - h.x, dz = z - h.z;
        if (Math.hypot(dx, dz) < HZ.VENT_R + hw) return true;
        for (const a of h.arms) {
          const along = dx * a.x + dz * a.z, perp = Math.abs(dx * a.z - dz * a.x);
          if (along > 0 && along < a.len * h.reach + hw && perp < HZ.VENT_HALF + hw * 0.5) return true;
        }
        return false;
      }, T.CONTACT_DMG, 'vent', h);
      // the jets light barrels and TNT
      for (const e of w.ents) {
        if (!e.alive || (e.kind !== 'barrel' && e.kind !== 'tnt') || Math.abs(e.y - h.y) > 1) continue;
        const dx = e.x - h.x, dz = e.z - h.z;
        for (const a of h.arms) {
          const along = dx * a.x + dz * a.z, perp = Math.abs(dx * a.z - dz * a.x);
          if (along > 0 && along < a.len * h.reach + 0.4 && perp < 0.6) { if (e.kind === 'barrel') e.boom ||= 0.05; else if (!(e.fuse > 0)) e.fuse = T.TNT_FUSE; }
        }
      }
    }
  } else if (h.kind === 'vat') {
    const V = HZ.VAT;
    const ph = (h.t + h.first) % V.every, until = V.every - ph;
    h.warn = until < V.warn ? 1 - until / V.warn : 0;
    if (ph < dt && h.t > 0.2) {
      h.k = (h.k || 0) + 1;
      for (let i = 0; i < V.n; i++) {
        const a = (i * Math.PI * 2) / V.n + h.k * V.turn;
        addEnt(w, { kind: 'ember', x: h.x + Math.sin(a) * V.r, y: h.y + V.h, z: h.z + Math.cos(a) * V.r, hw: 0.12, h: 0.24, vx: Math.sin(a) * V.vx, vy: V.vy, vz: Math.cos(a) * V.vx, bounces: 0, life: 4, fx: true });
      }
      emit(w, 'spit', { id: h.id, x: h.x, y: h.y, z: h.z });
    }
    // the vat itself burns to touch
    hurtAll(w, (x, y, z, hw) => y < h.y + V.h && y > h.y - 0.6 && Math.abs(x - h.x) < V.r + hw - 0.05 && Math.abs(z - h.z) < V.r + hw - 0.05, T.CONTACT_DMG, 'vat', h);
  } else if (h.kind === 'stal') {
    const p = w.player;
    if (h.state === 'hang') {
      const d = Math.hypot(p.x - h.x, p.z - h.z), dy = h.y - p.y;
      if (d < HZ.STAL_WAKE && dy > 0 && dy < 7.5) { h.state = 'wobble'; h.t = 0; emit(w, 'rumble', { id: h.id, x: h.x, y: h.y, z: h.z }); }
    } else if (h.state === 'wobble') {
      if (h.t > HZ.STAL_WOBBLE) { h.state = 'fall'; h.vy = 0; }
    } else if (h.state === 'fall') {
      h.vy = Math.max(h.vy - T.GRAVITY * dt, -T.MAX_FALL);
      const body = { x: h.x, y: h.y - 0.9, z: h.z, hw: 0.32, h: 0.9 };
      const hit = moveBody(w.grid, body, 0, h.vy * dt, 0);
      h.y = body.y + 0.9;
      hurtAll(w, (x, y, z, hw) => Math.hypot(x - h.x, z - h.z) < 0.45 + hw && y < h.y && y + 0.9 > h.y - 1.0, HZ.STAL_DMG, 'stalactite', h);
      if (hit & 2) { h.state = 'gone'; h.alive = false; emit(w, 'shatter', { x: h.x, y: h.y - 0.9, z: h.z }); w.shake = Math.max(w.shake, 0.25); }
    }
  } else if (h.kind === 'thumper') {
    const ph = (h.t + h.first) % HZ.RING_EVERY, until = HZ.RING_EVERY - ph;
    h.warn = until < HZ.RING_WARN ? 1 - until / HZ.RING_WARN : 0;
    if (ph < dt && h.t > 0.2) { h.rings.push(0); emit(w, 'thump', { id: h.id, x: h.x, y: h.y, z: h.z }); }
    for (let i = h.rings.length - 1; i >= 0; i--) {
      h.rings[i] += HZ.RING_SPEED * dt;
      if (h.rings[i] > HZ.RING_MAX) { h.rings.splice(i, 1); continue; }
      const R = h.rings[i];
      hurtAll(w, (x, y, z) => y < h.y + HZ.RING_H && y > h.y - 0.3 && Math.abs(Math.hypot(x - h.x, z - h.z) - R) < HZ.RING_HALF, T.CONTACT_DMG, 'thumper', h);
    }
    hurtAll(w, (x, y, z, hw) => y < h.y + 0.5 && y > h.y - 0.4 && Math.hypot(x - h.x, z - h.z) < HZ.MINE_R + hw, T.CONTACT_DMG, 'thumper', h);
  }
}

// Embers from tar vats: arc, bounce lower each time, then fizzle (dr-mow ACID embers, simulated).
export function stepEmber(w, e, dt) {
  const V = HZ.VAT;
  e.life -= dt;
  e.vy = Math.max(e.vy - T.GRAVITY * 0.8 * dt, -T.MAX_FALL);
  const hit = moveBody(w.grid, e, e.vx * dt, e.vy * dt, e.vz * dt);
  if (hit & 2) {
    e.bounces++;
    if (e.bounces > V.bounces) { e.alive = false; emit(w, 'fizzle', { x: e.x, y: e.y, z: e.z }); return; }
    e.vy = Math.abs(e.vy) * V.e + 1.5; e.vx *= V.keep; e.vz *= V.keep;
  }
  if (hit & 1) e.vx *= -0.6;
  if (hit & 8) e.vz *= -0.6;
  if (e.life <= 0) { e.alive = false; return; }
  hurtAll(w, (x, y, z, hw) => Math.hypot(x - e.x, z - e.z) < V.hit + hw * 0.5 && e.y > y - 0.2 && e.y < y + 1.0, T.CONTACT_DMG, 'ember', e);
}
