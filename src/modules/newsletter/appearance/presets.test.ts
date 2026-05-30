import { describe, it, expect } from 'vitest';
import { PRESETS, PRESET_OPTIONS } from './presets';
import { AppearanceSchema } from './schema';

describe('presets', () => {
  it('exposes options for the UI', () => {
    expect(PRESET_OPTIONS.length).toBeGreaterThanOrEqual(4);
    expect(PRESET_OPTIONS.every(o => o.value && o.label)).toBe(true);
  });
  it('every preset has a valid appearance and theme/layout ids', () => {
    for (const p of Object.values(PRESETS)) {
      expect(AppearanceSchema.safeParse(p.appearance).success).toBe(true);
      expect(typeof p.theme).toBe('string');
      expect(typeof p.layout).toBe('string');
    }
  });
  it('editorial-classic is the byte-for-byte baseline (empty appearance + default ids)', () => {
    const p = PRESETS['editorial-classic'];
    expect(p.theme).toBe('editorial');
    expect(p.layout).toBe('list');
    expect(p.appearance).toEqual({});
  });
});
