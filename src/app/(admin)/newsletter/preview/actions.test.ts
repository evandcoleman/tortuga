import { describe, it, expect, vi, beforeEach } from 'vitest';

// The server action delegates the actual send to renderAndSendTestDigest and
// only owns: discovering the latest rendered digest + assembling provider/from.
const renderAndSendTestDigest = vi.fn();
const getAppContext = vi.fn();

vi.mock('@/modules/newsletter/pipeline/test-digest', () => ({
  renderAndSendTestDigest: (...args: unknown[]) => renderAndSendTestDigest(...args),
}));

vi.mock('@/kernel/context', () => ({
  getAppContext: () => getAppContext(),
  invalidateAppContext: vi.fn(),
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

import { sendTestDigest } from './actions';

describe('sendTestDigest server action', () => {
  beforeEach(() => {
    renderAndSendTestDigest.mockReset();
    getAppContext.mockReset();
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
