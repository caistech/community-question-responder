import type { SupabaseClient } from '@supabase/supabase-js';
import { slackClientFor, type SlackMessage } from './client';

interface ChannelRow {
  id: string;
  channel_id: string;
  last_poll_ts: string | null;
  workspace_id: string;
  paused: boolean;
}

interface WorkspaceRow {
  id: string;
  encrypted_token: string;
}

/**
 * Poll one channel for new top-level messages since last_poll_ts.
 *
 * Idempotent. Upserts into `slack_drafts` keyed on
 * (channel_id, slack_msg_ts). Threaded replies (thread_ts !== ts) and our
 * own messages are skipped. Sets the channel's last_poll_ts to the newest
 * ts seen.
 *
 * Returns counts so the cron route can log them.
 */
export async function pollChannel(
  db: SupabaseClient,
  channel: ChannelRow,
  workspace: WorkspaceRow,
  selfUserId?: string
): Promise<{ pulled: number; queued: number; newest_ts: string | null }> {
  if (channel.paused) return { pulled: 0, queued: 0, newest_ts: null };

  const client = slackClientFor(workspace.encrypted_token);

  const params: { channel: string; limit: number; oldest?: string } = {
    channel: channel.channel_id,
    limit: 100,
  };
  if (channel.last_poll_ts) params.oldest = channel.last_poll_ts;

  const resp = await client.conversations.history(params);
  const messages = (resp.messages ?? []) as SlackMessage[];

  let newest = channel.last_poll_ts;
  let queued = 0;

  // Cache asker names so we don't fetch the same user twice in one poll
  const askerCache = new Map<string, string>();

  for (const m of messages) {
    if (!m.ts) continue;
    if (!newest || Number(m.ts) > Number(newest)) newest = m.ts;

    // Skip threaded replies — only top-level posts qualify
    if (m.thread_ts && m.thread_ts !== m.ts) continue;
    // Skip bot/system messages
    if (m.subtype) continue;
    // Skip our own posts
    if (selfUserId && m.user === selfUserId) continue;
    if (!m.text || m.text.length < 20) continue;

    let askerName: string | null = null;
    if (m.user) {
      askerName = askerCache.get(m.user) ?? null;
      if (!askerName) {
        try {
          const info = await client.users.info({ user: m.user });
          askerName =
            info.user?.profile?.display_name ||
            info.user?.profile?.real_name ||
            info.user?.real_name ||
            info.user?.name ||
            null;
          if (askerName) askerCache.set(m.user, askerName);
        } catch {
          // Best-effort; null is fine
        }
      }
    }

    const { error: upsertErr } = await db.from('slack_drafts').upsert(
      {
        channel_id: channel.id,
        slack_msg_ts: m.ts,
        asker_slack_user_id: m.user ?? null,
        asker_name: askerName,
        question_text: m.text,
        status: 'pending_classification',
      },
      { onConflict: 'channel_id,slack_msg_ts', ignoreDuplicates: true }
    );

    if (!upsertErr) queued++;
  }

  if (newest && newest !== channel.last_poll_ts) {
    await db
      .from('slack_channels')
      .update({ last_poll_ts: newest, updated_at: new Date().toISOString() })
      .eq('id', channel.id);
  }

  return { pulled: messages.length, queued, newest_ts: newest };
}
