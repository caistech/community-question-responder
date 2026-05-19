import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyCronSecret } from '@/lib/supabase/auth';
import { pollChannel } from '@/lib/slack/poll';
import { slackClientFor } from '@/lib/slack/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();

  const { data: channels, error: chErr } = await db
    .from('slack_channels')
    .select('id, channel_id, last_poll_ts, workspace_id, paused')
    .eq('paused', false);

  if (chErr) return NextResponse.json({ error: chErr.message }, { status: 500 });
  if (!channels?.length) return NextResponse.json({ polled: 0, message: 'no channels configured' });

  // Group by workspace to fetch tokens once
  const wsIds = Array.from(new Set(channels.map((c) => c.workspace_id)));
  const { data: workspaces } = await db
    .from('slack_workspaces')
    .select('id, encrypted_token')
    .in('id', wsIds);
  const wsMap = new Map((workspaces ?? []).map((w) => [w.id, w]));

  // Cache self user id per workspace
  const selfMap = new Map<string, string>();
  for (const ws of workspaces ?? []) {
    try {
      const r = await slackClientFor(ws.encrypted_token).auth.test();
      if (r.user_id) selfMap.set(ws.id, r.user_id);
    } catch (e) {
      console.warn('auth.test failed for workspace', ws.id, e);
    }
  }

  const results: Array<{ channel_id: string; queued: number; pulled: number; error?: string }> = [];
  for (const ch of channels) {
    const ws = wsMap.get(ch.workspace_id);
    if (!ws) continue;
    try {
      const r = await pollChannel(db, ch, ws, selfMap.get(ws.id));
      results.push({ channel_id: ch.channel_id, queued: r.queued, pulled: r.pulled });
    } catch (e) {
      results.push({
        channel_id: ch.channel_id,
        queued: 0,
        pulled: 0,
        error: (e as Error).message,
      });
    }
  }

  return NextResponse.json({ polled: channels.length, results });
}
