/** Tiny WebAudio synth: no audio files, starts after first user gesture. */
export class Sfx {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private rain?: AudioBufferSourceNode;
  muted = false;
  /** bus for positional voices (bypasses music ducking) */
  voiceBus: GainNode | null = null;

  start() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(this.ctx.destination);
    this.voiceBus = this.ctx.createGain();
    this.voiceBus.gain.value = 1;
    this.voiceBus.connect(this.ctx.destination);
    this.ambience();
  }
  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.7;
    if (this.voiceBus) this.voiceBus.gain.value = this.muted ? 0 : 1;
    return this.muted;
  }

  private ambience() {
    const c = this.ctx!;
    // rain: filtered noise bed
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
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
    g.gain.value = 0.06;
    src.connect(hp).connect(lp).connect(g).connect(this.master);
    src.start();
    this.rain = src;
    this.music();
  }

  // ------------------------------------------------------------------ adaptive score
  private noise!: AudioBuffer;
  private mus!: GainNode;
  private layers: Record<string, GainNode> = {};
  private echo!: DelayNode;
  private mood: 'calm' | 'tension' | 'void' | 'dawn' | 'off' = 'calm';
  private step = 0;
  private nextAt = 0;
  private duckK = 1;
  private music() {
    const c = this.ctx!;
    this.mus = c.createGain();
    this.mus.gain.value = 0;
    this.mus.gain.linearRampToValueAtTime(0.55, c.currentTime + 3);
    this.mus.connect(this.master);
    // shared echo for arps/bells
    this.echo = c.createDelay(1);
    this.echo.delayTime.value = (60 / 84) * 0.75;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const wet = c.createGain();
    wet.gain.value = 0.35;
    const elp = c.createBiquadFilter();
    elp.type = 'lowpass';
    elp.frequency.value = 2400;
    this.echo.connect(elp).connect(fb).connect(this.echo);
    elp.connect(wet).connect(this.mus);
    for (const k of ['pad', 'bass', 'arp', 'hat', 'kick', 'bell']) {
      const g = c.createGain();
      g.gain.value = 0;
      g.connect(this.mus);
      this.layers[k] = g;
    }
    this.setMood('calm', true);
    this.nextAt = c.currentTime + 0.1;
    setInterval(() => this.schedule(), 25);
  }

  /** calm (night), tension (trace/ambush), void (between loops), dawn (ending) */
  setMood(m: 'calm' | 'tension' | 'void' | 'dawn' | 'off', instant = false) {
    if (!this.ctx || (m === this.mood && !instant)) return;
    this.mood = m;
    const mix: Record<string, Record<string, number>> = {
      calm: { pad: 0.5, bass: 0.35, arp: 0.22, hat: 0.12, kick: 0, bell: 0 },
      tension: { pad: 0.35, bass: 0.7, arp: 0.3, hat: 0.22, kick: 0.6, bell: 0 },
      void: { pad: 0.6, bass: 0, arp: 0, hat: 0, kick: 0, bell: 0.45 },
      dawn: { pad: 0.55, bass: 0.25, arp: 0.28, hat: 0.08, kick: 0, bell: 0.3 },
      off: { pad: 0, bass: 0, arp: 0, hat: 0, kick: 0, bell: 0 },
    };
    const t = this.ctx.currentTime;
    for (const [k, v] of Object.entries(mix[m])) {
      const g = this.layers[k].gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(v, t + (instant ? 0.05 : 2.2));
    }
  }
  /** lower the music under dialogue */
  duck(on: boolean) {
    if (!this.ctx || !this.mus) return;
    this.duckK = on ? 0.38 : 1;
    const t = this.ctx.currentTime;
    this.mus.gain.cancelScheduledValues(t);
    this.mus.gain.setValueAtTime(this.mus.gain.value, t);
    this.mus.gain.linearRampToValueAtTime(0.55 * this.duckK, t + 0.4);
  }

  private schedule() {
    const c = this.ctx!;
    const bpm = this.mood === 'tension' ? 104 : this.mood === 'void' ? 60 : 84;
    const s16 = 60 / bpm / 4;
    while (this.nextAt < c.currentTime + 0.12) {
      this.playStep(this.step, this.nextAt, s16);
      this.nextAt += s16;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number, s16: number) {
    // A minor noir: Am - Fmaj7 - Dm - E ; dawn: C - G - Am - F
    const dawn = this.mood === 'dawn';
    const prog = dawn
      ? [[48, 52, 55, 59], [43, 47, 50, 55], [45, 48, 52, 55], [41, 45, 48, 52]]
      : [[45, 48, 52, 55], [41, 45, 48, 52], [38, 41, 45, 48], [40, 44, 47, 50]];
    const bar = Math.floor(step / 16);
    const chord = prog[bar];
    const s = step % 16;
    const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    if (s === 0) for (const n of chord) this.voice('pad', hz(n + 12), t, s16 * 16 * 1.02, 'sawtooth', 0.05, 900);
    if (s % 2 === 0 && (this.mood !== 'calm' || s % 4 === 0)) this.voice('bass', hz(chord[0] - 12), t, s16 * 1.6, 'sawtooth', 0.22, 420, true);
    const arp = [0, 2, 1, 3, 2, 1, 3, 2];
    if (s % 2 === 0) this.voice('arp', hz(chord[arp[(s / 2) % 8]] + 24), t, s16 * 1.5, 'square', 0.05, 2600, false, true);
    if (s % 4 === 2) this.hat(t, 0.05);
    if (this.mood === 'tension' && s % 4 === 0) this.kick(t);
    if ((this.mood === 'void' || dawn) && (s === 0 || s === 6 || s === 11)) this.voice('bell', hz(chord[(s + bar) % 4] + 36), t, 2.2, 'sine', 0.09, 6000, false, true);
  }

  private voice(layer: string, f: number, t: number, dur: number, type: OscillatorType, vol: number, cutoff: number, pluck = false, echo = false) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    o.detune.value = (Math.random() - 0.5) * 8;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(pluck ? cutoff * 2.2 : cutoff, t);
    if (pluck) lp.frequency.exponentialRampToValueAtTime(cutoff * 0.4, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + (layer === 'pad' ? 1.2 : 0.008));
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur * (layer === 'pad' ? 0.7 : 0.2)));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(this.layers[layer]);
    if (echo) g.connect(this.echo);
    o.start(t);
    o.stop(t + dur + 0.05);
  }
  private hat(t: number, vol: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp).connect(g).connect(this.layers.hat);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  }
  private kick(t: number) {
    const c = this.ctx!;
    const o = c.createOscillator();
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = c.createGain();
    g.gain.setValueAtTime(0.6, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g).connect(this.layers.kick);
    o.start(t);
    o.stop(t + 0.32);
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
  private noiseBuf: AudioBuffer | null = null;
  /** a footstep: short filtered noise thump */
  footstep(vol = 0.08, rate = 1) {
    const c = this.ctx;
    if (!c || !this.master) return;
    if (!this.noiseBuf) {
      const b = c.createBuffer(1, Math.floor(c.sampleRate * 0.09), c.sampleRate);
      const d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
      this.noiseBuf = b;
    }
    const s = c.createBufferSource();
    s.buffer = this.noiseBuf;
    s.playbackRate.value = rate;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = c.createGain();
    g.gain.value = vol;
    s.connect(f).connect(g).connect(this.master);
    s.start();
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
