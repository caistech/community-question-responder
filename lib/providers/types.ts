import type { SupabaseClient } from '@supabase/supabase-js';

export type ProviderName = 'slack' | 'discord';

export interface WorkspaceRow {
  id: string;
  provider: ProviderName;
  workspace_id: string;
  workspace_name: string | null;
  encrypted_token: string;
  /** Slack: 'xoxb' | 'xoxp' (legacy). Discord: 'discord-bot'. Null for legacy rows. */
  token_type?: 'xoxb' | 'xoxp' | 'discord-bot' | null;
  /** Slack only — signing secret for event-subscription webhooks. Null until needed. */
  signing_secret?: string | null;
}

export interface ChannelRow {
  id: string;
  workspace_id: string;
  channel_id: string;
  channel_name: string | null;
  last_poll_ts: string | null;
  paused: boolean;
}

export interface PollResult {
  pulled: number;
  queued: number;
  newest_ts: string | null;
}

export interface PostResult {
  posted_ts: string | null;
}

export interface AuthValidation {
  workspace_id: string;
  workspace_name: string | null;
  user_id: string | null;
  user_name: string | null;
}

/**
 * Provider interface — every messaging-channel integration implements this.
 *
 * Provider-specific edges (Slack user tokens, Discord bot tokens, etc.) live
 * inside each implementation. The rest of the app (cron, drafter, approval
 * UI) treats workspaces uniformly.
 */
export interface Provider {
  name: ProviderName;

  /** Validate an installed token and return the workspace + self identity. */
  validateToken(token: string): Promise<AuthValidation>;

  /**
   * Poll a channel for new top-level messages since channel.last_poll_ts.
   * Upserts into slack_drafts as 'pending_classification'. Idempotent.
   */
  pollChannel(
    db: SupabaseClient,
    workspace: WorkspaceRow,
    channel: ChannelRow,
    selfUserId: string | null
  ): Promise<PollResult>;

  /**
   * Post a reply or announce to the given channel. For replies, threadId is
   * the parent message's id (Slack ts / Discord message id). For announces,
   * threadId is null and the post lands top-level.
   */
  postMessage(
    workspace: WorkspaceRow,
    channel: ChannelRow,
    text: string,
    threadId: string | null
  ): Promise<PostResult>;

  /** Fetch the channel's display name, if discoverable. */
  fetchChannelName(workspace: WorkspaceRow, channelId: string): Promise<string | null>;
}
