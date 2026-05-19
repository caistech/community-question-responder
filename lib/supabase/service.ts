import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Server-only. Bypasses RLS.
 *
 * Use for cron jobs, webhooks, and admin actions that need to read or write
 * across user boundaries. Never import from a 'use client' file.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
