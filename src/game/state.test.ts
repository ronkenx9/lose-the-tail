import { describe, expect, it } from 'vitest';
import { tailorMatch } from './state';

describe('tailorMatch (amount + timing correlation)', () => {
  const shield = { at: 18 * 60, amount: 5 };
  it('catches cashing out nearly everything soon after', () => {
    expect(tailorMatch(shield, 4.95, 18 * 60 + 3).match).toBe(true);
    expect(tailorMatch(shield, 5.43, 18 * 60 + 60).match).toBe(true);
  });
  it('lets a small, different exit through', () => {
    expect(tailorMatch(shield, 1.2, 18 * 60 + 60).match).toBe(false);
  });
  it('lets a similar amount through when it is much later and the pool is busy', () => {
    expect(tailorMatch(shield, 4.9, 18 * 60 + 600).match).toBe(false);
  });
  it('never matches without a shield event', () => {
    expect(tailorMatch(null, 5, 1200).match).toBe(false);
  });
});
