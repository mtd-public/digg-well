// Oil workers, beetles, snakes and oil flies. Pure.
import { T } from './tuning.js';
import { moveBody, onGround, rayGrid } from './grid.js';
import { emit, hurtPlayer, addEnt, ignite, burnPlayer } from './common.js';

// What the oil workers say. They're your employees, half-drowned in crude, asking the boss for
// help. Through the oil it comes out as a gurgle, and the Tycoon takes it for a threat.
export const NAMES = ['Gary', 'Linda', 'Big Sal', 'Doug', 'Trish', 'Earl', 'Marge-ish', 'Kevin', 'Rhonda', 'Lenny-ish', 'Barb', 'Stu', 'Dale', 'Wendell', 'Patty', 'Moe-ish'];
export const HELP_LINES = ['help…', 'Boss? It’s me, {n}!', 'Mr. Tycoon, HELP!', 'glrb… help', 'my pension…', 'I just started Monday!', 'is this covered?', 'get… it… off', 'so dark…', 'help us…', 'I have kids!', 'union rep… gurgle', 'boss, it’s {n} from Payroll!', 'I can’t feel my overtime', 'heeelp'];
export const CREW_LINES = ['THANK YOU, BOSS!', 'you found us!', 'we can see!', 'it’s off! it’s off!', 'Boss, it’s me, {n}!', 'does this mean a raise?', 'best boss EVER', 'I’ll be in Monday!'];
export const line = (arr, e) => arr[Math.floor(Math.random() * arr.length)].replace('{n}', e.name || 'Gary');

let nameI = Math.floor(Math.random() * NAMES.length);
export function makeEnemy(kind, x, y, z, depthIdx, extra = {}) {
  const d = T[kind.toUpperCase()];
  const hp = d.hp * (1 + T.ENEMY_HP_PER_DEPTH * depthIdx);
  const e = {
    kind, enemy: true, x, y, z, hw: d.hw, h: d.h, hp, maxHp: hp,
    face: Math.random() * Math.PI * 2, state: 'idle', t: 0.5 + Math.random() * 2, hurtT: 0, ground: false,
    homeY: y, sayT: 2 + Math.random() * 6, cd: 0, anim: Math.random() * 10, ...extra,
  };
  if (kind === 'worker' && !extra.crew && Math.random() < (T.BURNING.chance[depthIdx] || 0)) e.burning = true;
  if (kind === 'worker') { e.name = NAMES[nameI++ % NAMES.length]; e.oil = 0.3 + Math.random() * 0.22; e.look = Math.floor(Math.random() * 4); } // how much of them is under the oil, and which gag they carry
  if (kind === 'imp') { e.cd = 1 + Math.random() * 2; e.state = 'idle'; }
  return e;
}

const losClear = (w, a, ay, b, by) => {
  const dx = b.x - a.x, dy = by - ay, dz = b.z - a.z, d = Math.hypot(dx, dy, dz);
  if (d < 0.01) return true;
  return !rayGrid(w.grid, a.x, ay, a.z, dx / d, dy / d, dz / d, d - 0.2);
};

export function stepEnemy(w, e, dt) {
  const p = w.player, g = w.grid;
  e.anim += dt;
  if (e.hurtT > 0) e.hurtT -= dt;
  if (e.cd > 0) e.cd -= dt;
  const dx = p.x - e.x, dz = p.z - e.z, dy = p.y - e.y, dist = Math.hypot(dx, dz);
  const alive = w.state === 'play';
  if (e.kind === 'fly') return stepFly(w, e, dt, dx, dy, dz, dist);
  if (e.kind === 'bat') return stepBat(w, e, dt, dx, dy, dz, dist);

  // ground movers
  let want = 0, dirx = Math.sin(e.face), dirz = Math.cos(e.face);
  const ahead = (k) => ({ x: e.x + dirx * k, z: e.z + dirz * k });
  const floorAhead = () => { const a = ahead(e.hw + 0.25); return g.solid(Math.floor(a.x), Math.floor(e.y - 0.5), Math.floor(a.z)); };

  if (e.saved) { // washed clean: they cheer and hop
    e.face = Math.atan2(dx, dz);
    if (e.ground && Math.random() < dt * 1.4) e.vy = 6;
    if ((e.sayT -= dt) <= 0) { e.sayT = 2 + Math.random() * 3; if (dist < 12) emit(w, 'say', { id: e.id, text: line(CREW_LINES, e), saved: true }); }
  } else if (e.kind === 'shopkeeper') {
    return stepShopkeeper(w, e, dt, dx, dy, dz, dist);
  } else if (e.kind === 'imp') {
    return stepImp(w, e, dt, dx, dy, dz, dist);
  } else if (e.kind === 'worker' && e.crew) { // the crew in the Boardroom: chained to the job, they only plead
    e.face = turnTo(e.face, Math.atan2(dx, dz), 2 * dt);
    if ((e.sayT -= dt) <= 0) { e.sayT = 3 + Math.random() * 4; if (dist < 12) emit(w, 'say', { id: e.id, text: line(HELP_LINES, e) }); }
  } else if (e.kind === 'worker' && e.burning) {
    // lit: running in a panic, toward you mostly, catching everyone it touches
    if (alive) e.face = turnTo(e.face, Math.atan2(dx, dz) + Math.sin(e.anim * 3.1) * 0.9, 6 * dt);
    want = T.BURNING.chase;
    if (e.ground && !floorAhead() && Math.random() < 0.02) e.face += Math.PI;
    if ((e.sayT -= dt) <= 0) { e.sayT = 1.6 + Math.random() * 2; if (dist < 12) emit(w, 'say', { id: e.id, text: ['HOT HOT HOT!', 'AAAAH!', 'boss, put me OUT!', 'it burns!!', 'not the mustache!'][Math.floor(Math.random() * 5)] }); }
    for (const q of w.ents) {
      if (!q.alive || q === e || Math.abs(q.y - e.y) > 1 || Math.abs(q.x - e.x) > 0.7 || Math.abs(q.z - e.z) > 0.7) continue;
      if (q.kind === 'worker') ignite(w, q, 'spread');
      else if (q.kind === 'piggy' && !q.carried) w.hurtPiggy(q, 1, 'fire');
      else if (q.kind === 'barrel') q.boom ||= 0.2;
      else if (q.kind === 'tnt' && !(q.fuse > 0)) q.fuse = T.TNT_FUSE;
    }
    if (alive && Math.abs(dx) < e.hw + p.hw && Math.abs(dz) < e.hw + p.hw && p.y < e.y + e.h && e.y < p.y + p.h) burnPlayer(w, e, 'burning worker');
  } else if (e.kind === 'worker') {
    const D = T.WORKER;
    const sees = alive && dist < D.sight && Math.abs(dy) < 2.6 && losClear(w, e, e.y + 0.8, p, p.y + 0.5);
    if ((e.sayT -= dt) <= 0) {
      e.sayT = 3 + Math.random() * 5;
      if (dist < 11 && Math.abs(dy) < 6) emit(w, 'say', { id: e.id, text: line(HELP_LINES, e) });
    }
    switch (e.state) {
      case 'idle':
        e.t -= dt;
        if (e.t <= 0) { e.state = 'wander'; e.t = 1 + Math.random() * 2; e.face += (Math.random() - 0.5) * 2.5; }
        if (sees) { e.state = 'chase'; emit(w, 'say', { id: e.id, text: line(HELP_LINES.slice(0, 4), e), loud: true }); e.sayT = 2.5 + Math.random() * 2; }
        break;
      case 'wander':
        e.t -= dt; want = D.speed;
        if (e.ground && !floorAhead()) { e.face += Math.PI * (0.6 + Math.random() * 0.8); }
        if (e.t <= 0) { e.state = 'idle'; e.t = 0.8 + Math.random() * 2; }
        if (sees) e.state = 'chase';
        break;
      case 'chase': {
        const tf = Math.atan2(dx, dz);
        e.face = turnTo(e.face, tf, 5 * dt);
        want = D.chase;
        if (!sees && (dist > D.sight + 2 || Math.abs(dy) > 4)) { e.state = 'idle'; e.t = 1; }
        if (dist < D.reach + 0.2 && Math.abs(dy) < 1.2 && e.cd <= 0) { e.state = 'windup'; e.t = D.windup; emit(w, 'gurgle', { id: e.id, x: e.x, y: e.y, z: e.z }); }
        break;
      }
      case 'windup':
        e.face = turnTo(e.face, Math.atan2(dx, dz), 8 * dt);
        e.t -= dt;
        if (e.t <= 0) { e.state = 'grab'; e.t = 0.22; }
        break;
      case 'grab':
        want = 4.2; e.t -= dt;
        if (dist < D.reach + 0.15 && Math.abs(dy) < 1.1) hurtPlayer(w, T.CONTACT_DMG, e, 'worker');
        for (const q of w.ents) if (q.alive && q.kind === 'piggy' && !q.carried && Math.hypot(q.x - e.x, q.z - e.z) < D.reach && Math.abs(q.y - e.y) < 1) w.hurtPiggy(q, 1, 'worker');
        if (e.t <= 0) { e.state = 'recover'; e.t = D.recover; e.cd = 0.6; }
        break;
      case 'recover':
        e.t -= dt;
        if (e.t <= 0) e.state = 'chase';
        break;
    }
  } else if (e.kind === 'beetle') {
    want = T.BEETLE.speed;
    if (e.ground && !floorAhead()) e.face = snapAxis(e.face + Math.PI * (Math.random() < 0.5 ? 0.5 : -0.5));
  } else if (e.kind === 'snake') {
    const D = T.SNAKE;
    if (e.state === 'rear') {
      e.t -= dt;
      if (e.t <= 0) { e.state = 'lunge'; e.t = D.lungeT; emit(w, 'hiss', { id: e.id, x: e.x, y: e.y, z: e.z }); }
    } else if (e.state === 'lunge') {
      want = D.lunge; e.t -= dt;
      if (e.t <= 0) { e.state = 'patrol'; e.cd = 1.3; }
    } else {
      want = D.speed;
      if (e.ground && !floorAhead()) e.face = snapAxis(e.face + Math.PI);
      const fx = Math.sin(e.face), fz = Math.cos(e.face);
      if (alive && e.cd <= 0 && dist < D.range && Math.abs(dy) < 0.8 && (dx * fx + dz * fz) / (dist || 1) > 0.55) { e.state = 'rear'; e.t = D.rear; }
      else if (alive && e.cd <= 0 && dist < D.range && Math.abs(dy) < 0.8) { e.face = turnTo(e.face, Math.atan2(dx, dz), 3 * dt); }
    }
  }

  // physics
  dirx = Math.sin(e.face); dirz = Math.cos(e.face);
  const k = Math.min(1, (e.ground ? 14 : 4) * dt);
  if (e.hurtT <= 0 || e.kind !== 'worker') {
    e.vx += (dirx * want - e.vx) * k;
    e.vz += (dirz * want - e.vz) * k;
  } else { e.vx *= 1 - 3 * dt; e.vz *= 1 - 3 * dt; }
  e.vy = Math.max(e.vy - T.GRAVITY * dt, -T.MAX_FALL);
  const hit = moveBody(g, e, e.vx * dt, e.vy * dt, e.vz * dt);
  if (hit & 6) e.vy = 0;
  e.ground = (hit & 2) !== 0 || (e.vy <= 0 && onGround(g, e));
  if (hit & 9) {
    // a wall: workers hop small steps when they chase, the rest turn round
    if (e.kind === 'worker' && e.state === 'chase' && e.ground) e.vy = 8.6;
    else if (e.kind !== 'worker' || e.state === 'wander') e.face = snapAxis(e.face + Math.PI * (Math.random() < 0.5 ? 0.5 : 1));
  }
  // contact
  if (!e.saved && alive && e.kind !== 'worker' && e.hurtT <= 0) touchHurt(w, e);
}

function stepFly(w, e, dt, dx, dy, dz, dist) {
  const p = w.player, D = T.FLY;
  const alive = w.state === 'play';
  const d3 = Math.hypot(dx, dy + 0.4, dz);
  if (e.state === 'swoop') {
    e.t -= dt;
    const tx = e.tx - e.x, ty = e.ty - e.y, tz = e.tz - e.z, n = Math.hypot(tx, ty, tz) || 1;
    e.vx += ((tx / n) * D.swoop - e.vx) * Math.min(1, 6 * dt);
    e.vy += ((ty / n) * D.swoop - e.vy) * Math.min(1, 6 * dt);
    e.vz += ((tz / n) * D.swoop - e.vz) * Math.min(1, 6 * dt);
    if (e.t <= 0 || n < 0.3) { e.state = 'hover'; e.homeY = e.y; e.cd = 1.4 + Math.random(); }
  } else {
    e.state = 'hover';
    const bob = Math.sin(e.anim * 2.3) * 0.8;
    e.vx += (Math.sin(e.anim * 0.9) * D.speed - e.vx) * Math.min(1, 2 * dt);
    e.vz += (Math.cos(e.anim * 0.7) * D.speed - e.vz) * Math.min(1, 2 * dt);
    e.vy += ((e.homeY - e.y) * 2 + bob - e.vy) * Math.min(1, 3 * dt);
    if (alive && e.cd <= 0 && d3 < D.sight && losClear(w, { x: e.x, z: e.z }, e.y + 0.25, p, p.y + 0.5)) {
      e.state = 'swoop'; e.t = 1.3; e.tx = p.x; e.ty = p.y + 0.4; e.tz = p.z;
      emit(w, 'buzz', { id: e.id, x: e.x, y: e.y, z: e.z });
    }
  }
  if (dist > 0.1) e.face = turnTo(e.face, Math.atan2(e.vx, e.vz), 6 * dt);
  const hit = moveBody(w.grid, e, e.vx * dt, e.vy * dt, e.vz * dt);
  if (hit & 1) e.vx *= -0.5;
  if (hit & 8) e.vz *= -0.5;
  if (hit & 6) { e.vy *= -0.5; if (e.state === 'swoop') { e.state = 'hover'; e.homeY = e.y + 0.6; e.cd = 1; } }
  if (alive && e.hurtT <= 0) touchHurt(w, e);
}

// Bats: hang under the ceiling until you walk beneath, then drop and flutter at you in a wobbly line.
function stepBat(w, e, dt, dx, dy, dz, dist) {
  const D = T.BAT, p = w.player, alive = w.state === 'play';
  if (e.state === 'idle' || e.state === 'roost') {
    e.state = 'roost';
    if (alive && dist < D.wake && dy < 0.5 && dy > -7 && losClear(w, e, e.y, p, p.y + 0.5)) { e.state = 'fly'; e.vy = -2.5; emit(w, 'screech', { id: e.id, x: e.x, y: e.y, z: e.z }); }
    return;
  }
  const tx = p.x + Math.sin(e.anim * D.wobble) * 0.9, ty = p.y + 0.55 + Math.sin(e.anim * 3.7) * 0.4, tz = p.z + Math.cos(e.anim * D.wobble * 0.8) * 0.9;
  const ax = tx - e.x, ay = ty - e.y, az = tz - e.z, n = Math.hypot(ax, ay, az) || 1;
  const sp = alive ? D.speed : 1;
  e.vx += ((ax / n) * sp - e.vx) * Math.min(1, 3 * dt);
  e.vy += ((ay / n) * sp - e.vy) * Math.min(1, 3 * dt);
  e.vz += ((az / n) * sp - e.vz) * Math.min(1, 3 * dt);
  e.face = turnTo(e.face, Math.atan2(e.vx, e.vz), 8 * dt);
  const hit = moveBody(w.grid, e, e.vx * dt, e.vy * dt, e.vz * dt);
  if (hit & 1) e.vx *= -0.6;
  if (hit & 8) e.vz *= -0.6;
  if (hit & 6) e.vy *= -0.6;
  if (alive && e.hurtT <= 0) touchHurt(w, e);
}

// Touching a beetle, snake or fly from the side hurts (stomps are handled by the player).
function touchHurt(w, e) {
  const p = w.player;
  if (Math.abs(p.x - e.x) < p.hw + e.hw - 0.05 && Math.abs(p.z - e.z) < p.hw + e.hw - 0.05 && p.y < e.y + e.h - 0.05 && e.y < p.y + p.h) {
    if (p.vy < -1 && p.y > e.y + e.h * 0.45) return; // the player's stomp check gets this one
    if (p.golden > 0) return;
    hurtPlayer(w, T.CONTACT_DMG, e, e.kind);
  }
}

// Imps: cute little demons. They hop after you and lob tiny fireballs in an arc.
function stepImp(w, e, dt, dx, dy, dz, dist) {
  const D = T.IMP, p = w.player;
  const alive = w.state === 'play';
  const sees = alive && dist < D.sight && Math.abs(dy) < 4 && losClear(w, e, e.y + 0.4, p, p.y + 0.5);
  if (sees || e.state === 'hunt') { e.state = sees ? 'hunt' : e.state; e.face = turnTo(e.face, Math.atan2(dx, dz), 6 * dt); }
  if (e.ground) {
    e.vx *= 1 - Math.min(1, 10 * dt); e.vz *= 1 - Math.min(1, 10 * dt);
    e.t -= dt;
    if (e.t <= 0) {
      e.t = D.hopGap[0] + Math.random() * (D.hopGap[1] - D.hopGap[0]);
      const toward = e.state === 'hunt' && dist > 1.6;
      const a = toward ? Math.atan2(dx, dz) + (Math.random() - 0.5) * 0.8 : e.face + (Math.random() - 0.5) * 2;
      e.face = a;
      e.vy = D.hop[0] * (toward ? 1 : 0.7); e.vx = Math.sin(a) * D.hop[1]; e.vz = Math.cos(a) * D.hop[1];
      emit(w, 'impHop', { id: e.id });
    }
  }
  if (sees && e.cd <= 0 && dist < D.throwRange) {
    e.cd = D.throwCd * (0.8 + Math.random() * 0.4);
    const tFly = Math.max(0.4, dist / D.fireV);
    addEnt(w, { kind: 'fireball', src: 'imp', x: e.x, y: e.y + 0.5, z: e.z, hw: 0.12, h: 0.24, vx: (dx / (dist || 1)) * D.fireV, vz: (dz / (dist || 1)) * D.fireV, vy: (p.y + 0.4 - (e.y + 0.5)) / tFly + 0.5 * T.GRAVITY * 0.55 * tFly, life: 3, fx: true });
    emit(w, 'impThrow', { id: e.id, x: e.x, y: e.y, z: e.z });
    if (Math.random() < 0.3) emit(w, 'say', { id: e.id, text: ['hehe!', 'catch!', 'nyeh!', 'hot hot!', 'teehee'][Math.floor(Math.random() * 5)], imp: true });
  }
  e.vy = Math.max(e.vy - T.GRAVITY * dt, -T.MAX_FALL);
  const hit = moveBody(w.grid, e, e.vx * dt, e.vy * dt, e.vz * dt);
  if (hit & 6) e.vy = 0;
  if (hit & 9) { e.vx *= -0.5; e.vz *= -0.5; }
  e.ground = (hit & 2) !== 0 || (e.vy <= 0 && onGround(w.grid, e));
  if (alive && e.hurtT <= 0) touchHurt(w, e);
}

// The shopkeeper: behind his counter, polite, until you steal or start trouble. Then he chases you
// with a shotgun, and after that every shopkeeper in the well shoots on sight (world.shopAnger).
function stepShopkeeper(w, e, dt, dx, dy, dz, dist) {
  const p = w.player, alive = w.state === 'play';
  const sees = alive && dist < T.SHOPKEEPER.sight && Math.abs(dy) < 3 && losClear(w, e, e.y + 1, p, p.y + 0.5);
  if (e.state === 'calm') {
    e.face = turnTo(e.face, sees ? Math.atan2(dx, dz) : e.face, 3 * dt);
    if (w.shopAnger && sees) { e.state = 'angry'; e.t = 0.5; emit(w, 'say', { id: e.id, text: ['I know what you did!', 'YOU! Thief!', 'Word travels, crook!'][Math.floor(Math.random() * 3)], loud: true }); emit(w, 'anger', { id: e.id, why: 'reputation' }); }
    else if ((e.sayT -= dt) <= 0) { e.sayT = 6 + Math.random() * 5; if (dist < 6 && Math.abs(dy) < 2) emit(w, 'say', { id: e.id, text: ['Welcome!', 'Everything must go!', 'No refunds.', 'Cash only.', 'Break it, you buy it.'][Math.floor(Math.random() * 5)] }); }
    e.vx = (e.homeX - e.x) * 2; e.vz = (e.homeZ - e.z) * 2;
  } else if (e.state === 'angry') {
    e.face = turnTo(e.face, Math.atan2(dx, dz), 7 * dt);
    let want = dist > 2.4 ? T.SHOPKEEPER.speed : 0.6;
    if (e.aim > 0) {
      want = 0; e.aim -= dt;
      if (e.aim <= 0) {
        e.cd = T.SHOP_SHOT_CD;
        // a real shotgun blast: a short cone
        const fx = Math.sin(e.face), fz = Math.cos(e.face);
        const along = dx * fx + dz * fz, perp = Math.abs(dx * fz - dz * fx);
        if (sees && along > 0 && along < T.SHOP_SHOT_RANGE && perp < 0.6 + along * 0.3 && Math.abs(dy) < 1.4) hurtPlayer(w, T.SHOP_SHOT_DMG, e, 'shopkeeper');
        emit(w, 'enemyShot', { id: e.id, x: e.x, y: e.y + 0.9, z: e.z, face: e.face });
        w.shake = Math.max(w.shake, 0.25);
      }
    } else if (sees && e.cd <= 0 && dist < T.SHOP_SHOT_RANGE) { e.aim = T.SHOP_SHOT_WINDUP; emit(w, 'aim', { id: e.id }); }
    const fx = Math.sin(e.face), fz = Math.cos(e.face), k = Math.min(1, (e.ground ? 12 : 3) * dt);
    e.vx += (fx * want - e.vx) * k; e.vz += (fz * want - e.vz) * k;
  }
  if (e.cd > 0) e.cd -= dt;
  e.vy = Math.max(e.vy - T.GRAVITY * dt, -T.MAX_FALL);
  const hit = moveBody(w.grid, e, e.vx * dt, e.vy * dt, e.vz * dt);
  if (hit & 6) e.vy = 0;
  e.ground = (hit & 2) !== 0 || (e.vy <= 0 && onGround(w.grid, e));
  if ((hit & 9) && e.state === 'angry' && e.ground) e.vy = 9; // hops up after you
  if (e.state === 'angry' && alive && e.hurtT <= 0 && Math.hypot(dx, dz) < e.hw + p.hw && Math.abs(dy) < 1.1) hurtPlayer(w, 1, e, 'shopkeeper');
}

export function turnTo(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + Math.max(-k, Math.min(k, d));
}
const snapAxis = (a) => Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
