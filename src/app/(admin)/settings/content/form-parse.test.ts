import { describe, it, expect } from 'vitest';
import { NewsletterConfigSchema } from '@/kernel/config/schema';
import { parseContentForm } from './form-parse';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const current = NewsletterConfigSchema.parse({
  from: { email: 'newsletter@example.com', name: 'Orpheus' },
});

const base = {
  'filters.min_tmdb_rating': '6',
  'filters.dedupe_episodes_into_seasons': 'on',
  'filters.max_items_per_section': '12',
  'filters.exclude_genres': '',
  'commentary.enabled': '',
  'commentary.provider': 'anthropic',
  'commentary.model': '',
  'commentary.voice': '',
};

describe('parseContentForm', () => {
  it('parses valid content fields', () => {
    const r = parseContentForm(fd(base), current);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.filters.min_tmdb_rating).toBe(6);
  });

  it('splits comma/newline lists and drops blanks', () => {
    const r = parseContentForm(fd({ ...base, 'filters.exclude_genres': 'Horror, Reality\nNews' }), current);
    expect(r.ok && r.config.filters.exclude_genres).toEqual(['Horror', 'Reality', 'News']);
  });

  it('maps empty include_libraries to null (all libraries)', () => {
    const r = parseContentForm(fd({ ...base, include_libraries: '' }), current);
    expect(r.ok && r.config.include_libraries).toBeNull();
  });

  it('omits optional extras when blank', () => {
    const r = parseContentForm(fd(base), current);
    expect(r.ok && r.config.extras).toBeUndefined();
  });

  it('parses the AI disclaimer checkbox', () => {
    const on = parseContentForm(fd({ ...base, 'commentary.disclaimer': 'on' }), current);
    expect(on.ok && on.config.commentary.disclaimer).toBe(true);
  });

  it('defaults leaving when the form omits it entirely (e.g. Maintainerr disabled)', () => {
    const r = parseContentForm(fd(base), current);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.leaving).toEqual({
        enabled: true, days: 7, excluded_collection_ids: [], heading: 'Leaving soon',
      });
    }
  });

  it('parses leaving fields including a multi-value exclusions checklist', () => {
    const form = fd({ ...base, 'leaving.enabled': 'on', 'leaving.days': '14', 'leaving.heading': 'Rotating out' });
    form.append('leaving.excluded_collection_ids', '3');
    form.append('leaving.excluded_collection_ids', '9');
    const r = parseContentForm(form, current);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.leaving).toEqual({
        enabled: true, days: 14, excluded_collection_ids: [3, 9], heading: 'Rotating out',
      });
    }
  });

  it('rejects leaving.days of 0', () => {
    const r = parseContentForm(fd({ ...base, 'leaving.days': '0' }), current);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors['leaving.days']).toBeTruthy();
  });

  it('rejects leaving.days of 91', () => {
    const r = parseContentForm(fd({ ...base, 'leaving.days': '91' }), current);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors['leaving.days']).toBeTruthy();
  });

  it('round-trips fields owned by other settings pages (e.g. schedule) unchanged', () => {
    const withCustomSchedule = { ...current, schedule: '30 7 * * MON' };
    const r = parseContentForm(fd(base), withCustomSchedule);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.schedule).toBe('30 7 * * MON');
  });
});
