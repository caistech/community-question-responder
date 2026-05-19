import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';
import { slackClientFor } from '@/lib/slack/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, db, error } = await authenticateAndGetDb(request);
  if (error || !db || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { workspace_id, channel_id, kb_namespace } = body;
  if (!workspace_id || !channel_id || !kb_namespace) {
    return NextResponse.json(
      { error: 'workspace_id, channel_id, kb_namespace are required' },
      { status: 400 }
    );
  }

  const { data: ws } = await db
    .from('slack_workspaces')
    .select('id, encrypted_token')
    .eq('id', workspace_id)
    .single();

  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  let channelName: string | null = null;
  try {
    const r = await slackClientFor(ws.encrypted_token).conversations.info({ channel: channel_id });
    channelName = r.channel?.name ?? null;
  } catch {
    // Not fatal — store without name
  }

  const { error: insertErr } = await db.from('slack_channels').insert({
    workspace_id: ws.id,
    channel_id,
    channel_name: channelName,
    kb_namespace,
  });

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, channel_name: channelName });
}
