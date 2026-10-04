import * as THREE from 'three';

/** 3D positional voice: the line comes from the speaker's head, louder when you're close. */
export class Voice {
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  constructor(private getCtx: () => AudioContext | null, private out: () => AudioNode | null) {}

  private load(url: string) {
    let p = this.buffers.get(url);
    if (!p) {
      const ctx = this.getCtx();
      if (!ctx) return Promise.resolve(null);
      p = fetch(url)
        .then((r) => r.arrayBuffer())
        .then((b) => ctx.decodeAudioData(b))
        .catch(() => null);
      this.buffers.set(url, p);
    }
    return p;
  }
  preload(urls: string[]) {
    urls.forEach((u) => this.load(u));
  }

  /** play a voice clip positioned at `at()` (updated every frame); radio=true adds a comms band-pass */
  async play(url: string, at: (() => THREE.Vector3) | null, opts: { radio?: boolean; gain?: number } = {}) {
    const ctx = this.getCtx();
    const dest = this.out();
    if (!ctx || !dest) return null;
    const buf = await this.load(url);
    if (!buf) return null;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = opts.gain ?? 1.3;
    let node: AudioNode = src;
    if (opts.radio) {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1500;
      bp.Q.value = 0.7;
      node.connect(bp);
      node = bp;
    }
    let panner: PannerNode | null = null;
    if (at) {
      panner = ctx.createPanner();
      panner.panningModel = 'HRTF';
      panner.distanceModel = 'inverse';
      panner.refDistance = 2.5;
      panner.rolloffFactor = 1.1;
      panner.maxDistance = 60;
      node.connect(panner);
      node = panner;
    }
    node.connect(g).connect(dest);
    src.start();
    let raf = 0;
    const tick = () => {
      if (panner && at) {
        const p = at();
        panner.positionX.value = p.x;
        panner.positionY.value = p.y;
        panner.positionZ.value = p.z;
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return {
      duration: buf.duration,
      ended: new Promise<void>((res) => (src.onended = () => (cancelAnimationFrame(raf), res()))),
      stop: () => {
        try {
          src.onended = null;
          src.stop();
        } catch {}
        cancelAnimationFrame(raf);
      },
      setPaused: (p: boolean) => (g.gain.value = p ? 0 : opts.gain ?? 1.3),
    };
  }

  /** keep the listener on the camera */
  updateListener(cam: THREE.Camera) {
    const ctx = this.getCtx();
    if (!ctx) return;
    const l = ctx.listener;
    const f = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const u = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
    if (l.positionX) {
      l.positionX.value = cam.position.x;
      l.positionY.value = cam.position.y;
      l.positionZ.value = cam.position.z;
      l.forwardX.value = f.x;
      l.forwardY.value = f.y;
      l.forwardZ.value = f.z;
      l.upX.value = u.x;
      l.upY.value = u.y;
      l.upZ.value = u.z;
    }
  }
}
