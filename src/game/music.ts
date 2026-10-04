export const TRACKS = ['caves', 'currents', 'simulation-unknown'];
/** Shuffle bag: each track once per round, no repeat at round boundaries. */
export class ShuffleBag {
  private bag: string[] = [];
  private last = '';
  constructor(private tracks: string[], private random = Math.random) {}
  next(): string | undefined {
    if (!this.bag.length) {
      this.bag = [...new Set(this.tracks)];
      for (let i = this.bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      const end = this.bag.length - 1;
      if (end > 0 && this.bag[end] === this.last) [this.bag[0], this.bag[end]] = [this.bag[end], this.bag[0]];
    }
    const track = this.bag.pop();
    if (track) this.last = track;
    return track;
  }
}
export class MusicPlaylist {
  readonly audio = new Audio();
  private bag = new ShuffleBag(TRACKS);
  private failed = new Set<string>();
  private current = '';
  private gain: GainNode;
  constructor(private ctx: AudioContext, bus: AudioNode) {
    this.gain = ctx.createGain();
    ctx.createMediaElementSource(this.audio).connect(this.gain).connect(bus);
    this.audio.preload = 'auto';
    this.audio.onended = () => this.next();
    this.audio.onerror = () => { this.failed.add(this.current); this.next(); };
    this.audio.onplaying = () => {
      const t = ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.setValueAtTime(0, t);
      this.gain.gain.linearRampToValueAtTime(1, t + 1.5);
    };
  }
  start() { if (!this.current) this.next(); else this.resume(); }
  private resume() { void this.ctx.resume().then(() => this.audio.play()).catch(() => {}); }
  private next() {
    if (this.failed.size >= TRACKS.length) return;
    let track = this.bag.next();
    while (track && this.failed.has(track)) track = this.bag.next();
    if (!track) return;
    this.current = track;
    this.audio.src = `/music/${track}.mp3`;
    this.resume();
  }
}
