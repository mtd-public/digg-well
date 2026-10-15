// The game's sound vocabulary on top of kits/vanilla-js/audio/sfx-synth.js. No audio files.
// A low mine drone, drips, a honky-tonk-ish jingle for Golden Shovel status, and voices made with
// the kit's formant yell (the oil workers' gurgled "help", the piggy's oink, the Chairman's laugh).
import { Sfx, SFX } from './sfx-synth.js';

Object.assign(SFX, {
  swing: (s) => s.burst(0.12, 1800, { q: 1.5, vol: 0.12, f1: 500 }),
  dig: (s) => { s.burst(0.18, 400, { type: 'lowpass', vol: 0.3, f1: 120 }); s.tone(140, 0.08, 'square', 0.05, -60); },
  crack: (s) => s.burst(0.08, 900, { q: 2, vol: 0.15 }),
  clank: SFX.clank,
  plunge: (s) => s.tone(600, 0.18, 'triangle', 0.06, -420),
  shotgun: (s) => { s.burst(0.35, 2400, { type: 'lowpass', vol: 0.45, f1: 120 }); s.tone(90, 0.25, 'square', 0.12, -50); },
  pump: (s) => { s.tone(220, 0.04, 'square', 0.05); s.tone(330, 0.05, 'square', 0.05, 0, 0.12); },
  throw: (s) => s.burst(0.15, 900, { q: 1, vol: 0.12, f1: 2400 }),
  fuse: (s) => s.burst(0.5, 4000, { type: 'highpass', vol: 0.06 }),
  stomp: (s) => { s.tone(180, 0.12, 'square', 0.1, 260); s.burst(0.1, 600, { vol: 0.2 }); },
  coin: (s) => { s.tone(1568, 0.05, 'square', 0.035); s.tone(2093, 0.1, 'square', 0.035, 0, 0.05); },
  bill: (s) => s.burst(0.14, 3000, { type: 'highpass', vol: 0.08, f1: 6000 }),
  gin: (s) => { for (let i = 0; i < 4; i++) s.tone(300 + i * 40, 0.09, 'sine', 0.08, -60, i * 0.1); s.tone(900, 0.12, 'triangle', 0.05, 300, 0.5); },
  golden: (s) => s.arp([523, 659, 784, 1047, 1319, 1568], 0.05, 0.14, 'square', 0.05),
  item: (s) => s.arp([660, 880, 1320], 0.05, 0.1, 'triangle', 0.07),
  weapon: (s) => { s.arp([392, 523, 784], 0.06, 0.12, 'square', 0.05); s.tone(110, 0.2, 'sawtooth', 0.05, -30); },
  upgrade: (s) => s.arp([523, 659, 784, 1047, 1319], 0.07, 0.18, 'triangle', 0.08),
  buy: (s) => { s.tone(1760, 0.06, 'square', 0.04); s.tone(1320, 0.12, 'square', 0.04, 0, 0.06); s.burst(0.1, 5000, { type: 'highpass', vol: 0.05, delay: 0.02 }); },
  nope: (s) => s.tone(200, 0.18, 'square', 0.05, -60),
  steal: (s) => s.arp([784, 622, 523], 0.06, 0.1, 'square', 0.05),
  anger: (s) => { s.tone(150, 0.4, 'sawtooth', 0.1, -50); s.tone(110, 0.4, 'square', 0.06, -30, 0.1); },
  piggyHit: (s) => { s.tone(900, 0.08, 'triangle', 0.08, 300); s.burst(0.1, 3000, { q: 3, vol: 0.12 }); },
  piggyBreak: (s) => { s.burst(0.5, 3500, { q: 1.5, vol: 0.3, f1: 900 }); s.arp([392, 330, 262], 0.1, 0.2, 'triangle', 0.06); },
  piggySaved: (s) => s.arp([523, 659, 784, 1047, 784, 1047, 1319], 0.08, 0.16, 'square', 0.05),
  lantern: (s) => { s.burst(0.15, 3000, { type: 'highpass', vol: 0.1 }); s.burst(0.5, 500, { type: 'lowpass', vol: 0.06, delay: 0.08 }); },
  flare: (s) => s.burst(0.6, 2500, { q: 0.8, vol: 0.12, f1: 900 }),
  vent: (s) => s.burst(0.7, 300, { type: 'lowpass', vol: 0.28, f1: 1600 }),
  spit: (s) => { s.burst(0.15, 600, { vol: 0.15 }); s.tone(120, 0.12, 'sine', 0.08, 60); },
  thump: (s) => { s.tone(60, 0.3, 'sine', 0.3, -20); s.burst(0.2, 200, { type: 'lowpass', vol: 0.2 }); },
  rumble: (s) => s.burst(0.7, 180, { type: 'lowpass', vol: 0.18, f1: 90 }),
  shatter: (s) => s.burst(0.4, 1400, { q: 0.8, vol: 0.3, f1: 300 }),
  buzz: (s) => s.tone(180, 0.35, 'sawtooth', 0.04, 120),
  screech: (s) => s.tone(2400, 0.2, 'square', 0.03, 900),
  hiss: (s) => s.burst(0.3, 5000, { type: 'highpass', vol: 0.08 }),
  impThrow: (s) => s.tone(700, 0.1, 'triangle', 0.05, 300),
  impHop: (s) => s.tone(500, 0.06, 'sine', 0.03, 200),
  ignite: (s) => s.burst(0.5, 800, { q: 0.6, vol: 0.2, f1: 2000 }),
  onFire: (s) => { s.burst(0.6, 900, { q: 0.6, vol: 0.25, f1: 2200 }); s.tone(500, 0.3, 'sawtooth', 0.05, 300); },
  enemyShot: (s) => { s.burst(0.3, 2000, { type: 'lowpass', vol: 0.35, f1: 150 }); },
  aim: (s) => { s.tone(300, 0.05, 'square', 0.04); s.tone(250, 0.06, 'square', 0.04, 0, 0.09); },
  bossTell: (s) => s.tone(80, 0.5, 'sawtooth', 0.08, 40),
  bossSlam: (s) => { s.tone(45, 0.6, 'sine', 0.4, -15); s.burst(0.5, 300, { type: 'lowpass', vol: 0.4 }); },
  bossVolley: (s) => s.burst(0.4, 1200, { q: 1, vol: 0.2, f1: 300 }),
  bossDown: (s) => { SFX.bigBoom(s); s.arp([262, 330, 392, 523, 659, 784, 1047], 0.12, 0.3, 'square', 0.05); },
  reveal: (s) => s.arp([392, 494, 587, 784, 988, 1175, 1568], 0.12, 0.4, 'triangle', 0.08),
  depth: (s) => { s.tone(110, 1.2, 'sawtooth', 0.06, -30); s.arp([196, 247, 294], 0.18, 0.5, 'triangle', 0.06); },
  dark: (s) => { s.tone(80, 1.5, 'sine', 0.12, -30); s.burst(0.3, 3000, { type: 'highpass', vol: 0.05 }); },
  combo: (s) => s.arp([784, 988, 1175, 1568], 0.04, 0.08, 'square', 0.045),
  cycle: (s) => s.tone(1000, 0.04, 'square', 0.03),
  mantle: (s) => s.tone(260, 0.06, 'triangle', 0.04, 120),
  snap: (s) => s.burst(0.2, 1500, { q: 3, vol: 0.2, f1: 500 }),
  washed: (s) => { s.burst(0.5, 4000, { type: 'highpass', vol: 0.08, f1: 1500 }); s.arp([659, 784, 1047], 0.08, 0.15, 'triangle', 0.06); },
  win: (s) => s.arp([523, 659, 784, 1047, 1319, 1568, 2093], 0.12, 0.35, 'square', 0.05),
});

export class Audio extends Sfx {
  constructor() { super({ volume: 0.7 }); this.voiceT = 0; this.jingleT = 0; this.dripT = 2; }

  // a gurgled word: the formant yell, lower, through oil (lowpass, wobble)
  voice(kind = 'worker') {
    const c = this.ctx;
    if (!c || this.muted) return;
    const now = c.currentTime;
    if (now - this.voiceT < 0.35) return;
    this.voiceT = now;
    const t = now, dur = kind === 'piggy' ? 0.22 : kind === 'boss' ? 0.9 : kind === 'imp' ? 0.18 : 0.55;
    const base = kind === 'piggy' ? 520 : kind === 'boss' ? 95 : kind === 'imp' ? 900 : kind === 'shop' ? 140 : 170 + Math.random() * 60;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(base, t);
    o.frequency.exponentialRampToValueAtTime(base * (kind === 'piggy' ? 0.7 : 1.25), t + dur * 0.35);
    o.frequency.exponentialRampToValueAtTime(base * 0.8, t + dur);
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = kind === 'worker' ? 11 : 6; vg.gain.value = base * 0.06;
    vib.connect(vg).connect(o.frequency);
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t); out.gain.exponentialRampToValueAtTime(kind === 'boss' ? 0.2 : 0.11, t + 0.03); out.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const vow = kind === 'piggy' ? [600, 1000, 2400] : [[650, 1080, 2650], [400, 900, 2400], [300, 870, 2250]][Math.floor(Math.random() * 3)]; // "heh" "el" "oo"
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = kind === 'worker' ? 1400 : 3000;
    vow.forEach((fr, i) => { const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = fr; bp.Q.value = 7; const g = c.createGain(); g.gain.value = [1.4, 0.7, 0.3][i]; o.connect(bp).connect(g).connect(lp); });
    lp.connect(out).connect(this.master);
    o.start(t); vib.start(t); o.stop(t + dur + 0.05); vib.stop(t + dur + 0.05);
  }

  // the cave: a low drone once, then drips now and then (call every frame)
  ambience(dt, depth, dark) {
    if (!this.ctx) return;
    if (!this.loops.drone) this.startDrone([41.2, 41.6, 61.7], 0.035);
    this.dripT -= dt;
    if (this.dripT <= 0) { this.dripT = 1.5 + Math.random() * 4; if (!this.muted) this.tone(1400 + Math.random() * 900, 0.09, 'sine', 0.025, -900); }
  }

  // Golden Shovel status: a quick ragtime-ish loop
  jingle(dt, on) {
    if (!on || !this.ctx || this.muted) return;
    this.jingleT -= dt;
    if (this.jingleT > 0) return;
    this.jingleT = 0.9;
    const n = [523, 659, 784, 659, 880, 784, 659, 587];
    n.forEach((f, i) => this.tone(f, 0.09, 'square', 0.03, 0, i * 0.11));
    this.tone(131, 0.4, 'triangle', 0.05); this.tone(196, 0.4, 'triangle', 0.04, 0, 0.45);
  }
}
