# Slack setup (one-time)

The cron polls Slack using a **user OAuth token** (starts with `xoxp-`), not
a bot token. This is intentional — it lets the responder operate in
community workspaces you don't own. You just need to be a member with read
access to the channels you want to watch.

Below is the exact sequence to mint the token and wire it up. Takes about
five minutes.

## 1. Create a Slack App

1. Open https://api.slack.com/apps and sign in with your Slack account.
2. Click **Create New App** → **From scratch**.
3. Name it `Community Question Responder` (or whatever you prefer — only
   you and Slack ever see this name).
4. Pick a workspace. **It doesn't have to be the community workspace you
   want to watch** — Slack just needs a home for the app definition.
   Your personal/dev workspace is fine.

## 2. Add the user token scopes

1. In the left sidebar, click **OAuth & Permissions**.
2. Scroll to **User Token Scopes** (not Bot Token Scopes — User).
3. Add these four scopes:
   - `channels:history` — read public channel messages
   - `channels:read` — list channels and metadata
   - `chat:write` — post messages as you
   - `users:read` — resolve user IDs to names

## 3. Install to your home workspace

1. Scroll up to the top of the OAuth page.
2. Click **Install to Workspace**.
3. Authorise.
4. You'll land back on the OAuth page with a **User OAuth Token** at the
   top, starting with `xoxp-`. Copy it.

## 4. Install to the community workspace you want to watch

For a workspace you **don't own**, you need to authorise the same app
inside that workspace separately:

1. Make sure you're signed in to the community workspace in Slack.
2. From the app's OAuth page, click **Install to Workspace** again.
3. Slack will prompt you to pick the workspace — choose the community one.
4. Authorise. You get a **new** `xoxp-` token, scoped to that workspace.

Repeat for every community workspace you want to watch.

> **Note on community apps:** some workspaces restrict app installs to
> admins. If you see "App approval required", message the workspace admins
> and ask them to allowlist the app. They'll see exactly the four scopes
> above — non-scary, no posting on others' behalf, no DM scopes.

## 5. Paste the token into the dashboard

1. Open `https://community-question-responder.vercel.app/setup/slack`
   (you'll need to sign in first).
2. Paste the `xoxp-…` token into the form and click **Validate and connect**.
3. We call `auth.test` to confirm it's live, then store it in
   `slack_workspaces`.

Repeat for every workspace you want to watch — one paste per workspace.

## 6. Add a channel

1. Find the Slack channel ID. In Slack: right-click the channel → **View
   channel details** → scroll to bottom — it's the `C…` id.
2. Open `https://community-question-responder.vercel.app/channels`.
3. (Channel-add UI coming next — for now, insert a row directly via the
   Supabase SQL editor):
   ```sql
   insert into slack_channels (workspace_id, channel_id, kb_namespace)
   values (
     (select id from slack_workspaces where workspace_id = 'TXXXXXXXX'),
     'CXXXXXXXX',
     'unipile'
   );
   ```
   `kb_namespace` should match the KB you've ingested for this community
   — `unipile`, `vercel`, `supabase`, etc.

## 7. Ingest a KB for the channel

Until the upload UI ships, POST documents directly:

```bash
curl -X POST https://community-question-responder.vercel.app/api/kb/ingest \
  -H 'content-type: application/json' \
  -b "$YOUR_SUPABASE_AUTH_COOKIE" \
  -d '{
    "namespace": "unipile",
    "source_path": "docs/sprint-0/03-unipile-research.md",
    "source_kind": "doc",
    "title": "Unipile research brief",
    "content": "...full markdown content..."
  }'
```

For the Unipile namespace, seed with:

- `docs/sprint-0/03-unipile-research.md` (from InvestorPilot)
- `docs/sprint-0/08-unipile-spike-spec.md`
- `docs/sprint-0/12-discovery-architecture.md`
- `src/lib/channels/channel-guard.ts` (with its long header comments)
- The four reference replies (Lucas / Jitin / Mikus / Juan) as
  `source_kind: 'reply_example'` rows

## 8. Wait for cron

Vercel cron runs every 5 minutes:

- `/api/cron/slack-poll` — pulls new messages
- `/api/cron/slack-classify` — Haiku decides worth-answering
- `/api/cron/slack-draft` — Sonnet drafts replies

Within 10–15 minutes of the first poll, drafts will start landing in
`/drafts`. Approve, edit, or dismiss each one.

## Rotating the token

If a token leaks or you want to rotate:

1. Revoke the old token at https://api.slack.com/apps → your app → OAuth & Permissions → **Revoke**.
2. Mint a new one (steps 3–4 above).
3. Paste it at `/setup/slack` — the upsert replaces the old token under
   the same `workspace_id`.

Pause everything in one click via the dashboard kill switch (planned) or
SQL:

```sql
update slack_channels set paused = true, pause_reason = 'manual kill switch';
```
