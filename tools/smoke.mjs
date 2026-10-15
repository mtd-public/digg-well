// Browser smoke test: boots the real game at desktop, phone (portrait and landscape) and tablet
// sizes, plays a few seconds of scripted input (keyboard on desktop, touch on the rest), and fails on
// console errors, page scroll, a blank frame, or controls that don't reach the sim.
//   python3 -m http.server 4210 &      # from the repo root
//   node tools/smoke.mjs               # BASE=http://localhost:4210/  SHOTS=dir to save screenshots
import { chromium, devices } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE || 'http://localhost:4210/';
const SHOTS = process.env.SHOTS || '';
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM || (process.env.CI ? undefined : '/opt/pw-browsers/chromium'),
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
let fails = 0;
const fail = (m) => { fails++; console.error('FAIL', m); };

async function run(name, ctxOpts, script) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|fonts\.g|net::ERR/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}?capture=1&seed=4242&dpr=1`);
  await page.waitForFunction(() => window.GAME && window.GAME.world, null, { timeout: 60000 });
  await page.waitForTimeout(600);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-title.png` });
  await script(page);
  const scroll = await page.evaluate(() => [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight]);
  if (scroll[0] > 0 || scroll[1] > 0) fail(`${name}: the page scrolls ${scroll}`);
  const lit = await page.evaluate(() => {
    const c = document.getElementById('view'), g = c.getContext('webgl2') || c.getContext('webgl');
    const px = new Uint8Array(4 * 64 * 64); g.readPixels((c.width >> 1) - 32, (c.height >> 1) - 32, 64, 64, g.RGBA, g.UNSIGNED_BYTE, px);
    let n = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] > 40) n++; return n;
  });
  if (lit < 40) fail(`${name}: the middle of the frame is blank (${lit} lit px)`);
  // the HUD's pause button is on screen
  const pb = await page.evaluate(() => { const r = document.getElementById('b-pause').getBoundingClientRect(); return r.right <= innerWidth && r.top >= 0 && r.width > 0; });
  if (!pb) fail(`${name}: the pause button is off screen`);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}-play.png` });
  if (errors.length) fail(`${name}: console errors\n  ${errors.slice(0, 6).join('\n  ')}`);
  console.log(`${name}: ${errors.length} errors, lit px ${lit}`);
  await ctx.close();
}

// desktop: keyboard and mouse
await run('desktop', { viewport: { width: 1280, height: 720 } }, async (page) => {
  await page.click('#b-start');
  await page.waitForFunction(() => GAME.state === 'play');
  const x0 = await page.evaluate(() => GAME.world.player.x);
  // hold D until the Tycoon has moved (a slow software-GL runner advances the sim slowly, so no fixed time)
  await page.keyboard.down('d');
  await page.waitForFunction((x) => Math.abs(GAME.world.player.x - x) > 0.5, x0, { timeout: 15000 }).catch(() => {});
  await page.keyboard.up('d');
  await page.keyboard.press('Space'); await page.waitForTimeout(300);
  await page.keyboard.press('j'); await page.waitForTimeout(400);
  await page.mouse.click(640, 400); await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({ x: GAME.world.player.x, swings: GAME.world.stats.dug, hud: document.getElementById('h-money').textContent }));
  if (Math.abs(s.x - x0) < 0.5) fail(`desktop: D didn't move the Tycoon (${x0} → ${s.x})`);
  await page.keyboard.press('p');
  if (await page.evaluate(() => GAME.state) !== 'pause') fail('desktop: P did not pause');
  await page.click('#b-resume');
  if (await page.evaluate(() => GAME.state) !== 'play') fail('desktop: Resume did not resume');
  // jump into the Boardroom and let the Chairman talk
  await page.evaluate(() => { const w = GAME.world, s = w.lv.shrine, p = w.player; Object.assign(p, { x: 14.5, y: s.floorTop + 1, z: 19, hp: 99, maxHp: 99 }); });
  await page.waitForTimeout(2500);
  if (await page.evaluate(() => document.getElementById('h-boss').classList.contains('hidden'))) fail('desktop: no boss bar in the Boardroom');
});

// phone portrait: touch (stick + JUMP + ATTACK + USE)
const touchPlay = async (page, name) => {
  await page.locator('#b-start').dispatchEvent('click');
  await page.waitForFunction(() => GAME.state === 'play');
  if (!(await page.evaluate(() => document.body.classList.contains('touch-on')))) fail(`${name}: touch controls not shown`);
  const vp = page.viewportSize();
  const x0 = await page.evaluate(() => GAME.world.player.z + GAME.world.player.x);
  // drag the stick up the screen with a real touch sequence (CDP)
  const cdp = await page.context().newCDPSession(page);
  const sx = vp.width * 0.22, sy = vp.height * 0.62;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
  for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - i * 12, id: 1 }] }); await page.waitForTimeout(30); }
  await page.waitForFunction((v) => Math.abs(GAME.world.player.z + GAME.world.player.x - v) > 0.5, x0, { timeout: 15000 }).catch(() => {});
  const r = await page.locator('#b-jump').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy - 72, id: 1 }, { x: r.x + r.width / 2, y: r.y + r.height / 2, id: 2 }] });
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [{ x: sx, y: sy - 72, id: 1 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(300);
  const x1 = await page.evaluate(() => GAME.world.player.z + GAME.world.player.x);
  if (Math.abs(x1 - x0) < 0.5) fail(`${name}: the stick didn't move the Tycoon (${x0.toFixed(2)} → ${x1.toFixed(2)})`);
  await page.tap('#b-attack'); await page.waitForTimeout(200);
  await page.tap('#b-use'); await page.waitForTimeout(200);
  await page.tap('#b-item'); await page.waitForTimeout(200);
  const st = await page.evaluate(() => ({ state: GAME.state, jumps: true }));
  if (st.state !== 'play') fail(`${name}: tapping the controls left play (${st.state})`);
  // tap the pause button
  await page.tap('#b-pause');
  if (await page.evaluate(() => GAME.state) !== 'pause') fail(`${name}: the pause button didn't pause`);
  await page.tap('#b-resume');
};
await run('phone', { ...devices['iPhone 13'] }, (p) => touchPlay(p, 'phone'));
await run('phone-landscape', { ...devices['iPhone 13 landscape'] }, (p) => touchPlay(p, 'phone-landscape'));
await run('tablet', { ...devices['iPad (gen 7) landscape'] }, (p) => touchPlay(p, 'tablet'));

await browser.close();
console.log(fails ? `${fails} failed` : 'smoke OK');
process.exit(fails ? 1 : 0);
