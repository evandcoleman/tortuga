import { headers } from 'next/headers';
import { auth } from './auth';

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export interface AdminIdentity {
  /** The signed-in admin's email, when known. Null in forward mode — the
   * forward header only proves *a* user was authenticated upstream, not
   * their email; callers that need an email fall back to ADMIN_EMAIL. */
  email: string | null;
}

/**
 * Guards a Server Action against unauthenticated invocation.
 *
 * Server Actions are independently reachable POST endpoints — the
 * (admin) layout's `auth()` check only protects page renders, not action
 * calls, so every action under src/app/(admin)/** must call this as its
 * first statement. Semantics mirror `(admin)/layout.tsx` exactly:
 *  - session mode: requires an authenticated NextAuth session.
 *  - forward mode: requires the upstream proxy's auth header to be present
 *    (mirrors middleware.ts, which is the only enforcement in that mode).
 */
export async function requireAdminSession(): Promise<AdminIdentity> {
  const mode = (process.env.AUTH_MODE ?? 'session') as 'session' | 'forward';

  if (mode === 'forward') {
    const headerName = process.env.AUTH_FORWARD_HEADER ?? 'Remote-User';
    const headerList = await headers();
    if (!headerList.get(headerName)) throw new UnauthorizedError();
    return { email: null };
  }

  const session = await auth();
  if (!session?.user) throw new UnauthorizedError();
  return { email: session.user.email ?? null };
}
