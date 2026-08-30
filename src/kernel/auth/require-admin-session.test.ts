import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const auth = vi.fn();
vi.mock('./auth', () => ({ auth: (...args: unknown[]) => auth(...args) }));

const headersGet = vi.fn();
vi.mock('next/headers', () => ({
  headers: async () => ({ get: headersGet }),
}));

import { requireAdminSession, UnauthorizedError } from './require-admin-session';

describe('requireAdminSession', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    auth.mockReset();
    headersGet.mockReset();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('session mode (mirrors (admin)/layout.tsx)', () => {
    beforeEach(() => {
      process.env.AUTH_MODE = 'session';
    });

    it('throws UnauthorizedError when there is no session', async () => {
      auth.mockResolvedValue(null);
      await expect(requireAdminSession()).rejects.toThrow(UnauthorizedError);
    });

    it('throws UnauthorizedError when the session has no user', async () => {
      auth.mockResolvedValue({ user: null });
      await expect(requireAdminSession()).rejects.toThrow(UnauthorizedError);
    });

    it('resolves with the session user email when authenticated', async () => {
      auth.mockResolvedValue({ user: { email: 'admin@x.io' } });
      await expect(requireAdminSession()).resolves.toEqual({ email: 'admin@x.io' });
    });

    it('resolves with a null email when the session user has none', async () => {
      auth.mockResolvedValue({ user: {} });
      await expect(requireAdminSession()).resolves.toEqual({ email: null });
    });
  });

  describe('forward mode (mirrors middleware.ts)', () => {
    beforeEach(() => {
      process.env.AUTH_MODE = 'forward';
      process.env.AUTH_FORWARD_HEADER = 'Remote-User';
    });

    it('throws UnauthorizedError when the forward header is missing', async () => {
      headersGet.mockReturnValue(null);
      await expect(requireAdminSession()).rejects.toThrow(UnauthorizedError);
      expect(auth).not.toHaveBeenCalled();
    });

    it('resolves with a null email when the forward header is present', async () => {
      headersGet.mockReturnValue('evan');
      await expect(requireAdminSession()).resolves.toEqual({ email: null });
      expect(headersGet).toHaveBeenCalledWith('Remote-User');
    });

    it('honors a custom AUTH_FORWARD_HEADER name', async () => {
      process.env.AUTH_FORWARD_HEADER = 'X-Auth-User';
      headersGet.mockReturnValue('evan');
      await requireAdminSession();
      expect(headersGet).toHaveBeenCalledWith('X-Auth-User');
    });
  });
});
