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
    provider: string;
  } | null;
}

const PROVIDER_BADGE: Record<string, { label: string; tone: string }> = {
  slack: { label: 'Slack', tone: 'bg-emerald-500/15 text-emerald-300' },
  discord: { label: 'Discord', tone: 'bg-indigo-500/15 text-indigo-300' },
};

export default async function ChannelsPage() {
  const db = createServiceClient();
  const { data } = await db
    .from('slack_channels')
    .select(
      `id, channel_id, channel_name, kb_namespace, last_poll_ts,
       auto_post_enabled, approved_count, paused, pause_reason,
       slack_workspaces(workspace_name, workspace_id, provider)`
    )
    .order('created_at', { ascending: false });

  const rows = (data ?? []) as unknown as ChannelRow[];

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Channels</div>
      <h1 className="mb-2 text-3xl font-bold">Watched channels</h1>
      <p className="mb-8 max-w-2xl text-sm text-gray-400">
        Slack and Discord channels the cron polls every 5 minutes. Each row
        binds a channel to a KB namespace — the drafter retrieves from that
        namespace when answering questions in this channel. Use this view to
        spot paused channels (the cron skips them), check approval volume per
        channel, and confirm auto-post status. Add a workspace at{' '}
        <a href="/setup/slack" className="text-emerald-400 hover:underline">
          /setup/slack
        </a>{' '}
        or{' '}
        <a href="/setup/discord" className="text-emerald-400 hover:underline">
          /setup/discord
        </a>
        ; channel rows are created from server-side scripts (
        <code className="text-xs">scripts/seed-kb.mjs</code> or direct SQL)
        until the add-channel UI ships.
      </p>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-10 text-center text-gray-400">
          No channels yet. Connect a workspace at{' '}
          <a href="/setup/slack" className="text-emerald-400 hover:underline">
            /setup/slack
          </a>{' '}
          or{' '}
          <a href="/setup/discord" className="text-emerald-400 hover:underline">
            /setup/discord
          </a>{' '}
          to add the first one.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/60 text-left text-xs uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Workspace</th>
                <th className="px-4 py-3">KB namespace</th>
                <th className="px-4 py-3">Auto-post</th>
                <th className="px-4 py-3">Approved</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.map((c) => {
                const provider = c.slack_workspaces?.provider ?? 'slack';
                const badge = PROVIDER_BADGE[provider] ?? {
                  label: provider,
                  tone: 'bg-gray-500/15 text-gray-300',
                };
                return (
                  <tr key={c.id} className="text-gray-300">
                    <td className="px-4 py-3 font-medium">
                      {c.channel_name ?? c.channel_id}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.tone}`}>
                        {badge.label}
                      </span>
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
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
