import { describe, expect, it, vi, afterEach } from 'vitest';
import { shouldSample } from './sampling.js';

describe('shouldSample', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns true when rate >= 1', () => {
    expect(shouldSample(1)).toBe(true);
    expect(shouldSample(1.5)).toBe(true);
  });

  it('returns false when rate <= 0', () => {
    expect(shouldSample(0)).toBe(false);
    expect(shouldSample(-1)).toBe(false);
  });

  it('uses Math.random for (0,1)', () => {
    const rnd = vi.spyOn(Math, 'random');
    rnd.mockReturnValue(0.09);
    expect(shouldSample(0.1)).toBe(true);
    rnd.mockReturnValue(0.11);
    expect(shouldSample(0.1)).toBe(false);
  });
});
