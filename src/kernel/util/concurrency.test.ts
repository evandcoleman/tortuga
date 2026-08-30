import { describe, it, expect, vi } from 'vitest';
import { mapWithConcurrency } from './concurrency';

describe('mapWithConcurrency', () => {
  it('maps every item and preserves input order in the output', async () => {
    const items = [1, 2, 3, 4, 5];
    const out = await mapWithConcurrency(items, 2, async (n) => n * 10);
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });

  it('never runs more than `limit` mapper calls concurrently', async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(r => setTimeout(r, 1));
      active--;
      return n;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it('returns an empty array for an empty input', async () => {
    const fn = vi.fn();
    const out = await mapWithConcurrency([], 4, fn);
    expect(out).toEqual([]);
    expect(fn).not.toHaveBeenCalled();
  });

  it('propagates a rejection from the mapper', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom');
        return n;
      }),
    ).rejects.toThrow('boom');
  });
});
