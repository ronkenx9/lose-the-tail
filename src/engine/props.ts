import * as THREE from 'three';
import type { VoxelWorld } from './voxels';

/**
 * Detailed furniture built from small voxels (1 unit = 1/16 block, Minecraft-pixel scale).
 * A prop is a list of boxes in unit space; it is meshed face-culled with per-voxel jitter.
 * Emissive boxes (screens, bulbs) go to a separate bright mesh so bloom picks them up.
 */
type RGB = [number, number, number];
export interface Box {
  a: [number, number, number];
  b: [number, number, number]; // exclusive max
  c: RGB;
  glow?: number;
}
const U = 1 / 16;

function hash(x: number, y: number, z: number) {
  let h = (x * 73856093) ^ (y * 19349663) ^ (z * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]], s: 0.8 },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]], s: 0.8 },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], s: 1.0 },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], s: 0.5 },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]], s: 0.9 },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]], s: 0.7 },
];

/** mesh a box list. Boxes larger than ~8 units are emitted as single big faces (cheap). */
export function buildProp(boxes: Box[]): THREE.Group {
  const grp = new THREE.Group();
  const lit = { p: [] as number[], c: [] as number[], i: [] as number[], v: 0 };
  const emi = { p: [] as number[], c: [] as number[], i: [] as number[], v: 0 };
  const col = new THREE.Color();
  // occupancy for culling between boxes (coarse: only cull faces fully inside another box)
  const inside = (x: number, y: number, z: number, self: Box) =>
    boxes.some((o) => o !== self && !o.glow === !self.glow && x >= o.a[0] && x < o.b[0] && y >= o.a[1] && y < o.b[1] && z >= o.a[2] && z < o.b[2]);
  boxes.forEach((bx, bi) => {
    const tgt = bx.glow ? emi : lit;
    const size = [bx.b[0] - bx.a[0], bx.b[1] - bx.a[1], bx.b[2] - bx.a[2]];
    for (const f of FACES) {
      // probe the centre of the face just outside the box: skip if buried in another box
      const cx = bx.a[0] + size[0] / 2 + (f.n[0] * size[0]) / 2 + f.n[0] * 0.5;
      const cy = bx.a[1] + size[1] / 2 + (f.n[1] * size[1]) / 2 + f.n[1] * 0.5;
      const cz = bx.a[2] + size[2] / 2 + (f.n[2] * size[2]) / 2 + f.n[2] * 0.5;
      if (inside(cx, cy, cz, bx)) continue;
      col.setRGB(bx.c[0] / 255, bx.c[1] / 255, bx.c[2] / 255, THREE.SRGBColorSpace);
      const j = bx.glow ? bx.glow : f.s * (0.92 + hash(bi, f.n[0] + 3, f.n[2] + 7) * 0.16);
      for (const q of f.c) {
        tgt.p.push((bx.a[0] + q[0] * size[0]) * U, (bx.a[1] + q[1] * size[1]) * U, (bx.a[2] + q[2] * size[2]) * U);
        tgt.c.push(col.r * j, col.g * j, col.b * j);
      }
      tgt.i.push(tgt.v, tgt.v + 1, tgt.v + 2, tgt.v, tgt.v + 2, tgt.v + 3);
      tgt.v += 4;
    }
  });
  for (const [g, glow] of [
    [lit, false],
    [emi, true],
  ] as const) {
    if (!g.v) continue;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, 3));
    geo.setIndex(g.i);
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true }));
    m.userData.glow = glow;
    grp.add(m);
  }
  return grp;
}

const box = (a: [number, number, number], b: [number, number, number], c: RGB, glow?: number): Box => ({ a, b, c, glow });
const WOOD: RGB = [110, 72, 44],
  WOOD_D: RGB = [74, 48, 30],
  WHITE: RGB = [225, 225, 232],
  NAVY: RGB = [34, 46, 92],
  METAL: RGB = [86, 92, 102],
  DARK: RGB = [28, 30, 36],
  LEAF: RGB = [44, 110, 58],
  POT: RGB = [120, 66, 44];

/** prop catalogue. All sizes in 1/16-block units; origin = min corner of the footprint cell. */
export const PROPS: Record<string, (o?: any) => Box[]> = {
  bed: () => [
    box([1, 0, 0], [15, 6, 32], WOOD),
    box([0, 0, 0], [16, 18, 2], WOOD_D), // headboard
    box([1, 6, 2], [15, 9, 31], WHITE), // mattress
    box([1, 9, 12], [15, 10, 31], NAVY), // blanket
    box([2, 9, 3], [14, 12, 9], [240, 240, 245]), // pillow
  ],
  nightstand: () => [box([2, 0, 2], [14, 10, 14], WOOD), box([3, 5, 14], [13, 6, 15], WOOD_D), box([7, 7, 14], [9, 8, 15], METAL)],
  desk: () => [box([0, 11, 2], [32, 13, 14], WOOD), box([1, 0, 3], [3, 11, 13], WOOD_D), box([29, 0, 3], [31, 11, 13], WOOD_D), box([10, 13, 4], [22, 22, 5], DARK), box([11, 14, 5], [21, 21, 5.5 as any], [60, 140, 220], 1.6), box([15, 13, 5], [17, 15, 8], DARK)],
  chair: () => [box([3, 0, 3], [5, 7, 5], DARK), box([11, 0, 3], [13, 7, 5], DARK), box([3, 0, 11], [5, 7, 13], DARK), box([11, 0, 11], [13, 7, 13], DARK), box([2, 7, 2], [14, 9, 14], [70, 60, 90]), box([2, 9, 12], [14, 20, 14], [70, 60, 90])],
  stool: (o) => [box([6, 0, 6], [10, 10, 10], METAL), box([3, 10, 3], [13, 12, 13], o?.c ?? [200, 40, 120])],
  lamp: (o) => [box([6, 0, 6], [10, 1, 10], DARK), box([7, 1, 7], [9, 24, 9], METAL), box([4, 24, 4], [12, 30, 12], o?.c ?? [255, 214, 150], 1.4)],
  plant: () => [box([4, 0, 4], [12, 7, 12], POT), box([3, 7, 3], [13, 14, 13], LEAF), box([5, 14, 5], [11, 20, 11], [58, 130, 70]), box([7, 20, 7], [9, 24, 9], LEAF)],
  shelf: () => [box([0, 0, 12], [16, 30, 16], WOOD_D), box([0, 10, 8], [16, 11, 16], WOOD), box([0, 20, 8], [16, 21, 16], WOOD), box([2, 11, 10], [5, 16, 13], [180, 60, 60]), box([7, 11, 10], [10, 15, 13], [60, 120, 200]), box([11, 21, 10], [14, 27, 13], [220, 180, 60]), box([3, 21, 10], [6, 25, 13], [90, 180, 120])],
  rug: () => [box([0, 0, 0], [32, 0.5 as any, 24], [120, 36, 44])],
  table: () => [box([2, 11, 2], [14, 12, 14], WOOD), box([7, 0, 7], [9, 11, 9], DARK), box([5, 0, 5], [11, 1, 11], DARK), box([4, 12, 5], [6, 15, 7], WHITE)],
  coffee_machine: () => [box([1, 0, 4], [15, 16, 14], [40, 40, 46]), box([3, 10, 14], [13, 14, 15], [180, 190, 200]), box([6, 3, 14], [10, 4, 16], METAL), box([12, 16, 6], [14, 18, 8], [255, 120, 40], 2)],
  cups: () => [box([2, 0, 6], [5, 4, 9], WHITE), box([7, 0, 6], [10, 4, 9], WHITE), box([12, 0, 6], [15, 4, 9], WHITE), box([5, 0, 10], [8, 4, 13], [230, 200, 160])],
  pendant: (o) => [box([7, 6, 7], [9, 16, 9], DARK), box([3, 3, 3], [13, 7, 13], [40, 36, 30]), box([5, 1, 5], [11, 3, 11], o?.c ?? [255, 196, 120], 1.3)],
  arcade: (o) => {
    const c: RGB = o?.c ?? [255, 60, 200];
    return [
      box([1, 0, 2], [15, 28, 14], [26, 22, 38]),
      box([2, 15, 13], [14, 24, 14], c, 1.9), // screen
      box([1, 28, 2], [15, 32, 14], c, 1.2), // marquee
      box([2, 11, 14], [14, 13, 18], [40, 36, 54]), // control deck
      box([4, 13, 15], [5, 16, 16], [230, 40, 60]),
      box([9, 13, 15], [10, 14, 16], [60, 200, 255], 1.6),
      box([11, 13, 15], [12, 14, 16], [255, 220, 60], 1.6),
    ];
  },
  vault: () => [box([0, 0, 13], [32, 32, 16], [70, 76, 84]), box([4, 4, 12], [28, 28, 13], [110, 118, 128]), box([14, 14, 10], [18, 18, 12], [180, 186, 196]), box([8, 15, 11], [24, 17, 12], [140, 146, 156])],
  post: () => [box([6, 0, 6], [10, 1, 10], [170, 160, 120]), box([7, 1, 7], [9, 14, 9], [200, 190, 140]), box([7, 12, 0], [9, 13, 16], [140, 30, 40])],
  camera: () => [box([4, 10, 10], [12, 14, 16], [220, 220, 228]), box([6, 11, 8], [10, 13, 10], DARK), box([7, 11.5 as any, 7], [9, 12.5 as any, 8], [255, 40, 40], 3), box([7, 14, 12], [9, 16, 14], METAL)],
  bowl: () => [box([3, 0, 3], [13, 4, 13], [230, 230, 236]), box([4, 3, 4], [12, 4.5 as any, 12], [200, 140, 60]), box([6, 4, 6], [8, 5, 8], [90, 170, 90])],
  pot: () => [box([2, 0, 2], [14, 12, 14], [120, 124, 132]), box([3, 12, 3], [13, 13, 13], [220, 180, 110])],
  monitor: (o) => [box([0, 0, 6], [32, 22, 10], DARK), box([1, 1, 10], [31, 21, 10.5 as any], o?.c ?? [255, 60, 50], 1.4), box([14, -6, 7], [18, 0, 9], DARK)],
  fridge: () => [
    box([0, 0, 2], [16, 31, 16], [200, 206, 214]),
    box([1, 2, 14], [15, 29, 15], [150, 210, 255], 1.1),
    ...([6, 13, 20] as const).flatMap((y, i) => {
      const c: RGB[][] = [
        [[230, 60, 60], [60, 140, 240], [240, 240, 240]],
        [[60, 200, 120], [240, 120, 40], [230, 60, 60]],
        [[250, 200, 60], [200, 80, 200], [60, 200, 120]],
      ];
      return [box([2, y, 6], [5, y + 4, 9], c[i][0]), box([6, y, 6], [9, y + 4, 9], c[i][1]), box([10, y, 6], [13, y + 4, 9], c[i][2])];
    }),
  ],
  washer: () => [box([1, 0, 2], [15, 14, 15], [228, 230, 234]), box([4, 3, 15], [12, 11, 16], [70, 90, 120]), box([5, 4, 16], [11, 10, 16.5 as any], [120, 170, 230], 0.9), box([2, 12, 15], [6, 13, 16], [255, 120, 60], 1.6)],
  register: () => [box([3, 0, 4], [13, 4, 12], [50, 52, 58]), box([4, 4, 9], [12, 9, 10], [40, 42, 48]), box([5, 5, 10], [11, 8, 10.5 as any], [90, 255, 160], 1.4)],
  sign_board: () => [box([2, 0, 6], [14, 18, 8], [30, 32, 30]), box([3, 3, 8], [13, 16, 8.5 as any], [210, 210, 190])],
};

export interface PropSpec {
  kind: string;
  /** cell coordinates (footprint min corner) */
  x: number;
  z: number;
  y?: number;
  /** quarter turns about Y */
  rot?: number;
  opts?: any;
  /** cells this prop blocks for walking (relative, before rotation) */
  block?: [number, number][];
}

const cache = new Map<string, Box[]>();
/** instantiate props, tinted by the world light at their position */
export function placeProps(scene: THREE.Scene, world: VoxelWorld, specs: PropSpec[]) {
  const out: THREE.Group[] = [];
  const tmp = new THREE.Color();
  for (const s of specs) {
    const key = s.kind + JSON.stringify(s.opts ?? {});
    let boxes = cache.get(key);
    if (!boxes) {
      boxes = PROPS[s.kind](s.opts);
      cache.set(key, boxes);
    }
    const g = buildProp(boxes);
    const pivot = new THREE.Group();
    // rotate around the centre of the first cell
    g.position.set(-0.5, 0, -0.5);
    pivot.add(g);
    pivot.rotation.y = -(s.rot ?? 0) * (Math.PI / 2);
    pivot.position.set(s.x + 0.5, s.y ?? 1, s.z + 0.5);
    world.lightAt(s.x + 0.5, (s.y ?? 1) + 0.6, s.z + 0.5, tmp);
    for (const m of g.children as THREE.Mesh[]) {
      const mat = m.material as THREE.MeshBasicMaterial;
      if (m.userData.glow) mat.color.setScalar(1);
      else mat.color.setRGB(Math.min(1.4, 0.18 + tmp.r * 1.25), Math.min(1.4, 0.18 + tmp.g * 1.25), Math.min(1.4, 0.18 + tmp.b * 1.25));
    }
    scene.add(pivot);
    out.push(pivot);
  }
  return out;
}

/** footprint cells a prop blocks, after rotation */
export function propCells(s: PropSpec): [number, number][] {
  const base = s.block ?? [[0, 0]];
  const r = ((s.rot ?? 0) % 4 + 4) % 4;
  return base.map(([dx, dz]) => {
    const [rx, rz] = r === 0 ? [dx, dz] : r === 1 ? [-dz, dx] : r === 2 ? [-dx, -dz] : [dz, -dx];
    return [s.x + rx, s.z + rz] as [number, number];
  });
}
