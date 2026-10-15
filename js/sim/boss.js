// CHAIRMAN DEVIL, Chief Hell Operator: half pinstripe suit, half devil. He runs the Bedrock
// Boardroom at the bottom of the well and keeps the Golden Shovel in a case behind his chair.
//
// A pattern you can learn (Downwell / Spelunky boss rules): walk, then one of
//   volley  — raises a hand (the tell), throws a fan of hellfire "memos"
//   slam    — crouches, leaps at you, lands with a shock ring you jump over
//   summon  — snaps his fingers: two imps from the floor (never more than four)
//   charge  — (second half) lowers his horns and runs; into a wall, he's stunned and takes double
// Stomp his head (it bounces you high) or hit him with anything. Below half health he speeds up.
import { T } from './tuning.js';
import { moveBody } from './grid.js';
import { emit, addEnt, hurtPlayer, spawnGold } from './common.js';
import { makeEnemy } from './enemies.js';
import { turnTo } from './enemies.js';

export const BOSS = {
  hp: 90, hw: 0.62, h: 2.2,
  walk: 1.9, walk2: 2.6,
  volleyWind: 0.75, volleyN: 3, volleyN2: 5, volleySpread: 0.32, memoSpeed: 6.2,
  slamCrouch: 0.5, slamV: 12.5, ringSpeed: 5.2, ringMax: 6.5, ringH: 0.5, ringHalf: 0.4,
  summonWind: 0.8, impsMax: 4,
  chargeWind: 0.6, chargeV: 9, chargeT: 1.4, stun: 1.6, stunMul: 2,
  touch: 1,
};

export function makeBoss(x, y, z) {
  return { kind: 'boss', boss: true, enemy: true, x, y, z, hw: BOSS.hw, h: BOSS.h, hp: BOSS.hp, maxHp: BOSS.hp, state: 'sleep', t: 0, face: 0, phase: 1, rings: [], next: 0, hurtT: 0, anim: 0, ground: true, sayT: 4 };
}

const QUIPS = ['Let’s circle back… to your FUNERAL.', 'This meeting is OVER.', 'Synergy!!', 'You’re FIRED!', 'Per my last email…', 'Profits are UP.', 'Think of the shareholders!', 'I own your soul. Page 3.'];

export function stepBoss(w, e, dt) {
  const p = w.player;
  e.anim += dt;
  if (e.hurtT > 0) e.hurtT -= dt;
  e.t -= dt;
  const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz);
  const fight = w.state === 'play' && w.bossIntro;
  if (e.state === 'dying') {
    e.vx = e.vz = 0;
    if (e.t <= 0) {
      e.alive = false;
      for (let i = 0; i < 36; i++) spawnGold(w, e.x, e.y + 1.2, e.z, 5, { burst: 5, bill: i % 3 === 0 });
      for (const q of w.ents) if (q.alive && q.kind === 'goldenShovel') q.locked = false;
      for (const q of w.ents) if (q.alive && q.kind === 'imp') { q.alive = false; emit(w, 'poof', { x: q.x, y: q.y, z: q.z }); }
      emit(w, 'bossDown', { x: e.x, y: e.y, z: e.z });
      w.shake = 1;
    }
    return;
  }
  if (!fight) { e.face = turnTo(e.face, Math.atan2(dx, dz), 2 * dt); gravity(w, e, dt); return; }
  if (e.hp < e.maxHp / 2 && e.phase === 1) { e.phase = 2; emit(w, 'bossPhase', {}); emit(w, 'say', { id: e.id, text: 'Now it’s PERSONAL.', boss: true, loud: true }); }
  if ((e.sayT -= dt) <= 0) { e.sayT = 5 + Math.random() * 4; emit(w, 'say', { id: e.id, text: QUIPS[Math.floor(Math.random() * QUIPS.length)], boss: true }); }
  const fast = e.phase === 2;
  let want = 0;
  switch (e.state) {
    case 'sleep': e.state = 'intro'; e.t = 2.4; emit(w, 'say', { id: e.id, text: 'You’re late for the meeting.', boss: true, loud: true }); break;
    case 'intro': e.face = turnTo(e.face, Math.atan2(dx, dz), 3 * dt); if (e.t <= 0) { e.state = 'walk'; e.t = 1.2; } break;
    case 'walk':
      e.face = turnTo(e.face, Math.atan2(dx, dz), 4 * dt);
      want = dist > 2 ? (fast ? BOSS.walk2 : BOSS.walk) : 0;
      if (e.t <= 0) {
        const plan = fast ? ['volley', 'charge', 'slam', 'summon', 'charge', 'volley'] : ['volley', 'slam', 'volley', 'summon'];
        e.state = plan[e.next++ % plan.length];
        e.t = { volley: BOSS.volleyWind, slam: BOSS.slamCrouch, summon: BOSS.summonWind, charge: BOSS.chargeWind }[e.state];
        emit(w, 'bossTell', { id: e.id, move: e.state });
      }
      break;
    case 'volley':
      e.face = turnTo(e.face, Math.atan2(dx, dz), 6 * dt);
      if (e.t <= 0) {
        const n = fast ? BOSS.volleyN2 : BOSS.volleyN;
        for (let i = 0; i < n; i++) {
          const a = Math.atan2(dx, dz) + BOSS.volleySpread * (i - (n - 1) / 2);
          const sp = BOSS.memoSpeed;
          const tFly = Math.max(0.35, dist / sp);
          addEnt(w, { kind: 'fireball', src: 'memo', x: e.x + Math.sin(a) * 0.8, y: e.y + 1.7, z: e.z + Math.cos(a) * 0.8, hw: 0.18, h: 0.3, vx: Math.sin(a) * sp, vz: Math.cos(a) * sp, vy: (p.y + 0.4 - (e.y + 1.7)) / tFly + 0.5 * T.GRAVITY * 0.55 * tFly, life: 3, fx: true, big: true });
        }
        emit(w, 'bossVolley', { x: e.x, y: e.y, z: e.z });
        e.state = 'walk'; e.t = fast ? 1.1 : 1.6;
      }
      break;
    case 'slam':
      if (e.t <= 0 && e.ground && !e.leapt) {
        e.leapt = true; e.vy = BOSS.slamV;
        const tAir = (2 * BOSS.slamV) / T.GRAVITY;
        e.vx = dx / tAir; e.vz = dz / tAir;
        emit(w, 'bossLeap', { x: e.x, y: e.y, z: e.z });
      }
      if (e.leapt && e.ground && e.vy <= 0 && e.t < -0.3) {
        e.leapt = false; e.rings.push(0); e.vx = e.vz = 0;
        emit(w, 'bossSlam', { x: e.x, y: e.y, z: e.z }); w.shake = Math.max(w.shake, 0.8);
        e.state = 'walk'; e.t = 1.4;
      }
      break;
    case 'summon':
      if (e.t <= 0) {
        const imps = w.ents.filter((q) => q.alive && q.kind === 'imp').length;
        for (let i = 0; i < Math.min(2, BOSS.impsMax - imps); i++) {
          const a = Math.random() * Math.PI * 2;
          addEnt(w, makeEnemy('imp', e.x + Math.sin(a) * 2.2, e.y + 0.1, e.z + Math.cos(a) * 2.2, 4));
          emit(w, 'poof', { x: e.x + Math.sin(a) * 2.2, y: e.y, z: e.z + Math.cos(a) * 2.2 });
        }
        emit(w, 'say', { id: e.id, text: 'Interns!', boss: true });
        e.state = 'walk'; e.t = 1.5;
      }
      break;
    case 'charge':
      if (!e.charging) { e.face = turnTo(e.face, Math.atan2(dx, dz), 8 * dt); if (e.t <= 0) { e.charging = true; e.t = BOSS.chargeT; emit(w, 'bossCharge', {}); } }
      else {
        want = BOSS.chargeV;
        if (e.t <= 0) { e.charging = false; e.state = 'walk'; e.t = 1.2; }
      }
      break;
    case 'stunned':
      if (e.t <= 0) { e.state = 'walk'; e.t = 1; }
      break;
  }
  const fx = Math.sin(e.face), fz = Math.cos(e.face);
  if (e.state !== 'slam' || !e.leapt) {
    const k = Math.min(1, 10 * dt);
    e.vx += (fx * want - e.vx) * k; e.vz += (fz * want - e.vz) * k;
  }
  const hit = gravity(w, e, dt);
  if (e.charging && (hit & 9)) {
    e.charging = false; e.state = 'stunned'; e.t = BOSS.stun; e.vx = -fx * 3; e.vz = -fz * 3;
    emit(w, 'bossStun', { x: e.x, y: e.y, z: e.z }); w.shake = Math.max(w.shake, 0.6);
  }
  // shock rings from the slam
  for (let i = e.rings.length - 1; i >= 0; i--) {
    e.rings[i] += BOSS.ringSpeed * dt;
    if (e.rings[i] > BOSS.ringMax) { e.rings.splice(i, 1); continue; }
    const R = e.rings[i];
    if (p.y < e.y + BOSS.ringH && p.y > e.y - 0.4 && Math.abs(dist - R) < BOSS.ringHalf) hurtPlayer(w, 1, e, 'shockwave');
  }
  // touching him hurts (from above is a stomp: world.js)
  if (Math.abs(dx) < p.hw + e.hw && Math.abs(dz) < p.hw + e.hw && p.y < e.y + e.h * 0.8 && p.y + p.h > e.y && !(p.vy < -0.5 && p.y > e.y + e.h * 0.6)) {
    hurtPlayer(w, BOSS.touch, e, 'boss');
  }
}

function gravity(w, e, dt) {
  e.vy = Math.max(e.vy - T.GRAVITY * dt, -T.MAX_FALL);
  const hit = moveBody(w.grid, e, e.vx * dt, e.vy * dt, e.vz * dt);
  if (hit & 6) e.vy = 0;
  e.ground = (hit & 2) !== 0;
  return hit;
}

// damage rules the boss changes: stunned takes double, death is a show, not a pop
export function bossDamage(w, e, dmg) {
  if (e.state === 'dying' || e.state === 'intro' || e.state === 'sleep') return 0;
  const d = dmg * (e.state === 'stunned' ? BOSS.stunMul : 1);
  e.hp -= d;
  if (e.hp <= 0) { e.hp = 0; e.state = 'dying'; e.t = 2.6; e.charging = false; emit(w, 'bossDying', { x: e.x, y: e.y, z: e.z }); emit(w, 'say', { id: e.id, text: 'My… quarterly… numbers…', boss: true, loud: true }); }
  return d;
}
