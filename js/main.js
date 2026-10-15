// Digg Well: the loop, the screens, and the wiring. title → play ⇄ pause → dead | won.
// window.GAME exposes the state for the smoke tests (and for poking at from the console).
import { T, DEPTHS, UPGRADES, ITEMS } from './sim/tuning.js';
import { createWorld, step, addWeapon, wareName } from './sim/world.js';
import { randomSeed } from './sim/rng.js';
import { View, CAM } from './render/view.js';
import { Input } from './input/input.js';
import { Audio } from './audio/audio.js';
import { Hud } from './ui/hud.js';
import { Pilot } from './sim/pilot.js';

const $ = (id) => document.getElementById(id);
const Q = new URLSearchParams(location.search);
const KEY = 'digg-well.best';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (_) { return {}; } };
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (_) { /* private mode */ } };
const muteKey = 'digg-well.mute';
let muted = false; try { muted = localStorage.getItem(muteKey) === '1'; } catch (_) { /* */ }

const view = new View($('view'));
const input = new Input();
const audio = new Audio();
audio.setMuted(muted);
const hud = new Hud();
input.bindZone($('zone'), $('stick-base'), $('stick-knob'));
input.bindButton($('b-jump'), 'jump');
input.bindButton($('b-attack'), 'attack');
input.bindButton($('b-use'), 'use');
input.bindTap($('b-weapon'), 'cycleW');
input.bindTap($('b-item'), 'cycleI');

const G = window.GAME = { state: 'title', world: null, view, input, audio, hud, seed: +Q.get('seed') || randomSeed(), best: load() };

if (window.TouchZoomGuard) window.TouchZoomGuard.init({ allowSelector: '[data-touch-allow]', onZoomChange: (z) => { if (z && G.state === 'play') pause(); } });
const isTouch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
if (isTouch() || Q.has('touch')) document.body.classList.add('touch-on');
window.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') document.body.classList.add('touch-on'); }, { capture: true });

// ------------------------------------------------------------------ worlds
function newWorld(seed) {
  const w = createWorld(seed);
  G.world = w;
  view.setWorld(w);
  hud.last = {};
  return w;
}

function skipTo(w, depth) { // ?depth=N (testing): drop into that depth's landing with a kit
  const st = w.lv.stories.find((s) => s.depth === depth - 1);
  if (!st) return;
  const p = w.player;
  p.x = st.entry.x; p.z = st.entry.z; p.y = st.floorTop + 0.01;
  p.gold = 120 * (depth - 1); p.maxHp = 5; p.hp = 5;
  if (depth > 1) { addWeapon(w, 'shotgun'); addWeapon(w, 'bombs'); p.weapon = 'shovel'; p.items.gin = 1; p.items.flare = 2; }
  w.depthIdx = depth - 1;
}

function start(seed = G.seed) {
  audio.unlock();
  G.seed = seed;
  const w = newWorld(seed);
  if (Q.get('depth')) skipTo(w, +Q.get('depth'));
  G.pilot = Q.has('autoplay') ? new Pilot(w, { attack: true }) : null; // ?autoplay: the pilot plays (demos, tests)
  G.state = 'play';
  input.enabled = true; input.reset();
  screen('');
  hud.show(true);
  hud.banner('DEPTH 1', DEPTHS[0].name);
  setTimeout(() => G.state === 'play' && hud.say('Now where’s that Golden Shovel…', w.player.x, w.player.y + 1.4, w.player.z, { id: 'p', cls: 'player', life: 3 }), 900);
}

function pause() {
  if (G.state !== 'play') return;
  G.state = 'pause'; input.enabled = false; input.reset();
  const w = G.world;
  screen(`<div class="card"><h2>Paused</h2>
    <div class="stats"><span>Depth</span><b>${w.depthIdx + 1} · ${DEPTHS[w.depthIdx].name}</b><span>Money</span><b>$${w.player.gold}</b><span>Seed</span><b>${w.seed}</b></div>
    <button class="btn" id="b-resume">Resume</button>
    <div class="row"><button class="btn alt" id="b-restart">Restart seed</button><button class="btn alt" id="b-mute">${audio.muted ? 'Sound on' : 'Mute'}</button></div>
    <button class="btn alt" id="b-quit">Quit to title</button>
    ${KEYS}</div>`);
  on('b-resume', resume); on('b-restart', () => start(G.seed)); on('b-quit', title); on('b-mute', () => { toggleMute(); pause2(); });
}
function pause2() { G.state = 'play'; pause(); }
function resume() { if (G.state !== 'pause') return; G.state = 'play'; input.enabled = true; input.reset(); screen(''); audio.unlock(); }
function toggleMute() { audio.setMuted(!audio.muted); try { localStorage.setItem(muteKey, audio.muted ? '1' : '0'); } catch (_) { /* */ } }

const KEYS = `<div class="keys"><kbd>WASD</kbd>/<kbd>←↑→↓</kbd> move · <kbd>Space</kbd> jump · <kbd>J</kbd>/<kbd>X</kbd>/click attack · <kbd>E</kbd>/right-click use · <kbd>Q</kbd> weapon · <kbd>Tab</kbd> item · <kbd>P</kbd> pause · <kbd>M</kbd> mute<br>
Attack in the air: plunge (digs down) · shotgun fires down and holds you up · USE near the piggy bank or a shop ware: pick up<br>Gamepad: stick move · A jump · X attack · B use · Y item · LB/RB weapon · Start pause</div>`;

function attract() { // the title screen's attract mode: the pilot plays the well behind the menu
  const w = newWorld(G.seed);
  w.player.hp = w.player.maxHp = 999;
  G.pilot = new Pilot(w, { attack: true });
  G.attractT = 0;
}

function title() {
  G.state = 'title'; input.enabled = false; input.reset();
  hud.show(false);
  attract();
  const b = G.best;
  screen(`<div class="card title">
    <div class="logo">DIGG WELL</div>
    <div class="logo-sub">The Tycoon goes down his own well, story by story, for the Golden Shovel at the bottom.</div>
    <button class="btn" id="b-start">Start digging</button>
    <div class="row"><button class="btn alt" id="b-reroll">New seed</button><button class="btn alt" id="b-mute">${audio.muted ? 'Sound on' : 'Mute'}</button></div>
    <div class="seed">Seed <b>${G.seed}</b>${b.deepest ? ` · best: depth ${b.deepest}` : ''}${b.wins ? ` · ${b.wins} Golden Shovel${b.wins > 1 ? 's' : ''}` : ''}${b.piggies ? ` · ${b.piggies} piggies saved` : ''}</div>
    ${KEYS}
    <p class="small">Money is power: the more you carry, the harder you hit. Stomp from above. Save each depth’s piggy bank. Don’t rob the shopkeeper.</p>
  </div>`);
  on('b-start', () => start(G.seed));
  on('b-reroll', () => { G.seed = randomSeed(); history.replaceState(null, '', `?seed=${G.seed}`); title(); });
  on('b-mute', () => { toggleMute(); title(); });
  focusFirst();
}

function endScreen(won) {
  const w = G.world, p = w.player, s = w.stats;
  input.enabled = false; input.reset();
  const saved = w.piggies.filter((q) => q === 'saved').length;
  const b = G.best;
  b.deepest = Math.max(b.deepest || 0, w.depthIdx + 1);
  b.piggies = (b.piggies || 0) + saved;
  if (won) b.wins = (b.wins || 0) + 1;
  save(b);
  const time = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`;
  screen(`<div class="card"><h2>${won ? 'The Golden Shovel!' : 'Down for good'}</h2>
    <p>${won ? 'The light of the Golden Shovel washed the crude off everyone in the Boardroom. They were your crew all along, Boss, and they were asking for help the whole way down.' : `Felled by ${CAUSE[w.cause] || w.cause || 'the well'} at depth ${w.depthIdx + 1}.`}</p>
    <div class="stats"><span>Money</span><b>$${p.gold}</b><span>Deepest</span><b>${DEPTHS[w.depthIdx].name}</b><span>Piggy banks saved</span><b>${saved} / 5</b>
    <span>Knocked out</span><b>${s.kills}</b><span>Stomps</span><b>${s.stomps}</b><span>Best combo</span><b>${s.bestCombo}</b><span>Blocks dug</span><b>${s.dug}</b>
    ${s.stolen ? `<span>Stolen goods</span><b>${s.stolen}</b>` : ''}${s.saved ? `<span>Employees washed</span><b>${s.saved}</b>` : ''}<span>Time</span><b>${time}</b><span>Seed</span><b>${w.seed}</b></div>
    <button class="btn" id="b-again">${won ? 'Dig again (new seed)' : 'Retry this seed'}</button>
    <button class="btn alt" id="b-new">${won ? 'Same seed' : 'New seed'}</button>
    <button class="btn alt" id="b-title">Title</button></div>`);
  on('b-again', () => start(won ? randomSeed() : w.seed));
  on('b-new', () => start(won ? w.seed : randomSeed()));
  on('b-title', title);
  focusFirst();
}
const CAUSE = { worker: 'an oil-drowned employee', 'burning worker': 'a burning employee', beetle: 'a beetle', snake: 'a snake', fly: 'an oil fly', bat: 'a bat', imp: 'an imp', fireball: 'imp fire', memo: 'a hellfire memo', boss: 'Chairman Devil', shockwave: 'the Chairman’s stomp', shopkeeper: 'the shopkeeper', saw: 'a drill saw', vent: 'a gas vent', vat: 'a tar kettle', ember: 'boiling tar', stalactite: 'a falling rock', thumper: 'a seismic thumper', bomb: 'your own dynamite', tnt: 'dynamite', barrel: 'an oil cask', fire: 'fire' };

function screen(html) { $('screen').innerHTML = html; }
function on(id, fn) { const el = $(id); if (el) el.addEventListener('click', () => { audio.unlock(); fn(); }); }
function focusFirst() { const b = $('screen').querySelector('.btn'); if (b) { menuI = 0; markFocus(); } }

// gamepad menus (hell-hole js/ui/menu-nav.js, smaller)
let menuI = 0;
function markFocus() { const bs = [...$('screen').querySelectorAll('.btn')]; bs.forEach((b, i) => b.classList.toggle('focus', i === menuI && G.padMenus)); }
input.onPad = (e) => {
  if (G.state === 'play') { if (e.start) pause(); return; }
  const bs = [...$('screen').querySelectorAll('.btn')];
  if (!bs.length) return;
  G.padMenus = true;
  if (e.down || e.right) menuI = (menuI + 1) % bs.length;
  if (e.up || e.left) menuI = (menuI - 1 + bs.length) % bs.length;
  markFocus();
  if (e.a) bs[menuI]?.click();
  if ((e.b || e.start) && G.state === 'pause') resume();
};

input.onKey = (k) => {
  if (k === 'm') { toggleMute(); return true; }
  if (k === 'p' || k === 'escape') { if (G.state === 'play') pause(); else if (G.state === 'pause') resume(); return true; }
  if (G.state === 'title' && (k === 'enter' || k === ' ')) { start(G.seed); return true; }
  if ((G.state === 'dead' || G.state === 'won') && k === 'enter' && G.world.endT > 1.2) { $('b-again')?.click(); return true; }
  return false;
};
$('b-pause').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (G.state === 'play') pause(); });

// ------------------------------------------------------------------ events → sound, HUD, view
const SAY_CLS = (e) => (e.boss ? 'boss' : e.saved ? 'saved' : e.piggy ? 'piggy' : e.imp ? 'imp' : e.player ? 'player' : e.loud ? 'loud' : '');
function events(w) {
  const p = w.player;
  if (G.state === 'title') { for (const e of w.events) view.onEvent(e); w.events.length = 0; return; }
  for (const e of w.events) {
    view.onEvent(e);
    switch (e.type) {
      case 'say': {
        const ent = e.id != null ? w.ents.find((q) => q.id === e.id) : null;
        const x = ent ? ent.x : p.x, y = ent ? ent.y + (ent.h || 0.9) + 0.35 : p.y + 1.4, z = ent ? ent.z : p.z;
        hud.say(e.text, x, y, z, { id: e.id ?? 'p', cls: SAY_CLS(e), life: e.boss ? 2.8 : 2.2 });
        if (ent && Math.hypot(ent.x - p.x, ent.z - p.z) < 10) audio.voice(e.boss ? 'boss' : e.piggy ? 'piggy' : e.imp ? 'imp' : ent.kind === 'shopkeeper' ? 'shop' : 'worker');
        break;
      }
      case 'gold': hud.float(`+$${e.value}`, e.x, e.y + 0.5, e.z); audio.play(e.value >= 5 ? 'bill' : 'coin'); break;
      case 'hurt': hud.float(`−♥${e.lost ? ` −$${e.lost}` : ''}`, p.x, p.y + 1.3, p.z, 'hurt'); audio.play('hurt'); input.rumble?.(); document.body.classList.add('hurt'); setTimeout(() => document.body.classList.remove('hurt'), 220); break;
      case 'die': audio.play('gameOver'); break;
      case 'kill': audio.play(e.ko ? 'stomp' : 'bonk'); if (e.combo >= 2) hud.float(`×${e.combo}`, e.x, e.y + 1.2, e.z, 'combo'); break;
      case 'combo': hud.combo(e.n, e.gold, e.heal); audio.play('combo'); break;
      case 'depth': hud.banner(DEPTHS[e.depth].shrine ? 'THE BOTTOM' : `DEPTH ${e.depth + 1}`, e.name); audio.play('depth'); break;
      case 'dark': hud.banner('PITCH DARK', 'light the lanterns · throw a flare', 'dark'); audio.play('dark'); break;
      case 'bossIntro': hud.banner('CHAIRMAN DEVIL', 'Chief Hell Operator · the Bedrock Boardroom', 'boss'); audio.play('bossTell'); break;
      case 'bossPhase': audio.play('anger'); break;
      case 'bossDown': hud.banner('MEETING ADJOURNED', 'the Golden Shovel is free', 'boss'); audio.play('bossDown'); break;
      case 'reveal': audio.play('reveal'); hud.banner('THE GOLDEN SHOVEL', 'the crude washes away…'); break;
      case 'won': G.state = 'won'; audio.play('win'); setTimeout(() => endScreen(true), 600); break;
      case 'piggySaved': hud.banner('PIGGY BANK SAVED!', `+$${e.gold} · ♥`); audio.play('piggySaved'); break;
      case 'piggyBreak': hud.banner('THE PIGGY BANK BROKE', 'oh no', 'alarm'); audio.play('piggyBreak'); break;
      case 'steal': hud.banner('STOLEN!', wareLabel(e.ware), 'alarm'); audio.play('steal'); break;
      case 'anger': if (e.first) setTimeout(() => hud.banner('WANTED', 'every shopkeeper will shoot on sight', 'alarm'), 900); audio.play('anger'); break;
      case 'buy': hud.float(`−$${e.price}`, p.x, p.y + 1.3, p.z, 'hurt'); audio.play('buy'); break;
      case 'nope': audio.play('nope'); if (e.why === 'gold') hud.float('not enough money', p.x, p.y + 1.4, p.z, 'hurt'); if (e.why === 'full') hud.float('already healthy', p.x, p.y + 1.4, p.z, 'heal'); break;
      case 'gin': hud.float('+♥♥ GIN XXX', p.x, p.y + 1.3, p.z, 'heal'); audio.play('gin'); break;
      case 'golden': hud.banner('GOLDEN SHOVEL!', 'nothing can hurt you'); audio.play('golden'); break;
      case 'item': audio.play('item'); if (e.id) hud.float(ITEMS[e.id]?.name || e.id, p.x, p.y + 1.3, p.z, 'heal'); break;
      case 'weapon': audio.play('weapon'); hud.float({ shotgun: 'SHOTGUN', bombs: 'DYNAMITE', pickaxe: 'PICKAXE' }[e.id] || e.id, p.x, p.y + 1.3, p.z); break;
      case 'upgrade': audio.play('upgrade'); hud.banner(UPGRADES[e.id].name, UPGRADES[e.id].desc); break;
      case 'washed': audio.play('washed'); break;
      case 'onFire': audio.play('onFire'); hud.float('ON FIRE!', p.x, p.y + 1.4, p.z, 'hurt'); break;
      case 'shotgun': audio.play('shotgun'); setTimeout(() => audio.play('pump'), 260); break;
      case 'boom': audio.play(e.src === 'tnt' ? 'bigBoom' : 'boom'); break;
      case 'jump': case 'jump2': audio.play('jump'); break;
      case 'land': if (e.v > 9) audio.play('land'); break;
      default: if (SFX_EVENTS.has(e.type)) audio.play(e.type);
    }
  }
  w.events.length = 0;
}
const SFX_EVENTS = new Set(['swing', 'dig', 'crack', 'clank', 'plunge', 'throw', 'fuse', 'stomp', 'lantern', 'flare', 'vent', 'spit', 'thump', 'rumble', 'shatter', 'buzz', 'screech', 'hiss', 'impThrow', 'ignite', 'enemyShot', 'aim', 'bossTell', 'bossSlam', 'bossVolley', 'piggyHit', 'cycle', 'mantle', 'snap', 'crate', 'planks', 'gurgle']);
const wareLabel = (w) => wareName({ ware: w });

// ------------------------------------------------------------------ the loop
let last = performance.now(), acc = 0, t = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - last) / 1000; last = now;
  const dt = Math.max(0, Math.min(raw, T.MAX_DT)); // house rule 2
  t += dt;
  input.pollPad();
  const w = G.world;
  if (!w) return;
  if (G.state === 'play' || G.state === 'dead' || G.state === 'won' || G.state === 'title') {
    acc += dt;
    let steps = 0;
    if (G.state === 'title' && ((G.attractT += dt) > 120 || w.lv.stories[w.storyIdx].kind === 'shrine')) { attract(); return; }
    while (acc >= T.STEP && steps < 8) {
      const ctl = G.pilot && (G.state === 'title' || G.state === 'play') ? G.pilot.control(T.STEP) : G.state === 'play' ? input.read(CAM.yaw) : IDLE;
      w._jumpHeld = ctl.jump;
      step(w, ctl, T.STEP);
      if (G.state === 'play') input.consume();
      acc -= T.STEP; steps++;
    }
    if (steps === 8) acc = 0;
  }
  if (w.state === 'dead' && G.state === 'play') { G.state = 'dead'; setTimeout(() => endScreen(false), 1300); }
  events(w);
  if (G.state === 'play') { audio.ambience(dt, w.depthIdx); audio.jingle(dt, w.player.golden > 0); }
  view.update(w, dt, t, { attract: G.state === 'title' });
  if (G.state !== 'title') hud.frame(w, view, dt);
}
const IDLE = { mx: 0, mz: 0, jump: false, jumpP: false, attackP: false, useP: false, cycleW: false, cycleI: false };

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  view.resize(w, h);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
window.addEventListener('blur', () => { if (G.state === 'play' && !Q.has('capture')) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'play') pause(); });

resize();
title();
requestAnimationFrame(frame);
Object.assign(G, { start, title, pause, resume, skipTo: (d) => skipTo(G.world, d) });
