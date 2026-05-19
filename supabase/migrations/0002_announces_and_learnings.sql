-- Migration 0002 — unified learnings + announce posts
-- Idempotent. Adds 'announce' kind to slack_drafts and relaxes slack_msg_ts.

-- Allow null slack_msg_ts (announce posts are not threaded under an asker)
ALTER TABLE public.slack_drafts ALTER COLUMN slack_msg_ts DROP NOT NULL;

-- Add a 'kind' discriminator: 'reply' (default) | 'announce'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='slack_drafts' AND column_name='kind'
  ) THEN
    ALTER TABLE public.slack_drafts
      ADD COLUMN kind text NOT NULL DEFAULT 'reply'
      CHECK (kind IN ('reply', 'announce'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_slack_drafts_kind ON public.slack_drafts (kind, status);

-- The existing UNIQUE (channel_id, slack_msg_ts) constraint works fine with
-- nulls because Postgres treats NULLs as distinct — multiple announce rows
-- with NULL slack_msg_ts can coexist on the same channel.

-- Source kind tracking: we already store source_kind on kb_documents as free
-- text (no CHECK constraint), so 'learning' is implicitly accepted at the
-- DB layer. The API route does the enum validation.
