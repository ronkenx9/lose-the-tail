import * as THREE from 'three';
import { SX, SZ } from './city';

const EYE = 1.62;
const RADIUS = 0.32;
const WALK = 4.2;

export class Player {
  x: number;
  z: number;
  yaw: number;
  pitch = -0.04;
  /** current tap-to-walk path (cell centers) */
  path: { x: number; z: number }[] = [];
  speed = 0;
  bobT = 0;
  frozen = false;
  private keys = new Set<string>();
  private walk: Uint8Array;
  private onArrive?: () => void;

  constructor(walk: Uint8Array, x: number, z: number, yaw: number) {
    this.walk = walk;
    this.x = x;
    this.z = z;
    this.yaw = yaw;
    window.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement)?.closest?.('input,textarea')) return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  walkable(cx: number, cz: number) {
    if (cx < 0 || cz < 0 || cx >= SX || cz >= SZ) return false;
    return this.walk[cx + cz * SX] === 1;
  }

  /** A* on the walk grid then string-pull */
  goTo(tx: number, tz: number, onArrive?: () => void) {
    const sx = Math.floor(this.x),
      sz = Math.floor(this.z);
    let gx = Math.floor(tx),
      gz = Math.floor(tz);
    if (!this.walkable(gx, gz)) {
      // snap goal to nearest walkable cell
      let best: [number, number] | null = null,
        bd = 1e9;
      for (let dz = -4; dz <= 4; dz++)
        for (let dx = -4; dx <= 4; dx++)
          if (this.walkable(gx + dx, gz + dz) && dx * dx + dz * dz < bd) ((bd = dx * dx + dz * dz), (best = [gx + dx, gz + dz]));
      if (!best) return false;
      [gx, gz] = best;
      tx = gx + 0.5;
      tz = gz + 0.5;
    }
    const cells = astar(this.walk, sx, sz, gx, gz);
    if (!cells) return false;
    const pts = cells.map(([x, z]) => ({ x: x + 0.5, z: z + 0.5 }));
    pts[pts.length - 1] = { x: tx, z: tz };
    // string pulling
    const out: { x: number; z: number }[] = [];
    let anchor = { x: this.x, z: this.z };
    let i = 0;
    while (i < pts.length) {
      let j = pts.length - 1;
      while (j > i && !this.lineClear(anchor.x, anchor.z, pts[j].x, pts[j].z)) j--;
      out.push(pts[j]);
      anchor = pts[j];
      i = j + 1;
    }
    this.path = out;
    this.onArrive = onArrive;
    return true;
  }

  stop() {
    this.path = [];
    this.onArrive = undefined;
  }

  private lineClear(x0: number, z0: number, x1: number, z1: number) {
    const d = Math.hypot(x1 - x0, z1 - z0);
    const n = Math.ceil(d * 4);
    for (let k = 0; k <= n; k++) {
      const t = k / Math.max(1, n);
      const x = x0 + (x1 - x0) * t,
        z = z0 + (z1 - z0) * t;
      for (const [ox, oz] of [
        [RADIUS, RADIUS],
        [-RADIUS, RADIUS],
        [RADIUS, -RADIUS],
        [-RADIUS, -RADIUS],
      ])
        if (!this.walkable(Math.floor(x + ox), Math.floor(z + oz))) return false;
    }
    return true;
  }

  update(dt: number) {
    let mx = 0,
      mz = 0;
    if (!this.frozen) {
      const k = this.keys;
      const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const s = (k.has('d') ? 1 : 0) - (k.has('a') ? 1 : 0);
      const turn = (k.has('arrowleft') ? 1 : 0) - (k.has('arrowright') ? 1 : 0);
      this.yaw += turn * dt * 2.2;
      if (f || s) {
        this.stop();
        const fx = -Math.sin(this.yaw),
          fz = -Math.cos(this.yaw);
        const rx = Math.cos(this.yaw),
          rz = -Math.sin(this.yaw);
        mx = fx * f + rx * s;
        mz = fz * f + rz * s;
        const l = Math.hypot(mx, mz);
        mx /= l;
        mz /= l;
      } else if (this.path.length) {
        const p = this.path[0];
        const dx = p.x - this.x,
          dz = p.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) {
          this.path.shift();
          if (!this.path.length) {
            const cb = this.onArrive;
            this.onArrive = undefined;
            cb?.();
          }
        } else {
          mx = dx / d;
          mz = dz / d;
          // turn the view toward travel direction smoothly
          const want = Math.atan2(-mx, -mz);
          let dy = want - this.yaw;
          dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          this.yaw += dy * Math.min(1, dt * 5);
        }
      }
    }
    const target = mx || mz ? WALK : 0;
    this.speed += (target - this.speed) * Math.min(1, dt * 10);
    if (mx || mz) {
      this.move(mx * this.speed * dt, 0);
      this.move(0, mz * this.speed * dt);
    }
    this.bobT += dt * this.speed * 2.1;
  }

  private move(dx: number, dz: number) {
    const nx = this.x + dx,
      nz = this.z + dz;
    for (const [ox, oz] of [
      [RADIUS, RADIUS],
      [-RADIUS, RADIUS],
      [RADIUS, -RADIUS],
      [-RADIUS, -RADIUS],
    ])
      if (!this.walkable(Math.floor(nx + ox), Math.floor(nz + oz))) return;
    this.x = nx;
    this.z = nz;
  }

  applyCamera(cam: THREE.PerspectiveCamera) {
    const bob = Math.sin(this.bobT) * 0.045 * Math.min(1, this.speed / WALK);
    cam.position.set(this.x, 1 + EYE + bob, this.z);
    cam.rotation.order = 'YXZ';
    cam.rotation.y = this.yaw;
    cam.rotation.x = this.pitch;
    cam.rotation.z = Math.sin(this.bobT * 0.5) * 0.004 * Math.min(1, this.speed / WALK);
  }
}

export function astar(walk: Uint8Array, sx: number, sz: number, gx: number, gz: number): [number, number][] | null {
  const W = SX,
    H = SZ;
  const ok = (x: number, z: number) => x >= 0 && z >= 0 && x < W && z < H && walk[x + z * W] === 1;
  if (!ok(gx, gz)) return null;
  const g = new Float32Array(W * H).fill(Infinity);
  const came = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const open: number[] = [];
  const f = new Float32Array(W * H).fill(Infinity);
  const start = sx + sz * W,
    goal = gx + gz * W;
  g[start] = 0;
  f[start] = Math.hypot(gx - sx, gz - sz);
  open.push(start);
  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
  let iter = 0;
  while (open.length && iter++ < 20000) {
    let bi = 0;
    for (let k = 1; k < open.length; k++) if (f[open[k]] < f[open[bi]]) bi = k;
    const cur = open[bi];
    open[bi] = open[open.length - 1];
    open.pop();
    if (cur === goal) {
      const out: [number, number][] = [];
      let c = cur;
      while (c !== -1) {
        out.push([c % W, Math.floor(c / W)]);
        c = came[c];
      }
      return out.reverse();
    }
    closed[cur] = 1;
    const cx = cur % W,
      cz = Math.floor(cur / W);
    for (const [dx, dz, cost] of dirs) {
      const nx = cx + dx,
        nz = cz + dz;
      if (!ok(nx, nz)) continue;
      if (dx && dz && (!ok(cx + dx, cz) || !ok(cx, cz + dz))) continue;
      const ni = nx + nz * W;
      if (closed[ni]) continue;
      const ng = g[cur] + cost;
      if (ng < g[ni]) {
        if (g[ni] === Infinity) open.push(ni);
        g[ni] = ng;
        came[ni] = cur;
        f[ni] = ng + Math.hypot(gx - nx, gz - nz);
      }
    }
  }
  return null;
}
