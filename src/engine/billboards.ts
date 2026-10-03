import type { Stage } from './scene';
import snapshot from '../data/mainnet-snapshot.json';
import { ATLAS_URL, headByRole } from './characters';
import heads from '../data/heads.json';

type Kind = 'public' | 'shielding' | 'unshielding' | 'shielded' | 'mined';
interface ChainTx {
  hash: string;
  time: string;
  kind: Kind;
  inZec: number;
  outZec: number;
}

function classify(t: any): ChainTx {
  const ti = t.input_count ?? 0,
    to = t.output_count ?? 0;
  const kind: Kind = t.is_coinbase ? 'mined' : ti === 0 && to === 0 ? 'shielded' : ti > 0 && to === 0 ? 'shielding' : ti === 0 && to > 0 ? 'unshielding' : 'public';
  return { hash: t.hash, time: String(t.time ?? '').slice(11, 19), kind, inZec: (t.input_total ?? 0) / 1e8, outZec: (t.output_total ?? 0) / 1e8 };
}

export interface LedgerRow {
  time: string;
  from: string;
  to: string;
  amount: string;
  place: string;
  you?: boolean;
  hidden?: boolean;
}

const MINT = '#c8ffdc';
const RED = '#ff2b3b';
const AMBER = '#ffb547';

export class Billboards {
  private atlas = new Image();
  private live: ChainTx[] = (snapshot as any[]).map(classify);
  private liveState: 'snapshot' | 'live' = 'snapshot';
  private height = 0;
  rows: LedgerRow[] = [];
  /** big face on the ledger screen: 'you' while exposed */
  face: { role: string; mode: 'exposed' | 'static' } | null = null;
  private t = 0;
  private lastFetch = -1e9;
  private cityTimer = 0;

  constructor(private stage: Stage) {
    this.atlas.src = ATLAS_URL;
    for (let i = 0; i < 9; i++) this.rows.push(cityRow());
  }

  push(row: LedgerRow) {
    this.rows.unshift(row);
    this.rows = this.rows.slice(0, 12);
  }

  async refresh() {
    try {
      const r = await fetch('https://api.blockchair.com/zcash/transactions?limit=24&s=id(desc)');
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      this.live = j.data.map(classify);
      this.height = j.data[0]?.block_id ?? 0;
      this.liveState = 'live';
    } catch {
      this.liveState = 'snapshot';
    }
  }

  /** the latest real shielded tx (for story beats) */
  latestShielded() {
    return this.live.find((t) => t.kind === 'shielded') ?? null;
  }
  get liveTxs() {
    return this.live;
  }

  update(dt: number, clock: string) {
    this.t += dt;
    if (this.t - this.lastFetch > 25) {
      this.lastFetch = this.t;
      this.refresh();
    }
    this.cityTimer -= dt;
    if (this.cityTimer <= 0) {
      this.cityTimer = 3 + Math.random() * 4;
      const r = cityRow();
      r.time = clock;
      this.push(r);
    }
    // throttle redraws to ~8 fps
    if (Math.floor(this.t * 8) === Math.floor((this.t - dt) * 8)) return;
    this.drawLedger();
    this.drawMainnet();
  }

  private drawLedger() {
    const s = this.stage.screens.ledger;
    const g = s.canvas.getContext('2d')!;
    const W = s.canvas.width,
      H = s.canvas.height;
    g.fillStyle = '#020403';
    g.fillRect(0, 0, W, H);
    const faceW = this.face ? H * 0.62 : 0;
    // face panel
    if (this.face) {
      const head = headByRole(this.face.role);
      const cols = heads.cols;
      const sx = (head.i % cols) * 26,
        sy = Math.floor(head.i / cols) * 26;
      g.imageSmoothingEnabled = false;
      const fx = W - faceW - 14,
        fy = 64;
      g.fillStyle = this.face.mode === 'exposed' ? '#2a0306' : '#050807';
      g.fillRect(fx, fy - 6, faceW, faceW + 70);
      if (this.atlas.complete) g.drawImage(this.atlas, sx, sy, 26, 26, fx + 8, fy, faceW - 16, faceW - 16);
      if (this.face.mode === 'static') {
        for (let i = 0; i < 900; i++) {
          g.fillStyle = Math.random() < 0.5 ? '#111' : '#9aa';
          g.fillRect(fx + 8 + Math.random() * (faceW - 16), fy + Math.random() * (faceW - 16), 6, 3);
        }
      }
      g.font = '700 22px JetBrains Mono, monospace';
      g.textAlign = 'center';
      g.fillStyle = this.face.mode === 'exposed' ? RED : '#6f8f7c';
      const blink = this.face.mode === 'exposed' && Math.floor(this.t * 3) % 2 === 0;
      g.fillText(this.face.mode === 'exposed' ? (blink ? '● SUBJECT LOCATED' : 'SUBJECT LOCATED') : 'SIGNAL LOST', fx + faceW / 2, fy + faceW + 24);
      g.font = '400 16px JetBrains Mono, monospace';
      g.fillText(this.face.mode === 'exposed' ? 'public pocket active' : 'funds shielded', fx + faceW / 2, fy + faceW + 50);
    }
    g.textAlign = 'left';
    g.font = '700 22px JetBrains Mono, monospace';
    g.fillStyle = MINT;
    g.fillText('TIME   FROM            TO              ZEC      WHERE', 22, 44);
    g.fillStyle = '#1d3327';
    g.fillRect(22, 54, W - faceW - 60, 2);
    const rowH = 38;
    this.rows.slice(0, Math.floor((H - 70) / rowH)).forEach((r, i) => {
      const y = 92 + i * rowH;
      if (r.you) {
        g.fillStyle = '#3a060b';
        g.fillRect(16, y - 26, W - faceW - 48, rowH - 4);
      }
      g.font = `${r.you ? 700 : 400} 20px JetBrains Mono, monospace`;
      g.fillStyle = r.you ? '#ffd6d9' : r.hidden ? AMBER : i === 0 ? MINT : '#8fb8a0';
      g.fillText(`${r.time}  ${pad(r.from, 15)} ${pad(r.to, 15)} ${pad(r.amount, 8)} ${r.place}`, 22, y);
    });
    s.tex.needsUpdate = true;
  }

  private drawMainnet() {
    const s = this.stage.screens.mainnet;
    const g = s.canvas.getContext('2d')!;
    const W = s.canvas.width,
      H = s.canvas.height;
    g.fillStyle = '#030302';
    g.fillRect(0, 0, W, H);
    g.font = '700 22px JetBrains Mono, monospace';
    g.fillStyle = AMBER;
    const dot = Math.floor(this.t * 2) % 2 ? '●' : '○';
    g.fillText(
      this.liveState === 'live' ? `${dot} LIVE  zcash mainnet  block ${this.height || ''}` : `◌ last snapshot  zcash mainnet`,
      22,
      40,
    );
    g.fillStyle = '#3a2b10';
    g.fillRect(22, 52, W - 44, 2);
    const rowH = 37;
    const n = Math.floor((H - 76) / rowH);
    this.live.slice(0, n).forEach((t, i) => {
      const y = 88 + i * rowH;
      const hash = t.hash.slice(0, 8) + '…';
      let line = '',
        col = '#bfae8a';
      switch (t.kind) {
        case 'public':
          line = `${hash} PUBLIC       ${fmt(t.outZec)} ZEC  in:visible out:visible`;
          col = '#e8dcc0';
          break;
        case 'shielding':
          line = `${hash} → POOL       ${fmt(t.inZec)} ZEC  then: ████████████`;
          col = AMBER;
          break;
        case 'unshielding':
          line = `${hash} POOL →       ${fmt(t.outZec)} ZEC  from: ████████████`;
          col = '#ff9b6b';
          break;
        case 'shielded':
          line = `${hash} SHIELDED     ████ ZEC  from:█████ to:█████`;
          col = MINT;
          break;
        case 'mined':
          line = `${hash} NEW COINS    ${fmt(t.outZec)} ZEC  block reward`;
          col = '#7f7660';
      }
      g.font = '400 19px JetBrains Mono, monospace';
      g.fillStyle = col;
      g.fillText(line, 22, y);
    });
    s.tex.needsUpdate = true;
  }
}

function fmt(n: number) {
  return n >= 100 ? n.toFixed(0).padStart(7) : n.toFixed(3).padStart(7);
}
function pad(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
}

const PLACES = ['Ave & 2nd', 'Plaza', 'Ave & 7th', 'St & 12th', 'Market', 'Docks', 'Ave & 4th', 'North St'];
function rnd(n: number) {
  return Math.floor(Math.random() * n);
}
function taddr() {
  const c = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 't1';
  for (let i = 0; i < 5; i++) s += c[rnd(c.length)];
  return s + '…' + c[rnd(c.length)] + c[rnd(c.length)];
}
function cityRow(): LedgerRow {
  return {
    time: `${String(18 + rnd(1)).padStart(2, '0')}:${String(rnd(60)).padStart(2, '0')}`,
    from: taddr(),
    to: taddr(),
    amount: (Math.random() * 3).toFixed(3),
    place: PLACES[rnd(PLACES.length)],
  };
}
