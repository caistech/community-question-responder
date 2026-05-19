'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/browser';

export default function ForgotPasswordPage() {
  const supabase = createBrowserSupabase();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: e2 } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/api/auth/recover`,
    });
    setBusy(false);
    if (e2) setError(e2.message);
    else setSent(true);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <Link href="/login" className="mb-6 inline-block text-sm text-emerald-400 hover:underline">
          ← Back to sign in
        </Link>
        <h1 className="mb-2 text-3xl font-bold">Reset your password</h1>
        <p className="mb-8 text-sm text-gray-400">
          Enter your email and we&apos;ll send a one-time reset link.
        </p>

        {sent ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-sm">
            If an account exists for <strong>{email}</strong>, a reset link is on its way.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-gray-300">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-base outline-none focus:border-emerald-500"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-medium text-gray-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
