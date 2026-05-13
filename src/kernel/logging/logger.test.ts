import { describe, it, expect } from 'vitest';
import { createLogger } from './logger';

describe('createLogger', () => {
  it('returns a logger with info/warn/error/debug methods', () => {
    const log = createLogger('test');
    expect(typeof log.info).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.debug).toBe('function');
  });

  it('inherits the module field via child loggers', () => {
    const log = createLogger('mymod');
    const child = log.child({ digest_id: 'abc' });
    expect(child.bindings()).toMatchObject({ module: 'mymod', digest_id: 'abc' });
  });
});
