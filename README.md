# Community Question Responder

**Automated thoughtful replies for dev-tool community Slacks and Discords.**

Polls a channel you can already see, drafts a high-quality technical reply
against your own knowledge base, and holds each draft for one-click human
approval. Earn the expert reputation your tool deserves — at the cadence
the community moves at, without burning a human in every channel.

Built by [Corporate AI Solutions](https://corporate-ai-solutions.vercel.app/).
Private beta. Productisation roadmap below.

---

## Who this is for

- **Dev-tool vendors** who need to be visibly present in three to ten
  community Slacks (Vercel, Supabase, Resend, Anthropic, Hunter,
  Unipile, Apollo, etc.) but can't have a human watching each one.
- **Solo founders / agency owners** running outbound on Unipile or
  similar, where being technically helpful in the vendor's own
  community is the highest-leverage form of inbound lead gen.
- **DevRel teams of one** who need to scale their attention across
  more channels than they can read in a day, without lowering the
  quality bar.

The buyer is anyone who knows: "the community is where my next ten
customers are, but I cannot personally read every message."

---

## How it works

1. **Watch.** A scheduled job polls each configured channel for new
   top-level questions you have not answered yet.
2. **Classify.** A cheap LLM call (Claude Haiku) decides whether the
   question is on-topic, technical, and worth answering. Off-topic
   and noise drop out here.
3. **Draft.** A second call (Claude Sonnet) drafts a reply in your
   voice, grounded in your knowledge base via embeddings retrieval,
   with citations to the source documents.
4. **You approve.** Drafts queue in a dashboard. You read, edit if
   needed, click **Post**. The system sends it from your account.

Webhook-free where possible: Slack's user-token API lets you operate
inside community workspaces you don't own, without requiring
workspace-owner approval to install a bot.

---

## Architectural shape

- **Next.js 14** (App Router, server components by default)
- **Supabase** for persistence, auth, and `pgvector` knowledge base
- **Vercel** for deploy + cron
- **Claude** via the Anthropic SDK (with OpenRouter fallback) for
  classification and drafting
- **OpenAI** for embeddings (`text-embedding-3-small`)
- **Slack Web API** via `@slack/web-api` using a user token

All mutations route through Next.js API routes that use the Supabase
service-role client server-side. Client components never touch the
service role key directly. Approval gate is non-negotiable for the
first 60 days of any new channel — auto-post only enables after
proven calibration.

---

## Productisation roadmap

This repo ships as a single-tenant app for the operator who owns it.
The path to multi-tenant SaaS is intentional:

1. **Single-tenant MVP (now).** Hard-coded org. One operator.
   Channels listed in env.
2. **Multi-org Tier 1 (next).** `organisations` table, per-org
   knowledge base, per-org Slack tokens.
3. **Self-serve onboarding.** Slack OAuth dance, per-channel
   subscription, KB upload UI, drafts dashboard scoped by org.
4. **Build-for-you offering.** Sell setup engagements where we run
   the KB ingestion, draft the voice rules, calibrate the approval
   threshold, hand over the dashboard.

The architecture is already organised around `organisation_id` so the
later migration is straight refactoring, not rewrite.

---

## Local development

```bash
git clone <repo>
cd community-question-responder
cp .env.example .env.local
# fill in Supabase, Anthropic, OpenAI, Slack credentials
npm install --legacy-peer-deps
supabase start             # local Postgres + auth + storage
supabase db push           # apply migrations
npm run dev
```

Open `http://localhost:3000`.

---

## Deployment

This project is registered in `cais-shared-services/portfolio-manifest.yaml`
and is deployed to Vercel under the `corporate-ai-solutions` team.
Supabase Auth (Site URL, redirect URLs, custom SMTP via Resend) is
configured via the canonical `onboard-new-project.sh` script in
`cais-shared-services`.

Migrations are applied via `supabase db push` from the project root —
never paste SQL into the Supabase SQL editor as the canonical apply
path, per global Claude conventions.

---

## License

Proprietary. © Corporate AI Solutions.
