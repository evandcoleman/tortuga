import { describe, it, expect } from 'vitest';
import { NewsletterConfigSchema } from '@/kernel/config/schema';
import { parseEmailConfigForm, parseEmailSecretsForm } from './form-parse';

function fd(entries: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
}

const current = NewsletterConfigSchema.parse({
  from: { email: 'newsletter@example.com', name: 'Orpheus' },
});

describe('parseEmailConfigForm', () => {
  it('parses valid resend config', () => {
    const r = parseEmailConfigForm(fd({ 'from.email': 'a@b.com', 'from.name': 'A', 'email.provider': 'resend' }), current);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.email.provider).toBe('resend');
  });

  it('requires a mailgun domain when provider is mailgun', () => {
    const r = parseEmailConfigForm(fd({ 'from.email': 'a@b.com', 'from.name': 'A', 'email.provider': 'mailgun' }), current);
    expect(r.ok).toBe(false);
  });

  it('parses mailgun domain and region', () => {
    const r = parseEmailConfigForm(
      fd({ 'from.email': 'a@b.com', 'from.name': 'A', 'email.provider': 'mailgun', 'email.mailgun.domain': 'mg.example.com', 'email.mailgun.region': 'eu' }),
      current,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.email.mailgun?.domain).toBe('mg.example.com');
      expect(r.config.email.mailgun?.region).toBe('eu');
    }
  });

  it('returns a field error for an invalid from email', () => {
    const r = parseEmailConfigForm(fd({ 'from.email': 'not-an-email', 'from.name': 'A', 'email.provider': 'resend' }), current);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors['from.email']).toBeTruthy();
  });

  it('keeps the existing mailgun domain/region when saving with provider=resend and the domain field is populated', () => {
    const withMailgun = {
      ...current,
      email: { provider: 'resend' as const, mailgun: { domain: 'mg.example.com', region: 'eu' as const } },
    };
    const r = parseEmailConfigForm(
      fd({
        'from.email': 'a@b.com', 'from.name': 'A', 'email.provider': 'resend',
        'email.mailgun.domain': 'mg.example.com', 'email.mailgun.region': 'eu',
      }),
      withMailgun,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.config.email.provider).toBe('resend');
      expect(r.config.email.mailgun?.domain).toBe('mg.example.com');
      expect(r.config.email.mailgun?.region).toBe('eu');
    }
  });

  it('round-trips fields owned by other settings pages (e.g. schedule) unchanged', () => {
    const withCustomSchedule = { ...current, schedule: '30 7 * * MON' };
    const r = parseEmailConfigForm(fd({ 'from.email': 'a@b.com', 'from.name': 'A', 'email.provider': 'resend' }), withCustomSchedule);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.config.schedule).toBe('30 7 * * MON');
  });
});

describe('parseEmailSecretsForm', () => {
  it('keeps every field undefined when the form is blank', () => {
    const patch = parseEmailSecretsForm(fd({}));
    expect(patch).toEqual({
      'resend.api_key': undefined,
      'resend.webhook_secret': undefined,
      'mailgun.api_key': undefined,
      'mailgun.webhook_signing_key': undefined,
    });
  });

  it('replaces a field when typed', () => {
    const patch = parseEmailSecretsForm(fd({ 'resend.api_key': 're_123' }));
    expect(patch['resend.api_key']).toBe('re_123');
  });

  it('clears a field when its clear checkbox is checked, even if a value is also present', () => {
    const patch = parseEmailSecretsForm(fd({ 'mailgun.api_key': 'ignored', 'mailgun.api_key__clear': 'on' }));
    expect(patch['mailgun.api_key']).toBeNull();
  });
});
