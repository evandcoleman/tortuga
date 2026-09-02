import { describe, it, expect } from 'vitest';
import { shouldConfirmReplace } from './TemplatePicker';

describe('shouldConfirmReplace', () => {
  it('returns false when subject and body are both empty', () => {
    expect(shouldConfirmReplace({ subject: '', body: '', lastApplied: null })).toBe(false);
  });

  it('returns true when subject or body is non-empty and no template has been applied yet', () => {
    expect(shouldConfirmReplace({ subject: 'Hello', body: '', lastApplied: null })).toBe(true);
    expect(shouldConfirmReplace({ subject: '', body: 'Some body', lastApplied: null })).toBe(true);
  });

  it('returns false when the current content matches the last applied template', () => {
    const lastApplied = { subject: 'Hi {{name}}', body: 'Body text' };
    expect(
      shouldConfirmReplace({ subject: 'Hi {{name}}', body: 'Body text', lastApplied }),
    ).toBe(false);
  });

  it('returns true when the current content diverges from the last applied template', () => {
    const lastApplied = { subject: 'Hi {{name}}', body: 'Body text' };
    expect(
      shouldConfirmReplace({ subject: 'Hi {{name}}', body: 'Edited body', lastApplied }),
    ).toBe(true);
    expect(
      shouldConfirmReplace({ subject: 'Edited subject', body: 'Body text', lastApplied }),
    ).toBe(true);
  });
});
