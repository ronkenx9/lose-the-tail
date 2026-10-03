/** Simulated practice wallet + the Tailors' view of the public ledger. Pure logic, no DOM. */

export type Pocket = 'shielded' | 'transparent';

export interface Tx {
  id: string;
  /** game minutes since 00:00 of day 1 (18:00 = 1080) */
  at: number;
  kind: 'receive' | 'send' | 'shield' | 'unshield' | 'swap';
  amount: number;
  /** what the public chain shows */
  publicView: string;
  who?: string;
  memo?: string;
  pocket: Pocket;
}

export interface Clue {
  key: 'address' | 'amount' | 'face' | 'place' | 'link';
  text: string;
}

export interface GameState {
  beat: string;
  clock: number;
  wallet: { shielded: number; transparent: number; created: boolean };
  txs: Tx[];
  clues: Clue[];
  /** when the visible public money started a trace (game clock, real seconds remaining) */
  trace: { left: number; total: number; reason: string } | null;
  hooded: boolean;
  errands: { cafe: boolean; friend: boolean; exchange: boolean; swap: boolean };
  tags: string[];
  caughtCount: number;
  /** the shield event the Tailor will try to match an exit against */
  lastShield: { at: number; amount: number } | null;
}

export const ADDR = {
  you_t: 't1YouR3a1Pub1icAddr8sKq2Zf3',
  you_u: 'u1shld8x0q…7zk4m2nqv9',
  cafe: 'u1nullstate…cafe9z',
  friend: 'u1mika…g3m1n1',
  exchange: 't1Cobalt3xchangeDep0s1t77',
};

export function fresh(): GameState {
  return {
    beat: 'intro',
    clock: 18 * 60,
    wallet: { shielded: 0, transparent: 0, created: false },
    txs: [],
    clues: [],
    trace: null,
    hooded: false,
    errands: { cafe: false, friend: false, exchange: false, swap: false },
    tags: [],
    caughtCount: 0,
    lastShield: null,
  };
}

export const clone = (s: GameState): GameState => JSON.parse(JSON.stringify(s));

export function fmtClock(m: number) {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.floor(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export const fmtZec = (n: number) => (Math.round(n * 1000) / 1000).toFixed(n < 1 ? 3 : 2);

let txn = 0;
export function addTx(s: GameState, t: Omit<Tx, 'id' | 'at'>) {
  const tx: Tx = { ...t, id: `tx${++txn}`, at: s.clock };
  s.txs.unshift(tx);
  return tx;
}

export function addClue(s: GameState, c: Clue) {
  if (!s.clues.find((o) => o.key === c.key)) s.clues.push(c);
}

/**
 * The Tailors' matcher: they saw `shield.amount` enter the shielded pool at `shield.at`.
 * An exit of a similar amount soon after is a probable match. Mirrors how amount/timing
 * correlation de-anonymizes real users (the pool's in/out values are public).
 */
export function tailorMatch(shield: { at: number; amount: number } | null, exitAmount: number, exitAt: number) {
  if (!shield) return { match: false, score: 0, others: 0, why: 'nothing to match' };
  const amountRatio = exitAmount / shield.amount;
  const minutes = exitAt - shield.at;
  // other exits in the window: the busier the pool, the more cover
  const others = Math.max(3, Math.round(minutes / 6));
  const amountClose = amountRatio > 0.8 && amountRatio <= 1.0;
  const fast = minutes < 180;
  const score = (amountClose ? 0.6 : amountRatio > 0.5 ? 0.25 : 0.05) + (fast ? 0.3 : 0.05) + (others < 10 ? 0.1 : 0);
  return {
    match: score >= 0.75,
    score: Math.min(0.99, score),
    others,
    why: amountClose
      ? `${fmtZec(exitAmount)} out, ${Math.round(minutes)} min after ${fmtZec(shield.amount)} went in`
      : `${fmtZec(exitAmount)} out — ${others} other exits tonight`,
  };
}
