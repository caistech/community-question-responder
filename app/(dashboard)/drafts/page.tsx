import { createServiceClient } from '@/lib/supabase/service';
import { DraftCard } from './draft-card';

export const dynamic = 'force-dynamic';

interface DraftRow {
  id: string;
  asker_name: string | null;
  question_text: string;
  draft_text: string | null;
  confidence_score: number | null;
  cite_files: unknown;
  status: string;
  kind: string;
  created_at: string;
  drafted_at: string | null;
  post_error: string | null;
  slack_channels: {
    channel_name: string | null;
    channel_id: string;
    kb_namespace: string;
  } | null;
}

export default async function DraftsPage() {
  const db = createServiceClient();

  const { data: drafts } = await db
    .from('slack_drafts')
    .select(
      `id, asker_name, question_text, draft_text, confidence_score, cite_files,
       status, kind, created_at, drafted_at, post_error,
       slack_channels(channel_name, channel_id, kb_namespace)`
    )
    .in('status', ['pending_review', 'post_failed'])
    .order('created_at', { ascending: false })
    .limit(50);

  const rows = (drafts ?? []) as unknown as DraftRow[];

  const { data: counts } = await db
    .from('slack_drafts')
    .select('status')
    .in('status', [
      'pending_classification',
      'classified_skip',
      'pending_draft',
      'pending_review',
      'sent',
      'edited_then_sent',
      'dismissed',
      'post_failed',
    ]);

  const tally: Record<string, number> = {};
  for (const r of counts ?? []) tally[r.status] = (tally[r.status] ?? 0) + 1;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
        Drafts queue
      </div>
      <h1 className="mb-2 text-3xl font-bold">Pending review</h1>
      <p className="mb-8 max-w-2xl text-sm text-gray-400">
        Every question the classifier flagged as worth answering lands here as a
        draft. Read it, edit if it needs a tweak, click <strong>Post</strong> and
        it sends from your Slack account. The approval gate is non-negotiable
        for the first 60 days per channel.
      </p>

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['pending_review', 'Awaiting review', 'emerald'],
          ['post_failed', 'Post failed', 'red'],
          ['sent', 'Sent', 'gray'],
          ['dismissed', 'Dismissed', 'gray'],
        ].map(([key, label, tone]) => (
          <div
            key={key}
            className={`rounded-2xl border border-gray-800 bg-gray-900/50 p-4`}
          >
            <div className={`text-2xl font-bold text-${tone}-400`}>{tally[key] ?? 0}</div>
            <div className="text-xs text-gray-500">{label}</div>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-10 text-center text-gray-400">
          No drafts pending. When the classifier flags a worth-answering
          question, it shows up here.
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((d) => (
            <DraftCard key={d.id} draft={d} />
          ))}
        </div>
      )}
    </div>
  );
}
