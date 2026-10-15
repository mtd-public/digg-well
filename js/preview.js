// The art bible (preview.html): every model in a lit row, slowly turning. ?only=tycoon,boss to filter.
import * as THREE from 'three';
import * as M from './render/models.js';
import * as P from './render/props.js';
import { CUT } from './render/materials.js';

const Q = new URLSearchParams(location.search);
const only = Q.get('only') ? Q.get('only').split(',') : null;
const canvas = document.getElementById('view');
const r = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
r.setPixelRatio(Math.min(2, devicePixelRatio));
r.setClearColor(0x1a1218);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff0e0, 0x2a1a20, 2.2));
const key = new THREE.DirectionalLight(0xffe0b0, 2.5); key.position.set(3, 6, 5); scene.add(key);
CUT.uCut.value = 1e5; CUT.uFocus.value.set(0, -50, 0); // no cutaway here

const items = [
  ['tycoon', () => { const m = M.makeTycoon(); m.hand.add(M.makeTool('shovel')); return m.group; }],
  ['tycoon+shotgun', () => { const m = M.makeTycoon(); const t = M.makeTool('shotgun'); t.rotation.x = -Math.PI / 2; m.hand.add(t); m.armR.rotation.x = -1.4; return m.group; }],
  ['worker', () => M.makeWorker({ name: 'Gary', look: 0, oil: 0.38 }).group],
  ['worker help', () => M.makeWorker({ name: 'Linda', look: 1, oil: 0.5, side: 1 }).group],
  ['worker pail', () => M.makeWorker({ name: 'Big Sal', look: 2, oil: 0.5 }).group],
  ['worker washed', () => M.makeWorker({ name: 'Doug', look: 3, saved: true }).group],
  ['shopkeeper', () => M.makeShopkeeper({ beard: 0 }).group],
  ['shopkeeper++', () => M.makeShopkeeper({ beard: 2 }).group],
  ['imp', () => M.makeImp().group],
  ['bat', () => M.makeBat().group],
  ['beetle', () => M.makeBeetle().group],
  ['snake', () => M.makeSnake().group],
  ['fly', () => M.makeFly().group],
  ['piggy', () => M.makePiggy().group],
  ['boss', () => { const g = M.makeBoss().group; g.scale.setScalar(0.62); return g; }],
  ['barrel', () => P.makeBarrel()], ['dynamite', () => P.makeTNT()], ['crate', () => P.makeCrate()], ['cart', () => P.makeCrate(true)],
  ['gin', () => P.makeGin()], ['shard', () => P.makeShard()], ['flare', () => P.makeFlare(true)],
  ['shotgun', () => P.makeWeaponPickup('shotgun')], ['dynamite', () => P.makeWeaponPickup('bombs')], ['pickaxe', () => P.makeWeaponPickup('pickaxe')],
  ['upgrade', () => { const g = new THREE.Group(); g.add(P.makePedestal()); const b = P.makeBadge('steeltoe'); b.position.y = 0.2; g.add(b); return g; }],
  ['lantern', () => P.makeLantern({ post: true })], ['saw', () => { const g = new THREE.Group(); const s = P.makeSaw(); g.add(s); return g; }],
  ['vent', () => P.makeVent([{ x: 1, z: 0, len: 2 }, { x: -1, z: 0, len: 2 }])], ['vat', () => P.makeVat()], ['stalactite', () => { const g = P.makeStalactite(3); g.position.y = 1.2; const w = new THREE.Group(); w.add(g); return w; }], ['thumper', () => P.makeThumper()],
  ['counter', () => { const g = P.makeCounter(); g.scale.setScalar(0.5); return g; }], ['chair', () => P.makeChair(true)], ['case', () => P.makeCase()],
];
const list = items.filter(([n]) => !only || only.some((o) => n.startsWith(o)));
const cols = Math.min(list.length, +(Q.get('cols') || 8));
const rows = Math.ceil(list.length / cols);
const S = 1.7;
const objs = [];
list.forEach(([name, fn], i) => {
  const o = fn();
  const c = i % cols, rr = Math.floor(i / cols);
  o.position.x += (c - (cols - 1) / 2) * S;
  o.position.z += (rr - (rows - 1) / 2) * S * 1.6;
  scene.add(o); objs.push(o);
  const lab = document.createElement('div'); lab.className = 'lab'; lab.textContent = name; lab.dataset.i = i; document.body.appendChild(lab);
});
const cam = new THREE.PerspectiveCamera(24, 1, 0.1, 200);
const fit = () => {
  const w = innerWidth, h = innerHeight; r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  const span = Math.max(cols * S / cam.aspect, rows * S * 1.6) * 1.0;
  const d = span / (2 * Math.tan(THREE.MathUtils.degToRad(12)));
  cam.position.set(0, d * 0.55, d * 0.85); cam.lookAt(0, 0.4, 0);
};
fit(); addEventListener('resize', fit);
const v = new THREE.Vector3();
let t = 0;
const spin = Q.has('spin');
function loop() {
  requestAnimationFrame(loop); t += 1 / 60;
  objs.forEach((o, i) => { o.rotation.y = spin ? t * 0.6 : Math.PI / 6; });
  r.render(scene, cam);
  document.querySelectorAll('.lab').forEach((l) => { const o = objs[+l.dataset.i]; v.copy(o.position); v.y -= 0.15; v.z += 0.5; v.project(cam); l.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, 0)`; });
}
loop();
window.READY = true;
