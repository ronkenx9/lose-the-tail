/** Tiny WebAudio synth: no audio files, starts after first user gesture. */
export class Sfx {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private rain?: AudioBufferSourceNode;
  private pad?: OscillatorNode[];
  muted = false;

  start() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.ambience();
  }
  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    return this.muted;
  }

  private ambience() {
    const c = this.ctx!;
    // rain: filtered noise
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 900;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 5200;
    const g = c.createGain();
    g.gain.value = 0.07;
    src.connect(hp).connect(lp).connect(g).connect(this.master);
    src.start();
    this.rain = src;
    // dark synth pad
    const pg = c.createGain();
    pg.gain.value = 0.0;
    pg.gain.linearRampToValueAtTime(0.045, c.currentTime + 4);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    this.pad = [55, 82.4, 110, 164.8].map((hz, i) => {
      const o = c.createOscillator();
      o.type = i % 2 ? 'sawtooth' : 'triangle';
      o.frequency.value = hz;
      o.detune.value = (Math.random() - 0.5) * 14;
      o.connect(f);
      o.start();
      return o;
    });
    f.connect(pg).connect(this.master);
  }

  private tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slide = 0, delay = 0) {
    const c = this.ctx;
    if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  ui() {
    this.tone(880, 0.06, 'square', 0.05);
  }
  buzz() {
    for (let i = 0; i < 3; i++) this.tone(120, 0.12, 'sawtooth', 0.12, 0, i * 0.16);
  }
  coin() {
    this.tone(988, 0.1, 'square', 0.09);
    this.tone(1319, 0.3, 'square', 0.09, 0, 0.08);
  }
  good() {
    [523, 659, 784].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, 0, i * 0.07));
  }
  alarm() {
    for (let i = 0; i < 4; i++) this.tone(i % 2 ? 620 : 880, 0.18, 'sawtooth', 0.08, 0, i * 0.2);
  }
  ping() {
    this.tone(1400, 0.4, 'sine', 0.05, -600);
  }
  shield() {
    this.tone(220, 1.2, 'sawtooth', 0.12, 660);
    this.tone(110, 1.4, 'sine', 0.2, -60, 0.1);
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.07, 0, 0.6 + i * 0.06));
  }
  caught() {
    this.tone(160, 1.2, 'sawtooth', 0.25, -120);
    this.tone(90, 1.4, 'square', 0.15, -40);
  }
  rewind() {
    this.tone(200, 0.8, 'sawtooth', 0.1, 1600);
  }
}
