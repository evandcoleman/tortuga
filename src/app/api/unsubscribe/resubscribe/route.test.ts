import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { recipientsCache } from '@/modules/newsletter/schema';
import { recipientPreferences } from '@/modules/preferences/schema';
import { mintPreferencesToken } from '@/kernel/email/preferences-token';
import { getPreferences, setCategory } from '@/modules/preferences/repo';

const SESSION_SECRET = 'a'.repeat(32);
const APP_URL = 'http://localhost';

const db = createDb(':memory:');
applyMigrations(db);

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({ db, env: { SESSION_SECRET, APP_URL } }),
}));

import { POST } from './route';

function seedRecipient(email: string, active = true) {
  db.insert(recipientsCache).values({
    email, name: email, lastSynced: new Date(), active, source: 'manual',
  }).run();
}

function postReq(body: Record<string, string>): Request {
  const formData = new URLSearchParams(body);
  return new Request('http://localhost/api/unsubscribe/resubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
}

beforeEach(() => {
  db.delete(recipientsCache).run();
  db.delete(recipientPreferences).run();
});

describe('POST /api/unsubscribe/resubscribe', () => {
  it('flips the category back on (resubscribe)', async () => {
    const email = 'u@x.io';
    seedRecipient(email);
    setCategory(db, email, 'digest', false);
    const token = mintPreferencesToken(email, SESSION_SECRET);

    const res = await POST(postReq({ token, category: 'digest', enabled: 'true' }));
    expect(res.status).toBe(200);
    expect(getPreferences(db, email).digest).toBe(true);
  });

  it('opts out of the other category (also stop announcements)', async () => {
    const email = 'u@x.io';
    seedRecipient(email);
    const token = mintPreferencesToken(email, SESSION_SECRET);

    const res = await POST(postReq({ token, category: 'announcements', enabled: 'false' }));
    expect(res.status).toBe(200);
    const prefs = getPreferences(db, email);
    expect(prefs.announcements).toBe(false);
    expect(prefs.digest).toBe(true);
  });

  it('refuses when the recipient is hard-suppressed (active = false)', async () => {
    const email = 'suppressed@x.io';
    seedRecipient(email, false);
    const token = mintPreferencesToken(email, SESSION_SECRET);

    const res = await POST(postReq({ token, category: 'digest', enabled: 'true' }));
    expect(res.status).toBe(403);
    const text = await res.text();
    expect(text.toLowerCase()).toContain('disabled');
    // Preference was NOT changed.
    expect(getPreferences(db, email).digest).toBe(true);
  });

  it('rejects an invalid/tampered token', async () => {
    const res = await POST(postReq({ token: 'garbage', category: 'digest', enabled: 'true' }));
    expect(res.status).toBe(400);
  });

  it('rejects an unknown category', async () => {
    const email = 'u@x.io';
    seedRecipient(email);
    const token = mintPreferencesToken(email, SESSION_SECRET);
    const res = await POST(postReq({ token, category: 'bogus', enabled: 'true' }));
    expect(res.status).toBe(400);
  });
});
