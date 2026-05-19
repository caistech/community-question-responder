import { NextRequest } from 'next/server';
import { createClient } from './server';
import { createServiceClient } from './service';

/**
 * Authenticate the request via the Supabase cookie session and return both
 * the user and a service-role client for subsequent DB operations.
 *
 * Mirrors the InvestorPilot pattern. Every authed API route should call
 * this first and check `error`.
 */
export async function authenticateAndGetDb(_request?: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      db: null as ReturnType<typeof createServiceClient> | null,
      error: 'Unauthorized',
    };
  }

  return {
    user,
    db: createServiceClient(),
    error: null as string | null,
  };
}

/**
 * Verify CRON_SECRET header. Self-authenticating cron routes call this
 * before doing any work.
 */
export function verifyCronSecret(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const provided =
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
    request.headers.get('x-cron-secret');
  return provided === expected;
}
