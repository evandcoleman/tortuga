import { describe, it, expect } from 'vitest';
import { generateDigestSlug } from './slug';

describe('generateDigestSlug', () => {
  it('encodes 16 bytes as URL-safe base64 with no padding', () => {
    const slug = generateDigestSlug();
    // 16 bytes -> 22 base64 chars with no padding.
    expect(slug).toHaveLength(22);
    expect(slug).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(slug).not.toContain('+');
    expect(slug).not.toContain('/');
    expect(slug).not.toContain('=');
  });

  it('generates unique slugs across many calls', () => {
    const slugs = new Set(Array.from({ length: 500 }, () => generateDigestSlug()));
    expect(slugs.size).toBe(500);
  });
});
