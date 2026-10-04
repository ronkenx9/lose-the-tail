import * as THREE from 'three';
import type { Door } from './city';

/** Sliding glass doors: two panes per storefront that part when anyone walks up. Purely visual (the doorway is always walkable). */
export class Doors {
  private list: { d: Door; a: THREE.Group; b: THREE.Group; open: number; cx: number; cz: number; was: boolean }[] = [];

  constructor(scene: THREE.Scene, doors: Door[]) {
    const glass = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.55, 0.8, 0.9), transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const frame = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.08, 0.09, 0.1) });
    const handle = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 0.72, 0.75) });
    const pane = () => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(0.96, 2.96, 0.04), glass));
      for (const [w, h, x, y] of [
        [1, 0.06, 0, 1.48],
        [1, 0.06, 0, -1.48],
        [0.06, 2.96, -0.48, 0],
        [0.06, 2.96, 0.48, 0],
      ]) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), frame);
        m.position.set(x, y, 0);
        g.add(m);
      }
      const hd = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.1), handle);
      hd.position.set(0.38, 0, 0);
      hd.name = 'h';
      g.add(hd);
      return g;
    };
    for (const d of doors) {
      const a = pane(),
        b = pane();
      b.getObjectByName('h')!.position.x = -0.38;
      const root = new THREE.Group();
      // doorway spans door0..door0+2 along the facade line, centred in the facade cell
      if (d.line === 'z') root.position.set(d.door0 + 1, 2.5, d.at + 0.5);
      else {
        root.position.set(d.at + 0.5, 2.5, d.door0 + 1);
        root.rotation.y = Math.PI / 2;
      }
      root.add(a, b);
      scene.add(root);
      const cx = root.position.x,
        cz = root.position.z;
      this.list.push({ d, a, b, open: 0, cx, cz, was: false });
    }
  }

  /** returns true when a door near `ear` just started opening (for a whoosh) */
  update(dt: number, people: { x: number; z: number }[], ear: { x: number; z: number }) {
    let whoosh = false;
    for (const o of this.list) {
      const near = people.some((p) => Math.hypot(p.x - o.cx, p.z - o.cz) < 2.4);
      if (near && !o.was && Math.hypot(ear.x - o.cx, ear.z - o.cz) < 6) whoosh = true;
      o.was = near;
      o.open += ((near ? 1 : 0) - o.open) * Math.min(1, dt * (near ? 7 : 3.5));
      const e = o.open * o.open * (3 - 2 * o.open);
      o.a.position.x = -0.5 - e * 0.9;
      o.b.position.x = 0.5 + e * 0.9;
    }
    return whoosh;
  }
}
