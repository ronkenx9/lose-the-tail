import { B, VoxelWorld } from './voxels';

export const SX = 96;
export const SY = 40;
export const SZ = 96;

/** seeded rng */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Facing = 'N' | 'S' | 'E' | 'W';

export interface SignSpec {
  text: string;
  sub?: string;
  color: string;
  /** world position of sign center */
  x: number;
  y: number;
  z: number;
  facing: Facing;
  w: number;
  h: number;
  flicker?: boolean;
}

export interface ScreenSpec {
  id: 'ledger' | 'mainnet';
  x: number;
  y: number;
  z: number;
  facing: Facing;
  w: number;
  h: number;
}

export interface Decal {
  img: string;
  x: number;
  y: number;
  z: number;
  /** plane normal direction; 'X' / 'Z' = double-sided hanging banner along that axis */
  facing: Facing | 'X' | 'Z';
  w: number;
  h: number;
  glow?: number;
  /** show only a horizontal band of the image: [repeatY, offsetY] */
  band?: [number, number];
}

export interface Tag {
  id: number;
  x: number;
  y: number;
  z: number;
  facing: Facing;
  /** where the player must stand near */
  px: number;
  pz: number;
  fact: string;
}

export interface Station {
  id: string;
  /** where the player stands (cell center) */
  x: number;
  z: number;
  /** where the NPC stands, if any */
  npc?: { x: number; z: number; yaw: number };
  label: string;
}

interface Building {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  h: number;
  wall: number;
  winRow: number;
  winCol: number;
  lit: number;
  dark?: boolean;
  style: 'office' | 'brick' | 'glass' | 'black';
}

export interface City {
  world: VoxelWorld;
  signs: SignSpec[];
  screens: ScreenSpec[];
  stations: Record<string, Station>;
  walk: Uint8Array;
  lamps: { x: number; y: number; z: number }[];
  spawn: { x: number; z: number; yaw: number };
  tags: Tag[];
  decals: Decal[];
  steam: { x: number; z: number }[];
}

const AVE = { a: 42, b: 53 }; // z range of the avenue (incl. sidewalks)
const ST = { a: 42, b: 53 }; // x range of the street
const PLAZA = { a: 39, b: 56 };
const ALLEY = { x0: 74, x1: 75, z0: 3, z1: 41 };

export function buildCity(): City {
  const w = new VoxelWorld(SX, SY, SZ);
  const r = rng(1337);
  const signs: SignSpec[] = [];
  const decals: Decal[] = [];
  const screens: ScreenSpec[] = [];
  const lamps: City['lamps'] = [];

  // ground
  w.fill(0, 0, 0, SX - 1, 0, SZ - 1, B.CONCRETE);

  // avenue (E-W) + street (N-S)
  const road = (horizontal: boolean) => {
    const { a, b } = horizontal ? AVE : ST;
    for (let t = 0; t < (horizontal ? SX : SZ); t++) {
      for (let s = a; s <= b; s++) {
        const [x, z] = horizontal ? [t, s] : [s, t];
        let blk: number = B.ASPHALT;
        if (s <= a + 1 || s >= b - 1) blk = B.SIDEWALK;
        if (s === a + 2 || s === b - 2) blk = B.CURB;
        if ((s === a + 5 || s === a + 6) && t % 6 < 3) blk = B.LINE;
        if (blk === B.ASPHALT && r() < 0.06) blk = B.PUDDLE;
        w.set(x, 0, z, blk);
      }
    }
  };
  road(true);
  road(false);

  // buildings
  const buildings: Building[] = [];
  const add = (b: Partial<Building> & Pick<Building, 'x0' | 'z0' | 'x1' | 'z1'>) => {
    const styles: Building['style'][] = ['office', 'brick', 'glass', 'brick', 'office'];
    const style = b.style ?? styles[Math.floor(r() * styles.length)];
    const wall =
      b.wall ??
      ({ office: B.CONCRETE, brick: r() < 0.5 ? B.BRICK : B.DARKBRICK, glass: B.PANEL_BLUE, black: B.GLASS_DARK } as const)[
        style
      ];
    buildings.push({
      h: b.h ?? 10 + Math.floor(r() * 18),
      winRow: 3,
      winCol: style === 'glass' ? 2 : 3,
      lit: 0.14 + r() * 0.18,
      ...b,
      wall,
      style,
    });
  };

  // quadrant lots: [0..19] [22..41] | [54..73] [76..95], alleys between
  const lotsA = [
    [0, 19],
    [22, 41],
  ];
  const lotsB = [
    [54, 73],
    [76, 95],
  ];
  const special: Record<string, Partial<Building>> = {
    // NW
    '0,22': { h: 14, style: 'brick', wall: B.BRICK }, // HOME
    '22,22': { h: 24, style: 'office' }, // ledger billboard facade
    // NE
    '54,22': { h: 30, style: 'glass' }, // mainnet screen on west face
    '76,22': { h: 16, style: 'glass', wall: B.PANEL_BLUE }, // COBALT EXCHANGE
    '54,0': { h: 22, style: 'brick', dark: true },
    '76,0': { h: 18, style: 'brick', dark: true },
    // SW
    '0,54': { h: 26, style: 'black', wall: B.GLASS_DARK }, // TAILOR & CO
    '22,76': { h: 12, style: 'brick', wall: B.DARKBRICK }, // ARCADE
    // SE
    '76,54': { h: 11, style: 'brick', wall: B.BRICK }, // CAFE
  };
  for (const [xa, xb] of [...lotsA, ...lotsB])
    for (const [za, zb] of [...lotsA, ...lotsB]) {
      add({ x0: xa, z0: za, x1: xb, z1: zb, ...(special[`${xa},${za}`] ?? {}) });
    }

  for (const b of buildings) {
    w.fill(b.x0, 1, b.z0, b.x1, b.h, b.z1, b.wall);
    // roof slab + parapet
    w.fill(b.x0, b.h, b.z0, b.x1, b.h, b.z1, B.ROOF);
    for (let x = b.x0; x <= b.x1; x++) {
      w.set(x, b.h + 1, b.z0, B.TRIM);
      w.set(x, b.h + 1, b.z1, B.TRIM);
    }
    for (let z = b.z0; z <= b.z1; z++) {
      w.set(b.x0, b.h + 1, z, B.TRIM);
      w.set(b.x1, b.h + 1, z, B.TRIM);
    }
    // rooftop clutter
    const n = 2 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const cx = b.x0 + 2 + Math.floor(r() * (b.x1 - b.x0 - 5));
      const cz = b.z0 + 2 + Math.floor(r() * (b.z1 - b.z0 - 5));
      const big = r() < 0.3;
      if (big) {
        // water tank
        w.fill(cx, b.h + 1, cz, cx + 2, b.h + 4, cz + 2, B.WOOD);
        w.fill(cx, b.h + 5, cz, cx + 2, b.h + 5, cz + 2, B.ROOF);
      } else w.fill(cx, b.h + 1, cz, cx + 1, b.h + 2, cz + 1, B.METAL);
    }
    if (r() < 0.4) {
      const ax = b.x0 + 3 + Math.floor(r() * 4);
      for (let y = b.h + 1; y < b.h + 7; y++) w.set(ax, y, b.z0 + 3, B.METAL);
      w.set(ax, b.h + 7, b.z0 + 3, B.NEON_RED);
    }
  }

  // plaza: carve back the four building corners + pave
  for (let x = PLAZA.a; x <= PLAZA.b; x++)
    for (let z = PLAZA.a; z <= PLAZA.b; z++) {
      for (let y = 1; y < SY; y++) w.set(x, y, z, B.AIR);
      const onRoad = (x >= ST.a + 2 && x <= ST.b - 2) || (z >= AVE.a + 2 && z <= AVE.b - 2);
      w.set(x, 0, z, onRoad ? ((x + z) % 2 ? B.TILE : B.SIDEWALK) : B.TILE);
    }

  // ---- facade decoration: windows on every exposed vertical face ----
  const owner = new Int16Array(SX * SZ).fill(-1);
  buildings.forEach((b, i) => {
    for (let x = b.x0; x <= b.x1; x++) for (let z = b.z0; z <= b.z1; z++) owner[x + z * SX] = i;
  });
  const inAlley = (x: number, z: number) =>
    x >= ALLEY.x0 - 1 && x <= ALLEY.x1 + 1 && z >= ALLEY.z0 - 3 && z <= ALLEY.z1 - 1;
  for (let x = 0; x < SX; x++)
    for (let z = 0; z < SZ; z++) {
      const bi = owner[x + z * SX];
      if (bi < 0) continue;
      const b = buildings[bi];
      const dirs: [number, number][] = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ];
      for (const [dx, dz] of dirs) {
        const nx = x + dx,
          nz = z + dz;
        if (!w.inside(nx, 1, nz)) continue;
        const along = dx !== 0 ? z : x;
        for (let y = 2; y < b.h; y++) {
          if (w.get(x, y, z) !== b.wall) continue;
          if (w.get(nx, y, nz) !== B.AIR) continue;
          const darkSide = b.dark || inAlley(nx, nz);
          // ground floor band
          if (y <= 3) {
            if (y === 3) w.set(x, y, z, B.TRIM);
            continue;
          }
          if (y % b.winRow === 0) continue; // floor band
          if (along % b.winCol === 0) continue; // mullion
          const lit = !darkSide && r() < b.lit;
          w.set(x, y, z, lit ? (r() < 0.7 ? B.WIN_WARM : B.WIN_COOL) : B.GLASS_DARK);
        }
      }
    }

  // ---- landmarks ----
  const stations: Record<string, Station> = {};

  // door helper: on face at (x,z) facing dir, 2 wide 3 high, awning + lamp
  const door = (x: number, z: number, facing: Facing, mat: number, awn: number) => {
    const along: [number, number] = facing === 'N' || facing === 'S' ? [1, 0] : [0, 1];
    const out: [number, number] = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] }[facing] as [number, number];
    for (let k = 0; k < 2; k++)
      for (let y = 1; y <= 3; y++) w.set(x + along[0] * k, y, z + along[1] * k, y === 3 ? B.TRIM : mat);
    for (let k = -1; k < 3; k++) w.set(x + along[0] * k + out[0], 4, z + along[1] * k + out[1], k === 0 || k === 1 ? awn : B.TRIM);
  };

  // HOME (NW lot 0..19 x, 22..41 z), door on south face z=41
  door(9, 41, 'S', B.WOOD, B.NEON_AMBER);
  signs.push({ text: 'HOME', sub: 'apt 4B', color: '#ffb547', x: 10, y: 5.6, z: 42.02, facing: 'S', w: 3, h: 1.1 });
  stations.home = { id: 'home', x: 10, z: 44.5, label: 'Home' };

  // TAILOR & CO (SW lot 0..19, 54..73), door on north face z=54
  door(9, 54, 'N', B.METAL, B.NEON_RED);
  for (let x = 2; x <= 17; x++) w.set(x, 6, 54, B.NEON_RED);
  signs.push({ text: 'TAILOR & CO.', sub: 'we follow up', color: '#ff2b3b', x: 10, y: 8, z: 53.98, facing: 'N', w: 9, h: 2.2, flicker: true });
  stations.tailor = { id: 'tailor', x: 10, z: 50.4, npc: { x: 10, z: 52.5, yaw: Math.PI / 2 }, label: 'Tailor & Co.' };

  // NULLSTATE CAFE (SE lot 76..95, 54..73), north face z=54
  door(84, 54, 'N', B.GLASS_DARK, B.NEON_MINT);
  for (let x = 77; x <= 94; x++) {
    if (x >= 84 && x <= 85) continue;
    for (let y = 1; y <= 3; y++) {
      w.set(x, y, 54, B.AIR);
      w.set(x, y, 55, B.WIN_WARM); // hidden light source behind the interior picture
    }
    w.set(x, 4, 54, B.TRIM);
  }
  decals.push({ img: 'int_cafe', x: 86, y: 2.5, z: 54.97, facing: 'N', w: 18, h: 3, glow: 1.15, band: [0.56, 0.12] });
  signs.push({ text: 'NULLSTATE', sub: 'café · shielded only', color: '#9dffc4', x: 85, y: 6.2, z: 53.98, facing: 'N', w: 7, h: 1.8 });
  stations.cafe = { id: 'cafe', x: 85, z: 50.4, npc: { x: 85, z: 52.6, yaw: Math.PI / 2 }, label: 'Nullstate Café' };

  // 0dB ARCADE (SW lot 22..41, 76..95), east face x=41
  door(41, 84, 'E', B.GLASS_DARK, B.NEON_VIOLET);
  for (let z = 77; z <= 94; z++) {
    if (z >= 84 && z <= 85) continue;
    for (let y = 1; y <= 3; y++) {
      w.set(41, y, z, B.AIR);
      w.set(40, y, z, z % 2 ? B.NEON_PINK : B.NEON_VIOLET);
    }
    w.set(41, 4, z, B.TRIM);
  }
  decals.push({ img: 'int_arcade', x: 41.03, y: 2.5, z: 86, facing: 'E', w: 18, h: 3, glow: 1.2, band: [0.56, 0.18] });
  signs.push({ text: '0dB ARCADE', sub: 'insert coin', color: '#ff4fd8', x: 42.02, y: 6.4, z: 85, facing: 'E', w: 8, h: 2 });
  stations.arcade = { id: 'arcade', x: 44.5, z: 85, npc: { x: 43.4, z: 86.2, yaw: 0 }, label: '0dB Arcade' };

  // COBALT EXCHANGE (NE lot 76..95, 22..41), south face z=41
  door(87, 41, 'S', B.GLASS_DARK, B.NEON_CYAN);
  for (let x = 77; x <= 94; x++) w.set(x, 6, 41, B.NEON_CYAN);
  for (let x = 77; x <= 94; x++) {
    if (x >= 87 && x <= 88) continue;
    for (let y = 1; y <= 3; y++) {
      w.set(x, y, 41, B.AIR);
      w.set(x, y, 40, B.WIN_COOL);
    }
    w.set(x, 4, 41, B.TRIM);
  }
  decals.push({ img: 'int_exchange', x: 86, y: 2.5, z: 41.03, facing: 'S', w: 18, h: 3, glow: 1.1, band: [0.56, 0.16] });
  signs.push({ text: 'COBALT EXCHANGE', sub: 'cash out · public ledger', color: '#3fe6ff', x: 88, y: 8, z: 42.02, facing: 'S', w: 10, h: 2 });
  stations.exchange = { id: 'exchange', x: 88, z: 44.5, npc: { x: 89.6, z: 43.3, yaw: -Math.PI / 2 }, label: 'Cobalt Exchange' };

  // DARK ALLEY (NE, x 74..75), dead end with dumpsters
  w.fill(74, 1, 2, 75, 6, 2, B.DARKBRICK);
  w.fill(74, 1, 4, 75, 2, 5, B.PANEL_GREEN); // dumpster
  w.fill(74, 1, 12, 74, 1, 13, B.METAL);
  for (let z = 6; z <= 40; z += 7) w.set(73, 7 + (z % 3), z, B.METAL); // fire-escape bits
  signs.push({ text: 'NO CAMERAS', sub: 'beyond this point', color: '#6b7a73', x: 74.98, y: 3, z: 40, facing: 'W', w: 2.6, h: 0.9 });
  stations.alley = { id: 'alley', x: 74.9, z: 9, label: 'The Alley' };

  // COURIER SWAP KIOSK (plaza NW corner)
  w.fill(40, 1, 40, 41, 2, 41, B.METAL);
  w.fill(40, 3, 40, 41, 3, 41, B.NEON_AMBER);
  signs.push({ text: 'KIOSK', sub: 'noodles · coin swaps', color: '#ffb547', x: 41, y: 4.4, z: 42.02, facing: 'S', w: 2.6, h: 1 });
  stations.kiosk = { id: 'kiosk', x: 41, z: 43.6, npc: { x: 42.6, z: 42.6, yaw: -Math.PI * 0.75 }, label: 'Courier Kiosk' };

  // ZEC monument (plaza center): voxel Ƶ, 5 wide x 7 high, double-sided
  const Z = ['11111', '00001', '00010', '11111', '01000', '10000', '11111'];
  for (let row = 0; row < Z.length; row++)
    for (let col = 0; col < 5; col++)
      if (Z[row][col] === '1') {
        const y = 9 - row;
        w.set(46 + col, y, 48, B.NEON_ZEC);
        w.set(46 + col, y, 47, B.NEON_ZEC);
      }
  w.fill(45, 1, 46, 51, 1, 49, B.STONE);
  w.fill(48, 2, 47, 48, 2, 48, B.METAL);

  // billboards
  screens.push({ id: 'ledger', x: 30, y: 12.5, z: 42.04, facing: 'S', w: 14, h: 9 });
  screens.push({ id: 'mainnet', x: 53.96, y: 15, z: 30, facing: 'W', w: 16, h: 9 });
  // frames
  w.fill(22, 7, 41, 38, 7, 41, B.METAL);
  w.fill(22, 18, 41, 38, 18, 41, B.METAL);
  w.fill(54, 9, 21, 54, 9, 38, B.METAL);
  w.fill(54, 21, 21, 54, 21, 38, B.METAL);
  signs.push({ text: 'PUBLIC LEDGER', sub: 'every transparent payment in the city', color: '#c8ffdc', x: 30, y: 19.6, z: 42.04, facing: 'S', w: 12, h: 1.6 });
  signs.push({ text: 'ZCASH MAINNET · LIVE', sub: 'this part is not a game', color: '#ffb547', x: 53.96, y: 22.6, z: 30, facing: 'W', w: 12, h: 1.6 });

  // street lamps along sidewalks
  const lamp = (x: number, z: number) => {
    for (let y = 1; y <= 4; y++) w.set(x, y, z, B.METAL);
    w.set(x, 5, z, B.LAMP);
    lamps.push({ x, y: 5, z });
  };
  for (let t = 4; t < SX; t += 9) {
    if (t >= PLAZA.a - 1 && t <= PLAZA.b + 1) continue;
    if (t >= 70 && t <= 78) continue; // keep alley mouth dark
    lamp(t, AVE.a + 1);
    lamp(t + 4, AVE.b - 1);
    lamp(ST.a + 1, t);
    lamp(ST.b - 1, t + 4);
  }
  // clear any lamp that landed in a doorway path
  for (const s of Object.values(stations)) {
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++) {
        const x = Math.floor(s.x) + dx,
          z = Math.floor(s.z) + dz;
        if (w.get(x, 1, z) === B.METAL && w.get(x, 5, z) === B.LAMP) for (let y = 1; y <= 5; y++) w.set(x, y, z, B.AIR);
      }
  }

  // world edge: tall dark walls closing road ends
  for (const [x0, x1] of [
    [0, 0],
    [SX - 1, SX - 1],
  ]) w.fill(x0, 1, AVE.a, x1, 22, AVE.b, B.DARKBRICK);
  for (const [z0, z1] of [
    [0, 0],
    [SZ - 1, SZ - 1],
  ]) w.fill(ST.a, 1, z0, ST.b, 22, z1, B.DARKBRICK);

  // planters with voxel shrubs (café + home frontage)
  for (const [x, z] of [[79, 52], [92, 52], [5, 43], [15, 43], [57, 43], [67, 43]]) {
    if (w.get(x, 1, z) !== B.AIR) continue;
    w.set(x, 1, z, B.STONE);
    w.set(x, 2, z, B.LEAF);
    if ((x + z) % 2) w.set(x, 3, z, B.LEAF);
  }
  // café chalkboard sign
  signs.push({ text: 'COFFEE', sub: 'shielded only · memos welcome', color: '#e9e3d0', x: 81, y: 1.45, z: 52.4, facing: 'N', w: 1.4, h: 0.9 });
  const steam = [
    { x: 74.9, z: 14 },
    { x: 74.9, z: 30 },
    { x: 47.5, z: 60 },
    { x: 30, z: 47.5 },
    { x: 66, z: 48.5 },
  ];

  // street posters (Codex concept art) on tall facades
  decals.push({ img: 'ad_nullstate', x: 42.03, y: 7.5, z: 10, facing: 'E', w: 3.2, h: 6.2, glow: 1.3 });
  decals.push({ img: 'ad_shield', x: 31, y: 7.5, z: 53.97, facing: 'N', w: 3.2, h: 6.2, glow: 1.3 });
  decals.push({ img: 'ad_cobalt', x: 53.97, y: 7.5, z: 64, facing: 'W', w: 3.2, h: 6.2, glow: 1.3 });
  decals.push({ img: 'ad_arcade', x: 53.97, y: 7.5, z: 86, facing: 'W', w: 3.2, h: 6.2, glow: 1.3 });
  decals.push({ img: 'ad_shield', x: 42.03, y: 7.5, z: 64, facing: 'E', w: 3.2, h: 6.2, glow: 1.3 });
  // hanging neon banners sticking out over the avenue sidewalks
  const banX = [6, 15, 27, 61, 70, 83, 91];
  banX.forEach((x, k) => {
    const north = k % 2 === 0;
    const z = north ? 42.7 : 53.3;
    const wz = north ? 41 : 54;
    if (w.get(x, 8, wz) === B.AIR) return;
    for (let y = 9; y <= 9; y++) w.set(x, y, north ? 42 : 53, B.METAL);
    decals.push({ img: `banner_${k % 4}`, x: x + 0.5, y: 7.4, z, facing: 'X', w: 1.3, h: 4.6, glow: 1.4 });
  });

  const tags: Tag[] = [
    { x: 75.98, y: 2.2, z: 8, facing: 'W', px: 75, pz: 8, fact: 'Shielded (private) addresses usually start with *u1*. Transparent (public) ones start with *t1* or *t3*.' },
    { x: 39.98, y: 2.0, z: 40.5, facing: 'W', px: 39, pz: 40.5, fact: 'A memo is a private note of up to 512 bytes. It travels encrypted with the payment, so only the receiver can read it.' },
    { x: 20.02, y: 2.2, z: 60, facing: 'E', px: 21, pz: 60, fact: 'Chain-analysis firms really do watch public ledgers and link addresses to people. That is why money sitting in a transparent address is risky.' },
    { x: 30, y: 2.2, z: 75.98, facing: 'N', px: 30, pz: 75, fact: 'Zero-knowledge proofs let the network check that a payment is valid without learning who sent it, who got it, or how much.' },
    { x: 75.98, y: 2.2, z: 64, facing: 'W', px: 75, pz: 64, fact: 'Your 24 words can restore your wallet on a new phone. Lose them and nobody, not even the wallet maker, can get your money back.' },
    { x: 53.98, y: 2.4, z: 12, facing: 'W', px: 53, pz: 12, fact: 'Shielding hides the who and the how much. It does not hide that money went in or came out of the pool, so timing and amounts still matter.' },
  ].map((t, id) => ({ ...t, id }) as Tag);
  for (const t of tags) {
    signs.push({ text: 'Ƶ', color: '#9dffc4', x: t.x, y: t.y, z: t.z, facing: t.facing, w: 0.9, h: 0.9, flicker: true });
  }

  w.computeLight();

  // walk grid
  const walk = new Uint8Array(SX * SZ);
  for (let x = 0; x < SX; x++)
    for (let z = 0; z < SZ; z++) walk[x + z * SX] = w.solid(x, 0, z) && !w.solid(x, 1, z) && !w.solid(x, 2, z) ? 1 : 0;

  return { world: w, signs, screens, stations, walk, lamps, spawn: { x: 10.5, z: 44.5, yaw: Math.PI }, tags, decals, steam };
}
