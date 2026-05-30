import { describe, it, expect } from 'vitest';
import { isSafeColor, isSafeFontStack, isSafeLetterSpacing } from './sanitize';

describe('isSafeColor', () => {
  it('accepts hex, rgb, hsl, and named colors', () => {
    for (const c of ['#fff', '#ffffff', '#ffffffcc', 'rgb(0,0,0)', 'rgba(0,0,0,0.5)', 'hsl(10,50%,50%)', 'white', 'transparent']) {
      expect(isSafeColor(c)).toBe(true);
    }
  });
  it('rejects css-injection payloads', () => {
    for (const c of ['red;}', 'url(x)', 'expression(1)', '#fff;background:url(x)', 'rgb(0,0,0)/*', 'a\nb', '']) {
      expect(isSafeColor(c)).toBe(false);
    }
  });
});

describe('isSafeFontStack', () => {
  it('accepts normal font stacks', () => {
    expect(isSafeFontStack('"Inter","Helvetica",sans-serif')).toBe(true);
    expect(isSafeFontStack('Georgia, Times, serif')).toBe(true);
  });
  it('rejects braces/semicolons/parens', () => {
    for (const f of ['Inter;}', 'Inter}', 'url(x)', 'a{b', '']) expect(isSafeFontStack(f)).toBe(false);
  });
});

describe('isSafeLetterSpacing', () => {
  it('accepts em/px/rem values', () => {
    for (const v of ['-0.02em', '0.04em', '2px', '1.5rem', '0em']) expect(isSafeLetterSpacing(v)).toBe(true);
  });
  it('rejects junk', () => {
    for (const v of ['2', '2vw', 'calc(1px)', '1px;}', '']) expect(isSafeLetterSpacing(v)).toBe(false);
  });
});
