import './phone.css';
import { ADDR, fmtClock, fmtZec, type GameState } from '../game/state';
import { portrait } from './portrait';

export type PhoneAction =
  | { type: 'wallet-created' }
  | { type: 'shield' }
  | { type: 'send'; to: Contact; amount: number; memo: string }
  | { type: 'swap'; coin: string; zec: number }
  | { type: 'receive-shown'; pocket: 'shielded' | 'transparent' }
  | { type: 'open'; screen: string }
  | { type: 'raised' }
  | { type: 'lowered' };

export interface Contact {
  id: 'cafe' | 'friend' | 'exchange' | 'kiosk';
  name: string;
  addr: string;
  pocket: 'shielded' | 'transparent';
  role: string;
  hint: string;
  presetAmount?: number;
  /** amount slider instead of fixed */
  slider?: { min: number; max: number; def: number };
  memoHint?: string;
}

interface Msg {
  from: 'them' | 'me';
  text: string;
}
interface Thread {
  id: string;
  name: string;
  role: string;
  msgs: Msg[];
  unread: number;
}

const WORDS =
  'ghost lantern copper vivid ozone parcel quiet ember cradle signal velvet harbor mosaic thunder orbit sable rumor cipher meadow tundra violet shadow anchor zero'.split(
    ' ',
  );

export class Phone {
  el: HTMLElement;
  private screen = 'lock';
  private params: any = {};
  up = false;
  private threads: Thread[] = [];
  private contacts: Contact[] = [];
  private banner: HTMLElement;
  private body: HTMLElement;
  private quiz: { idx: number[]; step: number; picked: string[] } | null = null;
  /** gate which home actions are allowed */
  allow = { shield: true, send: true, swap: true, receive: true };

  constructor(
    root: HTMLElement,
    private getState: () => GameState,
    private onAction: (a: PhoneAction) => void,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'phone down';
    this.el.innerHTML = `
      <div class="ph-frame">
        <div class="ph-notch"></div>
        <div class="ph-status"><span class="ph-time">18:00</span><span class="ph-icons">▂▄▆ ◔</span></div>
        <div class="ph-banner"></div>
        <div class="ph-body"></div>
        <button class="ph-home" aria-label="lower phone"></button>
      </div>
      <div class="ph-hint">tap phone</div>`;
    root.appendChild(this.el);
    const fit = () => {
      const narrow = innerWidth <= 760;
      const k = narrow ? Math.min(1.05, (0.94 * innerWidth) / 320, (0.92 * innerHeight) / 640) : Math.min(1, (0.9 * innerHeight) / 640);
      this.el.style.setProperty('--phs', k.toFixed(3));
    };
    fit();
    addEventListener('resize', fit);
    this.banner = this.el.querySelector('.ph-banner')!;
    this.body = this.el.querySelector('.ph-body')!;
    this.el.addEventListener('click', (e) => {
      if (!this.up) {
        this.raise();
        e.stopPropagation();
        return;
      }
      const t = (e.target as HTMLElement).closest('[data-go],[data-act]') as HTMLElement | null;
      if (!t) return;
      if (t.dataset.go) this.show(t.dataset.go, JSON.parse(t.dataset.p || '{}'));
      if (t.dataset.act) this.act(t.dataset.act, t);
    });
    this.el.querySelector('.ph-home')!.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.screen !== 'home' && this.getState().wallet.created && this.screen !== 'seed' && this.screen !== 'quiz') this.show('home');
      else this.lower();
    });
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
      if (e.key === 'e' || e.key === 'E' || e.key === ' ' || e.key === 'Tab') {
        e.preventDefault();
        this.up ? this.lower() : this.raise();
      }
      if (e.key === 'Escape' && this.up) this.lower();
    });
  }

  // ---------- public api ----------
  raise() {
    if (this.up) return;
    this.up = true;
    this.el.classList.remove('down');
    this.el.classList.add('up');
    if (this.getState().wallet.created && (this.screen === 'done' || this.screen === 'lock')) this.screen = 'home';
    this.render();
    this.onAction({ type: 'raised' });
  }
  lower() {
    if (!this.up) return;
    this.up = false;
    this.el.classList.remove('up');
    this.el.classList.add('down');
    this.onAction({ type: 'lowered' });
  }
  show(screen: string, params: any = {}) {
    this.screen = screen;
    this.params = params;
    if (screen === 'thread') {
      const th = this.threads.find((t) => t.id === params.id);
      if (th) th.unread = 0;
    }
    this.render();
    this.onAction({ type: 'open', screen });
  }
  get current() {
    return this.screen;
  }
  setContacts(c: Contact[]) {
    this.contacts = c;
    if (this.up) this.render();
  }

  thread(id: string, name: string, role: string) {
    let t = this.threads.find((x) => x.id === id);
    if (!t) {
      t = { id, name, role, msgs: [], unread: 0 };
      this.threads.unshift(t);
    }
    return t;
  }

  /** incoming message: banner + buzz */
  message(id: string, name: string, role: string, text: string, opts: { silent?: boolean } = {}) {
    const t = this.thread(id, name, role);
    t.msgs.push({ from: 'them', text });
    this.threads = [t, ...this.threads.filter((x) => x !== t)];
    const viewing = this.up && this.screen === 'thread' && this.params.id === id;
    if (!viewing) t.unread++;
    if (!opts.silent) this.notify(name, text, role, () => this.show('thread', { id }));
    if (this.up) this.render();
  }
  myMessage(id: string, text: string) {
    const t = this.threads.find((x) => x.id === id);
    t?.msgs.push({ from: 'me', text });
    if (this.up) this.render();
  }

  notify(title: string, body: string, role?: string, onTap?: () => void) {
    this.banner.innerHTML = `${role ? portrait(role, 28) : '<div class="ph-bn-ic">Ƶ</div>'}<div><b>${title}</b><span>${body}</span></div>`;
    this.banner.classList.remove('show');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    this.banner.onclick = (e) => {
      e.stopPropagation();
      if (!this.up) this.raise();
      onTap?.();
      this.banner.classList.remove('show');
    };
    this.el.classList.remove('buzz');
    void this.el.offsetWidth;
    this.el.classList.add('buzz');
    navigator.vibrate?.(60);
    clearTimeout((this as any)._bt);
    (this as any)._bt = setTimeout(() => this.banner.classList.remove('show'), 5200);
    this.updateBadge();
  }

  tick() {
    const s = this.getState();
    (this.el.querySelector('.ph-time') as HTMLElement).textContent = fmtClock(s.clock);
  }

  updateBadge() {
    const n = this.threads.reduce((a, t) => a + t.unread, 0);
    this.el.dataset.badge = n ? String(n) : '';
  }

  // ---------- render ----------
  render() {
    const s = this.getState();
    this.updateBadge();
    const f = (this as any)['s_' + this.screen];
    this.body.innerHTML = f ? f.call(this, s) : '';
    this.body.scrollTop = 0;
    if (this.screen === 'thread') {
      const list = this.body.querySelector('.msgs');
      if (list) list.scrollTop = list.scrollHeight;
    }
    this.bindHolds();
  }

  private s_lock(s: GameState) {
    return `
      <div class="lock">
        <div class="lock-time">${fmtClock(s.clock)}</div>
        <div class="lock-date">Ledger City · rain</div>
        ${this.threads.length ? this.threads.map((t) => this.threadRow(t)).join('') : `<div class="muted c">no notifications</div>`}
        <div class="apps">
          ${s.wallet.created ? `<button data-go="home" class="app"><span class="app-ic wal">Ƶ</span>Wallet</button>` : `<button data-go="create" class="app"><span class="app-ic wal">Ƶ</span>Wallet</button>`}
          <button data-go="threads" class="app"><span class="app-ic msg">✉</span>Messages</button>
        </div>
      </div>`;
  }

  private threadRow(t: Thread) {
    const last = t.msgs[t.msgs.length - 1];
    return `<button class="row thread-row" data-go="thread" data-p='{"id":"${t.id}"}'>
      ${portrait(t.role, 34)}
      <div class="grow"><b>${t.name}</b><span class="muted ell">${last ? esc(last.text) : ''}</span></div>
      ${t.unread ? `<i class="dot">${t.unread}</i>` : ''}
    </button>`;
  }

  private s_threads() {
    return `<div class="top"><button data-go="${this.getState().wallet.created ? 'home' : 'lock'}" class="back">‹</button><h3>Messages</h3></div>
      ${this.threads.map((t) => this.threadRow(t)).join('')}`;
  }

  private s_thread() {
    const t = this.threads.find((x) => x.id === this.params.id);
    if (!t) return '';
    return `<div class="top"><button data-go="threads" class="back">‹</button>${portrait(t.role, 26)}<h3>${t.name}</h3></div>
      <div class="msgs">${t.msgs.map((m) => `<div class="bubble ${m.from}">${esc(m.text)}</div>`).join('')}</div>
      ${this.getState().wallet.created ? `<button class="btn ghost" data-go="home">Open wallet</button>` : `<button class="btn" data-go="create">Open wallet</button>`}`;
  }

  // wallet setup
  private s_create() {
    return `<div class="center-col">
      <div class="logo-z">Ƶ</div>
      <h2>Practice Wallet</h2>
      <p class="muted">Works like <b>Zodl</b>, a real Zcash wallet. Same buttons. Nothing here is real money.</p>
      <button class="btn" data-go="seed">Create new wallet</button>
      <p class="tiny muted">Your wallet is created on this phone. No email. No account.</p>
    </div>`;
  }
  private s_seed() {
    return `<div class="top"><h3>Your secret words</h3></div>
      <p class="muted sm">These 24 words <b>are</b> your wallet. Anyone with them owns your money. Write them on paper. Never type them into a website, a form or a chat.</p>
      <ol class="seed">${WORDS.map((w) => `<li>${w}</li>`).join('')}</ol>
      <button class="btn" data-act="seed-done">I wrote them down</button>`;
  }
  private s_quiz() {
    if (!this.quiz) this.quiz = { idx: [3, 10, 18], step: 0, picked: [] };
    const q = this.quiz;
    const want = q.idx[q.step];
    const opts = shuffle([WORDS[want], ...shuffle(WORDS.filter((_, i) => i !== want)).slice(0, 5)]);
    return `<div class="top"><h3>Check your backup</h3></div>
      <p class="muted sm">Tap word <b>#${want + 1}</b>. (${q.step + 1} of 3)</p>
      <div class="chips">${opts.map((o) => `<button class="chip" data-act="quiz" data-w="${o}">${o}</button>`).join('')}</div>
      <p class="tiny muted">Forgot? <button class="link" data-go="seed">see words again</button></p>`;
  }

  private s_home(s: GameState) {
    if (s.naive)
      return `<div class="top"><h3>Wallet</h3></div>
        <div class="bal"><span class="muted tiny">balance</span><div class="big">${fmtZec(s.wallet.transparent)} <small>ZEC</small></div></div>
        <div class="actions two"><button data-go="send"><i>↑</i>Pay</button><button data-go="receive" class="off"><i>↓</i>Receive</button></div>
        <h4>Activity</h4>
        <div class="acts">${s.txs.map((x) => `<div class="act"><b>${actLabel(x.kind)}</b><span>${x.kind === 'send' ? '−' : '+'}${fmtZec(x.amount)}</span><em>${fmtClock(x.at)} · ${x.who ?? ''}</em></div>`).join('')}</div>`;
    const total = s.wallet.shielded + s.wallet.transparent;
    const t = s.wallet.transparent > 0.0001;
    return `<div class="top"><button data-go="threads" class="back ic">✉${this.threads.some((x) => x.unread) ? '<i class="pip"></i>' : ''}</button><h3>Wallet</h3><span class="pill">practice</span></div>
      <div class="bal"><span class="muted tiny">total balance</span><div class="big">${fmtZec(total)} <small>ZEC</small></div></div>
      <div class="pockets">
        <div class="pocket sh"><span>🛡 Shielded</span><b>${fmtZec(s.wallet.shielded)}</b><em>private · only you can see it</em></div>
        <div class="pocket tr ${t ? 'warn' : ''}"><span>👁 Transparent</span><b>${fmtZec(s.wallet.transparent)}</b><em>${t ? 'PUBLIC · anyone can see this' : 'public pocket · empty'}</em></div>
      </div>
      ${t ? `<button class="btn shieldbtn ${this.allow.shield ? '' : 'off'}" data-go="shield">🛡 Shield ${fmtZec(s.wallet.transparent)} ZEC</button>` : ''}
      <div class="actions">
        <button data-go="receive" class="${this.allow.receive ? '' : 'off'}"><i>↓</i>Receive</button>
        <button data-go="send" class="${this.allow.send ? '' : 'off'}"><i>↑</i>Send</button>
        <button data-go="swap" class="${this.allow.swap ? '' : 'off'}"><i>⇄</i>Swap</button>
      </div>
      <h4>Activity</h4>
      <div class="acts">${
        s.txs.length
          ? s.txs
              .map(
                (x) => `<div class="act ${x.kind}"><b>${actLabel(x.kind)}</b><span>${x.kind === 'send' || x.kind === 'unshield' ? '−' : '+'}${fmtZec(x.amount)}</span>
                  <em>${fmtClock(x.at)} · ${x.who ?? ''}${x.memo ? ` · “${esc(x.memo)}”` : ''}</em></div>`,
              )
              .join('')
          : '<p class="muted tiny">nothing yet</p>'
      }</div>`;
  }

  private s_receive() {
    const p = this.params.pocket ?? 'shielded';
    const addr = p === 'shielded' ? ADDR.you_u : ADDR.you_t;
    return `<div class="top"><button data-go="home" class="back">‹</button><h3>Receive</h3></div>
      <div class="seg"><button class="${p === 'shielded' ? 'on' : ''}" data-act="recv" data-pk="shielded">🛡 Shielded</button><button class="${p === 'transparent' ? 'on' : ''}" data-act="recv" data-pk="transparent">👁 Transparent</button></div>
      <div class="qr ${p}">${qr(addr)}</div>
      <code class="addr">${addr}</code>
      <p class="muted sm">${
        p === 'shielded'
          ? 'Share this one. Payments to it are private: amount, sender and note stay hidden.'
          : '⚠ Payments to this address are public on the blockchain, like a glass wallet. Exchanges sometimes need it.'
      }</p>
      <button class="btn" data-act="show-addr" data-pk="${p}">Show to someone nearby</button>`;
  }

  private s_send(s: GameState) {
    if (!this.contacts.length)
      return `<div class="top"><button data-go="home" class="back">‹</button><h3>Send</h3></div>
        <p class="muted c sm">Nobody to pay right now. Walk up to a shop or a friend.</p>`;
    return `<div class="top"><button data-go="home" class="back">‹</button><h3>Send to</h3></div>
      ${this.contacts
        .map(
          (c) => `<button class="row" data-go="send2" data-p='{"id":"${c.id}"}'>${portrait(c.role, 34)}<div class="grow"><b>${c.name}</b>
            <span class="muted tiny">${c.pocket === 'shielded' ? '🛡 shielded address' : '👁 transparent address'} · ${c.hint}</span></div><span>›</span></button>`,
        )
        .join('')}`;
  }

  private s_send2(s: GameState) {
    const c = this.contacts.find((x) => x.id === this.params.id);
    if (!c) return this.s_send(s);
    if (s.naive)
      return `<div class="top"><button data-go="send" class="back">‹</button><h3>${c.name}</h3></div>
        <code class="addr sm">${c.addr}</code>
        <div class="amt"><b id="amt">${fmtZec(c.presetAmount ?? 0.3)}</b> ZEC</div>
        <button class="hold" data-hold="send" data-id="${c.id}"><span class="fill"></span><span class="lbl">Hold to pay</span></button>`;
    const pub = c.pocket === 'transparent';
    const amount = this.params.amount ?? c.presetAmount ?? c.slider?.def ?? 0.1;
    const max = s.wallet.shielded;
    return `<div class="top"><button data-go="send" class="back">‹</button><h3>${c.name}</h3></div>
      <code class="addr sm">${c.addr}</code>
      <div class="amt"><b id="amt">${fmtZec(amount)}</b> ZEC</div>
      ${
        c.slider
          ? `<input type="range" id="slider" min="${c.slider.min}" max="${Math.min(c.slider.max, max)}" step="0.05" value="${Math.min(amount, max)}">
             <div class="row-sb tiny muted"><span>${c.slider.min}</span><button class="link" data-act="all">cash out everything</button></div>`
          : ''
      }
      ${
        pub
          ? `<div class="warnbox">👁 <b>This leaves the shielded pool.</b> The amount, the time and the destination become public. Anyone watching the pool can compare it with what went in.</div>`
          : `<label class="memo"><span>Private note (memo) — only they can read it</span><textarea id="memo" maxlength="120" placeholder="${c.memoHint ?? 'write something…'}"></textarea></label>
             <div class="okbox">🛡 Private: sender, receiver, amount and note are encrypted.</div>`
      }
      <button class="hold" data-hold="send" data-id="${c.id}"><span class="fill"></span><span class="lbl">Hold to send</span></button>
      <p class="tiny muted c">from your shielded pocket · fee 0.0001</p>`;
  }

  private s_shield(s: GameState) {
    return `<div class="top"><button data-go="home" class="back">‹</button><h3>Shield</h3></div>
      <div class="shield-viz"><div class="glass">👁 ${fmtZec(s.wallet.transparent)}</div><div class="arrow">→</div><div class="vault">🛡</div></div>
      <p class="sm">Move <b>${fmtZec(s.wallet.transparent)} ZEC</b> from your public pocket into your private one.</p>
      <p class="muted sm">After this, nobody can see your balance, who pays you or who you pay. They can see <i>that</i> money entered the shielded pool, not where it goes next.</p>
      <button class="hold big" data-hold="shield"><span class="fill"></span><span class="lbl">Hold to shield</span></button>`;
  }

  private s_proving() {
    return `<div class="center-col proving"><div class="spin"></div><h3>Shielding…</h3><p class="muted sm">Building a zero-knowledge proof. It proves the payment is valid without revealing anything about it.</p></div>`;
  }

  private s_done() {
    const p = this.params;
    return `<div class="center-col"><div class="logo-z ok">${p.icon ?? '✓'}</div><h3>${p.title}</h3><p class="muted sm">${p.body}</p>
      <button class="btn" data-act="close-done">Done</button></div>`;
  }

  private s_swap(s: GameState) {
    return `<div class="top"><button data-go="home" class="back">‹</button><h3>Swap into ZEC</h3></div>
      <p class="muted sm">Turn another coin into <b>shielded</b> ZEC. In the real Zodl app this runs through NEAR Intents and lands straight in your private pocket.</p>
      <div class="swapbox"><div><span class="muted tiny">from</span><b>20 USDC</b><em>on another chain</em></div><div class="arrow">↓</div><div><span class="muted tiny">to</span><b>≈ 0.48 ZEC</b><em>🛡 shielded</em></div></div>
      <button class="hold" data-hold="swap"><span class="fill"></span><span class="lbl">Hold to swap</span></button>
      <p class="tiny muted c">the coin you send from is public on its own chain</p>`;
  }

  // ---------- actions ----------
  private act(a: string, t: HTMLElement) {
    if (a === 'seed-done') {
      this.quiz = null;
      this.show('quiz');
    }
    if (a === 'quiz') {
      const q = this.quiz!;
      const want = WORDS[q.idx[q.step]];
      if (t.dataset.w === want) {
        t.classList.add('right');
        q.step++;
        setTimeout(() => {
          if (q.step >= 3) {
            this.onAction({ type: 'wallet-created' });
          } else this.render();
        }, 280);
      } else {
        t.classList.add('wrong');
        this.el.classList.remove('buzz');
        void this.el.offsetWidth;
        this.el.classList.add('buzz');
      }
    }
    if (a === 'recv') this.show('receive', { pocket: t.dataset.pk });
    if (a === 'show-addr') this.onAction({ type: 'receive-shown', pocket: t.dataset.pk as any });
    if (a === 'all') {
      const sl = this.body.querySelector('#slider') as HTMLInputElement;
      if (sl) {
        sl.value = sl.max;
        sl.dispatchEvent(new Event('input'));
      }
    }
    if (a === 'close-done') {
      this.show('home');
      this.lower();
    }
  }

  private bindHolds() {
    const sl = this.body.querySelector('#slider') as HTMLInputElement | null;
    if (sl)
      sl.oninput = () => {
        this.params.amount = parseFloat(sl.value);
        (this.body.querySelector('#amt') as HTMLElement).textContent = fmtZec(this.params.amount);
      };
    this.body.querySelectorAll<HTMLElement>('[data-hold]').forEach((b) => {
      let raf = 0,
        t0 = 0;
      const fill = b.querySelector('.fill') as HTMLElement;
      const dur = 1100;
      const stop = () => {
        cancelAnimationFrame(raf);
        if (!b.classList.contains('done')) fill.style.transform = 'scaleX(0)';
        b.classList.remove('holding');
      };
      b.onpointerdown = (e) => {
        e.preventDefault();
        t0 = performance.now();
        b.classList.add('holding');
        const step = () => {
          const k = Math.min(1, (performance.now() - t0) / dur);
          fill.style.transform = `scaleX(${k})`;
          if (k >= 1) {
            b.classList.add('done');
            navigator.vibrate?.(30);
            this.hold(b.dataset.hold!, b);
            return;
          }
          raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
      };
      b.onpointerup = b.onpointerleave = b.onpointercancel = stop;
    });
  }

  private hold(kind: string, b: HTMLElement) {
    if (kind === 'shield') {
      this.show('proving');
      setTimeout(() => this.onAction({ type: 'shield' }), 1900);
    }
    if (kind === 'swap') {
      this.show('proving');
      setTimeout(() => this.onAction({ type: 'swap', coin: 'USDC', zec: 0.48 }), 1500);
    }
    if (kind === 'send') {
      const c = this.contacts.find((x) => x.id === b.dataset.id)!;
      const memo = (this.body.querySelector('#memo') as HTMLTextAreaElement | null)?.value.trim() ?? '';
      const amount = this.params.amount ?? c.presetAmount ?? c.slider?.def ?? 0.1;
      this.show('proving');
      setTimeout(() => this.onAction({ type: 'send', to: c, amount, memo }), 1500);
    }
  }
}

function actLabel(k: string) {
  return { receive: 'Received', send: 'Sent', shield: 'Shielded', unshield: 'Cashed out', swap: 'Swapped in' }[k] ?? k;
}

export function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function shuffle<T>(a: T[]) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

/** decorative QR-like matrix (practice address, not scannable) */
function qr(text: string) {
  const n = 25;
  let h = 2166136261;
  const cells: string[] = [];
  const finder = (x: number, y: number) => {
    for (const [fx, fy] of [
      [0, 0],
      [n - 7, 0],
      [0, n - 7],
    ]) {
      const dx = x - fx,
        dy = y - fy;
      if (dx >= 0 && dy >= 0 && dx < 7 && dy < 7) return dx === 0 || dy === 0 || dx === 6 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4) ? 1 : 0;
    }
    return -1;
  };
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const f = finder(x, y);
      let on: boolean;
      if (f >= 0) on = f === 1;
      else {
        h ^= text.charCodeAt((x * 7 + y * 13) % text.length) + x * 31 + y;
        h = Math.imul(h, 16777619);
        on = (h >>> 0) % 100 < 46;
      }
      if (on) cells.push(`<rect x="${x}" y="${y}" width="1.02" height="1.02"/>`);
    }
  return `<svg viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><g fill="#000">${cells.join('')}</g></svg>`;
}
