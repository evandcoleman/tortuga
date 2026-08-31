import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/api/healthz',
  '/api/unsubscribe',
  '/api/webhooks/resend',
  '/api/webhooks/mailgun',
  '/api/auth',
  '/issues',
];

export const config = {
  matcher: ['/((?!_next|favicon.ico|public|.*\\..*).*)'],
};

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }
  const mode = process.env.AUTH_MODE ?? 'session';
  if (mode === 'forward') {
    const header = process.env.AUTH_FORWARD_HEADER ?? 'Remote-User';
    if (!req.headers.get(header)) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
  }
  // session mode: protected by layout-level `auth()` checks (Edge-runtime safe).
  return NextResponse.next();
}
