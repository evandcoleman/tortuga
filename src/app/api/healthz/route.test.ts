import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mutable mock context so each test can shape db/tautulli/scheduler/config state.
type DigestRow = {
  status: string;
  scheduledAt: Date;
  error: string | null;
};

interface MockState {
  dbOk: boolean;
  tautulliOk: boolean;
  scheduleEnabled: boolean;
  jobs: Array<{ name: string; cron: string; nextRun: Date | null }>;
  digestRows: DigestRow[];
}

const state: MockState = {
  dbOk: true,
  tautulliOk: true,
  scheduleEnabled: true,
  jobs: [],
  digestRows: [],
};

function makeQuery() {
  // Mimic drizzle's chainable select().from().orderBy().limit().all()
  const chain = {
    from: () => chain,
    orderBy: () => chain,
    limit: () => chain,
    // Tests sort digests newest-first themselves; route asks for the first row.
    all: () => state.digestRows,
  };
  return chain;
}

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({
    db: {
      $client: {
        prepare: () => ({
          all: () => {
            if (!state.dbOk) throw new Error('db down');
            return [{ 1: 1 }];
          },
        }),
      },
      select: () => makeQuery(),
    },
    tautulli: {
      getUsers: async () => {
        if (!state.tautulliOk) throw new Error('tautulli down');
        return [];
      },
    },
    env: {},
    email: { name: 'resend' },
    config: { newsletter: { schedule_enabled: state.scheduleEnabled } },
    scheduler: { list: () => state.jobs },
  }),
}));

import { GET } from './route';

beforeEach(() => {
  state.dbOk = true;
  state.tautulliOk = true;
  state.scheduleEnabled = true;
  state.jobs = [];
  state.digestRows = [];
});

describe('GET /api/healthz', () => {
  it('returns 200 with status payload and preserves existing fields', async () => {
    // Arrange / Act
    const res = await GET();
    const body = await res.json();

    // Assert
    expect(res.status).toBe(200);
    expect(body.db).toBe('ok');
    expect(body.tautulli).toBe('ok');
    expect(body.email_provider).toBe('resend');
    expect(typeof body.ts).toBe('string');
  });

  it('includes scheduler section with jobs and ISO next-run dates', async () => {
    // Arrange
    const next = new Date('2026-06-01T13:00:00.000Z');
    state.jobs = [{ name: 'newsletter-digest', cron: '0 9 * * SUN', nextRun: next }];

    // Act
    const body = await (await GET()).json();

    // Assert
    expect(body.scheduler.jobs).toEqual([
      { name: 'newsletter-digest', cron: '0 9 * * SUN', nextRun: next.toISOString() },
    ]);
  });

  it('represents a stopped job (null nextRun) as null', async () => {
    // Arrange
    state.jobs = [{ name: 'newsletter-digest', cron: '0 9 * * SUN', nextRun: null }];

    // Act
    const body = await (await GET()).json();

    // Assert
    expect(body.scheduler.jobs[0].nextRun).toBeNull();
  });

  it('reflects schedule_enabled from config', async () => {
    // Arrange
    state.scheduleEnabled = false;

    // Act
    const body = await (await GET()).json();

    // Assert
    expect(body.scheduler.schedule_enabled).toBe(false);
    // schedule disabled is intentional, not degraded
    expect(body.status).toBe('ok');
    expect((await GET()).status).toBe(200);
  });

  it('returns last_digest null when no digests exist (healthy initial state)', async () => {
    // Arrange — no digest rows

    // Act
    const res = await GET();
    const body = await res.json();

    // Assert
    expect(body.last_digest).toBeNull();
    expect(body.status).toBe('ok');
    expect(res.status).toBe(200);
  });

  it('includes last_digest with status, ISO scheduledAt, and null error when none', async () => {
    // Arrange
    const scheduledAt = new Date('2026-05-25T09:00:00.000Z');
    state.digestRows = [{ status: 'sent', scheduledAt, error: null }];

    // Act
    const body = await (await GET()).json();

    // Assert
    expect(body.last_digest).toEqual({
      status: 'sent',
      scheduledAt: scheduledAt.toISOString(),
      error: null,
    });
  });

  it('returns status=ok when most recent digest is sent', async () => {
    // Arrange
    state.digestRows = [
      { status: 'sent', scheduledAt: new Date('2026-05-25T09:00:00.000Z'), error: null },
    ];

    // Act
    const res = await GET();
    const body = await res.json();

    // Assert
    expect(body.status).toBe('ok');
    expect(res.status).toBe(200);
  });

  it('treats skipped digest as ok (no items matched filters)', async () => {
    // Arrange
    state.digestRows = [
      { status: 'skipped', scheduledAt: new Date('2026-05-25T09:00:00.000Z'), error: null },
    ];

    // Act
    const body = await (await GET()).json();

    // Assert
    expect(body.status).toBe('ok');
  });

  it('returns status=degraded (HTTP 200) when most recent digest failed', async () => {
    // Arrange
    state.digestRows = [
      { status: 'failed', scheduledAt: new Date('2026-05-25T09:00:00.000Z'), error: 'boom' },
    ];

    // Act
    const res = await GET();
    const body = await res.json();

    // Assert
    expect(body.status).toBe('degraded');
    expect(body.last_digest.error).toBe('boom');
    expect(res.status).toBe(200); // degraded is reachable, not a hard failure
  });

  it('caps a very long digest error to 500 chars', async () => {
    // Arrange
    const longError = 'x'.repeat(1200);
    state.digestRows = [
      { status: 'failed', scheduledAt: new Date('2026-05-25T09:00:00.000Z'), error: longError },
    ];

    // Act
    const body = await (await GET()).json();

    // Assert
    expect(body.last_digest.error).toHaveLength(500);
  });

  it('returns 503 and status=fail when db check fails', async () => {
    // Arrange
    state.dbOk = false;

    // Act
    const res = await GET();
    const body = await res.json();

    // Assert
    expect(res.status).toBe(503);
    expect(body.db).toBe('fail');
    expect(body.status).toBe('fail');
  });

  it('returns 503 when tautulli check fails', async () => {
    // Arrange
    state.tautulliOk = false;

    // Act
    const res = await GET();
    const body = await res.json();

    // Assert
    expect(res.status).toBe(503);
    expect(body.tautulli).toBe('fail');
    expect(body.status).toBe('fail');
  });

  it('reports 503 (fail) even if last digest succeeded, when a core check is down', async () => {
    // Arrange
    state.dbOk = false;
    state.digestRows = [
      { status: 'sent', scheduledAt: new Date('2026-05-25T09:00:00.000Z'), error: null },
    ];

    // Act
    const res = await GET();
    const body = await res.json();

    // Assert — core failure takes precedence over digest health
    expect(res.status).toBe(503);
    expect(body.status).toBe('fail');
  });
});
