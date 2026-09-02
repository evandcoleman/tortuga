import { describe, it, expect } from 'vitest';
import { PortalConfigSchema } from '@/kernel/config/schema';
import { DEFAULT_PORTAL_ENTRIES } from '@/modules/portal/copy';
import { validatePortalConfig, deriveInitialEntries } from './validate';

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

  it('accepts a custom page entry with only html set (no markdown) — the mode a fresh page must be able to reach', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'page', slug: 'faq', label: 'FAQ', html: '<p>a</p>' }],
    });
    expect(r.ok).toBe(true);
  });

  it('accepts a custom link entry', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'link', label: 'Wiki', url: 'https://wiki.example.com' }],
    });
    expect(r.ok).toBe(true);
  });

  it('round-trips an optional description on a custom link entry', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'link', label: 'Wiki', url: 'https://wiki.example.com', description: 'Community-run wiki.' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const entry = r.config.custom[0];
      expect(entry.type === 'link' && entry.description).toBe('Community-run wiki.');
    }
  });

  it('round-trips an optional description on a custom page entry', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'page', slug: 'faq', label: 'FAQ', markdown: 'hi', description: 'Answers to common questions.' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const entry = r.config.custom[0];
      expect(entry.type === 'page' && entry.description).toBe('Answers to common questions.');
    }
  });

  it('rejects a description over 140 characters', () => {
    const r = validatePortalConfig({
      ...valid,
      custom: [{ type: 'link', label: 'Wiki', url: 'https://wiki.example.com', description: 'x'.repeat(141) }],
    });
    expect(r.ok).toBe(false);
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

  describe('entries', () => {
    it('round-trips order and hidden across every entry type', () => {
      const r = validatePortalConfig({
        ...valid,
        entries: [
          { type: 'builtin_link', link: 'plex', hidden: true },
          { type: 'link', label: 'Wiki', url: 'https://wiki.example.com' },
          { type: 'builtin_page', page: 'rules', label: 'Rules!', description: 'Read me' },
          { type: 'page', slug: 'faq', label: 'FAQ', markdown: 'hi', hidden: true },
        ],
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.config.entries).toEqual([
        { type: 'builtin_link', link: 'plex', hidden: true },
        { type: 'link', label: 'Wiki', url: 'https://wiki.example.com' },
        { type: 'builtin_page', page: 'rules', label: 'Rules!', description: 'Read me' },
        { type: 'page', slug: 'faq', label: 'FAQ', markdown: 'hi', hidden: true },
      ]);
    });

    it('omits label/description on a built-in entry with no overrides', () => {
      const r = validatePortalConfig({
        ...valid,
        entries: [{ type: 'builtin_page', page: 'getting_started' }],
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const entry = r.config.entries?.[0];
      expect(entry).toEqual({ type: 'builtin_page', page: 'getting_started' });
      expect(entry && 'label' in entry).toBe(false);
      expect(entry && 'description' in entry).toBe(false);
    });

    it('rejects a duplicate built-in page entry with a field error', () => {
      const r = validatePortalConfig({
        ...valid,
        entries: [
          { type: 'builtin_page', page: 'rules' },
          { type: 'builtin_page', page: 'rules' },
        ],
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(Object.values(r.errors).some(m => m.includes('duplicate built-in page entry'))).toBe(true);
    });

    it('rejects a duplicate built-in link entry with a field error', () => {
      const r = validatePortalConfig({
        ...valid,
        entries: [
          { type: 'builtin_link', link: 'status' },
          { type: 'builtin_link', link: 'status' },
        ],
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(Object.values(r.errors).some(m => m.includes('duplicate built-in link entry'))).toBe(true);
    });
  });

  describe('pages', () => {
    it('round-trips an optional title and eyebrow, omitting them when blank', () => {
      const r = validatePortalConfig({
        ...valid,
        pages: { getting_started: { enabled: true, title: 'Start here', eyebrow: 'Step 1' } },
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.config.pages.getting_started.title).toBe('Start here');
      expect(r.config.pages.getting_started.eyebrow).toBe('Step 1');
      expect(r.config.pages.rules.title).toBeUndefined();
      expect(r.config.pages.rules.eyebrow).toBeUndefined();
    });
  });

  describe('copy', () => {
    it('round-trips every optional string key', () => {
      const copy = {
        tagline: 'A',
        intro: 'B',
        tab_title: 'C',
        toc_heading: 'D',
        stuck_title: 'E',
        stuck_body: 'F',
        stuck_link_label: 'G',
        back_label: 'H',
        footer: 'I',
        custom_page_eyebrow: 'J',
      };
      const r = validatePortalConfig({ ...valid, copy });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.config.copy).toMatchObject(copy);
    });

    it('defaults both booleans to true and omits blank optional strings', () => {
      const r = validatePortalConfig({ ...valid, copy: {} });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.config.copy.show_stuck_card).toBe(true);
      expect(r.config.copy.show_footer).toBe(true);
      expect(r.config.copy.tagline).toBeUndefined();
    });

    it('round-trips both booleans set to false', () => {
      const r = validatePortalConfig({ ...valid, copy: { show_stuck_card: false, show_footer: false } });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.config.copy.show_stuck_card).toBe(false);
      expect(r.config.copy.show_footer).toBe(false);
    });
  });
});

describe('deriveInitialEntries', () => {
  it('returns entries unchanged when present', () => {
    const entries = [{ type: 'builtin_link' as const, link: 'plex' as const }];
    expect(deriveInitialEntries({ entries, custom: [] })).toBe(entries);
  });

  it('falls back to defaults + legacy custom when entries is unset', () => {
    const custom = [{ type: 'link' as const, label: 'Wiki', url: 'https://wiki.example.com' }];
    expect(deriveInitialEntries({ entries: undefined, custom })).toEqual([...DEFAULT_PORTAL_ENTRIES, ...custom]);
  });
});
