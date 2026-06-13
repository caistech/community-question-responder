import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';
import { getProvider } from '@/lib/providers';
import type { ProviderName, WorkspaceRow, ChannelRow } from '@/lib/providers';

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
    .select('id, draft_text, slack_msg_ts, status, channel_id, kind')
    .eq('id', id)
    .single();

  if (draftErr || !draft)
    return NextResponse.json({ error: 'Draft not found' }, { status: 404 });

  if (!['pending_review', 'post_failed', 'edited_then_sent'].includes(draft.status)) {
    return NextResponse.json(
      { error: `Draft in status ${draft.status} cannot be posted` },
      { status: 409 }
    );
  }

  const { data: channel, error: chErr } = await db
    .from('slack_channels')
    .select('id, workspace_id, channel_id, channel_name, last_poll_ts, paused')
    .eq('id', draft.channel_id)
    .single();

  if (chErr || !channel)
    return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

  const { data: ws, error: wsErr } = await db
    .from('slack_workspaces')
    .select('id, provider, workspace_id, workspace_name, encrypted_token')
    .eq('id', channel.workspace_id)
    .single();

  if (wsErr || !ws)
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const text = overrideText?.trim() || draft.draft_text;
  if (!text) return NextResponse.json({ error: 'Empty draft' }, { status: 400 });

  // Read deployment_mode — in customer-self-serve mode, approved drafts
  // are marked reviewed without ever posting to the provider. The
  // operator's value comes from the draft itself; the bot never speaks.
  const { data: cfg } = await db
    .from('system_config')
    .select('deployment_mode')
    .eq('id', 1)
    .maybeSingle();
  const deploymentMode = (cfg?.deployment_mode as string | null) ?? 'customer-self-serve';
  const shouldPost = deploymentMode === 'vendor-self-deploy';

  try {
    let postedTs: string | null = null;
    if (shouldPost) {
      const provider = getProvider(ws.provider as ProviderName);
      // Replies thread under the asker's message; announces post top-level.
      const threadId = draft.slack_msg_ts && draft.kind === 'reply' ? draft.slack_msg_ts : null;
      const resp = await provider.postMessage(
        ws as WorkspaceRow,
        channel as ChannelRow,
        text,
        threadId
      );
      postedTs = resp.posted_ts;
    }

    const newStatus = overrideText ? 'edited_then_sent' : 'sent';
    await db
      .from('slack_drafts')
      .update({
        draft_text: text,
        status: newStatus,
        posted_ts: postedTs,
        posted_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', id);

    await db.from('audit_log').insert({
      draft_id: id,
      actor_id: user.id,
      action: shouldPost
        ? (overrideText ? 'edited_and_posted' : 'posted')
        : 'approved_locally_no_post',
      payload: {
        deployment_mode: deploymentMode,
        posted_ts: postedTs,
        channel: channel.channel_id,
        provider: ws.provider,
      },
    });

    // Bump approved_count
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

    return NextResponse.json({ ok: true, posted_ts: postedTs });
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
      payload: { error: msg, provider: ws.provider },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
