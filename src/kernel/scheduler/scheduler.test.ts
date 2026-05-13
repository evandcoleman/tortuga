import { describe, it, expect, vi } from 'vitest';
import { createScheduler } from './scheduler';

describe('scheduler', () => {
  it('registers and lists jobs', () => {
    const s = createScheduler();
    s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: vi.fn() });
    expect(s.list().map(j => j.name)).toEqual(['a']);
    s.stopAll();
  });
  it('stop unregisters and cancels', () => {
    const s = createScheduler();
    s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: vi.fn() });
    s.stop('a');
    expect(s.list()).toEqual([]);
  });
  it('refuses duplicate names', () => {
    const s = createScheduler();
    s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: vi.fn() });
    expect(() => s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: vi.fn() })).toThrow(/duplicate/);
    s.stopAll();
  });
});
