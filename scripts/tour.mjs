// Visual tour: drives the game in headless Chrome and saves screenshots at key moments.
// usage: node scripts/tour.mjs <outdir> [url]
import { chromium } from 'playwright-core';
const OUT = process.argv[2] ?? 'shots';
const URL = process.argv[3] ?? 'http://localhost:5191/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage(process.env.MOBILE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1280, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const sleep = (ms) => page.waitForTimeout(ms);
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.jpg`, quality: 70, type: 'jpeg' });
  console.log('shot', name, JSON.stringify(await page.evaluate(() => ({ beat: window.__game.story.s.beat, fps: window.__fps }))));
};
const ev = (fn, arg) => page.evaluate(fn, arg);
const adv = () => ev(() => (document.querySelector('.bub:not(.hidden)') || document.querySelector('.dlg'))?.click());
const steps = (process.argv[4] ?? 'wake,payday,void,room,errands').split(',');
await page.goto(URL);
await page.waitForFunction(() => window.__game);
await ev(() => {
  let n = 0, t = performance.now();
  const f = () => { n++; const now = performance.now(); if (now - t > 1000) { window.__fps = n; n = 0; t = now; } requestAnimationFrame(f); };
  requestAnimationFrame(f);
});
if (steps.includes('wake')) {
  await ev(() => document.getElementById('start').click());
  await sleep(500);
  await ev(() => document.querySelector('.card .cta').click());
  await sleep(2500);
  await shot('01-wake-ceiling');
  await sleep(3500);
  await shot('02-wake-buzz');
  await page.keyboard.press('e');
  await sleep(2500);
  await shot('03-phone-in-hand');
  for (let i = 0; i < 12; i++) { await adv(); await sleep(400); }
  await ev(() => { const g = window.__game; g.player.yaw = Math.PI * 1.0; });
  await sleep(600);
  await shot('04-bedroom-standing');
  await ev(() => { const g = window.__game; const h = g.city.stations.home; g.player.x = h.x; g.player.z = h.z + 4; g.player.yaw = 0; });
  await sleep(800);
  await shot('05-outside-home');
  await ev(() => { const g = window.__game; const k = g.city.stations.kiosk; g.player.x = k.x; g.player.z = k.z + 3; g.player.goTo(k.x, k.z); });
  await sleep(4000);
  await shot('06-kiosk-courier');
}
if (steps.includes('chase')) {
  await ev(() => { const g = window.__game; const k = g.city.stations.kiosk; g.player.x = k.x; g.player.z = k.z + 2; });
  await page.waitForFunction(() => window.__game.phone.current === 'send2', null, { timeout: 20000 }).catch(() => {});
  await sleep(500);
  await ev(() => document.querySelector('[data-hold=send]')?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await page.waitForFunction(() => window.__game.crew.mode === 'hunt', null, { timeout: 20000 });
  await sleep(1500);
  await shot('07-chase-start');
  await page.waitForFunction(() => window.__game.crew.nearest() < 5, null, { timeout: 30000 });
  await ev(() => { const g = window.__game; const m = g.crew.members[0]; g.player.yaw = Math.atan2(-(m.x - g.player.x), -(m.z - g.player.z)); });
  await sleep(200);
  await shot('08-crew-close');
  await sleep(1300);
  await shot('09-robbed');
  await page.waitForFunction(() => window.__game.story.s.beat === 'void', null, { timeout: 20000 });
  await sleep(2500);
  await shot('20-void-pages');
  await ev(() => { const g = window.__game; g.player.goTo(g.vw.zeroAt.x + 1, g.vw.zeroAt.z + 4); });
  await sleep(2500);
  await shot('21-void-zero-meets');
  await ev(() => { const g = window.__game; g.player.yaw += 1.6; });
  await sleep(300);
  await shot('22-void-pages-side');
}
if (steps.includes('payday')) {
  await page.goto(URL + '?start=payday');
  await page.waitForFunction(() => window.__game);
  await sleep(1500);
  await ev(() => { const g = window.__game; const z = g.companion.zero.group.position; g.player.yaw = Math.atan2(-(z.x - g.player.x), -(z.z - g.player.z)); });
  await sleep(500);
  await shot('10-zero-in-room');
  await page.waitForFunction(() => window.__game.crew.mode === 'hunt', null, { timeout: 30000 });
  await ev(() => { const g = window.__game; g.player.goTo(9.5, 40); });
  await page.waitForFunction(() => window.__game.crew.nearest() < 7, null, { timeout: 30000 });
  await ev(() => { const g = window.__game; const m = g.crew.members[0]; g.player.stop(); g.player.yaw = Math.atan2(-(m.x - g.player.x), -(m.z - g.player.z)); });
  await sleep(300);
  await shot('11-crew-at-door');
  await ev(() => { window.__game.phone.raise(); window.__game.phone.show('shield'); });
  await sleep(300);
  await ev(() => document.querySelector('[data-hold=shield]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
  await sleep(3200);
  await shot('12-shield-cut');
  await sleep(2500);
  await shot('13-after-shield');
}
if (steps.includes('void')) {
  await page.goto(URL + '?debug=void');
  await page.waitForFunction(() => window.__game);
  await sleep(2500);
  await shot('20-void-arrive');
  await ev(() => { const g = window.__game; g.player.goTo(g.vw.zeroAt.x, g.vw.zeroAt.z + 2.6); });
  await sleep(4000);
  await shot('21-void-zero');
}
if (steps.includes('errands')) {
  for (const [id, n] of [['cafe', 30], ['arcade', 31], ['exchange', 32], ['mart', 33], ['laundry', 34]]) {
    await page.goto(URL + '?debug=errands');
    await page.waitForFunction(() => window.__game);
    await sleep(800);
    await ev((id) => { const g = window.__game; const s = g.city.stations[id]; g.player.x = s.x; g.player.z = s.z + (id === 'arcade' ? 0 : 0); }, id);
    await sleep(3500);
    await shot(`${n}-${id}`);
  }
}
if (steps.includes('ending')) {
  await page.goto(URL + '?debug=dawn');
  await page.waitForFunction(() => window.__game);
  await sleep(2500);
  for (let i = 0; i < 10; i++) { await adv(); await sleep(300); }
  await ev(() => { const g = window.__game; const h = g.city.stations.home; g.player.x = h.x; g.player.z = h.z + 6; g.player.goTo(h.x, h.z); });
  await sleep(5000);
  await shot('40-dawn-home');
  for (let i = 0; i < 40 && !(await page.$('.card .cta')); i++) { await adv(); await sleep(400); }
  await sleep(600);
  await shot('41-case-file');
  await ev(() => document.querySelector('.card .cta')?.click());
  await sleep(1500);
  await shot('42-zero-farewell');
}
await browser.close();
if (errors.length) console.log('ERRORS', errors.join(' | '));
