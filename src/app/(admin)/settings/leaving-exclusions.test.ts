import { describe, it, expect } from 'vitest';
import { missingExcludedIds } from './leaving-exclusions';

describe('missingExcludedIds', () => {
  it('returns stored ids that are not present in the rendered checklist', () => {
    const stored = [3, 9, 15];
    const rendered = [3, 9];
    expect(missingExcludedIds(stored, rendered)).toEqual([15]);
  });

  it('returns an empty array when every stored id is rendered', () => {
    expect(missingExcludedIds([3, 9], [3, 9, 20])).toEqual([]);
  });

  it('returns all stored ids when the checklist is empty', () => {
    expect(missingExcludedIds([3, 9], [])).toEqual([3, 9]);
  });
});
