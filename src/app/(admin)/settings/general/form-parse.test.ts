import { describe, it, expect } from 'vitest';
import { NewsletterConfigSchema } from '@/kernel/config/schema';
import { parseGeneralForm } from './form-parse';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const current = NewsletterConfigSchema.parse({
  from: { email: 'newsletter@example.com', name: 'Orpheus' },
});

const base = {
  schedule: '0 9 * * SUN',
  timezone: 'America/New_York',
  schedule_enabled: 'on',
  lookback_days: '7',
};

describe('parseGeneralForm', () => {
  it('parses valid general fields', () => {
    const r = parseGeneralForm(fd(base), current);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.schedule).toBe('0 9 * * SUN');
      expect(r.config.schedule_enabled).toBe(true);
      expect(r.config.lookback_days).toBe(7);
    }
  });

  it('treats an absent checkbox as false', () => {
    const r = parseGeneralForm(fd({ ...base, schedule_enabled: '' }), current);
    expect(r.ok && r.config.schedule_enabled).toBe(false);
  });

  it('parses plex.server_id when present', () => {
    const r = parseGeneralForm(fd({ ...base, 'plex.server_id': 'abc123' }), current);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.plex?.server_id).toBe('abc123');
  });

  it('omits plex when server_id is blank', () => {
    const r = parseGeneralForm(fd({ ...base, 'plex.server_id': '' }), current);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.plex).toBeUndefined();
  });

  it('rejects an invalid timezone', () => {
    const r = parseGeneralForm(fd({ ...base, timezone: 'Not/AZone' }), current);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors['timezone']).toBeTruthy();
  });

  it('round-trips fields owned by other settings pages (e.g. from.email) unchanged', () => {
    const withCustomFrom = { ...current, from: { email: 'custom@example.com', name: 'Custom' } };
    const r = parseGeneralForm(fd(base), withCustomFrom);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.from.email).toBe('custom@example.com');
  });
});
