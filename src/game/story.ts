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

const SAINT = { id: 'zero', name: 'Zero', role: 'narrator' };
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
  setHood(hooded: boolean): void;
  setDawn(k: number): void;
  glitch(k: number): void;
  burst(): void;
  /** thugs close in; resolves once the screen is black */
  ambush(): Promise<void>;
  /** the black void where Zero talks to you between loops */
  setVoid(on: boolean): void;
  resetWorld(): void;
  shieldCut(): Promise<void>;
}

interface Checkpoint {
  s: GameState;
  px: number;
  pz: number;
  yaw: number;
  beat: string;
}

const T = (who: string, role: string | undefined, text: string, radio = false): Line => ({ who, role, text, radio });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class Story {
  s: GameState = fresh();
  private cp: Checkpoint | null = null;
  private named: Record<string, Npc> = {};
  private lookouts: Npc[] = [];
  private busy = false;
  private visited = new Set<string>();
  private markerTarget: { x: number; z: number; label: string } | null = null;
  private clockRate = 2.4; // game minutes per real second
  private ended = false;

  constructor(private c: Ctx) {}

  get marker() {
    return this.markerTarget;
  }
  get exposed() {
    return this.s.wallet.transparent > 0.0001 && this.s.beat !== 'setup' && !this.s.naive;
  }

  // -------------------------------------------------------------- loop 1: the naive night
  private loop1Left = 0;
  private loop1Done = false;
  async beginLoop1() {
    const { phone, hud } = this.c;
    this.s = fresh();
    this.s.beat = 'loop1';
    this.s.naive = true;
    this.s.loop = 1;
    this.s.wallet.created = true;
    this.loop1Done = false;
    phone.allow = { shield: false, send: true, swap: false, receive: false };
    hud.objective('Check your phone', 'Tap the phone, or press E');
    await sleep(1400);
    this.s.wallet.transparent = 5;
    addTx(this.s, { kind: 'receive', amount: 5, pocket: 'transparent', who: 'Rook', publicView: 'visible' });
    phone.message(CLIENT.id, CLIENT.name, CLIENT.role, 'Paid! 5 ZEC sent to your wallet. Great work. Go treat yourself tonight 🎉');
    this.c.sfx.coin();
    phone.el.classList.add('nudge');
    this.c.boards.push({ time: fmtClock(this.s.clock), from: 't1Rook…9x', to: 't1YouR…Zf3', amount: '5.000', place: 'Ave & 4th' });
    this.setContacts([{ id: 'kiosk', name: 'Noodle stand', addr: 't1Noodle5tandPlaza', pocket: 'transparent', role: 'courier', hint: 'noodles 0.3', presetAmount: 0.3 }]);
    await sleep(1500);
    this.markerTarget = { x: this.c.city.stations.kiosk.x, z: this.c.city.stations.kiosk.z, label: 'Noodle stand' };
    hud.objective('Treat yourself', 'You just got paid. Grab noodles at the plaza stand.');
    this.loop1Left = 70;
  }

  private async loop1Paid(amount: number) {
    const { phone, hud, boards } = this.c;
    if (this.loop1Done) return;
    this.loop1Done = true;
    this.s.wallet.transparent -= amount;
    addTx(this.s, { kind: 'send', amount, pocket: 'transparent', who: 'Noodle stand', publicView: 'visible' });
    phone.show('done', { title: 'Paid', body: `${fmtZec(amount)} ZEC to Noodle stand. Enjoy!`, icon: '🍜' });
    this.c.sfx.coin();
    await sleep(1100);
    phone.lower();
    boards.push({ time: fmtClock(this.s.clock), from: 't1YouR…Zf3', to: 't1Noodle…', amount: fmtZec(amount), place: 'Plaza kiosk', you: true });
    boards.face = { role: 'you_bare', mode: 'exposed' };
    await this.loop1Ambush('paid');
  }

  private async loop1Ambush(why: 'paid' | 'waited') {
    const { hud } = this.c;
    this.loop1Done = true;
    this.markerTarget = null;
    hud.objective(null);
    addClue(this.s, { key: 'address', text: 't1YouR…Zf3' });
    addClue(this.s, { key: 'amount', text: '5.000 ZEC, just landed' });
    if (why === 'paid') addClue(this.s, { key: 'face', text: 'Plaza kiosk camera, ' + fmtClock(this.s.clock) });
    addClue(this.s, { key: 'link', text: why === 'paid' ? 'same address paid the noodle stand' : 'still sitting on Ave & 4th' });
    hud.setFile(this.s.clues, true);
    this.c.sfx.alarm();
    this.c.drones.hunt();
    await hud.say([
      why === 'paid'
        ? T('The Tailor', 'tailor', 'The five-ZEC wallet just bought noodles. Plaza kiosk, right now. Same address, same person.', true)
        : T('The Tailor', 'tailor', 'Five ZEC sitting on a public address near Ave & 4th, and nobody moved it. Go collect.', true),
      T('The Tailor', 'tailor', 'Take them.', true),
    ]);
    await this.c.ambush();
    await this.voidTalk();
  }

  private async voidTalk() {
    const { hud, player } = this.c;
    this.c.setVoid(true);
    await sleep(900);
    await hud.say([
      T('Zero', 'narrator', '...'),
      T('Zero', 'narrator', "Well. That wasn't fun to watch."),
      T('Zero', 'narrator', 'You got paid to a *public* address. Then you spent from it, in public. Every step left a trail, and they followed it straight to you.'),
      T('Zero', 'narrator', "In Ledger City that happens to people every night. It doesn't have to happen to you."),
      T('Zero', 'narrator', "I'm Zero. Let me help. We're going back to the start of the night."),
    ]);
    this.c.sfx.rewind();
    this.c.glitch(2);
    this.c.resetWorld();
    player.x = this.c.city.spawn.x;
    player.z = this.c.city.spawn.z;
    player.yaw = this.c.city.spawn.yaw;
    player.pitch = -0.04;
    this.visited.clear();
    this.c.setVoid(false);
    hud.setFile([], false);
    hud.toast('<b>18:00</b> · second try');
    this.begin();
  }

  /** title 'skip setup': instant wallet, straight into the payday crisis */
  async skipToPayday() {
    this.s = fresh();
    this.s.beat = 'setup';
    this.s.wallet.created = true;
    this.c.phone.show('home');
    this.c.hud.lesson('Wallet set up (skipped)', 'In a real wallet you would write down 24 secret words. Never type them into a website.');
    await sleep(1500);
    this.payday();
  }

  /** dev: jump straight to a beat */
  debugJump(beat: string) {
    const { phone } = this.c;
    this.s = fresh();
    this.s.wallet.created = true;
    if (beat === 'payday') {
      this.payday();
      return;
    }
    this.s.wallet.shielded = 5;
    this.s.lastShield = { at: this.s.clock, amount: 5 };
    this.s.hooded = true;
    this.c.setHood(true);
    addClue(this.s, { key: 'address', text: 't1YouR…Zf3' });
    addClue(this.s, { key: 'amount', text: '5.000 ZEC @ 18:00' });
    this.c.hud.setFile(this.s.clues, true);
    this.spawnLookouts();
    for (const l of this.lookouts) l.wander = true;
    phone.show('home');
    if (beat === 'dawn') {
      this.s.errands = { cafe: true, friend: true, exchange: true, swap: false };
      this.s.beat = 'errands';
      return;
    }
    this.errands();
  }

  // -------------------------------------------------------------- setup
  spawnCast() {
    const { npcs, city } = this.c;
    const st = city.stations;
    const at = (role: string, s: Station, name: string) => {
      const n = npcs.spawnRole(role, s.npc!.x, s.npc!.z, { idleYaw: s.npc!.yaw, name });
      this.named[role] = n;
      return n;
    };
    at('tailor', st.tailor, 'The Tailor');
    at('cafe', st.cafe, 'Barista');
    at('friend', st.arcade, 'Mika');
    at('courier', st.kiosk, 'Courier');
    at('landlord', st.exchange, 'Cobalt clerk');
  }

  onPhone = (a: PhoneAction) => {
    const { phone } = this.c;
    if (a.type === 'raised') this.c.sfx.ui();
    if (a.type === 'wallet-created') return this.walletCreated();
    if (a.type === 'shield') return this.shielded();
    if (a.type === 'swap') return this.swapped(a.zec);
    if (a.type === 'send') return this.s.beat === 'loop1' ? this.loop1Paid(a.amount) : this.sent(a.to, a.amount, a.memo);
    if (a.type === 'receive-shown') return this.receiveShown(a.pocket);
    if (a.type === 'open' && a.screen === 'home' && this.s.beat === 'payday' && this.s.wallet.transparent > 0) phone.el.classList.remove('nudge');
  };

  // -------------------------------------------------------------- flow
  async begin() {
    this.s = fresh();
    this.s.loop = 2;
    this.s.beat = 'setup';
    const { hud, phone } = this.c;
    this.c.player.frozen = false;
    phone.allow = { shield: false, send: false, swap: false, receive: false };
    hud.objective('Check your phone', 'Tap the phone, or press E');
    await sleep(1200);
    phone.message(
      SAINT.id,
      SAINT.name,
      SAINT.role,
      "Same night, second try. The payment lands soon. This time, set up a proper wallet first. Open it.",
    );
    this.c.sfx.buzz();
    phone.el.classList.add('nudge');
  }

  private async walletCreated() {
    const { phone, hud } = this.c;
    this.s.wallet.created = true;
    phone.show('done', { title: 'Wallet ready', body: 'Practice wallet created. Two pockets: shielded (private) and transparent (public).', icon: 'Ƶ' });
    phone.el.classList.remove('nudge');
    this.c.sfx.good();
    hud.lesson('Wallet set up', 'Your 24 words are your wallet. Write them on paper. Anyone who asks for them is trying to rob you.');
    await sleep(900);
    phone.message(
      SAINT.id,
      SAINT.name,
      SAINT.role,
      'Those 24 words ARE your money. Nobody legit will ever ask for them. Not me, not a website, not "support".',
    );
    await sleep(2600);
    this.payday();
  }

  private async payday() {
    const { phone, hud, boards, player } = this.c;
    this.s.beat = 'payday';
    phone.allow = { shield: true, send: false, swap: false, receive: true };
    phone.message(CLIENT.id, CLIENT.name, CLIENT.role, 'Paid! 5 ZEC sent to the t1… address you gave me. Thanks for the work 👍');
    this.c.sfx.coin();
    this.s.wallet.transparent += 5;
    addTx(this.s, { kind: 'receive', amount: 5, pocket: 'transparent', who: 'Rook', publicView: 'visible' });
    boards.push({ time: fmtClock(this.s.clock), from: 't1Rook…9x', to: 't1YouR…Zf3', amount: '5.000', place: 'Ave & 4th', you: true });
    boards.face = { role: 'you_bare', mode: 'exposed' };
    phone.render();
    await sleep(1600);
    if (phone.up) phone.lower();
    // cutscene: the Tailor notices
    player.frozen = true;
    player.stop();
    hud.objective(null);
    await this.turnTo(10, 55, 900);
    const t = this.named.tailor;
    if (t) t.ch.lookAt = new THREE.Vector3(player.x, 2, player.z);
    addClue(this.s, { key: 'address', text: 't1YouR…Zf3' });
    addClue(this.s, { key: 'amount', text: '5.000 ZEC @ ' + fmtClock(this.s.clock) });
    hud.setFile(this.s.clues, true);
    this.c.sfx.alarm();
    hud.lesson('Transparent = public', 'Money sent to a transparent (t1…) address shows its amount, time and address to anyone watching the blockchain.');
    await hud.say([
      T('The Tailor', 'tailor', 'Fresh money on the public ledger. *Five ZEC*, just landed on Ave & 4th.', true),
      T('The Tailor', 'tailor', "Public address, public amount, public time. Somebody's carrying it. Wake the drones.", true),
    ]);
    await this.turnTo(30, 40, 700);
    player.frozen = false;
    this.c.drones.hunt();
    this.s.trace = { left: 45, total: 45, reason: 'public pocket' };
    this.saveCp();
    hud.objective('Shield your 5 ZEC', 'Open the wallet and hold Shield before the trace finishes');
    phone.message(
      SAINT.id,
      SAINT.name,
      SAINT.role,
      "Here they come again. Money in your transparent pocket is public, like a glass wallet. That's how they found you last time. Open your wallet and hold SHIELD. Now.",
    );
    phone.el.classList.add('nudge');
    this.spawnLookouts();
  }

  private spawnLookouts() {
    const { npcs, city } = this.c;
    const st = city.stations.tailor;
    this.lookouts = headsByRole('lookout').slice(0, 3).map((h, k) => npcs.spawn(h, st.x - 1 + k, st.z + 1.5, { speedMul: 0.5, name: 'Tailor lookout' }));
  }

  private async shielded() {
    const { phone, hud, boards, drones } = this.c;
    const amt = this.s.wallet.transparent;
    this.s.wallet.transparent = 0;
    this.s.wallet.shielded += amt;
    this.s.lastShield = { at: this.s.clock, amount: amt };
    addTx(this.s, { kind: 'shield', amount: amt, pocket: 'shielded', who: 'to shielded pool', publicView: `${fmtZec(amt)} entered the shielded pool` });
    this.s.trace = null;
    this.s.hooded = true;
    phone.el.classList.remove('nudge');
    phone.show('done', {
      title: 'Shielded',
      body: `${fmtZec(amt)} ZEC is now private. The chain shows that money entered the shielded pool, and nothing after that.`,
      icon: '🛡',
    });
    this.c.sfx.good();
    drones.lose();
    boards.face = { role: 'you_bare', mode: 'static' };
    boards.push({ time: fmtClock(this.s.clock), from: 't1YouR…Zf3', to: '█ shielded █', amount: fmtZec(amt), place: '████████', hidden: true });
    for (const l of this.lookouts) {
      const p = this.c.npcs.randomSidewalk();
      this.c.npcs.send(l, p.x, p.z);
      l.wander = true;
    }
    await sleep(900);
    phone.lower();
    await this.c.shieldCut();
    hud.toast('<b>You disappeared.</b> Hood up. The drones lost your signal.');
    hud.lesson('Shielded = private', 'Shielding moves ZEC into the shielded pool. The chain shows money went in, and nothing about where it goes next.');
    await sleep(1600);
    await hud.say([
      T('The Tailor', 'tailor', `...lost it. ${fmtZec(amt)} went into the shielded pool at ${fmtClock(this.s.clock)}. After that: nothing.`, true),
      T('The Tailor', 'tailor', "Keep watching the pool. Whatever goes in has to come out someday. Match the amounts.", true),
    ]);
    this.errands();
  }

  private async errands() {
    const { phone, hud } = this.c;
    this.s.beat = 'errands';
    phone.allow = { shield: true, send: true, swap: true, receive: true };
    phone.message(
      SAINT.id,
      SAINT.name,
      SAINT.role,
      "Good. Now live your night like a normal person. Coffee at Nullstate, Mika owes you money at the arcade, and rent's due at Cobalt Exchange. Cobalt only takes public money, so be careful there.",
    );
    await sleep(2500);
    phone.message(
      SAINT.id,
      SAINT.name,
      SAINT.role,
      "PS: the big screen over the street shows the REAL Zcash network, live. Look how much of it is blacked out.",
      { silent: true },
    );
    this.updateObjective();
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
    // nearest unfinished
    const p = this.c.player;
    left.sort((a, b) => Math.hypot(a[1].x - p.x, a[1].z - p.z) - Math.hypot(b[1].x - p.x, b[1].z - p.z));
    this.markerTarget = { x: left[0][1].x, z: left[0][1].z, label: left[0][1].label };
    this.c.hud.objective(
      `Tonight: ${3 - left.length}/3 done`,
      todo.map((t) => `${t[0] ? '✓' : '○'} ${t[2]}`).join('   '),
    );
  }

  // -------------------------------------------------------------- stations
  private async arrive(id: string) {
    if (this.busy) return;
    const { phone, hud } = this.c;
    const e = this.s.errands;
    if (this.s.beat === 'loop1') {
      if (id === 'kiosk' && !this.loop1Done) {
        this.busy = true;
        this.face('courier');
        await hud.say([T('Courier', 'courier', 'Noodles? *0.3 ZEC*. Just send it to my address.')]);
        this.busy = false;
        phone.raise();
        phone.show('send2', { id: 'kiosk' });
      }
      return;
    }
    if (this.s.beat !== 'errands' && this.s.beat !== 'dawn') {
      if (id === 'kiosk' && this.s.beat === 'payday') {
        this.busy = true;
        await hud.say([T('Courier', 'courier', "Not now, you're lit up like a billboard. Shield first, then come talk to me.")]);
        this.busy = false;
      }
      return;
    }
    this.busy = true;
    try {
      if (id === 'cafe' && !e.cafe) {
        this.face('cafe');
        await hud.say([
          T('Barista', 'cafe', 'Welcome to Nullstate. Shielded payments only. We don\'t keep a glass register.'),
          T('Barista', 'cafe', 'Coffee is *0.02 ZEC*. Leave a note in the memo if you like. Only I can read it.'),
        ]);
        this.setContacts([{ id: 'cafe', name: 'Nullstate Café', addr: ADDR.cafe, pocket: 'shielded', role: 'cafe', hint: 'coffee 0.02', presetAmount: 0.02, memoHint: 'oat milk, please' }]);
        hud.objective('Pay for your coffee', 'Wallet → Send → Nullstate Café. Add a note.');
        phone.raise();
        phone.show('send2', { id: 'cafe' });
      } else if (id === 'arcade' && !e.friend) {
        this.face('friend');
        await hud.say([
          T('Mika', 'friend', 'There you are! I owe you *0.5 ZEC* for the pizza.'),
          T('Mika', 'friend', 'Show me your address and I\'ll send it.'),
        ]);
        hud.objective('Show Mika your address', 'Wallet → Receive → pick an address → Show');
        phone.raise();
        phone.show('receive', { pocket: 'transparent' });
      } else if (id === 'exchange' && !e.exchange) {
        this.face('landlord');
        this.saveCp('exchange');
        await hud.say([
          T('Cobalt clerk', 'landlord', 'Cobalt Exchange. Rent, cash-outs, anything that needs to be public.'),
          T('Cobalt clerk', 'landlord', 'Your rent is *1.20 ZEC*, paid to our transparent address. Want to cash out anything else while you\'re here?'),
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
          T('Courier', 'courier', 'Psst. Got coins on another chain? I swap them straight into *shielded* ZEC.'),
          T('Courier', 'courier', 'Fresh coins that never touched the glass. The real Zodl app does this with its Swap button.'),
        ]);
        phone.raise();
        phone.show('swap');
      } else if (id === 'home' && this.s.beat === 'dawn') {
        await this.ending();
      } else if (id === 'tailor') {
        this.face('tailor');
        await hud.say([
          T('The Tailor', 'tailor', this.s.hooded ? "Nice hood. Seen a fella with five ZEC? No? Didn't think so." : 'Evening. Nice night to be... visible.'),
        ]);
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
    this.turnTo(n.x, n.z, 500);
  }

  private setContacts(c: Contact[]) {
    this.c.phone.setContacts(c);
  }

  private async sent(to: Contact, amount: number, memo: string) {
    const { phone, hud, boards } = this.c;
    if (amount > this.s.wallet.shielded + 1e-6) {
      phone.show('done', { title: 'Not enough', body: 'You don\'t have that much in your shielded pocket.', icon: '!' });
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
          T('Barista', 'cafe', memo ? `Got it. Your note says: “${memo}”. Nobody else will ever see that.` : 'Got it. Coffee\'s on the counter.'),
          T('Barista', 'cafe', 'On the public chain that payment is just a blur. No amount, no names.'),
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
      this.c.drones.hunt();
      await hud.say([
        T('The Tailor', 'tailor', `Pool exit: *${m.why}*. Only ${m.others} other exits in that window.`, true),
        T('The Tailor', 'tailor', "Same money, barely moved. That's our ghost, standing at Cobalt. Go.", true),
      ]);
      this.s.trace = { left: 8, total: 8, reason: 'amount + timing match' };
      for (const l of this.lookouts) this.c.npcs.send(l, this.c.player.x, this.c.player.z);
    } else {
      this.s.errands.exchange = true;
      this.c.sfx.good();
      hud.lesson('Unshield carefully', 'Leaving the pool is public. Take out only what you need, not right after shielding, and not the same amount.');
      await hud.say([
        T('The Tailor', 'tailor', `Pool exit: ${fmtZec(amount)} to Cobalt. ${m.others} exits tonight, none of them look like our five. Could be anyone.`, true),
        T('Cobalt clerk', 'landlord', 'Rent received. Have a good night.'),
      ]);
      phone.message(SAINT.id, SAINT.name, SAINT.role, 'Clean. You only took out what you needed, and it didn\'t look like what went in. That\'s how you stay invisible.');
      this.updateObjective();
    }
  }

  private async receiveShown(pocket: 'shielded' | 'transparent') {
    const { phone, hud } = this.c;
    if (this.s.beat !== 'errands' || this.s.errands.friend) return;
    if (Math.hypot(this.c.player.x - this.c.city.stations.arcade.x, this.c.player.z - this.c.city.stations.arcade.z) > 6) {
      hud.toast('Nobody nearby to show it to.');
      return;
    }
    phone.lower();
    if (pocket === 'transparent') {
      await hud.say([
        T('Mika', 'friend', "Hm, that's your *transparent* address. If I pay that, the whole city sees it on the ledger, and the Tailors get your address again."),
        T('Mika', 'friend', 'Got a shielded one? Starts with *u1*.'),
      ]);
      phone.raise();
      phone.show('receive', { pocket: 'shielded' });
      return;
    }
    this.busy = true;
    await hud.say([T('Mika', 'friend', 'Shielded. Perfect. Sending now.')]);
    await sleep(900);
    this.s.wallet.shielded += 0.5;
    addTx(this.s, { kind: 'receive', amount: 0.5, pocket: 'shielded', who: 'Mika', memo: 'pizza money 🍕 — M', publicView: 'nothing' });
    phone.message(MIKA.id, MIKA.name, MIKA.role, 'sent! check your memo 🍕');
    phone.notify('Received privately', '+0.500 ZEC · “pizza money 🍕 — M”');
    this.c.sfx.coin();
    hud.lesson('Receive privately', 'To get paid privately, share your shielded address (starts with u1). Your transparent one exposes you.');
    this.s.errands.friend = true;
    await sleep(800);
    await hud.say([T('Mika', 'friend', 'Only you can read the note. To everyone else it\'s just... nothing happened. Love that.')]);
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
    await this.c.hud.say([T('Courier', 'courier', 'Pleasure. The coins you swapped FROM are still public on their own chain, remember that.')]);
  }

  // -------------------------------------------------------------- caught / rewind
  private saveCp(beat = this.s.beat) {
    const p = this.c.player;
    this.cp = { s: clone(this.s), px: p.x, pz: p.z, yaw: p.yaw, beat };
  }

  private catching = false;
  private async caught() {
    if (this.catching) return;
    this.catching = true;
    const { hud, phone, player } = this.c;
    this.s.trace = null;
    this.s.caughtCount++;
    player.frozen = true;
    player.stop();
    phone.lower();
    hud.flashRed();
    this.c.sfx.caught();
    this.c.glitch(2);
    const cp = this.cp!;
    const lesson =
      cp.beat === 'exchange'
        ? '<p>You shielded 5 ZEC, then took almost all of it straight back out. The amount going <b>in</b> and the amount coming <b>out</b> are public. Matching them is easy.</p><p><b>Fix:</b> only take out what you need (rent is 1.20), and don\'t do it right after shielding.</p>'
        : '<p>Money sitting in your <b>transparent</b> pocket is public: address, amount, time. That\'s all they needed.</p><p><b>Fix:</b> shield it as soon as it arrives. Wallet → Shield → hold.</p>';
    await hud.card({
      kicker: 'TAILOR & CO.',
      title: 'Found you.',
      body: `<p>File complete: ${this.s.clues.map((c) => `<b>${c.key}</b>`).join(' · ')}</p>${lesson}`,
      button: '⏪ Rewind',
      role: 'tailor',
      cls: 'red',
    });
    this.c.glitch(1);
    this.c.sfx.rewind();
    // restore
    const keepCaught = this.s.caughtCount;
    this.s = clone(cp.s);
    this.s.caughtCount = keepCaught;
    player.x = cp.px;
    player.z = cp.pz;
    player.yaw = cp.yaw;
    player.frozen = false;
    this.visited.clear();
    hud.setFile(this.s.clues, this.s.clues.length > 0);
    this.c.setHood(this.s.hooded);
    if (cp.beat === 'exchange') {
      this.s.trace = null;
      this.c.drones.lose();
      this.c.boards.face = { role: 'you_bare', mode: 'static' };
      for (const l of this.lookouts) l.wander = true;
      this.updateObjective();
      phone.message(SAINT.id, SAINT.name, SAINT.role, 'Rewound. Talk to the clerk again, and only take out the rent.');
    } else {
      this.s.trace = { left: 45, total: 45, reason: 'public pocket' };
      this.c.drones.hunt();
      for (const l of this.lookouts) this.c.npcs.remove(l);
      this.spawnLookouts();
      hud.objective('Shield your 5 ZEC', 'Wallet → Shield → hold. Faster this time.');
      phone.el.classList.add('nudge');
    }
    this.catching = false;
  }

  // -------------------------------------------------------------- ending
  private async ending() {
    if (this.ended) return;
    this.ended = true;
    const { hud, player, phone } = this.c;
    player.frozen = true;
    phone.lower();
    this.markerTarget = null;
    hud.objective(null);
    for (let k = 0; k <= 30; k++) {
      this.c.setDawn(k / 30);
      await sleep(60);
    }
    await hud.say([
      T('The Tailor', 'tailor', "Sun's up. What've we got on the five-ZEC ghost?", true),
      T('The Tailor', 'tailor', 'An address that went empty at 18:14. That\'s it. Close the file.', true),
    ]);
    const priv = this.s.txs.filter((t) => t.pocket === 'shielded').length;
    await hud.card({
      kicker: 'TAILOR & CO. · CASE FILE',
      title: 'SUBJECT: UNKNOWN',
      body: `<p>You made <b>${this.s.txs.length}</b> transactions tonight. <b>${priv}</b> of them showed nothing on the public chain.</p>
             <p>${this.s.caughtCount ? `You got caught <b>${this.s.caughtCount}</b> time${this.s.caughtCount === 1 ? '' : 's'}. Every catch was a mistake real people make.` : 'You never got caught. Clean night.'}</p>
             <p>Zero tags found: <b>${this.s.tags.length}/${this.c.city.tags.length}</b></p>
             <ul class="learned">${hud.lessons.map((l) => `<li>✓ <b>${l.title}</b></li>`).join('')}</ul>`,
      button: 'Continue',
      role: 'you_hood',
    });
    await hud.say([
      T('Zero', 'narrator', 'You were never hiding. You were just private. Like cash, like a closed door.'),
      T('Zero', 'narrator', 'Everything you did tonight works the same way in a real wallet. Same buttons.'),
    ]);
    (window as any).__showReal?.();
  }

  // -------------------------------------------------------------- per frame
  update(dt: number) {
    const s = this.s;
    if (s.beat === 'intro') return;
    if (!this.c.hud.talking && !this.ended) s.clock += dt * this.clockRate;
    if (s.beat === 'loop1' && !this.loop1Done && this.loop1Left > 0 && !this.c.hud.talking) {
      this.loop1Left -= dt;
      if (this.loop1Left <= 0) this.loop1Ambush('waited');
    }
    if (s.trace && !this.c.hud.talking) {
      s.trace.left -= dt;
      if (s.trace.left <= 0) {
        s.trace.left = 0;
        this.caught();
      }
    }
    // lookouts creep toward an exposed player
    if (this.exposed || s.trace) {
      const p = this.c.player;
      for (const l of this.lookouts) {
        if (l.path.length && Math.random() > 0.02) continue;
        if (Math.hypot(l.x - p.x, l.z - p.z) > 2.2) this.c.npcs.send(l, p.x + (Math.random() - 0.5) * 2, p.z + (Math.random() - 0.5) * 2);
        l.ch.lookAt = new THREE.Vector3(p.x, 2, p.z);
      }
    }
    // station proximity
    const p = this.c.player;
    for (const st of Object.values(this.c.city.stations)) {
      const near = Math.hypot(st.x - p.x, st.z - p.z) < 2.4;
      if (near && !this.visited.has(st.id)) {
        this.visited.add(st.id);
        this.arrive(st.id);
      } else if (!near && Math.hypot(st.x - p.x, st.z - p.z) > 4) this.visited.delete(st.id);
    }
    if (s.beat === 'errands' && s.errands.cafe && s.errands.friend && s.errands.exchange) {
      s.beat = 'dawn';
      this.c.phone.message(SAINT.id, SAINT.name, SAINT.role, "That's the night. Go home. The Tailors have nothing.");
      this.updateObjective();
    }
    if (s.beat === 'errands' && Math.random() < dt * 0.5) this.updateObjective();
    for (const t of this.c.city.tags) {
      if (s.tags.includes(String(t.id))) continue;
      if (Math.hypot(t.px + 0.5 - p.x, t.pz - p.z) < 2.2) {
        s.tags.push(String(t.id));
        this.c.sfx.good();
        this.c.hud.toast(`<b>Zero tag ${s.tags.length}/${this.c.city.tags.length}</b><br>${t.fact.replace(/\*([^*]+)\*/g, '<b>$1</b>')}`, 7500);
      }
    }
    const home = this.c.city.stations.home;
    if (s.beat === 'dawn' && !this.ended && !this.busy && Math.hypot(home.x - p.x, home.z - p.z) < 2.4) this.arrive('home');
    this.c.phone.tick();
    this.c.hud.update(s);
  }

  /** player tapped an NPC */
  talkTo(n: Npc) {
    const role = n.role;
    const st = Object.values(this.c.city.stations).find((s) => s.npc && Math.hypot(s.npc.x - n.x, s.npc.z - n.z) < 1.5);
    if (st) {
      this.c.player.goTo(st.x, st.z);
      return;
    }
    if (role === 'crowd' || role === 'lookout') {
      const lines = this.s.hooded
        ? ['…', "Can't place you. Do I know you?", 'Nice hood.', 'Rain again.']
        : ['Hey, aren\'t you the one on the big screen?', 'Five ZEC, huh? Must be nice.', 'Saw your address on the ledger.'];
      this.c.hud.toast(`<b>${n.name ?? 'Stranger'}:</b> ${lines[Math.floor(Math.random() * lines.length)]}`);
      n.ch.lookAt = new THREE.Vector3(this.c.player.x, 2, this.c.player.z);
      setTimeout(() => (n.ch.lookAt = null), 2500);
    }
  }

  private turnTo(x: number, z: number, ms: number) {
    const p = this.c.player;
    const want = Math.atan2(-(x - p.x), -(z - p.z));
    const from = p.yaw;
    let d = want - from;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const t0 = performance.now();
    return new Promise<void>((res) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        p.yaw = from + d * e;
        p.pitch += (0.02 - p.pitch) * 0.1;
        if (k < 1) requestAnimationFrame(step);
        else res();
      };
      requestAnimationFrame(step);
    });
  }
}

export { headByRole };
