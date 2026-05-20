import { createServiceClient } from '@/lib/supabase/service';
import { LearningForm } from './learning-form';

export const dynamic = 'force-dynamic';

export default async function NewLearningPage() {
  const db = createServiceClient();

  const { data: channels } = await db
    .from('slack_channels')
    .select(
      `id, channel_id, channel_name, kb_namespace,
       slack_workspaces(workspace_name)`
    )
    .eq('paused', false)
    .order('channel_name');

  // Distinct namespaces (so the operator can ingest into a KB without announcing)
  const namespaceSet = new Set<string>();
  for (const c of channels ?? []) namespaceSet.add(c.kb_namespace);
  const namespaces = Array.from(namespaceSet).sort();
  // Fallback if no channels yet — at least let them seed 'unipile'
  if (namespaces.length === 0) namespaces.push('unipile');

  const channelOptions = (channels ?? []).map((c) => ({
    id: c.id,
    label: `#${c.channel_name ?? c.channel_id} — ${
      // @ts-expect-error joined shape
      c.slack_workspaces?.workspace_name ?? 'workspace'
    } (${c.kb_namespace})`,
    kb_namespace: c.kb_namespace,
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
        Capture a learning
      </div>
      <h1 className="mb-2 text-3xl font-bold">New learning</h1>
      <p className="mb-8 max-w-2xl text-sm text-gray-400">
        Type a thing you just learned about a vendor (API behaviour, edge
        case, gotcha) while building. It gets written to the KB immediately
        so future replies are smarter, and optionally drafted as a
        community announce post for your review.
      </p>

      <LearningForm channelOptions={channelOptions} namespaces={namespaces} />
    </div>
  );
}
