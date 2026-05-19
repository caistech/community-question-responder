'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createBrowserSupabase();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: e2 } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e2) setError(e2.message);
    else router.push('/drafts');
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-2 text-3xl font-bold">Set a new password</h1>
        <p className="mb-8 text-sm text-gray-400">
          Choose a new password to finish recovery. You&apos;ll be signed in
          immediately after.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-gray-300">New password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
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
            {busy ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      </div>
    </main>
  );
}
