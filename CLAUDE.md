# Community Question Responder — CLAUDE.md

## Guardrails

This project operates under the Corporate AI Solutions global guardrails at
`~/.claude/CLAUDE.md`. All workflow contracts, stop-phrase rules, responsive
design rules, auth-page-pattern rules, and quality self-checks defined there
apply without exception.

**Risk Tier: STANDARD**
- Personal/internal-use BD tool, not customer-facing yet
- Standard read:edit discipline applies
- Approval gate on every posted draft is non-negotiable for the first 60 days
  — see "Approval gate" section below

---

## Project Purpose

Automated thoughtful replies for developer-community Slacks (and later
Discords / forums). Watches a channel, classifies new top-level questions,
drafts a reply grounded in a vendor-specific knowledge base, holds the draft
for human approval, posts on click.

The first deployed knowledge base is the **Unipile** corpus (extracted from
InvestorPilot's `docs/sprint-0/*` + `src/lib/channels/channel-guard.ts` plus
the seed-corpus of replies hand-written in May 2026). Future KBs will follow
the same shape for other vendor communities the operator is active in.

The strategic point: the operator earns reputation as a thoughtful technical
voice in the vendor's own community, which converts to inbound contract work
for building on top of that vendor. This is not a content marketing toy — it
is direct top-of-funnel for a venture studio.

---

## Architecture

Next.js 14 App Router on Vercel with Supabase for persistence + pgvector
knowledge base. Four explicit pipeline stages.

```
Stage 1: POLL       → cron: GET Slack conversations.history per channel
Stage 2: CLASSIFY   → Claude Haiku one-shot — is this worth answering?
Stage 3: DRAFT      → Claude Sonnet one-shot with KB retrieval + voice rules
Stage 4: APPROVE    → human reads + edits + posts via Slack chat.postMessage
```

**Hard constraints on the pipeline:**

- No agentic loops. Each Claude call is one-shot.
- No streaming inside cron jobs.
- One classify call per question, one draft call per question.
- Approval gate is non-negotiable for the first 60 days per channel.
- Auto-post only enables after proven calibration (≥50 approved drafts
  in a channel + manual sign-off in the dashboard).

---

## Approval gate (non-negotiable for 60 days)

Every draft enters the `slack_drafts` table with `status = 'pending_review'`.
A human must approve via the `/drafts` dashboard before anything posts to
Slack. The operator clicks one of three buttons:

- **Post** — calls `chat.postMessage` as the operator's user token, marks
  the draft `status = 'sent'`, records the resulting Slack `ts`.
- **Edit** — opens a textarea, re-stores the body, then posts.
- **Dismiss** — marks `status = 'dismissed'`, no Slack action.

Auto-post mode requires explicit per-channel opt-in via a dashboard toggle
AND a `confidence_score` threshold AND a minimum of 50 approved drafts
in that channel. Even then, every off-topic and edge-case question still
queues for human review.

**Why this rule exists:** A confidently-wrong reply in a vendor's own
community is brand damage that outlasts the channel. The cost of one
click per draft is far smaller than the cost of one bad post.

---

## Key Files (planned)

### API Routes

- `app/api/cron/slack-poll/route.ts` — scheduled poll of configured channels
- `app/api/cron/slack-classify/route.ts` — classify queued raw messages
- `app/api/cron/slack-draft/route.ts` — draft replies for classified-yes items
- `app/api/drafts/[id]/post/route.ts` — approve + post to Slack
- `app/api/drafts/[id]/edit/route.ts` — edit before post
- `app/api/drafts/[id]/dismiss/route.ts` — mark won't-answer
- `app/api/kb/ingest/route.ts` — add a document to the KB (chunk + embed)

### Pages

- `app/(dashboard)/drafts/page.tsx` — approval queue (server component)
- `app/(dashboard)/kb/page.tsx` — KB inspector
- `app/(dashboard)/channels/page.tsx` — configured channels + status

### Libraries

- `lib/supabase/server.ts` — Supabase SSR client (cookie-backed)
- `lib/supabase/service.ts` — service-role client (server-only)
- `lib/slack/client.ts` — Slack Web API wrapper using user token
- `lib/ai/classifier.ts` — Haiku one-shot classifier
- `lib/ai/drafter.ts` — Sonnet one-shot drafter with KB retrieval
- `lib/kb/embedder.ts` — OpenAI text-embedding-3-small wrapper
- `lib/kb/chunker.ts` — markdown chunker (token-aware)

---

## Database Schema

### `slack_workspaces`
The Slack workspace(s) the operator's user token is authenticated against.
One row per workspace. Stores encrypted token + scopes + last-poll cursor
per channel.

### `slack_channels`
Configured channels the operator wants the responder watching. References
`slack_workspaces`. Includes `auto_post_enabled`, `confidence_threshold`,
`approved_count` (rolling counter for auto-post gate).

### `slack_drafts`
Every question we have considered. Includes:
- `slack_msg_ts` (primary upsert key from Slack, never reused)
- `channel_id`, `asker_name`, `question_text`
- `classification` (`worth_answering`, `off_topic`, `noise`, `meta`)
- `draft_text`, `confidence_score`
- `cite_files` (which KB chunks were retrieved)
- `status` (`pending_review`, `sent`, `dismissed`, `edited_then_sent`)
- `posted_ts` (Slack ts of our reply, when posted)

### `kb_documents`
Source documents in the knowledge base. One row per ingested file.

### `kb_chunks`
Chunked + embedded text. `embedding vector(1536)`. Retrieved via
cosine-similarity `match_documents()` function.

### `audit_log`
Append-only. Every approval, dismissal, edit, post-failure recorded with
operator_id and Slack response payload. Survives even if `slack_drafts`
rows are pruned.

---

## Architectural Rules

### All mutations through API routes

Same rule as InvestorPilot. Never write to Supabase directly from client
components. Approval-button clicks call `/api/drafts/[id]/post` etc.

### Service role key is server-only

`SUPABASE_SERVICE_ROLE_KEY` must never appear in any `'use client'` file,
any file imported by a client component, or any `NEXT_PUBLIC_*` variable.

### Slack user token is server-only

Stored in `slack_workspaces.encrypted_token`. Never logged. Never sent to
the client. The dashboard fetches drafts via Supabase — the Slack API is
only called from `/api/cron/*` and `/api/drafts/*` server-side routes.

### Middleware allowlist pattern

Per global rule: `/api/cron/*`, `/api/webhooks/*`, and any signed-token
route MUST be allowlisted in `middleware.ts` or they 401 before the
handler runs. Already wired in `middleware.ts`.

### RLS on all tables

Every Supabase table has `ALTER TABLE x ENABLE ROW LEVEL SECURITY` and
explicit policies. Never disable. All migrations idempotent — wrap CREATE
in `IF NOT EXISTS` or exception handlers.

---

## Voice rules (Slack reply drafts)

The drafter's system prompt enforces:

- Opinionated practitioner opener (`Hey [Name] — built something close to this`).
- Push back on Claude-generated answers the asker may have pasted —
  add nuance the original missed. This is differentiator behaviour.
- Always include the "thing nobody talks about that bites at scale"
  beat — operational concerns (account health, rate caps, re-auth)
  are where the operator's real edge is.
- Concrete numbers where possible (LinkedIn invite cap ~100/week,
  channel-guard's 10/15/20 DM warmup curve, 21-day ramp).
- No emoji. No corporate fluff. Bullets and **bold** for scan-ability.
- Required signature at the end of every reply:
  ```
  — Dennis, Corporate AI Solutions · https://corporate-ai-solutions.vercel.app/
  ```

The voice rules live in `lib/ai/voice.md` and are loaded into the drafter's
system prompt at request time. **Never** edit the voice rules without
updating the calibration count for any affected channels back to zero,
since voice changes invalidate prior approval data.

---

## LLM Configuration

- Primary: Anthropic Claude via `@anthropic-ai/sdk`
- Models: Haiku 4.5 for classification, Sonnet 4.6 for drafting
- Embeddings: OpenAI `text-embedding-3-small`
- Fallback: OpenRouter if `OPENROUTER_API_KEY` set

Per global cost-aware rule: classifier MUST be Haiku, drafter MAY be Sonnet,
drafter MUST NOT be Opus by default (Opus only for explicit "high-stakes
post" override on a per-draft basis).

---

## Environment Variables

See `.env.example` for the complete list.

Required for production:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY` (or `OPENROUTER_API_KEY`)
- `OPENAI_API_KEY` (for embeddings)
- `SLACK_USER_TOKEN`, `SLACK_SIGNING_SECRET`
- `RESEND_API_KEY` (notifications)
- `CRON_SECRET`

---

## Cron schedule

Configured in `vercel.json`:

- `/api/cron/slack-poll` every 5 minutes — pull new messages
- `/api/cron/slack-classify` every 5 minutes — classify any raw messages awaiting classification
- `/api/cron/slack-draft` every 5 minutes — draft any classified-yes items awaiting a draft

All cron routes verify `CRON_SECRET` header before doing anything.

---

## Skill Routing

When the user's request matches an available skill, ALWAYS invoke it using
the Skill tool as your FIRST action — same convention as InvestorPilot.

| Stage / Situation | Skill to invoke |
|---|---|
| Bugs, errors, 500s | `/investigate` |
| Ship, deploy, push, create PR | `/ship` |
| QA, test the site | `/qa` |
| Code review | `/review` |
| Architecture review | `/plan-eng-review` |
| Save progress, checkpoint | `/checkpoint` |
| Visual audit | `/design-review` |
