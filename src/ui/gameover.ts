import * as THREE from 'three';
import { Zero } from '../engine/characters';
import './gameover.css';

export interface GameOverOpts {
  kicker: string;
  sub: string;
  clues: { key: string; text: string }[];
  lesson?: string;
  /** what Zero says through the laughter (shown typed as he laughs) */
  quote: string;
  /** /vo/<laugh>.mp3 */
  laugh: string;
  button: string;
}

/**
 * GAME OVER: a glitching title slams in letter by letter while a live voxel Zero
 * throws his head back and laughs at you, HA HA HA bursting around him.
 */
export class GameOver {
  private el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer | null = null;
  private scene = new THREE.Scene();
  private cam = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  private zero = new Zero();
  private raf = 0;
  private t = 0;
  private laughing = false;
  /** set by main: whether voices are on, and music ducking */
  voiceOn = () => true;
  duck: (on: boolean) => void = () => {};

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'go hidden';
    this.el.innerHTML = `
      <div class="go-bg"></div>
      <div class="go-stage"><canvas class="go-zero"></canvas><div class="go-ha"></div></div>
      <div class="go-col">
        <span class="go-kicker"></span>
        <h1 class="go-title" data-text="GAME OVER">${'GAME OVER'
          .split('')
          .map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`)
          .join('')}</h1>
        <p class="go-sub"></p>
        <div class="go-file"></div>
        <div class="go-lesson"></div>
        <p class="go-quote"><b>ZERO</b><span></span></p>
        <button class="cta go-btn" disabled></button>
      </div>`;
    document.body.appendChild(this.el);
    this.canvas = this.el.querySelector('.go-zero') as HTMLCanvasElement;
    this.zero.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshBasicMaterial | undefined;
      if (m?.color) m.color.setScalar(1.05);
    });
    this.scene.add(this.zero.group);
    // a cold rim of light behind him
    const cv = document.createElement('canvas');
    cv.width = cv.height = 256;
    const g = cv.getContext('2d')!;
    const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255,70,80,0.75)');
    grad.addColorStop(0.45, 'rgba(255,40,60,0.28)');
    grad.addColorStop(1, 'rgba(255,40,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    const halo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    halo.position.set(0, 0.62, -0.4);
    halo.name = 'halo';
    this.scene.add(halo);
  }

  show(o: GameOverOpts): Promise<void> {
    const q = <T extends HTMLElement>(s: string) => this.el.querySelector(s) as T;
    q('.go-kicker').textContent = o.kicker;
    q('.go-sub').innerHTML = o.sub;
    q('.go-file').innerHTML = o.clues.map((c, i) => `<span class="chip-k" style="--i:${i}"><b>${c.key}</b>${c.text}</span>`).join('');
    q('.go-lesson').innerHTML = o.lesson ?? '';
    q('.go-lesson').classList.toggle('empty', !o.lesson);
    const quote = q('.go-quote span');
    quote.textContent = '';
    const btn = q<HTMLButtonElement>('.go-btn');
    btn.textContent = o.button;
    btn.disabled = true;
    this.el.classList.remove('hidden', 'out');
    void this.el.offsetWidth;
    this.el.classList.add('in');
    this.start();
    // the laugh: audio + pose + typed quote + HA bursts
    let dur = 5;
    const a = new Audio(`/vo/${o.laugh}.mp3`);
    const go = () => {
      this.laughing = true;
      this.duck(true);
      const t0 = performance.now();
      const type = () => {
        const k = Math.min(1, (performance.now() - t0) / (dur * 1000 * 0.9));
        quote.textContent = o.quote.slice(0, Math.ceil(o.quote.length * k));
        if (k < 1 && !this.el.classList.contains('hidden')) requestAnimationFrame(type);
      };
      type();
      const burst = () => {
        if (!this.laughing) return;
        this.ha();
        setTimeout(burst, 170 + Math.random() * 160);
      };
      burst();
    };
    const stop = () => {
      this.laughing = false;
      this.duck(false);
      quote.textContent = o.quote;
    };
    setTimeout(() => {
      if (this.voiceOn()) {
        a.onloadedmetadata = () => (dur = a.duration || dur);
        a.onended = stop;
        a.play().then(go, () => {
          go();
          setTimeout(stop, dur * 1000);
        });
      } else {
        go();
        setTimeout(stop, dur * 1000);
      }
    }, 650);
    setTimeout(() => (btn.disabled = false), 2600);
    return new Promise((res) => {
      btn.onclick = () => {
        btn.onclick = null;
        a.pause();
        stop();
        this.el.classList.remove('in');
        this.el.classList.add('out');
        setTimeout(() => {
          this.el.classList.add('hidden');
          this.el.classList.remove('out');
          cancelAnimationFrame(this.raf);
          this.raf = 0;
          (this.el.querySelector('.go-ha') as HTMLElement).innerHTML = '';
        }, 650);
        res();
      };
    });
  }

  /** a "HA" pops out around his head and floats off */
  private ha() {
    const box = this.el.querySelector('.go-ha') as HTMLElement;
    const b = document.createElement('b');
    b.textContent = Math.random() < 0.18 ? 'HA HA' : 'HA';
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const r = 26 + Math.random() * 18;
    b.style.left = `${50 + Math.cos(ang) * r}%`;
    b.style.top = `${40 + Math.sin(ang) * r * 0.8}%`;
    b.style.setProperty('--rot', `${(Math.random() - 0.5) * 40}deg`);
    b.style.setProperty('--s', `${0.7 + Math.random() * 0.9}`);
    box.appendChild(b);
    setTimeout(() => b.remove(), 1300);
  }

  private start() {
    if (!this.renderer) {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: false });
      this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    }
    this.t = 0;
    this.zero.laugh = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.t += dt;
      const w = this.canvas.clientWidth,
        h = this.canvas.clientHeight;
      if (this.canvas.width !== Math.floor(w * this.renderer!.getPixelRatio())) {
        this.renderer!.setSize(w, h, false);
        this.cam.aspect = w / Math.max(1, h);
        this.cam.updateProjectionMatrix();
      }
      // he drifts in out of the dark, then laughs
      const k = Math.min(1, this.t / 1.3);
      const e = 1 - Math.pow(1 - k, 3);
      this.cam.position.set(Math.sin(this.t * 0.4) * 0.15, 0.68 + (1 - e) * 0.3, 4.6 - e * 1.6);
      this.cam.lookAt(0, 0.62, 0);
      this.zero.laugh += ((this.laughing ? 1 : 0.15) - this.zero.laugh) * Math.min(1, dt * 6);
      this.zero.group.rotation.y = Math.sin(this.t * 0.9) * 0.25;
      this.zero.update(dt);
      const halo = this.scene.getObjectByName('halo') as THREE.Mesh;
      halo.scale.setScalar(1 + Math.sin(this.t * 6) * 0.04 + (this.laughing ? Math.abs(Math.sin(this.t * 19)) * 0.06 : 0));
      this.renderer!.render(this.scene, this.cam);
      this.raf = requestAnimationFrame(frame);
    };
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(frame);
  }
}
