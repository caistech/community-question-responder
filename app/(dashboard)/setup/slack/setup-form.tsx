'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function SlackSetupForm() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [signingSecret, setSigningSecret] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ workspace_name: string; user_name: string } | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    const r = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        provider: 'slack',
        token,
        signing_secret: signingSecret || undefined,
      }),
    });
    setBusy(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error ?? `HTTP ${r.status}`);
    } else {
      setResult({ workspace_name: j.workspace_name, user_name: j.user_name });
      setToken('');
      setSigningSecret('');
      router.refresh();
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-gray-300">Bot User OAuth Token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="xoxb-…"
          required
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500"
        />
        <div className="mt-1 text-xs text-gray-500">
          From <strong>OAuth &amp; Permissions</strong> after install. Must start with{' '}
          <code>xoxb-</code> — User tokens (<code>xoxp-</code>) will be rejected.
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm text-gray-300">
          Signing Secret <span className="text-gray-500">(optional)</span>
        </label>
        <input
          type="password"
          value={signingSecret}
          onChange={(e) => setSigningSecret(e.target.value)}
          placeholder="32-char hex string"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500"
        />
        <div className="mt-1 text-xs text-gray-500">
          From <strong>Basic Information</strong> → <strong>App Credentials</strong>.
          Only needed if you later add Slack event-subscription webhooks.
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          Connected to <strong>{result.workspace_name}</strong> as bot{' '}
          <strong>{result.user_name}</strong>. Next: invite the bot into the
          channels you want it watching ({' '}
          <code className="text-xs">/invite @{result.user_name}</code> in each
          channel), then go to{' '}
          <a href="/channels" className="underline">/channels</a> to register them.
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? 'Validating…' : 'Validate and connect'}
      </button>
    </form>
  );
}
