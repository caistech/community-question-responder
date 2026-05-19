'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ChannelOption {
  id: string;
  label: string;
  kb_namespace: string;
}

interface Props {
  channelOptions: ChannelOption[];
  namespaces: string[];
}

export function LearningForm({ channelOptions, namespaces }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [namespace, setNamespace] = useState(namespaces[0] ?? 'unipile');
  const [announce, setAnnounce] = useState(true);
  const [channelId, setChannelId] = useState(channelOptions[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ kb_chunks: number; announce_id: string | null } | null>(
    null
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);

    const r = await fetch('/api/learnings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: title.trim() || undefined,
        content: content.trim(),
        namespace,
        announce,
        channel_id: announce ? channelId : undefined,
      }),
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) {
      setError(j.error ?? `HTTP ${r.status}`);
      return;
    }
    setResult({ kb_chunks: j.kb?.chunks ?? 0, announce_id: j.announce_draft_id });
    setTitle('');
    setContent('');
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm text-gray-300">
          Working title <span className="text-gray-500">(optional)</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Unipile drops account.status events during re-auth"
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-base outline-none focus:border-emerald-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-gray-300">What did you learn?</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          required
          rows={10}
          placeholder="Type one or two paragraphs. What's the observation? What's the implication? What's the workaround? Don't polish — this gets drafted into community-grade copy by Claude."
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500"
        />
        <div className="mt-1 text-xs text-gray-500">
          Minimum 30 characters. Lands in the KB immediately on submit.
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm text-gray-300">KB namespace</label>
          <select
            value={namespace}
            onChange={(e) => setNamespace(e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-base outline-none focus:border-emerald-500"
          >
            {namespaces.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={announce}
              onChange={(e) => setAnnounce(e.target.checked)}
              className="h-4 w-4 rounded border-gray-700 bg-gray-900 text-emerald-500 focus:ring-emerald-500"
            />
            Also draft a community announce post
          </label>
        </div>
      </div>

      {announce && channelOptions.length > 0 && (
        <div>
          <label className="mb-1 block text-sm text-gray-300">Target channel</label>
          <select
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-base outline-none focus:border-emerald-500"
          >
            {channelOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      )}
      {announce && channelOptions.length === 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-300">
          No channels configured yet. Add a channel first, then come back to draft an announce.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">
          KB seeded with {result.kb_chunks} chunk{result.kb_chunks === 1 ? '' : 's'}.
          {result.announce_id ? (
            <>
              {' '}Announce draft queued —{' '}
              <a href="/drafts" className="underline">
                review it in /drafts
              </a>
              .
            </>
          ) : (
            ' No announce drafted.'
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || (announce && channelOptions.length === 0)}
        className="rounded-lg bg-emerald-500 px-4 py-3 text-sm font-medium text-gray-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        {busy ? 'Saving…' : announce ? 'Save + draft announce' : 'Save to KB'}
      </button>
    </form>
  );
}
