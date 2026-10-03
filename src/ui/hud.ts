import './hud.css';
import { portrait, portraitById } from './portrait';
import { esc } from './phone';
import { fmtClock, type Clue, type GameState } from '../game/state';

export interface Line {
  who: string;
  role?: string;
  text: string;
  /** radio / intercepted transmission styling */
  radio?: boolean;
}

export class Hud {
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
  private typing = 0;
  talking = false;

  constructor(root: HTMLElement) {
    this.root = root;
    root.insertAdjacentHTML(
      'beforeend',
      `<div class="hud-top">
         <div class="obj hidden"><span class="obj-k">objective</span><b></b><em></em></div>
         <div class="mid"><div class="clock">18:00</div><div class="trace hidden"><span>TRACE</span><b>00</b><i></i></div></div>
         <div class="file hidden"><span class="file-k">TAILOR & CO. · file on you <b class="file-n"></b></span><div class="slots"></div></div>
       </div>
       <div class="marker hidden"><i></i><span></span></div>
       <div class="dlg hidden"><div class="dlg-pt"></div><div class="dlg-tx"><b></b><p></p><span class="dlg-next">tap ▸</span></div></div>
       <div class="toast"></div>
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
  private cur: { lines: Line[]; done: () => void } | null = null;
  private full = '';
  private next() {
    if (!this.cur || !this.cur.lines.length) {
      if (this.cur) this.cur.done();
      this.cur = this.queue.shift() ?? null;
      if (!this.cur) {
        this.talking = false;
        this.dlg.classList.add('hidden');
        return;
      }
    }
    const l = this.cur.lines.shift()!;
    this.talking = true;
    this.dlg.classList.remove('hidden');
    this.dlg.classList.toggle('radio', !!l.radio);
    (this.dlg.querySelector('.dlg-pt') as HTMLElement).innerHTML = l.role ? portrait(l.role, 64) : '';
    (this.dlg.querySelector('b') as HTMLElement).textContent = l.who;
    const p = this.dlg.querySelector('p') as HTMLElement;
    this.full = l.text;
    let i = 0;
    clearInterval(this.typing);
    p.innerHTML = '';
    this.typed = false;
    this.lineAt = performance.now();
    this.typing = window.setInterval(() => {
      i += 2;
      p.innerHTML = fmt(this.full.slice(0, i));
      if (i >= this.full.length) {
        clearInterval(this.typing);
        this.typed = true;
      }
    }, 16);
  }
  private typed = true;
  private lineAt = 0;
  private advance() {
    if (performance.now() - this.lineAt < 180) return; // ignore double taps
    const p = this.dlg.querySelector('p') as HTMLElement;
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
      this.trace.querySelector('b')!.textContent = String(Math.max(0, Math.ceil(s.trace.left))).padStart(2, '0');
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
