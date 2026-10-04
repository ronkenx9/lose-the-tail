import { portrait } from './portrait';
import { voiceKey } from './voice';
import './call.css';

export interface CallStep {
  icon: string;
  title: string;
  text: string;
}

/**
 * A phone call you take while you keep playing (GTA-style): ring, auto-answer,
 * the caller talks in your ear with subtitles, and each point of the lesson shows as a card.
 */
export class Call {
  private el: HTMLElement;
  private cancelled = false;
  private audio: HTMLAudioElement | null = null;
  active = false;
  voiceOn = () => true;
  duck: (on: boolean) => void = () => {};
  ring: () => void = () => {};

  constructor(root: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'call hidden';
    root.appendChild(this.el);
  }

  async start(o: { who: string; role: string; lines: string[]; steps: CallStep[] }) {
    this.cancel();
    this.cancelled = false;
    this.active = true;
    const me = {};
    (this as any).token = me;
    this.el.innerHTML = `
      <div class="call-head">
        <div class="call-pt">${portrait(o.role, 46)}</div>
        <div class="call-id"><b>${o.who}</b><span class="call-st">Incoming call…</span></div>
        <span class="call-ic">📞</span>
      </div>
      <p class="call-sub"></p>
      <div class="call-step"></div>
      <div class="call-dots">${o.steps.map(() => '<i></i>').join('')}</div>`;
    this.el.classList.remove('hidden', 'live', 'ending');
    this.el.classList.add('ringing');
    const st = this.el.querySelector('.call-st') as HTMLElement;
    const sub = this.el.querySelector('.call-sub') as HTMLElement;
    const card = this.el.querySelector('.call-step') as HTMLElement;
    const dots = [...this.el.querySelectorAll('.call-dots i')] as HTMLElement[];
    // ring ring
    for (let i = 0; i < 3 && !this.cancelled; i++) {
      this.ring();
      await wait(650);
    }
    if (this.cancelled) return;
    this.el.classList.remove('ringing');
    this.el.classList.add('live');
    const t0 = performance.now();
    const clock = setInterval(() => {
      const s = Math.floor((performance.now() - t0) / 1000);
      st.textContent = `on call · ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }, 250);
    this.duck(true);
    for (let i = 0; i < o.lines.length && !this.cancelled; i++) {
      const step = o.steps[i];
      if (step) {
        card.innerHTML = `<i>${step.icon}</i><div><b>${step.title}</b><span>${step.text}</span></div>`;
        card.classList.remove('pop');
        void card.offsetWidth;
        card.classList.add('pop');
      }
      dots.forEach((d, k) => d.classList.toggle('on', k <= i));
      await this.say(o.who, o.lines[i], sub);
    }
    clearInterval(clock);
    this.duck(false);
    if (this.cancelled) return;
    st.textContent = 'call ended';
    this.el.classList.add('ending');
    await wait(1400);
    if ((this as any).token !== me) return;
    this.el.classList.add('hidden');
    this.active = false;
  }

  private say(who: string, text: string, sub: HTMLElement) {
    return new Promise<void>((done) => {
      let d = Math.max(3, text.length * 0.062);
      const t0 = performance.now();
      const type = () => {
        if (this.cancelled) return;
        const k = Math.min(1, (performance.now() - t0) / (d * 1000 * 0.88));
        sub.textContent = text.slice(0, Math.ceil(text.length * k));
        if (k < 1) requestAnimationFrame(type);
      };
      type();
      const next = () => setTimeout(done, 380);
      if (!this.voiceOn()) return void setTimeout(next, d * 1000);
      const a = new Audio(`/vo/${voiceKey(who, text)}.mp3`);
      this.audio = a;
      a.onloadedmetadata = () => (d = a.duration || d);
      a.onended = next;
      a.onerror = () => setTimeout(next, d * 1000);
      a.play().catch(() => setTimeout(next, d * 1000));
    });
  }

  cancel() {
    this.cancelled = true;
    this.audio?.pause();
    this.audio = null;
    this.duck(false);
    this.el.classList.add('hidden');
    this.active = false;
  }
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
