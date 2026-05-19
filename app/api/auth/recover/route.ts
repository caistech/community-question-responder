import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Password-recovery landing route. Supabase sends users here from the
 * reset email. We exchange the recovery code for a session, then redirect
 * to /reset-password where they pick a new password.
 *
 * Path is allowlisted in middleware.ts so the exchange runs before the
 * session check.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code') || searchParams.get('token');

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}/reset-password`);
}
