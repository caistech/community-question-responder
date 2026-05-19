-- Migration 0003 — provider column on workspaces
-- Add provider discriminator so the same tables can hold Slack and Discord
-- (and later: forums, Reddit, etc.) workspaces. Existing rows backfill to
-- 'slack'. Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='slack_workspaces' AND column_name='provider'
  ) THEN
    ALTER TABLE public.slack_workspaces
      ADD COLUMN provider text NOT NULL DEFAULT 'slack'
      CHECK (provider IN ('slack', 'discord'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_workspaces_provider ON public.slack_workspaces (provider);

-- Note on table names: we keep `slack_workspaces`, `slack_channels`, and
-- `slack_drafts` for now even though they hold multi-provider rows. Renaming
-- is intentionally deferred to avoid a high-churn migration during active
-- development. The names are a misnomer; the data model is provider-aware.
