# Slack setup (one-time per workspace)

CQR connects to Slack using a **bot token** (`xoxb-…`). The bot is invited
into the channels you want it watching; it polls them on a schedule, drafts
replies, and (after approval) posts as itself. This is the right model for
BYOK distribution: you install the bot into a workspace you admin, posts
read as honest "from the bot" rather than impersonating any human user, and
multi-workspace installs are clean.

> User OAuth tokens (`xoxp-…`) are **no longer accepted**. The validator
> at `/api/workspaces` will reject them with a pointer back to this doc.

Takes about five minutes per workspace.

## 1. Create the Slack app

1. Open https://api.slack.com/apps and sign in with your Slack account.
2. Click **Create New App** → **From scratch**.
3. Name it (e.g. `Community Reply Bot` — this is the display name shown on
   every post the bot makes). Pick the workspace you want the bot
   installed in.

## 2. Add the bot token scopes

1. Left sidebar → **OAuth & Permissions**.
2. Scroll to **Bot Token Scopes** (NOT *User Token Scopes*).
3. Add these four scopes:
   - `channels:history` — read public channel messages
   - `channels:read` — list channels and metadata
   - `chat:write` — post messages as the bot
   - `users:read` — resolve user IDs to names

> If you also need to watch private channels, add `groups:history` and
> `groups:read`. The minimum set above covers public channels only.

## 3. Install the bot to your workspace

1. Scroll back up the OAuth page.
2. Click **Install to Workspace**.
3. Authorise. You land back on the OAuth page with two tokens shown:
   - **Bot User OAuth Token** (starts with `xoxb-`) — **this is the one you want**.
   - **User OAuth Token** (starts with `xoxp-`) — ignore. We don't use it.
4. Copy the `xoxb-…` token.

## 4. Invite the bot into each channel

Bots do not auto-join channels even with `channels:history` scope. You
must explicitly invite the bot into every channel you want it watching:

```
/invite @community-reply-bot
```

(Use whatever you named the bot in step 1.) Do this in each target channel
before adding the channel to CQR.

## 5. (Optional) Capture the signing secret

Only required if you plan to add Slack event-subscription webhooks later.
The polling cron doesn't need it. To capture it now alongside the token:

1. Left sidebar → **Basic Information**.
2. Scroll to **App Credentials** → **Signing Secret**.
3. Click **Show** and copy the 32-char hex string.

You'll paste this into the optional field in the setup form below. Leave
blank if you're not adding webhooks yet — it can be added later via the
same form.

## 6. Paste the token into the dashboard

1. Open `https://<your-cqr-instance>/setup/slack` (sign in first).
2. Paste the `xoxb-…` token into the form.
3. (Optional) paste the signing secret into the second field.
4. Click **Validate and connect**. We call `auth.test` to confirm and store
   the credentials in `slack_workspaces`.

Repeat steps 1–6 for every workspace you want the bot in — one paste per
workspace.

## 7. Add a channel

Per channel you want the bot watching (and that you've already invited the
bot into per step 4):

1. Find the channel ID in Slack: right-click the channel → **View channel
   details** → scroll to bottom — it's the `C…` id.
2. Open `https://<your-cqr-instance>/channels` (UI coming).
3. Until the add-channel UI ships, insert a row via the Supabase SQL editor:

   ```sql
   insert into slack_channels (workspace_id, channel_id, kb_namespace)
   values (
     (select id from slack_workspaces where workspace_id = 'TXXXXXXXX'),
     'CXXXXXXXX',
     'your-kb-namespace'
   );
   ```

   `kb_namespace` should match a KB you've ingested for this community.

## 8. Wait for the cron

Vercel cron runs every 5 minutes:

- `/api/cron/slack-poll` — pulls new messages
- `/api/cron/slack-classify` — Haiku decides if worth answering
- `/api/cron/slack-draft` — Sonnet drafts replies

Within 10–15 minutes of the first poll, drafts will start landing in
`/drafts`. Approve, edit, or dismiss each one before it posts.

## Rotating the token

1. Revoke the old token at https://api.slack.com/apps → your app →
   **OAuth & Permissions** → **Revoke**.
2. Re-install the app (step 3 above) to mint a fresh `xoxb-…` token.
3. Paste it at `/setup/slack`. The upsert replaces the old token under
   the same `workspace_id`.

## Pause everything

```sql
update slack_channels set paused = true, pause_reason = 'manual kill switch';
```

## Why bot tokens, not user tokens

CQR previously shipped with user-token (`xoxp-`) support so the operator
could post as themselves in vendor communities. That model was retired
during BYOK release prep:

- **Multi-workspace install cleanliness** — bots installed into each
  workspace independently; user tokens carry the operator's whole Slack
  identity into every install.
- **Brand honesty** — posts read as "from the bot" not "from a real human
  saying X." Bot identity matches what the bot actually is.
- **BYOK fit** — the operator IS the workspace admin in their own install.
  No reason to impersonate anyone.
- **Operator safety** — bot tokens can be revoked from the workspace admin
  panel without touching the operator's personal Slack credentials.

If you have a use case that genuinely requires posting as a real user
(e.g. operating inside a community where bots are policy-restricted),
fork the provider and re-enable the `xoxp-` path locally — but do not
PR that change back. The default release ships bot-only.
