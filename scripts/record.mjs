// Records a full real-time playthrough (video + game audio) to MP4.
// usage: node scripts/record.mjs <outdir> [url] [--until=loop1|void|payday]
// Video: Chrome DevTools screencast frames, resampled to constant 30fps into ffmpeg.
// Audio: every node the game connects to the speakers is also tapped into a MediaRecorder in the page.
import { chromium } from 'playwright-core';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';

const OUT = process.argv[2] ?? 'playthrough';
const URL = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : 'http://localhost:5191/';
const UNTIL = (process.argv.find((a) => a.startsWith('--until=')) ?? '').slice(8);
const W = 1920,
  H = 1080,
  FPS = 30;
fs.mkdirSync(OUT, { recursive: true });

const AUDIO_TAP = `(() => {
  const AC = window.AudioContext;
  window.AudioContext = class extends AC { constructor(...a) { super(...a); if (!window.__firstCtx) window.__firstCtx = this; } };
  window.webkitAudioContext = window.AudioContext;
  const rec = (ctx) => {
    if (ctx.__rec) return ctx.__rec;
    const dest = ctx.createMediaStreamDestination();
    ctx.__rec = dest;
    if (!window.__recStarted) {
      window.__recStarted = true;
      const mr = new MediaRecorder(dest.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 192000 });
      mr.ondataavailable = async (e) => {
        if (!e.data.size) return;
        const b = new Uint8Array(await e.data.arrayBuffer());
        let s = '';
        for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
        window.__audioChunk(btoa(s));
      };
      mr.start(1000);
      window.__audioStart(Date.now());
      window.__stopRec = () => new Promise((r) => { mr.onstop = () => setTimeout(r, 400); mr.stop(); });
    }
    return dest;
  };
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (target, ...rest) {
    const r = orig.call(this, target, ...rest);
    if (target instanceof AudioDestinationNode) orig.call(this, rec(this.context));
    return r;
  };
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const c = window.__firstCtx;
    if (!this.__routed && c) {
      try { c.createMediaElementSource(this).connect(c.destination); this.__routed = true; } catch (e) {}
    }
    return play.call(this);
  };
})();`;

const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

// ---------- audio sink ----------
const audioFile = `${OUT}/audio.webm`;
const audioOut = fs.createWriteStream(audioFile);
let audioStart = 0;
await page.exposeFunction('__audioChunk', (b64) => audioOut.write(Buffer.from(b64, 'base64')));
await page.exposeFunction('__audioStart', (t) => (audioStart = t));
await page.addInitScript(AUDIO_TAP);

// ---------- video sink ----------
const videoFile = `${OUT}/video.mp4`;
const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-r', String(FPS), '-i', '-', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '17', '-pix_fmt', 'yuv420p', videoFile]);
ff.stderr.on('data', (d) => process.stderr.write(d));
const cdp = await context.newCDPSession(page);
let last = null,
  t0 = null,
  written = 0,
  videoStart = 0,
  frames = 0;
cdp.on('Page.screencastFrame', (f) => {
  cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  const ts = f.metadata.timestamp;
  if (t0 === null) {
    t0 = ts;
    videoStart = ts * 1000;
  }
  const slot = Math.floor((ts - t0) * FPS);
  while (last && written < slot) {
    ff.stdin.write(last);
    written++;
  }
  last = Buffer.from(f.data, 'base64');
  frames++;
});

const T0 = Date.now();
const log = (s) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0).padStart(4)}s] ${s}`);
const sleep = (ms) => page.waitForTimeout(ms);
const G = (fn, arg) => page.evaluate(fn, arg);
const st = () =>
  G(() => {
    const g = window.__game;
    const s = g.story.s;
    return { beat: s.beat, talking: g.hud.talking, up: g.phone.up, screen: g.phone.current, x: g.player.x, z: g.player.z, path: g.player.path.length, crew: g.crew.mode, near: g.crew.nearest(), buzz: g.intro.buzzing, intro: g.intro.active, w: s.wallet, e: s.errands, tags: s.tags.length };
  });
async function until(pred, what, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const s = await st();
    if (pred(s)) return s;
    await sleep(120);
  }
  throw new Error('timeout: ' + what + ' ' + JSON.stringify(await st()));
}
/** let the dialogue play out by itself (voices auto-advance); returns once it's been quiet for `quiet` ms */
async function idle(quiet = 1800, ms = 120000) {
  const end = Date.now() + ms;
  let calm = 0;
  while (Date.now() < end) {
    const s = await st();
    calm = s.talking ? 0 : calm + 150;
    if (calm >= quiet) return;
    await sleep(150);
  }
}
async function walk(x, z, run = false) {
  if (run) await page.keyboard.down('Shift');
  await G(([x, z]) => window.__game.player.goTo(x, z), [x, z]);
  await until((s) => s.path === 0, `walk to ${x},${z}`, 60000);
  if (run) await page.keyboard.up('Shift');
}
/** smooth look: yaw toward a point (or absolute), optional pitch */
async function look(target, ms = 900, pitch = null) {
  await G(
    ([t, ms, pitch]) =>
      new Promise((res) => {
        const p = window.__game.player;
        const want = Array.isArray(t) ? Math.atan2(-(t[0] - p.x), -(t[1] - p.z)) : t;
        const y0 = p.yaw,
          p0 = p.pitch;
        const d = Math.atan2(Math.sin(want - y0), Math.cos(want - y0));
        const t0 = performance.now();
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / ms);
          const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
          p.yaw = y0 + d * e;
          if (pitch !== null) p.pitch = p0 + (pitch - p0) * e;
          if (k < 1) requestAnimationFrame(step);
          else res();
        };
        requestAnimationFrame(step);
      }),
    [target, ms, pitch],
  );
}
async function hold(sel) {
  await page.waitForSelector(sel, { state: 'visible' });
  await sleep(500);
  const b = await page.locator(sel).first().boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 8 });
  await page.mouse.down();
  await sleep(1350);
  await page.mouse.up();
}
async function tap(sel, wait = 650) {
  await page.waitForSelector(sel, { state: 'visible' });
  await sleep(wait);
  const b = await page.locator(sel).first().boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
}
async function tapPhoneOnNightstand() {
  const [x, y] = await G(() => {
    const g = window.__game;
    const v = g.intro.phone.position.clone().project(g.stage.camera);
    return [((v.x + 1) / 2) * innerWidth, ((1 - v.y) / 2) * innerHeight];
  });
  await page.mouse.move(x - 120, y + 60);
  await page.mouse.move(x, y, { steps: 10 });
  await sleep(300);
  await page.mouse.click(x, y);
}
async function arrive(x, z, run = false) {
  await walk(x, z, run);
  await until((s) => s.talking || s.up, `someone at ${x},${z}`, 15000).catch(() => {});
}

try {
  await page.goto(URL);
  await page.waitForFunction(() => window.__game);
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  log('recording');
  await sleep(4000); // title screen
  await tap('#start', 300);
  await sleep(3500); // read the payday card
  await tap('.card .cta', 200);

  // ================= NIGHT ONE =================
  await until((s) => s.buzz, 'phone buzzing', 20000);
  await sleep(2600);
  await tapPhoneOnNightstand();
  log('picked up the phone');
  await until((s) => s.beat === 'loop1' && !s.intro, 'awake');
  await idle(1200);
  await sleep(1200);
  await look(Math.PI * 0.95, 1400, 0); // look around the room before heading out
  await sleep(600);
  await walk(40.5, 47.6);
  await arrive(40.5, 43.4);
  log('at the kiosk');
  await until((s) => s.up && s.screen === 'send2', 'pay screen');
  await sleep(1800);
  await hold('[data-hold=send]');
  log('paid noodles from the public wallet');
  await until((s) => s.crew === 'hunt', 'the crew comes', 20000);
  await G(() => {
    const g = window.__game;
    g.player.stop();
  });
  await sleep(600);
  await look([75, 40], 1200, 0.12); // the red beacons coming out of the alley
  await sleep(2600);
  if (UNTIL === 'loop1') throw new Error('STOP');
  log('running');
  await page.keyboard.down('Shift');
  await G(() => window.__game.player.goTo(24, 47));
  await page.waitForSelector('.go.in .go-btn:not([disabled])', { timeout: 60000 });
  await page.keyboard.up('Shift');
  log('game over');
  await sleep(7500); // Zero laughing
  await tap('.go.in .go-btn', 200);
  await until((s) => s.beat === 'void', 'void', 30000);
  log('caught. the void');

  // ================= THE VOID =================
  await sleep(1500);
  await look(Math.PI * 0.5, 2200, 0.05); // the clue pages orbiting
  await look(-Math.PI * 0.4, 2600, 0.05);
  await look(0, 1600, -0.05);
  await sleep(500);
  await G(() => {
    const g = window.__game;
    g.player.goTo(g.vw.zeroAt.x, g.vw.zeroAt.z + 2.6);
  });
  await until((s) => s.talking, 'Zero speaks', 30000);
  await until((s) => s.beat === 'wake2', 'night two', 180000);
  log('night two');
  if (UNTIL === 'void') throw new Error('STOP');

  // ================= NIGHT TWO =================
  await until((s) => s.buzz, 'buzzing again', 30000);
  await sleep(2200);
  await tapPhoneOnNightstand();
  await until((s) => s.beat === 'setup', 'setup');
  await idle(1000);
  await sleep(800);
  await page.keyboard.press('e');
  await sleep(900);
  await tap('[data-go="create"]');
  await tap('[data-go="seed"]', 2200);
  await sleep(4500); // the 24 words
  await tap('[data-act="seed-done"]', 300);
  for (const w of ['vivid', 'velvet', 'meadow']) await tap(`[data-act="quiz"][data-w="${w}"]`, 1100);
  await until((s) => s.w.created, 'wallet created');
  log('wallet created');
  await until((s) => s.beat === 'payday' && s.w.transparent > 4, 'payday', 60000);
  await sleep(2500);
  await walk(9.5, 39.6);
  await look([75, 40], 1000, 0.1);
  await until((s) => s.crew === 'hunt', 'crew dispatched', 60000);
  await sleep(2500); // see the red beacons start toward you, then shield (proving takes a few seconds)
  await page.keyboard.press('e');
  await sleep(700);
  await tap('[data-go="shield"]', 300);
  await hold('[data-hold=shield]');
  log('shielded');
  await until((s) => s.beat === 'errands', 'errands', 60000);
  await idle(1200);
  if (UNTIL === 'payday') throw new Error('STOP');

  // ================= THE REST OF THE NIGHT =================
  await arrive(9.5, 59.6); // the Tailor's shop
  await idle();
  await arrive(26.5, 57.4); // Spin Cycle
  await idle();
  await walk(21.4, 60); // tag
  await sleep(1800);
  await walk(30.5, 74.4); // tag
  await sleep(1800);

  await arrive(37.6, 85); // Mika
  await until((s) => s.screen === 'receive' && s.up, 'receive screen');
  await sleep(1500);
  await tap('[data-act="show-addr"]');
  await until((s) => s.talking, 'Mika objects');
  await idle(600);
  await until((s) => s.screen === 'receive' && s.up, 'receive shielded');
  await sleep(1500);
  await tap('[data-act="show-addr"]');
  await until((s) => s.e.friend, 'Mika paid', 30000);
  await idle();
  log('arcade done');

  await walk(40.5, 47.6, true);
  await arrive(40.5, 43.4); // kiosk: swap
  await until((s) => s.screen === 'swap' && s.up, 'swap screen', 30000);
  await sleep(1800);
  await hold('[data-hold=swap]');
  await idle();
  log('swapped');
  await walk(39.6, 42.6); // tag on the kiosk post
  await sleep(1800);

  await arrive(59.5, 58.2); // Nonce Mart
  await idle();
  await walk(75.4, 63.2); // tag
  await sleep(1500);
  await arrive(85.5, 61.4); // café
  await until((s) => s.screen === 'send2' && s.up, 'café pay');
  await sleep(1000);
  await page.click('#memo');
  await page.keyboard.type('oat milk, please', { delay: 90 });
  await sleep(600);
  await hold('[data-hold=send]');
  await until((s) => s.e.cafe, 'coffee', 20000);
  await idle();
  log('café done');

  await arrive(88.5, 37.4); // Cobalt: the mistake first
  await until((s) => s.screen === 'send2' && s.up, 'exchange pay');
  await sleep(2500);
  await hold('[data-hold=send]');
  log('cashed out everything at once...');
  await until((s) => s.beat === 'trap', 'matched', 20000);
  await sleep(2500);
  await page.keyboard.down('Shift');
  await G(() => window.__game.player.goTo(70, 46));
  await page.waitForSelector('.go.in .go-btn:not([disabled])', { timeout: 60000 });
  await page.keyboard.up('Shift');
  await sleep(8000); // Zero laughs; read the lesson
  await tap('.go.in .go-btn', 200);
  log('rewound: back in bed, Zero calling');
  await page.waitForSelector('.call.live', { timeout: 30000 });
  await sleep(2500);
  await walk(9.5, 42.5); // out the door while he talks
  await walk(70, 46, true);
  await arrive(88.5, 37.4); // back to Cobalt
  await until((s) => s.screen === 'send2' && s.up, 'exchange pay again', 60000);
  await sleep(1200);
  await G(() => {
    const sl = document.querySelector('#slider');
    sl.value = '1.2';
    sl.dispatchEvent(new Event('input'));
  });
  await sleep(1500);
  await hold('[data-hold=send]');
  await until((s) => s.e.exchange, 'rent paid', 30000);
  await idle();
  log('rent paid safely');

  await arrive(75.4, 35.6); // the alley: Spindle, tag
  await idle();
  await look([75, 38.4], 800, 0.05);
  await sleep(1500);
  await walk(53.5, 13); // last tag
  await sleep(2000);
  await until((s) => s.beat === 'dawn', 'dawn', 30000);
  await idle();
  log('heading home');
  await walk(7.5, 38, true);
  await page.waitForSelector('.card .cta', { timeout: 90000 });
  await sleep(9000); // case file
  await tap('.card .cta', 200);
  await page.waitForSelector('#again', { timeout: 120000 });
  await sleep(8000);
  log('the end');
} catch (e) {
  if (e.message !== 'STOP') {
    console.error('RECORD FAILED:', e.message);
    await page.screenshot({ path: `${OUT}/fail.png` });
  }
}

// ---------- finish ----------
await G(() => window.__stopRec?.()).catch(() => {});
await cdp.send('Page.stopScreencast').catch(() => {});
const endSlot = Math.floor((Date.now() / 1000 - t0) * FPS);
while (last && written < endSlot) {
  ff.stdin.write(last);
  written++;
}
ff.stdin.end();
await new Promise((r) => ff.on('close', r));
await new Promise((r) => audioOut.end(r));
await browser.close();
log(`frames received ${frames}, written ${written} (${(written / FPS).toFixed(1)}s), avg ${(frames / (written / FPS)).toFixed(1)} fps captured`);
const off = Math.max(0, audioStart - videoStart);
log(`audio offset ${off}ms`);
const final = `${OUT}/lose-the-tail-playthrough.mp4`;
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', videoFile, '-i', audioFile, '-filter_complex', `[1:a]adelay=${off}|${off},apad[a]`, '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', final]);
log('wrote ' + final);
if (errors.length) console.log('page errors:', errors.join(' | '));
