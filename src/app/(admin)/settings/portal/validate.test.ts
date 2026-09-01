import { describe, it, expect } from 'vitest';
import { PortalConfigSchema } from '@/kernel/config/schema';
import { validatePortalConfig } from './validate';

const valid = PortalConfigSchema.parse({
  enabled: true,
  domain: 'plex.example.com',
  links: { plex_url: 'https://app.plex.tv', request_url: 'https://request.example.com' },
});

describe('validatePortalConfig', () => {
  it('accepts a valid config and returns the parsed/defaulted result', () => {
    const r = validatePortalConfig(valid);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.enabled).toBe(true);
      expect(r.config.domain).toBe('plex.example.com');
    }
  });

  it('accepts an empty object (disabled defaults)', () => {
    const r = validatePortalConfig({});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.enabled).toBe(false);
  });

  it('rejects a reserved custom page slug', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'page', slug: 'rules', label: 'Rules 2', markdown: 'hi' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.values(r.errors).some(m => m.includes('reserved'))).toBe(true);
  });

  it('rejects an invalid custom page slug shape', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'page', slug: 'Not Valid!', label: 'Bad', markdown: 'hi' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.values(r.errors).some(m => m.includes('slug must match'))).toBe(true);
  });

  it('rejects duplicate custom page slugs', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [
        { type: 'page', slug: 'faq', label: 'FAQ', markdown: 'a' },
        { type: 'page', slug: 'faq', label: 'FAQ 2', markdown: 'b' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.values(r.errors).some(m => m.includes('duplicate custom page slug'))).toBe(true);
  });

  it('rejects a custom page entry with neither markdown nor html', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'page', slug: 'faq', label: 'FAQ' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.values(r.errors).some(m => m.includes('exactly one'))).toBe(true);
  });

  it('rejects a custom page entry with both markdown and html', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'page', slug: 'faq', label: 'FAQ', markdown: 'a', html: '<p>a</p>' }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.values(r.errors).some(m => m.includes('exactly one'))).toBe(true);
  });

  it('accepts a custom link entry', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'link', label: 'Wiki', url: 'https://wiki.example.com' }],
    });
    expect(r.ok).toBe(true);
  });

  it('rejects an invalid domain (empty string)', () => {
    const r = validatePortalConfig({ ...valid, domain: '' });
    expect(r.ok).toBe(false);
  });

  it('rejects an invalid plex_url', () => {
    const r = validatePortalConfig({ ...valid, links: { ...valid.links, plex_url: 'not-a-url' } });
    expect(r.ok).toBe(false);
  });

  it('rejects unknown top-level keys (strict schema)', () => {
    const r = validatePortalConfig({ ...valid, unknownField: true });
    expect(r.ok).toBe(false);
  });
});
