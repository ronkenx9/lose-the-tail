import * as THREE from 'three';

/** Block palette. id 0 = air. Colors are linear-ish sRGB 0..1. */
export interface BlockDef {
  color: [number, number, number];
  /** emissive blocks render at full brightness and seed block light */
  emit?: [number, number, number];
  /** per-block brightness jitter for texture */
  jitter?: number;
  /** render brightness multiplier for emissive blocks (bloom picks up > 1) */
  glow?: number;
}

export const B = {
  AIR: 0,
  ASPHALT: 1,
  SIDEWALK: 2,
  CURB: 3,
  LINE: 4,
  CONCRETE: 5,
  BRICK: 6,
  DARKBRICK: 7,
  GLASS_DARK: 8,
  WIN_WARM: 9,
  WIN_COOL: 10,
  TRIM: 11,
  METAL: 12,
  NEON_PINK: 13,
  NEON_CYAN: 14,
  NEON_MINT: 15,
  NEON_AMBER: 16,
  NEON_RED: 17,
  NEON_VIOLET: 18,
  WOOD: 19,
  ROOF: 20,
  STONE: 21,
  PANEL_BLUE: 22,
  PANEL_GREEN: 23,
  LAMP: 24,
  SCREEN_OFF: 25,
  PUDDLE: 26,
  TILE: 27,
  NEON_ZEC: 28,
  LEAF: 29,
  GLASS: 30,
  FLOOR_WOOD: 31,
  CARPET: 32,
  PLASTER: 33,
  SHEET: 34,
  COUNTER: 35,
  TILE_DARK: 36,
  ARCADE_FLOOR: 37,
  CEILING: 38,
  PANEL_LIGHT: 39,
  RUG_RED: 40,
  CEIL_WARM: 41,
  CEIL_COOL: 42,
} as const;

/** blocks you can see (and light can pass) through */
export const TRANSPARENT = new Set<number>([0, 30]);
export const isOpaque = (b: number) => !TRANSPARENT.has(b);

export const PALETTE: BlockDef[] = [];
const def = (id: number, d: BlockDef) => (PALETTE[id] = d);
def(B.AIR, { color: [0, 0, 0] });
def(B.ASPHALT, { color: [0.11, 0.115, 0.13], jitter: 0.12 });
def(B.SIDEWALK, { color: [0.3, 0.3, 0.32], jitter: 0.08 });
def(B.CURB, { color: [0.45, 0.45, 0.47], jitter: 0.05 });
def(B.LINE, { color: [0.42, 0.4, 0.33], jitter: 0.05 });
def(B.CONCRETE, { color: [0.36, 0.36, 0.39], jitter: 0.1 });
def(B.BRICK, { color: [0.42, 0.2, 0.17], jitter: 0.14 });
def(B.DARKBRICK, { color: [0.2, 0.13, 0.14], jitter: 0.14 });
def(B.GLASS_DARK, { color: [0.07, 0.09, 0.13], jitter: 0.06 });
def(B.WIN_WARM, { color: [1, 0.74, 0.4], emit: [0.55, 0.36, 0.16], glow: 0.85, jitter: 0.25 });
def(B.WIN_COOL, { color: [0.5, 0.75, 1], emit: [0.2, 0.36, 0.6], glow: 0.8, jitter: 0.25 });
def(B.TRIM, { color: [0.24, 0.24, 0.27], jitter: 0.06 });
def(B.METAL, { color: [0.32, 0.35, 0.38], jitter: 0.08 });
def(B.NEON_PINK, { glow: 2.6, color: [1, 0.25, 0.75], emit: [1, 0.15, 0.7] });
def(B.NEON_CYAN, { glow: 2.6, color: [0.2, 0.95, 1], emit: [0.1, 0.85, 1] });
def(B.NEON_MINT, { glow: 2.6, color: [0.78, 1, 0.86], emit: [0.55, 1, 0.7] });
def(B.NEON_AMBER, { glow: 2.6, color: [1, 0.75, 0.2], emit: [1, 0.6, 0.1] });
def(B.NEON_RED, { glow: 2.6, color: [1, 0.15, 0.15], emit: [1, 0.08, 0.08] });
def(B.NEON_VIOLET, { glow: 2.6, color: [0.62, 0.35, 1], emit: [0.5, 0.25, 1] });
def(B.WOOD, { color: [0.35, 0.22, 0.13], jitter: 0.12 });
def(B.ROOF, { color: [0.16, 0.16, 0.18], jitter: 0.1 });
def(B.STONE, { color: [0.28, 0.27, 0.3], jitter: 0.15 });
def(B.PANEL_BLUE, { color: [0.12, 0.17, 0.3], jitter: 0.08 });
def(B.PANEL_GREEN, { color: [0.1, 0.22, 0.18], jitter: 0.08 });
def(B.LAMP, { glow: 2.4, color: [1, 0.92, 0.75], emit: [1, 0.82, 0.55] });
def(B.SCREEN_OFF, { color: [0.03, 0.03, 0.04] });
def(B.PUDDLE, { color: [0.14, 0.16, 0.22], jitter: 0.05 });
def(B.TILE, { color: [0.22, 0.2, 0.24], jitter: 0.1 });
def(B.LEAF, { color: [0.16, 0.36, 0.2], jitter: 0.3 });
def(B.GLASS, { color: [0.55, 0.7, 0.8] });
def(B.FLOOR_WOOD, { color: [0.42, 0.28, 0.17], jitter: 0.16 });
def(B.CARPET, { color: [0.2, 0.22, 0.3], jitter: 0.06 });
def(B.PLASTER, { color: [0.62, 0.6, 0.56], jitter: 0.05 });
def(B.SHEET, { color: [0.86, 0.86, 0.9], jitter: 0.04 });
def(B.COUNTER, { color: [0.3, 0.2, 0.14], jitter: 0.1 });
def(B.TILE_DARK, { color: [0.17, 0.17, 0.2], jitter: 0.12 });
def(B.ARCADE_FLOOR, { color: [0.16, 0.08, 0.24], jitter: 0.25 });
def(B.CEILING, { color: [0.24, 0.24, 0.26], jitter: 0.04 });
def(B.PANEL_LIGHT, { glow: 1.4, color: [0.95, 0.97, 1], emit: [0.75, 0.78, 0.85] });
def(B.RUG_RED, { color: [0.5, 0.12, 0.12], jitter: 0.1 });
def(B.CEIL_WARM, { glow: 1.25, color: [1, 0.86, 0.66], emit: [1, 0.8, 0.56] });
def(B.CEIL_COOL, { glow: 1.25, color: [0.86, 0.94, 1], emit: [0.82, 0.92, 1] });
def(B.NEON_ZEC, { glow: 1.7, color: [0.96, 0.72, 0.16], emit: [1, 0.7, 0.12] });

const LIGHT_MAX = 15;

/** palette authored in sRGB; renderer works in linear */
const LINEAR: [number, number, number][] = [];
function linearize() {
  const c = new THREE.Color();
  PALETTE.forEach((d, i) => {
    c.setRGB(d.color[0], d.color[1], d.color[2], THREE.SRGBColorSpace);
    LINEAR[i] = [c.r, c.g, c.b];
  });
}

export class VoxelWorld {
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly data: Uint8Array;
  /** colored block light, 0..15 per channel */
  readonly lr: Uint8Array;
  readonly lg: Uint8Array;
  readonly lb: Uint8Array;
  /** per-cell sky exposure (1 = sees sky) */
  readonly sky: Uint8Array;

  constructor(sx: number, sy: number, sz: number) {
    this.sx = sx;
    this.sy = sy;
    this.sz = sz;
    const n = sx * sy * sz;
    this.data = new Uint8Array(n);
    this.lr = new Uint8Array(n);
    this.lg = new Uint8Array(n);
    this.lb = new Uint8Array(n);
    this.sky = new Uint8Array(n);
  }

  idx(x: number, y: number, z: number) {
    return x + z * this.sx + y * this.sx * this.sz;
  }
  inside(x: number, y: number, z: number) {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }
  get(x: number, y: number, z: number) {
    if (!this.inside(x, y, z)) return 0;
    return this.data[this.idx(x, y, z)];
  }
  set(x: number, y: number, z: number, b: number) {
    if (!this.inside(x, y, z)) return;
    this.data[this.idx(x, y, z)] = b;
  }
  fill(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, b: number) {
    for (let y = Math.max(0, y0); y <= Math.min(this.sy - 1, y1); y++)
      for (let z = Math.max(0, z0); z <= Math.min(this.sz - 1, z1); z++)
        for (let x = Math.max(0, x0); x <= Math.min(this.sx - 1, x1); x++) this.data[this.idx(x, y, z)] = b;
  }
  solid(x: number, y: number, z: number) {
    return this.get(x, y, z) !== 0;
  }
  opaque(x: number, y: number, z: number) {
    return isOpaque(this.get(x, y, z));
  }

  /** Minecraft-style flood fill: sky light straight down + colored block light BFS. */
  computeLight() {
    const { sx, sy, sz } = this;
    this.sky.fill(0);
    for (let z = 0; z < sz; z++)
      for (let x = 0; x < sx; x++) {
        for (let y = sy - 1; y >= 0; y--) {
          const i = this.idx(x, y, z);
          if (isOpaque(this.data[i])) break;
          this.sky[i] = 1;
        }
      }
    const chans: [Uint8Array, 0 | 1 | 2][] = [
      [this.lr, 0],
      [this.lg, 1],
      [this.lb, 2],
    ];
    const qx = new Int32Array(sx * sy * sz);
    for (const [arr, c] of chans) {
      arr.fill(0);
      let head = 0;
      let tail = 0;
      // seed: air cells adjacent to emissive blocks
      for (let y = 0; y < sy; y++)
        for (let z = 0; z < sz; z++)
          for (let x = 0; x < sx; x++) {
            const b = this.data[this.idx(x, y, z)];
            const e = PALETTE[b]?.emit;
            if (!e) continue;
            const lvl = Math.round(e[c] * LIGHT_MAX);
            if (lvl <= 1) continue;
            const nb = [
              [1, 0, 0],
              [-1, 0, 0],
              [0, 1, 0],
              [0, -1, 0],
              [0, 0, 1],
              [0, 0, -1],
            ];
            for (const [dx, dy, dz] of nb) {
              const nx = x + dx,
                ny = y + dy,
                nz = z + dz;
              if (!this.inside(nx, ny, nz)) continue;
              const ni = this.idx(nx, ny, nz);
              if (isOpaque(this.data[ni])) continue;
              if (arr[ni] < lvl - 1) {
                arr[ni] = lvl - 1;
                qx[tail++] = ni;
              }
            }
          }
      const sxz = sx * sz;
      while (head < tail) {
        const i = qx[head++];
        const l = arr[i];
        if (l <= 1) continue;
        const x = i % sx;
        const z = Math.floor(i / sx) % sz;
        const y = Math.floor(i / sxz);
        const tryN = (ni: number) => {
          if (isOpaque(this.data[ni])) return;
          if (arr[ni] < l - 1) {
            arr[ni] = l - 1;
            qx[tail++] = ni;
          }
        };
        if (x > 0) tryN(i - 1);
        if (x < sx - 1) tryN(i + 1);
        if (z > 0) tryN(i - sx);
        if (z < sz - 1) tryN(i + sx);
        if (y > 0) tryN(i - sxz);
        if (y < sy - 1) tryN(i + sxz);
      }
    }
  }

  /** light color at an air cell, as linear multiplier */
  lightAt(x: number, y: number, z: number, out = new THREE.Color()) {
    const xi = Math.floor(x),
      yi = Math.floor(y),
      zi = Math.floor(z);
    if (!this.inside(xi, yi, zi)) return out.setRGB(AMB[0], AMB[1], AMB[2]);
    const i = this.idx(xi, yi, zi);
    const s = this.sky[i] ? 1 : 0.55;
    return out.setRGB(
      AMB[0] * s + LCURVE[this.lr[i]],
      AMB[1] * s + LCURVE[this.lg[i]],
      AMB[2] * s + LCURVE[this.lb[i]],
    );
  }
}

/** night ambient (moonlit blue) */
export const AMB: [number, number, number] = [0.05, 0.058, 0.11];
/** light level -> brightness curve */
export const LCURVE = Array.from({ length: LIGHT_MAX + 1 }, (_, l) => Math.pow(l / LIGHT_MAX, 2.2) * 1.5);

function hash3(x: number, y: number, z: number) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

// face definitions: normal, 4 corners (CCW from outside)
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], shade: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], shade: 0.8 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], shade: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], shade: 0.5 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], shade: 0.9 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], shade: 0.9 },
] as const;

/**
 * Build chunk meshes with baked colored light + per-vertex ambient occlusion.
 * Emissive blocks get their own unlit bright colors so bloom picks them up.
 */
const glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.35, 0.5, 0.62), transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide });
export function buildMeshes(w: VoxelWorld, chunk = 32): THREE.Group {
  linearize();
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
  const col = new THREE.Color();
  for (let cz = 0; cz < w.sz; cz += chunk)
    for (let cx = 0; cx < w.sx; cx += chunk) {
      const pos: number[] = [];
      const colr: number[] = [];
      const idxs: number[] = [];
      let v = 0;
      const gpos: number[] = [];
      const gidx: number[] = [];
      let gv = 0;
      for (let y = 0; y < w.sy; y++)
        for (let z = cz; z < Math.min(w.sz, cz + chunk); z++)
          for (let x = cx; x < Math.min(w.sx, cx + chunk); x++) {
            const b = w.data[w.idx(x, y, z)];
            if (b === 0) continue;
            if (b === B.GLASS) {
              for (const f of FACES) {
                const nb = w.get(x + f.n[0], y + f.n[1], z + f.n[2]);
                if (nb === B.GLASS || isOpaque(nb)) continue;
                for (const c of f.c) gpos.push(x + c[0], y + c[1], z + c[2]);
                gidx.push(gv, gv + 1, gv + 2, gv, gv + 2, gv + 3);
                gv += 4;
              }
              continue;
            }
            const d = PALETTE[b];
            const lc = LINEAR[b];
            const j = d.jitter ? 1 + (hash3(x, y, z) - 0.5) * 2 * d.jitter : 1;
            for (const f of FACES) {
              const nx = x + f.n[0],
                ny = y + f.n[1],
                nz = z + f.n[2];
              if (w.inside(nx, ny, nz) && isOpaque(w.data[w.idx(nx, ny, nz)])) continue;
              if (!w.inside(nx, ny, nz) && ny < 0) continue;
              // light from the air cell in front of the face
              if (d.emit || d.glow) {
                const gl = (d.glow ?? 1.5) * j;
                col.setRGB(lc[0] * gl, lc[1] * gl, lc[2] * gl);
              } else {
                w.lightAt(nx, ny, nz, col);
                col.r *= lc[0] * j * f.shade;
                col.g *= lc[1] * j * f.shade;
                col.b *= lc[2] * j * f.shade;
              }
              const aoVals: number[] = [];
              for (const c of f.c) {
                pos.push(x + c[0], y + c[1], z + c[2]);
                const ao = d.emit || d.glow ? 1 : vertexAO(w, x, y, z, f.n as unknown as number[], c as unknown as number[]);
                aoVals.push(ao);
                colr.push(col.r * ao, col.g * ao, col.b * ao);
              }
              // flip quad diagonal to avoid AO anisotropy
              if (aoVals[0] + aoVals[2] < aoVals[1] + aoVals[3]) {
                idxs.push(v + 1, v + 2, v + 3, v + 1, v + 3, v);
              } else idxs.push(v, v + 1, v + 2, v, v + 2, v + 3);
              v += 4;
            }
          }
      if (gv) {
        const gg = new THREE.BufferGeometry();
        gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
        gg.setIndex(gidx);
        gg.computeBoundingSphere();
        const gm = new THREE.Mesh(gg, glassMat);
        gm.renderOrder = 2;
        group.add(gm);
      }
      if (!v) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
      g.setIndex(idxs);
      g.computeBoundingSphere();
      group.add(new THREE.Mesh(g, mat));
    }
  return group;
}

function vertexAO(w: VoxelWorld, x: number, y: number, z: number, n: number[], c: number[]) {
  // the two tangent axes
  const axes = [0, 1, 2].filter((a) => n[a] === 0);
  const base = [x + n[0], y + n[1], z + n[2]];
  const s = axes.map((a) => (c[a] === 1 ? 1 : -1));
  const p1 = [...base];
  p1[axes[0]] += s[0];
  const p2 = [...base];
  p2[axes[1]] += s[1];
  const p3 = [...base];
  p3[axes[0]] += s[0];
  p3[axes[1]] += s[1];
  const s1 = w.opaque(p1[0], p1[1], p1[2]) ? 1 : 0;
  const s2 = w.opaque(p2[0], p2[1], p2[2]) ? 1 : 0;
  const s3 = w.opaque(p3[0], p3[1], p3[2]) ? 1 : 0;
  const occ = s1 && s2 ? 3 : s1 + s2 + s3;
  return [1, 0.78, 0.6, 0.45][occ];
}
