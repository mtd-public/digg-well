// Autopilot proof (labyrinth-larry's idea): the pilot (js/sim/pilot.js) plans a path with the same
// moves proof.js allows and *drives* it with the real controls through world.step, enemies and
// hazards switched off. If it reaches the Bedrock Boardroom, the layout is finishable with the
// actual physics, not just on paper.
//   node tools/autopilot.mjs [seeds]
import { createWorld, step } from '../js/sim/world.js';
import { T } from '../js/sim/tuning.js';
import { Pilot } from '../js/sim/pilot.js';

export function drive(w, { maxT = 600 } = {}) {
  for (const e of w.ents) if (e.enemy || e.kind === 'barrel' || e.kind === 'tnt' || e.kind === 'crate') e.alive = false;
  w.hazards.length = 0;
  const p = w.player;
  p.maxHp = p.hp = 999;
  const pilot = new Pilot(w);
  for (let t = 0; t < maxT; t += T.STEP) {
    if (w.lv.stories[w.storyIdx].kind === 'shrine') return { ok: true, t, replans: pilot.replans };
    const ctl = pilot.control(T.STEP);
    w._jumpHeld = ctl.jump;
    step(w, ctl, T.STEP);
    w.events.length = 0;
    if (pilot.replans > 300) return { ok: false, why: `stuck at ${JSON.stringify(pilot.cell())}`, t, replans: pilot.replans };
  }
  return { ok: false, why: `timeout at ${JSON.stringify(pilot.cell())}`, t: maxT, replans: pilot.replans };
}

const n = +(process.argv[2] || 6);
let bad = 0;
for (let k = 1; k <= n; k++) {
  const seed = k * 104729;
  const r = drive(createWorld(seed));
  console.log(`seed ${seed}: ${r.ok ? 'reached the Boardroom' : 'FAILED: ' + r.why} in ${r.t.toFixed(0)} s (${r.replans} plans)`);
  if (!r.ok) bad++;
}
console.log(bad ? `${bad} failed` : 'autopilot OK');
process.exit(bad ? 1 : 0);
