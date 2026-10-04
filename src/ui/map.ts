import type { City } from '../engine/city';
import { SX, SZ } from '../engine/city';
import { B } from '../engine/voxels';

/** top-down city map for the phone's Map app */
export function makeMap(city: City, get: () => { x: number; z: number; yaw: number; goal: { x: number; z: number; label: string } | null }) {
  const base = document.createElement('canvas');
  base.width = SX * 3;
  base.height = SZ * 3;
  const g = base.getContext('2d')!;
  for (let x = 0; x < SX; x++)
    for (let z = 0; z < SZ; z++) {
      const top = city.world.get(x, 1, z);
      const ground = city.world.get(x, 0, z);
      let c = '#0b0e10';
      if (top !== B.AIR && top !== B.METAL && top !== B.STONE && top !== B.LEAF) c = '#161a20';
      else if (ground === B.ASPHALT || ground === B.PUDDLE || ground === B.LINE) c = '#24282f';
      else if (ground === B.SIDEWALK || ground === B.CURB) c = '#323740';
      else if (ground === B.TILE) c = '#2c2a33';
      else c = '#1c2026';
      g.fillStyle = c;
      g.fillRect(x * 3, z * 3, 3, 3);
    }
  const places: [string, string, string][] = [
    ['home', 'Home', '#6fb0ff'],
    ['cafe', 'Café', '#9dffc4'],
    ['arcade', 'Arcade', '#ff4fd8'],
    ['exchange', 'Cobalt', '#3fe6ff'],
    ['kiosk', 'Kiosk', '#ffb547'],
    ['tailor', 'Tailor', '#ffcf7a'],
    ['spindle', 'The Thread', '#ff2b3b'],
    ['mart', 'Mart', '#7dd3ff'],
    ['laundry', 'Laundry', '#c6a2ff'],
  ];
  return {
    draw(c: HTMLCanvasElement) {
      const ctx = c.getContext('2d')!;
      const k = c.width / base.width;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(base, 0, 0, c.width, c.height);
      ctx.font = '700 9px JetBrains Mono, monospace';
      ctx.textAlign = 'center';
      const t = performance.now() / 1000;
      for (const [id, label, col] of places) {
        const s = city.stations[id];
        if (!s) continue;
        const x = s.x * 3 * k,
          y = s.z * 3 * k;
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(x, y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8f3ec';
        ctx.fillText(label, x, id === 'tailor' || id === 'spindle' ? y + 12 : y - 6);
      }
      const p = get();
      if (p.goal) {
        const x = p.goal.x * 3 * k,
          y = p.goal.z * 3 * k;
        ctx.strokeStyle = '#ffb547';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6 + Math.sin(t * 4) * 2, 0, Math.PI * 2);
        ctx.stroke();
      }
      // player arrow
      const px = p.x * 3 * k,
        py = p.z * 3 * k;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(-p.yaw);
      ctx.fillStyle = '#c8ffdc';
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 5);
      ctx.lineTo(0, 2);
      ctx.lineTo(-5, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    },
  };
}
