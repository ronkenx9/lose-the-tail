import * as THREE from 'three';
import type { Player } from './player';

export interface InputHandlers {
  /** tap on the world (not a drag). return true if handled */
  onTap(ray: THREE.Ray, ndc: THREE.Vector2): void;
}

/** drag to look, tap to walk / interact. Works for mouse + touch. */
export function bindInput(canvas: HTMLCanvasElement, camera: THREE.Camera, player: Player, h: InputHandlers) {
  let down: { x: number; y: number; id: number; moved: number; t: number } | null = null;
  let last = { x: 0, y: 0 };
  const sens = () => (matchMedia('(pointer: coarse)').matches ? 0.0055 : 0.0038);
  canvas.addEventListener('pointerdown', (e) => {
    if (down) return;
    down = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: 0, t: performance.now() };
    last = { x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!down || e.pointerId !== down.id) return;
    const dx = e.clientX - last.x,
      dy = e.clientY - last.y;
    last = { x: e.clientX, y: e.clientY };
    down.moved += Math.abs(dx) + Math.abs(dy);
    if (down.moved > 6 && !player.frozen) {
      player.yaw -= dx * sens();
      player.pitch = Math.max(-1.1, Math.min(0.9, player.pitch - dy * sens()));
    }
  });
  const up = (e: PointerEvent) => {
    if (!down || e.pointerId !== down.id) return;
    const wasTap = down.moved <= 6 && performance.now() - down.t < 900;
    down = null;
    if (!wasTap) return;
    const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const rc = new THREE.Raycaster();
    rc.setFromCamera(ndc, camera);
    h.onTap(rc.ray, ndc);
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => (down = null));
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** intersect a ray with the walk plane (y = 1) */
export function groundHit(ray: THREE.Ray): THREE.Vector3 | null {
  if (ray.direction.y > -0.01) return null;
  const t = (1 - ray.origin.y) / ray.direction.y;
  if (t > 70) return null;
  return ray.origin.clone().addScaledVector(ray.direction, t);
}
