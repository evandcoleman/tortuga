// Validators for user-supplied CSS values that get inlined into email style
// attributes. Reject anything that could break out of a value and inject
// arbitrary declarations. Conservative by design: better to reject a weird-but-
// valid value than to allow an injection vector.

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB = /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const HSL = /^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+)\s*)?\)$/;
const NAMED = new Set([
  'transparent','currentcolor','black','white','red','green','blue','gray','grey',
  'silver','maroon','olive','lime','aqua','teal','navy','fuchsia','purple','orange',
  'yellow','beige','ivory','gold','brown','pink','cyan','magenta',
]);

const FORBIDDEN = /[;{}()]|url|expression|@import|\/\*|[\n\r\t<>]/i;

export function isSafeColor(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (NAMED.has(v.toLowerCase())) return true;
  if (HEX.test(v)) return true;
  // rgb/hsl contain parens, so test them BEFORE the forbidden-char gate:
  if (RGB.test(v) || HSL.test(v)) return true;
  return false;
}

export function isSafeFontStack(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  const v = value.trim();
  if (v.length > 200) return false;
  if (FORBIDDEN.test(v)) return false;
  return /^[A-Za-z0-9 ,"'\-]+$/.test(v);
}

export function isSafeLetterSpacing(value: string): boolean {
  if (!value || typeof value !== 'string') return false;
  return /^-?\d+(\.\d+)?(em|rem|px)$/.test(value.trim());
}
