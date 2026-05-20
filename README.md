# Community Question Responder

**A BYOK Factory tool — community reply bot for vendor Slacks and Discords. Free, BYOK, your infrastructure.**

CQR polls developer-community channels, drafts thoughtful technical replies
against your own knowledge base, and holds each draft for one-click human
approval. Earn the expert reputation your tool deserves at the cadence the
community moves at, without burning a human in every channel.

CQR is one tool in the [BYOK Factory](https://corporate-ai-solutions.vercel.app/marketplace)
portfolio. Same methodology, same shared substrate, different surface. See
the marketplace for sibling tools and the [doctrine page](https://corporate-ai-solutions.vercel.app/engagement)
for the studio-in-residence engagement that pairs with self-hosted use.

---

## Deploy your own

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdennissolver%2Fcommunity-question-responder&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,ANTHROPIC_API_KEY,OPENAI_API_KEY,RESEND_API_KEY,RESEND_FROM_EMAIL,ELEVENLABS_API_KEY,CRON_SECRET,NEXT_PUBLIC_APP_URL&envDescription=Required+credentials+%E2%80%94+all+BYOK%2C+see+README+for+links&envLink=https%3A%2F%2Fgithub.com%2Fdennissolver%2Fcommunity-question-responder%23required-credentials)

Click the button, authorize GitHub + Vercel, paste your credentials when
prompted, deploy. First visit lands you on `/setup` which captures operator
identity and creates your ElevenLabs voice agent programmatically — no
clicking around their dashboard. Slack and Discord workspaces attach later
from the dashboard.

Target time from "never heard of CQR" to "live in your own infra":
**under five minutes, zero terminal commands.**

---

## Required credentials

All credentials are BYOK — you provide your own keys, you pay your own
vendor bills, the operator running the install (you) is the admin on every
external service. CQR never touches a CAS-owned key at runtime.

| Key | Vendor | Free tier? | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase | Yes | Create a project at [supabase.com/dashboard](https://supabase.com/dashboard/projects). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase | Yes | Settings → API. |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Yes | Settings → API. Server-only. Treat as password. |
| `ANTHROPIC_API_KEY` | Anthropic | Pay-per-use | Either this OR `OPENROUTER_API_KEY`. [Get a key](https://console.anthropic.com/account/keys). |
| `OPENROUTER_API_KEY` | OpenRouter | Pay-per-use | Alternative to Anthropic — multi-provider, often cheaper. [Get a key](https://openrouter.ai/keys). |
| `OPENAI_API_KEY` | OpenAI | Pay-per-use | Embeddings (`text-embedding-3-small`). [Get a key](https://platform.openai.com/api-keys). |
| `RESEND_API_KEY` | Resend | 3k emails/mo free | Magic-link delivery + notifications. [Get a key](https://resend.com/api-keys). |
| `RESEND_FROM_EMAIL` | Resend | n/a | Verified sender (e.g. `noreply@yourdomain.com`). |
| `ELEVENLABS_API_KEY` | ElevenLabs | 10 min/mo free | Voice agent (`/setup` creates the agent for you). [Get a key](https://elevenlabs.io/app/settings/api-keys). |
| `CRON_SECRET` | internal | n/a | Any 32+ char random string protecting `/api/cron/*`. |
| `NEXT_PUBLIC_APP_URL` | internal | n/a | Your deployed URL (`https://yourapp.vercel.app`). |

**Slack and Discord bot tokens are captured per-workspace, not as env vars.**
After deploy, visit `/setup/slack` or `/setup/discord` to attach workspaces.
See `SLACK_SETUP.md` for the bot-app install flow (Slack uses bot tokens —
`xoxb-`; user tokens are rejected).

### Install telemetry (Rule 10 carve-out — disclosed, opt-out)

On first successful `/setup` completion, CQR sends a one-time POST to
`https://corporate-ai-solutions.vercel.app/api/byok-telemetry/install` with
the payload `{ tool: "cqr", version, install_id, timestamp }`. This lets
BYOK Factory see aggregate install counts. **No PII** — `install_id` is a
UUID generated at first-run, never derived from your email or Supabase ref.

Opt out at deploy time with `BYOK_TELEMETRY=off` env var, or at runtime by
ticking the opt-out checkbox during `/setup`, or any time after by setting
`system_config.telemetry_opt_out = true`.

---

## Two deployment modes (one codebase)

The deployment mode is captured during `/setup`; you can switch later in
`system_config`. Same release, same BYOK keys, different post-approval
behaviour.

| Mode | Who deploys | Where approved drafts post | What you get |
|---|---|---|---|
| **customer-self-serve** | Operator on multi-vendor stacks | Nowhere — drafts queue for the operator only | Don't wait for vendor support; generate answers from public surfaces in seconds. |
| **vendor-self-deploy** | Vendor / community admin | Their own Slack or Discord, approval-gated | Clear the community queue faster without scaling headcount. |

The mode is a configuration switch, not a code fork. Pick whichever fits
the install; the rest of the product is identical.

---

## Shared substrate (`@caistech/*` packages)

CQR consumes the BYOK Factory hub packages so portfolio improvements flow in
automatically. This list is **auto-generated from `package.json`** by
`scripts/gen-readme-deps.mjs` — don't hand-edit, run the script.

<!-- @caistech-block:start -->
- **`@caistech/elevenlabs-convai`** `^0.1.5` — ElevenLabs Conversational AI — agent CRUD, webhooks, persistent memory. Used by the operator voice-capture FAB.
<!-- @caistech-block:end -->

(If this block is empty above, run `node scripts/gen-readme-deps.mjs` to
populate it from `package.json`.)

---

## How it works

1. **Watch.** A scheduled job polls each configured channel for new
   top-level questions you haven't answered yet.
2. **Classify.** A cheap LLM call (Claude Haiku) decides whether the
   question is on-topic, technical, and worth answering. Off-topic and
   noise drop out here.
3. **Draft.** A second call (Claude Sonnet) drafts a reply in your
   voice, grounded in your knowledge base via embeddings retrieval, with
   citations to the source documents.
4. **You approve.** Drafts queue in a dashboard. You read, edit if
   needed, click **Post**. The bot posts as itself in the configured
   channel.

Approval gate is non-negotiable for the first 60 days of any new channel
— auto-post only enables after proven calibration (≥50 approved drafts +
explicit per-channel opt-in in the dashboard).

---

## Architectural shape

- **Next.js 14** (App Router, server components by default)
- **Supabase** for persistence, auth, and `pgvector` knowledge base
- **Vercel** for deploy + cron
- **Claude** via Anthropic SDK (OpenRouter fallback) for classify/draft
- **OpenAI** for embeddings (`text-embedding-3-small`)
- **Slack Web API** (`@slack/web-api`) using bot tokens
- **Discord REST** for the Discord provider (same shape as Slack)
- **ElevenLabs ConvAI** for the operator voice-capture FAB

All mutations route through Next.js API routes using the Supabase
service-role client server-side. Client components never touch the service
role key directly.

---

## Local development

```bash
git clone https://github.com/dennissolver/community-question-responder.git
cd community-question-responder
cp .env.example .env.local
# fill in Supabase, Anthropic, OpenAI, Resend, ElevenLabs credentials
NODE_AUTH_TOKEN=$GITHUB_PACKAGES_TOKEN npm install --legacy-peer-deps
supabase db push           # apply migrations
npm run dev
```

Open `http://localhost:3000`. First visit redirects to `/setup` to capture
operator identity + create the voice agent.

---

## Alternative install paths

The Vercel Deploy button above is the canonical install path for public
users. For internal operators with access to the BYOK Factory shared hub,
the CLI wizard at `cais-shared-services/scripts/setup-product-credentials.mjs`
provides the same credential capture + agent creation flow against a local
checkout. Public users should use the Vercel button exclusively.

---

## From BYOK Factory

CQR is one tool in the [BYOK Factory](https://corporate-ai-solutions.vercel.app/marketplace)
portfolio. Sibling tools share the same:

- BYOK keys-and-infra contract (you bring keys; we never touch yours)
- `@caistech/*` shared substrate (improvements flow across all tools)
- Voice agent standard (every tool gets an operator voice surface)
- Setup wizard pattern (no CLI, no dashboard click-through)

If CQR fits one slot in your stack, the others probably fit elsewhere.
Studio-in-residence engagement is the paid wedge — paired build sprints
against the BYOK Factory methodology. [Talk to us](https://corporate-ai-solutions.vercel.app/engagement).

---

## License

MIT — see [LICENSE](./LICENSE). Free to fork, modify, redistribute.
