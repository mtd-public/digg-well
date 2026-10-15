// Model kit: primitives merged into one vertex-coloured mesh per moving part (a head, an arm),
// each with a welded inverted hull for its ink line (docs/14 #22). One draw call per part plus
// one for its ink, so a crowd of oil workers stays cheap.
import * as THREE from 'three';
import { mergeVertices, mergeGeometries } from '../vendor/addons/BufferGeometryUtils.js';
import { vcToon, outlineMat, toon, glowMat } from './materials.js';

const _c = new THREE.Color();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

export const G = {
  sphere: (r, w = 16, h = 12, ...rest) => new THREE.SphereGeometry(r, w, h, ...rest),
  cyl: (rt, rb, h, n = 14, ...rest) => new THREE.CylinderGeometry(rt, rb, h, n, 1, ...rest),
  cap: (r, len, n = 10) => new THREE.CapsuleGeometry(r, Math.max(0.001, len), 4, n),
  box: (x, y, z) => new THREE.BoxGeometry(x, y, z),
  cone: (r, h, n = 10) => new THREE.ConeGeometry(r, h, n),
  torus: (r, t, rs = 8, ts = 20, arc) => new THREE.TorusGeometry(r, t, rs, ts, arc),
  ico: (r, d = 0) => new THREE.IcosahedronGeometry(r, d),
  dodec: (r) => new THREE.DodecahedronGeometry(r, 0),
};

// A part: add primitives with a colour and a transform, then build() one merged geometry.
export class Part {
  constructor() { this.geos = []; }
  add(geo, color, { at = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], tag = 0 } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    _e.set(rot[0], rot[1], rot[2]);
    _q.setFromEuler(_e);
    _s.set(scale[0], scale[1], scale[2]);
    _p.set(at[0], at[1], at[2]);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    const n = g.getAttribute('position').count;
    const col = new Float32Array(n * 3), tg = new Float32Array(n);
    _c.set(color);
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b; tg[i] = tag; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('tag', new THREE.BufferAttribute(tg, 1));
    this.geos.push(g);
    geo.dispose?.();
    return this;
  }
  // recolour vertices: fn(x, y, z, tag) → hex or null (keeps the colour)
  build(recolor) {
    const g = mergeGeometries(this.geos, false);
    for (const q of this.geos) q.dispose();
    if (recolor) {
      const p = g.getAttribute('position'), c = g.getAttribute('color'), t = g.getAttribute('tag');
      for (let i = 0; i < p.count; i++) {
        const v = recolor(p.getX(i), p.getY(i), p.getZ(i), t.getX(i));
        if (v != null) { _c.set(v); c.setXYZ(i, _c.r, _c.g, _c.b); }
      }
    }
    g.deleteAttribute('tag');
    g.computeBoundingSphere();
    return g;
  }
}

const hulls = new WeakMap();
export function hullOf(geo) {
  let h = hulls.get(geo);
  if (!h) {
    const bare = new THREE.BufferGeometry();
    bare.setAttribute('position', geo.getAttribute('position'));
    if (geo.index) bare.setIndex(geo.index);
    h = mergeVertices(bare, 1e-3);
    h.computeVertexNormals();
    hulls.set(geo, h);
  }
  return h;
}

// mesh + ink
export function inked(geo, mat = vcToon(), line = outlineMat) {
  const m = new THREE.Mesh(geo, mat);
  if (line) { const h = new THREE.Mesh(hullOf(geo), line); h.userData.hull = true; m.add(h); }
  return m;
}
export function partMesh(part, recolor, line = outlineMat) { return inked(part.build(recolor), vcToon(), line); }

// a pivoted limb: the part is built around the pivot, the mesh sits at `at`
export function pivot(parent, part, at, recolor, line) {
  const g = new THREE.Group();
  g.position.set(at[0], at[1], at[2]);
  if (part) g.add(partMesh(part, recolor, line));
  parent.add(g);
  return g;
}

export const solid = (geo, color, opts) => inked(geo, toon(color, opts));
export const glow = (geo, color, opts) => new THREE.Mesh(geo, glowMat(color, opts));

export function disposeTree(o) {
  o.traverse((q) => {
    if (q.geometry && !q.userData.sharedGeo) q.geometry.dispose();
  });
}
