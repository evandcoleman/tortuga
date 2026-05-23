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

  it('strips a leading markdown heading and emphasis from the output', async () => {
    const llm = {
      generateText: vi.fn().mockResolvedValue(
        '# New on Orpheus\n\nWe added *Euphoria* and **The Testaments** this week.',
      ),
    };
    const out = await generateIntro(llm, items, { appName: 'Orpheus' });
    expect(out).toBe('We added Euphoria and The Testaments this week.');
  });

  it('unwraps links and strips list/quote markers and inline code', async () => {
    const llm = {
      generateText: vi.fn().mockResolvedValue(
        '> Highlights:\n- Watch [Heat](https://x/y)\n- Try `vim`',
      ),
    };
    const out = await generateIntro(llm, items, { appName: 'Orpheus' });
    expect(out).toBe('Highlights: Watch Heat Try vim');
  });

  it('returns null when output is only markdown structure', async () => {
    const llm = { generateText: vi.fn().mockResolvedValue('# \n\n##  ') };
    expect(await generateIntro(llm, items, { appName: 'Orpheus' })).toBeNull();
  });

  it('shows the year only for titles notably older than the newest in the batch', async () => {
    const llm = { generateText: vi.fn().mockResolvedValue('ok') };
    const mixed: EnrichedItem[] = [
      { ...items[0], title: 'New Show', year: 2026 },
      { ...items[0], title: 'Last Year', year: 2025 },
      { ...items[0], title: 'Old Reel', year: 1949 },
    ];
    await generateIntro(llm, mixed, { appName: 'Orpheus' });
    const prompt = llm.generateText.mock.calls[0][0].prompt as string;
    expect(prompt).not.toContain('New Show (2026)');
    expect(prompt).not.toContain('Last Year (2025)');
    expect(prompt).toContain('Old Reel (1949)');
  });
});
