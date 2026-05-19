'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (e2) setError(e2.message);
    else router.push('/drafts');
  };

  const onMagic = async () => {
    if (!email) {
      setError('Enter your email first');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e2 } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
    setBusy(false);
    if (e2) setError(e2.message);
    else setMagicSent(true);
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <div className="mb-2 text-sm text-emerald-400">Community Question Responder</div>
        <h1 className="mb-2 text-3xl font-bold">Sign in</h1>
        <p className="mb-8 text-sm text-gray-400">
          Operator dashboard. Drafts queue, KB inspector, channel config — all
          behind this gate. Use the magic-link button if you haven&apos;t set
          a password yet.
        </p>

        {magicSent ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-sm">
            Check your inbox — magic link sent to <strong>{email}</strong>. The
            link expires in one hour.
          </div>
        ) : (
          <form onSubmit={onSignIn} className="space-y-4">
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

            <div>
              <label className="mb-1 block text-sm text-gray-300">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 pr-10 text-base outline-none focus:border-emerald-500"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div className="mt-2 text-right">
                <Link href="/forgot-password" className="text-xs text-emerald-400 hover:underline">
                  Forgot password?
                </Link>
              </div>
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
              {busy ? 'Signing in…' : 'Sign in'}
            </button>

            <div className="relative my-4 text-center text-xs text-gray-500">
              <span className="bg-gray-950 px-3">or</span>
              <div className="absolute left-0 right-0 top-1/2 -z-10 border-t border-gray-800" />
            </div>

            <button
              type="button"
              onClick={onMagic}
              disabled={busy}
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              Email me a magic link
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
