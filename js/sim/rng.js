// Seeded randomness (mulberry32, from gig-ambulance via kits/vanilla-js/util/utils.js).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRand(seed) {
  const R = mulberry32(seed);
  return {
    f: R,
    range: (a, b) => a + R() * (b - a),
    int: (a, b) => Math.floor(a + R() * (b - a + 1)), // inclusive
    pick: (arr) => arr[Math.floor(R() * arr.length)],
    chance: (p) => R() < p,
    shuffle(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; },
  };
}

export const randomSeed = () => 1 + Math.floor(Math.random() * 999998);
