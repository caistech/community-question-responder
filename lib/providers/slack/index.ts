import { WebClient } from '@slack/web-api';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Provider,
  WorkspaceRow,
  ChannelRow,
  PollResult,
  PostResult,
  AuthValidation,
} from '../types';

function client(token: string): WebClient {
  if (!token) throw new Error('Empty Slack token');
  return new WebClient(token);
}

interface SlackMessage {
  ts?: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  subtype?: string;
}

export const slackProvider: Provider = {
  name: 'slack',

  async validateToken(token: string): Promise<AuthValidation> {
    if (!token.startsWith('xoxp-')) {
      throw new Error('Slack token must be a user OAuth token (xoxp-…)');
    }
    const info = (await client(token).auth.test()) as {
      team_id?: string;
      team?: string;
      user_id?: string;
      user?: string;
    };
    if (!info.team_id) throw new Error('Slack auth.test missing team_id');
    return {
      workspace_id: info.team_id,
      workspace_name: info.team ?? null,
      user_id: info.user_id ?? null,
      user_name: info.user ?? null,
    };
  },

  async fetchChannelName(workspace, channelId): Promise<string | null> {
    try {
      const r = await client(workspace.encrypted_token).conversations.info({
        channel: channelId,
      });
      return r.channel?.name ?? null;
    } catch {
      return null;
    }
  },

  async pollChannel(
    db: SupabaseClient,
    workspace: WorkspaceRow,
    channel: ChannelRow,
    selfUserId: string | null
  ): Promise<PollResult> {
    if (channel.paused) return { pulled: 0, queued: 0, newest_ts: null };

    const c = client(workspace.encrypted_token);
    const params: { channel: string; limit: number; oldest?: string } = {
      channel: channel.channel_id,
      limit: 100,
    };
    if (channel.last_poll_ts) params.oldest = channel.last_poll_ts;

    const resp = await c.conversations.history(params);
    const messages = (resp.messages ?? []) as SlackMessage[];

    let newest = channel.last_poll_ts;
    let queued = 0;
    const askerCache = new Map<string, string>();

    for (const m of messages) {
      if (!m.ts) continue;
      if (!newest || Number(m.ts) > Number(newest)) newest = m.ts;
      if (m.thread_ts && m.thread_ts !== m.ts) continue;
      if (m.subtype) continue;
      if (selfUserId && m.user === selfUserId) continue;
      if (!m.text || m.text.length < 20) continue;

      let askerName: string | null = null;
      if (m.user) {
        askerName = askerCache.get(m.user) ?? null;
        if (!askerName) {
          try {
            const info = await c.users.info({ user: m.user });
            askerName =
              info.user?.profile?.display_name ||
              info.user?.profile?.real_name ||
              info.user?.real_name ||
              info.user?.name ||
              null;
            if (askerName) askerCache.set(m.user, askerName);
          } catch {
            // Best-effort
          }
        }
      }

      const { error } = await db.from('slack_drafts').upsert(
        {
          channel_id: channel.id,
          slack_msg_ts: m.ts,
          asker_slack_user_id: m.user ?? null,
          asker_name: askerName,
          question_text: m.text,
          status: 'pending_classification',
          kind: 'reply',
        },
        { onConflict: 'channel_id,slack_msg_ts', ignoreDuplicates: true }
      );
      if (!error) queued++;
    }

    if (newest && newest !== channel.last_poll_ts) {
      await db
        .from('slack_channels')
        .update({ last_poll_ts: newest, updated_at: new Date().toISOString() })
        .eq('id', channel.id);
    }

    return { pulled: messages.length, queued, newest_ts: newest };
  },

  async postMessage(
    workspace: WorkspaceRow,
    channel: ChannelRow,
    text: string,
    threadId: string | null
  ): Promise<PostResult> {
    const opts: { channel: string; text: string; thread_ts?: string } = {
      channel: channel.channel_id,
      text,
    };
    if (threadId) opts.thread_ts = threadId;
    const resp = await client(workspace.encrypted_token).chat.postMessage(opts);
    return { posted_ts: resp.ts ?? null };
  },
};
