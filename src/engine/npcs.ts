import * as THREE from 'three';
import { Character, HEADS, Trails, headByRole, type HeadMeta } from './characters';
import { astar } from './player';
import { rng, SX, SZ, type City } from './city';
import type { VoxelWorld } from './voxels';

export interface Npc {
  ch: Character;
  x: number;
  z: number;
  path: { x: number; z: number }[];
  role: string;
  /** stationary NPCs face this yaw when idle */
  idleYaw?: number;
  wander: boolean;
  wait: number;
  speedMul: number;
  /** a target someone else (story) set */
  onArrive?: () => void;
  name?: string;
}

const tmp = new THREE.Color();

export class Npcs {
  list: Npc[] = [];
  private r = rng(99);
  trails: Trails;
  extra: Character[] = [];
  constructor(
    private scene: THREE.Scene,
    private city: City,
  ) {
    this.trails = new Trails(scene);
  }

  spawn(head: HeadMeta, x: number, z: number, opts: Partial<Npc> = {}) {
    const ch = new Character(head);
    ch.group.position.set(x, 1, z);
    this.scene.add(ch.group);
    const n: Npc = { ch, x, z, path: [], role: head.role, wander: false, wait: 0, speedMul: 1, ...opts };
    if (n.idleYaw !== undefined) ch.yaw = n.idleYaw;
    this.list.push(n);
    return n;
  }

  spawnRole(role: string, x: number, z: number, opts: Partial<Npc> = {}) {
    return this.spawn(headByRole(role), x, z, opts);
  }

  spawnCrowd(n: number) {
    const crowd = HEADS.filter((h) => h.role === 'crowd');
    for (let i = 0; i < n; i++) {
      const head = crowd[i % crowd.length];
      const p = this.randomSidewalk();
      const n = this.spawn(head, p.x, p.z, { wander: true, wait: this.r() * 4, speedMul: 0.55 + this.r() * 0.35 });
      if (this.r() < 0.4) {
        const cols = [0x1b1d24, 0x2a0d12, 0x0f2a24, 0x2b1640, 0xf4b728, 0x14303d];
        n.ch.addUmbrella(new THREE.Color(cols[Math.floor(this.r() * cols.length)]));
      }
    }
  }

  randomSidewalk() {
    const w = this.city.world;
    for (let k = 0; k < 400; k++) {
      const x = Math.floor(this.r() * SX),
        z = Math.floor(this.r() * SZ);
      if (!this.city.walk[x + z * SX]) continue;
      const b = w.get(x, 0, z);
      if (b === 2 || b === 27) return { x: x + 0.5, z: z + 0.5 };
    }
    return { x: 48, z: 45 };
  }

  send(n: Npc, tx: number, tz: number, onArrive?: () => void) {
    const cells = astar(this.city.walk, Math.floor(n.x), Math.floor(n.z), Math.floor(tx), Math.floor(tz));
    if (!cells) return false;
    n.path = cells.map(([x, z]) => ({ x: x + 0.5 + (this.r() - 0.5) * 0.3, z: z + 0.5 + (this.r() - 0.5) * 0.3 }));
    n.path[n.path.length - 1] = { x: tx, z: tz };
    // don't walk back to the centre of the cell we're already standing in
    if (n.path.length > 1) n.path.shift();
    n.onArrive = onArrive;
    return true;
  }

  remove(n: Npc) {
    this.scene.remove(n.ch.group);
    n.ch.dispose();
    this.list = this.list.filter((o) => o !== n);
  }

  update(dt: number, world: VoxelWorld, camPos: THREE.Vector3) {
    for (const n of this.list) {
      if (!n.path.length && n.wander) {
        n.wait -= dt;
        if (n.wait <= 0) {
          const p = this.randomSidewalk();
          if (Math.hypot(p.x - n.x, p.z - n.z) < 40) this.send(n, p.x, p.z);
          n.wait = 2 + this.r() * 6;
        }
      }
      let moving = false;
      if (n.path.length) {
        const p = n.path[0];
        const dx = p.x - n.x,
          dz = p.z - n.z;
        const d = Math.hypot(dx, dz);
        const sp = 2.4 * n.speedMul;
        if (d < 0.1) {
          n.path.shift();
          if (!n.path.length) {
            const cb = n.onArrive;
            n.onArrive = undefined;
            cb?.();
            if (n.idleYaw !== undefined) n.ch.yaw = n.idleYaw;
          }
        } else {
          const step = Math.min(d, sp * dt);
          let mx = dx / d,
            mz = dz / d;
          // personal space: passers-by sidestep you instead of walking through your face
          if (n.wander) {
            const ox = camPos.x - n.x,
              oz = camPos.z - n.z;
            const od = Math.hypot(ox, oz);
            if (od < 1.6 && (ox * mx + oz * mz) / od > 0.2) {
              const side = ox * mz - oz * mx > 0 ? -1 : 1;
              const px = -mz * side,
                pz = mx * side;
              mx = mx * 0.4 + px * 0.9;
              mz = mz * 0.4 + pz * 0.9;
              const l = Math.hypot(mx, mz) || 1;
              mx /= l;
              mz /= l;
            }
          }
          const nx = n.x + mx * step,
            nz = n.z + mz * step;
          if (this.city.walk[Math.floor(nx) + Math.floor(nz) * SX]) {
            n.x = nx;
            n.z = nz;
          } else {
            n.x += (dx / d) * step;
            n.z += (dz / d) * step;
          }
          const want = Math.atan2(-dz, dx);
          let dy = want - n.ch.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          n.ch.yaw += dy * Math.min(1, dt * 8);
          moving = true;
        }
      }
      n.ch.speed += ((moving ? 1 : 0) - n.ch.speed) * Math.min(1, dt * 8);
      n.ch.group.position.set(n.x, 1, n.z);
      // distance cull animation + lighting for far npcs
      const far = Math.hypot(n.x - camPos.x, n.z - camPos.z) > 45;
      n.ch.group.visible = !far;
      if (far) continue;
      world.lightAt(n.x, 1.5, n.z, tmp);
      n.ch.setLight(tmp);
      n.ch.update(dt);
    }
  }

  updateTrails(dt: number, camPos: THREE.Vector3) {
    this.trails.update(dt, [...this.list.map((n) => n.ch), ...this.extra], camPos);
  }

  /** nearest npc hit by a ray (cylinder test) */
  pick(ray: THREE.Ray, maxDist = 30): Npc | null {
    let best: Npc | null = null,
      bd = maxDist;
    const p = new THREE.Vector3();
    for (const n of this.list) {
      if (!n.ch.group.visible) continue;
      p.set(n.x, 1.9, n.z);
      const t = ray.closestPointToPoint(p, new THREE.Vector3()).distanceTo(ray.origin);
      const dist = ray.distanceToPoint(p);
      if (dist < 0.75 && t < bd) {
        bd = t;
        best = n;
      }
    }
    return best;
  }
}
