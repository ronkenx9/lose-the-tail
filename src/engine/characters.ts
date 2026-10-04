import * as THREE from 'three';
import heads from '../data/heads.json';

export type HeadMeta = (typeof heads.heads)[number];
export const HEADS = heads.heads;
export const ATLAS_URL = '/heads/atlas.png';
const N = 26;
/** one voxel = 1/20 m; a character is ~37 voxels tall */
export const VOX = 0.05;

let pixels: Uint8ClampedArray | null = null;
let atlasW = 0;

export async function loadAtlas() {
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error('atlas failed to load'));
    img.src = ATLAS_URL;
  });
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  pixels = ctx.getImageData(0, 0, c.width, c.height).data;
  atlasW = c.width;
}

export function headByRole(role: string) {
  return HEADS.find((h) => h.role === role)!;
}
export function headsByRole(role: string) {
  return HEADS.filter((h) => h.role === role);
}

type RGB = [number, number, number];
function px(i: number, x: number, y: number): [number, number, number, number] {
  const cx = (i % heads.cols) * N + x;
  const cy = Math.floor(i / heads.cols) * N + y;
  const o = (cy * atlasW + cx) * 4;
  return [pixels![o], pixels![o + 1], pixels![o + 2], pixels![o + 3]];
}

// ---------------------------------------------------------------------------
// Read a character's look from its 26x26 profile portrait
// ---------------------------------------------------------------------------
export interface Look {
  body: RGB;
  face: RGB;
  hood: RGB | null;
  hat: RGB | null;
  hatStyle: 'cap' | 'beanie' | 'halo' | 'helmet' | null;
  eye: RGB;
  visor: boolean;
  trail: RGB[];
  pants: RGB;
  boots: RGB;
}

const lum = (c: RGB) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
const sat = (c: RGB) => {
  const mx = Math.max(...c),
    mn = Math.min(...c);
  return mx ? (mx - mn) / mx : 0;
};
const dist = (a: RGB, b: RGB) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

function mode(cols: RGB[], fallback: RGB): RGB {
  const m = new Map<string, number>();
  for (const c of cols) {
    const k = c.join(',');
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  let best = '',
    n = 0;
  for (const [k, v] of m) if (v > n) ((n = v), (best = k));
  return best ? (best.split(',').map(Number) as RGB) : fallback;
}

const lookCache = new Map<number, Look>();
export function lookOf(h: HeadMeta): Look {
  const hit = lookCache.get(h.i);
  if (hit) return hit;
  const i = h.i;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && px(i, x, y)[3] > 0;
  const col = (x: number, y: number): RGB => {
    const p = px(i, x, y);
    return [p[0], p[1], p[2]];
  };
  // largest component = body; everything else = trail
  const comp = new Int16Array(N * N).fill(-1);
  let best = -1,
    bestSize = 0,
    cid = 0;
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!solid(x, y) || comp[x + y * N] >= 0) continue;
      const q = [x + y * N];
      comp[x + y * N] = cid;
      let size = 0;
      while (q.length) {
        const p = q.pop()!;
        size++;
        const x0 = p % N,
          y0 = Math.floor(p / N);
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x0 + dx,
              ny = y0 + dy;
            if (!solid(nx, ny) || comp[nx + ny * N] >= 0) continue;
            comp[nx + ny * N] = cid;
            q.push(nx + ny * N);
          }
      }
      if (size > bestSize) ((bestSize = size), (best = cid));
      cid++;
    }
  const L: number[] = [],
    R: number[] = [];
  for (let y = 0; y < N; y++) {
    let r = -1;
    for (let x = N - 1; x >= 0; x--)
      if (comp[x + y * N] === best) {
        r = x;
        break;
      }
    let l = r;
    while (l - 1 >= 0 && comp[l - 1 + y * N] === best) l--;
    L[y] = l;
    R[y] = r;
  }
  const bodyCols: RGB[] = [],
    faceCols: RGB[] = [],
    backCols: RGB[] = [],
    topCols: RGB[] = [],
    trailCols: RGB[] = [];
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!solid(x, y)) continue;
      const c = col(x, y);
      if (comp[x + y * N] !== best) {
        trailCols.push(c);
        continue;
      }
      if (y >= N - 4 && x >= L[y] + 2) bodyCols.push(c);
      if (y >= 8 && y <= 17 && R[y] >= 0 && x >= R[y] - 6 && x <= R[y] - 1) faceCols.push(c);
      if (y >= 8 && y <= 15 && R[y] >= 0 && x >= L[y] && x <= L[y] + 2) backCols.push(c);
      if (y <= 6) topCols.push(c);
    }
  const body = mode(bodyCols, [60, 60, 70]);
  const back = mode(backCols, body);
  // face: most common face-region colour that isn't very dark / the visor
  const faceCand = faceCols.filter((c) => lum(c) > 0.12 && sat(c) < 0.95);
  let face = mode(faceCand.length ? faceCand : faceCols, back);
  const eyeCand = faceCols.filter((c) => dist(c, face) > 90 && dist(c, back) > 60);
  // visor = a long horizontal run of dark pixels across the face; short runs are just dark eyes
  let longestDark = 0;
  for (let y = 8; y <= 17; y++) {
    let run = 0;
    for (let x = Math.max(0, R[y] - 8); x <= R[y]; x++) {
      if (R[y] >= 0 && solid(x, y) && comp[x + y * N] === best && lum(col(x, y)) < 0.1) longestDark = Math.max(longestDark, ++run);
      else run = 0;
    }
  }
  const darks = faceCols.filter((c) => lum(c) < 0.1).length;
  const visor = longestDark >= 5;
  let eye: RGB = [255, 240, 120];
  let eb = -1;
  for (const c of eyeCand) {
    const s = sat(c) * 0.6 + lum(c);
    if (lum(c) > 0.18 && s > eb) ((eb = s), (eye = c));
  }
  // dark eyes on a light face (e.g. the white ghost): black squares, no glow
  if (!visor && darks >= 2 && (eb < 0 || lum(face) > 0.6)) eye = [10, 10, 12];
  // Hoodie / hooded heads: back of head differs from face
  const hooded = h.traits.Head === 'Hoodie' || dist(back, face) > 70;
  const headTrait = h.traits.Head;
  let hat: RGB | null = null;
  let hatStyle: Look['hatStyle'] = null;
  if (headTrait !== 'None' && headTrait !== 'Hoodie') {
    hat = mode(topCols.filter((c) => dist(c, face) > 40), back);
    hatStyle = /Wrap|Nyx|Luma|Tenrai|Drift|Cinder/.test(headTrait)
      ? 'beanie'
      : /Halo|Saint|Ascension|Zhalo/.test(headTrait)
        ? 'halo'
        : /Miner/.test(headTrait)
          ? 'helmet'
          : 'cap';
  }
  if (!face || dist(face, [0, 0, 0]) < 10) face = back;
  const trail = trailCols.length ? Array.from(new Set(trailCols.map((c) => c.join(',')))).slice(0, 6).map((k) => k.split(',').map(Number) as RGB) : [body];
  const look: Look = {
    body,
    face,
    hood: hooded ? back : null,
    hat,
    hatStyle,
    eye,
    visor,
    trail,
    pants: shade(body, 0.55),
    boots: shade(body, 0.3),
  };
  lookCache.set(i, look);
  return look;
}

// ---------------------------------------------------------------------------
// Voxel part builder (face-culled, per-voxel jitter, simple AO)
// ---------------------------------------------------------------------------
type ColorFn = (x: number, y: number, z: number) => RGB | null;
interface PartOpts {
  w: number;
  h: number;
  d: number;
  color: ColorFn;
  /** pivot in voxel units (geometry is translated so pivot = origin) */
  pivot: [number, number, number];
  /** colours that render unlit and bright (eyes) */
  glow?: (c: RGB) => boolean;
}
const tmpC = new THREE.Color();
function hash(x: number, y: number, z: number) {
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], s: 0.78 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], s: 0.78 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.45 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], s: 0.92 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], s: 0.7 },
];
function part(o: PartOpts): THREE.BufferGeometry {
  const grid: (RGB | null)[] = [];
  const at = (x: number, y: number, z: number) =>
    x < 0 || y < 0 || z < 0 || x >= o.w || y >= o.h || z >= o.d ? null : grid[x + o.w * (y + o.h * z)];
  for (let z = 0; z < o.d; z++) for (let y = 0; y < o.h; y++) for (let x = 0; x < o.w; x++) grid[x + o.w * (y + o.h * z)] = o.color(x, y, z);
  const pos: number[] = [],
    cols: number[] = [],
    ind: number[] = [];
  let v = 0;
  for (let z = 0; z < o.d; z++)
    for (let y = 0; y < o.h; y++)
      for (let x = 0; x < o.w; x++) {
        const c = at(x, y, z);
        if (!c) continue;
        const glow = o.glow?.(c);
        const j = glow ? 1 : 0.9 + hash(x, y, z) * 0.2;
        for (const f of FACES) {
          if (at(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
          tmpC.setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace);
          const k = glow ? 2.4 : f.s * j;
          for (const q of f.c) {
            let ao = 1;
            if (!glow) {
              const ax = x + (q[0] ? 1 : -1) * (f.n[0] === 0 ? 1 : 0) + f.n[0];
              const ay = y + (q[1] ? 1 : -1) * (f.n[1] === 0 ? 1 : 0) + f.n[1];
              const az = z + (q[2] ? 1 : -1) * (f.n[2] === 0 ? 1 : 0) + f.n[2];
              if (at(ax, ay, az)) ao = 0.78;
            }
            pos.push((x + q[0] - o.pivot[0]) * VOX, (y + q[1] - o.pivot[1]) * VOX, (z + q[2] - o.pivot[2]) * VOX);
            cols.push(tmpC.r * k * ao, tmpC.g * k * ao, tmpC.b * k * ao);
          }
          ind.push(v, v + 1, v + 2, v, v + 2, v + 3);
          v += 4;
        }
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(ind);
  g.computeBoundingSphere();
  return g;
}

export interface CharParts {
  head: THREE.BufferGeometry;
  torso: THREE.BufferGeometry;
  arm: THREE.BufferGeometry;
  leg: THREE.BufferGeometry;
  look: Look;
}
const partCache = new Map<number, CharParts>();

/**
 * Minecraft-proportioned voxel body built from the portrait's palette.
 * Units are voxels; +Z is the front. Legs 12, torso 12, head 10, hat 3.
 */
export function buildParts(h: HeadMeta): CharParts {
  const hit = partCache.get(h.i);
  if (hit) return hit;
  const L = lookOf(h);
  const isGlow = (c: RGB) => c === L.eye && lum(L.eye) > 0.2;
  const head = part({
    w: 12,
    h: 14,
    d: 13,
    pivot: [6, 0, 6],
    glow: isGlow,
    color: (x, y, z) => {
      // head cube occupies x1..10, y0..9, z1..10
      const inHead = x >= 1 && x <= 10 && y <= 9 && z >= 1 && z <= 10;
      if (inHead) {
        const fx = x - 1,
          fy = y;
        if (z === 10) {
          if (L.visor && fy >= 4 && fy <= 6 && fx >= 1 && fx <= 8) {
            if (fy === 5 && (fx === 2 || fx === 3 || fx === 6 || fx === 7)) return L.eye;
            return [12, 12, 14];
          }
          if (!L.visor && fy >= 4 && fy <= 5 && (fx === 2 || fx === 3 || fx === 6 || fx === 7)) return L.eye;
          if (L.hood) {
            if (fx >= 1 && fx <= 8 && fy >= 1 && fy <= 7) return L.face;
            return L.hood;
          }
          return L.face;
        }
        if (L.hood) return L.hood;
        return z <= 3 && y >= 6 ? shade(L.face, 0.85) : L.face;
      }
      if (!L.hat) return null;
      if (L.hatStyle === 'halo') {
        if (y === 12 && z >= 2 && z <= 9 && x >= 2 && x <= 9) {
          const edge = x === 2 || x === 9 || z === 2 || z === 9;
          return edge ? [255, 196, 64] : null;
        }
        return null;
      }
      if (L.hatStyle === 'beanie') {
        if (y >= 8 && y <= 11 && x >= 0 && x <= 11 && z >= 0 && z <= 11) {
          if (y === 11 && (x === 0 || x === 11 || z === 0 || z === 11)) return null;
          if (y <= 9 && x >= 1 && x <= 10 && z >= 1 && z <= 10 && !(x === 1 || x === 10 || z === 1 || z === 10)) return null;
          if (y <= 9 && z === 11) return null;
          return y === 8 ? shade(L.hat, 0.8) : L.hat;
        }
        return null;
      }
      // cap / helmet: crown + brim forward
      if (y >= 9 && y <= 11 && x >= 0 && x <= 11 && z >= 0 && z <= 11) {
        if (y === 11 && (x === 0 || x === 11 || z === 0)) return null;
        if (y === 9 && x >= 1 && x <= 10 && z >= 1 && z <= 10 && !(x === 1 || x === 10 || z === 1)) return null;
        return L.hat;
      }
      if (y === 9 && z === 12 && x >= 1 && x <= 10 && L.hatStyle !== 'helmet') return shade(L.hat, 0.85);
      if (L.hatStyle === 'helmet' && y === 10 && z === 12 && x >= 5 && x <= 6) return [255, 240, 180];
      return null;
    },
  });
  const torso = part({
    w: 10,
    h: 12,
    d: 6,
    pivot: [5, 0, 3],
    color: (x, y, z) => {
      if (y >= 10 && L.hood && z <= 1) return L.hood; // hood drape on back
      if (z === 5 && y >= 3 && y <= 6 && x >= 3 && x <= 6) return shade(L.body, 0.82); // pocket
      if (y <= 1) return shade(L.body, 0.8); // hem
      return L.body;
    },
  });
  const arm = part({
    w: 4,
    h: 12,
    d: 4,
    pivot: [2, 11, 2],
    color: (x, y) => (y <= 2 ? shade(L.face, 0.9) : y === 3 ? shade(L.body, 0.75) : L.body),
  });
  const leg = part({
    w: 5,
    h: 12,
    d: 5,
    pivot: [2.5, 12, 2.5],
    color: (x, y, z) => (y <= 2 ? (z === 4 && y === 0 ? shade(L.boots, 1.3) : L.boots) : L.pants),
  });
  const out = { head, torso, arm, leg, look: L };
  partCache.set(h.i, out);
  return out;
}

// ---------------------------------------------------------------------------
// Character
// ---------------------------------------------------------------------------
export class Character {
  readonly group = new THREE.Group();
  readonly head: HeadMeta;
  readonly look: Look;
  private headM: THREE.Mesh;
  private torso: THREE.Mesh;
  private arms: THREE.Mesh[] = [];
  private legs: THREE.Mesh[] = [];
  private mat: THREE.MeshBasicMaterial;
  private phase = Math.random() * 10;
  speed = 0;
  /** heading angle: atan2(-dz, dx) of the facing direction */
  yaw = 0;
  minLight = 0.55;
  /** head turns toward this world point */
  lookAt: THREE.Vector3 | null = null;
  /** 0..1 extra pixel-trail */
  trailBoost = 0;

  constructor(head: HeadMeta) {
    this.head = head;
    const p = buildParts(head);
    this.look = p.look;
    this.mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const legY = 12 * VOX;
    for (const s of [-1, 1]) {
      const l = new THREE.Mesh(p.leg, this.mat);
      l.position.set(s * 2.5 * VOX, legY, 0);
      this.legs.push(l);
      this.group.add(l);
    }
    this.torso = new THREE.Mesh(p.torso, this.mat);
    this.torso.position.y = legY;
    this.group.add(this.torso);
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(p.arm, this.mat);
      a.position.set(s * 7 * VOX, legY + 11.5 * VOX, 0);
      this.arms.push(a);
      this.group.add(a);
    }
    this.headM = new THREE.Mesh(p.head, this.mat);
    this.headM.position.y = legY + 12 * VOX;
    this.group.add(this.headM);
    if (head.role === 'tailor') this.dressTailor();
  }

  /** a blocky umbrella held over the head */
  addUmbrella(color: THREE.Color) {
    const g = new THREE.Group();
    const canopyMat = new THREE.MeshBasicMaterial({ color });
    const dark = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(0.6) });
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.95), canopyMat);
    const rim = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.05, 1.15), dark);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), canopyMat);
    rim.position.y = -0.06;
    cap.position.y = 0.06;
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.75, 0.035), new THREE.MeshBasicMaterial({ color: 0x222226 }));
    pole.position.y = -0.4;
    g.add(top, rim, cap, pole);
    g.position.set(0.12, 2.18, 0.08);
    this.group.add(g);
    this.arms[1].rotation.x = -1.2;
    this.umbrella = true;
  }
  umbrella = false;

  /** the boss gets his coat: long charcoal trench, red armband, glowing ledger tablet */
  private dressTailor() {
    const C: RGB = [34, 34, 38],
      C2: RGB = [24, 24, 28],
      R: RGB = [214, 30, 40];
    const coat = part({
      w: 12,
      h: 20,
      d: 8,
      pivot: [6, 8, 4],
      color: (x, y, z) => {
        if (y < 8 && (x === 5 || x === 6) && z >= 6) return null; // coat split at the front
        if (y >= 18 && (x <= 1 || x >= 10) && z >= 5) return C2; // lapels
        if (y === 11 && z >= 6) return [60, 60, 66]; // belt
        return (x + y + z) % 7 === 0 ? C2 : C;
      },
    });
    this.torso.geometry = coat;
    const sleeve = (band: boolean) =>
      part({
        w: 5,
        h: 12,
        d: 5,
        pivot: [2.5, 11, 2.5],
        color: (x, y) => (y <= 2 ? [20, 20, 22] : band && y >= 7 && y <= 8 ? R : C),
      });
    this.arms[0].geometry = sleeve(true);
    this.arms[1].geometry = sleeve(false);
    const tablet = new THREE.Mesh(
      new THREE.BoxGeometry(VOX * 5, VOX * 7, VOX * 0.6),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 1.6, 1.0) }),
    );
    tablet.position.set(0, -11 * VOX, 3 * VOX);
    tablet.rotation.x = -0.5;
    this.arms[1].add(tablet);
  }

  setLight(c: THREE.Color) {
    const k = (v: number) => Math.max(this.minLight, Math.min(1.5, 0.35 + v * 1.4));
    this.mat.color.setRGB(k(c.r), k(c.g), k(c.b));
  }

  update(dt: number) {
    this.phase += dt * (1.5 + this.speed * 7);
    const sw = Math.min(1, this.speed) * 0.75;
    const s = Math.sin(this.phase);
    this.legs[0].rotation.x = s * sw;
    this.legs[1].rotation.x = -s * sw;
    this.arms[0].rotation.x = -s * sw * 0.8;
    this.arms[1].rotation.x = this.umbrella ? -1.25 + s * sw * 0.1 : s * sw * 0.8;
    const idle = Math.sin(this.phase * 0.5) * 0.04 * (1 - Math.min(1, this.speed));
    this.arms[0].rotation.z = -0.05 - idle;
    this.arms[1].rotation.z = 0.05 + idle;
    const bob = Math.abs(Math.cos(this.phase)) * 0.045 * Math.min(1, this.speed);
    this.torso.position.y = 12 * VOX + bob;
    this.headM.position.y = 24 * VOX + bob + idle * 0.3;
    this.arms[0].position.y = this.arms[1].position.y = 23.5 * VOX + bob;
    const dx = Math.cos(this.yaw),
      dz = -Math.sin(this.yaw);
    this.group.rotation.y = Math.atan2(dx, dz);
    if (this.lookAt) {
      const hp = this.group.position;
      const want = Math.atan2(this.lookAt.x - hp.x, this.lookAt.z - hp.z) - this.group.rotation.y;
      const a = Math.max(-1, Math.min(1, Math.atan2(Math.sin(want), Math.cos(want))));
      this.headM.rotation.y += (a - this.headM.rotation.y) * Math.min(1, dt * 6);
    } else this.headM.rotation.y *= 1 - Math.min(1, dt * 4);
  }

  faceDir(dx: number, dz: number) {
    this.yaw = Math.atan2(-dz, dx);
  }

  dispose() {
    this.mat.dispose();
  }
}

// ---------------------------------------------------------------------------
// Pixel trails: one instanced mesh for every character's dissolving voxels
// ---------------------------------------------------------------------------
interface Bit {
  life: number;
  max: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  size: number;
  color: THREE.Color;
}
const UP = new THREE.Vector3(0, 1, 0);
export class Trails {
  mesh: THREE.InstancedMesh;
  private bits: Bit[] = [];
  private acc = new Map<Character, number>();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  constructor(
    scene: THREE.Scene,
    private max = 1200,
  ) {
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(VOX * 2.2, VOX * 2.2, VOX * 2.2), new THREE.MeshBasicMaterial({ color: 0xffffff }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  /** a cloud of voxels exploding outward from a point (the player's tail dissolving) */
  burst(at: THREE.Vector3, colors: [number, number, number][], n = 160, speed = 2.2, avoid?: THREE.Vector3) {
    const toCam = avoid ? avoid.clone().sub(at).setY(0).normalize() : null;
    for (let i = 0; i < n && this.bits.length < this.max; i++) {
      const dir = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.9 - 0.15, Math.random() - 0.5).normalize();
      if (toCam && dir.dot(toCam) > -0.2) dir.addScaledVector(toCam, -(dir.dot(toCam) + 0.6)).normalize();
      const c = colors[Math.floor(Math.random() * colors.length)];
      this.bits.push({
        life: 0,
        max: 0.9 + Math.random() * 1.4,
        pos: at.clone().addScaledVector(dir, 0.25 + Math.random() * 0.4),
        vel: dir.multiplyScalar(speed * (0.4 + Math.random())),
        size: 0.35 + Math.random() * 0.7,
        color: new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace).multiplyScalar(1.6),
      });
    }
  }

  update(dt: number, chars: Character[], cam: THREE.Vector3) {
    for (const ch of chars) {
      if (!ch.group.visible) continue;
      const dc = Math.hypot(ch.group.position.x - cam.x, ch.group.position.z - cam.z);
      if (dc > 28) continue;
      // thin the trail right in front of the lens so close conversations stay readable
      const near = ch.trailBoost > 0 ? 1 : Math.min(1, Math.max(0.12, (dc - 1.2) / 3));
      const rate = (9 + ch.speed * 26 + ch.trailBoost * 80) * near;
      const a = (this.acc.get(ch) ?? 0) + rate * dt;
      let n = Math.floor(a);
      this.acc.set(ch, a - n);
      while (n-- > 0 && this.bits.length < this.max) {
        const back = new THREE.Vector3(0, 0, -1).applyAxisAngle(UP, ch.group.rotation.y);
        const side = new THREE.Vector3(back.z, 0, -back.x);
        const p = ch.group.position
          .clone()
          .addScaledVector(back, 0.22 + Math.random() * 0.2)
          .addScaledVector(side, (Math.random() - 0.5) * 0.6);
        p.y += 0.7 + Math.random() * 1.15;
        const cols = ch.look.trail;
        const c = cols[Math.floor(Math.random() * cols.length)];
        const color = new THREE.Color().setRGB(c[0] / 255, c[1] / 255, c[2] / 255, THREE.SRGBColorSpace).multiplyScalar(1 + ch.trailBoost * 1.5);
        this.bits.push({
          life: 0,
          max: 0.7 + Math.random() * 1.1,
          pos: p,
          vel: back.multiplyScalar(0.2 + Math.random() * 0.45 + ch.speed * 0.3).add(new THREE.Vector3(0, (Math.random() - 0.3) * 0.12, 0)),
          size: 0.5 + Math.random() * 0.9,
          color,
        });
      }
    }
    let k = 0;
    const s3 = new THREE.Vector3();
    this.bits = this.bits.filter((b) => {
      b.life += dt;
      if (b.life > b.max) return false;
      b.pos.addScaledVector(b.vel, dt);
      const t = b.life / b.max;
      const dcam = b.pos.distanceTo(cam);
      s3.setScalar(b.size * (1 - t * t) * Math.min(1, Math.max(0, (dcam - 0.6) / 1.4)));
      this.m4.compose(b.pos, this.q, s3);
      this.mesh.setMatrixAt(k, this.m4);
      this.mesh.setColorAt(k, b.color);
      k++;
      return true;
    });
    this.mesh.count = k;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

// ---------------------------------------------------------------------------
// Zero: the narrator. Bespoke model from the Codex character sheet: big rounded
// hood-head, tall black eyes, stub arms, no legs, body dissolving into cubes.
// ---------------------------------------------------------------------------
export class Zero {
  readonly group = new THREE.Group();
  private head: THREE.Mesh;
  private body: THREE.Mesh;
  private arms: THREE.Mesh[] = [];
  private bits: THREE.Mesh[] = [];
  private t = Math.random() * 10;
  readonly look: Look = {
    body: [236, 238, 240],
    face: [246, 247, 248],
    hood: null,
    hat: null,
    hatStyle: null,
    eye: [8, 8, 10],
    visor: false,
    trail: [
      [250, 250, 252],
      [220, 224, 228],
      [200, 255, 220],
    ],
    pants: [200, 200, 205],
    boots: [180, 180, 185],
  };
  speed = 0;
  trailBoost = 0.2;
  yaw = 0;
  constructor() {
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });
    const W: RGB = [244, 245, 247],
      G: RGB = [214, 217, 221],
      K: RGB = [6, 6, 8];
    const head = part({
      w: 12,
      h: 12,
      d: 11,
      pivot: [6, 0, 5.5],
      color: (x, y, z) => {
        // rounded hood: shave corners and the top edges
        const ex = x === 0 || x === 11,
          ez = z === 0 || z === 10,
          top = y === 11,
          bot = y === 0;
        if ((ex && ez) || (top && (ex || ez)) || (bot && ex && z < 3)) return null;
        if (top && (x === 1 || x === 10)) return null;
        if (z === 10 && y >= 4 && y <= 6 && ((x >= 3 && x <= 4) || (x >= 7 && x <= 8))) return K;
        if (z === 10 && y === 7 && ((x >= 3 && x <= 4) || (x >= 7 && x <= 8))) return K;
        return y >= 9 || z <= 2 ? G : W;
      },
    });
    const body = part({
      w: 8,
      h: 10,
      d: 6,
      pivot: [4, 10, 3],
      color: (x, y, z) => {
        // tapering, dissolving toward the bottom
        const inset = y < 3 ? 2 : y < 5 ? 1 : 0;
        if (x < inset || x > 7 - inset || z < Math.min(inset, 2) || z > 5 - Math.min(inset, 2)) return null;
        if (y < 2 && hash(x, y, z) < 0.45) return null;
        return z <= 1 || x === inset || x === 7 - inset ? G : W;
      },
    });
    const arm = part({ w: 3, h: 6, d: 3, pivot: [1.5, 6, 1.5], color: (x, y) => (y === 0 ? G : W) });
    this.head = new THREE.Mesh(head, mat);
    this.body = new THREE.Mesh(body, mat);
    this.head.position.y = 0;
    this.body.position.y = 0.02;
    this.group.add(this.head, this.body);
    for (const s of [-1, 1]) {
      const a = new THREE.Mesh(arm, mat);
      a.position.set(s * 5.2 * VOX, -1.5 * VOX, 0.5 * VOX);
      a.rotation.z = s * 0.35;
      this.arms.push(a);
      this.group.add(a);
    }
    // a few loose cubes orbiting under the body
    const cube = new THREE.BoxGeometry(VOX * 1.4, VOX * 1.4, VOX * 1.4);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(cube, new THREE.MeshBasicMaterial({ color: new THREE.Color(0.95, 0.96, 0.97) }));
      this.bits.push(m);
      this.group.add(m);
    }
    mat.color.setScalar(0.74);
  }
  /** emulate Character's interface for trails */
  get asCharacter() {
    return this as unknown as Character;
  }
  update(dt: number) {
    this.t += dt;
    const bob = Math.sin(this.t * 1.6) * 0.06;
    this.head.position.y = 0.5 + bob;
    this.body.position.y = 0.52 + bob * 0.8;
    this.arms[0].rotation.z = -0.35 - Math.sin(this.t * 1.6) * 0.08;
    this.arms[1].rotation.z = 0.35 + Math.sin(this.t * 1.6 + 0.6) * 0.08;
    this.arms.forEach((a) => (a.position.y = 0.42 + bob * 0.9));
    this.head.rotation.z = Math.sin(this.t * 0.7) * 0.05;
    this.bits.forEach((b, i) => {
      const a = this.t * (0.6 + i * 0.07) + i;
      b.position.set(Math.cos(a) * (0.12 + i * 0.02), 0.02 + ((this.t * 0.25 + i * 0.13) % 0.55), Math.sin(a) * (0.1 + i * 0.015));
      b.scale.setScalar(1 - ((this.t * 0.25 + i * 0.13) % 0.55) / 0.55);
    });
  }
}
