import { describe, it, expect } from 'vitest';
import { createDb } from './client';

describe('createDb', () => {
  it('opens an in-memory db and runs a trivial query', () => {
    const db = createDb(':memory:');
    const rows = db.$client.prepare('select 1 as one').all();
    expect(rows).toEqual([{ one: 1 }]);
  });
});
