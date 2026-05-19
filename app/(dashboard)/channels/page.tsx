import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

interface ChannelRow {
  id: string;
  channel_id: string;
  channel_name: string | null;
  kb_namespace: string;
  last_poll_ts: string | null;
  auto_post_enabled: boolean;
  approved_count: number;
  paused: boolean;
  pause_reason: string | null;
  slack_workspaces: {
    workspace_name: string | null;
    workspace_id: string;
  } | null;
}

export default async function ChannelsPage() {
  const db = createServiceClient();
  const { data } = await db
    .from('slack_channels')
    .select(
      `id, channel_id, channel_name, kb_namespace, last_poll_ts,
       auto_post_enabled, approved_count, paused, pause_reason,
       slack_workspaces(workspace_name, workspace_id)`
    )
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as unknown as ChannelRow[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Channels</div>
      <h1 className="mb-2 text-3xl font-bold">Watched channels</h1>
      <p className="mb-8 max-w-2xl text-sm text-gray-400">
        Slack channels the cron polls every 5 minutes. Each channel binds to a
        KB namespace — the drafter retrieves chunks from that namespace when
        building a reply for questions on this channel.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-10 text-center text-gray-400">
          No channels yet. Connect a Slack workspace at{' '}
          <a href="/setup/slack" className="text-emerald-400 hover:underline">
            /setup/slack
          </a>{' '}
          to add the first one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/60 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Workspace</th>
                <th className="px-4 py-3">KB namespace</th>
                <th className="px-4 py-3">Auto-post</th>
                <th className="px-4 py-3">Approved</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.map((c) => (
                <tr key={c.id} className="text-gray-300">
                  <td className="px-4 py-3 font-medium">
                    {c.channel_name ?? c.channel_id}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {c.slack_workspaces?.workspace_name ?? c.slack_workspaces?.workspace_id}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {c.kb_namespace}
                  </td>
                  <td className="px-4 py-3">
                    {c.auto_post_enabled ? (
                      <span className="text-emerald-400">enabled</span>
                    ) : (
                      <span className="text-gray-500">off</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400">{c.approved_count}</td>
                  <td className="px-4 py-3">
                    {c.paused ? (
                      <span className="text-amber-400" title={c.pause_reason ?? ''}>
                        paused
                      </span>
                    ) : (
                      <span className="text-emerald-400">active</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
