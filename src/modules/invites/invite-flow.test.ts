import { describe, it, expect, vi } from 'vitest';
import { createDb } from '@/kernel/db/client';
import { applyMigrations } from '@/kernel/db/migrate';
import { recipientsCache } from '@/modules/newsletter/schema';
import { seedWelcomeTemplate } from '@/modules/templates/seed';
import type { PlexClient, PlexResult } from '@/kernel/integrations/plex';
import type { EmailProvider } from '@/kernel/email/types';

import { createInvite } from './invite-flow';
import { getInviteByEmail, markInviteCancelled } from './service';

function makeDb() {
  const db = createDb(':memory:');
  applyMigrations(db);
  seedWelcomeTemplate(db);
  return db;
}

const config = { from: { email: 'server@example.com', name: 'My Server' }, theme: 'editorial', appearance: undefined };

function fakePlex(overrides: Partial<PlexClient> = {}): PlexClient {
  return {
    getSections: vi.fn(),
    invite: vi.fn(async (): Promise<PlexResult<{ id: string }>> => ({ ok: true, data: { id: '999' } })),
    getPendingInvites: vi.fn(),
    cancelInvite: vi.fn(),
    ...overrides,
  } as unknown as PlexClient;
}

function fakeProvider(overrides: Partial<EmailProvider> = {}): EmailProvider {
  return {
    name: 'resend',
    send: vi.fn(async () => ({ providerMessageId: 'msg_1', error: null })),
    verifyWebhook: vi.fn(),
    parseEvent: vi.fn(),
    ...overrides,
  } as unknown as EmailProvider;
}

describe('createInvite', () => {
  it('invites via Plex, upserts the invite row, sends the welcome email, and marks welcomeSentAt', async () => {
    const db = makeDb();
    const plex = fakePlex();
    const provider = fakeProvider();

    const result = await createInvite({ db, plex, provider, config }, { email: 'friend@example.com', sectionIds: ['1001'] });

    expect(result).toEqual({ status: 'sent' });
    expect(plex.invite).toHaveBeenCalledWith('friend@example.com', ['1001']);
    expect(provider.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'friend@example.com' }));
    // Transactional send: no List-Unsubscribe headers.
    expect(provider.send).toHaveBeenCalledWith(expect.not.objectContaining({ headers: expect.anything() }));

    const invite = getInviteByEmail(db, 'friend@example.com');
    expect(invite?.status).toBe('pending');
    expect(invite?.welcomeSentAt).not.toBeNull();
  });

  it('refuses to invite a deactivated/suppressed recipient', async () => {
    const db = makeDb();
    db.insert(recipientsCache).values({
      email: 'bounced@example.com', name: 'Bounced', lastSynced: new Date(), active: false, source: 'plex',
    }).run();
    const plex = fakePlex();
    const provider = fakeProvider();

    const result = await createInvite({ db, plex, provider, config }, { email: 'bounced@example.com', sectionIds: ['1001'] });

    expect(result).toEqual({
      status: 'refused',
      reason: 'suppressed',
      message: expect.stringContaining('deactivated'),
    });
    expect(plex.invite).not.toHaveBeenCalled();
    expect(getInviteByEmail(db, 'bounced@example.com')).toBeNull();
  });

  it('surfaces a Plex 422 as a duplicate refusal without touching the invites table', async () => {
    const db = makeDb();
    const plex = fakePlex({
      invite: vi.fn(async () => ({ ok: false, error: { type: 'duplicate', message: 'already invited' } })),
    });
    const provider = fakeProvider();

    const result = await createInvite({ db, plex, provider, config }, { email: 'friend@example.com', sectionIds: ['1001'] });

    expect(result).toEqual({ status: 'refused', reason: 'duplicate', message: 'already invited' });
    expect(provider.send).not.toHaveBeenCalled();
    expect(getInviteByEmail(db, 'friend@example.com')).toBeNull();
  });

  it('surfaces a non-duplicate Plex failure as a plex_error refusal', async () => {
    const db = makeDb();
    const plex = fakePlex({
      invite: vi.fn(async () => ({ ok: false, error: { type: 'http', status: 500, message: 'plex.tv returned HTTP 500' } })),
    });
    const provider = fakeProvider();

    const result = await createInvite({ db, plex, provider, config }, { email: 'friend@example.com', sectionIds: ['1001'] });

    expect(result).toEqual({ status: 'refused', reason: 'plex_error', message: 'plex.tv returned HTTP 500' });
    expect(getInviteByEmail(db, 'friend@example.com')).toBeNull();
  });

  it('keeps the invite row with welcomeSentAt null when the Plex invite succeeds but the email send fails — never rolls back the Plex invite', async () => {
    const db = makeDb();
    const plex = fakePlex();
    const provider = fakeProvider({
      send: vi.fn(async () => ({ providerMessageId: null, error: 'provider rejected the message' })),
    });

    const result = await createInvite({ db, plex, provider, config }, { email: 'friend@example.com', sectionIds: ['1001'] });

    expect(result).toEqual({ status: 'invited_welcome_failed', welcomeError: 'provider rejected the message' });
    expect(plex.invite).toHaveBeenCalledTimes(1);

    const invite = getInviteByEmail(db, 'friend@example.com');
    expect(invite).not.toBeNull();
    expect(invite?.status).toBe('pending');
    expect(invite?.welcomeSentAt).toBeNull();
  });

  it('resets a cancelled invite back to pending on re-invite', async () => {
    const db = makeDb();
    const plex = fakePlex();
    const provider = fakeProvider();

    await createInvite({ db, plex, provider, config }, { email: 'friend@example.com', sectionIds: ['1001'] });
    markInviteCancelled(db, 'friend@example.com');

    const result = await createInvite({ db, plex, provider, config }, { email: 'friend@example.com', sectionIds: ['1001', '1002'] });

    expect(result).toEqual({ status: 'sent' });
    const invite = getInviteByEmail(db, 'friend@example.com');
    expect(invite?.status).toBe('pending');
  });
});
