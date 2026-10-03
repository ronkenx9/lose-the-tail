import './style.css';
import * as THREE from 'three';
import { buildCity } from './engine/city';
import { createStage } from './engine/scene';
import { Player } from './engine/player';
import { Character, HEADS, Trails, Zero, headByRole, loadAtlas, lookOf } from './engine/characters';
import { Npcs } from './engine/npcs';
import { bindInput, groundHit } from './engine/input';
import { Drones } from './engine/drones';
import { Billboards } from './engine/billboards';
import { Hand } from './engine/hand';
import { Phone } from './ui/phone';
import { Hud } from './ui/hud';
import { Story } from './game/story';
import { Sfx } from './game/sfx';
import { fmtClock } from './game/state';
import { portrait } from './ui/portrait';
import { makeMap } from './ui/map';
import heads from './data/heads.json';

async function boot() {
  const ui = document.getElementById('ui')!;
  ui.innerHTML = `<div class="boot"><div class="boot-cmd"><b>root@zksnarks</b>:~$ reading the chain…</div><div class="boot-bar"><i></i></div></div>`;
  await loadAtlas();
  if (location.hash === '#sheet') {
    ui.innerHTML = '';
    return (await import('./sheet')).sheet();
  }
  await new Promise((r) => setTimeout(r, 30));
  const city = buildCity();
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const stage = createStage(canvas, city);
  const player = new Player(city.walk, city.spawn.x, city.spawn.z, city.spawn.yaw);
  const npcs = new Npcs(stage.scene, city);
  const drones = new Drones(stage.scene, [new THREE.Vector3(10, 30, 62), new THREE.Vector3(14, 30, 64), new THREE.Vector3(6, 30, 60)]);
  const boards = new Billboards(stage);
  const hand = new Hand(stage.camera);
  const sfx = new Sfx();
  ui.innerHTML = '';
  const hud = new Hud(ui);
  fetch('/vo/manifest.json')
    .then((r) => r.json())
    .then((m) => (hud.vo = m))
    .catch(() => {});
  hud.onVoice = (on) => sfx.duck(on);
  const muteBtn = ui.querySelector('.mute') as HTMLButtonElement;
  muteBtn.addEventListener('click', () => {
    sfx.start();
    const m = sfx.toggle();
    hud.voiceOn = !m;
    muteBtn.classList.toggle('off', m);
  });
  ui.classList.add('pre');
  let story!: Story;
  const phone = new Phone(ui, () => story.s, (a) => {
    if (a.type === 'raised') {
      hand.setRaised(true);
      player.frozen = true;
      player.stop();
    }
    if (a.type === 'lowered') {
      hand.setRaised(false);
      player.frozen = false;
    }
    story.onPhone(a);
  });
  phone.el.style.display = 'none';
  phone.map = makeMap(city, () => ({ x: player.x, z: player.z, yaw: player.yaw, goal: story?.marker ?? null }));

  // ping ring around an exposed player
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.0, 48),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.2, 0.25), transparent: true, depthWrite: false, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  stage.scene.add(ring);

  const fogBase = (stage.scene.fog as THREE.FogExp2).color.clone();
  const dawnCol = new THREE.Color(0x6a4a6e);
  let glitchK = 0;
  let cut: { t: number } | null = null;
  let thugs: ReturnType<typeof npcs.spawn>[] = [];
  let inVoid = false;
  // the void between loops: Zero, alone in the dark
  const voidScene = new THREE.Scene();
  voidScene.background = new THREE.Color(0x000000);
  const voidCam = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 0.05, 100);
  voidCam.position.set(0, 1.05, 3.1);
  voidCam.lookAt(0, 0.95, 0);
  addEventListener('resize', () => {
    voidCam.aspect = innerWidth / innerHeight;
    voidCam.updateProjectionMatrix();
  });
  const zero = new Zero();
  zero.group.position.set(0, 0.25, 0);
  voidScene.add(zero.group);
  const voidTrails = new Trails(voidScene, 400);
  const vbg = new THREE.TextureLoader().load('/art/void_bg.jpg');
  vbg.colorSpace = THREE.SRGBColorSpace;
  voidScene.background = vbg;
  const blackEl = document.createElement('div');
  blackEl.className = 'blackout';
  document.body.appendChild(blackEl);
  const blackout = (on: boolean) => blackEl.classList.toggle('on', on);
  story = new Story({
    city,
    phone,
    hud,
    player,
    npcs,
    drones,
    boards,
    camera: stage.camera,
    sfx,
    setHood: (on) => hand.setHood(on),
    setDawn: (k) => {
      const f = stage.scene.fog as THREE.FogExp2;
      f.color.copy(fogBase).lerp(dawnCol, k);
      (stage.scene.background as THREE.Color).copy(f.color);
      f.density = 0.028 - k * 0.012;
      (stage.rain.material as THREE.LineBasicMaterial).opacity = 0.35 * (1 - k);
    },
    glitch: (k) => (glitchK = Math.max(glitchK, k)),
    shieldCut: async () => {
      // third-person cutaway: see yourself pull the hood up
      const fwd = new THREE.Vector3(-Math.sin(player.yaw), 0, -Math.cos(player.yaw));
      let camPos = new THREE.Vector3(player.x, 0, player.z).addScaledVector(fwd, 3.4);
      // keep the camera out of walls
      for (let k = 3.4; k > 1.4 && !player.walkable(Math.floor(camPos.x), Math.floor(camPos.z)); k -= 0.2)
        camPos = new THREE.Vector3(player.x, 0, player.z).addScaledVector(fwd, k);
      camPos.y = 2.75;
      const me = new Character(headByRole('you_bare'));
      me.group.position.set(player.x, 1, player.z);
      me.faceDir(fwd.x, fwd.z);
      me.minLight = 0.8;
      stage.scene.add(me.group);
      npcs.extra.push(me);
      player.frozen = true;
      player.stop();
      phone.el.style.opacity = '0';
      const from = stage.camera.position.clone();
      const look = new THREE.Vector3(player.x, 2.55, player.z);
      cut = { t: 0 };
      const tween = (a: THREE.Vector3, b: THREE.Vector3, ms: number) =>
        new Promise<void>((res) => {
          const t0 = performance.now();
          const step = () => {
            const k = Math.min(1, (performance.now() - t0) / ms);
            const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
            stage.camera.position.lerpVectors(a, b, e);
            stage.camera.lookAt(look);
            if (k < 1) requestAnimationFrame(step);
            else res();
          };
          requestAnimationFrame(step);
        });
      await tween(from, camPos, 700);
      me.trailBoost = 0.15;
      await new Promise((r) => setTimeout(r, 450));
      // the moment: hood up, visor on, the tail dissolves
      stage.scene.remove(me.group);
      npcs.extra = npcs.extra.filter((c) => c !== me);
      const hooded = new Character(headByRole('you_hood'));
      hooded.group.position.copy(me.group.position);
      hooded.yaw = me.yaw;
      hooded.minLight = 0.8;
      stage.scene.add(hooded.group);
      npcs.extra.push(hooded);
      glitchK = 1.1;
      sfx.shield();
      const L = lookOf(headByRole('you_bare'));
      npcs.trails.burst(new THREE.Vector3(player.x, 2, player.z), [...L.trail, L.body, L.face, [244, 183, 40]], 220, 2.0, camPos);
      hooded.trailBoost = 0.1;
      hand.setHood(true);
      await new Promise((r) => setTimeout(r, 1500));
      await tween(camPos, from, 600);
      stage.scene.remove(hooded.group);
      npcs.extra = npcs.extra.filter((c) => c !== hooded);
      cut = null;
      player.frozen = false;
      phone.el.style.opacity = '';
    },
    ambush: async () => {
      player.frozen = true;
      player.stop();
      phone.lower();
      const looks = HEADS.filter((h) => h.role === 'lookout');
      const spots: [number, number][] = [];
      for (let k = 0; k < 40 && spots.length < 3; k++) {
        const a = (k / 40) * Math.PI * 2 + Math.random() * 0.3;
        const x = player.x + Math.cos(a) * 9,
          z = player.z + Math.sin(a) * 9;
        if (player.walkable(Math.floor(x), Math.floor(z)) && !spots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < 5)) spots.push([x, z]);
      }
      thugs = spots.map(([x, z], k) => {
        const n = npcs.spawn(looks[k % looks.length], x, z, { speedMul: 2.4, name: 'Tailor crew' });
        const a = (k / spots.length) * Math.PI * 2;
        npcs.send(n, player.x + Math.cos(a) * 1.1, player.z + Math.sin(a) * 1.1);
        n.ch.lookAt = new THREE.Vector3(player.x, 2, player.z);
        return n;
      });
      sfx.alarm();
      // look at the first one coming
      if (thugs[0]) {
        const t = thugs[0];
        const want = Math.atan2(-(t.x - player.x), -(t.z - player.z));
        const from = player.yaw;
        let d = Math.atan2(Math.sin(want - from), Math.cos(want - from));
        for (let i = 1; i <= 20; i++) {
          player.yaw = from + d * (i / 20);
          await new Promise((r) => setTimeout(r, 25));
        }
      }
      const t0 = performance.now();
      while (performance.now() - t0 < 4500 && thugs.some((n) => Math.hypot(n.x - player.x, n.z - player.z) > 1.8))
        await new Promise((r) => setTimeout(r, 100));
      // the hit
      hud.flashRed();
      sfx.caught();
      glitchK = 2.5;
      for (let i = 0; i < 14; i++) {
        player.pitch = -0.04 - i * 0.05;
        player.yaw += (Math.random() - 0.5) * 0.12;
        await new Promise((r) => setTimeout(r, 30));
      }
      blackout(true);
      await new Promise((r) => setTimeout(r, 1300));
    },
    setVoid: (on) => {
      inVoid = on;
      stage.renderPass.mainScene = on ? voidScene : stage.scene;
      stage.renderPass.mainCamera = on ? voidCam : stage.camera;
      blackout(false);
      hand.group.visible = !on;
      phone.el.style.display = on ? 'none' : '';
      ui.classList.toggle('void', on);
    },
    resetWorld: () => {
      for (const n of thugs) npcs.remove(n);
      thugs = [];
      drones.patrol();
      boards.face = null;
      hud.setMarker(null);
    },
    burst: () => {
      const L = lookOf(headByRole('you_bare'));
      const at = new THREE.Vector3(player.x, 2.2, player.z);
      npcs.trails.burst(at, [...L.trail, L.body, L.face, [244, 183, 40]], 260, 2.6);
    },
  });
  story.spawnCast();
  npcs.spawnCrowd(30);

  bindInput(canvas, stage.camera, player, {
    onTap(ray) {
      sfx.start();
      if (phone.up) return phone.lower();
      const n = npcs.pick(ray);
      if (n) return story.talkTo(n);
      const p = groundHit(ray);
      if (p) player.goTo(p.x, p.z);
    },
  });

  // ---------- title ----------
  const cast = ['narrator', 'you_zk', 'tailor', 'friend', 'courier', 'cafe', 'landlord', 'you_hood'];
  hud.show(
    `<div class="title">
       <div class="title-cast">${cast.map((r) => portrait(r, 54)).join('')}</div>
       <h1>LOSE THE<br/>TAIL</h1>
       <p class="title-sub"><b class="hook">You got paid publicly. Now everyone can see you.</b><br/>Survive one night in Ledger City and learn to go private with <b>Zcash</b>.</p>
       <button class="cta big" id="start">▶ Start the night</button>
       <button class="link-btn" id="skip">already played? skip to the second night ▸</button>
       <div class="title-meta">5–8 minutes · no wallet, no money, no sign-up · sound on</div>
       <div class="title-help"><span>drag</span> look <span>tap</span> walk / talk <span>E</span> phone <span>WASD</span> move</div>
       <div class="credit">characters: <a href="https://zilkroad.com" target="_blank" rel="noopener">zkSNARKs</a> · a ZECATHON wildcard entry</div>
     </div>`,
    'title-ov',
  );
  let started = false;
  const go = async (skip: boolean) => {
    sfx.start();
    started = true;
    ui.classList.remove('pre');
    hud.hide();
    if (!skip)
      await hud.card({
        kicker: 'LEDGER CITY · 18:00',
        title: 'Payday.',
        body: `<img class="card-art" src="/art/intro_phone.jpg" alt=""><p>You finished a freelance job today. Your client is paying you tonight.</p>`,
        button: 'Go outside',
      });
    phone.el.style.display = '';
    skip ? story.skipToPayday() : story.beginLoop1();
  };
  document.getElementById('skip')!.addEventListener('click', () => go(true));
  if (new URLSearchParams(location.search).get('start') === 'payday') setTimeout(() => go(true), 400);
  document.getElementById('start')!.addEventListener('click', () => go(false));

  const dbg = new URLSearchParams(location.search).get('debug');
  if (dbg) {
    started = true;
    ui.classList.remove('pre');
    hud.hide();
    phone.el.style.display = '';
    story.debugJump(dbg);
    const tp = new URLSearchParams(location.search).get('at');
    const st = tp && city.stations[tp];
    if (st) ((player.x = st.x + 2), (player.z = st.z));
  }

  // ---------- do it for real ----------
  (window as any).__showReal = () => {
    const url = location.origin;
    const tweet = encodeURIComponent(`I lost the tail in Ledger City 🕶️ and learned to go private with #Zcash.\n\nPlay it (5 min, no wallet needed): ${url}\n\n@zksnarks_`);
    hud.show(
      `<div class="card real">
        ${portrait('you_zk', 96, 'big')}
        <span class="kicker">now do it for real</span>
        <h2>Your first shielded transaction</h2>
        <ol class="steps">
          <li><b>Get a wallet.</b> Install <a href="https://zodl.com" target="_blank" rel="noopener">Zodl</a> (iOS / Android). Write the 24 words on paper.</li>
          <li><b>Get some ZEC.</b> In Zodl, tap <b>Swap</b> to turn a coin you already have into shielded ZEC. Or buy ZEC on an exchange and withdraw it to your wallet.</li>
          <li><b>Shield it.</b> If it arrives in the transparent pocket, tap <b>Shield</b>, the same button you used tonight.</li>
          <li><b>Send one private payment.</b> Pay a friend's shielded address with a note. That's it: you're shielded.</li>
        </ol>
        <p class="tiny muted">Same rules as tonight: never share your 24 words. Don't cash out the same amount you shielded right away.</p>
        <div class="row-btns"><a class="cta" href="https://twitter.com/intent/tweet?text=${tweet}" target="_blank" rel="noopener">Share</a><button class="cta ghost" id="again">Play again</button></div>
      </div>`,
      'dim',
    );
    document.getElementById('again')!.addEventListener('click', () => location.reload());
  };

  // ---------- loop ----------
  (window as any).__game = { stage, player, npcs, city, story, phone, hud, drones, boards };
  const tmp = new THREE.Color();
  const v3 = new THREE.Vector3();
  let last = performance.now();
  let pingT = 0;
  const perf = { acc: 0, n: 0, level: 0 };
  const ended = () => !!(story as any).ended;
  let titleT = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!started) {
      titleT += dt;
      player.yaw = city.spawn.yaw + Math.sin(titleT * 0.15) * 0.6 - 0.4;
      player.pitch = 0.08;
    }
    if (inVoid) {
      zero.update(dt);
      zero.group.rotation.y = Math.sin(performance.now() / 2600) * 0.3;
      voidTrails.update(dt, [zero.asCharacter], voidCam.position);
    }
    player.update(dt);
    if (!cut) player.applyCamera(stage.camera);
    for (const c of npcs.extra) {
      city.world.lightAt(c.group.position.x, 1.5, c.group.position.z, tmp);
      c.setLight(tmp);
      c.update(dt);
    }
    story.update(dt);
    npcs.update(dt, city.world, stage.camera.position);
    npcs.updateTrails(dt, stage.camera.position);
    const exposed = story.exposed;
    drones.update(dt, v3.set(player.x, 1, player.z), exposed);
    boards.update(dt, fmtClock(story.s.clock));
    city.world.lightAt(player.x, 2, player.z, tmp);
    hand.setLight(tmp);
    hand.update(dt, Math.min(1, player.speed / 4), player.bobT);
    hand.group.visible = started && !cut;
    // adaptive score
    sfx.setMood(inVoid ? 'void' : thugs.length || story.s.trace ? 'tension' : story.s.beat === 'dawn' || ended() ? 'dawn' : 'calm');
    // exposure ring + ping
    ring.visible = exposed;
    if (exposed) {
      pingT += dt;
      const k = (pingT % 1.6) / 1.6;
      ring.position.set(player.x, 1.02, player.z);
      ring.scale.setScalar(0.5 + k * 6);
      (ring.material as THREE.MeshBasicMaterial).opacity = 1 - k;
      if (pingT % 1.6 < dt) sfx.ping();
    }
    // marker
    const m = story.marker;
    if (m && started && !phone.up) {
      const p = new THREE.Vector3(m.x, 3.2, m.z).project(stage.camera);
      const dist = Math.hypot(m.x - player.x, m.z - player.z);
      const behind = p.z > 1;
      let x = ((p.x + 1) / 2) * innerWidth,
        y = ((1 - p.y) / 2) * innerHeight;
      let edge: number | null = null;
      const pad = 60;
      if (behind || x < pad || x > innerWidth - pad || y < pad + 60 || y > innerHeight - pad) {
        if (behind) ((x = innerWidth - x), (y = innerHeight - y));
        const cx = innerWidth / 2,
          cy = innerHeight / 2;
        const a = Math.atan2(y - cy, x - cx);
        const r = Math.min(innerWidth, innerHeight) / 2 - pad;
        x = cx + Math.cos(a) * r;
        y = cy + Math.sin(a) * r;
        edge = a + Math.PI / 2;
      }
      hud.setMarker(dist < 3 ? null : { x, y, label: m.label, dist, edge });
    } else hud.setMarker(null);
    // glitch / chroma
    glitchK = Math.max(0, glitchK - dt * 1.4);
    const danger = story.s.trace ? 1 - story.s.trace.left / story.s.trace.total : 0;
    const ca = 0.0006 + glitchK * 0.012 + danger * 0.004 * (0.5 + Math.random() * 0.5);
    stage.chroma.offset.set(ca, ca * 0.6);
    stage.render(dt);
    // quality governor: step down resolution, then reflections, if frames are slow
    if (started && !inVoid) {
      perf.acc += dt;
      perf.n++;
      if (perf.acc > 3) {
        const avg = perf.acc / perf.n;
        perf.acc = 0;
        perf.n = 0;
        if (avg > 0.024 && perf.level < 2) {
          perf.level++;
          if (perf.level === 1) {
            stage.renderer.setPixelRatio(1);
            stage.resize();
          } else stage.wet.mesh.visible = false;
          console.info('[quality] lowered to level', perf.level, (avg * 1000).toFixed(1) + 'ms');
        }
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
boot();
