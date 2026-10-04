import * as THREE from 'three';

/** The Thread's surveillance drones: voxel body, red eye, searchlight cone. */
export class Drone {
  group = new THREE.Group();
  cone: THREE.Mesh;
  eye: THREE.Mesh;
  pos = new THREE.Vector3();
  target = new THREE.Vector3();
  mode: 'patrol' | 'hunt' | 'search' | 'home' = 'patrol';
  private t = Math.random() * 10;
  private rotors: THREE.Mesh[] = [];
  private home: THREE.Vector3;
  locked = 0;

  constructor(scene: THREE.Scene, home: THREE.Vector3) {
    this.home = home.clone();
    this.pos.copy(home);
    const dark = new THREE.MeshBasicMaterial({ color: 0x1a1c22 });
    const mid = new THREE.MeshBasicMaterial({ color: 0x3a3f48 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.7), dark);
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.4), mid);
    top.position.y = 0.17;
    this.group.add(body, top);
    for (const [x, z] of [
      [0.5, 0.5],
      [-0.5, 0.5],
      [0.5, -0.5],
      [-0.5, -0.5],
    ]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.12), mid);
      arm.position.set(x * 0.8, 0.05, z * 0.8);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.03, 0.08), new THREE.MeshBasicMaterial({ color: 0x8a8f98, transparent: true, opacity: 0.7 }));
      rotor.position.set(x * 0.8, 0.12, z * 0.8);
      this.rotors.push(rotor);
      this.group.add(arm, rotor);
    }
    this.eye = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.16), new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 0.3, 0.3) }));
    this.eye.position.y = -0.14;
    this.group.add(this.eye);
    const coneGeo = new THREE.ConeGeometry(2.4, 9, 24, 1, true);
    coneGeo.translate(0, -4.5, 0);
    this.cone = new THREE.Mesh(
      coneGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff4050,
        transparent: true,
        opacity: 0.09,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.group.add(this.cone);
    this.group.position.copy(this.pos);
    scene.add(this.group);
  }

  update(dt: number, player: THREE.Vector3, exposed: boolean) {
    this.t += dt;
    let speed = 4;
    if (this.mode === 'hunt' && exposed) {
      this.target.set(player.x + Math.sin(this.t * 0.7) * 1.2, 7.5, player.z + Math.cos(this.t * 0.6) * 1.2);
      speed = 7;
    } else if (this.mode === 'search' || (this.mode === 'hunt' && !exposed)) {
      // circle the last known spot
      if (this.mode === 'hunt') this.mode = 'search';
      this.target.set(this.target.x + Math.sin(this.t) * 0.1, 11, this.target.z + Math.cos(this.t) * 0.1);
      speed = 2;
    } else if (this.mode === 'home') {
      this.target.copy(this.home);
    } else {
      this.target.set(this.home.x + Math.sin(this.t * 0.25) * 18, 13 + Math.sin(this.t) * 0.5, this.home.z + Math.cos(this.t * 0.31) * 12);
    }
    const d = this.target.clone().sub(this.pos);
    const l = d.length();
    if (l > 0.01) this.pos.addScaledVector(d, Math.min(1, (speed * dt) / l));
    this.group.position.copy(this.pos);
    this.group.position.y += Math.sin(this.t * 3) * 0.08;
    this.group.rotation.z = Math.max(-0.3, Math.min(0.3, -d.x * 0.05));
    this.group.rotation.x = Math.max(-0.3, Math.min(0.3, d.z * 0.05));
    for (const r of this.rotors) r.rotation.y += dt * 40;
    const hunting = this.mode === 'hunt' && exposed;
    const near = hunting && Math.hypot(this.pos.x - player.x, this.pos.z - player.z) < 3;
    this.locked = near ? Math.min(1, this.locked + dt) : Math.max(0, this.locked - dt * 2);
    const m = this.cone.material as THREE.MeshBasicMaterial;
    m.opacity = 0.05 + (hunting ? 0.08 : 0) + this.locked * 0.12 + (Math.sin(this.t * 20) > 0.6 && near ? 0.05 : 0);
    m.color.set(hunting ? 0xff3040 : 0xffd0a0);
    (this.eye.material as THREE.MeshBasicMaterial).color.setRGB(hunting ? 4 : 1.2, hunting ? 0.25 : 0.9, hunting ? 0.25 : 0.5);
  }
}

export class Drones {
  list: Drone[] = [];
  constructor(scene: THREE.Scene, homes: THREE.Vector3[]) {
    for (const h of homes) this.list.push(new Drone(scene, h));
  }
  hunt() {
    this.list.forEach((d) => (d.mode = 'hunt'));
  }
  lose() {
    this.list.forEach((d) => {
      if (d.mode === 'hunt') d.mode = 'search';
    });
  }
  patrol() {
    this.list.forEach((d) => (d.mode = 'patrol'));
  }
  update(dt: number, player: THREE.Vector3, exposed: boolean) {
    for (const d of this.list) d.update(dt, player, exposed);
  }
  /** 0..1 how hard the closest drone is locked on */
  get lock() {
    return Math.max(0, ...this.list.map((d) => d.locked));
  }
}
