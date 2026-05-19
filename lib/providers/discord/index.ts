import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  Provider,
  WorkspaceRow,
  ChannelRow,
  PollResult,
  PostResult,
  AuthValidation,
} from '../types';

const DISCORD_API = 'https://discord.com/api/v10';

interface DiscordMessage {
  id: string;
  type: number;
  author?: {
    id: string;
    bot?: boolean;
    username?: string;
    global_name?: string | null;
  };
  content?: string;
  thread?: unknown;
  message_reference?: { message_id?: string; channel_id?: string };
  timestamp: string;
}

interface DiscordSelf {
  id: string;
  username: string;
  global_name?: string | null;
}

interface DiscordChannel {
  id: string;
  name?: string;
  guild_id?: string;
}

interface DiscordGuild {
  id: string;
  name: string;
}

async function discordFetch<T>(
  token: string,
  path: string,
  init?: RequestInit
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bot ${token}`);
  headers.set('Content-Type', 'application/json');

  const resp = await fetch(`${DISCORD_API}${path}`, { ...init, headers });
  if (!resp.ok) {
    const body = await resp.text().catch(() => '');
    throw new Error(`Discord ${resp.status}: ${body.slice(0, 200)}`);
  }
  return (await resp.json()) as T;
}

export const discordProvider: Provider = {
  name: 'discord',

  /**
   * Discord tokens are bot tokens (no prefix). Validate by calling
   * /users/@me and resolving the first guild the bot is a member of.
   *
   * If the bot is in multiple guilds, we still return ONE workspace; the
   * operator paste-installs once per guild (same UX as Slack workspaces).
   * The workspace_id we store is the GUILD id, not the bot's user id.
   */
  async validateToken(token: string): Promise<AuthValidation> {
    const self = await discordFetch<DiscordSelf>(token, '/users/@me');
    const guilds = await discordFetch<DiscordGuild[]>(token, '/users/@me/guilds');

    if (!guilds.length) {
      throw new Error(
        'Bot has not been added to any guild yet. Invite the bot to your target Discord server first, then re-paste the token.'
      );
    }

    // For MVP, use the first guild. A future enhancement lets the operator
    // pick if the bot is in multiple guilds.
    const guild = guilds[0];

    return {
      workspace_id: guild.id,
      workspace_name: guild.name,
      user_id: self.id,
      user_name: self.global_name ?? self.username,
    };
  },

  async fetchChannelName(workspace, channelId): Promise<string | null> {
    try {
      const ch = await discordFetch<DiscordChannel>(
        workspace.encrypted_token,
        `/channels/${channelId}`
      );
      return ch.name ?? null;
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

    const path = channel.last_poll_ts
      ? `/channels/${channel.channel_id}/messages?after=${channel.last_poll_ts}&limit=100`
      : `/channels/${channel.channel_id}/messages?limit=50`;

    const messages = await discordFetch<DiscordMessage[]>(
      workspace.encrypted_token,
      path
    );

    // Discord returns newest-first when no `after`; oldest-first when `after`
    // is set. Normalise to oldest-first so we walk chronologically.
    const ordered = channel.last_poll_ts
      ? messages
      : [...messages].reverse();

    let newest = channel.last_poll_ts;
    let queued = 0;

    for (const m of ordered) {
      // Update newest tracker — Discord snowflakes sort numerically as IDs
      if (!newest || BigInt(m.id) > BigInt(newest)) newest = m.id;

      // Skip bot messages (including our own bot's posts)
      if (m.author?.bot) continue;
      if (selfUserId && m.author?.id === selfUserId) continue;

      // Skip replies (Discord's reply analog of Slack threads)
      if (m.message_reference?.message_id) continue;

      // Skip system messages — type 0 is DEFAULT, type 19 is REPLY
      if (m.type !== 0) continue;

      if (!m.content || m.content.length < 20) continue;

      const askerName = m.author?.global_name ?? m.author?.username ?? null;

      const { error } = await db.from('slack_drafts').upsert(
        {
          channel_id: channel.id,
          slack_msg_ts: m.id,
          asker_slack_user_id: m.author?.id ?? null,
          asker_name: askerName,
          question_text: m.content,
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

    return { pulled: ordered.length, queued, newest_ts: newest };
  },

  async postMessage(
    workspace: WorkspaceRow,
    channel: ChannelRow,
    text: string,
    threadId: string | null
  ): Promise<PostResult> {
    const payload: { content: string; message_reference?: { message_id: string } } = {
      content: text.slice(0, 2000), // Discord per-message cap
    };
    if (threadId) {
      payload.message_reference = { message_id: threadId };
    }

    const resp = await discordFetch<DiscordMessage>(
      workspace.encrypted_token,
      `/channels/${channel.channel_id}/messages`,
      { method: 'POST', body: JSON.stringify(payload) }
    );

    return { posted_ts: resp.id };
  },
};
