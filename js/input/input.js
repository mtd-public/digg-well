// Input: keyboard + mouse, standard gamepads, touch. Folds into one control object per sim step:
//   { mx, mz, jump, jumpP, attackP, useP, cycleW, cycleI }  (mx, mz: world move, screen-relative)
// Edges are latched until a step consumes them, so a tap is never lost on a frame with no step.
//
// Touch is dr-mow's layout: a floating stick on the left 55 % of the screen (a new touch always
// takes it), the big JUMP pill for the right thumb with ATTACK and USE in an arc above it, and a
// tap on empty space on the right also jumps (dr-mow's tap-to-hop). From kits/vanilla-js/input
// (gig-ambulance's floating stick) and hell-hole's gamepad code (radial deadzones, edges).
// Robustness (docs/04, docs/14 #2): pointercancel, lostpointercapture, mouse buttons === 0, and a
// reset on blur / visibilitychange / pagehide / pause.

const PAD = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, LT: 6, RT: 7, BACK: 8, START: 9, UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15 };

export class Input {
  constructor() {
    this.keys = new Set();
    this.held = { jump: false, attack: false, use: false };
    this.edges = { jump: false, attack: false, use: false, cycleW: false, cycleI: false };
    this.stick = { id: null, bx: 0, by: 0, tx: 0, ty: 0, x: 0, y: 0, active: false };
    this.R = 62;
    this.enabled = false;
    this.onKey = null; // (key) => handled? (pause, mute, menus)
    this.onPad = null; // (edges) for menus
    this.padPrev = {}; this.pad = null; this.padUsedT = -1; this.touchUsed = false;
    this._buttons = [];
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
      if (!e.repeat) {
        if (this.onKey && this.onKey(k, e)) return;
        if (this.enabled) {
          if (k === ' ' || k === 'k' || k === 'z') this.edges.jump = true;
          if (k === 'j' || k === 'x' || k === 'f') this.edges.attack = true;
          if (k === 'e' || k === 'l' || k === 'c') this.edges.use = true;
          if (k === 'q') this.edges.cycleW = true;
          if (k === 'tab' || k === 'r') this.edges.cycleI = true;
        }
      }
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.reset());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.reset(); });
    window.addEventListener('pagehide', () => this.reset());
  }

  reset() {
    this.keys.clear();
    this.held.jump = this.held.attack = this.held.use = false;
    for (const k in this.edges) this.edges[k] = false;
    Object.assign(this.stick, { id: null, active: false, x: 0, y: 0 });
    for (const b of this._buttons) b.classList.remove('down');
    this.drawStick();
  }

  // ------------------------------------------------------------------ touch
  // zone: the full-screen layer under the HUD. Left 55 %: the floating stick. Right: tap = jump.
  bindZone(zone, base, knob) {
    this.zone = zone; this.base = base; this.knob = knob;
    zone.style.touchAction = 'none';
    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      e.preventDefault();
      if (e.pointerType === 'touch') this.touchUsed = true;
      const r = zone.getBoundingClientRect();
      if (e.pointerType === 'mouse') { // desktop: the keys move; clicks attack (left) and use (right)
        if (e.button === 0) this.edges.attack = true; else if (e.button === 2) this.edges.use = true;
        return;
      }
      if (e.clientX - r.left < r.width * 0.55) {
        Object.assign(this.stick, { id: e.pointerId, bx: e.clientX, by: e.clientY, tx: e.clientX, ty: e.clientY, x: 0, y: 0, active: true });
        try { zone.setPointerCapture(e.pointerId); } catch (_) { /* synthetic events throw */ }
        this.drawStick();
      } else { this.edges.jump = true; this.held.jump = true; this._tapJump = e.pointerId; }
    }, { passive: false });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.stick.id) return;
      e.preventDefault();
      if (e.pointerType === 'mouse' && e.buttons === 0) { this.release(); return; }
      this.moveStick(e.clientX, e.clientY);
    }, { passive: false });
    const end = (e) => {
      if (e.pointerId === this.stick.id) this.release();
      if (e.pointerId === this._tapJump) { this.held.jump = false; this._tapJump = null; }
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end); zone.addEventListener('lostpointercapture', end);
    zone.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  release() { Object.assign(this.stick, { id: null, active: false, x: 0, y: 0 }); this.drawStick(); }
  moveStick(x, y) {
    const S = this.stick, R = this.R;
    let dx = x - S.bx, dy = y - S.by;
    const d = Math.hypot(dx, dy);
    if (d > R) { S.bx += (dx / d) * (d - R); S.by += (dy / d) * (d - R); dx = x - S.bx; dy = y - S.by; } // the base follows the thumb
    S.tx = x; S.ty = y;
    const dd = Math.hypot(dx, dy), dead = 8;
    if (dd > dead) { const k = Math.min(1, (dd - dead) / (R * 0.75 - dead)); const s = k * k * (3 - 2 * k); S.x = (dx / dd) * Math.max(s, 0.35); S.y = (dy / dd) * Math.max(s, 0.35); }
    else S.x = S.y = 0;
    this.drawStick();
  }
  drawStick() {
    if (!this.base) return;
    const S = this.stick;
    this.base.style.display = this.knob.style.display = S.active ? 'block' : 'none';
    if (S.active) {
      this.base.style.transform = `translate(${S.bx}px, ${S.by}px)`;
      this.knob.style.transform = `translate(${S.bx + S.x * this.R * 0.8}px, ${S.by + S.y * this.R * 0.8}px)`;
    }
  }

  // hold buttons with their own pointer (JUMP holds for a higher jump; ATTACK and USE are taps)
  bindButton(el, name) {
    this._buttons.push(el);
    el.style.touchAction = 'none';
    let owner = null;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (!this.enabled) return;
      if (e.pointerType === 'touch') this.touchUsed = true;
      owner = e.pointerId;
      this.held[name] = true; this.edges[name] = true;
      el.classList.add('down');
      try { el.setPointerCapture(e.pointerId); } catch (_) { /* synthetic */ }
    }, { passive: false });
    const off = (e) => { if (owner !== null && e.pointerId !== owner) return; owner = null; this.held[name] = false; el.classList.remove('down'); };
    el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  bindTap(el, name) { // badges: tap to cycle
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (this.enabled) this.edges[name] = true; }, { passive: false });
  }

  // ------------------------------------------------------------------ gamepad
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected && (!gp || p.mapping === 'standard')) gp = p;
    if (!gp) { this.pad = null; this.padPrev = {}; return {}; }
    const down = (i) => { const q = gp.buttons[i]; return !!q && (q.pressed || q.value > 0.5); };
    const lx0 = gp.axes[0] || 0, ly0 = gp.axes[1] || 0, m = Math.hypot(lx0, ly0), dz = 0.2;
    let lx = 0, ly = 0;
    if (m > dz) { const k = Math.min(1, (m - dz) / (1 - dz)); lx = (lx0 / m) * k; ly = (ly0 / m) * k; }
    const now = { a: down(PAD.A), b: down(PAD.B), x: down(PAD.X), y: down(PAD.Y), lb: down(PAD.LB), rb: down(PAD.RB), lt: down(PAD.LT), rt: down(PAD.RT), start: down(PAD.START), back: down(PAD.BACK), up: down(PAD.UP), down: down(PAD.DOWN), left: down(PAD.LEFT), right: down(PAD.RIGHT) };
    const edges = {};
    for (const k in now) if (now[k] && !this.padPrev[k]) edges[k] = true;
    this.padPrev = now;
    let dx = (now.right ? 1 : 0) - (now.left ? 1 : 0), dy = (now.down ? 1 : 0) - (now.up ? 1 : 0);
    if (dx || dy) { const n = Math.hypot(dx, dy); lx = dx / n; ly = dy / n; }
    this.pad = { lx, ly, a: now.a };
    if (m > 0.4 || Object.keys(edges).length) this.padUsedT = performance.now();
    if (this.enabled) {
      if (edges.a) this.edges.jump = true;
      if (edges.x || edges.rt) this.edges.attack = true;
      if (edges.b || edges.lt) this.edges.use = true;
      if (edges.y) this.edges.cycleI = true;
      if (edges.lb || edges.rb) this.edges.cycleW = true;
    }
    if (this.onPad && Object.keys(edges).length) this.onPad(edges, this.pad);
    return edges;
  }

  // ------------------------------------------------------------------ the step's control
  // Screen-relative: up on the stick is up the screen. yaw is the camera's.
  read(yaw) {
    let sx = 0, sy = 0;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) sx -= 1;
    if (k.has('d') || k.has('arrowright')) sx += 1;
    if (k.has('w') || k.has('arrowup')) sy -= 1;
    if (k.has('s') || k.has('arrowdown')) sy += 1;
    if (sx || sy) { const n = Math.hypot(sx, sy); sx /= n; sy /= n; }
    else if (this.stick.active) { sx = this.stick.x; sy = this.stick.y; }
    else if (this.pad && (this.pad.lx || this.pad.ly)) { sx = this.pad.lx; sy = this.pad.ly; }
    // screen right = (cos yaw, −sin yaw); screen up = (−sin yaw, −cos yaw)
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const mx = sx * c + -sy * -s, mz = sx * -s + -sy * -c;
    const jumpHeld = this.held.jump || k.has(' ') || k.has('k') || k.has('z') || !!this.pad?.a;
    const ctl = { mx, mz, jump: jumpHeld, jumpP: this.edges.jump, attackP: this.edges.attack, useP: this.edges.use, cycleW: this.edges.cycleW, cycleI: this.edges.cycleI };
    return ctl;
  }
  consume() { for (const q in this.edges) this.edges[q] = false; }
}
