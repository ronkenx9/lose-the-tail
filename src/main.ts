import './style.css';
import * as THREE from 'three';
import { buildCity } from './engine/city';
import { createStage } from './engine/scene';
import { Player } from './engine/player';
import { Character, headByRole, loadAtlas, lookOf } from './engine/characters';
import { buildVoid } from './engine/voidworld';
import { Doors } from './engine/doors';
import { Npcs } from './engine/npcs';
import { bindInput, groundHit } from './engine/input';
import { Drones } from './engine/drones';
import { Billboards } from './engine/billboards';
import { Hand } from './engine/hand';
import { Phone } from './ui/phone';
import { Hud } from './ui/hud';
import { Story } from './game/story';
import { Sfx } from './game/sfx';
import { Voice } from './game/voice';
import { Intro } from './game/intro';
import { Crew } from './game/crew';
import { Companion } from './game/companion';
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
  await fetch('/vo/manifest.json')
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
    // phone up: you can still shuffle along, slowly. the world keeps moving.
    if (a.type === 'raised') {
      hand.setRaised(true);
      player.slow = true;
      player.stop();
    }
    if (a.type === 'lowered') {
      hand.setRaised(false);
      player.slow = false;
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
  const dawnCol = new THREE.Color(0xb8786a);
  const dawnEl = document.createElement('div');
  dawnEl.className = 'dawn-tint';
  document.body.appendChild(dawnEl);
  let glitchK = 0;
  let cut: { t: number } | null = null;
  let inVoid = false;
  // the void between loops: a real place you walk through, built from voxels
  const vw = buildVoid();
  const blackEl = document.createElement('div');
  blackEl.className = 'blackout';
  document.body.appendChild(blackEl);
  const blackout = (on: boolean, white = false) =>
    new Promise<void>((res) => {
      if (on) blackEl.classList.toggle('white', white);
      blackEl.classList.toggle('on', on);
      setTimeout(res, 950);
    });
  const doors = new Doors(stage.scene, city.doors);
  // the Tailor's monitors mirror the live ledger screens: they really are watching the chain
  [5, 8, 11, 14].forEach((x, k) => {
    const scr = k % 2 ? stage.screens.mainnet : stage.screens.ledger;
    const mat = new THREE.MeshBasicMaterial({ map: scr.tex, toneMapped: false });
    mat.color.setScalar(1.15);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.24), mat);
    m.position.set(x, 2.69, 63.33);
    m.rotation.y = Math.PI;
    stage.scene.add(m);
  });
  // people in the world
  const intro = new Intro(stage.scene, stage.camera, player, city.bed, { x: 5, z: 33 });
  intro.onPulse = () => sfx.buzz();
  phone.keyGate = () => {
    if (intro.active) {
      sfx.start();
      intro.pickKey();
      return true;
    }
    return inVoid;
  };
  const tailorDoor = city.stations.tailor.npc!;
  const crew = new Crew(npcs, player, { x: tailorDoor.x, z: tailorDoor.z - 2 });
  const companion = new Companion(stage.scene, player);
  // positional voices: the speaker's mouth is where the sound comes from
  const voice = new Voice(() => sfx.ctx, () => sfx.voiceBus);
  hud.voice = voice;
  const pv = new THREE.Vector3();
  hud.project = (v) => {
    pv.copy(v).project(stage.camera);
    return { x: ((pv.x + 1) / 2) * innerWidth, y: ((1 - pv.y) / 2) * innerHeight, on: pv.z < 1 };
  };
  hud.playerPos = () => new THREE.Vector3(player.x, 2, player.z);
  // sprint: Shift on desktop, a held RUN button on touch
  const runUi = document.createElement('div');
  runUi.className = 'run-ui';
  runUi.innerHTML = `<div class="stam"><i></i></div><button class="run-btn" aria-label="sprint">RUN</button>`;
  ui.appendChild(runUi);
  const runBtn = runUi.querySelector('.run-btn') as HTMLButtonElement;
  const stamBar = runUi.querySelector('.stam i') as HTMLElement;
  const runOn = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    player.sprintHeld = true;
  };
  const runOff = () => (player.sprintHeld = false);
  runBtn.addEventListener('pointerdown', runOn);
  runBtn.addEventListener('pointerup', runOff);
  runBtn.addEventListener('pointercancel', runOff);
  runBtn.addEventListener('pointerleave', runOff);
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
    intro,
    crew,
    zero: companion,
    blackout,
    setHood: (on) => hand.setHood(on),
    setDawn: (k) => {
      const f = stage.scene.fog as THREE.FogExp2;
      f.color.copy(fogBase).lerp(dawnCol, k);
      (stage.scene.background as THREE.Color).copy(f.color);
      f.density = 0.028 - k * 0.012;
      (stage.rain.material as THREE.LineBasicMaterial).opacity = 0.35 * (1 - k);
      dawnEl.style.opacity = String(k * 0.6);
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
    enterVoid: () => {
      inVoid = true;
      stage.renderPass.mainScene = vw.scene;
      player.setWalk(vw.walk);
      player.x = vw.spawn.x;
      player.z = vw.spawn.z;
      player.yaw = vw.spawn.yaw;
      player.pitch = -0.04;
      player.slow = false;
      vw.showClues(story.s.clues);
      vw.scene.add(companion.zero.group);
      vw.scene.add(stage.camera); // the camera (and your hands) come with you
      companion.show(vw.zeroAt);
      phone.lower();
      phone.el.style.display = 'none';
      ui.classList.add('void');
      return { zeroAt: vw.zeroAt };
    },
    exitVoid: () => {
      inVoid = false;
      stage.renderPass.mainScene = stage.scene;
      player.setWalk(city.walk);
      stage.scene.add(companion.zero.group);
      stage.scene.add(stage.camera);
      companion.hide();
      phone.el.style.display = '';
      ui.classList.remove('void');
    },
    resetWorld: () => {
      crew.clear();
      drones.patrol();
      boards.face = null;
      hud.setMarker(null);
      intro.resetPhone();
      player.pitch = -0.04;
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
      if (intro.tryTap(ray)) return;
      if (intro.active || player.frozen) return;
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
        body: `<img class="card-art" src="/art/intro_phone.jpg" alt=""><p>You finished a freelance job today. Your client said they'd pay tonight. You fell asleep waiting.</p>`,
        button: 'Wake up',
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
  (window as any).__game = { stage, player, npcs, city, story, phone, hud, drones, boards, crew, intro, companion, vw };
  const tmp = new THREE.Color();
  const v3 = new THREE.Vector3();
  let last = performance.now();
  let pingT = 0;
  let stepPhase = 0;
  let crewStepT = 0;
  let reactT = 0;
  const staring = new Set<(typeof npcs.list)[number]>();
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
    if (inVoid) vw.update(dt, stage.camera);
    player.update(dt);
    intro.update(dt);
    if (!cut && !intro.applyCamera()) player.applyCamera(stage.camera);
    crew.update(dt);
    companion.update(dt, stage.camera);
    voice.updateListener(stage.camera);
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
    if (inVoid) tmp.setRGB(0.55, 0.7, 0.62);
    else city.world.lightAt(player.x, 2, player.z, tmp);
    hand.setLight(tmp);
    hand.update(dt, Math.min(1, player.speed / 4), player.bobT);
    hand.group.visible = started && !cut && !intro.active;
    phone.el.style.visibility = intro.active ? 'hidden' : '';
    hud.frame();
    // stamina + run button show up when someone is chasing you (always on touch screens)
    runUi.classList.toggle('on', started && !inVoid && !intro.active && (crew.mode === 'hunt' || matchMedia('(pointer: coarse)').matches));
    runUi.classList.toggle('low', player.stamina < 0.25);
    stamBar.style.transform = `scaleX(${player.stamina})`;
    // storefront doors part for anyone walking up
    if (!inVoid) {
      const ppl: { x: number; z: number }[] = [player];
      for (const n of npcs.list) if (Math.abs(n.x - player.x) < 30 && Math.abs(n.z - player.z) < 30) ppl.push(n);
      if (doors.update(dt, ppl, player)) sfx.door();
    }
    // footsteps: yours, and theirs getting louder as they close in
    const ph = Math.floor(player.bobT / Math.PI);
    if (ph !== stepPhase) {
      stepPhase = ph;
      if (player.speed > 1) sfx.footstep(player.sprinting ? 0.07 : 0.04, 0.9 + Math.random() * 0.2);
    }
    if (crew.mode === 'hunt' && crew.members.length) {
      crewStepT -= dt;
      const d = crew.nearest();
      if (crewStepT <= 0 && d < 32) {
        crewStepT = 0.16 + Math.random() * 0.12;
        sfx.footstep(0.22 * Math.pow(1 - d / 32, 1.6), 0.75 + Math.random() * 0.15);
      }
    }
    // passers-by react: they stare when you're lit up, flinch when you sprint past
    reactT -= dt;
    if (reactT <= 0) {
      reactT = 0.4;
      const loud = story.exposed || crew.mode === 'hunt';
      for (const n of npcs.list) {
        if (n.role !== 'crowd') continue;
        const d = Math.hypot(n.x - player.x, n.z - player.z);
        const react = (loud && d < 7) || (player.sprinting && d < 3.5);
        if (react) {
          n.ch.lookAt = v3.set(player.x, 2.4, player.z).clone();
          staring.add(n);
        } else if (staring.has(n)) {
          n.ch.lookAt = null;
          staring.delete(n);
        }
      }
    }
    // adaptive score
    sfx.setMood(inVoid ? 'void' : story.s.trace ? 'tension' : story.s.beat === 'dawn' || ended() ? 'dawn' : 'calm');
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
    const danger = story.s.trace ? Math.max(0, 1 - story.s.trace.left / 14) : 0;
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
