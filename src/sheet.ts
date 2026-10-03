import * as THREE from 'three';
import { Character, HEADS, Trails } from './engine/characters';

/** dev/promo: lineup of voxel characters next to their source portraits */
export function sheet() {
  const canvas = document.getElementById('gl') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xd9d6d0);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const pick = (location.search.match(/n=(\d+)/)?.[1] ?? '12') as string;
  const role = new URLSearchParams(location.search).get('role');
  const list = role ? HEADS.filter((h) => h.role === role) : HEADS.slice(0, +pick);
  const cols = Math.ceil(Math.sqrt(list.length * 1.8));
  const chars = list.map((h, k) => {
    const c = new Character(h);
    c.group.position.set((k % cols) * 1.3 - ((cols - 1) * 1.3) / 2, 0, Math.floor(k / cols) * 1.8);
    c.yaw = -Math.PI / 2 + 0.6;
    c.setLight(new THREE.Color(0.75, 0.75, 0.75));
    scene.add(c.group);
    return c;
  });
  const trails = new Trails(scene);
  const rows = Math.ceil(list.length / cols);
  cam.position.set(0, 3 + rows, 6 + rows * 2.6);
  cam.lookAt(0, 0.9, ((rows - 1) * 1.8) / 2);
  const resize = () => {
    renderer.setSize(innerWidth, innerHeight, false);
    cam.aspect = innerWidth / innerHeight;
    cam.updateProjectionMatrix();
  };
  resize();
  addEventListener('resize', resize);
  let last = performance.now(),
    t = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    t += dt;
    for (const c of chars) {
      c.speed = location.search.includes('walk') ? 1 : 0;
      c.yaw += dt * 0.5;
      c.update(dt);
    }
    trails.update(dt, chars, cam.position);
    renderer.render(scene, cam);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  (window as any).__sheet = { chars, cam };
}
