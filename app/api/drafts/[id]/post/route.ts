import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';
import { slackClientFor } from '@/lib/slack/client';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, db, error } = await authenticateAndGetDb(request);
  if (error || !db || !user)
    return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const overrideText: string | undefined = body.text;

  const { data: draft, error: draftErr } = await db
    .from('slack_drafts')
    .select('id, draft_text, slack_msg_ts, status, channel_id')
    .eq('id', id)
    .single();

  if (draftErr || !draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  if (
    !['pending_review', 'post_failed', 'edited_then_sent'].includes(draft.status)
  ) {
    return NextResponse.json(
      { error: `Draft in status ${draft.status} cannot be posted` },
      { status: 409 }
    );
  }

  const { data: channel, error: chErr } = await db
    .from('slack_channels')
    .select('channel_id, workspace_id')
    .eq('id', draft.channel_id)
    .single();

  if (chErr || !channel)
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

  const { data: ws, error: wsErr } = await db
    .from('slack_workspaces')
    .select('encrypted_token')
    .eq('id', channel.workspace_id)
    .single();

  if (wsErr || !ws)
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const text = overrideText?.trim() || draft.draft_text;
  if (!text) return NextResponse.json({ error: 'Empty draft' }, { status: 400 });

  const client = slackClientFor(ws.encrypted_token);

  try {
    const postOpts: { channel: string; text: string; thread_ts?: string } = {
      channel: channel.channel_id,
      text,
    };
    // Replies thread under the asker's message; announces post top-level.
    if (draft.slack_msg_ts) postOpts.thread_ts = draft.slack_msg_ts;

    const resp = await client.chat.postMessage(postOpts);

    const newStatus = overrideText ? 'edited_then_sent' : 'sent';
    await db
      .from('slack_drafts')
      .update({
        draft_text: text,
        status: newStatus,
        posted_ts: resp.ts ?? null,
        posted_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', id);

    await db.from('audit_log').insert({
      draft_id: id,
      actor_id: user.id,
      action: overrideText ? 'edited_and_posted' : 'posted',
      payload: { ts: resp.ts, channel: channel.channel_id },
    });

    // Bump approved_count via a fresh read + update (no SQL RPC needed)
    const { data: ch2 } = await db
      .from('slack_channels')
      .select('approved_count')
      .eq('id', draft.channel_id)
      .single();
    if (ch2) {
      await db
        .from('slack_channels')
        .update({ approved_count: (ch2.approved_count ?? 0) + 1 })
        .eq('id', draft.channel_id);
    }

    return NextResponse.json({ ok: true, ts: resp.ts });
  } catch (e) {
    const msg = (e as Error).message;
    await db
      .from('slack_drafts')
      .update({ status: 'post_failed', post_error: msg })
      .eq('id', id);
    await db.from('audit_log').insert({
      draft_id: id,
      actor_id: user.id,
      action: 'post_failed',
      payload: { error: msg },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
