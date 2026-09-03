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

  it('invokes onError listeners with the job name and error when the handler throws', async () => {
    const s = createScheduler();
    const boom = new Error('boom');
    s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: () => { throw boom; } });
    const listener = vi.fn();
    s.onError(listener);
    await s.trigger('a');
    expect(listener).toHaveBeenCalledWith('a', boom);
    s.stopAll();
  });

  it('a throwing listener does not prevent the next listener from running', async () => {
    const s = createScheduler();
    const boom = new Error('boom');
    s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: () => { throw boom; } });
    const badListener = vi.fn(() => { throw new Error('listener exploded'); });
    const goodListener = vi.fn();
    s.onError(badListener);
    s.onError(goodListener);
    await expect(s.trigger('a')).resolves.not.toThrow();
    expect(badListener).toHaveBeenCalledWith('a', boom);
    expect(goodListener).toHaveBeenCalledWith('a', boom);
    s.stopAll();
  });

  it('does not invoke listeners when the handler succeeds', async () => {
    const s = createScheduler();
    s.register({ name: 'a', cron: '* * * * *', timezone: 'UTC', handler: vi.fn() });
    const listener = vi.fn();
    s.onError(listener);
    await s.trigger('a');
    expect(listener).not.toHaveBeenCalled();
    s.stopAll();
  });
});
