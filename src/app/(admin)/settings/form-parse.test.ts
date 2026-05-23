import { describe, it, expect } from 'vitest';
import { parseNewsletterForm } from './form-parse';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const base = {
  schedule: '0 9 * * SUN',
  timezone: 'America/New_York',
  schedule_enabled: 'on',
  lookback_days: '7',
  'email.provider': 'resend',
  'from.email': 'newsletter@example.com',
  'from.name': 'Orpheus',
  'filters.min_tmdb_rating': '6',
  'filters.dedupe_episodes_into_seasons': 'on',
  'filters.max_items_per_section': '12',
  'filters.exclude_genres': '',
  'commentary.enabled': '',
  'commentary.provider': 'anthropic',
  'commentary.model': '',
  'commentary.voice': '',
};

describe('parseNewsletterForm', () => {
  it('parses a valid form into a NewsletterConfig', () => {
    const r = parseNewsletterForm(fd(base));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.schedule).toBe('0 9 * * SUN');
      expect(r.config.schedule_enabled).toBe(true);
      expect(r.config.lookback_days).toBe(7);
      expect(r.config.filters.min_tmdb_rating).toBe(6);
    }
  });

  it('treats an absent checkbox as false', () => {
    const r = parseNewsletterForm(fd({ ...base, schedule_enabled: '' }));
    expect(r.ok && r.config.schedule_enabled).toBe(false);
  });

  it('parses the selected theme and defaults to editorial when blank', () => {
    const picked = parseNewsletterForm(fd({ ...base, theme: 'newsprint' }));
    expect(picked.ok && picked.config.theme).toBe('newsprint');
    const blank = parseNewsletterForm(fd(base));
    expect(blank.ok && blank.config.theme).toBe('editorial');
  });

  it('parses the AI disclaimer checkbox', () => {
    const on = parseNewsletterForm(fd({ ...base, 'commentary.disclaimer': 'on' }));
    expect(on.ok && on.config.commentary.disclaimer).toBe(true);
    const off = parseNewsletterForm(fd(base));
    expect(off.ok && off.config.commentary.disclaimer).toBe(false);
  });

  it('splits comma/newline lists and drops blanks', () => {
    const r = parseNewsletterForm(fd({ ...base, 'filters.exclude_genres': 'Horror, Reality\nNews' }));
    expect(r.ok && r.config.filters.exclude_genres).toEqual(['Horror', 'Reality', 'News']);
  });

  it('maps empty include_libraries to null (all libraries)', () => {
    const r = parseNewsletterForm(fd({ ...base, include_libraries: '' }));
    expect(r.ok && r.config.include_libraries).toBeNull();
  });

  it('omits optional extras when blank', () => {
    const r = parseNewsletterForm(fd(base));
    expect(r.ok && r.config.extras).toBeUndefined();
  });

  it('returns field errors for an invalid email', () => {
    const r = parseNewsletterForm(fd({ ...base, 'from.email': 'not-an-email' }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors['from.email']).toBeTruthy();
  });

  it('requires mailgun domain when provider is mailgun', () => {
    const r = parseNewsletterForm(fd({ ...base, 'email.provider': 'mailgun', 'email.mailgun.domain': '' }));
    expect(r.ok).toBe(false);
  });

  it('round-trips plex.server_id and featured.enabled (carried via hidden inputs)', () => {
    const r = parseNewsletterForm(fd({ ...base, 'plex.server_id': 'abc123', 'featured.enabled': 'on' }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.plex?.server_id).toBe('abc123');
      expect(r.config.featured.enabled).toBe(true);
    }
  });
});
