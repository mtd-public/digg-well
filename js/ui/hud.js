// The HUD: DOM, updated from throttled snapshots (house rule 1), plus speech bubbles and floating
// money projected over the 3D view every frame.
import { T, DEPTHS, UPGRADES, ITEMS } from '../sim/tuning.js';
import { power } from '../sim/common.js';

const $ = (id) => document.getElementById(id);
const W_ICON = { shovel: '⛏', pickaxe: '⚒', shotgun: '▬', bombs: '🧨' };
const W_NAME = { shovel: 'Shovel', pickaxe: 'Pickaxe', shotgun: 'Shotgun', bombs: 'Dynamite' };
const I_ICON = { gin: 'XXX', shard: '★', flare: '!' };

export class Hud {
  constructor() {
    this.el = $('hud');
    this.bub = $('bubbles');
    this.pool = [];
    this.live = [];
    this.last = {};
    this.snapT = 0;
    this.bannerT = 0;
    this.comboT = 0;
    this.pt = { x: 0, y: 0, on: false };
  }

  show(on) { this.el.classList.toggle('hidden', !on); if (!on) this.clearBubbles(); }

  banner(big, small, kind = '') {
    const b = $('h-banner');
    b.className = `banner on ${kind}`;
    b.innerHTML = `<b>${big}</b>${small ? `<span>${small}</span>` : ''}`;
    this.bannerT = kind === 'boss' ? 3.4 : 2.6;
  }

  combo(n, gold, heal) {
    const c = $('h-combo');
    c.innerHTML = `<b>COMBO ×${n}</b><span>+$${gold}${heal ? ' · ♥' : ''}</span>`;
    c.className = 'combo on';
    this.comboT = 1.6;
  }

  // speech bubbles and floating text, anchored to a world point (or an entity id)
  say(text, x, y, z, { id = null, cls = '', life = 2.2 } = {}) {
    for (const b of this.live) if (id != null && b.id === id) { b.life = 0; }
    let el = this.pool.pop();
    if (!el) { el = document.createElement('div'); this.bub.appendChild(el); }
    el.className = `bubble ${cls}`;
    el.textContent = text;
    el.style.display = 'block';
    this.live.push({ el, id, x, y, z, life, max: life, cls });
  }
  float(text, x, y, z, cls = 'money') { this.say(text, x, y, z, { cls: `float ${cls}`, life: 0.9 }); }
  clearBubbles() { for (const b of this.live) { b.el.style.display = 'none'; this.pool.push(b.el); } this.live.length = 0; }

  frame(w, view, dt) {
    // bubbles follow their speaker
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.life -= dt;
      if (b.life <= 0) { b.el.style.display = 'none'; this.pool.push(b.el); this.live.splice(i, 1); continue; }
      if (b.id === 'p') { b.x = w.player.x; b.y = w.player.y + 1.45; b.z = w.player.z; }
      else if (b.id != null) {
        const e = w.ents.find((q) => q.id === b.id);
        if (e && e.alive) { b.x = e.x; b.y = e.y + (e.h || 0.9) + 0.35; b.z = e.z; }
      }
      const rise = b.cls.includes('float') ? (1 - b.life / b.max) * 0.9 : 0;
      view.toScreen(b.x, b.y + rise, b.z, this.pt);
      if (!this.pt.on || Math.abs(b.y - w.player.y) > 6) { b.el.style.opacity = '0'; continue; }
      b.el.style.opacity = String(Math.min(1, b.life * 3));
      const half = (b.w ||= b.el.offsetWidth || 120) / 2 + 6;
      const x = Math.max(half, Math.min(view.cw - half, this.pt.x)), y = Math.max(70, this.pt.y);
      b.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
    }
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) $('h-banner').className = 'banner';
    if (this.comboT > 0 && (this.comboT -= dt) <= 0) $('h-combo').className = 'combo';
    this.snapT -= dt;
    if (this.snapT > 0) return;
    this.snapT = 0.1;
    this.snapshot(w);
  }

  snapshot(w) {
    const p = w.player, L = this.last;
    const set = (k, v, fn) => { if (L[k] !== v) { L[k] = v; fn(v); } };
    set('hp', `${p.hp}/${p.maxHp}`, () => {
      let h = '';
      for (let i = 0; i < p.maxHp; i++) h += `<i class="${i < p.hp ? 'on' : ''}">♥</i>`;
      $('h-hearts').innerHTML = h;
    });
    set('money', p.gold, (v) => { $('h-money').textContent = v.toLocaleString('en-US'); });
    const pw = power(p);
    set('power', pw.toFixed(1), (v) => { $('h-power').textContent = `×${v} POWER`; $('h-power').style.setProperty('--k', String(Math.min(1, (pw - 1) / (T.POWER_CAP - 1)))); });
    set('pigs', w.piggies.join(','), () => {
      $('h-pigs').innerHTML = w.piggies.map((s, i) => `<i class="${s}" title="Depth ${i + 1}">🐷</i>`).join('');
    });
    const st = w.lv.stories[w.storyIdx];
    const di = st.depth;
    set('depth', di, () => {
      $('h-depth').textContent = DEPTHS[di].shrine ? 'THE BOTTOM' : `DEPTH ${di + 1}`;
      $('h-name').textContent = DEPTHS[di].name;
    });
    const ds = w.lv.stories.filter((s) => s.depth === di);
    const k = ds.indexOf(st);
    set('stories', `${di}:${k}`, () => {
      $('h-stories').innerHTML = DEPTHS[di].shrine ? '' : ds.map((s, i) => `<i class="${i < k ? 'done' : i === k ? 'here' : ''} ${s.floor === 'collar' ? 'exit' : ''}"></i>`).join('');
    });
    const metres = Math.max(0, Math.round((w.lv.stories[0].floorTop - p.y) * 2));
    set('m', metres, (v) => { $('h-metres').textContent = `${v} ft`; });
    // weapon and item badges
    const wa = p.weapon === 'shotgun' ? p.ammo.shotgun : p.weapon === 'bombs' ? p.ammo.bombs : p.weapon === 'pickaxe' ? p.ammo.pickaxe : '∞';
    set('weapon', `${p.weapon}${wa}${p.golden > 0}`, () => {
      $('h-wicon').textContent = W_ICON[p.weapon] || '?';
      $('h-wammo').textContent = `${W_NAME[p.weapon]} ${wa}`;
      $('b-weapon').classList.toggle('golden', p.golden > 0);
      $('b-weapon').classList.toggle('multi', p.weapons.length > 1);
      $('b-attack').textContent = p.carry ? '↗' : W_ICON[p.weapon] || '⛏';
    });
    const sel = p.itemSel, n = p.items[sel] || 0;
    const anyItem = Object.keys(ITEMS).some((q) => p.items[q] > 0);
    set('item', `${sel}${n}${anyItem}${Object.values(p.items).join()}`, () => {
      $('h-iicon').textContent = anyItem ? I_ICON[sel] : '—';
      $('h-icount').textContent = anyItem ? `${ITEMS[sel].name} ×${n}` : 'no item';
      $('b-item').classList.toggle('empty', !anyItem);
      $('b-item').dataset.item = sel;
      $('b-item').classList.toggle('multi', Object.keys(ITEMS).filter((q) => p.items[q] > 0).length > 1);
    });
    set('golden', p.golden > 0 ? Math.ceil(p.golden * 4) : 0, () => {
      $('b-item').style.setProperty('--g', String(p.golden > 0 ? Math.min(1, p.golden / T.GOLDEN_TIME) : 0));
      document.body.classList.toggle('golden', p.golden > 0 && p.golden < 50);
    });
    set('burn', p.burn > 0, (v) => document.body.classList.toggle('burning', v));
    set('upg', [...p.upgrades].join(','), () => {
      $('h-upg').innerHTML = [...p.upgrades].map((u) => `<i title="${UPGRADES[u].name}: ${UPGRADES[u].desc}">${UPG_ICON[u] || '•'}</i>`).join('');
    });
    const pr = w.prompt ? w.prompt.text : '';
    set('prompt', pr, (v) => { const el = $('h-prompt'); el.textContent = v; el.classList.toggle('on', !!v); });
    // the Chairman's health
    const boss = w.ents.find((e) => e.boss && e.alive);
    const showBoss = !!boss && st.kind === 'shrine' && w.bossIntro;
    set('boss', showBoss ? Math.ceil((boss.hp / boss.maxHp) * 100) : -1, (v) => {
      $('h-boss').classList.toggle('hidden', v < 0);
      if (v >= 0) $('h-bossfill').style.width = `${v}%`;
    });
  }
}

const UPG_ICON = { steeltoe: '🥾', spring: '⤒', overalls: '♥', magnet: 'U', lamp: '☀', rocket: '⇈', gloves: '✋', teeth: '$', choke: '∴' };
