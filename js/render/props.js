// Props, pickups, decor and hazards. 1900s oil-boom stuff: wooden casks, dynamite crates,
// kerosene lanterns, woodtype signs, timber shoring, mine rails. Hazards are dr-mow's
// (js/models.js and js/scene.js there: createSaw, createSawTrack, createSpout, createAcidVat,
// createIcicleChunk, createMine), turned to iron and brass.
import * as THREE from 'three';
import { G, Part, partMesh, inked, solid, glow } from './kit.js';
import { toon, glowMat, canvasTex, texMat, outlineMat, cutaway } from './materials.js';
import { C } from './models.js';

const WOOD = 0x7a5232, WOODDK = 0x4a2e18, IRON = 0x3a3a44, IRONLT = 0x6a6a78, RUST = 0x8a4a2a;
const FONT = '"Rye", "Georgia", serif';
const texCache = new Map();
const tex = (key, w, h, draw, opts) => { if (!texCache.has(key)) texCache.set(key, canvasTex(w, h, draw, opts)); return texCache.get(key); };

let _stripe = null;
const stripeTex = () => (_stripe ||= canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#ffcc1a'; c.fillRect(0, 0, w, h); c.fillStyle = '#1e1a22'; for (let i = -2; i < 4; i++) { c.beginPath(); c.moveTo(i * 22, 0); c.lineTo(i * 22 + 11, 0); c.lineTo(i * 22 + 11 + h, h); c.lineTo(i * 22 + h, h); c.fill(); } }, { repeat: [3, 1] }));

// ------------------------------------------------------------------ props
export function makeBarrel() { // a wooden oil cask with iron hoops and a stencilled flame
  const g = new THREE.Group();
  const p = new Part();
  p.add(G.cyl(0.3, 0.3, 0.8, 16), WOOD, { at: [0, 0.4, 0], scale: [1, 1, 1] });
  p.add(G.sphere(0.34, 16, 10), WOOD, { at: [0, 0.4, 0], scale: [1, 1.15, 1] });
  for (const y of [0.12, 0.4, 0.68]) p.add(G.torus(y === 0.4 ? 0.345 : 0.315, 0.022, 5, 18), IRON, { at: [0, y, 0], rot: [Math.PI / 2, 0, 0] });
  p.add(G.cyl(0.27, 0.27, 0.02, 14), WOODDK, { at: [0, 0.81, 0] });
  g.add(partMesh(p, (x, y) => (y > 0.82 || y < -0.01 ? WOODDK : null)));
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.3), texMat(tex('crude', 96, 84, (c, w, h) => { c.fillStyle = '#d8c090'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a1a10'; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6); c.fillStyle = '#b02a1a'; c.beginPath(); c.moveTo(48, 12); c.quadraticCurveTo(70, 40, 56, 58); c.quadraticCurveTo(48, 46, 46, 56); c.quadraticCurveTo(28, 44, 48, 12); c.fill(); c.fillStyle = '#2a1a10'; c.font = `bold 15px ${FONT}`; c.textAlign = 'center'; c.fillText('CRUDE', 48, 78); })));
  label.position.set(0, 0.42, 0.345); g.add(label);
  return g;
}

export function makeTNT() { // a crate of dynamite
  const g = new THREE.Group();
  const t = tex('dyn', 128, 96, (c, w, h) => { c.fillStyle = '#9a6a3a'; c.fillRect(0, 0, w, h); c.fillStyle = '#7a4e28'; for (let y = 0; y < h; y += 24) c.fillRect(0, y + 21, w, 3); c.fillStyle = '#c02a1a'; c.font = `bold 22px ${FONT}`; c.textAlign = 'center'; c.fillText('DYNAMITE', w / 2, 44); c.fillStyle = '#1a1210'; c.font = `12px ${FONT}`; c.fillText('DANGER · HANDLE WITH CARE', w / 2, 66); c.strokeStyle = '#2a1a0c'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); });
  const box = new THREE.Mesh(G.box(0.68, 0.56, 0.68), texMat(t)); box.position.y = 0.28; g.add(box);
  const p = new Part();
  for (let i = 0; i < 4; i++) p.add(G.cyl(0.04, 0.04, 0.3, 8), 0xc02a20, { at: [-0.15 + i * 0.1, 0.6, 0], rot: [0, 0, 0] });
  p.add(G.cyl(0.006, 0.006, 0.12, 4), 0x2a2a2a, { at: [0.05, 0.8, 0], rot: [0, 0, 0.6] });
  g.add(partMesh(p));
  const spark = glow(G.sphere(0.04, 6, 5), 0xffd060); spark.position.set(0.09, 0.85, 0); spark.visible = false; g.add(spark);
  g.userData.spark = spark;
  return g;
}

export function makeCrate(cart = false) {
  const g = new THREE.Group();
  if (cart) { // a mine cart on little iron wheels, full of something
    const p = new Part();
    p.add(G.box(0.7, 0.36, 0.56), RUST, { at: [0, 0.34, 0] });
    p.add(G.box(0.62, 0.05, 0.48), 0x2a2018, { at: [0, 0.5, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.cyl(0.1, 0.1, 0.05, 10), IRON, { at: [sx * 0.25, 0.1, sz * 0.3], rot: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < 5; i++) p.add(G.ico(0.1, 0), 0x5a4030, { at: [(i - 2) * 0.12, 0.54, (i % 2) * 0.1 - 0.05] });
    g.add(partMesh(p));
    return g;
  }
  const t = tex('crate', 96, 96, (c, w, h) => { c.fillStyle = '#a07040'; c.fillRect(0, 0, w, h); c.fillStyle = '#80542c'; for (let y = 0; y < h; y += 24) c.fillRect(0, y + 21, w, 3); c.strokeStyle = '#4a2e14'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8); c.beginPath(); c.moveTo(8, 8); c.lineTo(w - 8, h - 8); c.stroke(); c.fillStyle = '#2a1a0c'; c.font = `bold 12px ${FONT}`; c.textAlign = 'center'; c.fillText('TYCOON OIL', w / 2, 30); c.fillText('EST. 1898', w / 2, 78); });
  const box = new THREE.Mesh(G.box(0.7, 0.7, 0.7), texMat(t)); box.position.y = 0.35; g.add(box);
  return g;
}

// ------------------------------------------------------------------ money and pickups
export const coinGeo = (() => { const g = new THREE.CylinderGeometry(0.11, 0.11, 0.028, 16); g.rotateX(Math.PI / 2); return g; })();
export const coinMat = new THREE.MeshToonMaterial({ color: 0xffc93a, emissive: 0x6a4a08 });
export const billGeo = new THREE.PlaneGeometry(0.26, 0.12);
export const billMat = new THREE.MeshToonMaterial({ map: canvasTex(128, 60, (c, w, h) => {
  c.fillStyle = '#7ab07a'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a5a2a'; c.lineWidth = 4; c.strokeRect(3, 3, w - 6, h - 6);
  c.fillStyle = '#d8ecc8'; c.beginPath(); c.ellipse(w / 2, h / 2, 16, 20, 0, 0, 7); c.fill(); c.fillStyle = '#2a5a2a'; c.font = `bold 26px ${FONT}`; c.textAlign = 'center'; c.fillText('$', w / 2, h / 2 + 9);
  c.font = `bold 14px ${FONT}`; c.fillText('10', 18, 20); c.fillText('10', w - 18, h - 10);
}), side: THREE.DoubleSide, emissive: 0x1a3a1a });

export function makeGin() { // a squat glass bottle: GIN XXX
  const g = new THREE.Group();
  const glass = new THREE.MeshToonMaterial({ color: 0x6ad46a, transparent: true, opacity: 0.85, emissive: 0x1a4a1a });
  const b = inked(new THREE.LatheGeometry([[0, 0], [0.11, 0], [0.12, 0.04], [0.12, 0.2], [0.06, 0.27], [0.035, 0.3], [0.035, 0.36], [0, 0.36]].map(([x, y]) => new THREE.Vector2(x, y)), 14), glass); g.add(b);
  const cork = new THREE.Mesh(G.cyl(0.03, 0.028, 0.05, 8), toon(0xb08a5a)); cork.position.y = 0.38; g.add(cork);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.123, 0.123, 0.1, 14, 1, true, -0.9, 1.8), texMat(tex('gin', 96, 48, (c, w, h) => { c.fillStyle = '#f0e2c0'; c.fillRect(0, 0, w, h); c.fillStyle = '#1a1210'; c.font = `bold 13px ${FONT}`; c.textAlign = 'center'; c.fillText('GIN', w / 2, 18); c.fillStyle = '#b02a1a'; c.font = `bold 20px ${FONT}`; c.fillText('XXX', w / 2, 40); })));
  label.position.y = 0.12; g.add(label);
  return g;
}

export function makeShard() { // a little golden shovel: Golden Shovel status in a bottle, as it were
  const g = new THREE.Group();
  const p = new Part();
  p.add(G.cyl(0.02, 0.02, 0.4, 8), 0xffe08a, { at: [0, 0.3, 0] });
  p.add(G.torus(0.04, 0.012, 5, 10), 0xffe08a, { at: [0, 0.52, 0] });
  p.add(G.sphere(0.1, 12, 8), C.gold, { at: [0, 0.06, 0], scale: [1, 1.3, 0.25] });
  const m = partMesh(p); m.material = new THREE.MeshToonMaterial({ vertexColors: true, emissive: 0x6a4a00 }); g.add(m);
  return g;
}

export function makeFlare(lit = false) {
  const g = new THREE.Group();
  const p = new Part();
  p.add(G.cyl(0.03, 0.03, 0.24, 8), 0xc0281a, { at: [0, 0.12, 0] });
  p.add(G.cyl(0.032, 0.032, 0.04, 8), 0xf0e0c0, { at: [0, 0.2, 0] });
  g.add(partMesh(p));
  if (lit) { const f = glow(G.sphere(0.08, 8, 6), 0xff6a5a); f.position.y = 0.27; g.add(f); g.userData.flame = f; }
  return g;
}

export function makeWeaponPickup(kind) {
  const g = new THREE.Group();
  const p = new Part();
  if (kind === 'shotgun') {
    for (const s of [-1, 1]) p.add(G.cyl(0.022, 0.022, 0.6, 8), IRON, { at: [s * 0.024, 0.08, 0.1], rot: [Math.PI / 2, 0, 0] });
    p.add(G.box(0.06, 0.07, 0.14), IRONLT, { at: [0, 0.07, -0.22] });
    p.add(G.box(0.055, 0.11, 0.3), WOOD, { at: [0, 0.03, -0.42], rot: [0.25, 0, 0] });
  } else if (kind === 'bombs') {
    for (let i = 0; i < 5; i++) p.add(G.cyl(0.035, 0.035, 0.26, 8), 0xc02a20, { at: [(i - 2) * 0.075, 0.05 + (i % 2) * 0.05, 0], rot: [Math.PI / 2, 0, 0] });
    p.add(G.box(0.4, 0.03, 0.04), 0x3a2414, { at: [0, 0.07, 0] });
  } else if (kind === 'pickaxe') {
    p.add(G.cyl(0.02, 0.022, 0.62, 8), WOOD, { at: [0, 0.06, 0], rot: [Math.PI / 2, 0, 0] });
    p.add(G.cone(0.035, 0.26, 6), C.steel, { at: [0.13, 0.06, 0.3], rot: [0, 0, -Math.PI / 2] });
    p.add(G.cone(0.035, 0.26, 6), C.steel, { at: [-0.13, 0.06, 0.3], rot: [0, 0, Math.PI / 2] });
  } else if (kind === 'shells') {
    p.add(G.box(0.3, 0.16, 0.2), 0x8a2a1a, { at: [0, 0.08, 0] });
    for (let i = 0; i < 4; i++) p.add(G.cyl(0.025, 0.025, 0.08, 8), 0xc8a040, { at: [-0.1 + i * 0.065, 0.2, 0] });
  }
  g.add(partMesh(p));
  return g;
}

// an upgrade: a brass badge floating on a pedestal, its icon painted on
const ICONS = { steeltoe: '🥾', spring: '⤒', overalls: '♥+', magnet: 'U', lamp: '☀', rocket: '⇈', gloves: '✋', teeth: '$', choke: '∴', heart: '♥', shard: '★', gin: 'XXX', bombs: '✸', shotgun: '‖', pickaxe: '⛏', shells: '●●', flares: '!' };
export function makeBadge(id) {
  const g = new THREE.Group();
  const t = tex('badge' + id, 96, 96, (c, w, h) => {
    const gr = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, 46); gr.addColorStop(0, '#ffe8a0'); gr.addColorStop(1, '#c8902a');
    c.fillStyle = gr; c.beginPath(); c.arc(w / 2, h / 2, 44, 0, 7); c.fill(); c.strokeStyle = '#5a3a0a'; c.lineWidth = 5; c.stroke();
    c.fillStyle = '#3a2208'; c.font = `bold ${ICONS[id]?.length > 2 ? 22 : 40}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ICONS[id] || '?', w / 2, h / 2 + 2);
  });
  const disc = new THREE.Mesh(G.cyl(0.2, 0.2, 0.05, 20), [toon(0xc8902a), texMat(t), texMat(t)]);
  disc.rotation.x = Math.PI / 2; disc.position.y = 0.55; g.add(disc);
  g.userData.spin = disc;
  return g;
}

export function makePedestal() {
  const p = new Part();
  p.add(G.cyl(0.24, 0.3, 0.12, 12), 0x5a5048, { at: [0, 0.06, 0] });
  p.add(G.cyl(0.16, 0.2, 0.3, 12), 0x6a6058, { at: [0, 0.27, 0] });
  p.add(G.cyl(0.26, 0.22, 0.06, 12), 0x5a5048, { at: [0, 0.45, 0] });
  return partMesh(p);
}

export function priceTag(text) {
  const c = document.createElement('canvas'); c.width = 128; c.height = 48;
  const g = c.getContext('2d');
  g.fillStyle = '#f4e6c0'; g.beginPath(); g.moveTo(14, 4); g.lineTo(124, 4); g.lineTo(124, 44); g.lineTo(14, 44); g.lineTo(2, 24); g.closePath(); g.fill();
  g.strokeStyle = '#5a3a1a'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#2a1a0c'; g.font = `bold 24px ${FONT}`; g.textAlign = 'center'; g.fillText(text, 70, 33);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
  s.scale.set(0.5, 0.19, 1); s.renderOrder = 8;
  return s;
}

// ------------------------------------------------------------------ light fixtures
// A kerosene lantern on a wall bracket (or on a post by a hole in the dark). Its globe glows when lit.
export function makeLantern({ post = false, brazier = false } = {}) {
  const g = new THREE.Group();
  if (brazier) { // the Boardroom's brass standing lamps
    const p = new Part();
    p.add(G.cyl(0.16, 0.22, 0.08, 12), C.brass, { at: [0, 0.04, 0] });
    p.add(G.cyl(0.03, 0.03, 1.4, 8), C.brass, { at: [0, 0.75, 0] });
    p.add(G.cyl(0.18, 0.3, 0.28, 14, true), 0x8a2a1a, { at: [0, 1.5, 0] });
    g.add(partMesh(p));
    const bulb = glow(G.sphere(0.1, 10, 8), 0xffd890); bulb.position.y = 1.42; g.add(bulb); g.userData.globe = bulb;
    return g;
  }
  const p = new Part();
  if (post) { p.add(G.cyl(0.04, 0.05, 1.3, 8), WOODDK, { at: [0, 0.65, 0] }); p.add(G.box(0.3, 0.04, 0.04), WOODDK, { at: [0.12, 1.28, 0] }); }
  else { p.add(G.box(0.04, 0.04, 0.26), IRON, { at: [0, 0.32, -0.1] }); p.add(G.box(0.12, 0.16, 0.03), IRON, { at: [0, 0.26, -0.22] }); }
  const ox = post ? 0.24 : 0, oy = post ? 0.98 : 0, oz = post ? 0 : 0.02;
  p.add(G.cyl(0.09, 0.1, 0.05, 12), C.brass, { at: [ox, oy + 0.02, oz] });
  p.add(G.cyl(0.05, 0.09, 0.06, 12), C.brass, { at: [ox, oy + 0.27, oz] });
  p.add(G.torus(0.05, 0.008, 4, 10), IRON, { at: [ox, oy + 0.36, oz] });
  for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2; p.add(G.cyl(0.007, 0.007, 0.22, 4), IRON, { at: [ox + Math.cos(a) * 0.085, oy + 0.15, oz + Math.sin(a) * 0.085] }); }
  g.add(partMesh(p));
  const globe = new THREE.Mesh(G.sphere(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: 0x2a2018 }));
  globe.position.set(ox, oy + 0.15, oz); globe.scale.y = 1.25; g.add(globe);
  g.userData.globe = globe;
  return g;
}

// ------------------------------------------------------------------ decor
export function makeSign(text, sub) { // a woodtype board on two nails
  const g = new THREE.Group();
  const t = canvasTex(256, 128, (c, w, h) => {
    c.fillStyle = '#6a4424'; c.fillRect(0, 0, w, h); c.fillStyle = '#5a361a'; for (let y = 0; y < h; y += 32) c.fillRect(0, y + 29, w, 3);
    c.strokeStyle = '#2a1608'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#f0dca0'; c.font = `bold 40px ${FONT}`; c.textAlign = 'center'; c.fillText(text, w / 2, sub ? 58 : 76);
    if (sub) { c.font = `22px ${FONT}`; c.fillStyle = '#e0c080'; c.fillText(sub.toUpperCase(), w / 2, 98); }
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.85), texMat(t)); g.add(m);
  return g;
}

const GAGS = {
  accident: ['DAYS WITHOUT', 'AN ACCIDENT', '0'],
  employee: ['EMPLOYEE', 'OF THE MONTH', '(oil)'],
  safety: ['SAFETY', 'IS JOB #7', ''],
  hang: ['HANG IN', 'THERE!', ''],
  oilco: ['TYCOON OIL CO.', 'WE DIG DEEPER', 'est. 1898'],
  suggest: ['SUGGESTION BOX', 'complaints: down', '↓'],
};
export function makePoster(gag) {
  const [a, b, c3] = GAGS[gag] || GAGS.oilco;
  const t = tex('poster' + gag, 160, 200, (c, w, h) => {
    c.fillStyle = '#e8d8b0'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(120,80,30,0.25)'; c.fillRect(0, h - 30, w, 30);
    c.strokeStyle = '#3a2410'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
    c.fillStyle = '#8a1a1a'; c.font = `bold 20px ${FONT}`; c.textAlign = 'center'; c.fillText(a, w / 2, 42);
    c.fillStyle = '#1a1210'; c.font = `17px ${FONT}`; c.fillText(b, w / 2, 70);
    if (gag === 'accident') { c.fillStyle = '#1a1210'; c.fillRect(48, 92, 64, 72); c.fillStyle = '#f0e0b0'; c.font = `bold 60px ${FONT}`; c.fillText('0', w / 2, 150); }
    else if (gag === 'employee') { c.fillStyle = '#f2c84a'; c.beginPath(); c.arc(w / 2, 125, 30, 0, 7); c.fill(); c.fillStyle = '#0a080c'; c.beginPath(); c.arc(w / 2, 115, 32, Math.PI, 0); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2 - 10, 125, 7, 0, 7); c.arc(w / 2 + 10, 125, 7, 0, 7); c.fill(); c.fillStyle = '#000'; c.fillRect(w / 2 - 11, 124, 3, 3); c.fillRect(w / 2 + 9, 124, 3, 3); c.font = `14px ${FONT}`; c.fillText(c3, w / 2, 180); }
    else if (gag === 'hang') { c.strokeStyle = '#1a1210'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2, 80); c.lineTo(w / 2, 108); c.stroke(); c.fillStyle = '#8a6a4a'; c.beginPath(); c.ellipse(w / 2, 125, 16, 20, 0, 0, 7); c.fill(); c.fillStyle = '#1a1210'; c.fillRect(30, 158, 100, 6); c.fillText('(over a well)', w / 2, 185); }
    else { c.font = `16px ${FONT}`; c.fillText(c3, w / 2, 130); }
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.78), texMat(t));
}

export function makeTimber() { // a tunnel mouth's frame: two posts and a lintel
  const p = new Part();
  for (const s of [-1, 1]) p.add(G.box(0.18, 3.1, 0.18), WOOD, { at: [s * 1.08, 1.55, 0] });
  p.add(G.box(2.5, 0.2, 0.22), WOOD, { at: [0, 3.05, 0] });
  for (const s of [-1, 1]) p.add(G.box(0.12, 0.6, 0.12), WOODDK, { at: [s * 0.8, 2.75, 0], rot: [0, 0, s * 0.8] });
  return partMesh(p);
}
export function makeShoring(h) { // timber shoring against the well wall
  const p = new Part();
  for (const s of [-1, 1]) p.add(G.box(0.16, h, 0.16), WOOD, { at: [s * 1.2, h / 2, 0] });
  p.add(G.box(2.7, 0.18, 0.2), WOOD, { at: [0, h - 0.09, 0] });
  p.add(G.box(0.1, 2.4, 0.1), WOODDK, { at: [0, h - 1.3, 0.02], rot: [0, 0, 0.95] });
  return partMesh(p);
}
export function makeRails(len) {
  const p = new Part();
  for (const s of [-1, 1]) p.add(G.box(0.05, 0.05, len), IRONLT, { at: [s * 0.28, 0.05, 0] });
  for (let z = -len / 2 + 0.25; z < len / 2; z += 0.5) p.add(G.box(0.8, 0.04, 0.14), WOODDK, { at: [0, 0.02, z] });
  return partMesh(p, null, null);
}
export function makeCounter() { // a general-store counter with a brass cash register
  const g = new THREE.Group();
  const p = new Part();
  p.add(G.box(2.6, 0.9, 0.6), 0x5a3a20, { at: [0, 0.45, 0] });
  p.add(G.box(2.7, 0.06, 0.7), 0x7a5232, { at: [0, 0.93, 0] });
  p.add(G.box(0.45, 0.3, 0.35), C.brass, { at: [0.7, 1.11, 0] });
  p.add(G.box(0.4, 0.15, 0.06), C.brassDk, { at: [0.7, 1.32, 0.12], rot: [-0.4, 0, 0] });
  g.add(partMesh(p));
  return g;
}
export function makeShopSign() {
  const g = makeSign('GENERAL STORE', 'cash only');
  g.scale.setScalar(0.9);
  return g;
}
export function makeCase() { // the Golden Shovel's glass case (it lifts when the Chairman falls)
  const g = new THREE.Group();
  const glass = new THREE.Mesh(G.box(0.9, 1.5, 0.9), new THREE.MeshBasicMaterial({ color: 0xa8d8ff, transparent: true, opacity: 0.22, depthWrite: false }));
  glass.position.y = 0.75; g.add(glass);
  const p = new Part();
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.box(0.05, 1.5, 0.05), C.brass, { at: [sx * 0.45, 0.75, sz * 0.45] });
  p.add(G.box(0.95, 0.06, 0.95), C.brass, { at: [0, 1.5, 0] });
  g.add(partMesh(p));
  g.userData.glass = glass;
  return g;
}
export function makeChair(big = false) { // a tufted leather boardroom chair
  const p = new Part();
  const L = 0x6a1a1a;
  p.add(G.box(0.5, 0.12, 0.5), L, { at: [0, 0.48, 0] });
  p.add(G.box(0.5, big ? 1.1 : 0.7, 0.12), L, { at: [0, big ? 1.05 : 0.85, -0.22] });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(G.cyl(0.025, 0.025, 0.44, 6), C.brass, { at: [sx * 0.2, 0.22, sz * 0.2] });
  for (let k = 0; k < 4; k++) p.add(G.sphere(0.02, 6, 4), C.brass, { at: [-0.12 + (k % 2) * 0.24, (big ? 1.1 : 0.82) + Math.floor(k / 2) * 0.2, -0.155] });
  return partMesh(p);
}
export function makeChart() { // PROFITS, going one way
  const t = canvasTex(256, 160, (c, w, h) => {
    c.fillStyle = '#f0e6c8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2a1a10'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6);
    c.fillStyle = '#2a1a10'; c.font = `bold 22px ${FONT}`; c.textAlign = 'center'; c.fillText('PROFITS', w / 2, 30);
    c.strokeStyle = '#b02a1a'; c.lineWidth = 6; c.beginPath(); c.moveTo(24, 140); [[60, 120], [90, 128], [130, 90], [160, 100], [200, 50], [232, 36]].forEach(([x, y]) => c.lineTo(x, y)); c.stroke();
    c.fillStyle = '#b02a1a'; c.beginPath(); c.moveTo(240, 30); c.lineTo(222, 32); c.lineTo(234, 48); c.fill();
    c.font = `14px ${FONT}`; c.fillStyle = '#2a1a10'; c.fillText('(souls, in thousands)', w / 2, 154);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), texMat(t));
}
export function makePortrait() {
  const t = canvasTex(128, 160, (c, w, h) => {
    c.fillStyle = '#3a1a10'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8902a'; c.fillRect(0, 0, w, 10); c.fillRect(0, h - 10, w, 10); c.fillRect(0, 0, 10, h); c.fillRect(w - 10, 0, 10, h);
    c.fillStyle = '#d02a1a'; c.beginPath(); c.arc(w / 2, 70, 28, 0, 7); c.fill(); c.fillStyle = '#1a0a0a'; c.beginPath(); c.moveTo(w / 2 + 12, 46); c.lineTo(w / 2 + 30, 20); c.lineTo(w / 2 + 22, 50); c.fill(); c.beginPath(); c.moveTo(w / 2 - 12, 46); c.lineTo(w / 2 - 30, 20); c.lineTo(w / 2 - 22, 50); c.fill();
    c.fillStyle = '#2a2a34'; c.fillRect(30, 100, 68, 50); c.fillStyle = '#fff'; c.fillRect(58, 100, 12, 30); c.fillStyle = '#ffd040'; c.fillRect(52, 64, 6, 6); c.fillRect(70, 64, 6, 6);
    c.fillStyle = '#f0e6c8'; c.font = `11px ${FONT}`; c.textAlign = 'center'; c.fillText('OUR FOUNDER', w / 2, h - 16);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1.25), texMat(t));
}
export function makePlant() { // an office fern in a brass pot
  const p = new Part();
  p.add(G.cyl(0.2, 0.15, 0.36, 12), C.brass, { at: [0, 0.18, 0] });
  for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; p.add(G.sphere(0.12, 8, 6), 0x3a6a2a, { at: [Math.cos(a) * 0.14, 0.5 + (k % 2) * 0.1, Math.sin(a) * 0.14], scale: [0.6, 1.6, 0.6], rot: [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6] }); }
  return partMesh(p);
}
export function makeSpittoon() { // the Boardroom's water cooler is a spittoon (1900s)
  const p = new Part();
  p.add(new THREE.LatheGeometry([[0, 0], [0.2, 0], [0.24, 0.1], [0.18, 0.22], [0.12, 0.26], [0.22, 0.32], [0.2, 0.34]].map(([x, y]) => new THREE.Vector2(x, y)), 16), C.brass);
  return partMesh(p);
}
export function makeRope() { // the snapped rope at the wellhead
  const p = new Part();
  p.add(G.cyl(0.03, 0.03, 0.8, 6), 0xc8a46a, { at: [0, 0.05, 0], rot: [0, 0, Math.PI / 2] });
  p.add(G.torus(0.25, 0.03, 5, 18), 0xc8a46a, { at: [0.5, 0.04, 0.1], rot: [Math.PI / 2, 0, 0] });
  return partMesh(p);
}
export function makeDerrick() { // a wooden oil derrick over the well mouth, against the night
  const p = new Part();
  const H = 12, B0 = 7.2, B1 = 1.6;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const a = new THREE.Vector3(sx * B0, 0, sz * B0), b = new THREE.Vector3(sx * B1, H, sz * B1);
    const len = a.distanceTo(b), mid = a.clone().add(b).multiplyScalar(0.5);
    const g = G.box(0.32, len, 0.32);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    const e = new THREE.Euler().setFromQuaternion(q);
    p.add(g, WOOD, { at: [mid.x, mid.y, mid.z], rot: [e.x, e.y, e.z] });
  }
  for (let y = 2; y < H; y += 2.5) {
    const k = B0 + (B1 - B0) * (y / H);
    for (const [x, z, rx] of [[0, k, 0], [0, -k, 0], [k, 0, 1], [-k, 0, 1]]) p.add(G.box(rx ? 0.22 : k * 2, 0.22, rx ? k * 2 : 0.22), WOODDK, { at: [x, y, z] });
  }
  p.add(G.cyl(0.5, 0.5, 0.6, 12), IRON, { at: [0, H + 0.2, 0], rot: [0, 0, Math.PI / 2] });
  return partMesh(p, null, null);
}

// ------------------------------------------------------------------ the way down: the collar's beacon
export function makeBeacon(size, color = 0xffc93a) {
  const g = new THREE.Group();
  const col = new THREE.Color(color);
  const beamMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(size * 0.42, size * 0.55, 6, 24, 1, true), beamMat);
  beam.position.y = 2.6; g.add(beam);
  const ringMat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(new THREE.RingGeometry(size * 0.5, size * 0.62, 32), ringMat);
  ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
  const deep = new THREE.Mesh(new THREE.CircleGeometry(size * 0.5, 24), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(0.55), transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  deep.rotation.x = -Math.PI / 2; deep.position.y = -1.6; g.add(deep);
  for (const m of [beam, ring, deep]) cutaway(m.material, { edge: false });
  Object.assign(g.userData, { beam, ring, deep });
  return g;
}

// ------------------------------------------------------------------ hazards (dr-mow's, underground)
export function makeSaw(r = 0.62) { // dr-mow createSaw: a toothed disc, half-sunk in its slot
  const g = new THREE.Group();
  const blade = new THREE.Group();
  const p = new Part();
  p.add(G.cyl(r * 0.86, r * 0.86, 0.06, 20), 0xb8bcc8, { rot: [Math.PI / 2, 0, 0] });
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; p.add(G.cone(0.08, 0.2, 3), 0xb8bcc8, { at: [Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9, 0], rot: [0, 0, a - Math.PI / 2 + 0.5] }); }
  p.add(G.cyl(0.14, 0.14, 0.1, 10), 0xc02a1a, { rot: [Math.PI / 2, 0, 0] });
  blade.add(partMesh(p));
  g.add(blade);
  g.userData.blade = blade;
  return g;
}
export function makeSawTrack(len) { // dr-mow createSawTrack: a yellow/black slot along the patrol line
  const t = stripeTex().clone(); t.needsUpdate = true; t.repeat.set(1, (len + 0.9) / 1.2);
  const m = new THREE.Mesh(G.box(0.44, 0.05, len + 0.9), texMat(t));
  return m;
}
export function makeVent(arms) { // dr-mow createSpout: an iron stub on a striped plate, a nozzle per arm, a collar that glows before it blows
  const g = new THREE.Group();
  const plate = new THREE.Mesh(G.cyl(0.62, 0.66, 0.08, 20), texMat(stripeTex())); plate.position.y = 0.04; g.add(plate);
  const body = new THREE.Group(); g.add(body);
  const p = new Part();
  p.add(G.cyl(0.27, 0.33, 0.7, 12), IRONLT, { at: [0, 0.4, 0] });
  for (const y of [0.18, 0.62]) p.add(G.torus(0.32, 0.04, 6, 16), IRON, { at: [0, y, 0], rot: [Math.PI / 2, 0, 0] });
  for (const a of arms) { const ang = Math.atan2(a.x, a.z); p.add(G.cyl(0.13, 0.16, 0.42, 10), IRONLT, { at: [Math.sin(ang) * 0.36, 0.4, Math.cos(ang) * 0.36], rot: [Math.PI / 2, ang, 0] }); }
  p.add(G.torus(0.14, 0.02, 4, 10), 0xc02a1a, { at: [0, 0.82, 0], rot: [Math.PI / 2, 0, 0] }); // the valve wheel
  body.add(partMesh(p));
  const hot = new THREE.Mesh(G.cyl(0.3, 0.3, 0.14, 12, true), new THREE.MeshBasicMaterial({ color: 0x3a3440 })); hot.position.y = 0.4; body.add(hot);
  const jets = arms.map((a) => {
    const j = new THREE.Group(); j.rotation.y = Math.atan2(a.x, a.z); j.position.y = 0.4;
    const geo = new THREE.CylinderGeometry(0.22, 0.32, 1, 10, 1, true); geo.rotateX(Math.PI / 2); geo.translate(0, 0, 0.5);
    const outer = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xff6a1a, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xfff2a0, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending })); core.scale.set(0.5, 0.5, 1);
    j.add(outer, core); j.visible = false; g.add(j);
    return { j, outer, core, len: a.len };
  });
  Object.assign(g.userData, { body, hot, jets });
  return g;
}
export function makeVat() { // dr-mow createAcidVat / createCauldron: a cast-iron kettle of boiling tar on a fire
  const g = new THREE.Group();
  const R = 0.6, lip = 0.95;
  const p = new Part();
  for (let i = 0; i < 4; i++) p.add(G.cyl(0.07, 0.08, R * 1.9, 7), 0x5a3a20, { at: [0, 0.08, 0], rot: [0, (i / 4) * Math.PI, Math.PI / 2] });
  p.add(new THREE.LatheGeometry([[0.02, 0.22], [0.4, 0.24], [0.56, 0.4], [R, 0.6], [R * 1.02, 0.74], [R * 0.92, lip - 0.02]].map(([x, y]) => new THREE.Vector2(x, y)), 18), 0x2a2632);
  p.add(G.torus(R * 0.92, 0.05, 5, 18), 0x3c3846, { at: [0, lip - 0.02, 0], rot: [Math.PI / 2, 0, 0] });
  g.add(partMesh(p));
  const tar = new THREE.Mesh(new THREE.CircleGeometry(R * 0.86, 18), new THREE.MeshBasicMaterial({ color: 0xff7a1a })); tar.rotation.x = -Math.PI / 2; tar.position.y = lip - 0.1; g.add(tar);
  const coals = glow(G.cyl(R * 0.7, R * 0.75, 0.04, 12), 0xff5a1f); coals.position.y = 0.03; g.add(coals);
  const bubbles = Array.from({ length: 5 }, (_, k) => { const b = glow(G.ico(0.08, 1), 0xffb04a); const a = k * 2.4; b.position.set(Math.cos(a) * 0.3 * ((k % 3) / 2), lip - 0.08, Math.sin(a) * 0.3 * ((k % 3) / 2)); g.add(b); return b; });
  Object.assign(g.userData, { tar, bubbles });
  return g;
}
export function makeStalactite(seed = 1) { // dr-mow createIcicleChunk, in rock: a chunk under the ceiling with dripping spikes
  const g = new THREE.Group();
  const p = new Part();
  let s = seed * 7 + 3; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  p.add(G.dodec(0.32), 0x4a4250, { at: [0, -0.12, 0], scale: [1.25, 0.6, 1.1] });
  for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2 + rnd(), r = k ? 0.16 + rnd() * 0.12 : 0, len = 0.35 + rnd() * 0.45 * (k ? 1 : 1.3); p.add(G.cone(0.08 + rnd() * 0.04, len, 6), k % 2 ? 0x5a5260 : 0x3a3440, { at: [Math.cos(a) * r, -0.25 - len / 2, Math.sin(a) * r], rot: [Math.PI, 0, 0] }); }
  g.add(partMesh(p));
  return g;
}
export function makeThumper() { // dr-mow createMine: a spiky iron dome on a plate, a light that flashes before each pulse
  const g = new THREE.Group();
  const p = new Part();
  p.add(G.cyl(0.55, 0.6, 0.1, 16), 0x6a6478, { at: [0, 0.05, 0] });
  p.add(G.sphere(0.4, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x3a3448, { at: [0, 0.1, 0] });
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; p.add(G.cone(0.06, 0.22, 6), 0x3a3448, { at: [Math.cos(a) * 0.34, 0.26, Math.sin(a) * 0.34], rot: [Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9] }); }
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; p.add(G.sphere(0.03, 6, 4), C.brass, { at: [Math.cos(a) * 0.5, 0.11, Math.sin(a) * 0.5] }); }
  g.add(partMesh(p));
  const light = new THREE.Mesh(G.sphere(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0x701010 })); light.position.y = 0.55; g.add(light);
  g.userData.light = light;
  return g;
}
export const RING_GEO = new THREE.CylinderGeometry(1, 1, 0.5, 48, 1, true);
export const ringMat = () => new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending });
