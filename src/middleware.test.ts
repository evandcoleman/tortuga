import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import middleware from './middleware';

const originalAuthMode = process.env.AUTH_MODE;

beforeEach(() => {
  process.env.AUTH_MODE = 'forward';
  delete process.env.AUTH_FORWARD_HEADER;
});

afterEach(() => {
  process.env.AUTH_MODE = originalAuthMode;
});

function reqFor(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(new Request(`http://x${path}`, { headers }));
}

describe('middleware public paths', () => {
  it('allows /issues/[slug] without auth', () => {
    const res = middleware(reqFor('/issues/abc123'));
    expect(res.status).toBe(200);
  });

  it('still requires auth for other admin paths', () => {
    const res = middleware(reqFor('/newsletter/preview'));
    expect(res.status).toBe(401);
  });
});
