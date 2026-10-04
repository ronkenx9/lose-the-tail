import * as THREE from 'three';
import { ADDR, addClue, addTx, clone, fmtClock, fmtZec, fresh, tailorMatch, type GameState } from './state';
import type { Phone, PhoneAction, Contact } from '../ui/phone';
import type { Hud, Line } from '../ui/hud';
import type { Player } from '../engine/player';
import type { Npcs, Npc } from '../engine/npcs';
import type { Drones } from '../engine/drones';
import type { Billboards } from '../engine/billboards';
import type { City, Station } from '../engine/city';
import { headByRole, headsByRole } from '../engine/characters';
import type { Sfx } from './sfx';
import type { Intro } from './intro';
import type { Crew } from './crew';
import type { Companion } from './companion';

const CLIENT = { id: 'client', name: 'Rook (client)', role: 'miner' };
const MIKA = { id: 'mika', name: 'Mika', role: 'friend' };

export interface Ctx {
  city: City;
  phone: Phone;
  hud: Hud;
  player: Player;
  npcs: Npcs;
  drones: Drones;
  boards: Billboards;
  camera: THREE.PerspectiveCamera;
  sfx: Sfx;
  intro: Intro;
  crew: Crew;
  zero: Companion;
  setHood(hooded: boolean): void;
  setDawn(k: number): void;
  glitch(k: number): void;
  burst(): void;
  shieldCut(): Promise<void>;
  /** fade to / from black */
  blackout(on: boolean, white?: boolean): Promise<void>;
  /** swap into the 3D void island (player + Zero move there) */
  enterVoid(): { zeroAt: { x: number; z: number } };
  exitVoid(): void;
  resetWorld(): void;
}

interface Checkpoint {
  s: GameState;
  px: number;
  pz: number;
  yaw: number;
  beat: string;
}

type At = () => THREE.Vector3;
const N = false;
const R = true;
/** one spoken line; `at` anchors it to a speaker standing in the world (bubble + positional voice) */
const T = (who: string, role: string | undefined, text: string, radio = false, at?: At): Line => ({ who, role, text, radio, at });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Story {
  s: GameState = fresh();
  private cp: Checkpoint | null = null;
  private named: Record<string, Npc> = {};
  private busy = false;
  private visited = new Set<string>();
  private markerTarget: { x: number; z: number; label: string } | null = null;
  private clockRate = 2.4; // game minutes per real second
  private ended = false;
  private catching = false;
  private loop1Left = 0;
  private loop1Done = false;
  private trapLeft = 0;
  private A: Record<string, At>;
  private said = new Set<string>();
  private sprintT = 0;

  constructor(private c: Ctx) {
    const head = (role: string) => () => {
      const n = this.named[role];
      return n ? new THREE.Vector3(n.x, 2.4, n.z) : new THREE.Vector3(48, 2, 48);
    };
    this.A = {
      tailor: head('tailor'),
      courier: head('courier'),
      cafe: head('cafe'),
      friend: head('friend'),
      clerk: head('landlord'),
      zero: () => this.c.zero.head(),
      needle: () => {
        const n = this.c.crew.members[0];
        return n ? new THREE.Vector3(n.x, 2.4, n.z) : new THREE.Vector3(this.c.player.x, 2.4, this.c.player.z);
      },
    };
    c.crew.onCatch = () => this.caught();
    c.crew.onSpot = (n) => this.spotted(n);
  }

  get marker() {
    return this.markerTarget;
  }
  /** your public pocket is pinging: drones can see you */
  get exposed() {
    return this.s.wallet.transparent > 0.0001 && this.c.crew.tracking;
  }

  // ============================================================== cast
  spawnCast() {
    const { npcs, city } = this.c;
    const st = city.stations;
    const at = (role: string, s: Station, name: string) => {
      const n = npcs.spawnRole(role, s.npc!.x, s.npc!.z, { idleYaw: s.npc!.yaw, name });
      this.named[role] = n;
      return n;
    };
    at('tailor', st.tailor, 'The Tailor');
    at('cafe', st.cafe, 'Auntie Node');
    at('friend', st.arcade, 'Mika');
    at('courier', st.kiosk, 'Courier');
    at('landlord', st.exchange, 'Cobalt clerk');
    // regulars inside the café and the arcade, so the rooms feel lived in
    const crowd = headsByRole('crowd');
    const extra: [number, number, number, number, string][] = [
      [3, 79.5, 58.6, Math.PI / 2, 'Regular'],
      [9, 90.5, 57.4, -Math.PI / 2, 'Regular'],
      [14, 30.5, 80.5, Math.PI, 'Player 2'],
    ];
    for (const [k, x, z, yaw, name] of extra) {
      const h = crowd[k % Math.max(1, crowd.length)];
      if (h && this.c.player.walkable(Math.floor(x), Math.floor(z))) npcs.spawn(h, x, z, { idleYaw: yaw, name });
    }
  }

  /** the Tailor back at his monitors, his crew back inside HQ */
  private resetTailor() {
    const t = this.named.tailor;
    const st = this.c.city.stations.tailor.npc!;
    if (t) {
      t.path = [];
      t.x = st.x;
      t.z = st.z;
      t.idleYaw = st.yaw;
      t.ch.yaw = st.yaw;
      t.ch.lookAt = null;
    }
    this.c.crew.clear();
  }
  /** spawn the crew: inside HQ, or on the streets in a ring around a point */
  private crewOut(around?: { x: number; z: number }) {
    const heads = headsByRole('lookout').slice(0, 4);
    let spots = [
      { x: 8.5, z: 57.5 },
      { x: 10.5, z: 57.5 },
      { x: 7.5, z: 59.5 },
      { x: 11.5, z: 59.5 },
    ];
    if (around) {
      spots = [];
      const p = this.c.player;
      for (let k = 0; k < 64 && spots.length < 4; k++) {
        const a = k * 2.4;
        const r = 13 + (k % 5);
        const x = Math.floor(around.x + Math.cos(a) * r),
          z = Math.floor(around.z + Math.sin(a) * r);
        if (p.walkable(x, z)) spots.push({ x: x + 0.5, z: z + 0.5 });
      }
    }
    this.c.crew.spawn(heads, spots);
  }
  /** the Tailor walks out onto the pavement to give the order himself */
  private tailorOut() {
    const t = this.named.tailor;
    if (!t) return;
    const st = this.c.city.stations.tailor;
    t.idleYaw = Math.PI;
    this.c.npcs.send(t, st.x, st.z - 0.5);
    t.ch.lookAt = new THREE.Vector3(this.c.player.x, 2, this.c.player.z);
  }

  // ============================================================== phone
  onPhone = (a: PhoneAction) => {
    if (a.type === 'raised') this.c.sfx.ui();
    if (this.catching && a.type !== 'raised' && a.type !== 'lowered') return; // too late, they have you
    if (a.type === 'wallet-created') return this.walletCreated();
    if (a.type === 'shield') return this.shielded();
    if (a.type === 'swap') return this.swapped(a.zec);
    if (a.type === 'send') return this.s.beat === 'loop1' ? this.loop1Paid(a.amount) : this.sent(a.to, a.amount, a.memo);
    if (a.type === 'receive-shown') return this.receiveShown(a.pocket);
    if (a.type === 'open' && a.screen === 'home') this.c.phone.el.classList.remove('nudge');
  };

  // ============================================================== LOOP 1 — the naive night
  async beginLoop1() {
    const { phone, hud, player, city } = this.c;
    this.s = fresh();
    this.s.beat = 'wake1';
    this.s.naive = true;
    this.s.loop = 1;
    this.s.wallet.created = true;
    this.loop1Done = false;
    this.ended = false;
    this.c.crew.pace = 1;
    this.resetTailor();
    this.crewOut();
    this.c.zero.hide();
    player.x = city.spawn.x;
    player.z = city.spawn.z;
    player.yaw = city.spawn.yaw;
    phone.allow = { shield: false, send: true, swap: false, receive: false };
    hud.objective(null);
    await this.c.blackout(true);
    const woke = this.c.intro.wake(() => {
      hud.objective('Your phone is buzzing', 'Tap the phone on the nightstand');
    });
    await this.c.blackout(false);
    await woke;
    this.s.beat = 'loop1';
    this.s.wallet.transparent = 5;
    addTx(this.s, { kind: 'receive', amount: 5, pocket: 'transparent', who: 'Rook', publicView: 'visible' });
    phone.message(CLIENT.id, CLIENT.name, CLIENT.role, 'Paid! 5 ZEC sent to your wallet. Great work. Go treat yourself tonight 🎉', { silent: true });
    phone.raise();
    phone.show('home');
    this.c.sfx.coin();
    hud.objective('Payday', '');
    await hud.say([
      T('Rook', 'miner', 'Your five ZEC is in. Good work. Go treat yourself.'),
      T('Niko', 'you_bare', "Now that's worth getting up for."),
    ]);
    phone.lower();
    this.c.boards.push({ time: fmtClock(this.s.clock), from: 't1Rook…9x', to: 't1YouR…Zf3', amount: '5.000', place: 'Ave & 4th' });
    this.setContacts([{ id: 'kiosk', name: 'Noodle stand', addr: 't1Noodle5tandPlaza', pocket: 'transparent', role: 'courier', hint: 'noodles 0.3', presetAmount: 0.3 }]);
    this.markerTarget = { x: city.stations.kiosk.x, z: city.stations.kiosk.z, label: 'Noodle kiosk' };
    hud.objective('Treat yourself', 'Head out. Noodles at the plaza kiosk.');
    this.loop1Left = 80;
  }

  private async loop1Paid(amount: number) {
    const { phone, boards } = this.c;
    if (this.loop1Done) return;
    this.loop1Done = true;
    this.s.wallet.transparent -= amount;
    addTx(this.s, { kind: 'send', amount, pocket: 'transparent', who: 'Noodle stand', publicView: 'visible' });
    phone.show('done', { title: 'Paid', body: `${fmtZec(amount)} ZEC to Noodle stand. Enjoy!`, icon: '🍜' });
    this.c.sfx.coin();
    await sleep(1000);
    phone.lower();
    boards.push({ time: fmtClock(this.s.clock), from: 't1YouR…Zf3', to: 't1Noodle…', amount: fmtZec(amount), place: 'Plaza kiosk', you: true });
    boards.face = { role: 'you_bare', mode: 'exposed' };
    this.loop1Hunt('paid');
  }

  private async loop1Hunt(why: 'paid' | 'waited') {
    const { hud, crew } = this.c;
    this.loop1Done = true;
    this.s.beat = 'chase1';
    addClue(this.s, { key: 'address', text: 't1YouR…Zf3' });
    addClue(this.s, { key: 'amount', text: '5.000 ZEC, just landed' });
    if (why === 'paid') addClue(this.s, { key: 'face', text: 'Plaza kiosk camera, ' + fmtClock(this.s.clock) });
    addClue(this.s, { key: 'link', text: why === 'paid' ? 'same address paid the noodle stand' : 'still sitting on Ave & 4th' });
    hud.setFile(this.s.clues, true);
    this.c.sfx.alarm();
    this.tailorOut();
    this.c.drones.hunt();
    // the order goes out over the radio, from the man himself on the pavement
    hud.say([
      why === 'paid'
        ? T('The Tailor', 'tailor', 'Our five-ZEC friend just bought noodles. Plaza kiosk. People are so generous with their secrets.', R, this.A.tailor)
        : T('The Tailor', 'tailor', 'Five ZEC, sitting on a public address near Ave & 4th, waiting like an open door. Go collect.', R, this.A.tailor),
      T('The Tailor', 'tailor', 'Quietly, please. Take them.', R, this.A.tailor),
    ]);
    await sleep(1500);
    crew.hunt();
    this.markerTarget = null;
    hud.objective('RUN', 'Hold Shift (or RUN) to sprint. Lose them.');
  }

  /** the lead pursuer gets close enough to say something */
  private spotted(n: Npc) {
    if (n !== this.c.crew.members[0] || this.c.hud.talking) return;
    const line =
      this.s.beat === 'chase1'
        ? this.s.clues.some((c) => c.key === 'face')
          ? T('Needle', 'lookout', 'There you are. Five ZEC, and you went straight for noodles. Nice.', N, this.A.needle)
          : T('Needle', 'lookout', 'Still here? Five ZEC in your pocket, and nowhere to hide. Nice.', N, this.A.needle)
        : T('Needle', 'lookout', 'Still here? Five ZEC in your pocket, and nowhere to hide. Nice.', N, this.A.needle);
    this.c.hud.say([line]);
  }

  // ============================================================== caught
  private async caught() {
    if (this.catching || !['chase1', 'payday', 'trap'].includes(this.s.beat)) return;
    this.catching = true;
    const { hud, phone, player, crew } = this.c;
    player.frozen = true;
    player.stop();
    phone.lower();
    hud.hush();
    hud.flashRed();
    this.c.sfx.caught();
    this.c.glitch(2.5);
    crew.mode = 'idle';
    let who: Npc | null = null;
    for (const m of crew.members) {
      m.path = [];
      m.ch.lookAt = new THREE.Vector3(player.x, 2, player.z);
      if (!who || Math.hypot(m.x - player.x, m.z - player.z) < Math.hypot(who.x - player.x, who.z - player.z)) who = m;
    }
    // you turn and see who grabbed you
    if (who) this.turnTo(who.x, who.z, 280);
    if (this.s.beat === 'chase1') {
      // loop 1: they take everything. a stagger, then lights out.
      await sleep(450);
      const p0 = player.pitch;
      for (let i = 1; i <= 16; i++) {
        player.pitch = p0 - i * 0.045;
        player.yaw += Math.sin(i * 1.7) * 0.025;
        await sleep(28);
      }
      this.c.glitch(2.5);
      // they don't want you. they want the keys. the balance drains on your phone as the lights go
      const took = this.s.wallet.transparent;
      this.s.wallet.transparent = 0;
      addTx(this.s, { kind: 'send', amount: took, pocket: 'transparent', who: 't1Ta1lor…', publicView: 'visible' });
      phone.notify('Sent', `−${fmtZec(took)} ZEC → t1Ta1lorCo…`);
      await this.c.blackout(true);
      this.c.drones.patrol();
      this.catching = false;
      await this.voidScene();
      return;
    }
    const cp = this.cp;
    if (!cp) {
      player.frozen = false;
      this.catching = false;
      return;
    }
    const lesson =
      cp.beat === 'exchange'
        ? '<p>You shielded 5 ZEC, then took almost all of it straight back out. What goes <b>in</b> and what comes <b>out</b> of the pool are public. Matching them is child\'s play.</p><p class="zero-says">Zero: <i>“Five in, five out. You might as well have signed it. Take only what you need, and take it later.”</i></p>'
        : '<p>Money sitting in your <b>transparent</b> pocket is public: address, amount, time. That was all they needed.</p><p class="zero-says">Zero: <i>“Glass pockets, again. Shield it the moment it lands. Wallet, Shield, hold.”</i></p>';
    this.s.caughtCount++;
    await hud.card({
      kicker: 'TAILOR & CO.',
      title: 'Found you.',
      body: `<p>File: ${this.s.clues.map((c) => `<b>${c.key}</b>`).join(' · ')}</p>${lesson}`,
      button: '⏪ Rewind',
      role: 'tailor',
      cls: 'red',
    });
    this.c.glitch(1);
    this.c.sfx.rewind();
    const keep = this.s.caughtCount;
    this.s = clone(cp.s);
    this.s.caughtCount = keep;
    player.x = cp.px;
    player.z = cp.pz;
    player.yaw = cp.yaw;
    player.frozen = false;
    player.stamina = 1;
    this.visited.clear();
    hud.setFile(this.s.clues, this.s.clues.length > 0);
    this.c.setHood(this.s.hooded);
    this.c.drones.patrol();
    if (cp.beat === 'exchange') {
      crew.clear();
      this.c.boards.face = { role: 'you_bare', mode: 'static' };
      this.updateObjective();
    } else {
      this.resetTailor();
      this.crewOut();
      this.tailorOut();
      this.c.drones.hunt();
      hud.objective('Shield it. Now.', 'Phone → Shield → hold. You can still move while it proves.');
      this.c.phone.el.classList.add('nudge');
      await sleep(2500);
      if (this.s.wallet.transparent > 0) crew.hunt();
    }
    this.catching = false;
  }

  // ============================================================== VOID — a place, not a backdrop
  private async voidScene() {
    const { hud, player } = this.c;
    this.s.beat = 'void';
    hud.setFile([], false);
    hud.objective(null);
    this.markerTarget = null;
    this.c.crew.clear();
    const v = this.c.enterVoid();
    player.frozen = false;
    await this.c.blackout(false);
    hud.objective('Where are you?', 'Walk toward the figure.');
    this.markerTarget = { x: v.zeroAt.x, z: v.zeroAt.z, label: '?' };
    // Zero drifts out to meet you as you come closer
    for (;;) {
      const d = Math.hypot(player.x - v.zeroAt.x, player.z - v.zeroAt.z);
      if (d < 3.4 || Math.hypot(player.x - this.c.zero.zero.group.position.x, player.z - this.c.zero.zero.group.position.z) < 2.6) break;
      const k = Math.min(0.5, Math.max(0, (9 - d) / 12));
      this.c.zero.stay({ x: v.zeroAt.x + (player.x - v.zeroAt.x) * k, z: v.zeroAt.z + (player.z - v.zeroAt.z) * k });
      await sleep(120);
    }
    this.markerTarget = null;
    hud.objective(null);
    await hud.say([
      T('Zero', 'narrator', '...There you are.', N, this.A.zero),
      T('Zero', 'narrator', "Well. That was hard to watch. Even for me, and I've watched this city a long time.", N, this.A.zero),
      T('Zero', 'narrator', 'You were paid in a city made of glass, and your first instinct was to hold the money up to the light.', N, this.A.zero),
      T('Zero', 'narrator', 'Address. Amount. Time. Place. You handed them a *map*, then acted surprised when they read it.', N, this.A.zero),
      T('Zero', 'narrator', "I'm not angry. It happens to ten thousand people a night. You just happen to be the one I've decided to help.", N, this.A.zero),
      T('Zero', 'narrator', "Call me *Zero*. That's exactly how much they'll know about you when we're done. Let's start the night again.", N, this.A.zero),
    ]);
    this.c.sfx.rewind();
    this.c.glitch(2);
    await this.c.blackout(true, true);
    this.c.exitVoid();
    this.c.resetWorld();
    this.visited.clear();
    this.beginLoop2();
  }

  // ============================================================== LOOP 2 — the guided night
  async beginLoop2() {
    const { phone, hud, player, city } = this.c;
    this.s = fresh();
    this.s.loop = 2;
    this.s.beat = 'wake2';
    this.ended = false;
    this.said.clear();
    phone.show('lock');
    phone.lower();
    this.setContacts([]);
    this.c.setHood(false);
    this.c.crew.pace = 0.85;
    this.resetTailor();
    this.crewOut();
    hud.setFile([], false);
    phone.allow = { shield: false, send: false, swap: false, receive: false };
    player.x = city.spawn.x;
    player.z = city.spawn.z;
    player.yaw = city.spawn.yaw;
    player.stamina = 1;
    // Zero is already in the room, by the door
    this.c.zero.show(this.zeroSpot());
    const woke = this.c.intro.wake(() => {
      hud.objective('Same night', 'Tap the phone on the nightstand');
    });
    await this.c.blackout(false);
    await woke;
    this.s.beat = 'setup';
    await hud.say([
      T('Zero', 'narrator', 'Same night. Same rain. Same people watching. The only thing that changed is you.', N, this.A.zero),
      T('Zero', 'narrator', "Before that money lands, you need a real wallet. Open it. I'll be right here.", N, this.A.zero),
    ]);
    hud.objective('Set up a real wallet', 'Raise your phone (tap it or press E) → Wallet');
    phone.el.classList.add('nudge');
  }

  private zeroSpot() {
    const h = this.c.city.stations.home;
    return { x: h.x + 1, z: h.z + 0.8 };
  }

  private async walletCreated() {
    const { phone, hud } = this.c;
    this.s.wallet.created = true;
    phone.show('done', { title: 'Wallet ready', body: 'Two pockets: shielded (private) and transparent (public).', icon: 'Ƶ' });
    phone.el.classList.remove('nudge');
    this.c.sfx.good();
    hud.lesson('Wallet set up', 'Your 24 words are your wallet. Write them on paper. Anyone who asks for them is trying to rob you.');
    await sleep(900);
    phone.lower();
    await hud.say([
      T('Zero', 'narrator', 'Twenty-four words. Your whole fortune, in a language thieves would kill to read. Never let anyone read it. Not me. Especially not people who ask nicely.', N, this.A.zero),
    ]);
    await sleep(600);
    this.payday();
  }

  private async payday() {
    const { phone, hud, boards, crew } = this.c;
    this.s.beat = 'payday';
    phone.allow = { shield: true, send: false, swap: false, receive: true };
    phone.message(CLIENT.id, CLIENT.name, CLIENT.role, 'Paid! 5 ZEC sent to the t1… address you gave me. Thanks for the work 👍', { silent: true });
    this.c.sfx.coin();
    this.s.wallet.transparent += 5;
    addTx(this.s, { kind: 'receive', amount: 5, pocket: 'transparent', who: 'Rook', publicView: 'visible' });
    boards.push({ time: fmtClock(this.s.clock), from: 't1Rook…9x', to: 't1YouR…Zf3', amount: '5.000', place: 'Ave & 4th', you: true });
    boards.face = { role: 'you_bare', mode: 'exposed' };
    phone.render();
    await hud.say([T('Rook', 'miner', 'Your five ZEC is in. Good work. Go treat yourself.')]);
    addClue(this.s, { key: 'address', text: 't1YouR…Zf3' });
    addClue(this.s, { key: 'amount', text: '5.000 ZEC @ ' + fmtClock(this.s.clock) });
    hud.setFile(this.s.clues, true);
    this.saveCp('payday');
    this.c.sfx.alarm();
    this.tailorOut();
    hud.lesson('Transparent = public', 'Money sent to a transparent (t1…) address shows its amount, time and address to anyone watching the blockchain.');
    phone.el.classList.add('nudge');
    hud.objective('Shield your 5 ZEC', 'Phone → Shield → hold. They are coming for your door.');
    // the order goes out across the street while Zero talks you through it
    hud.say([
      T('The Tailor', 'tailor', 'Strange. I have the oddest feeling we have done this before.', R, this.A.tailor),
      T('The Tailor', 'tailor', 'Fresh money on the public ledger. *Five ZEC*, Ave & 4th. Someone just lit a candle in a dark room.', R, this.A.tailor),
      T('Zero', 'narrator', "And there it is. Five ZEC on a transparent address, glowing like a lighthouse. That's how they found you last time. Open the wallet and hold SHIELD. Let's turn the lights off.", N, this.A.zero),
    ]);
    this.c.drones.hunt();
    this.c.zero.follow();
    await sleep(3000);
    if (this.s.beat === 'payday' && this.s.wallet.transparent > 0) crew.hunt();
  }

  private async shielded() {
    const { phone, hud, boards, drones, crew } = this.c;
    const amt = this.s.wallet.transparent;
    this.s.wallet.transparent = 0;
    this.s.wallet.shielded += amt;
    this.s.lastShield = { at: this.s.clock, amount: amt };
    addTx(this.s, { kind: 'shield', amount: amt, pocket: 'shielded', who: 'to shielded pool', publicView: `${fmtZec(amt)} entered the shielded pool` });
    this.s.hooded = true;
    this.s.beat = 'shielded';
    phone.el.classList.remove('nudge');
    phone.show('done', { title: 'Shielded', body: `${fmtZec(amt)} ZEC is now private. The chain shows that money entered the shielded pool, and nothing after that.`, icon: '🛡' });
    this.c.sfx.good();
    drones.lose();
    crew.lose();
    boards.face = { role: 'you_bare', mode: 'static' };
    boards.push({ time: fmtClock(this.s.clock), from: 't1YouR…Zf3', to: '█ shielded █', amount: fmtZec(amt), place: '████████', hidden: true });
    await sleep(900);
    phone.lower();
    await this.c.shieldCut();
    hud.toast('<b>You disappeared.</b> Hood up. They lost your signal.');
    hud.lesson('Shielded = private', 'Shielding moves ZEC into the shielded pool. The chain shows money went in, and nothing about where it goes next.');
    await hud.say([
      T('The Tailor', 'tailor', "...Gone. Five ZEC slipped into the shielded pool, and the pool doesn't gossip. Pity.", R, this.A.tailor),
      T('The Tailor', 'tailor', 'Watch the exits. Everything that goes in comes out eventually, and people are such creatures of habit.', R, this.A.tailor),
    ]);
    this.errands();
  }

  private async errands() {
    const { phone, hud } = this.c;
    this.s.beat = 'errands';
    phone.allow = { shield: true, send: true, swap: true, receive: true };
    this.updateObjective();
    await hud.say([
      T('Zero', 'narrator', 'Feel that? Every eye in this city just lost focus at the same time. Delicious.', N, this.A.zero),
      T('Zero', 'narrator', 'Better. Now live. Coffee at Nullstate. Mika owes you at the arcade. Rent at Cobalt, and Cobalt only takes public money, so tread lightly there. This city adores a pattern.', N, this.A.zero),
    ]);
  }

  updateObjective() {
    const e = this.s.errands;
    const st = this.c.city.stations;
    const todo: [boolean, Station, string][] = [
      [e.cafe, st.cafe, 'Coffee at Nullstate Café'],
      [e.friend, st.arcade, 'Get paid back by Mika (0dB Arcade)'],
      [e.exchange, st.exchange, 'Pay rent at Cobalt Exchange'],
    ];
    const left = todo.filter((t) => !t[0]);
    if (!left.length) {
      this.markerTarget = { x: st.home.x, z: st.home.z, label: 'Home' };
      this.c.hud.objective('Go home', 'The night is almost over.');
      return;
    }
    const p = this.c.player;
    left.sort((a, b) => Math.hypot(a[1].x - p.x, a[1].z - p.z) - Math.hypot(b[1].x - p.x, b[1].z - p.z));
    this.markerTarget = { x: left[0][1].x, z: left[0][1].z, label: left[0][1].label };
    this.c.hud.objective(`Tonight: ${3 - left.length}/3 done`, todo.map((t) => `${t[0] ? '✓' : '○'} ${t[2]}`).join('   '));
  }

  // ============================================================== stations (walk in, talk in person)
  private async arrive(id: string) {
    if (this.busy) return;
    const { phone, hud } = this.c;
    const e = this.s.errands;
    if (this.s.beat === 'loop1') {
      if (id === 'kiosk' && !this.loop1Done) {
        this.busy = true;
        this.face('courier');
        await hud.say([T('Courier', 'courier', 'Noodles? *0.3 ZEC*. Just send it to my address.', N, this.A.courier)]);
        this.busy = false;
        phone.raise();
        phone.show('send2', { id: 'kiosk' });
      }
      return;
    }
    if (this.s.beat === 'payday') {
      if (id === 'kiosk') {
        this.busy = true;
        this.face('courier');
        await hud.say([T('Courier', 'courier', "Not now, you're lit up like a billboard. Shield first, then come talk to me.", N, this.A.courier)]);
        this.busy = false;
      }
      return;
    }
    if (this.s.beat !== 'errands' && this.s.beat !== 'dawn') return;
    this.busy = true;
    try {
      if (id === 'cafe' && !e.cafe) {
        this.face('cafe');
        await hud.say([
          T('Auntie Node', 'cafe', "Welcome to Nullstate. Shielded payments only. We don't keep a glass register.", N, this.A.cafe),
          T('Auntie Node', 'cafe', 'Coffee is *0.02 ZEC*. Leave a note in the memo if you like. Only I can read it.', N, this.A.cafe),
        ]);
        this.setContacts([{ id: 'cafe', name: 'Nullstate Café', addr: ADDR.cafe, pocket: 'shielded', role: 'cafe', hint: 'coffee 0.02', presetAmount: 0.02, memoHint: 'oat milk, please' }]);
        hud.objective('Pay for your coffee', 'Wallet → Send → Nullstate Café. Add a note.');
        phone.raise();
        phone.show('send2', { id: 'cafe' });
      } else if (id === 'arcade' && !e.friend) {
        this.face('friend');
        await hud.say([
          T('Mika', 'friend', 'There you are! I owe you *0.5 ZEC* for the pizza.', N, this.A.friend),
          T('Mika', 'friend', "Show me your address and I'll send it.", N, this.A.friend),
        ]);
        hud.objective('Show Mika your address', 'Wallet → Receive → pick an address → Show');
        phone.raise();
        phone.show('receive', { pocket: 'transparent' });
      } else if (id === 'exchange' && !e.exchange) {
        this.face('landlord');
        this.saveCp('exchange');
        await hud.say([
          T('Cobalt clerk', 'landlord', 'Cobalt Exchange. Rent, cash-outs, anything that needs to be public.', N, this.A.clerk),
          T('Cobalt clerk', 'landlord', "Your rent is *1.20 ZEC*, paid to our transparent address. Want to cash out anything else while you're here?", N, this.A.clerk),
        ]);
        this.setContacts([
          {
            id: 'exchange',
            name: 'Cobalt Exchange',
            addr: ADDR.exchange,
            pocket: 'transparent',
            role: 'landlord',
            hint: 'rent 1.20 + cash out',
            slider: { min: 1.2, max: this.s.wallet.shielded, def: this.s.wallet.shielded - 0.05 },
          },
        ]);
        hud.objective('Pay rent at Cobalt', 'Rent is 1.20. The slider starts at "everything". Your call.');
        phone.raise();
        phone.show('send2', { id: 'exchange' });
      } else if (id === 'kiosk' && !e.swap) {
        this.face('courier');
        await hud.say([
          T('Courier', 'courier', 'Psst. Got coins on another chain? I swap them straight into *shielded* ZEC.', N, this.A.courier),
          T('Courier', 'courier', 'Fresh coins that never touched the glass. The real Zodl app does this with its Swap button.', N, this.A.courier),
        ]);
        phone.raise();
        phone.show('swap');
      } else if (id === 'home' && this.s.beat === 'dawn') {
        await this.ending();
      } else if (id === 'tailor') {
        this.face('tailor');
        await hud.say([T('The Tailor', 'tailor', this.s.hooded ? "Nice hood. Seen a fella with five ZEC? No? Didn't think so." : 'Evening. Nice night to be... visible.', N, this.A.tailor)]);
      }
    } finally {
      this.busy = false;
    }
  }

  private face(role: string) {
    const n = this.named[role];
    if (!n) return;
    const p = this.c.player;
    n.ch.lookAt = new THREE.Vector3(p.x, 2, p.z);
    n.ch.faceDir(p.x - n.x, p.z - n.z);
    p.stop();
    this.turnTo(n.x, n.z, 600);
  }

  /** ease the view toward a point (the person who just started talking to you) */
  private turnTo(x: number, z: number, ms: number) {
    const p = this.c.player;
    const want = Math.atan2(-(x - p.x), -(z - p.z));
    const from = p.yaw;
    const d = Math.atan2(Math.sin(want - from), Math.cos(want - from));
    const p0 = p.pitch;
    const t0 = performance.now();
    const step = () => {
      const k = Math.min(1, (performance.now() - t0) / ms);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      p.yaw = from + d * e;
      p.pitch = p0 + (-0.02 - p0) * e;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  private setContacts(c: Contact[]) {
    this.c.phone.setContacts(c);
  }

  private async sent(to: Contact, amount: number, memo: string) {
    const { phone, hud, boards } = this.c;
    if (amount > this.s.wallet.shielded + 1e-6) {
      phone.show('done', { title: 'Not enough', body: "You don't have that much in your shielded pocket.", icon: '!' });
      return;
    }
    this.s.wallet.shielded -= amount + 0.0001;
    if (to.pocket === 'shielded') {
      addTx(this.s, { kind: 'send', amount, pocket: 'shielded', who: to.name, memo, publicView: 'nothing' });
      phone.show('done', { title: 'Sent privately', body: `${fmtZec(amount)} ZEC to ${to.name}. On the public chain this shows up as a transaction with no visible amount, sender or receiver.`, icon: '🛡' });
      this.c.sfx.good();
      hud.lesson('Private send', 'A shielded payment hides the sender, the receiver, the amount and the memo. Only the receiver can read the note.');
      if (to.id === 'cafe') {
        this.s.errands.cafe = true;
        await sleep(1300);
        phone.lower();
        await hud.say([
          T('Auntie Node', 'cafe', memo ? 'Got it. I can read your private note. Coffee is on the counter.' : "Got it. Coffee's on the counter.", N, this.A.cafe),
          T('Auntie Node', 'cafe', 'On the public chain that payment is just a blur. No amount, no names.', N, this.A.cafe),
          T('Zero', 'narrator', 'A note only one person alive can read. Romantic, really. The ledger saw a payment happen and learned nothing else.', N, this.A.zero),
        ]);
        this.setContacts([]);
        this.updateObjective();
      }
      return;
    }
    // ---- public exit: the trap ----
    addTx(this.s, { kind: 'unshield', amount, pocket: 'transparent', who: to.name, publicView: `${fmtZec(amount)} left the shielded pool` });
    boards.push({ time: fmtClock(this.s.clock), from: '█ shielded █', to: 't1Cobalt…77', amount: fmtZec(amount), place: 'Cobalt Exch.' });
    const m = tailorMatch(this.s.lastShield, amount, this.s.clock);
    phone.show('done', { title: 'Paid publicly', body: `${fmtZec(amount)} ZEC left the shielded pool to Cobalt's public address.`, icon: '👁' });
    await sleep(1300);
    phone.lower();
    this.setContacts([]);
    if (m.match) {
      addClue(this.s, { key: 'link', text: m.why });
      addClue(this.s, { key: 'face', text: 'Cobalt Exchange camera, ' + fmtClock(this.s.clock) });
      hud.setFile(this.s.clues, true);
      this.c.sfx.alarm();
      boards.face = { role: 'you_hood', mode: 'exposed' };
      this.c.crew.pace = 1;
      this.crewOut(this.c.city.stations.exchange);
      this.c.crew.hunt();
      this.c.drones.hunt();
      this.trapLeft = 30;
      this.s.beat = 'trap';
      hud.objective('They matched it', 'Five in, five out. Get out of Cobalt and lose them.');
      hud.say([
        T('The Tailor', 'tailor', 'Pool exit. Almost exactly what went in, and barely any time later. Hardly anyone else left the pool in that window.', R, this.A.tailor),
        T('The Tailor', 'tailor', 'Same money, barely rinsed. Our ghost is standing at Cobalt, admiring the view. Go.', R, this.A.tailor),
      ]);
    } else {
      this.s.errands.exchange = true;
      this.c.sfx.good();
      hud.lesson('Unshield carefully', 'Leaving the pool is public. Take out only what you need, not right after shielding, and not the same amount.');
      await hud.say([
        T('Cobalt clerk', 'landlord', 'Rent received. Have a good night.', N, this.A.clerk),
        T('The Tailor', 'tailor', 'Another pool exit to Cobalt. Plenty of exits tonight, and none of them look like our five. Could be anyone. I hate anyone.', R, this.A.tailor),
        T('Zero', 'narrator', 'Small. Late. Different. Three words that keep people whole in this city. Well done.', N, this.A.zero),
      ]);
      this.updateObjective();
    }
  }

  private async receiveShown(pocket: 'shielded' | 'transparent') {
    const { phone, hud } = this.c;
    if (this.s.beat !== 'errands' || this.s.errands.friend) return;
    const st = this.c.city.stations.arcade;
    if (Math.hypot(this.c.player.x - st.x, this.c.player.z - st.z) > 6) {
      hud.toast('Nobody nearby to show it to.');
      return;
    }
    phone.lower();
    if (pocket === 'transparent') {
      await hud.say([
        T('Mika', 'friend', "Hm, that's your *transparent* address. If I pay that, the whole city sees it on the ledger, and the Tailors get your address again.", N, this.A.friend),
        T('Mika', 'friend', 'Got a shielded one? Starts with *u1*.', N, this.A.friend),
      ]);
      phone.raise();
      phone.show('receive', { pocket: 'shielded' });
      return;
    }
    this.busy = true;
    await hud.say([T('Mika', 'friend', 'Shielded. Perfect. Sending now.', N, this.A.friend)]);
    await sleep(900);
    this.s.wallet.shielded += 0.5;
    addTx(this.s, { kind: 'receive', amount: 0.5, pocket: 'shielded', who: 'Mika', memo: 'pizza money 🍕 — M', publicView: 'nothing' });
    phone.message(MIKA.id, MIKA.name, MIKA.role, 'sent! check your memo 🍕');
    phone.notify('Received privately', '+0.500 ZEC · “pizza money 🍕 — M”');
    this.c.sfx.coin();
    hud.lesson('Receive privately', 'To get paid privately, share your shielded address (starts with u1). Your transparent one exposes you.');
    this.s.errands.friend = true;
    await sleep(800);
    await hud.say([
      T('Mika', 'friend', "Only you can read the note. To everyone else it's just... nothing happened. Love that.", N, this.A.friend),
      T('Zero', 'narrator', "Money arrived and nobody noticed. That's the trick. Not invisibility. Indifference.", N, this.A.zero),
    ]);
    this.busy = false;
    this.updateObjective();
  }

  private async swapped(zec: number) {
    this.s.wallet.shielded += zec;
    this.s.errands.swap = true;
    addTx(this.s, { kind: 'swap', amount: zec, pocket: 'shielded', who: '20 USDC → ZEC', publicView: 'nothing on Zcash' });
    this.c.phone.show('done', { title: 'Swapped', body: `+${fmtZec(zec)} ZEC, straight into your shielded pocket.`, icon: '⇄' });
    this.c.sfx.coin();
    this.c.hud.lesson('Swap in', 'You can turn another coin into shielded ZEC directly. In Zodl that is the Swap button.');
    await sleep(1200);
    this.c.phone.lower();
    await this.c.hud.say([T('Courier', 'courier', 'Pleasure. The coins you swapped FROM are still public on their own chain, remember that.', N, this.A.courier)]);
  }

  private saveCp(beat = this.s.beat) {
    const p = this.c.player;
    this.cp = { s: clone(this.s), px: p.x, pz: p.z, yaw: p.yaw, beat };
  }

  // ============================================================== ending
  private async ending() {
    if (this.ended) return;
    this.ended = true;
    const { hud, player, phone } = this.c;
    phone.lower();
    this.markerTarget = null;
    hud.objective(null);
    this.c.zero.stay(this.zeroSpot());
    for (let k = 0; k <= 30; k++) {
      this.c.setDawn(k / 30);
      await sleep(60);
    }
    await hud.say([
      T('The Tailor', 'tailor', "Sun's up. Tell me something about our five-ZEC ghost.", R, this.A.tailor),
      T('The Tailor', 'tailor', "An address that went quiet at 18:14. That's all? ...Close the file. I despise a blank page.", R, this.A.tailor),
    ]);
    player.frozen = true;
    const priv = this.s.txs.filter((t) => t.pocket === 'shielded').length;
    await hud.card({
      kicker: 'TAILOR & CO. · CASE FILE',
      title: 'SUBJECT: UNKNOWN',
      body: `<img class="card-art" src="/art/case_file.jpg" alt=""><p>You made <b>${this.s.txs.length}</b> transactions tonight. <b>${priv}</b> of them showed nothing on the public chain.</p>
             <p>${this.s.caughtCount ? `You got caught <b>${this.s.caughtCount}</b> time${this.s.caughtCount === 1 ? '' : 's'}. Every catch was a mistake real people make.` : 'You never got caught. Clean night.'}</p>
             <p>Zero tags found: <b>${this.s.tags.length}/${this.c.city.tags.length}</b></p>
             <ul class="learned">${hud.lessons.map((l) => `<li>✓ <b>${l.title}</b></li>`).join('')}</ul>`,
      button: 'Continue',
    });
    player.frozen = false;
    await hud.say([
      T('Zero', 'narrator', 'They hunted you all night and found a ghost. How does it feel to be nobody?', N, this.A.zero),
      T('Zero', 'narrator', 'You were never hiding. Hiding is for the guilty. You were simply *private*. Like a sealed letter. Like a closed door.', N, this.A.zero),
      T('Zero', 'narrator', 'Everything you did tonight works the same in a real wallet. Same buttons. Same silence. Go on, the real city is waiting.', N, this.A.zero),
    ]);
    (window as any).__showReal?.();
  }

  // ============================================================== per frame
  update(dt: number) {
    const s = this.s;
    const { player, crew, hud } = this.c;
    if (s.beat === 'intro') return;
    if (!hud.talking && !this.ended && s.beat !== 'void' && !this.c.intro.active) s.clock += dt * this.clockRate;
    // loop 1: they come for you eventually, even if you never spend
    if (s.beat === 'loop1' && !this.loop1Done && this.loop1Left > 0) {
      this.loop1Left -= dt;
      if (this.loop1Left <= 0) this.loop1Hunt('waited');
    }
    // the trap: stay ahead of them long enough and they lose the trail
    if (s.beat === 'trap' && !this.catching) {
      this.trapLeft -= dt;
      if (this.trapLeft <= 0) {
        s.beat = 'errands';
        crew.lose();
        this.c.drones.lose();
        s.errands.exchange = true;
        this.c.boards.face = { role: 'you_bare', mode: 'static' };
        hud.lesson('You got lucky', 'Five in, five out gets you matched. Next time: take out only what you need, later, in a different amount.');
        hud.say([T('Zero', 'narrator', 'Five went in, five came out. You might as well have signed it. Again. Only the rent this time.', N, this.A.zero)]);
        this.updateObjective();
      }
    }
    // crew distance readout while they're on you
    s.trace = crew.mode === 'hunt' && crew.members.length ? { left: Math.min(40, crew.nearest()), total: 40, reason: 'crew' } : null;
    // stations
    if (s.beat !== 'void' && !this.c.intro.active)
      for (const st of Object.values(this.c.city.stations)) {
        const d = Math.hypot(st.x - player.x, st.z - player.z);
        if (d < 2.3 && !this.visited.has(st.id) && !this.busy && !hud.talking) {
          this.visited.add(st.id);
          this.arrive(st.id);
        } else if (d > 4) this.visited.delete(st.id);
      }
    if (s.beat === 'errands' && s.errands.cafe && s.errands.friend && s.errands.exchange) {
      s.beat = 'dawn';
      hud.say([T('Zero', 'narrator', "Dawn's coming. Go home. The Tailors are holding an empty file, and it's driving them mad.", N, this.A.zero)]);
      this.updateObjective();
    }
    if (s.beat === 'errands' && Math.random() < dt * 0.5) this.updateObjective();
    // Zero notices what you do
    if ((s.beat === 'errands' || s.beat === 'dawn') && this.c.zero.visible && !hud.talking && !this.busy) {
      const tl = this.c.city.stations.tailor;
      this.sprintT = player.sprinting ? this.sprintT + dt : 0;
      const fx = -Math.sin(player.yaw),
        fz = -Math.cos(player.yaw);
      const mx = 52 - player.x,
        mz = 30 - player.z,
        md = Math.hypot(mx, mz);
      if (Math.hypot(tl.x - player.x, tl.z - player.z) < 6) this.aside('hq', T('Zero', 'narrator', "Don't stare at them. Staring is a pattern too.", N, this.A.zero));
      else if (this.sprintT > 1.5 && s.hooded) this.aside('run', T('Zero', 'narrator', "Running draws eyes. You're private, not prey. Walk.", N, this.A.zero));
      else if (md < 18 && (mx * fx + mz * fz) / md > 0.8) this.aside('ledger', T('Zero', 'narrator', "Look up. That's the real Zcash network, breathing. Notice how much of it simply isn't there.", N, this.A.zero));
    }
    const home = this.c.city.stations.home;
    if (s.beat === 'dawn' && !this.ended && !this.busy && Math.hypot(home.x - player.x, home.z - player.z) < 2.4) this.arrive('home');
    if (s.beat !== 'void')
      for (const t of this.c.city.tags) {
        if (s.tags.includes(String(t.id))) continue;
        if (Math.hypot(t.px + 0.5 - player.x, t.pz - player.z) < 2.2) {
          s.tags.push(String(t.id));
          this.c.sfx.good();
          hud.toast(`<b>Zero tag ${s.tags.length}/${this.c.city.tags.length}</b><br>${t.fact.replace(/\*([^*]+)\*/g, '<b>$1</b>')}`, 7500);
        }
      }
    this.c.phone.tick();
    hud.update(s);
  }

  private aside(id: string, line: Line) {
    if (this.said.has(id)) return;
    this.said.add(id);
    this.c.hud.say([line]);
  }

  /** player tapped an NPC: they turn and answer in person */
  talkTo(n: Npc) {
    const st = Object.values(this.c.city.stations).find((s) => s.npc && Math.hypot(s.npc.x - n.x, s.npc.z - n.z) < 1.5);
    if (st) {
      this.c.player.goTo(st.x, st.z);
      return;
    }
    if (n.role === 'crowd') {
      const lines = this.s.hooded
        ? ['…', "Can't place you. Do I know you?", 'Nice hood.', 'Rain again.']
        : ["Hey, aren't you the one on the big screen?", 'Five ZEC, huh? Must be nice.', 'Saw your address on the ledger.'];
      const text = lines[Math.floor(Math.random() * lines.length)];
      n.ch.lookAt = new THREE.Vector3(this.c.player.x, 2, this.c.player.z);
      if (!this.c.hud.talking) this.c.hud.say([{ who: n.name ?? 'Stranger', text, at: () => new THREE.Vector3(n.x, 2.4, n.z) }]);
      setTimeout(() => (n.ch.lookAt = null), 3000);
    }
  }

  // ============================================================== dev / title shortcuts
  debugJump(beat: string) {
    const { phone, hud } = this.c;
    this.c.intro.active = false;
    if (beat === 'loop2') return void this.beginLoop2();
    if (beat === 'void') {
      this.s.beat = 'chase1';
      return void this.voidScene();
    }
    this.s = fresh();
    this.s.loop = 2;
    this.s.wallet.created = true;
    this.resetTailor();
    this.crewOut();
    this.c.zero.show();
    this.c.zero.follow();
    this.c.player.frozen = false;
    if (beat === 'payday') return void this.payday();
    this.s.wallet.shielded = 5;
    this.s.lastShield = { at: this.s.clock, amount: 5 };
    this.s.hooded = true;
    this.c.setHood(true);
    addClue(this.s, { key: 'address', text: 't1YouR…Zf3' });
    addClue(this.s, { key: 'amount', text: '5.000 ZEC @ 18:00' });
    hud.setFile(this.s.clues, true);
    this.c.crew.standDown();
    phone.allow = { shield: true, send: true, swap: true, receive: true };
    phone.show('home');
    this.s.beat = 'errands';
    if (beat === 'dawn') {
      this.s.errands = { cafe: true, friend: true, exchange: true, swap: false };
      return;
    }
    this.updateObjective();
  }

  /** title 'skip to the second night': Zero, wallet ready, straight into payday */
  async skipToPayday() {
    this.s = fresh();
    this.s.loop = 2;
    this.s.beat = 'setup';
    this.s.wallet.created = true;
    this.c.crew.pace = 0.85;
    this.resetTailor();
    this.crewOut();
    this.c.zero.show(this.zeroSpot());
    this.c.phone.show('home');
    this.c.hud.lesson('Wallet set up (skipped)', 'In a real wallet you would write down 24 secret words. Never type them into a website.');
    await sleep(1200);
    this.payday();
  }
}

export { headByRole };
