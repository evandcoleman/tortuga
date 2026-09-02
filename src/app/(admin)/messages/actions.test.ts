import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const sendAnnouncement = vi.fn();
const getAppContext = vi.fn();
const requireAdminSession = vi.fn();
const scheduleAnnouncement = vi.fn();
const updateScheduledAnnouncement = vi.fn();
const cancelScheduledAnnouncement = vi.fn();

vi.mock('@/modules/announcements/pipeline/send', () => ({
  sendAnnouncement: (...args: unknown[]) => sendAnnouncement(...args),
}));

vi.mock('@/modules/announcements/pipeline/schedule', () => ({
  scheduleAnnouncement: (...args: unknown[]) => scheduleAnnouncement(...args),
  updateScheduledAnnouncement: (...args: unknown[]) => updateScheduledAnnouncement(...args),
  cancelScheduledAnnouncement: (...args: unknown[]) => cancelScheduledAnnouncement(...args),
}));

vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
}));

vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Minimal Drizzle query-builder stub: select().from().all()
function makeDb(recipientRows: Array<{ email: string; active: boolean }>) {
  const chain = {
    from: () => chain,
    all: () => recipientRows,
  };
  return { select: () => chain };
}

function makeCtx(
  recipientRows: Array<{ email: string; active: boolean }>,
  env: Partial<{ APP_URL: string; SESSION_SECRET: string; ADMIN_EMAIL: string | undefined }> = {},
) {
  return {
    db: makeDb(recipientRows),
    email: { name: 'resend' },
    env: { APP_URL: 'https://x.test', SESSION_SECRET: 'a'.repeat(32), ADMIN_EMAIL: undefined, ...env },
    config: {
      newsletter: {
        from: { email: 'news@tortuga.local', name: 'Tortuga' },
        reply_to: 'reply@tortuga.local',
        theme: 'gold',
        appearance: {},
        timezone: 'America/New_York',
      },
    },
  };
}

const ACTIVE_ROWS = [
  { email: 'alice@example.com', active: true },
  { email: 'bob@example.com', active: true },
  { email: 'carol@example.com', active: false },
];

import {
  previewAnnouncement,
  sendTestAnnouncement,
  sendAnnouncementToRecipients,
  scheduleAnnouncementToRecipients,
  updateScheduledAnnouncement as updateScheduledAnnouncementAction,
  cancelScheduledAnnouncement as cancelScheduledAnnouncementAction,
} from './actions';

describe('previewAnnouncement', () => {
  beforeEach(() => {
    sendAnnouncement.mockReset();
    getAppContext.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
  });

  it('rejects when there is no admin session', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(previewAnnouncement('Hello', 'body')).rejects.toThrow('Unauthorized');
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('rejects an empty subject', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));

    const result = await previewAnnouncement('   ', 'hello world');

    expect(result).toEqual({ success: false, error: 'Subject is required' });
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('rejects a subject over 200 characters', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));

    const result = await previewAnnouncement('x'.repeat(201), 'hello world');

    expect(result).toEqual({ success: false, error: 'Subject must be 200 characters or fewer' });
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('renders a dry-run and returns the html', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    sendAnnouncement.mockResolvedValue({ html: '<html>preview</html>', sent: 0, failed: 0 });

    const result = await previewAnnouncement('Hello', '# Hi');

    expect(result).toEqual({ success: true, html: '<html>preview</html>' });
    expect(sendAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({ appUrl: 'https://x.test' }),
      expect.objectContaining({ subject: 'Hello', body: '# Hi', recipientEmails: [], dryRun: true }),
    );
  });
});

describe('sendTestAnnouncement', () => {
  beforeEach(() => {
    sendAnnouncement.mockReset();
    getAppContext.mockReset();
    requireAdminSession.mockReset();
  });

  it('rejects when there is no admin session', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(sendTestAnnouncement('Hello', 'body')).rejects.toThrow('Unauthorized');
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('sends a single test copy to the signed-in admin, ignoring any client-supplied address', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    sendAnnouncement.mockResolvedValue({ html: '<html></html>', sent: 1, failed: 0 });

    const result = await sendTestAnnouncement('Hello', 'body');

    expect(result).toEqual({ success: true, sent: 1, failed: 0 });
    expect(sendAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ testRecipient: 'admin@example.com', recipientEmails: [] }),
    );
  });

  it('falls back to ADMIN_EMAIL when the session has no email (e.g. forward mode)', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS, { ADMIN_EMAIL: 'ops@tortuga.local' }));
    requireAdminSession.mockResolvedValue({ email: null });
    sendAnnouncement.mockResolvedValue({ html: '<html></html>', sent: 1, failed: 0 });

    const result = await sendTestAnnouncement('Hello', 'body');

    expect(result).toEqual({ success: true, sent: 1, failed: 0 });
    expect(sendAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ testRecipient: 'ops@tortuga.local' }),
    );
  });

  it('returns a validation error when no admin email is available at all', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    requireAdminSession.mockResolvedValue({ email: null });

    const result = await sendTestAnnouncement('Hello', 'body');

    expect(result).toEqual({ success: false, error: 'No admin email available for test send' });
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });
});

describe('sendAnnouncementToRecipients', () => {
  beforeEach(() => {
    sendAnnouncement.mockReset();
    getAppContext.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
  });

  it('rejects when there is no admin session', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(sendAnnouncementToRecipients('Hello', 'body', ['alice@example.com'])).rejects.toThrow(
      'Unauthorized',
    );
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('rejects an empty recipient list', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));

    const result = await sendAnnouncementToRecipients('Hello', 'body', []);

    expect(result).toEqual({ success: false, error: 'Select at least one recipient' });
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('rejects a recipient email that is not in the active set', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));

    const result = await sendAnnouncementToRecipients('Hello', 'body', ['alice@example.com', 'ghost@example.com']);

    expect(result.success).toBe(false);
    expect((result as { error: string }).error).toMatch(/not an active recipient/i);
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('rejects a recipient email that has been deactivated', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));

    const result = await sendAnnouncementToRecipients('Hello', 'body', ['carol@example.com']);

    expect(result.success).toBe(false);
    expect(sendAnnouncement).not.toHaveBeenCalled();
  });

  it('sends to valid active recipients and returns the announcement id', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    sendAnnouncement.mockResolvedValue({
      html: '<html></html>',
      announcementId: 'ann-1',
      sent: 2,
      failed: 0,
    });

    const result = await sendAnnouncementToRecipients('Hello', 'body', [
      'alice@example.com',
      'bob@example.com',
    ]);

    expect(result).toEqual({ success: true, announcementId: 'ann-1', sent: 2, failed: 0 });
    expect(sendAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subject: 'Hello',
        body: 'body',
        recipientEmails: ['alice@example.com', 'bob@example.com'],
      }),
    );
  });
});

describe('scheduleAnnouncementToRecipients', () => {
  beforeEach(() => {
    scheduleAnnouncement.mockReset();
    getAppContext.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('rejects when there is no admin session', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(
      scheduleAnnouncementToRecipients('Hello', 'body', ['alice@example.com'], '2026-06-15T09:00'),
    ).rejects.toThrow('Unauthorized');
    expect(scheduleAnnouncement).not.toHaveBeenCalled();
  });

  it('rejects a scheduled time in the past', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));

    const result = await scheduleAnnouncementToRecipients(
      'Hello',
      'body',
      ['alice@example.com'],
      '2020-01-01T09:00',
    );

    expect(result).toEqual({ success: false, error: 'Scheduled time must be in the future' });
    expect(scheduleAnnouncement).not.toHaveBeenCalled();
  });

  it('rejects a scheduled time less than one minute from now', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));

    // System time is 2026-01-15T12:00:00Z = 07:00 EST wall clock in New York.
    const result = await scheduleAnnouncementToRecipients(
      'Hello',
      'body',
      ['alice@example.com'],
      '2026-01-15T07:00',
    );

    expect(result).toEqual({ success: false, error: 'Scheduled time must be in the future' });
    expect(scheduleAnnouncement).not.toHaveBeenCalled();
  });

  it('rejects a recipient that is not active', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));

    const result = await scheduleAnnouncementToRecipients(
      'Hello',
      'body',
      ['carol@example.com'],
      '2026-06-15T09:00',
    );

    expect(result.success).toBe(false);
    expect(scheduleAnnouncement).not.toHaveBeenCalled();
  });

  it('schedules with the UTC instant computed from the configured timezone', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    scheduleAnnouncement.mockReturnValue('ann-scheduled-1');

    const result = await scheduleAnnouncementToRecipients(
      'Hello',
      'body',
      ['alice@example.com'],
      '2026-06-15T09:00',
    );

    // 2026-06-15T09:00 in America/New_York (EDT, UTC-4) => 2026-06-15T13:00:00Z
    expect(result).toEqual({
      success: true,
      announcementId: 'ann-scheduled-1',
      scheduledAt: new Date('2026-06-15T13:00:00.000Z'),
    });
    expect(scheduleAnnouncement).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        subject: 'Hello',
        body: 'body',
        recipientEmails: ['alice@example.com'],
        scheduledAt: new Date('2026-06-15T13:00:00.000Z'),
      }),
    );
  });
});

describe('updateScheduledAnnouncement action', () => {
  beforeEach(() => {
    updateScheduledAnnouncement.mockReset();
    getAppContext.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "no longer scheduled" when the guarded update changes nothing', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    updateScheduledAnnouncement.mockReturnValue(false);

    const result = await updateScheduledAnnouncementAction(
      'ann-1',
      'Hello',
      'body',
      ['alice@example.com'],
      '2026-06-15T09:00',
    );

    expect(result).toEqual({ success: false, error: 'This message is no longer scheduled' });
  });

  it('rejects a past scheduled time before touching the row', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));

    const result = await updateScheduledAnnouncementAction(
      'ann-1',
      'Hello',
      'body',
      ['alice@example.com'],
      '2020-01-01T09:00',
    );

    expect(result).toEqual({ success: false, error: 'Scheduled time must be in the future' });
    expect(updateScheduledAnnouncement).not.toHaveBeenCalled();
  });

  it('succeeds when the guarded update changes a row', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    updateScheduledAnnouncement.mockReturnValue(true);

    const result = await updateScheduledAnnouncementAction(
      'ann-1',
      'Hello',
      'body',
      ['alice@example.com'],
      '2026-06-15T09:00',
    );

    expect(result).toEqual({ success: true });
  });
});

describe('cancelScheduledAnnouncement action', () => {
  beforeEach(() => {
    cancelScheduledAnnouncement.mockReset();
    getAppContext.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
  });

  it('returns "no longer scheduled" when the guarded cancel changes nothing', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    cancelScheduledAnnouncement.mockReturnValue(false);

    const result = await cancelScheduledAnnouncementAction('ann-1');

    expect(result).toEqual({ success: false, error: 'This message is no longer scheduled' });
  });

  it('succeeds when the guarded cancel changes a row', async () => {
    getAppContext.mockReturnValue(makeCtx(ACTIVE_ROWS));
    cancelScheduledAnnouncement.mockReturnValue(true);

    const result = await cancelScheduledAnnouncementAction('ann-1');

    expect(result).toEqual({ success: true });
  });
});
