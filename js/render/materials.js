// Shared look: toon shading (a 4-band ramp), inverted-hull ink (kits: the vanilla starter's
// outline shader), canvas textures, and the cutaway that keeps the digger visible in a 3D well.
import * as THREE from 'three';

export const INK = 0x0b0710;

// ---------------------------------------------------------------- toon ramp
const ramp = (() => {
  const d = new Uint8Array([46, 46, 46, 255, 120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true;
  return t;
})();

// ---------------------------------------------------------------- the cutaway
// Everything above the digger's head is cut (sloping lower toward the camera, so near walls never
// hide him), and a cylinder from the digger to the camera is drilled clear. Cut faces show a
// dark hatch, and the cut edge gets an ink line.
export const CUT = {
  uFocus: { value: new THREE.Vector3() },
  uCamDir: { value: new THREE.Vector3(0.5, 0.7, 0.5) },
  uCut: { value: 2.7 },
  uRadius: { value: 2.3 },
  uSlope: { value: 0.75 },
  uCap: { value: new THREE.Color(0x120c14) },
  uTime: { value: 0 },
};

const CUT_FN = /* glsl */ `
uniform vec3 uFocus; uniform vec3 uCamDir; uniform float uCut; uniform float uRadius; uniform float uSlope; uniform vec3 uCap; uniform float uTime;
varying vec3 vWPos;
float cutEdge;
void cutaway() {
  vec3 d = vWPos - uFocus;
  float along = dot(d, uCamDir);
  float pr = length(d - along * uCamDir);
  vec2 hd = normalize(uCamDir.xz);
  float nearH = dot(d.xz, hd);
  // the slope lowers the cut toward the camera, but never below the digger's own floor
  float cutY = max(uFocus.y - 0.28, uFocus.y + uCut - max(0.0, nearH - 1.2) * uSlope);
  float overCut = vWPos.y - cutY;
  bool cyl = along > 0.45 && pr < uRadius && vWPos.y > uFocus.y - 0.25;
  if (overCut > 0.0 || cyl) discard;
  cutEdge = max(step(-0.07, overCut), along > 0.45 && vWPos.y > uFocus.y - 0.25 ? step(uRadius - 0.09, pr) * step(pr, uRadius + 0.02) : 0.0);
}
`;

export function cutaway(mat, { caps = false, edge = true, glow = false } = {}) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, CUT);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;' + (glow ? '\nattribute float aGlow;\nvarying float vGlow;' : ''))
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;' + (glow ? '\nvGlow = aGlow;' : ''));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + CUT_FN + (glow ? '\nvarying float vGlow;' : ''))
      .replace('#include <clipping_planes_fragment>', 'cutaway();\n#include <clipping_planes_fragment>')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + (glow ? 'totalEmissiveRadiance += diffuseColor.rgb * vGlow * smoothstep(0.18, 0.42, diffuseColor.r - diffuseColor.b);' : ''))
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' +
        (edge ? 'if (gl_FrontFacing && cutEdge > 0.5) gl_FragColor = vec4(0.06, 0.035, 0.07, 1.0);\n' : '') +
        (caps ? 'if (!gl_FrontFacing) { float h = step(0.5, fract((vWPos.x + vWPos.y + vWPos.z) * 3.0)); gl_FragColor = vec4(uCap * (0.75 + 0.5 * h), 1.0); }\n' : ''));
  };
  mat.customProgramCacheKey = () => 'cut' + (caps ? 'c' : '') + (edge ? 'e' : '') + (glow ? 'g' : '');
  return mat;
}

// ---------------------------------------------------------------- materials
const cache = new Map();
export function toon(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (cache.has(key) && !opts.unique) return cache.get(key);
  const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...strip(opts) });
  if (opts.cut !== false) cutaway(m, { edge: false });
  if (!opts.unique) cache.set(key, m);
  return m;
}
const strip = (o) => { const { unique, cut, ...rest } = o; return rest; };

export function glowMat(color, opts = {}) {
  const key = 'g' + color + JSON.stringify(opts);
  if (cache.has(key) && !opts.unique) return cache.get(key);
  const m = new THREE.MeshBasicMaterial({ color, ...strip(opts) });
  if (opts.cut !== false) cutaway(m, { edge: false });
  if (!opts.unique) cache.set(key, m);
  return m;
}

// Gloss for oil: phong with a hard highlight reads as "wet" in a cartoon.
export function oilMat() {
  if (cache.has('oil')) return cache.get('oil');
  const m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90, specular: 0x8a7aa8 });
  cutaway(m, { edge: false });
  cache.set('oil', m);
  return m;
}

export const vcToon = () => {
  if (cache.has('vc')) return cache.get('vc');
  const m = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: ramp });
  cutaway(m, { edge: false });
  cache.set('vc', m);
  return m;
};

function makeOutline(thickness) {
  return new THREE.ShaderMaterial({
    uniforms: { color: { value: new THREE.Color(INK) }, thickness: { value: thickness }, ...CUT },
    vertexShader: /* glsl */ `
      uniform float thickness;
      varying vec3 vWPos;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vec3 n = normalize(normalMatrix * normal);
        mv.xyz += n * thickness * (1.0 + 0.03 * -mv.z);
        vWPos = (modelMatrix * vec4(position, 1.0)).xyz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 color;
      ${CUT_FN}
      void main() {
        cutaway();
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
  });
}
export const outlineMat = makeOutline(0.022);
export const outlineThick = makeOutline(0.04);

// ---------------------------------------------------------------- textures
export function canvasTex(w, h, draw, { repeat = [1, 1], nearest = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat[0] !== 1 || repeat[1] !== 1) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  if (nearest) t.magFilter = THREE.NearestFilter;
  t.anisotropy = 4;
  return t;
}

export function basicCut(params) { const m = new THREE.MeshBasicMaterial(params); cutaway(m, { edge: false }); return m; }

export function texMat(tex, opts = {}) {
  const m = new THREE.MeshToonMaterial({ map: tex, gradientMap: ramp, ...strip(opts) });
  if (opts.cut !== false) cutaway(m, { edge: false });
  return m;
}

// a little seeded random for texture painting
export function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
