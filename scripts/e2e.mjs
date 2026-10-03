// Full playthrough in headless Chrome: loop 1 -> ambush -> void -> loop 2 -> every errand -> ending.
// usage: node scripts/e2e.mjs [url]   (default http://localhost:5191/)
import { chromium } from 'playwright-core';

const URL = process.argv[2] ?? 'http://localhost:5191/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && !/vibrate/.test(m.text()) && errors.push(m.text()));

const t0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${s}`);
const sleep = (ms) => page.waitForTimeout(ms);
const state = () => page.evaluate(() => {
  const g = window.__game;
  const s = g.story.s;
  return { beat: s.beat, loop: s.loop, w: s.wallet, e: s.errands, talking: g.hud.talking, up: g.phone.up, screen: g.phone.current, trace: s.trace };
});
async function until(pred, what, ms = 30000, advance = false) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await state();
    if (pred(s)) return s;
    if (advance && s.talking) await page.evaluate(() => document.querySelector('.dlg')?.click());
    await sleep(advance ? 240 : 150);
  }
  throw new Error(`timeout waiting for: ${what} :: ${JSON.stringify(await state())}`);
}
async function talk(max = 30) {
  for (let i = 0; i < max; i++) {
    const s = await state();
    if (!s.talking) {
      await sleep(400);
      if (!(await state()).talking) return;
    }
    await page.evaluate(() => document.querySelector('.dlg')?.click());
    await sleep(230);
  }
}
const hold = (sel) =>
  page.evaluate((sel) => document.querySelector(sel).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })), sel);
const teleport = (id, dz = 0) =>
  page.evaluate(
    ([id, dz]) => {
      const g = window.__game;
      const s = g.city.stations[id];
      g.player.x = s.x;
      g.player.z = s.z + dz;
    },
    [id, dz],
  );
const click = (sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel);

try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__game, null, { timeout: 30000 });
  log('booted');
  await click('#start');
  await sleep(500);
  await click('.card .cta');
  await until((s) => s.beat === 'loop1' && s.w.transparent === 5, 'loop1 payday');
  log('PASS loop1: paid 5 ZEC publicly');

  await teleport('kiosk');
  await until((s) => s.talking, 'courier dialogue');
  await talk();
  await until((s) => s.up && s.screen === 'send2', 'pay screen');
  await hold('[data-hold=send]');
  await until((s) => s.talking, 'tailor radio after paying', 8000);
  log('PASS loop1: paid noodles, Tailor noticed');
  await talk();
  await until((s) => s.talking, 'Zero in the void', 15000);
  const inVoid = await page.evaluate(() => document.getElementById('ui').classList.contains('void'));
  if (!inVoid) throw new Error('void not shown');
  log('PASS ambush -> void with Zero');
  await talk(40);
  await until((s) => s.beat === 'setup' && s.loop === 2, 'loop 2 setup');
  log('PASS rewind into loop 2');

  // wallet setup
  await sleep(1600);
  await page.evaluate(() => window.__game.phone.raise());
  await sleep(300);
  await page.evaluate(() => window.__game.phone.show('create'));
  await click('.ph-body .btn');
  await sleep(150);
  await click('[data-act=seed-done]');
  for (const w of ['vivid', 'velvet', 'meadow']) {
    await page.evaluate((w) => [...document.querySelectorAll('[data-act=quiz]')].find((b) => b.dataset.w === w).click(), w);
    await sleep(450);
  }
  await until((s) => s.w.created, 'wallet created');
  log('PASS wallet created with 24-word quiz');

  await until((s) => s.beat === 'payday' && s.w.transparent === 5, 'loop2 payday', 15000);
  await until((s) => !!s.trace, 'trace started', 30000, true);
  log('PASS payday: trace running');
  await page.evaluate(() => {
    window.__game.phone.raise();
    window.__game.phone.show('shield');
  });
  await sleep(300);
  await hold('[data-hold=shield]');
  await until((s) => s.w.shielded === 5 && !s.trace, 'shielded', 10000);
  log('PASS shielded 5 ZEC, trace cleared');
  await until((s) => s.beat === 'errands', 'errands', 30000, true);
  log('PASS errands unlocked');

  // café
  await teleport('cafe');
  await until((s) => s.talking, 'barista');
  await talk();
  await until((s) => s.screen === 'send2', 'café pay screen');
  await page.fill('#memo', 'oat milk please');
  await hold('[data-hold=send]');
  await until((s) => s.e.cafe, 'café paid', 10000, true);
  await talk();
  log('PASS café: private send + memo');

  // arcade
  await page.evaluate(() => {
    const g = window.__game;
    g.player.x = 60;
    g.player.z = 47;
  });
  await sleep(600);
  await teleport('arcade');
  await until((s) => s.talking, 'Mika');
  await talk();
  await until((s) => s.screen === 'receive', 'receive screen');
  await click('[data-act=show-addr]');
  await until((s) => s.talking, 'Mika objects to transparent');
  await talk();
  await until((s) => s.screen === 'receive', 'receive shielded');
  await click('[data-act=show-addr]');
  await until((s) => s.e.friend, 'Mika paid', 15000, true);
  await talk();
  log('PASS arcade: refused transparent, received shielded');

  // exchange: the safe way (rent only)
  await page.evaluate(() => {
    const g = window.__game;
    g.player.x = 70;
    g.player.z = 47;
  });
  await sleep(600);
  await teleport('exchange');
  await until((s) => s.talking, 'clerk');
  await talk();
  await until((s) => s.screen === 'send2', 'exchange pay screen');
  if (process.argv.includes('--trap')) {
    // the mistake: cash out (almost) everything straight after shielding
    await hold('[data-hold=send]');
    for (let i = 0; i < 80 && !(await page.$('.card.red .cta')); i++) {
      await page.evaluate(() => document.querySelector('.dlg')?.click());
      await sleep(250);
    }
    await page.waitForSelector('.card.red .cta', { timeout: 5000 });
    log('PASS trap: unshielding everything got matched and caught');
    await click('.card.red .cta');
    await until((s) => s.talking || s.screen === 'send2', 'clerk again after rewind', 15000);
    const w = await state();
    if (Math.abs(w.w.shielded - 5.4799) > 0.01) throw new Error('rewind did not restore wallet: ' + w.w.shielded);
    await talk();
    await until((s) => s.screen === 'send2', 'exchange pay screen after rewind');
    log('PASS rewind restored wallet and re-opened the clerk');
  }
  await page.evaluate(() => {
    const sl = document.querySelector('#slider');
    sl.value = '1.2';
    sl.dispatchEvent(new Event('input'));
  });
  await hold('[data-hold=send]');
  await until((s) => s.e.exchange, 'rent paid safely', 15000, true);
  await talk();
  log('PASS exchange: rent paid without being matched');

  await until((s) => s.beat === 'dawn', 'dawn', 20000, true);
  await page.evaluate(() => {
    const g = window.__game;
    g.player.x = 30;
    g.player.z = 47;
  });
  await sleep(600);
  await teleport('home');
  await until((s) => s.talking, 'ending dialogue', 15000);
  for (let i = 0; i < 60 && !(await page.$('.card .cta')); i++) {
    await page.evaluate(() => document.querySelector('.dlg')?.click());
    await sleep(250);
  }
  await page.waitForSelector('.card .cta', { timeout: 5000 });
  const caseFile = await page.evaluate(() => document.querySelector('.card h2')?.textContent);
  if (caseFile !== 'SUBJECT: UNKNOWN') throw new Error('ending card missing: ' + caseFile);
  await click('.card .cta');
  for (let i = 0; i < 60 && !(await page.$('#again')); i++) {
    await page.evaluate(() => document.querySelector('.dlg')?.click());
    await sleep(250);
  }
  await page.waitForSelector('#again', { timeout: 5000 });
  log('PASS ending: SUBJECT UNKNOWN + do-it-for-real card');

  if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
  console.log('E2E PASSED: full loop');
} catch (e) {
  console.error('E2E FAILED:', e.message);
  await page.screenshot({ path: 'e2e-fail.png' });
  process.exitCode = 1;
} finally {
  await browser.close();
}
