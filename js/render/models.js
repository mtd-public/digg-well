// The cast, built from primitives (house rule: procedural). Faces +z, feet at y = 0, 1 unit = 1 m.
// Look: 1900s oil boom (There Will Be Blood) in a Simpsons-ish cartoon: bulgy eyes, big noses,
// yellow-skinned roughnecks half-drowned in crude, a bowler-hatted Tycoon, and a cartoon business devil.
import * as THREE from 'three';
import { G, Part, pivot, partMesh, inked, solid, glow } from './kit.js';
import { toon, glowMat, canvasTex, texMat, outlineMat } from './materials.js';

export const C = {
  skin: 0xf0c49a, nose: 0xe39a7a, tache: 0x3a2618, brow: 0x2a1a10, eyeW: 0xfffaf0, pupil: 0x14100c,
  suit: 0x3a2e28, suitDk: 0x2a201c, vest: 0x8a6a34, shirt: 0xf4ecd8, tie: 0x8a1a1a, hat: 0x1a1412, hatBand: 0x4a2a1a,
  brass: 0xc89a3a, brassDk: 0x7a5a1e, shoe: 0x1a1210, gold: 0xffc93a, steel: 0x8a909c, steelDk: 0x4a4e58, wood: 0x8a5a32, woodDk: 0x5a3a1e,
  yellow: 0xf2c84a, overall: 0x3a5a8a, plaid: 0xa83a2e, boots: 0x5a3a22, cap: 0x6a5a48, oil: 0x0a080c, oilHi: 0x5a5070,
  imp: 0xe8402a, impDk: 0xa82418, horn: 0xf4e6c8, pink: 0xff9ac0, pinkDk: 0xe07090,
};

// ------------------------------------------------------------------ shared face
function face(p, { y, r, skin, nose = C.nose, tache = null, monocle = false, overbite = false, brows = C.brow, eyeR = 0.055, sep = 0.075 }) {
  p.add(G.sphere(r, 18, 14), skin, { at: [0, y, 0] });
  p.add(G.sphere(r * 0.31, 10, 8), nose, { at: [0, y - r * 0.12, r * 0.95] });
  for (const s of [-1, 1]) {
    p.add(G.sphere(eyeR, 12, 10), C.eyeW, { at: [s * sep, y + r * 0.22, r * 0.8], tag: 1 });
    p.add(G.sphere(eyeR * 0.36, 8, 6), C.pupil, { at: [s * sep, y + r * 0.22, r * 0.8 + eyeR * 0.9], tag: 1 });
    p.add(G.box(0.07, 0.016, 0.02), brows, { at: [s * sep, y + r * 0.48, r * 0.86], rot: [0, 0, s * -0.25] });
    p.add(G.sphere(r * 0.18, 8, 6), skin, { at: [s * r * 0.98, y, 0] }); // ears
  }
  if (tache) for (const s of [-1, 1]) p.add(G.sphere(r * 0.3, 10, 8), tache, { at: [s * r * 0.24, y - r * 0.38, r * 0.86], scale: [1.2, 0.55, 0.7], rot: [0, 0, s * 0.35] });
  if (overbite) p.add(G.box(r * 0.5, r * 0.16, 0.03), C.eyeW, { at: [0, y - r * 0.48, r * 0.9], tag: 1 });
  if (monocle) p.add(G.torus(eyeR * 1.15, 0.008, 6, 16), C.brass, { at: [sep, y + r * 0.22, r * 0.8 + eyeR * 0.95], tag: 1 });
}

// ------------------------------------------------------------------ the Tycoon
// Returns { group, body, head, armL, armR, legL, legR, hand, lamp }.
export function makeTycoon() {
  const group = new THREE.Group();
  const root = new THREE.Group(); group.add(root);
  const legs = [];
  for (const s of [-1, 1]) {
    const p = new Part();
    p.add(G.cap(0.065, 0.12), C.suitDk, { at: [0, -0.12, 0] });
    p.add(G.sphere(0.075), C.shoe, { at: [0, -0.27, 0.035], scale: [1, 0.6, 1.45] });
    legs.push(pivot(root, p, [s * 0.09, 0.3, 0]));
  }
  const bp = new Part();
  bp.add(G.sphere(0.21, 18, 14), C.suit, { at: [0, 0.16, 0], scale: [1.05, 1.1, 0.95] }); // the paunch
  bp.add(G.sphere(0.17, 14, 10), C.vest, { at: [0, 0.15, 0.06], scale: [0.85, 1, 0.9] });
  bp.add(G.box(0.08, 0.16, 0.02), C.shirt, { at: [0, 0.27, 0.19], rot: [-0.25, 0, 0] });
  for (const s of [-1, 1]) bp.add(G.box(0.05, 0.022, 0.03), C.tie, { at: [s * 0.03, 0.36, 0.17], rot: [0, 0, s * 0.5] }); // bow tie
  bp.add(G.torus(0.07, 0.008, 5, 14, Math.PI), C.gold, { at: [0, 0.1, 0.205], rot: [0, 0, Math.PI] }); // watch chain
  for (let i = 0; i < 3; i++) bp.add(G.sphere(0.012, 6, 4), C.brassDk, { at: [0, 0.2 - i * 0.07, 0.2] });
  const body = pivot(root, bp, [0, 0.27, 0]);
  const arms = [];
  for (const s of [-1, 1]) {
    const p = new Part();
    p.add(G.cap(0.055, 0.16), C.suit, { at: [0, -0.11, 0] });
    p.add(G.sphere(0.06), C.skin, { at: [0, -0.24, 0.01] });
    arms.push(pivot(body, p, [s * 0.22, 0.27, 0]));
  }
  const hp = new Part();
  face(hp, { y: 0.15, r: 0.2, skin: C.skin, tache: C.tache, monocle: true });
  // bowler hat with a brass carbide lamp strapped on
  hp.add(G.sphere(0.19, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), C.hat, { at: [0, 0.28, -0.01], scale: [1.02, 0.95, 1.02] });
  hp.add(G.cyl(0.27, 0.27, 0.025, 22), C.hat, { at: [0, 0.285, -0.01] });
  hp.add(G.cyl(0.195, 0.195, 0.05, 20), C.hatBand, { at: [0, 0.32, -0.01] });
  hp.add(G.cyl(0.035, 0.04, 0.07, 10), C.brass, { at: [0, 0.37, 0.17], rot: [Math.PI / 2, 0, 0] });
  hp.add(G.cyl(0.06, 0.04, 0.03, 12), C.brass, { at: [0, 0.37, 0.215], rot: [Math.PI / 2, 0, 0] });
  const head = pivot(body, hp, [0, 0.36, 0]);
  const lamp = glow(G.sphere(0.03, 8, 6), 0xfff0b0); lamp.position.set(0, 0.37, 0.235); head.add(lamp);
  const hand = new THREE.Group(); hand.position.set(0, -0.24, 0.02); arms[1].add(hand);
  return { group, root, body, head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], hand, lamp };
}

// ------------------------------------------------------------------ tools in hand (pivot at the grip)
export function makeTool(kind, golden = false) {
  const g = new THREE.Group();
  const p = new Part();
  const steel = golden ? C.gold : C.steel;
  if (kind === 'shovel') {
    p.add(G.cyl(0.016, 0.016, 0.62, 8), golden ? 0xffe08a : C.wood, { at: [0, 0.12, 0] });
    p.add(G.torus(0.035, 0.01, 5, 10), golden ? 0xffe08a : C.woodDk, { at: [0, 0.45, 0] });
    p.add(G.sphere(0.09, 12, 8), steel, { at: [0, -0.26, 0.0], scale: [1, 1.35, 0.25] });
  } else if (kind === 'pickaxe') {
    p.add(G.cyl(0.018, 0.02, 0.56, 8), C.wood, { at: [0, 0.1, 0] });
    p.add(G.cone(0.03, 0.22, 6), steel, { at: [0.11, -0.18, 0], rot: [0, 0, -Math.PI / 2 - 0.25] });
    p.add(G.cone(0.03, 0.22, 6), steel, { at: [-0.11, -0.18, 0], rot: [0, 0, Math.PI / 2 + 0.25] });
    p.add(G.box(0.07, 0.06, 0.06), C.steelDk, { at: [0, -0.18, 0] });
  } else if (kind === 'shotgun') { // a double-barrel coach gun
    for (const s of [-1, 1]) p.add(G.cyl(0.018, 0.018, 0.44, 8), C.steelDk, { at: [s * 0.02, 0, 0.26], rot: [Math.PI / 2, 0, 0] });
    p.add(G.box(0.05, 0.06, 0.12), C.steel, { at: [0, -0.01, 0.04] });
    p.add(G.box(0.045, 0.09, 0.22), C.wood, { at: [0, -0.05, -0.1], rot: [0.3, 0, 0] });
  } else if (kind === 'bombs') { // a bundle of dynamite
    for (const [x, y] of [[-0.03, 0], [0.03, 0], [0, 0.045]]) p.add(G.cyl(0.026, 0.026, 0.18, 8), 0xc02a20, { at: [x, y, 0.06], rot: [Math.PI / 2, 0, 0] });
    p.add(G.box(0.1, 0.02, 0.03), 0x2a1a10, { at: [0, 0.02, 0.06] });
  }
  g.add(partMesh(p));
  if (kind === 'bombs') { const sp = glow(G.sphere(0.022, 6, 4), 0xffd060); sp.position.set(0, 0.06, 0.17); g.add(sp); g.userData.spark = sp; }
  return g;
}

// ------------------------------------------------------------------ oil workers (your employees)
// look: 0 coffee mug, 1 HELP sign, 2 lunch pail, 3 wrench. oil: how far down the crude reaches.
const nameTex = new Map();
function nameTag(name) {
  if (!nameTex.has(name)) nameTex.set(name, canvasTex(96, 40, (g, w, h) => {
    g.fillStyle = '#f4ecd8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a1a1a'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    g.fillStyle = '#8a1a1a'; g.font = 'bold 11px Georgia, serif'; g.textAlign = 'center'; g.fillText('HELLO my name is', w / 2, 13);
    g.fillStyle = '#1a1210'; g.font = 'bold 17px Georgia, serif'; g.fillText(name, w / 2, 33);
  }));
  return nameTex.get(name);
}
let helpTex = null;

export function makeWorker({ name = 'Gary', oil = 0.55, look = 0, side = 0, saved = false, crewHat = 0 } = {}) {
  const group = new THREE.Group();
  const root = new THREE.Group(); group.add(root);
  // the crude: everything above a wavy line (poured from above), or one side of them (side = 1)
  const H = 1.0, line = H * (1 - oil);
  const drenched = saved ? null : (x, y, z, tag) => {
    const wy = y + this_y;
    const wave = 0.05 * Math.sin(x * 23 + z * 11) + 0.03 * Math.sin(x * 51);
    const inOil = side ? x + wave * 2 > 0.02 - (wy - 0.5) * 0.2 && wy > 0.25 : wy > line + wave;
    if (!inOil) return null;
    if (tag === 1) return Math.random() < 0.5 ? null : 0x2a2430; // eyes stay white through the muck (mostly)
    return (Math.sin(x * 40 + wy * 30 + z * 20) > 0.93) ? C.oilHi : C.oil;
  };
  let this_y = 0;
  const legs = [];
  for (const s of [-1, 1]) {
    const p = new Part();
    p.add(G.cap(0.07, 0.15), C.overall, { at: [0, -0.13, 0] });
    p.add(G.sphere(0.08), C.boots, { at: [0, -0.3, 0.03], scale: [1, 0.65, 1.4] });
    this_y = 0.33; legs.push(pivot(root, p, [s * 0.09, 0.33, 0], drenched));
  }
  const bp = new Part();
  bp.add(G.cap(0.17, 0.12, 14), C.plaid, { at: [0, 0.15, 0] });
  bp.add(G.box(0.26, 0.18, 0.26), C.overall, { at: [0, 0.07, 0.01] }); // the bib
  for (const s of [-1, 1]) bp.add(G.box(0.035, 0.26, 0.02), C.overall, { at: [s * 0.085, 0.2, 0.15] }); // straps
  bp.add(G.box(0.1, 0.045, 0.012), 0xf4ecd8, { at: [-0.06, 0.24, 0.17], tag: 1 }); // the name tag's card (the text is a decal)
  this_y = 0.3; const body = pivot(root, bp, [0, 0.3, 0], drenched);
  const arms = [];
  for (const s of [-1, 1]) {
    const p = new Part();
    p.add(G.cap(0.055, 0.18), C.plaid, { at: [0, -0.12, 0] });
    p.add(G.sphere(0.06), C.yellow, { at: [0, -0.26, 0.01] });
    this_y = 0.6; arms.push(pivot(body, p, [s * 0.21, 0.29, 0], drenched));
  }
  const hp = new Part();
  face(hp, { y: 0.15, r: 0.19, skin: C.yellow, overbite: true, eyeR: 0.062, sep: 0.07, brows: 0x6a4a1a });
  // a flat cap, or a slouch hat
  if ((look + crewHat) % 2 === 0) { hp.add(G.sphere(0.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), C.cap, { at: [0, 0.27, -0.01], scale: [1.05, 0.5, 1.1] }); hp.add(G.box(0.22, 0.02, 0.12), C.cap, { at: [0, 0.27, 0.17], rot: [0.25, 0, 0] }); }
  else { hp.add(G.cyl(0.15, 0.17, 0.12, 14), 0x5a4030, { at: [0, 0.33, -0.01] }); hp.add(G.cyl(0.27, 0.27, 0.02, 18), 0x5a4030, { at: [0, 0.28, -0.01] }); }
  this_y = 0.66; const head = pivot(body, hp, [0, 0.36, 0], drenched);
  // the name tag decal
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.046), texMat(nameTag(name)));
  tag.position.set(-0.06, 0.24, 0.178); body.add(tag);
  // drips off the oil line (not on the saved)
  if (!saved) {
    const dm = toon(C.oil);
    for (let i = 0; i < 4; i++) { const d = new THREE.Mesh(G.sphere(0.03, 6, 5), dm); d.scale.set(1, 2.2, 1); d.position.set((i - 1.5) * 0.08, Math.max(0.05, line - 0.33 + 0.02) + (i % 2) * 0.04, 0.16 - (i % 3) * 0.08); body.add(d); }
  }
  // the gag in hand
  const hand = new THREE.Group(); hand.position.set(0, -0.26, 0.03); arms[0].add(hand);
  const gp = new Part();
  if (look === 0) { gp.add(G.cyl(0.04, 0.035, 0.08, 10), 0xf4ecd8, { at: [0, 0, 0.03] }); gp.add(G.torus(0.022, 0.007, 4, 8), 0xf4ecd8, { at: [0.045, 0, 0.03], rot: [0, Math.PI / 2, 0] }); }
  if (look === 2) { gp.add(G.box(0.14, 0.09, 0.08), 0x7a8a8a, { at: [0, -0.06, 0.03] }); gp.add(G.torus(0.04, 0.006, 4, 10, Math.PI), 0x4a4e58, { at: [0, -0.01, 0.03] }); }
  if (look === 3) { gp.add(G.cyl(0.012, 0.012, 0.22, 6), C.steel, { at: [0, -0.06, 0.03] }); gp.add(G.torus(0.03, 0.012, 5, 10, 4.5), C.steel, { at: [0, -0.18, 0.03] }); }
  if (look === 1) {
    gp.add(G.cyl(0.01, 0.01, 0.5, 5), C.wood, { at: [0, 0.15, 0.03] });
    helpTex ||= canvasTex(96, 64, (g, w, h) => { g.fillStyle = '#c8a46a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2a1a10'; g.font = 'bold 30px Georgia, serif'; g.textAlign = 'center'; g.fillText('HELP', w / 2, 42); g.strokeStyle = '#6a4a2a'; g.lineWidth = 3; g.strokeRect(2, 2, w - 4, h - 4); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), texMat(helpTex, { side: THREE.DoubleSide }));
    sign.position.set(0, 0.42, 0.05); hand.add(sign);
  }
  if (gp.geos.length) hand.add(partMesh(gp));
  return { group, root, body, head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], hand };
}

// ------------------------------------------------------------------ critters
export function makeBeetle() {
  const group = new THREE.Group();
  const p = new Part();
  p.add(G.sphere(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x3a2a5a, { at: [0, 0.12, 0], scale: [1, 0.9, 1.25] });
  p.add(G.box(0.012, 0.2, 0.55), 0x1a1228, { at: [0, 0.2, 0], rot: [0, 0, 0] });
  p.add(G.sphere(0.06, 8, 6), 0x9a8ac8, { at: [-0.08, 0.3, -0.02] });
  p.add(G.sphere(0.12, 12, 8), 0x1a1228, { at: [0, 0.12, 0.27] });
  for (const s of [-1, 1]) p.add(G.cone(0.02, 0.12, 5), 0x1a1228, { at: [s * 0.06, 0.1, 0.4], rot: [Math.PI / 2, 0, s * 0.6] });
  const shell = partMesh(p); group.add(shell);
  const legs = [];
  for (let i = 0; i < 6; i++) {
    const s = i % 2 ? 1 : -1, k = Math.floor(i / 2);
    const lg = new THREE.Group(); lg.position.set(s * 0.18, 0.1, -0.12 + k * 0.13);
    const m = new THREE.Mesh(G.cyl(0.014, 0.01, 0.2, 5), toon(0x1a1228)); m.position.set(s * 0.06, -0.04, 0); m.rotation.z = s * 1.0; lg.add(m);
    group.add(lg); legs.push(lg);
  }
  for (const s of [-1, 1]) { const e = glow(G.sphere(0.028, 6, 5), 0xff4a2a); e.position.set(s * 0.06, 0.17, 0.37); group.add(e); }
  return { group, legs, body: shell };
}

export function makeSnake() {
  const group = new THREE.Group();
  const segs = [];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const r = 0.11 - i * 0.01;
    const p = new Part();
    p.add(G.sphere(r, 12, 8), i % 2 ? 0x4a7a2e : 0x5a8a36);
    p.add(G.sphere(r * 0.8, 10, 6), 0xd8c050, { at: [0, -r * 0.35, 0] });
    if (i === 0) {
      p.add(G.sphere(0.12, 12, 8), 0x5a8a36, { at: [0, 0.04, 0.08], scale: [1, 0.8, 1.3] });
      for (const s of [-1, 1]) { p.add(G.sphere(0.04, 8, 6), C.eyeW, { at: [s * 0.06, 0.1, 0.15] }); p.add(G.sphere(0.018, 6, 4), C.pupil, { at: [s * 0.06, 0.1, 0.185] }); }
    }
    const m = partMesh(p); m.position.set(0, r, -i * 0.15); group.add(m); segs.push(m);
  }
  const tongue = new THREE.Mesh(G.box(0.02, 0.006, 0.12), toon(0xd02a3a)); tongue.position.set(0, 0.12, 0.3); segs[0].add(tongue); tongue.position.set(0, 0.0, 0.2);
  return { group, segs, tongue };
}

export function makeFly() {
  const group = new THREE.Group();
  const p = new Part();
  p.add(G.sphere(0.17, 12, 10), 0x1a1620, { scale: [1, 0.9, 1.15] });
  p.add(G.sphere(0.1, 10, 8), 0x2a2430, { at: [0, -0.02, -0.2] });
  for (const s of [-1, 1]) p.add(G.cyl(0.008, 0.005, 0.18, 4), 0x1a1620, { at: [s * 0.06, -0.14, 0.03], rot: [0, 0, s * 0.3] });
  const body = partMesh(p); group.add(body);
  for (const s of [-1, 1]) { const e = glow(G.sphere(0.07, 10, 8), 0xff3a3a); e.position.set(s * 0.08, 0.04, 0.12); group.add(e); }
  const wm = new THREE.MeshBasicMaterial({ color: 0xd8e0ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false });
  const wings = [];
  for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.16, 10), wm); w.geometry.translate(0.16, 0, 0); w.scale.set(s, 1, 0.55); w.position.set(s * 0.05, 0.12, 0); w.rotation.x = -Math.PI / 2; group.add(w); wings.push(w); }
  return { group, wings, body };
}

// cute little demon: big eyes, tiny horns, bat wings, a pointy tail
export function makeImp() {
  const group = new THREE.Group();
  const root = new THREE.Group(); group.add(root);
  const p = new Part();
  p.add(G.sphere(0.2, 16, 12), C.imp, { at: [0, 0.3, 0], scale: [1, 1.05, 0.95] });
  p.add(G.sphere(0.12, 12, 8), 0xff8a6a, { at: [0, 0.24, 0.12], scale: [1, 1.1, 0.5] });
  for (const s of [-1, 1]) {
    p.add(G.sphere(0.075, 12, 10), C.eyeW, { at: [s * 0.075, 0.38, 0.15], tag: 1 });
    p.add(G.sphere(0.045, 10, 8), 0x1a0a10, { at: [s * 0.075, 0.38, 0.2], tag: 1 });
    p.add(G.sphere(0.015, 6, 4), 0xffffff, { at: [s * 0.075 + 0.015, 0.4, 0.24], tag: 1 });
    p.add(G.cone(0.035, 0.11, 8), C.horn, { at: [s * 0.1, 0.52, 0.02], rot: [0, 0, s * -0.4] });
    p.add(G.cap(0.035, 0.06), C.impDk, { at: [s * 0.09, 0.06, 0.02] });
    p.add(G.sphere(0.04, 8, 6), C.impDk, { at: [s * 0.19, 0.24, 0.05] });
    p.add(G.sphere(0.03, 6, 5), 0xff8aa8, { at: [s * 0.12, 0.3, 0.17], scale: [1, 0.6, 0.4] }); // blush
  }
  p.add(G.torus(0.04, 0.01, 4, 10, Math.PI), 0x4a0a10, { at: [0, 0.31, 0.19], rot: [0, 0, Math.PI] }); // the grin
  const body = partMesh(p); root.add(body);
  const wm = toon(C.impDk, { side: THREE.DoubleSide });
  const wings = [];
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.22, 0.1); shape.lineTo(0.2, -0.02); shape.lineTo(0.14, 0.02); shape.lineTo(0.1, -0.06); shape.lineTo(0, 0);
    const w = new THREE.Mesh(new THREE.ShapeGeometry(shape), wm); w.scale.x = s; w.position.set(s * 0.08, 0.36, -0.14); group.add(w); wings.push(w);
  }
  const tail = new THREE.Group(); tail.position.set(0, 0.16, -0.17);
  const tp = new Part(); tp.add(G.cyl(0.012, 0.018, 0.22, 5), C.impDk, { at: [0, 0, -0.1], rot: [Math.PI / 2 - 0.4, 0, 0] }); tp.add(G.cone(0.04, 0.07, 4), C.impDk, { at: [0, 0.07, -0.21], rot: [-0.6, 0, 0] });
  tail.add(partMesh(tp)); root.add(tail);
  return { group, root, body, wings, tail };
}

// a cave bat: purple, big ears, membrane wings, little fangs
export function makeBat() {
  const group = new THREE.Group();
  const p = new Part();
  p.add(G.sphere(0.13, 12, 10), 0x3a2a4a, { scale: [1, 1.1, 0.95] });
  for (const s of [-1, 1]) {
    p.add(G.cone(0.05, 0.13, 6), 0x3a2a4a, { at: [s * 0.07, 0.15, 0], rot: [0, 0, s * -0.3] });
    p.add(G.cone(0.03, 0.08, 6), 0xd88aa8, { at: [s * 0.07, 0.14, 0.02], rot: [0, 0, s * -0.3] });
    p.add(G.cone(0.01, 0.04, 4), C.eyeW, { at: [s * 0.025, -0.06, 0.11], rot: [Math.PI, 0, 0] });
  }
  p.add(G.sphere(0.04, 8, 6), 0x5a4a6a, { at: [0, -0.02, 0.11] });
  const body = partMesh(p); group.add(body);
  for (const s of [-1, 1]) { const e = glow(G.sphere(0.026, 6, 5), 0xff3a3a); e.position.set(s * 0.05, 0.04, 0.11); group.add(e); }
  const wm = toon(0x2a1a36, { side: THREE.DoubleSide });
  const wings = [];
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape(); sh.moveTo(0, 0.04); sh.lineTo(0.32, 0.12); sh.lineTo(0.3, -0.02); sh.lineTo(0.22, 0.03); sh.lineTo(0.17, -0.07); sh.lineTo(0.1, -0.02); sh.lineTo(0.04, -0.08); sh.lineTo(0, -0.04);
    const wg = new THREE.Group(); wg.position.set(s * 0.08, 0.02, 0); const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), wm); m.scale.x = s; wg.add(m); group.add(wg); wings.push(wg);
  }
  return { group, body, wings };
}

// the general-store keeper: white beard, green visor, sleeve garters, a coach gun under the counter
export function makeShopkeeper({ beard = 0 } = {}) {
  const group = new THREE.Group();
  const root = new THREE.Group(); group.add(root);
  root.scale.setScalar(1.2);
  const legs = [];
  for (const s of [-1, 1]) { const p = new Part(); p.add(G.cap(0.075, 0.14), 0x3a3028, { at: [0, -0.12, 0] }); p.add(G.sphere(0.08), C.shoe, { at: [0, -0.28, 0.03], scale: [1, 0.6, 1.4] }); legs.push(pivot(root, p, [s * 0.1, 0.32, 0])); }
  const bp = new Part();
  bp.add(G.sphere(0.24, 16, 12), 0xe8e0cc, { at: [0, 0.16, 0], scale: [1.05, 1.1, 0.95] });
  bp.add(G.box(0.3, 0.34, 0.04), 0xd8cfb8, { at: [0, 0.08, 0.2] }); // apron
  bp.add(G.box(0.04, 0.34, 0.02), 0x4a3a2a, { at: [-0.12, 0.2, 0.18] }); bp.add(G.box(0.04, 0.34, 0.02), 0x4a3a2a, { at: [0.12, 0.2, 0.18] });
  const body = pivot(root, bp, [0, 0.3, 0]);
  const arms = [];
  for (const s of [-1, 1]) { const p = new Part(); p.add(G.cap(0.06, 0.17), 0xe8e0cc, { at: [0, -0.12, 0] }); p.add(G.torus(0.062, 0.012, 4, 10), 0xc02a2a, { at: [0, -0.06, 0], rot: [Math.PI / 2, 0, 0] }); p.add(G.sphere(0.065), C.skin, { at: [0, -0.26, 0.01] }); arms.push(pivot(body, p, [s * 0.25, 0.29, 0])); }
  const hp = new Part();
  face(hp, { y: 0.15, r: 0.2, skin: 0xe8b890, brows: 0xe8e8e8 });
  // whiskers by stock: 0 a modest mustache, 1 a big handlebar, 2 a beard you could lose a cat in
  if (beard === 2) { hp.add(G.sphere(0.24, 14, 10), 0xf4f4f0, { at: [0, -0.04, 0.08], scale: [1.1, 1.25, 0.85] }); hp.add(G.cone(0.14, 0.2, 10), 0xf4f4f0, { at: [0, -0.3, 0.1], rot: [Math.PI, 0, 0] }); }
  const tw = beard ? 0.11 : 0.06;
  for (const s of [-1, 1]) {
    hp.add(G.sphere(tw * 0.55, 10, 8), 0xf4f4f0, { at: [s * tw * 0.7, 0.08, 0.2], scale: [1.4, 0.6, 0.7], rot: [0, 0, s * 0.3] });
    if (beard >= 1) hp.add(G.torus(0.035, 0.014, 5, 10, Math.PI * 1.2), 0xf4f4f0, { at: [s * (tw * 1.5), 0.11, 0.19], rot: [0, 0, s > 0 ? -0.6 : Math.PI + 0.6] }); // the handlebar curls
  }
  hp.add(G.box(0.08, 0.02, 0.02), 0x3a1a10, { at: [0, 0.03, 0.2] });
  hp.add(G.cyl(0.21, 0.21, 0.05, 18, true), 0x3a8a4a, { at: [0, 0.31, 0] }); // visor band
  hp.add(G.cyl(0.2, 0.2, 0.01, 18, false, -Math.PI * 0.35, Math.PI * 0.7), 0x4ab05a, { at: [0, 0.3, 0.09], rot: [0.3, 0, 0] });
  const head = pivot(body, hp, [0, 0.38, 0]);
  const hand = new THREE.Group(); hand.position.set(0, -0.26, 0.02); arms[1].add(hand);
  const gun = makeTool('shotgun'); hand.add(gun);
  return { group, root, body, head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], hand, gun };
}

// the piggy bank: fragile, and it knows it
export function makePiggy() {
  const group = new THREE.Group();
  const p = new Part();
  p.add(G.sphere(0.24, 18, 14), C.pink, { at: [0, 0.27, 0], scale: [1, 0.9, 1.15] });
  p.add(G.cyl(0.08, 0.09, 0.07, 14), C.pinkDk, { at: [0, 0.26, 0.29], rot: [Math.PI / 2, 0, 0] });
  for (const s of [-1, 1]) {
    p.add(G.sphere(0.018, 6, 4), 0x6a2a3a, { at: [s * 0.03, 0.27, 0.33] });
    p.add(G.cone(0.06, 0.1, 6), C.pinkDk, { at: [s * 0.12, 0.47, 0.08], rot: [0.2, 0, s * -0.3] });
    p.add(G.sphere(0.045, 10, 8), C.eyeW, { at: [s * 0.09, 0.36, 0.22], tag: 1 });
    p.add(G.sphere(0.022, 6, 5), C.pupil, { at: [s * 0.09, 0.36, 0.26], tag: 1 });
    for (const z of [-0.12, 0.12]) p.add(G.cyl(0.045, 0.04, 0.1, 8), C.pinkDk, { at: [s * 0.12, 0.05, z] });
  }
  p.add(G.box(0.12, 0.02, 0.025), 0x3a1a20, { at: [0, 0.48, -0.02] }); // the coin slot
  p.add(G.torus(0.035, 0.01, 4, 10, Math.PI * 1.6), C.pinkDk, { at: [0, 0.3, -0.29], rot: [0, Math.PI / 2, 0] });
  const body = partMesh(p); group.add(body);
  const cracks = [];
  const cm = toon(0x3a1a20);
  for (let i = 0; i < 3; i++) { const c = new THREE.Mesh(G.box(0.012, 0.16 - i * 0.02, 0.012), cm); const a = i * 2.1 + 0.6; c.position.set(Math.sin(a) * 0.23, 0.3 + (i - 1) * 0.04, Math.cos(a) * 0.26); c.rotation.set(0.3, a, 0.5 - i * 0.4); c.visible = false; group.add(c); cracks.push(c); }
  return { group, body, cracks };
}

// CHAIRMAN DEVIL: split down the middle. His right (our left): a robber baron in a pinstripe frock
// coat and top hat. His left: a cartoon devil, red, horned, one bat wing, a hoof and a tail.
export function makeBoss() {
  const group = new THREE.Group();
  const root = new THREE.Group(); group.add(root);
  root.scale.setScalar(2.2);
  const SUIT = 0x2a2a34, PIN = 0x4a4a58, RED = 0xd02a1a, REDDK = 0x8a1410, SKIN = 0xf0c49a;
  const split = (suit, devil) => (x) => (x < 0 ? suit : devil);
  const recol = (suit, devil) => (x) => (x < -0.002 ? suit : devil);
  const legs = [];
  for (const s of [-1, 1]) {
    const p = new Part();
    const c = s < 0 ? SUIT : RED;
    p.add(G.cap(0.07, 0.13), c, { at: [0, -0.12, 0] });
    p.add(s < 0 ? G.sphere(0.075) : G.cyl(0.05, 0.065, 0.08, 6), s < 0 ? C.shoe : 0x2a1a10, { at: [0, -0.27, s < 0 ? 0.035 : 0], scale: s < 0 ? [1, 0.6, 1.45] : [1, 1, 1] });
    legs.push(pivot(root, p, [s * 0.09, 0.3, 0]));
  }
  const bp = new Part();
  bp.add(G.sphere(0.2, 20, 14), 0, { at: [0, 0.17, 0], scale: [1.05, 1.15, 0.95] });
  bp.add(G.box(0.07, 0.2, 0.02), C.shirt, { at: [-0.03, 0.25, 0.185], rot: [-0.2, 0, 0], tag: 1 });
  bp.add(G.box(0.035, 0.18, 0.02), C.tie, { at: [-0.01, 0.22, 0.2], rot: [-0.2, 0, 0], tag: 1 });
  bp.add(G.torus(0.06, 0.008, 5, 14, Math.PI), C.gold, { at: [-0.08, 0.1, 0.19], rot: [0, 0, Math.PI], tag: 1 });
  const body = pivot(root, bp, [0, 0.27, 0], (x, y, z, tag) => (tag === 1 ? null : x < 0 ? (Math.sin(x * 120) > 0.75 ? PIN : SUIT) : RED));
  const arms = [];
  for (const s of [-1, 1]) {
    const p = new Part();
    p.add(G.cap(0.055, 0.17), s < 0 ? SUIT : RED, { at: [0, -0.12, 0] });
    p.add(G.sphere(0.06), s < 0 ? SKIN : REDDK, { at: [0, -0.25, 0.01] });
    if (s > 0) for (let k = 0; k < 3; k++) p.add(G.cone(0.012, 0.05, 4), 0x1a0a0a, { at: [(k - 1) * 0.025, -0.3, 0.03], rot: [Math.PI, 0, 0] }); // claws
    arms.push(pivot(body, p, [s * 0.22, 0.28, 0]));
  }
  const hp = new Part();
  hp.add(G.sphere(0.19, 20, 14), 0, { at: [0, 0.15, 0] });
  hp.add(G.sphere(0.06, 10, 8), 0, { at: [0, 0.12, 0.18] });
  for (const s of [-1, 1]) {
    hp.add(G.sphere(0.05, 12, 10), s < 0 ? C.eyeW : 0xffe040, { at: [s * 0.07, 0.2, 0.15], tag: 1 });
    hp.add(G.sphere(0.02, 6, 5), s < 0 ? C.pupil : 0x1a0a0a, { at: [s * 0.07, 0.2, 0.195], scale: s < 0 ? [1, 1, 1] : [0.4, 1.4, 1], tag: 1 });
    hp.add(G.box(0.08, 0.018, 0.02), s < 0 ? 0x1a1412 : 0x1a0a0a, { at: [s * 0.07, 0.26, 0.17], rot: [0, 0, s * 0.45] });
  }
  hp.add(G.sphere(0.03, 8, 6), 0x1a1412, { at: [-0.05, 0.075, 0.17], scale: [1.4, 0.5, 0.6], tag: 1 }); // half a mustache
  hp.add(G.cone(0.035, 0.08, 6), 0x1a0a0a, { at: [0.03, -0.03, 0.15], rot: [Math.PI + 0.3, 0, 0], tag: 1 }); // half a goatee
  hp.add(G.box(0.13, 0.02, 0.02), C.eyeW, { at: [0, 0.06, 0.18], tag: 1 }); // the grin
  for (let k = 0; k < 2; k++) hp.add(G.cone(0.012, 0.03, 4), C.eyeW, { at: [0.025 + k * 0.03, 0.045, 0.185], rot: [Math.PI, 0, 0], tag: 1 }); // fangs (devil side)
  hp.add(G.cone(0.05, 0.16, 8), 0x1a0a0a, { at: [0.11, 0.33, 0], rot: [0, 0, -0.5] }); // the horn
  // the top hat on the suit side
  hp.add(G.cyl(0.11, 0.115, 0.2, 16), 0x141418, { at: [-0.06, 0.4, 0], rot: [0, 0, 0.15] });
  hp.add(G.cyl(0.19, 0.19, 0.015, 18), 0x141418, { at: [-0.05, 0.3, 0], rot: [0, 0, 0.15] });
  hp.add(G.cyl(0.116, 0.116, 0.035, 16), 0x8a1a1a, { at: [-0.055, 0.33, 0], rot: [0, 0, 0.15] });
  const head = pivot(body, hp, [0, 0.37, 0], (x, y, z, tag) => (tag === 1 ? null : x < -0.002 ? (y > 0.29 ? null : SKIN) : (y > 0.28 && x > 0.05 ? null : RED)));
  // one bat wing, a tail
  const wing = new THREE.Group(); wing.position.set(0.12, 0.3, -0.14);
  const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.42, 0.24); sh.lineTo(0.4, 0.02); sh.lineTo(0.3, 0.08); sh.lineTo(0.24, -0.06); sh.lineTo(0.14, 0.0); sh.lineTo(0.06, -0.1); sh.lineTo(0, 0);
  wing.add(new THREE.Mesh(new THREE.ShapeGeometry(sh), toon(REDDK, { side: THREE.DoubleSide }))); body.add(wing);
  const tail = new THREE.Group(); tail.position.set(0.05, 0.05, -0.18);
  const tp = new Part(); tp.add(G.cyl(0.012, 0.02, 0.3, 6), RED, { at: [0, -0.05, -0.12], rot: [Math.PI / 2 + 0.6, 0, 0] }); tp.add(G.cone(0.045, 0.08, 4), RED, { at: [0, -0.15, -0.25], rot: [-Math.PI / 2 - 0.8, 0, 0] });
  tail.add(partMesh(tp)); body.add(tail);
  // a briefcase in the suit hand, a pitchfork in the devil's
  const brief = new Part(); brief.add(G.box(0.18, 0.13, 0.05), 0x5a3a1e, { at: [0, -0.1, 0] }); brief.add(G.torus(0.03, 0.008, 4, 8, Math.PI), C.brass, { at: [0, -0.03, 0] });
  const handL = new THREE.Group(); handL.position.set(0, -0.26, 0.02); arms[0].add(handL); handL.add(partMesh(brief));
  const fork = new Part(); fork.add(G.cyl(0.01, 0.01, 0.7, 6), 0x2a2a2a, { at: [0, 0.15, 0] }); for (const x of [-0.04, 0, 0.04]) fork.add(G.cone(0.012, 0.09, 4), 0x2a2a2a, { at: [x, 0.53, 0] }); fork.add(G.box(0.1, 0.015, 0.015), 0x2a2a2a, { at: [0, 0.48, 0] });
  const handR = new THREE.Group(); handR.position.set(0, -0.26, 0.02); arms[1].add(handR); handR.add(partMesh(fork));
  const eye = glow(G.sphere(0.02, 6, 5), 0xffd040); eye.position.set(0.07, 0.2, 0.2); head.add(eye);
  return { group, root, body, head, legL: legs[0], legR: legs[1], armL: arms[0], armR: arms[1], wing, tail };
}
