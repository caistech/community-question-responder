import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { EmailOtpType } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Handles both email-flow encodings: ?token_hash=&type= (verifyOtp — the
// SSR-safe form the canonical email templates use, no PKCE verifier needed,
// works cross-device) and ?code= (PKCE / OAuth). Honors ?next=.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') || '/drafts';

  const supabase = await createClient();
  if (tokenHash && type) {
    await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  } else if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
