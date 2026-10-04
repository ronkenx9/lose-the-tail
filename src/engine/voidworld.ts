import * as THREE from 'three';
import { B, VoxelWorld, buildMeshes } from './voxels';
import { SX, SZ, rng } from './city';

/**
 * The void between loops: a floating voxel island in black space, its glowing rim,
 * broken pillars, drifting rock fragments and rising white cubes. Walkable, fully 3D.
 */
export function buildVoid() {
  const Y = 11; // island top block (local); scene is shifted so its surface sits at y = 1
  const w = new VoxelWorld(SX, 26, SZ);
  const cx = 48,
    cz = 48,
    R = 9;
  const r = rng(77);
  for (let x = cx - R - 2; x <= cx + R + 2; x++)
    for (let z = cz - R - 2; z <= cz + R + 2; z++) {
      const d = Math.hypot(x - cx, z - cz);
      if (d > R + 0.5) continue;
      const depth = Math.max(1, Math.round((R - d) * 0.9 + r() * 2));
      for (let y = Y - depth; y <= Y; y++) w.set(x, y, z, y === Y ? B.STONE : y > Y - 2 ? B.CONCRETE : B.DARKBRICK);
      if (d > R - 0.8) w.set(x, Y, z, B.NEON_MINT);
    }
  // an inlaid ring and a cross of light in the floor, like a sigil you're standing on
  for (let a = 0; a < Math.PI * 2; a += 0.06) {
    const x = Math.round(cx + Math.cos(a) * 4.5),
      z = Math.round(cz + Math.sin(a) * 4.5);
    if (Math.floor(a * 6) % 2 === 0) w.set(x, Y, z, B.VOID_INLAY);
  }
  for (let k = -2; k <= 2; k++) {
    w.set(cx + k, Y, cz, B.VOID_INLAY);
    w.set(cx, Y, cz + k, B.VOID_INLAY);
  }
  // broken pillars
  for (const [px, pz, h] of [
    [cx - 6, cz - 4, 5],
    [cx + 6, cz - 5, 3],
    [cx - 5, cz + 5, 2],
    [cx + 5, cz + 5, 4],
  ]) for (let y = Y + 1; y <= Y + h; y++) w.set(px, y, pz, B.STONE);
  // drifting fragments
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2,
      dist = 14 + r() * 26;
    const fx = Math.round(cx + Math.cos(a) * dist),
      fz = Math.round(cz + Math.sin(a) * dist),
      fy = Math.round(3 + r() * 20);
    const s = 1 + Math.floor(r() * 2);
    w.fill(fx, fy, fz, fx + s, fy, fz + s, r() < 0.2 ? B.NEON_MINT : B.STONE);
    if (s > 1) w.set(fx, fy - 1, fz, B.DARKBRICK);
  }
  w.computeLight();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020304);
  scene.fog = new THREE.FogExp2(0x020304, 0.022);
  const mesh = buildMeshes(w);
  mesh.position.y = 1 - (Y + 1);
  scene.add(mesh);
  // stars
  const starGeo = new THREE.BufferGeometry();
  const sp: number[] = [];
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(160);
    sp.push(cx + v.x, v.y, cz + v.z);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc8ffdc, size: 0.9, sizeAttenuation: true, fog: false })));
  // rising cubes
  const N = 140;
  const cubes = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 1.25, 1.2) }), N);
  const seeds = Array.from({ length: N }, () => ({ x: cx + (r() * 2 - 1) * 26, z: cz + (r() * 2 - 1) * 26, y: r() * 20 - 8, s: 0.4 + r() * 1.2, v: 0.3 + r() * 0.7 }));
  scene.add(cubes);
  // walkable top of the island
  const walk = new Uint8Array(SX * SZ);
  for (let x = 0; x < SX; x++)
    for (let z = 0; z < SZ; z++) {
      const top = w.get(x, Y, z);
      if ((top === B.STONE || top === B.NEON_MINT || top === B.VOID_INLAY) && w.get(x, Y + 1, z) === 0 && Math.hypot(x - cx, z - cz) < R - 0.6) walk[x + z * SX] = 1;
    }
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let t = 0;
  // what you leaked, floating around you as pages of their file
  const pages: { mesh: THREE.Mesh; a: number; r: number; y: number; s: number }[] = [];
  const pageTex = (key: string, text: string) => {
    const cv = document.createElement('canvas');
    cv.width = 512;
    cv.height = 160;
    const g = cv.getContext('2d')!;
    g.fillStyle = 'rgba(30,4,8,0.88)';
    g.fillRect(0, 0, 512, 160);
    g.strokeStyle = '#ff2b3b';
    g.lineWidth = 4;
    g.strokeRect(4, 4, 504, 152);
    g.fillStyle = '#ff4757';
    g.font = '600 26px ui-monospace, Menlo, monospace';
    g.fillText('TAILOR & CO. · ' + key.toUpperCase(), 24, 48);
    g.fillStyle = '#f4f0e8';
    g.font = '500 30px ui-monospace, Menlo, monospace';
    const words = text.split(' ');
    let line = '',
      y = 96;
    for (const wd of words) {
      if (g.measureText(line + wd).width > 460) {
        g.fillText(line, 24, y);
        line = '';
        y += 36;
      }
      line += wd + ' ';
    }
    g.fillText(line, 24, y);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };
  const showClues = (clues: { key: string; text: string }[]) => {
    for (const p of pages) scene.remove(p.mesh);
    pages.length = 0;
    clues.forEach((c, i) => {
      const mat = new THREE.MeshBasicMaterial({ map: pageTex(c.key, c.text), transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false });
      mat.color.setScalar(1.25);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), mat);
      scene.add(mesh);
      pages.push({ mesh, a: (i / clues.length) * Math.PI * 2, r: 6.2 + (i % 2) * 0.8, y: 2.2 + (i % 3) * 0.55, s: 0.12 + (i % 2) * 0.05 });
    });
  };
  return {
    scene,
    walk,
    spawn: { x: cx + 0.5, z: cz + 6.5, yaw: 0 },
    zeroAt: { x: cx + 0.5, z: cz - 2.5 },
    showClues,
    update(dt: number, cam?: THREE.Camera) {
      t += dt;
      for (const p of pages) {
        const a = p.a + t * p.s;
        p.mesh.position.set(cx + 0.5 + Math.cos(a) * p.r, p.y + Math.sin(t * 0.8 + p.a) * 0.15, cz + 0.5 + Math.sin(a) * p.r);
        if (cam) p.mesh.lookAt(cam.position.x, p.mesh.position.y, cam.position.z);
      }
      seeds.forEach((s, i) => {
        const y = ((s.y + t * s.v + 30) % 30) - 10;
        q.setFromEuler(new THREE.Euler(t * s.v, t * 0.7 * s.v, 0));
        m4.compose(new THREE.Vector3(s.x, y, s.z), q, new THREE.Vector3(s.s, s.s, s.s));
        cubes.setMatrixAt(i, m4);
      });
      cubes.instanceMatrix.needsUpdate = true;
      mesh.position.y = 1 - (Y + 1) + Math.sin(t * 0.4) * 0.0;
    },
  };
}
