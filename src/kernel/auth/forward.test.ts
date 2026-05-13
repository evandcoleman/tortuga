import { describe, it, expect } from 'vitest';
import { extractForwardUser } from './forward';

describe('extractForwardUser', () => {
  it('returns user when header present', () => {
    const req = new Request('http://x', { headers: { 'Remote-User': 'evan' } });
    expect(extractForwardUser(req, 'Remote-User')).toEqual({ id: 'evan', email: 'evan' });
  });
  it('null when missing', () => {
    expect(extractForwardUser(new Request('http://x'), 'Remote-User')).toBeNull();
  });
});
