import * as THREE from 'three';
import { Zero } from '../engine/characters';
import type { Player } from '../engine/player';

/** Zero, physically present: floats near your shoulder, turns to face you, can be sent to a spot. */
export class Companion {
  zero = new Zero();
  visible = false;
  private pos = new THREE.Vector3();
  private hold: THREE.Vector3 | null = null;
  constructor(scene: THREE.Scene, private player: Player) {
    this.zero.group.visible = false;
    this.zero.group.scale.setScalar(0.62);
    scene.add(this.zero.group);
  }
  show(at?: { x: number; z: number }) {
    this.visible = true;
    this.zero.group.visible = true;
    if (at) {
      this.hold = new THREE.Vector3(at.x, 1.35, at.z);
      this.pos.copy(this.hold);
    } else this.hold = null;
  }
  hide() {
    this.visible = false;
    this.zero.group.visible = false;
  }
  /** stop following and wait at a point */
  stay(at: { x: number; z: number }) {
    this.hold = new THREE.Vector3(at.x, 1.35, at.z);
  }
  follow() {
    this.hold = null;
  }
  head() {
    return this.zero.group.position.clone().add(new THREE.Vector3(0, 0.9, 0));
  }
  update(dt: number, cam: THREE.Camera) {
    if (!this.visible) return;
    const p = this.player;
    let target: THREE.Vector3;
    if (this.hold) target = this.hold;
    else {
      // just ahead and to the right of where you're looking, at shoulder height
      const f = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
      const r = new THREE.Vector3(Math.cos(p.yaw), 0, -Math.sin(p.yaw));
      // off your right shoulder, a little ahead, floating: in view but never in the way
      let k = 1;
      target = new THREE.Vector3();
      for (; k > 0.3; k -= 0.15) {
        target.set(p.x, 1.55, p.z).addScaledVector(f, 1.5 * k).addScaledVector(r, 1.35 * k);
        if (p.walkable(Math.floor(target.x), Math.floor(target.z))) break;
      }
      target.y += Math.sin(performance.now() / 900) * 0.06;
    }
    this.pos.lerp(target, Math.min(1, dt * (this.hold ? 3 : 2.2)));
    this.zero.group.position.copy(this.pos);
    // face the camera
    const dx = cam.position.x - this.pos.x,
      dz = cam.position.z - this.pos.z;
    const want = Math.atan2(dx, dz);
    const cur = this.zero.group.rotation.y;
    this.zero.group.rotation.y = cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur)) * Math.min(1, dt * 5);
    this.zero.update(dt);
  }
}
