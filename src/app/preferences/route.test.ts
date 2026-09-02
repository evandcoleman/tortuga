import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { recipientsCache } from '@/modules/newsletter/schema';
import { recipientPreferences } from '@/modules/preferences/schema';
import { getPreferences } from '@/modules/preferences/repo';
import { mintPreferencesToken } from '@/kernel/email/preferences-token';
import { generateUnsubscribeToken } from '@/kernel/email/unsubscribe';

const SESSION_SECRET = 'a'.repeat(32);

const db = createDb(':memory:');
applyMigrations(db);

const state = {
  config: { newsletter: { include_libraries: ['Movies', 'TV Shows'] as string[] | null } },
};

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({ db, env: { SESSION_SECRET }, config: state.config }),
}));

import { GET, POST } from './route';

function getReq(token: string): Request {
  return new Request(`http://localhost/preferences?token=${encodeURIComponent(token)}`);
}

function postReq(token: string, fields: Record<string, string | string[]>): Request {
  const body = new URLSearchParams();
  body.set('token', token);
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) body.append(key, v);
    } else {
      body.set(key, value);
    }
  }
  return new Request('http://localhost/preferences', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
}

function insertRecipient(email: string, opts: { active?: boolean } = {}) {
  db.insert(recipientsCache).values({
    email, name: email, lastSynced: new Date(), active: opts.active ?? true, source: 'manual',
  }).run();
}

beforeEach(() => {
  db.delete(recipientPreferences).run();
  db.delete(recipientsCache).run();
  state.config = { newsletter: { include_libraries: ['Movies', 'TV Shows'] } };
});

describe('GET /preferences', () => {
  it('rejects an invalid/tampered token with 400', async () => {
    const res = await GET(getReq('not-a-real-token'));
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('invalid');
  });

  it('rejects an expired/missing token with 400', async () => {
    const res = await GET(getReq(''));
    expect(res.status).toBe(400);
  });

  it('shows the suppressed message with no form for a hard-suppressed recipient', async () => {
    const email = 'blocked@x.io';
    insertRecipient(email, { active: false });
    const token = mintPreferencesToken(email, SESSION_SECRET);

    const res = await GET(getReq(token));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('disabled');
    expect(text).not.toContain('<form');
  });

  it('renders all checkboxes checked by default for a normal recipient', async () => {
    const email = 'u@x.io';
    insertRecipient(email);
    const token = mintPreferencesToken(email, SESSION_SECRET);

    const res = await GET(getReq(token));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('<form');
    expect(text).toContain('name="digest"');
    expect(text).toContain('name="announcements"');
    expect(text).toContain('value="Movies"');
    expect(text).toContain('value="TV Shows"');
    // All checked by default.
    const checkboxCount = (text.match(/checked/g) ?? []).length;
    expect(checkboxCount).toBe(4);
  });

  it('reflects stored preferences with correct checked state', async () => {
    const email = 'u2@x.io';
    insertRecipient(email);
    db.insert(recipientPreferences).values({
      email, digest: false, announcements: true, libraries: JSON.stringify(['Movies']), updatedAt: new Date(),
    }).run();
    const token = mintPreferencesToken(email, SESSION_SECRET);

    const res = await GET(getReq(token));
    const text = await res.text();
    const digestField = text.match(/name="digest"[^>]*/)?.[0] ?? '';
    expect(digestField).not.toContain('checked');
    const announcementsField = text.match(/name="announcements"[^>]*/)?.[0] ?? '';
    expect(announcementsField).toContain('checked');
    const moviesField = text.match(/value="Movies"[^>]*/)?.[0] ?? '';
    expect(moviesField).toContain('checked');
    const tvField = text.match(/value="TV Shows"[^>]*/)?.[0] ?? '';
    expect(tvField).not.toContain('checked');
  });
});

describe('POST /preferences', () => {
  it('persists the submitted preferences and shows a confirmation', async () => {
    const email = 'u@x.io';
    insertRecipient(email);
    const token = mintPreferencesToken(email, SESSION_SECRET);

    const res = await POST(postReq(token, { digest: 'on', library: ['Movies'] }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('saved');

    const prefs = getPreferences(db, email);
    expect(prefs).toEqual({ digest: true, announcements: false, libraries: ['Movies'] });
  });

  it('rejects an unknown library with 400 and does not write', async () => {
    const email = 'u@x.io';
    insertRecipient(email);
    const token = mintPreferencesToken(email, SESSION_SECRET);

    const res = await POST(postReq(token, { digest: 'on', announcements: 'on', library: ['Movies', 'Nope'] }));
    expect(res.status).toBe(400);

    const row = db.select().from(recipientPreferences).all();
    expect(row).toHaveLength(0);
  });

  it('stores null libraries when every library is selected', async () => {
    const email = 'u@x.io';
    insertRecipient(email);
    const token = mintPreferencesToken(email, SESSION_SECRET);

    await POST(postReq(token, { digest: 'on', announcements: 'on', library: ['Movies', 'TV Shows'] }));

    const prefs = getPreferences(db, email);
    expect(prefs.libraries).toBeNull();
  });

  it('shows the suppressed message with no form and does not write for a hard-suppressed recipient', async () => {
    const email = 'blocked@x.io';
    insertRecipient(email, { active: false });
    const token = mintPreferencesToken(email, SESSION_SECRET);

    const res = await POST(postReq(token, { digest: 'on' }));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('disabled');
    expect(text).not.toContain('<form');

    const row = db.select().from(recipientPreferences).all();
    expect(row).toHaveLength(0);
  });

  it('rejects an unsubscribe-kind token replayed as a preferences token', async () => {
    const email = 'u@x.io';
    insertRecipient(email);
    const token = generateUnsubscribeToken(email, SESSION_SECRET);

    const res = await POST(postReq(token, { digest: 'on' }));
    expect(res.status).toBe(400);

    const row = db.select().from(recipientPreferences).all();
    expect(row).toHaveLength(0);
  });

  it('rejects an invalid token with 400 and does not write', async () => {
    const res = await POST(postReq('not-a-real-token', { digest: 'on' }));
    expect(res.status).toBe(400);

    const row = db.select().from(recipientPreferences).all();
    expect(row).toHaveLength(0);
  });
});
