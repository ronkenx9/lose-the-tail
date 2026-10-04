import * as THREE from 'three';
import type { Npcs, Npc } from '../engine/npcs';
import type { Player } from '../engine/player';
import type { HeadMeta } from '../engine/characters';

type Mode = 'idle' | 'hunt' | 'search' | 'leave';

/**
 * The Tailor's crew. While `tracking` is on (your public address is pinging) they know
 * where you are and run you down. When it goes off they search your last known spot,
 * then give up and walk home. Reaching you = caught.
 */
export class Crew {
  members: Npc[] = [];
  mode: Mode = 'idle';
  tracking = false;
  lastSeen = new THREE.Vector3();
  onCatch: (() => void) | null = null;
  onSpot: ((n: Npc) => void) | null = null;
  private repath = 0;
  private searchT = 0;
  private spotted = new Set<Npc>();
  caught = false;
  /** chase speed multiplier (1 = faster than walking, slower than sprinting) */
  pace = 1;

  constructor(
    private npcs: Npcs,
    private player: Player,
    private home: { x: number; z: number },
  ) {}

  spawn(heads: HeadMeta[], at: { x: number; z: number }[]) {
    this.clear();
    this.members = heads.map((h, k) => {
      const p = at[k % at.length];
      const n = this.npcs.spawn(h, p.x, p.z, { speedMul: 0.6, name: k === 0 ? 'Needle' : k === 1 ? 'Hem' : 'Tailor crew' });
      return n;
    });
    this.caught = false;
    this.spotted.clear();
  }

  clear() {
    for (const n of this.members) this.npcs.remove(n);
    this.members = [];
    this.mode = 'idle';
    this.tracking = false;
  }

  /** start the chase */
  hunt() {
    for (const n of this.members) n.wander = false;
    this.mode = 'hunt';
    this.tracking = true;
    this.caught = false;
    this.repath = 0;
  }
  /** you went dark: they lose the ping */
  lose() {
    this.tracking = false;
    if (this.mode === 'hunt') {
      this.mode = 'search';
      this.searchT = 12;
      this.lastSeen.set(this.player.x, 0, this.player.z);
    }
  }
  /** after they lose you: drift around the streets, eyeing faces */
  patrol() {
    this.mode = 'idle';
    this.tracking = false;
    for (const n of this.members) {
      n.speedMul = 0.62;
      n.wander = true;
      n.wait = Math.random() * 3;
      n.ch.lookAt = null;
    }
  }
  /** call them off */
  standDown() {
    this.mode = 'leave';
    this.tracking = false;
    for (const n of this.members) {
      n.speedMul = 0.55;
      this.npcs.send(n, this.home.x, this.home.z);
    }
  }

  /** nearest crew distance to the player */
  nearest() {
    let d = Infinity;
    for (const n of this.members) d = Math.min(d, Math.hypot(n.x - this.player.x, n.z - this.player.z));
    return d;
  }

  update(dt: number) {
    if (!this.members.length) return;
    const p = this.player;
    this.repath -= dt;
    if (this.mode === 'hunt' && this.tracking) {
      this.lastSeen.set(p.x, 0, p.z);
      if (this.repath <= 0) {
        this.repath = 0.45;
        this.members.forEach((n, k) => {
          // fan out: each pursuer aims at a slightly different point around you
          const a = (k / this.members.length) * Math.PI * 2;
          const d = Math.hypot(n.x - p.x, n.z - p.z);
          const off = d > 6 ? 1.6 : 0.3;
          n.speedMul = (d > 14 ? 1.9 : 1.68) * this.pace; // ~4.2–4.6 m/s: faster than walking, slower than sprinting
          if (!this.npcs.send(n, p.x + Math.cos(a) * off, p.z + Math.sin(a) * off)) this.npcs.send(n, p.x, p.z);
          n.ch.lookAt = new THREE.Vector3(p.x, 2, p.z);
        });
      }
      for (const n of this.members) {
        const d = Math.hypot(n.x - p.x, n.z - p.z);
        if (d < 9 && !this.spotted.has(n)) {
          this.spotted.add(n);
          this.onSpot?.(n);
        }
        if (d < 1.15 && !this.caught) {
          this.caught = true;
          this.mode = 'idle';
          this.onCatch?.();
        }
      }
    } else if (this.mode === 'search') {
      this.searchT -= dt;
      if (this.repath <= 0) {
        this.repath = 1.4;
        this.members.forEach((n, k) => {
          n.speedMul = 0.8;
          const a = k * 2.1 + this.searchT;
          this.npcs.send(n, this.lastSeen.x + Math.cos(a) * 4, this.lastSeen.z + Math.sin(a) * 4);
          n.ch.lookAt = null;
        });
      }
      if (this.searchT <= 0) this.patrol();
    } else if (this.mode === 'idle') {
      for (const n of this.members) if (n.ch.lookAt && Math.hypot(n.x - p.x, n.z - p.z) > 6) n.ch.lookAt = null;
    }
  }
}
