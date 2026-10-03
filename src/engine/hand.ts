import * as THREE from 'three';
import { buildParts, headByRole } from './characters';

/** first-person voxel arm (Minecraft style), swaps sleeve when the hood goes up */
export class Hand {
  group = new THREE.Group();
  private arm: THREE.Mesh;
  private mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false });
  private raise = 0;
  private want = 0;
  private t = 0;

  constructor(private camera: THREE.Camera) {
    this.arm = new THREE.Mesh(buildParts(headByRole('you_bare')).arm, this.mat);
    this.arm.scale.setScalar(0.85);
    this.group.add(this.arm);
    camera.add(this.group);
    this.mat.color.setScalar(0.8);
  }
  setHood(on: boolean) {
    this.arm.geometry = buildParts(headByRole(on ? 'you_hood' : 'you_bare')).arm;
  }
  setRaised(up: boolean) {
    this.want = up ? 1 : 0;
  }
  update(dt: number, walk: number, bob: number) {
    this.t += dt;
    this.raise += (this.want - this.raise) * Math.min(1, dt * 8);
    const r = this.raise;
    const wx = Math.sin(bob) * 0.025 * walk,
      wy = Math.abs(Math.cos(bob)) * 0.02 * walk;
    this.group.position.set(0.3 - r * 0.12 + wx, -0.66 + r * 0.12 + wy + Math.sin(this.t * 1.3) * 0.004, -0.5 - r * 0.05);
    this.arm.rotation.set(1.7 - r * 0.3, 0.3 + r * 0.2, 0.35 - r * 0.15);
  }
  setLight(c: THREE.Color) {
    this.mat.color.setRGB(Math.max(0.55, c.r * 1.4), Math.max(0.55, c.g * 1.4), Math.max(0.55, c.b * 1.4));
  }
}
