-- Community Question Responder — Slack bot-token migration
-- Per CQR_RELEASE_REQUIREMENTS.md Task 5 (Slack + Discord bot-token migration).
-- Idempotent.
--
-- Policy change: Slack workspaces now store BOT tokens (xoxb-) instead of
-- USER tokens (xoxp-). Bot tokens are the right choice for BYOK distribution:
-- the operator is the admin installing into their own workspace, branded
-- posts read as honest rather than impersonating, and multi-workspace
-- installs are clean.
--
-- The `encrypted_token` column itself is provider-agnostic — it stores
-- whatever credential the provider needs (Slack xoxb-, Discord bot token).
-- We do NOT drop it; we add new metadata columns alongside it.

-- ---------------------------------------------------------------------------
-- Add signing_secret column (Slack-only, nullable for now — required when
-- CQR adds Slack event-subscription webhooks; not used by the current
-- polling cron).
-- ---------------------------------------------------------------------------
ALTER TABLE public.slack_workspaces
  ADD COLUMN IF NOT EXISTS signing_secret text;

-- ---------------------------------------------------------------------------
-- Add token_type column so we can explicitly reject xoxp- on insert and
-- migrate any legacy rows. Nullable for backwards compatibility.
-- ---------------------------------------------------------------------------
ALTER TABLE public.slack_workspaces
  ADD COLUMN IF NOT EXISTS token_type text
  CHECK (token_type IS NULL OR token_type IN ('xoxb', 'xoxp', 'discord-bot'));

-- Backfill token_type for existing rows based on the encrypted_token prefix
-- (best-effort — operator can re-paste if the heuristic gets it wrong).
UPDATE public.slack_workspaces
SET token_type = CASE
  WHEN encrypted_token LIKE 'xoxb-%' THEN 'xoxb'
  WHEN encrypted_token LIKE 'xoxp-%' THEN 'xoxp'
  WHEN provider = 'discord' THEN 'discord-bot'
  ELSE NULL
END
WHERE token_type IS NULL;
