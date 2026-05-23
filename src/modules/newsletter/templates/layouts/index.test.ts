import { describe, it, expect } from 'vitest';
import { resolveLayout, DEFAULT_LAYOUT_ID, LAYOUT_OPTIONS, LAYOUTS } from './index';

describe('layout registry', () => {
  it('resolves a known id', () => {
    expect(resolveLayout('list').id).toBe('list');
  });

  it('falls back to default for unknown or blank id', () => {
    expect(resolveLayout('nope').id).toBe(DEFAULT_LAYOUT_ID);
    expect(resolveLayout('').id).toBe(DEFAULT_LAYOUT_ID);
    expect(resolveLayout(undefined).id).toBe(DEFAULT_LAYOUT_ID);
    expect(resolveLayout(null).id).toBe(DEFAULT_LAYOUT_ID);
  });

  it('exposes options for every registered layout', () => {
    expect(LAYOUT_OPTIONS).toEqual(
      Object.values(LAYOUTS).map(l => ({ value: l.id, label: l.label })),
    );
  });
});
