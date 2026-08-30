import { describe, it, expect, vi, beforeEach } from 'vitest';

// The server action delegates the actual send to renderAndSendTestDigest and
// only owns: discovering the latest rendered digest + assembling provider/from.
const renderAndSendTestDigest = vi.fn();
const getAppContext = vi.fn();
const runDigest = vi.fn();

vi.mock('@/modules/newsletter/pipeline/test-digest', () => ({
  renderAndSendTestDigest: (...args: unknown[]) => renderAndSendTestDigest(...args),
}));

vi.mock('@/modules/newsletter/pipeline/run', () => ({
  runDigest: (...args: unknown[]) => runDigest(...args),
}));

vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
  invalidateAppContext: vi.fn(),
}));

const requireAdminSession = vi.fn();
vi.mock('@/kernel/auth/require-admin-session', () => ({
  requireAdminSession: () => requireAdminSession(),
  UnauthorizedError: class UnauthorizedError extends Error {},
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Minimal Drizzle query-builder stub: select().from().where().orderBy().limit().all()
function makeDb(rows: Array<Record<string, unknown>>) {
  const chain = {
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    all: () => rows,
  };
  return { select: () => chain };
}

function makeCtx(rows: Array<Record<string, unknown>>) {
  return {
    db: makeDb(rows),
    email: { name: 'resend' },
    config: {
      newsletter: {
        from: { email: 'news@tortuga.local', name: 'Tortuga' },
        reply_to: 'reply@tortuga.local',
      },
    },
  };
}

function makeSendNowCtx(sentRows: Array<Record<string, unknown>>) {
  return {
    db: makeDb(sentRows),
    email: { name: 'resend' },
    tautulli: {},
    tmdb: {},
    llm: null,
    env: { APP_URL: 'https://x.test', SESSION_SECRET: 'secret' },
    config: {
      newsletter: {
        theme: 'gold',
        layout: 'grid',
        from: { email: 'news@tortuga.local', name: 'Tortuga' },
        reply_to: 'reply@tortuga.local',
      },
    },
  };
}

import { sendNowDigest, sendTestDigest } from './actions';

describe('sendTestDigest server action', () => {
  beforeEach(() => {
    renderAndSendTestDigest.mockReset();
    getAppContext.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
  });

  it('rejects when there is no admin session', async () => {
    getAppContext.mockReturnValue(makeCtx([{ id: 'dig-9', renderedSubject: 's' }]));
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(sendTestDigest('gold', 'grid', 'me@example.com')).rejects.toThrow('Unauthorized');
    expect(renderAndSendTestDigest).not.toHaveBeenCalled();
  });

  it('delegates to renderAndSendTestDigest with the latest rendered digest and config', async () => {
    // Arrange
    getAppContext.mockReturnValue(
      makeCtx([{ id: 'dig-9', renderedSubject: 'New on Tortuga — 3 items' }]),
    );
    renderAndSendTestDigest.mockResolvedValue({ success: true });

    // Act
    const result = await sendTestDigest('noir', 'list', 'me@example.com');

    // Assert
    expect(result).toEqual({ success: true });
    expect(renderAndSendTestDigest).toHaveBeenCalledWith(
      expect.objectContaining({
        digestId: 'dig-9',
        themeId: 'noir',
        layoutId: 'list',
        toEmail: 'me@example.com',
        subject: 'New on Tortuga — 3 items',
        from: { email: 'news@tortuga.local', name: 'Tortuga' },
        replyTo: 'reply@tortuga.local',
      }),
    );
  });

  it('propagates an error result from the helper', async () => {
    // Arrange
    getAppContext.mockReturnValue(makeCtx([{ id: 'dig-9', renderedSubject: 's' }]));
    renderAndSendTestDigest.mockResolvedValue({ success: false, error: 'quota exceeded' });

    // Act
    const result = await sendTestDigest('gold', 'grid', 'me@example.com');

    // Assert
    expect(result).toEqual({ success: false, error: 'quota exceeded' });
  });

  it('returns a clear error without delegating when no rendered digest exists', async () => {
    // Arrange
    getAppContext.mockReturnValue(makeCtx([]));

    // Act
    const result = await sendTestDigest('gold', 'grid', 'me@example.com');

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no preview available/i);
    expect(renderAndSendTestDigest).not.toHaveBeenCalled();
  });

  it('falls back to a default subject when the digest has none', async () => {
    // Arrange
    getAppContext.mockReturnValue(makeCtx([{ id: 'dig-9', renderedSubject: null }]));
    renderAndSendTestDigest.mockResolvedValue({ success: true });

    // Act
    await sendTestDigest('gold', 'grid', 'me@example.com');

    // Assert
    expect(renderAndSendTestDigest).toHaveBeenCalledWith(
      expect.objectContaining({ subject: 'New on Tortuga' }),
    );
  });
});

describe('sendNowDigest server action', () => {
  beforeEach(() => {
    runDigest.mockReset();
    getAppContext.mockReset();
    requireAdminSession.mockReset();
    requireAdminSession.mockResolvedValue({ email: 'admin@example.com' });
  });

  it('rejects when there is no admin session', async () => {
    getAppContext.mockReturnValue(makeSendNowCtx([]));
    requireAdminSession.mockRejectedValue(new Error('Unauthorized'));

    await expect(sendNowDigest()).rejects.toThrow('Unauthorized');
    expect(runDigest).not.toHaveBeenCalled();
  });

  it('runs a real (non-dry-run) digest and reports the sent recipient count', async () => {
    // Arrange — three rows in the sends table for the new digest are counted
    getAppContext.mockReturnValue(makeSendNowCtx([{ id: 's1' }, { id: 's2' }, { id: 's3' }]));
    runDigest.mockResolvedValue({ id: 'dig-new', status: 'sent', itemCount: 7 });

    // Act
    const result = await sendNowDigest();

    // Assert
    expect(runDigest).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ theme: 'gold', layout: 'grid' }) }),
    );
    // dryRun must NOT be set — this is a live send
    expect(runDigest.mock.calls[0][0].dryRun).toBeUndefined();
    expect(result).toEqual({
      success: true,
      id: 'dig-new',
      status: 'sent',
      itemCount: 7,
      sentCount: 3,
    });
  });

  it('overrides theme and layout for this run only when provided', async () => {
    // Arrange
    getAppContext.mockReturnValue(makeSendNowCtx([{ id: 's1' }]));
    runDigest.mockResolvedValue({ id: 'dig-new', status: 'sent', itemCount: 1 });

    // Act
    await sendNowDigest('noir', 'list');

    // Assert
    expect(runDigest).toHaveBeenCalledWith(
      expect.objectContaining({ config: expect.objectContaining({ theme: 'noir', layout: 'list' }) }),
    );
  });

  it('reports a partial send when the digest run failed mid-flight', async () => {
    // Arrange — runDigest marks the digest failed but two sends already went out
    getAppContext.mockReturnValue(makeSendNowCtx([{ id: 's1' }, { id: 's2' }]));
    runDigest.mockResolvedValue({ id: 'dig-bad', status: 'failed', itemCount: 4 });

    // Act
    const result = await sendNowDigest();

    // Assert
    expect(result).toEqual({
      success: true,
      id: 'dig-bad',
      status: 'failed',
      itemCount: 4,
      sentCount: 2,
    });
  });

  it('returns a structured error instead of throwing when runDigest throws', async () => {
    // Arrange
    getAppContext.mockReturnValue(makeSendNowCtx([]));
    runDigest.mockRejectedValue(new Error('Email provider unreachable'));

    // Act
    const result = await sendNowDigest();

    // Assert
    expect(result).toEqual({ success: false, error: 'Email provider unreachable' });
  });
});
