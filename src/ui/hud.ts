import './hud.css';
import * as THREE from 'three';
import type { Voice } from '../game/voice';
import { voiceKey, type VoiceEntry } from './voice';
import { portrait, portraitById } from './portrait';
import { esc } from './phone';
import { fmtClock, type Clue, type GameState } from '../game/state';

export interface Line {
  who: string;
  role?: string;
  text: string;
  /** radio / intercepted transmission styling */
  radio?: boolean;
  /** world position of the speaker's head: renders an in-world bubble + positional voice */
  at?: () => THREE.Vector3;
}

export class Hud {
  /** voice-over manifest (public/vo/manifest.json) */
  vo: Record<string, VoiceEntry> = {};
  private _voiceOn = true;
  get voiceOn() { return this._voiceOn; }
  set voiceOn(enabled: boolean) {
    this._voiceOn = enabled;
    if (!enabled) { clearTimeout(this.autoT); this.stopVoice(); }
  }
  onVoice?: (playing: boolean) => void;
  private audio: HTMLAudioElement | null = null;
  private autoT = 0;
  root: HTMLElement;
  private obj: HTMLElement;
  private clock: HTMLElement;
  private trace: HTMLElement;
  private file: HTMLElement;
  private dlg: HTMLElement;
  private marker: HTMLElement;
  private toastEl: HTMLElement;
  private overlay: HTMLElement;
  private queue: { lines: Line[]; done: () => void }[] = [];
  /** set by main: positional voice + screen projection + player position */
  voice?: Voice;
  project?: (v: THREE.Vector3) => { x: number; y: number; on: boolean };
  playerPos?: () => THREE.Vector3;
  private bub!: HTMLElement;
  private curLine: Line | null = null;
  private pv: { stop(): void; setPaused(p: boolean): void } | null = null;
  private paused = false;
  private pausedAt = 0;
  private typing = 0;
  talking = false;

  constructor(root: HTMLElement) {
    this.root = root;
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="hud-top">
         <div class="obj hidden"><span class="obj-k">objective</span><b></b><em></em></div>
         <div class="mid"><div class="clockrow"><div class="clock">18:00</div><button class="mute" aria-label="toggle sound">♪</button></div><div class="trace hidden"><span>TRACE</span><b>00</b><i></i></div></div>
         <div class="file hidden"><span class="file-k">THE THREAD · file on you <b class="file-n"></b></span><div class="slots"></div></div>
       </div>
       <div class="marker hidden"><i></i><span></span></div>
       <div class="bub hidden"><b></b><p></p><i class="bub-arrow"></i></div>
       <div class="dlg hidden"><div class="dlg-pt"></div><div class="dlg-tx"><b></b><p></p><span class="dlg-next">tap ▸</span></div></div>
       <div class="toast"></div>
       <div class="lesson hidden"><i>✓</i><div><b></b><span></span></div></div>
       <div class="overlay hidden"></div>
       <div class="vignette-red"></div>`,
    );
    this.obj = root.querySelector('.obj')!;
    this.clock = root.querySelector('.clock')!;
    this.trace = root.querySelector('.trace')!;
    this.file = root.querySelector('.file')!;
    this.dlg = root.querySelector('.dlg')!;
    this.marker = root.querySelector('.marker')!;
    this.toastEl = root.querySelector('.toast')!;
    this.overlay = root.querySelector('.overlay')!;
    this.dlg.addEventListener('click', () => this.advance());
    this.bub = root.querySelector('.bub')!;
    this.bub.addEventListener('click', () => this.advance());
    this.file.addEventListener('click', () => this.file.classList.toggle('open'));
    window.addEventListener('keydown', (e) => {
      if (this.talking && (e.key === 'Enter' || e.key === 'f' || e.key === 'F')) this.advance();
    });
  }

  // ---------- dialogue ----------
  say(lines: Line[]): Promise<void> {
    return new Promise((done) => {
      this.queue.push({ lines: [...lines], done });
      if (!this.talking) this.next();
    });
  }
  /** cut all dialogue now (someone just grabbed you); pending say() promises resolve */
  hush() {
    const pend = [...(this.cur ? [this.cur] : []), ...this.queue];
    this.queue = [];
    this.cur = null;
    clearInterval(this.typing);
    clearTimeout(this.autoT);
    this.talking = false;
    this.stopVoice();
    this.dlg.classList.add('hidden');
    this.bub.classList.add('hidden');
    this.curLine = null;
    for (const p of pend) p.done();
  }
  private cur: { lines: Line[]; done: () => void } | null = null;
  private full = '';
  private next() {
    if (!this.cur || !this.cur.lines.length) {
      if (this.cur) this.cur.done();
      this.cur = this.queue.shift() ?? null;
      if (!this.cur) {
        this.talking = false;
        this.stopVoice();
        this.dlg.classList.add('hidden');
        this.bub.classList.add('hidden');
        this.curLine = null;
        return;
      }
    }
    const l = this.cur.lines.shift()!;
    this.talking = true;
    this.curLine = l;
    this.paused = false;
    if (l.at) return this.anchored(l);
    this.bub.classList.add('hidden');
    this.dlg.classList.remove('hidden');
    this.dlg.classList.toggle('radio', !!l.radio);
    (this.dlg.querySelector('.dlg-pt') as HTMLElement).innerHTML = l.role ? portrait(l.role, 64) : '';
    (this.dlg.querySelector('b') as HTMLElement).textContent = l.who;
    const p = this.dlg.querySelector('p') as HTMLElement;
    this.full = l.text;
    let i = 0;
    clearInterval(this.typing);
    clearTimeout(this.autoT);
    this.stopVoice();
    p.innerHTML = '';
    this.typed = false;
    this.lineAt = performance.now();
    const id = voiceKey(l.who, l.text);
    const vo = this.voiceOn ? this.vo[id] : undefined;
    let step = 2;
    if (vo && vo.who === l.who) {
      const a = new Audio(`/vo/${id}.mp3`);
      this.audio = a;
      const failed = () => {
        if (this.audio === a) this.stopVoice();
      };
      a.onerror = failed;
      this.onVoice?.(true);
      a.play().catch(failed);
      // finish typing at ~85% of the spoken line
      step = Math.max(1, Math.ceil(this.full.length / ((vo.dur * 0.85 * 1000) / 16)));
      const me = this.cur;
      a.onended = () => {
        this.onVoice?.(false);
        this.autoT = window.setTimeout(() => {
          if (this.cur === me && this.audio === a) this.next();
        }, 900);
      };
    }
    const me = this.cur;
    const voiced = !!(vo && vo.who === l.who);
    this.typing = window.setInterval(() => {
      i += step;
      p.innerHTML = fmt(this.full.slice(0, i));
      if (i >= this.full.length) {
        clearInterval(this.typing);
        this.typed = true;
        // no voice (muted or missing): give reading time, then move on by itself
        if (!voiced || !this.audio) this.autoT = window.setTimeout(() => this.cur === me && this.curLine === l && this.next(), 1300 + this.full.length * 38);
      }
    }, 16);
  }
  /** a line spoken by someone standing in the world */
  private async anchored(l: Line) {
    this.dlg.classList.add('hidden');
    this.bub.classList.remove('hidden');
    this.bub.classList.toggle('radio', !!l.radio);
    this.bub.querySelector('b')!.textContent = l.who;
    const p = this.bub.querySelector('p') as HTMLElement;
    this.full = l.text;
    clearInterval(this.typing);
    clearTimeout(this.autoT);
    this.stopVoice();
    p.innerHTML = '';
    this.typed = false;
    this.lineAt = performance.now();
    const me = this.cur;
    const id = voiceKey(l.who, l.text);
    const vo = this.voiceOn ? this.vo[id] : undefined;
    let dur = Math.max(2.2, l.text.length * 0.058);
    if (vo && vo.who === l.who && this.voice) {
      const h = await this.voice.play(`/vo/${id}.mp3`, l.at!, { radio: l.radio });
      if (this.cur !== me || this.curLine !== l) return h?.stop();
      if (h) {
        this.pv = h;
        dur = h.duration;
        this.onVoice?.(true);
        h.ended.then(() => {
          this.onVoice?.(false);
          if (this.curLine === l && !this.paused) this.autoT = window.setTimeout(() => this.curLine === l && this.next(), 650);
        });
      }
    }
    let i = 0;
    const step = Math.max(1, Math.ceil(this.full.length / ((dur * 0.85 * 1000) / 16)));
    this.typing = window.setInterval(() => {
      if (this.paused) return;
      i += step;
      p.innerHTML = fmt(this.full.slice(0, i));
      if (i >= this.full.length) {
        clearInterval(this.typing);
        this.typed = true;
        if (!this.pv) this.autoT = window.setTimeout(() => this.curLine === l && this.next(), 900 + this.full.length * 12);
      }
    }, 16);
  }

  /** per frame: keep the speech bubble over the speaker; pause if the player walks away */
  frame() {
    const l = this.curLine;
    if (!l || !l.at || !this.project) return;
    const head = l.at();
    const pp = this.playerPos?.();
    if (pp && !l.radio) {
      const d = Math.hypot(head.x - pp.x, head.z - pp.z);
      if (this.paused && performance.now() - this.pausedAt > 3500) {
        // you walked off mid-conversation: they give up on this line instead of holding everything up
        this.paused = false;
        this.bub.classList.remove('far');
        this.stopVoice();
        this.next();
        return;
      }
      if (!this.paused && d > 14) {
        this.paused = true;
        this.pausedAt = performance.now();
        this.pv?.setPaused(true);
        this.bub.classList.add('far');
      } else if (this.paused && d < 9) {
        this.paused = false;
        this.pv?.setPaused(false);
        this.bub.classList.remove('far');
      }
    }
    const s = this.project(head.clone().add(new THREE.Vector3(0, 0.55, 0)));
    const W = innerWidth,
      H = innerHeight,
      pad = 24;
    let x = s.x,
      y = s.y;
    const off = !s.on || x < pad || x > W - pad || y < 70 || y > H - 120;
    const half = this.bub.offsetWidth / 2 + 16;
    if (off) {
      x = Math.max(half, Math.min(W - half, x));
      y = Math.max(110, Math.min(H - 170, y));
    }
    if (!off) x = Math.max(half, Math.min(W - half, x));
    this.bub.classList.toggle('edge', off);
    this.bub.style.transform = `translate(${x}px, ${y}px)`;
  }

  private typed = true;
  private lineAt = 0;
  private stopVoice() {
    if (this.pv) {
      this.pv.stop();
      this.pv = null;
      this.onVoice?.(false);
    }
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
      this.onVoice?.(false);
    }
  }
  private advance() {
    if (performance.now() - this.lineAt < 180) return; // ignore double taps
    const p = (this.curLine?.at ? this.bub : this.dlg).querySelector('p') as HTMLElement;
    if (!this.typed) {
      clearInterval(this.typing);
      p.innerHTML = fmt(this.full);
      this.typed = true;
      return;
    }
    this.next();
  }

  // ---------- objective + marker ----------
  objective(title: string | null, sub = '') {
    if (!title) return this.obj.classList.add('hidden');
    this.obj.classList.remove('hidden');
    this.obj.querySelector('b')!.textContent = title;
    this.obj.querySelector('em')!.textContent = sub;
    this.obj.classList.toggle('short', sub.length > 0 && sub.length <= 52);
    this.obj.classList.remove('flash');
    void this.obj.offsetWidth;
    this.obj.classList.add('flash');
  }

  /** screen-space marker; x,y in px or null for hidden; edge = off-screen arrow angle */
  setMarker(state: { x: number; y: number; label: string; dist: number; edge: number | null } | null) {
    if (!state) return this.marker.classList.add('hidden');
    this.marker.classList.remove('hidden');
    this.marker.style.transform = `translate(${state.x}px, ${state.y}px)`;
    this.marker.classList.toggle('edge', state.edge !== null);
    (this.marker.querySelector('i') as HTMLElement).style.transform = state.edge !== null ? `rotate(${state.edge}rad)` : '';
    this.marker.querySelector('span')!.textContent = `${state.label} · ${Math.round(state.dist)}m`;
  }

  // ---------- status ----------
  update(s: GameState) {
    this.clock.textContent = fmtClock(s.clock);
    if (s.trace) {
      this.trace.classList.remove('hidden');
      const crew = s.trace.reason === 'crew';
      this.trace.querySelector('span')!.textContent = crew ? 'CREW' : 'TRACE';
      this.trace.querySelector('b')!.textContent = crew ? `${Math.max(0, Math.round(s.trace.left))}m` : String(Math.max(0, Math.ceil(s.trace.left))).padStart(2, '0');
      (this.trace.querySelector('i') as HTMLElement).style.transform = `scaleX(${Math.max(0, s.trace.left / s.trace.total)})`;
      this.root.classList.toggle('danger', s.trace.left < 10);
    } else {
      this.trace.classList.add('hidden');
      this.root.classList.remove('danger');
    }
  }

  setFile(clues: Clue[], show: boolean) {
    this.file.classList.toggle('hidden', !show);
    const keys: [Clue['key'], string][] = [
      ['address', 'ADDRESS'],
      ['amount', 'AMOUNT'],
      ['face', 'FACE'],
      ['link', 'TRAIL'],
    ];
    this.file.querySelector('.slots')!.innerHTML = keys
      .map(([k, label]) => {
        const c = clues.find((x) => x.key === k);
        return `<div class="slot ${c ? 'got' : ''}"><span>${label}</span><em>${c ? esc(c.text) : '— unknown —'}</em></div>`;
      })
      .join('');
    this.file.querySelector('.file-n')!.textContent = `${clues.length}/4`;
    this.file.classList.remove('flash');
    void this.file.offsetWidth;
    this.file.classList.add('flash');
  }

  /** big plain-language takeaway after each action */
  lessons: { title: string; body: string }[] = [];
  lesson(title: string, body: string) {
    if (!this.lessons.find((l) => l.title === title)) this.lessons.push({ title, body });
    const el = this.root.querySelector('.lesson') as HTMLElement;
    el.querySelector('b')!.textContent = title;
    el.querySelector('span')!.textContent = body;
    el.classList.remove('hidden', 'show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout((this as any)._lt);
    (this as any)._lt = setTimeout(() => el.classList.add('hidden'), 6500);
  }

  toast(html: string, ms = 3200) {
    const t = document.createElement('div');
    t.className = 'toast-i';
    t.innerHTML = html;
    this.toastEl.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 500);
  }

  // ---------- overlays ----------
  show(html: string, cls = '') {
    this.overlay.className = `overlay ${cls}`;
    this.overlay.innerHTML = html;
    return this.overlay;
  }
  hide() {
    this.overlay.classList.add('hidden');
    this.overlay.innerHTML = '';
  }
  flashRed() {
    this.root.classList.remove('hit');
    void this.root.offsetWidth;
    this.root.classList.add('hit');
  }

  /** big centered card that waits for a button */
  card(opts: { kicker?: string; title: string; body: string; button: string; role?: string; headId?: number; cls?: string }): Promise<void> {
    return new Promise((res) => {
      const o = this.show(
        `<div class="card ${opts.cls ?? ''}">
          ${opts.headId !== undefined ? portraitById(opts.headId, 120, 'big') : opts.role ? portrait(opts.role, 120, 'big') : ''}
          ${opts.kicker ? `<span class="kicker">${opts.kicker}</span>` : ''}
          <h2>${opts.title}</h2><div class="card-body">${opts.body}</div>
          <button class="cta">${opts.button}</button></div>`,
        'dim',
      );
      o.querySelector('.cta')!.addEventListener('click', () => {
        this.hide();
        res();
      });
    });
  }
}

function fmt(s: string) {
  return esc(s).replace(/\*([^*]+)\*/g, '<b>$1</b>').replace(/_([^_]+)_/g, '<i>$1</i>');
}
