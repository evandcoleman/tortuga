import { randomBytes } from 'node:crypto';

const SLUG_BYTES = 16;

/**
 * Generates an unguessable slug for a digest's hosted issue URL: 16 random
 * bytes, base64url-encoded (no padding). ~128 bits of entropy is enough to
 * make the slug unguessable without needing an index/auth check.
 */
export function generateDigestSlug(): string {
  return randomBytes(SLUG_BYTES)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
