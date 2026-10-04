import * as THREE from 'three';
import type { Player } from '../engine/player';

/**
 * Wake-up: the camera lies in bed looking at the ceiling, the phone buzzes on the
 * nightstand, the player taps it, sits up, and the phone flies into their hand.
 */
interface Pose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  roll: number;
}

export class Intro {
  phone: THREE.Group;
  private screen: THREE.Mesh;
  active = false;
  /** called on every buzz pulse (sound) */
  onPulse: (() => void) | null = null;
  private lastPulse = -1;
  buzzing = false;
  private t = 0;
  private picked: (() => void) | null = null;
  private cam: Pose = { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, roll: 0 };
  private anim: { t: number; dur: number; from: Pose; to: Pose; done: () => void } | null = null;

  constructor(
    private scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private player: Player,
    private bed: { x: number; z: number },
    private nightstand: { x: number; z: number },
  ) {
    this.phone = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.012, 0.17), new THREE.MeshBasicMaterial({ color: 0x15181a }));
    this.screen = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.002, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.25, 0.3) }));
    this.screen.position.y = 0.007;
    this.phone.add(body, this.screen);
    // a glow plane so the buzz reads from the bed
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0xf4b728, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    glow.rotation.x = -Math.PI / 2;
    glow.position.y = 0.01;
    glow.name = 'glow';
    this.phone.add(glow);
    this.resetPhone();
    scene.add(this.phone);
  }

  resetPhone() {
    this.phone.visible = true;
    this.phone.position.set(this.nightstand.x + 0.5, 1 + 10 / 16 + 0.01, this.nightstand.z + 0.55);
    this.phone.rotation.set(0, 0.4, 0);
  }

  /** lie in bed, phone dark; resolves when the player taps the phone */
  async wake(onBuzz: () => void): Promise<void> {
    this.active = true;
    this.player.frozen = true;
    this.player.stop();
    this.resetPhone();
    // lying: head on the pillow, looking up at the ceiling
    const hx = this.bed.x,
      hy = 1.92,
      hz = this.bed.z - 0.15;
    const ph = this.phone.position;
    const dx = ph.x - hx,
      dz = ph.z - hz;
    const yaw = Math.atan2(-dx, -dz);
    const pitch = Math.atan2(ph.y - hy, Math.hypot(dx, dz));
    this.cam = { x: hx, y: hy, z: hz, yaw: yaw + 0.5, pitch: 1.3, roll: 0.1 };
    await this.sleep(1800);
    // the buzz: roll the head over toward the nightstand
    const picked = new Promise<void>((res) => (this.picked = res));
    this.buzzing = true;
    onBuzz();
    await this.tween({ x: hx + 0.05, y: hy, z: hz, yaw, pitch: pitch + 0.1, roll: -0.35 }, 1.8);
    return picked;
  }

  /** called from the tap handler; true if the ray hit the phone */
  tryTap(ray: THREE.Ray) {
    if (!this.active || !this.buzzing) return false;
    // generous: anywhere roughly toward the nightstand counts
    const to = this.phone.position.clone().sub(ray.origin).normalize();
    if (to.angleTo(ray.direction) > 0.45) return false;
    this.pick();
    return true;
  }
  /** keyboard: E / Space picks up the phone */
  pickKey() {
    if (!this.active || !this.buzzing) return false;
    this.pick();
    return true;
  }

  private async pick() {
    this.buzzing = false;
    const cb = this.picked;
    this.picked = null;
    // phone flies to the hand while we sit up and swing the legs out of bed
    const p0 = this.phone.position.clone();
    const t0 = performance.now();
    const fly = () => {
      const k = Math.min(1, (performance.now() - t0) / 700);
      const target = this.camera.position.clone().add(new THREE.Vector3(0.18, -0.25, -0.45).applyQuaternion(this.camera.quaternion));
      this.phone.position.lerpVectors(p0, target, k * k);
      if (k < 1) requestAnimationFrame(fly);
      else this.phone.visible = false;
    };
    fly();
    const sp = this.player;
    await this.tween({ x: sp.x, y: 2.62, z: sp.z, yaw: sp.yaw, pitch: -0.05, roll: 0 }, 1.5);
    this.active = false;
    sp.frozen = false;
    cb?.();
  }

  update(dt: number) {
    this.t += dt;
    const g = this.phone.getObjectByName('glow') as THREE.Mesh;
    const m = g.material as THREE.MeshBasicMaterial;
    const sm = this.screen.material as THREE.MeshBasicMaterial;
    if (this.buzzing) {
      const cyc = Math.floor(this.t / 1.2);
      if (cyc !== this.lastPulse) {
        this.lastPulse = cyc;
        this.onPulse?.();
      }
      const pulse = Math.sin(this.t * 18) > 0 && this.t % 1.2 < 0.6;
      this.phone.position.x = this.nightstand.x + 0.5 + (pulse ? Math.sin(this.t * 90) * 0.006 : 0);
      m.opacity = 0.35 + Math.sin(this.t * 6) * 0.2;
      sm.color.setRGB(1.6, 1.3, 0.5);
    } else {
      m.opacity = 0;
      sm.color.setRGB(0.2, 0.25, 0.3);
    }
    if (this.anim) {
      const a = this.anim;
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      for (const key of Object.keys(this.cam) as (keyof Pose)[]) this.cam[key] = a.from[key] + (a.to[key] - a.from[key]) * e;
      if (k >= 1) {
        this.anim = null;
        a.done();
      }
    }
  }

  /** while active, the intro owns the camera */
  applyCamera() {
    if (!this.active) return false;
    const c = this.camera;
    c.position.set(this.cam.x, this.cam.y, this.cam.z);
    c.rotation.order = 'YXZ';
    c.rotation.set(this.cam.pitch, this.cam.yaw, this.cam.roll);
    return true;
  }

  private tween(to: Pose, dur: number) {
    // a new move supersedes the old one; let whoever awaited the old one carry on
    const prev = this.anim;
    this.anim = null;
    prev?.done();
    return new Promise<void>((done) => (this.anim = { t: 0, dur, from: { ...this.cam }, to, done }));
  }
  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
