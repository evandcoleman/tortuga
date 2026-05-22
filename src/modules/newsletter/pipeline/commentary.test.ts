import { describe, it, expect, vi } from 'vitest';
import { generateIntro } from './commentary';
import type { EnrichedItem } from '../types';

const items: EnrichedItem[] = [{
  guid: 'g1', title: 'A Movie', mediaType: 'movie', libraryName: 'Movies',
  addedAt: new Date('2026-05-01T00:00:00Z'), year: 2021, rating: 7.4,
  posterUrl: null, overview: 'o',
}];

describe('generateIntro', () => {
  it('returns the trimmed blurb on success', async () => {
    const llm = { generateText: vi.fn().mockResolvedValue('  This week is great.  ') };
    const out = await generateIntro(llm, items, { appName: 'Tortuga' });
    expect(out).toBe('This week is great.');
  });

  it('returns null when the client throws (graceful degradation)', async () => {
    const llm = { generateText: vi.fn().mockRejectedValue(new Error('boom')) };
    const out = await generateIntro(llm, items, { appName: 'Tortuga' });
    expect(out).toBeNull();
  });

  it('uses the custom voice as the system prompt when provided', async () => {
    const llm = { generateText: vi.fn().mockResolvedValue('x') };
    await generateIntro(llm, items, { appName: 'Tortuga', voice: 'pirate captain' });
    expect(llm.generateText.mock.calls[0][0].system).toContain('pirate captain');
  });

  it('returns null when the model returns empty text', async () => {
    const llm = { generateText: vi.fn().mockResolvedValue('   ') };
    expect(await generateIntro(llm, items, { appName: 'Tortuga' })).toBeNull();
  });
});
