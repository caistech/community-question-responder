-- Community Question Responder — initial schema
-- Idempotent (IF NOT EXISTS everywhere). Safe to re-apply.

-- pgvector for KB embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ---------------------------------------------------------------------------
-- slack_workspaces
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slack_workspaces (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    text NOT NULL UNIQUE,             -- Slack team id (T...)
  workspace_name  text,
  encrypted_token text NOT NULL,
  scopes          text[] NOT NULL DEFAULT '{}',
  installed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slack_workspaces ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- slack_channels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.slack_channels (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          uuid NOT NULL REFERENCES public.slack_workspaces(id) ON DELETE CASCADE,
  channel_id            text NOT NULL,              -- Slack channel id (C...)
  channel_name          text,
  kb_namespace          text NOT NULL,              -- which KB to use when drafting
  last_poll_ts          text,                       -- Slack ts of newest message we have seen
  auto_post_enabled     boolean NOT NULL DEFAULT false,
  confidence_threshold  numeric(3,2) NOT NULL DEFAULT 0.90,
  approved_count        int NOT NULL DEFAULT 0,
  paused                boolean NOT NULL DEFAULT false,
  pause_reason          text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, channel_id)
);

ALTER TABLE public.slack_channels ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- slack_drafts
-- ---------------------------------------------------------------------------
-- One row per question we have considered. Unique on (channel_id, slack_msg_ts)
-- so re-polls upsert idempotently.
CREATE TABLE IF NOT EXISTS public.slack_drafts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id          uuid NOT NULL REFERENCES public.slack_channels(id) ON DELETE CASCADE,
  slack_msg_ts        text NOT NULL,                -- ts of asker's message
  asker_slack_user_id text,
  asker_name          text,
  question_text       text NOT NULL,
  classification      text,                         -- worth_answering | off_topic | noise | meta
  classifier_reason   text,
  draft_text          text,
  confidence_score    numeric(3,2),
  cite_files          jsonb,                        -- array of KB chunk references
  status              text NOT NULL DEFAULT 'pending_classification'
                      CHECK (status IN (
                        'pending_classification',
                        'classified_skip',
                        'pending_draft',
                        'pending_review',
                        'sent',
                        'edited_then_sent',
                        'dismissed',
                        'post_failed'
                      )),
  posted_ts           text,                         -- ts of our posted reply
  post_error          text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  classified_at       timestamptz,
  drafted_at          timestamptz,
  posted_at           timestamptz,
  reviewed_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (channel_id, slack_msg_ts)
);

CREATE INDEX IF NOT EXISTS idx_slack_drafts_status ON public.slack_drafts (status);
CREATE INDEX IF NOT EXISTS idx_slack_drafts_channel ON public.slack_drafts (channel_id, created_at DESC);

ALTER TABLE public.slack_drafts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- kb_documents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kb_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  namespace   text NOT NULL,                        -- e.g. 'unipile' | 'vercel'
  source_path text NOT NULL,
  source_kind text NOT NULL,                        -- 'doc' | 'code' | 'reply_example'
  title       text,
  raw_content text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (namespace, source_path)
);

ALTER TABLE public.kb_documents ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- kb_chunks
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.kb_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.kb_documents(id) ON DELETE CASCADE,
  namespace   text NOT NULL,
  chunk_index int NOT NULL,
  content     text NOT NULL,
  embedding   vector(1536),
  token_count int,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_namespace ON public.kb_chunks (namespace);

-- Note: ivfflat index requires data present before CREATE INDEX. Add it via
-- a follow-up migration once initial KB seed has landed.

ALTER TABLE public.kb_chunks ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- audit_log (append-only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_id    uuid REFERENCES public.slack_drafts(id) ON DELETE SET NULL,
  actor_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,                        -- approved | dismissed | edited | post_failed | reclassified
  payload     jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_draft ON public.audit_log (draft_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RLS policies (single-tenant MVP — authenticated users see everything)
-- Multi-org migration will replace these with organisation_id-scoped policies.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='slack_workspaces' AND policyname='auth_read_all') THEN
    CREATE POLICY auth_read_all ON public.slack_workspaces FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='slack_channels' AND policyname='auth_read_all') THEN
    CREATE POLICY auth_read_all ON public.slack_channels FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='slack_drafts' AND policyname='auth_read_all') THEN
    CREATE POLICY auth_read_all ON public.slack_drafts FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kb_documents' AND policyname='auth_read_all') THEN
    CREATE POLICY auth_read_all ON public.kb_documents FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='kb_chunks' AND policyname='auth_read_all') THEN
    CREATE POLICY auth_read_all ON public.kb_chunks FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_log' AND policyname='auth_read_all') THEN
    CREATE POLICY auth_read_all ON public.audit_log FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- match_documents() — cosine similarity retrieval for the drafter
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding vector(1536),
  match_namespace text,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 6
)
RETURNS TABLE (
  chunk_id    uuid,
  document_id uuid,
  source_path text,
  content     text,
  similarity  float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    d.source_path,
    c.content,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.kb_chunks c
  JOIN public.kb_documents d ON d.id = c.document_id
  WHERE c.namespace = match_namespace
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
