import { NextRequest, NextResponse } from 'next/server';

// Self-authenticating routes (webhooks, cron) MUST be allowlisted here or
// they 401 before the handler runs. Per global CLAUDE.md "middleware
// allowlist pattern" — burned twice in InvestorPilot, locked here from day 1.
const PUBLIC_ROUTES = [
  '/api/webhooks/',
  '/api/cron/',
  '/api/auth/callback',
  '/api/auth/recover',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_ROUTES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
