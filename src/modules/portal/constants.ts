/**
 * Request header `middleware.ts` sets on requests it rewrote from the
 * configured portal domain (see `handlePortalHost`). Read back by
 * `getPortalBasePath` to distinguish "real" portal-domain requests from the
 * `/portal/*` admin-host preview. Kept dependency-free (no `next/headers`)
 * so `middleware.ts` doesn't need to import request-context-only code.
 */
export const PORTAL_HOST_HEADER = 'x-portal-host';
