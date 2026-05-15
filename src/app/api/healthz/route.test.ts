import { describe, it, expect, vi } from 'vitest';

vi.mock('@/kernel/context', () => ({
  getAppContext: () => ({
    db: { $client: { prepare: () => ({ all: () => [{ 1: 1 }] }) } },
    tautulli: { getUsers: async () => [] },
    env: {},
    email: { name: 'resend' },
  }),
}));

import { GET } from './route';

describe('GET /api/healthz', () => {
  it('returns 200 with status payload', async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.db).toBe('ok');
    expect(body.tautulli).toBe('ok');
    expect(body.email_provider).toBe('resend');
  });
});
