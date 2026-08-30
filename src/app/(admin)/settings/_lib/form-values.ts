/** Shared FormData scalar/list parsing helpers used by every settings sub-page's form parser. */

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export function bool(fd: FormData, key: string): boolean {
  return fd.get(key) === 'on';
}

export function num(fd: FormData, key: string): number {
  return Number(str(fd, key));
}

export function list(fd: FormData, key: string): string[] {
  return str(fd, key)
    .split(/[\n,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

export function opt(value: string): string | undefined {
  return value === '' ? undefined : value;
}

export function numList(fd: FormData, key: string): number[] {
  return fd
    .getAll(key)
    .map(v => Number(v))
    .filter(n => Number.isFinite(n));
}

/**
 * Resolves a `SecretField`'s submission into a `writeServiceSettings` patch value:
 * `null` clears (the paired `${key}__clear` checkbox was checked), `undefined`
 * leaves the stored value untouched (blank submit = keep), and a string replaces it.
 * The clear checkbox always wins over a typed value.
 */
export function secretPatch(fd: FormData, key: string): string | null | undefined {
  if (bool(fd, `${key}__clear`)) return null;
  const value = str(fd, key);
  return value === '' ? undefined : value;
}

/**
 * Resolves a non-secret managed field (e.g. a service URL) into a
 * `writeServiceSettings` patch value. A disabled (env-sourced) input is never
 * a "successful control", so it's absent from `FormData` entirely — that
 * absence means "untouched" (`undefined`). An enabled field submitted blank
 * means "clear" (`null`); any other value replaces it.
 */
export function urlPatch(fd: FormData, key: string): string | null | undefined {
  if (!fd.has(key)) return undefined;
  const value = str(fd, key);
  return value === '' ? null : value;
}
