import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyCronSecret } from '@/lib/supabase/auth';
import { getProvider } from '@/lib/providers';
import type { ProviderName, WorkspaceRow } from '@/lib/providers';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Provider-agnostic poll cron. Iterates over every active channel,
 * resolves its workspace + provider, and dispatches to the right
 * adapter's pollChannel().
 *
 * Path is /api/cron/slack-poll for historical reasons; Vercel cron is
 * pinned to this path in vercel.json. Despite the name, this handles
 * Slack AND Discord workspaces uniformly.
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();

  const { data: channels, error: chErr } = await db
    .from('slack_channels')
    .select('id, workspace_id, channel_id, channel_name, last_poll_ts, paused')
    .eq('paused', false);

  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!channels?.length)
    return NextResponse.json({ polled: 0, message: 'no channels configured' });

  // Fetch all referenced workspaces in one query
  const wsIds = Array.from(new Set(channels.map((c) => c.workspace_id)));
  const { data: workspaces } = await db
    .from('slack_workspaces')
    .select('id, provider, workspace_id, workspace_name, encrypted_token')
    .in('id', wsIds);
  const wsMap = new Map<string, WorkspaceRow>(
    (workspaces ?? []).map((w) => [w.id, w as WorkspaceRow])
  );

  // Resolve self-user id per workspace so we skip our own messages
  const selfMap = new Map<string, string | null>();
  for (const ws of workspaces ?? []) {
    try {
      const provider = getProvider(ws.provider as ProviderName);
      const v = await provider.validateToken(ws.encrypted_token);
      selfMap.set(ws.id, v.user_id);
    } catch (e) {
      console.warn('validateToken failed for workspace', ws.id, e);
      selfMap.set(ws.id, null);
    }
  }

  const results: Array<{
    channel_id: string;
    provider: ProviderName | null;
    queued: number;
    pulled: number;
    error?: string;
  }> = [];

  for (const ch of channels) {
    const ws = wsMap.get(ch.workspace_id);
    if (!ws) continue;
    try {
      const provider = getProvider(ws.provider);
      const r = await provider.pollChannel(db, ws, ch, selfMap.get(ws.id) ?? null);
      results.push({
        channel_id: ch.channel_id,
        provider: ws.provider,
        queued: r.queued,
        pulled: r.pulled,
      });
    } catch (e) {
      results.push({
        channel_id: ch.channel_id,
        provider: ws?.provider ?? null,
        queued: 0,
        pulled: 0,
        error: (e as Error).message,
      });
    }
  }

  return NextResponse.json({ polled: channels.length, results });
}
