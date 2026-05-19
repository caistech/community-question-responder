import { WebClient } from '@slack/web-api';

/**
 * Build a Slack WebClient bound to a user token.
 *
 * The token is fetched from `slack_workspaces.encrypted_token` for the
 * workspace the channel belongs to. For MVP we store it as plaintext
 * inside that column — a follow-up migration will swap to pgsodium
 * column-level encryption before the multi-org milestone.
 */
export function slackClientFor(token: string): WebClient {
  if (!token) throw new Error('Empty Slack token');
  return new WebClient(token);
}

export interface SlackMessage {
  ts: string;
  user?: string;
  text?: string;
  thread_ts?: string;
  subtype?: string;
}

export interface SlackUserInfo {
  id: string;
  real_name?: string;
  display_name?: string;
  name?: string;
}
