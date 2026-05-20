# CQR Release Gate Audit — 2026-05-20

> Per-item audit against the 14-item release gate in `CQR_RELEASE_REQUIREMENTS.md` + the BYOK distribution memory `~/.claude/projects/.../memory/project_cqr_byok_distribution.md`, plus landing-page (`app/page.tsx`) audit. Re-runnable.

## Tally

- **PASS:** 4 (Items 6 Auth, 7 Responsive, LP-1 hero exists, LP-2 explains in 1–3 sentences)
- **PARTIAL:** 3 (Items 2 BYOK audit, 8 UI headers, LP-7 explanatory-header tone)
- **FAIL:** 13 (Items 1, 3, 4, 5, 9, 10, 11, 12, 13, 14, LP-3 product-in-action, LP-4 Deploy CTA, LP-5 modes, LP-6 footer)
- **Biggest single blocker:** Item 12 (Slack bot-token migration) — touches `lib/providers/slack/index.ts`, setup page + form, schema migration, audit-log cutover, plus `SLACK_SETUP.md` rewrite.

## Per-item table

| # | Item | Status | Evidence | What's needed to close |
|---|---|---|---|---|
| 1 | Sanitisation pass (Rule 3) | **FAIL** | Hardcoded Dennis + `corporate-ai-solutions.vercel.app` in `lib/ai/voice.md:54`, `scripts/kb-sources/supabase.mjs:91,132`, `app/page.tsx:33,87`, `README.md:10`. Discord setup hardcodes "Corporate AI Solutions" attribution (`app/(dashboard)/setup/discord/page.tsx:17`). Unipile / InvestorPilot refs across `lib/ai/voice.md`, `scripts/kb-sources/unipile.mjs`, `scripts/seed-kb.mjs`, `supabase/migrations/0001_init.sql`. | Run gitleaks + trufflehog gates; replace signature with `{{operator_signature}}` token; pull operator-identity through `system_config` fields. |
| 2 | Rule 10 BYOK audit (zero CAS-fallback keys) | **PARTIAL** | 13 `process.env.X` refs across `middleware.ts`, `lib/ai/anthropic.ts`, `lib/supabase/*.ts`, `lib/kb/embedder.ts`. No obvious `\|\| 'cas-default'` fallback. No classification block exists. | Add classification at top of new `lib/config.ts` declaring each key as (a)/(b)/(c) per Rule 10. Acknowledge zero (c)-class. |
| 3 | `setup-manifest.json` at repo root | **FAIL** | Not present. | Author following `cais-shared-services/scripts/setup-manifest.example.json`. List Anthropic, OpenAI, Supabase URL/anon/service-role, Slack bot+signing, Discord bot, Resend, ElevenLabs, CRON_SECRET. Include `create_elevenlabs_agent` post-action. |
| 4 | Setup wizard E2E | **FAIL** | Cannot run — manifest absent. | After Item 3 lands, run `node ../cais-shared-services/scripts/setup-product-credentials.mjs` from CQR root and confirm `.env.local` generated. |
| 5 | Voice agent present (operator voice-capture-a-learning) | **FAIL** | No `@caistech/elevenlabs-convai` in `package.json`. No `ELEVENLABS*` env refs. No voice UI in any `app/**/page.tsx`. `learnings/new` is a text form. | Install `@caistech/elevenlabs-convai`, add FAB to `app/(dashboard)/layout.tsx`, create `lib/voice/persona.json`, wire voice-capture-a-learning into `app/(dashboard)/learnings/new/page.tsx`, read `agent_id` from `system_config`. |
| 6 | Auth pattern (toggle + forgot-password + magic link) | **PASS** | `app/login/page.tsx:79-96` Eye/EyeOff toggle with `tabIndex={-1}` + `aria-label`; lines 98-100 link to `/forgot-password`; lines 123-130 wire `signInWithOtp`. `app/forgot-password/page.tsx` + `app/reset-password/page.tsx` both exist. | Verify `/api/auth/callback` is allowlisted in `middleware.ts`. |
| 7 | Responsive design audit | **PASS** | `app/page.tsx` uses `md:text-6xl`, `sm:flex-row`, `grid-cols-1 md:grid-cols-4`, `max-w-4xl/5xl/3xl`. Drafts uses `max-w-5xl`, `grid-cols-2 sm:grid-cols-4`. Login mobile-first `max-w-md`. Touch targets `py-3`. | Live-verify at 375px + 1440px via `/browse` before public ship; confirm tables on drafts/kb/channels have mobile strategy. |
| 8 | UI explanatory header on every panel | **PARTIAL** | `drafts/page.tsx:64-69` ✓. `setup/slack/page.tsx:12-20` ✓ (but Discord one names CAS). `learnings/new/page.tsx:40+` likely ✓. `kb/page.tsx` and `channels/page.tsx` — no header visible before render output. | Read kb + channels page bodies; add 1–3 sentence header. Rewrite Discord setup header to operator-neutral. |
| 9 | Methodology named in README + studio-in-residence footer link | **FAIL** | README has no mention of "BYOK Factory", "Factory Floor", "studio-in-residence", "methodology". Footer says only `Built by Corporate AI Solutions`. | Rewrite README per Task 10 in requirements — hero locates CQR in BYOK Factory, footer "From BYOK Factory" sibling block, studio-in-residence link from `PORTFOLIO_LINKS.engagement`. |
| 10 | License file (MIT default) | **FAIL** | No `LICENSE` file. README:120-122 says "Proprietary. © Corporate AI Solutions." | Write `LICENSE` (MIT); rewrite README License section. |
| 11 | `@caistech/*` consumption list in README | **FAIL** | Zero `@caistech/*` packages in `package.json`. `.npmrc` correctly points but nothing consumed. No `scripts/gen-readme-deps.mjs`. | Add `@caistech/ai-client`, `@caistech/elevenlabs-convai`, `@caistech/security-gate` (if used). Create `scripts/gen-readme-deps.mjs`. Update README. |
| 12 | Slack bot-token migration | **FAIL** | `lib/providers/slack/index.ts:29-30` still enforces `xoxp-`. `setup-form.tsx:42` placeholder `xoxp-…`. `setup/slack/page.tsx:51` instructs `User OAuth Token`. `SLACK_SETUP.md:3,37,47,60` user-token throughout. `CLAUDE.md:227` env list specifies `SLACK_USER_TOKEN`. Discord uses bot token (correct). | Refactor `lib/providers/slack/index.ts` to `xoxb-` + `SLACK_BOT_TOKEN` + `SLACK_SIGNING_SECRET`. Rewrite `setup/slack` for bot OAuth flow (scopes: `channels:history, channels:read, chat:write, users:read`). Update `SLACK_SETUP.md` + `CLAUDE.md`. Migration to retire `slack_workspaces.encrypted_token` (user token) and add bot-token columns. |
| 13 | Vendor-self-deploy mode functional + documented | **FAIL** | Zero references to `vendor-self-deploy` or `customer-self-serve` in code or docs (only in `CQR_RELEASE_REQUIREMENTS.md`). No config switch wired. README has no side-by-side mode docs. | Add `deployment_mode` enum to `system_config` (`customer-self-serve` \| `vendor-self-deploy`). Wire approval-post path to read mode. Document in README. |
| 14 | Factory Floor essay #1 draft | **FAIL** | No essay file found in `cais-shared-services/foundation/` or `~/*.md`. Only `MONETISATION_*.md` files exist at home root. | Draft Substack-format essay covering Unipile 401 / 90-second workaround. Save to `cais-shared-services/foundation/` or `~/factory-floor/essay-01-*.md`. |
| LP-1 | Landing page exists with hero | **PASS** | `app/page.tsx:1-40` — section + `<h1>Be present in every community. / Without burning a human in each one.</h1>`. | None. |
| LP-2 | Explains CQR in 1–3 sentences | **PASS** | `app/page.tsx:18-24` — 3-sentence value prop. | None. |
| LP-3 | Shows product in action | **FAIL** | Static 4-card "How it works" diagram (`app/page.tsx:42-81`) but no screenshot, no demo iframe, no live element preview. | Add screenshot of `/drafts` queue (or render `DraftCard` with sample data) into hero. |
| LP-4 | "Deploy your own" CTA pointing at the repo | **FAIL** | CTAs are "Open drafts queue" (internal `/drafts`) and "Talk to us about a build" (CAS site). No Vercel Deploy button, no GitHub repo link. | Add Vercel Deploy button per Task 14 in requirements. Link to public GitHub repo (post-Task 15). |
| LP-5 | Differentiates two modes (customer-self-serve vs vendor-self-deploy) | **FAIL** | Zero mention on the landing page. Positions CQR as single-tenant operator tool only. | Add "Two ways to run this" side-by-side from `project_cqr_byok_distribution.md`. |
| LP-6 | Footer link to methodology / studio-in-residence | **FAIL** | Footer says `Built by Corporate AI Solutions` with one link to CAS root. No methodology link, no studio-in-residence. | Replace footer: "A BYOK Factory tool · [Marketplace] · [Doctrine] · [Studio-in-residence inquiries]" reading from a new `lib/portfolio-links.ts`. |
| LP-7 | Landing page satisfies UI EXPLANATORY HEADER rule | **PARTIAL** | Hero subhead at `app/page.tsx:18-24` answers "what is this" but not "what to do / why" in the operator sense. Reads like marketing, not a matter-of-fact operator header. | Add 1-sentence operator strip above Deploy CTA: "Deploy in 5 min — BYOK, MIT-licensed, your infra." |

## Suggested ordering for closure

Grouping by surface area + risk-of-blocker, not severity:

**Wave A — install path lockdown (gates 3, 4, 5, 12):**
1. Slack bot-token migration (Item 12) — provider refactor, schema migration, setup page rewrite, `SLACK_SETUP.md` rewrite. Biggest single piece.
2. Voice agent (Item 5) — install `@caistech/elevenlabs-convai`, FAB in dashboard layout, persona config.
3. `setup-manifest.json` + setup wizard E2E (Items 3+4) — author manifest, run setup script end-to-end.

**Wave B — brand sanitisation (gates 1, 8, 9, 10, 11):**
4. Sanitisation pass (Item 1) — operator-identity tokens, replace Dennis/CAS/Unipile/InvestorPilot/MMC Build hardcodes.
5. UI explanatory headers (Item 8) — add headers to kb + channels pages; operator-neutral rewrite of Discord setup header.
6. README rewrite (Items 9, 10, 11) — methodology named, MIT license, `@caistech/*` consumption block + auto-gen script.
7. BYOK classification (Item 2) — `lib/config.ts` with classification block.

**Wave C — deployment mode + landing (gates 13, LP-3, LP-4, LP-5, LP-6, LP-7):**
8. Vendor-self-deploy switch (Item 13) — `system_config.deployment_mode`, conditional post-path.
9. Landing page upgrade (LP-3 through LP-7) — screenshot in hero, Deploy CTA, two-modes section, footer rewrite, operator strip.

**Wave D — release artifact (gate 14):**
10. Factory Floor essay #1 — Unipile 401 / 90-second workaround narrative.

Wave A unlocks the install promise. Wave B unlocks "this works for anyone, not just CAS." Wave C unlocks the conversion funnel. Wave D unlocks discovery.

**Single fastest path to a clean release:** Wave A → Wave B → Wave D → Wave C. Wave C is the conversion-quality layer; if Wave A+B+D are clean you can ship to a private audience for validation before Wave C polish.
