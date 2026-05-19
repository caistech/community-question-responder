'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DraftRow {
  id: string;
  asker_name: string | null;
  question_text: string;
  draft_text: string | null;
  confidence_score: number | null;
  cite_files: unknown;
  status: string;
  created_at: string;
  drafted_at: string | null;
  post_error: string | null;
  slack_channels: {
    channel_name: string | null;
    channel_id: string;
    kb_namespace: string;
  } | null;
}

export function DraftCard({ draft }: { draft: DraftRow }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(draft.draft_text ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const cites = Array.isArray(draft.cite_files) ? (draft.cite_files as string[]) : [];

  const onPost = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/drafts/${draft.id}/post`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: editing ? JSON.stringify({ text }) : '{}',
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? `HTTP ${r.status}`);
    } else {
      router.refresh();
    }
  };

  const onDismiss = async () => {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/drafts/${draft.id}/dismiss`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    setBusy(false);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error ?? `HTTP ${r.status}`);
    } else {
      router.refresh();
    }
  };

  const confidence = draft.confidence_score ?? 0;
  const confidenceColor =
    confidence >= 0.8 ? 'text-emerald-400' : confidence >= 0.6 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/50">
      <div className="border-b border-gray-800 px-6 py-3 text-xs text-gray-400">
        <span className="font-medium text-gray-300">
          {draft.asker_name ?? 'unknown'}
        </span>
        <span className="mx-2 text-gray-600">·</span>
        <span>#{draft.slack_channels?.channel_name ?? draft.slack_channels?.channel_id}</span>
        <span className="mx-2 text-gray-600">·</span>
        <span className={confidenceColor}>conf {confidence.toFixed(2)}</span>
        {draft.status === 'post_failed' && (
          <span className="ml-2 rounded-full bg-red-500/20 px-2 py-0.5 text-red-300">
            post failed
          </span>
        )}
      </div>

      <div className="px-6 py-4">
        <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Question</div>
        <div className="mb-4 whitespace-pre-wrap text-sm text-gray-300">
          {expanded || draft.question_text.length <= 400
            ? draft.question_text
            : draft.question_text.slice(0, 400) + '…'}
          {draft.question_text.length > 400 && (
            <button
              onClick={() => setExpanded((e) => !e)}
              className="ml-2 text-xs text-emerald-400 hover:underline"
            >
              {expanded ? 'collapse' : 'show all'}
            </button>
          )}
        </div>

        <div className="mb-1 text-xs uppercase tracking-wide text-gray-500">Draft</div>
        {editing ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={Math.max(8, text.split('\n').length + 1)}
            className="mb-3 w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2 font-mono text-sm outline-none focus:border-emerald-500"
          />
        ) : (
          <div className="mb-3 whitespace-pre-wrap rounded-lg bg-gray-950 p-4 text-sm text-gray-100">
            {draft.draft_text}
          </div>
        )}

        {cites.length > 0 && (
          <div className="mb-3 text-xs text-gray-500">
            <span className="text-gray-400">cites:</span> {cites.join(', ')}
          </div>
        )}

        {draft.post_error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            last post error: {draft.post_error}
          </div>
        )}

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={onPost}
            disabled={busy}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? '…' : editing ? 'Post edited' : 'Post'}
          </button>
          <button
            onClick={() => setEditing((e) => !e)}
            disabled={busy}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            {editing ? 'Cancel edit' : 'Edit'}
          </button>
          <button
            onClick={onDismiss}
            disabled={busy}
            className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
