# CQR Release Requirements — Handoff brief for the next CQR session

**Created:** 2026-05-20
**Revised:** 2026-05-20 (incorporates 39-point review pass)
**Source:** /office-hours session at `C:\Users\denni\` that produced the methodology monetisation plan, plus follow-up alignment work that ran from the same home dir.
**This file is the handoff brief for the next Claude session opened against this CQR repo.**

**End-state acceptance criteria (single-click clone + execution):** a fresh user who has never seen CQR before clicks the Vercel Deploy button on the marketplace tile (`corporate-ai-solutions/marketplace/cqr`), authorizes GitHub, enters required env vars in the Vercel deploy wizard, deploys, visits the deployed URL, completes the one-time `/setup` screen (which programmatically creates their ElevenLabs agent and writes per-install identity config), and CQR is live in their own infrastructure. Total time from "never heard of it" to "running in production": **<5 minutes, zero terminal commands**.

**Framing: CQR is one tool in the BYOK Factory portfolio, not a standalone product.** The marketplace tile is the funnel. The README is the technical reference. Every artifact in this repo positions CQR as a sibling to other portfolio tools, not as the headline.

---

## Read first (in order)

1. `~\.gstack\projects\denni\denni-unknown-design-20260520-014844.md` — APPROVED design doc (strategic context)
2. `~\MONETISATION_STATE.md` — current state of the monetisation operation (weekly cadence). **Read at every session start** — Pipeline table tracks CQR's release status; Tripwire status (Rule 1) takes precedence over everything.
3. `~\MONETISATION_RULES.md` — 11 non-negotiables at auth-pattern severity. Especially Rules 3 (sanitisation), 9 (hub stays closed), 10 (every key user-provided), 11 (operator doesn't wait).
4. `~\MONETISATION_EXECUTION_PLAN.md` — Phase 0 → Phase 4 milestone sequence. CQR ships in Phase 3.
5. Memory: `~\.claude\projects\C--Users-denni\memory\project_cqr_byok_distribution.md` — CQR-specific decisions (two deployment modes, public-publish-no-outreach, provider bot migration decision).
6. Memory: `~\.claude\projects\C--Users-denni\memory\project_methodology_monetisation.md` — methodology brand decisions.
7. `~\PycharmProjects\Corporate-AI-Solutions\BYOK_PIVOT_REQUIREMENTS.md` — sibling brief for the marketing-site work running in parallel.

## Brand decisions (locked 2026-05-20)

- **Full descriptive name:** *BYOK AI Factory* — formal contexts only (LinkedIn entity, contracts, investor decks, package author field).
- **Everyday brand short form:** *BYOK Factory* — used everywhere else (README, hero, gist titles, conversation, footer attribution).
- **Essay sub-brand:** *Factory Floor* — content arm. Factory Floor essays from BYOK Factory.
- **Eventual one-word form:** *BYOK* — earned over time, do not use yet.
- **Engagement wedge:** *studio-in-residence* (canonical across all artifacts as of the rename sweep on 2026-05-20). Pairs with BYOK Factory.

Apply these consistently. Don't reintroduce *"operator-in-residence"* in any new content.

## Repo layout reference

This repo uses Next.js App Router with **no** `src/` directory. Routes live at `app/...`, libraries at `lib/...`. Every path in this brief uses that layout. If you're tempted to write `src/app/...` or `src/lib/...`, stop — you're about to create a parallel tree.

---

## What's already done by other sessions — DO NOT REDO

1. **Hub-canonical BYOK setup wizard exists** at `~\PycharmProjects\cais-shared-services\scripts\setup-product-credentials.mjs` (zero npm deps, runs before `npm install`, programmatic ElevenLabs agent creation via API per VOICE AI rule, per-vendor validators including `anthropic`, `openrouter`, `openai`, `resend`, `elevenlabs`, `supabase_url`).
2. **Hub-canonical manifest schema** at `~\PycharmProjects\cais-shared-services\scripts\setup-manifest.example.json` — 12-credential sample plus `create_elevenlabs_agent` post-action.
3. **CQR entry in marketing-site constants** at `~\PycharmProjects\Corporate-AI-Solutions\src\lib\constants.ts` — `releaseMode: 'byok-free'`, `deploymentModes: ['customer-self-serve', 'vendor-self-deploy']`, `featured: true`, `status: 'building'`.
4. **Platform type extended** in `~\PycharmProjects\Corporate-AI-Solutions\src\types\index.ts` — 5 new optional fields for BYOK era. Backwards-compatible.
5. **VOICE AI STANDARD RULE landed** in global `~\.claude\CLAUDE.md` (line 342). Mandates ElevenLabs ConvAI as canonical voice primitive, programmatic API agent provisioning (no dashboard click-through), BYOK voice keys, 3-click visibility, canonical persona consistency across the portfolio.

---

## Dependency graph (read before sequencing)

```
1 ──┐
2 ──┼──→ 11 (manifest needs sanitisation + audit clean)
3 ──┘
3 ────→ 4 ────→ 4b (identity + links feed into wizard + README)
4b ───→ 6, 7, 8, 10 (every outbound surface reads from portfolio-links.ts)
4 ────→ 7 (wizard reads identity config)
5 ────→ 11 (manifest needs provider field shape)
6 ────→ 7 (voice agent reads agent_id from system_config)
7 ────→ 16a (E2E Path A — internal operators only)
10 ───→ 16b (README must exist for Vercel button)
14 ───→ 15 (Deploy button URL → public repo)
15 ───→ 16b (public repo → E2E Path B)
```

Tasks 12 (license), 13 (GitHub Template) have no upstream blockers and can run anytime in P2 window.

---

## Tasks, in suggested execution order

### Task 1 (P1) — Sanitisation pass

**Why:** Rule 3 — no public artifact references client names, Supabase project refs, Vercel slugs, internal paths, or NDA-covered work. CQR can't go public without this.

**Acceptance:**
- Run secret-scan gates:
  - `gitleaks detect --no-banner --source .` — must exit clean.
  - `trufflehog git file://. --only-verified --no-update` — must exit clean.
- Run NDA-client greps across full history (`git log --all -p | grep -i <client>`) for at minimum: `mmcbuild`, `investorpilot`, `unipile`, plus any other client name the operator confirms.
- **MMC Build NDA check is explicit and blocking** — if any code path, comment, env var name, file name, migration name, or commit message references MMC Build, it gets removed or anonymised before this task is marked done.
- Default-deny when uncertain — if a reference's authorisation isn't named, it gets removed.

---

### Task 2 (P1) — Rule 10 BYOK audit

**Why:** Rule 10 — every external service whose usage scales with end-user activity requires a user-provided credential. **Zero CAS-owned fallback. Zero (c)-class entries before release.**

**Acceptance:**
- Run a `process.env.X` inventory across CQR's own code (not `node_modules`).
- Classify each as:
  - **(a)** user-provided credential — surfaces in setup-manifest, encrypted-at-rest in Supabase per-user, no env-var-only path.
  - **(b)** CAS-owned but scales-with-installs (acceptable per Rule 10 carve-out) — disclosed in README, opt-out-able.
  - **(c)** CAS-owned and scales-with-end-user-usage — **BLOCKING**. Refactor to (a). No exceptions.
- Document the classification in a comment block at the top of `lib/config.ts` (or equivalent) so future audits can verify.

---

### Task 3 (P1) — Supabase `system_config` table + code refactor

**Why:** runtime-written values (agent_id, schema version, install ID, anything the app generates after first deploy) can't live in env vars — Vercel env vars require the user to manually copy a value back into their Vercel dashboard, breaking the no-CLI promise. These values must live in Supabase, owned by the user, written by the app.

**Schema decision (locked):** typed columns for known keys plus an `extra jsonb` field for forward compatibility. Closes prior Open Decision #2.

**Acceptance:**
- New migration: `supabase/migrations/XXX_system_config.sql` creates a `system_config` table with typed columns — `agent_id text`, `setup_complete boolean default false`, `schema_version int`, `install_id uuid default gen_random_uuid()`, `telemetry_opt_out boolean default false`, plus `extra jsonb default '{}'::jsonb`. RLS enabled. Only service-role can write.
- Per the SUPABASE MIGRATIONS rule (global CLAUDE.md), apply the migration via `supabase db push` in the same workstream — do not punt to the user.
- Code refactor: every read of a runtime-generated value (agent_id, etc.) becomes a Supabase read against `system_config`, not `process.env`.
- ElevenLabs agent client initialisation reads `agent_id` from `system_config` at request time (cached with TTL OK).
- Fallback behaviour: if `system_config.setup_complete` is false, the app shows the `/setup` route instead of the main UI.

---

### Task 4 (P1) — Per-install identity config

**Why:** CQR is portfolio-deployable. The operator IS the user. Hardcoded references to Dennis's name, signature, URL, or product branding leak Dennis's identity into every operator's deployed instance — the equivalent of shipping a SaaS app that signs every email from the founder's personal address.

**Acceptance:**
- Add operator identity columns to `system_config` (typed): `operator_name text`, `operator_url text`, `operator_signature text`, `bot_display_name text default 'Community Reply Bot'`.
- Remove the hardcoded `— Dennis, Corporate AI Solutions · https://corporate-ai-solutions.vercel.app/` signature from `lib/ai/voice.md`. Replace with a `{{operator_signature}}` token resolved at draft time from `system_config`.
- Voice rules shipped as the *default* opinionated voice (Dennis's voice as canonical example). Operators override by adding `voice-overrides.md` to their fork — drafter prepends `voice-overrides.md` to `voice.md` at request time if present. No per-install voice rules in the database.
- The 60-day approval gate rationale gets restated in operator-neutral terms in `lib/ai/voice.md` and in this project's CLAUDE.md: *the operator's reputation is at risk in the channels they post into, regardless of who the operator is.*
- Slack and Discord bot display name reads from `system_config.bot_display_name` (default `Community Reply Bot`, operator-configurable in `/setup`).
- The `/setup` wizard (Task 7) writes all four operator-identity fields before marking `setup_complete = true`.

---

### Task 4b (P1) — Portfolio links constants file

**Why:** CQR has multiple outbound links pointing at corporate-ai-solutions (marketplace tile, doctrine gist, engagement page, telemetry endpoint, Factory Floor essay). Hardcoding these URLs across README, dashboard chrome, voice agent greeting, telemetry client, etc. makes the sibling-session URL handoff painful — every URL change becomes a multi-file edit. Centralise to one file.

**Acceptance:**
- Create `lib/portfolio-links.ts`:
  ```ts
  export const PORTFOLIO_LINKS = {
    marketplace: 'https://corporate-ai-solutions.vercel.app/marketplace/cqr',
    doctrineGist: 'https://corporate-ai-solutions.vercel.app/engagement', // fallback until gist live
    engagement: 'https://corporate-ai-solutions.vercel.app/engagement',
    telemetryEndpoint: 'https://corporate-ai-solutions.vercel.app/api/byok-telemetry/install',
    factoryFloorEssay: null, // set once published
    portfolioRoot: 'https://corporate-ai-solutions.vercel.app',
  } as const;
  ```
- Every CQR-side outbound link reads from this file. Concrete consumers:
  - README footer "From BYOK Factory" block (Task 10 item 7) — links generated from the constants at build time via the same script that auto-generates the `@caistech/*` list (Task 10 item 6).
  - Dashboard chrome footer / brand strip — *"A BYOK Factory tool · [Marketplace] · [Doctrine]"*.
  - Voice agent default greeting (Task 6) — *"This is CQR, a BYOK Factory tool. See others at [marketplace]."*
  - Telemetry POST client (Task 8) — reads `telemetryEndpoint`.
- **Zero hardcoded `corporate-ai-solutions.vercel.app/...` URLs scattered through the codebase.** Grep gate: `grep -r "corporate-ai-solutions.vercel.app" --include="*.ts" --include="*.tsx" --include="*.md"` must return only `lib/portfolio-links.ts` and the README's auto-generated block.
- When sibling session reports a URL is live (marketplace tile flips from "Coming Soon" to live, doctrine gist published, essay #1 live), update one constant — not twelve hardcoded strings.
- Verification: after the sibling session reports each surface live, hit each URL from an incognito browser session and confirm 200 OK before flipping the corresponding constant from fallback to canonical.

---

### Task 5 (P1) — Provider bot-token migration (Slack + Discord)

**Why:** CQR currently ships with Slack USER tokens (xoxp-) per an earlier BD framing (Dennis-being-thoughtful-in-vendor-communities) that is defunct post-Arnaud. For BYOK distribution, bot tokens are correct: cleaner multi-workspace install, user is the admin installing into their own workspace, branded posts read as honest rather than impersonating. Discord has the same migration shape and ships with the same task.

**Acceptance:**
- **Slack:** Refactor `lib/providers/slack/` to use `SLACK_BOT_TOKEN` (xoxb-) + `SLACK_SIGNING_SECRET` instead of `SLACK_USER_TOKEN`. The `if (!token.startsWith('xoxp-'))` check in `lib/providers/slack/index.ts:29` becomes `if (!token.startsWith('xoxb-'))`.
- **Slack OAuth scopes (minimal for v1):** `channels:history`, `channels:read`, `chat:write`, `users:read`. Operators add `groups:history` / `groups:read` themselves if private channels needed. Closes prior Open Decision #4.
- **Discord:** Refactor `lib/providers/discord/` (mirror) to use bot tokens + canonical Discord scopes. Update `app/(dashboard)/setup/discord/page.tsx` accordingly.
- **Schema migration:** retire `slack_workspaces.encrypted_token` (user token column) and add bot-token columns. Idempotent. Migration writes a final audit_log entry per row before column drop so the cutover is preserved.
- **Update existing setup pages:** `app/(dashboard)/setup/slack/page.tsx` and `app/(dashboard)/setup/discord/page.tsx` walk the bot-app creation flow, not the user-token flow. (These pages are for ongoing reconfig; the first-run wizard is Task 7.)
- **Update `SLACK_SETUP.md`** to bot-app instructions.
- **Update code paths that posted as "the user"** to post as "the bot" — drafts still go through approval; posting is now "from the bot" not "as Dennis-shaped user".
- Manifest (Task 11) declares the new bot-token + signing-secret fields for both providers.

---

### Task 6 (P1) — Voice agent integration

**Why:** VOICE AI STANDARD RULE — every BYOK-free release requires voice agent presence. CQR's product-native use-case per the rule: **operator voice-capture-a-learning** (operator dictates new KB entries via voice instead of typing).

**Acceptance:**
- Consume `@caistech/elevenlabs-convai` from the hub (per Rule 9 — visible in `package.json`, not vendored). Pin with range `^x.y.z` so non-breaking portfolio updates flow automatically.
- Voice agent surface: **floating action button (FAB)** in the bottom-right corner of every authenticated page. Closes prior Open Decision #3. Reachable in ≤3 clicks per VOICE AI rule.
- Voice persona: ship CQR with a local placeholder persona in `lib/voice/persona.json`. When `cais-shared-services/voice-config.json` lands (Execution Plan Step 0.4), swap to the canonical config. Don't block this task on the hub file. Closes prior Open Decision #5.
- Programmatic agent creation handled via the hub wizard's `create_elevenlabs_agent` post-action — the app reads agent_id from `system_config` (Task 3), not env vars.

---

### Task 7 (P1) — First-run `/setup` route

**Why:** for the no-CLI single-click deploy flow, the app handles first-run post-deploy actions itself. ElevenLabs agent creation, Supabase schema migration if needed, per-install identity capture, OAuth — all happen on first visit, not via terminal.

**Route layout:**
- **Top-level `app/setup/page.tsx`** — first-run wizard. Lives *outside* `(dashboard)` so it can render before the operator has completed setup. Middleware redirects unauthenticated users to login; logged-in admin users land here on first visit if `system_config.setup_complete` is false.
- **Existing `app/(dashboard)/setup/slack/page.tsx` and `app/(dashboard)/setup/discord/page.tsx`** — ongoing reconfig pages (already exist). Used after first-run setup is complete. The new top-level `/setup` *does not* replace these; it walks the operator through them on first run and then steps aside.

**Acceptance:**
- UI walks the user through:
  1. Confirm Supabase is responding.
  2. Run any pending migrations (`system_config` table check).
  3. Capture operator identity (name, URL, signature, bot display name) — writes to `system_config`.
  4. Click "Create my ElevenLabs agent" → server action calls ElevenLabs API with user's `ELEVENLABS_API_KEY`, writes agent_id to `system_config`.
  5. Click "Connect Slack workspace" → OAuth flow with the user's Slack bot app (delegates to `app/(dashboard)/setup/slack/page.tsx`).
  6. Click "Connect Discord server" → OAuth flow with user's Discord bot app (delegates to existing dashboard page).
  7. Mark `system_config.setup_complete = true`.
- Subsequent visits skip `/setup` and route to the main app.
- Idempotent: re-visiting `/setup` continues from the last incomplete step (driven by per-step flags in `system_config.extra`). Recovery path for ElevenLabs API failure mid-wizard.
- **Future extraction flag:** this wizard's shape is portfolio-canonical. The moment a second portfolio tool needs the same flow, extract into `@caistech/setup-wizard`. Don't extract now (premature) — but note the candidate in `lib/setup/README.md`.

---

### Task 8 (P1) — Install telemetry per Rule 10 carve-out

**Why:** Rule 10's carve-out allows install-time telemetry (disclosed, opt-out). In portfolio mode, install pings let BYOK Factory see which tools are deployed where, in aggregate. This is what makes the portfolio addressable without violating the closed-hub rule.

**Acceptance:**
- On first successful `/setup` completion (when `setup_complete` flips to true), POST a signed event to `https://corporate-ai-solutions.vercel.app/api/byok-telemetry/install`:
  ```json
  { "tool": "cqr", "version": "<package.json version>", "install_id": "<system_config.install_id>", "timestamp": "<iso>" }
  ```
- Event is signed with HMAC-SHA256 using a public verification key shipped in the repo (no shared secret; signature proves *the deployed CQR build* sent the event, not who runs it).
- **No PII.** install_id is a uuid generated at first-run, not derived from operator email or Supabase ref.
- **Opt-out:** if `BYOK_TELEMETRY=off` env var is set OR `system_config.telemetry_opt_out = true`, the POST is skipped silently.
- **Disclosed in README** (Task 10 item 4) — Required credentials section calls out telemetry behavior in plain English with the opt-out instructions.
- Failure is non-blocking — if the telemetry endpoint is unreachable, setup still completes.

---

### Task 9 (P1) — Auth pattern + responsive + UI explanatory header rules

Standard portfolio rule sweep — apply to every page in CQR.

**Auth pattern (per global CLAUDE.md AUTH PAGE PATTERN rule):**
- Every login/signup page: forgot-password link, password visibility toggle, working magic-link button. Applies to operator admin login AND any end-user auth surfaces CQR exposes.
- Supabase Auth custom SMTP wired to Resend. **BYOK reconciliation:** the operator's verified-sender domain is read from `RESEND_FROM_EMAIL` (env) or `system_config` (db). If missing, `/setup` shows a clear error ("Magic-link login requires a verified sender domain. Set RESEND_FROM_EMAIL or configure it in /setup.") rather than failing silently when the user tries to log in.
- Auth callback in middleware allowlist.

**Responsive design (per global CLAUDE.md RESPONSIVE DESIGN RULE):**
- Audit every page at ≤414px (mobile) and ≥1280px (laptop).
- Tables/data grids: horizontal scroll inside bordered container OR stacked card view on mobile.
- Touch targets ≥44×44px.

**UI explanatory header (per global CLAUDE.md UI EXPLANATORY HEADER RULE):**
- Every page/panel opens with: what this is, what the user does here, why it matters. 1–3 sentences. Matter-of-fact tone.

---

### Task 10 (P1) — README rewrite (portfolio-tool framing)

**Why:** the README is the **technical reference**, not the funnel. The funnel is the marketplace tile on `corporate-ai-solutions/marketplace/cqr`. Operators arrive at the README having already chosen CQR from the catalog — the README confirms their choice and gives them the deploy action.

**Acceptance — required sections (in order):**
1. **Hero / one-line value prop** — *"A BYOK Factory tool — community reply bot for vendor Slacks and Discords. Free, BYOK, your infrastructure."* Locate CQR inside BYOK Factory in the very first line.
2. **What this is, in the portfolio** — 2-3 sentences: BYOK Factory is the methodology; CQR is one of N tools; here's where to see the others (link to marketplace).
3. **Vercel Deploy button** — labeled as "the technical action" not "the CTA." Embedded markdown badge linking to Vercel deploy URL with full env-var schema declared.
4. **Required credentials section** — every key listed, where to get one (link to vendor signup), cost expectation (free tier / paid), required vs optional. Includes the install-telemetry disclosure + opt-out instructions (Task 8).
5. **Both deployment modes documented side-by-side** — customer-self-serve vs vendor-self-deploy. State the user's choice; what the modes differ on (drafts post-or-not); when to pick which.
6. **`@caistech/*` consumption list** — list every `@caistech/*` package CQR depends on with a one-line description of what it does. **Generated at build time from `package.json`**, not hand-curated (add a `scripts/gen-readme-deps.mjs` or equivalent that updates a fenced block in README on `npm run build`). **This IS the methodology proof per Rule 9** — readers see the substrate.
7. **From BYOK Factory** — sibling-tools link block. Replaces the old "Built using BYOK Factory" footer. Lists other tools in the portfolio with one-line descriptions. Frames CQR as one of many, not as the headline. Links: marketplace tile, doctrine gist (when live, fallback to `/engagement` until then — closes prior Open Decision #1), Factory Floor essay #1 (when live).
8. **License** — MIT.
9. **Alternative install paths** — for *internal* operators only (not public users): the CLI wizard fallback at `cais-shared-services/scripts/setup-product-credentials.mjs` requires the closed hub checked out as a sibling. Public users use the Vercel Deploy button (Path B) exclusively.

---

### Task 11 (P1) — Write `setup-manifest.json` at repo root

**Why:** required by Rule 10 release gate. The hub wizard reads this; the example sample in `cais-shared-services/scripts/setup-manifest.example.json` is the schema reference.

**Acceptance:**
- Lives at CQR repo root: `setup-manifest.json`.
- **Schema is portfolio-canonical** — CQR fills in values, does not customise structure. If a structural change is needed, change the hub schema first per Rule 6 (anti-fork).
- Lists every required credential from CQR's actual stack post Tasks 2 (Rule 10 audit) and 5 (bot-token migration).
- Declares the `create_elevenlabs_agent` post-action with full config (system_prompt, first_message, voice_id from canonical config when available, language).
- Tested end-to-end (Task 16a).

---

### Task 12 (P2) — License file

**Acceptance:** MIT license at repo root (`LICENSE` file). Per portfolio-wide one-time decision in the execution plan integrated migration matrix. Standard MIT — no custom clauses.

---

### Task 13 (P2) — Enable GitHub Template repository setting

**Acceptance:** repo settings → enable "Template repository" toggle. `gh api -X PATCH /repos/dennissolver/community-question-responder -f is_template=true` or via the UI. After this, the repo shows a green "Use this template" button on GitHub.

---

### Task 14 (P2) — Vercel Deploy button URL

**Acceptance:** the README's Deploy button URL must declare every required env var in the URL query params. Format:

```
https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fdennissolver%2Fcommunity-question-responder&env=ANTHROPIC_API_KEY,NEXT_PUBLIC_SUPABASE_URL,...&envDescription=Required+credentials&envLink=https%3A%2F%2Fgithub.com%2Fdennissolver%2Fcommunity-question-responder%23required-credentials
```

Test the button end-to-end before declaring done — click it from an incognito session, walk the deploy flow, confirm Vercel prompts for every required env var. Coordinates with Task 15 (public repo) — button is useless until the source repo is reachable from an incognito session.

---

### Task 15 (P2) — Make CQR repo public

**Pre-requisites:** Tasks 1 (sanitisation), 2 (Rule 10 audit), 10 (README), 12 (license) all complete. Public push without all four is a non-starter.

**Acceptance:**
- Re-run the secret-scan gates from Task 1 immediately before flipping visibility: `gitleaks detect --no-banner --source .` and `trufflehog git file://. --only-verified --no-update` must exit clean against the current HEAD.
- `gh repo edit dennissolver/community-question-responder --visibility public --accept-visibility-change-consequences`.
- README is the technical reference — verify it renders correctly on GitHub.
- Verify GitHub Template setting is still on after visibility change.

---

### Task 16 (P2) — End-to-end test (split by audience)

**Why:** the release gate's item 4. Without this verification, the single-click promise is untested.

**Task 16a — Path A (internal-operators-only, CLI fallback):**
- Audience: portfolio operators who have the closed hub checked out as a sibling directory. **Not a public path** — Rule 9 keeps the hub closed, so public users cannot run this.
- Clone CQR to a clean directory (fresh machine or fresh temp dir).
- Run `node ../cais-shared-services/scripts/setup-product-credentials.mjs` from CQR repo root.
- Walk every credential. Confirm `.env.local` produced. Confirm `create_elevenlabs_agent` post-action runs successfully and writes agent_id (currently to `.env.local`; eventually to `system_config` table — Task 3 changes this).
- Confirm `npm install && npm run dev` produces a working app.
- Runs after Task 11 (manifest exists).

**Task 16b — Path B (public, Vercel Deploy button — the only public path):**
- Audience: public users arriving from the marketplace tile.
- From an incognito browser session, click the Deploy button in the README.
- Walk the Vercel deploy flow: authorize GitHub, fork the template, enter env vars, deploy.
- Visit the deployed URL.
- Confirm `/setup` route appears (because `system_config.setup_complete` is false).
- Walk the setup wizard: capture operator identity, click "Create my ElevenLabs agent", confirm agent_id gets written to `system_config`, confirm Slack OAuth completes, confirm Discord OAuth completes, confirm `setup_complete = true`.
- Confirm telemetry POST fires (Task 8) — check the corporate-ai-solutions telemetry endpoint received the install event.
- Confirm the main app loads, voice agent FAB is reachable in ≤3 clicks, and CQR is operationally usable.
- Runs after Task 15 (public repo) and depends on Task 14 (Deploy button URL).

Both paths must pass. Path A failure blocks internal velocity; Path B failure blocks the no-CLI public promise.

---

### Task 17 (P3) — Factory Floor essay #1 draft

**Why:** the release gate's item 14. Essay coordinates with public ship — they go live together.

**Acceptance:**
- Draft narrative (verify factual before publishing — do not claim "in one day" unless that's literally true): *"Across this work I built a methodology monetisation strategy, a new product for draftspeople, and an agent tool that housekept the whole portfolio. Here's why that was possible — and here's CQR, the first concrete product released under BYOK Factory. Clone, deploy in 5 minutes, both modes documented."*
- Includes the Unipile-401 case study as concrete proof point (per memory `project_cqr_byok_distribution.md`).
- Saved to wherever Factory Floor essays live (TBD — Substack default per execution plan Phase 1a).
- Coordinates with public ship: essay goes live the same day CQR repo goes public + Vercel Deploy button is functional + marketplace tile flips from "Coming Soon" to live (closes prior Open Decision #6 — marketplace tile readiness is a blocking dependency on public ship).
- Tone: builder-to-builder, direct, no apology framing for the Arnaud incident (public-publish-no-outreach decision — the artifact carries the work, no 1:1 to Arnaud).

---

## Hard constraints across every task

- **Rule 9 — hub stays closed.** This repo consumes `@caistech/*` packages but never vendors their source. Every `@caistech/*` import is visible in `package.json`; source lives in the private hub. Path A (Task 16a) is internal-operators-only precisely because it requires the closed hub.
- **Rule 10 — every key user-provided.** Zero CAS-owned scales-with-usage keys. The carve-out is install-time telemetry only (Task 8 — disclosed, opt-out).
- **Rule 6 — anti-fork on shared monetisation artifacts.** If the hub setup wizard or manifest schema needs a change, fix it in the hub canonical and propagate; do not fork into CQR.
- **Rule 11 — operator does not wait.** When blocked by an external dependency (vendor docs, GitHub API quirk, Slack OAuth weirdness, anything), draft the answer from public surfaces in minutes. Don't defer.
- **Portfolio-tool framing applied everywhere.** CQR is one of N tools in BYOK Factory. Every artifact in this repo (README, dashboard chrome, footer, voice agent greeting) positions CQR as a sibling, not the headline. *BYOK Factory* in everyday surfaces, *BYOK AI Factory* in formal-only. *Factory Floor* as the essay sub-brand. *Studio-in-residence* for the engagement wedge.
- **Per-install identity throughout.** No hardcoded Dennis name, signature, URL, or product brand in any code path. All read from `system_config` (Task 4). Operator-neutral language in every comment, error message, and UI string.
- **Bandwidth tripwire (Rule 1)** takes precedence. If portfolio hours drop below ~25 hrs/wk for 4 consecutive weeks, this work pauses.

## Open decisions surfaced for the user

(Eight decisions from the prior version of this brief have been resolved and removed: typed columns + extra jsonb for `system_config`; FAB for voice agent surface; minimal Slack scopes for v1; local placeholder voice persona until hub config lands; doctrine gist (fallback `/engagement`) for methodology footer link; marketplace tile readiness as blocking dependency on public ship; sibling Discord coverage in bot-token migration; Path A as internal-only.)

Remaining decisions worth flagging:

1. **Voice rules customisation depth.** Default is operators inherit Dennis's voice rules and add a `voice-overrides.md` if they want different. Alternative: parse voice.md into structured rules at boot and surface a `/voice-rules` editor page. Recommended: ship overrides-via-file for v1; build the editor only if a real operator asks for it.
2. **Telemetry event scope.** v1 is install-event only (one POST per install). Should later expand to weekly heartbeat with `{tool, version, install_id, drafts_approved_count_total}` so the portfolio can see usage trends? Decision deferred until a second tool ships and a portfolio dashboard exists to consume the data.

## What success looks like at end of next session

**Minimum (P1 tasks only — Tasks 1–11):**
- CQR is publishable. Sanitisation clean (gitleaks + trufflehog gates pass), Rule 10 audit clean, `system_config` table in place, per-install identity wired, providers bot-migrated (Slack + Discord), voice agent FAB present, `/setup` route working at top-level, install telemetry firing with opt-out, portfolio rules applied, README rewritten in portfolio-tool framing, `setup-manifest.json` at repo root.
- Path A (internal) end-to-end test passes (Task 16a).

**Stretch (P1 + P2 — Tasks 1–16):**
- License committed, Vercel Deploy button URL functional, GitHub Template setting enabled, repo public, telemetry endpoint receiving install events.
- Path B (public) end-to-end test passes (Task 16b).

**Deferred to a third session (P3):**
- Factory Floor essay #1 draft (separate work but coordinates with public ship).
- Coordination with corporate-ai-solutions session to flip marketplace tile from "Coming Soon" to live with real URLs.

When all P1+P2 are done, **the single-click clone + execution end-state is achieved**: a fresh user can click the Deploy button from the marketplace tile and have CQR running in their own infrastructure in <5 minutes with zero CLI use.

## Coordination notes

- **Sibling session:** Corporate-AI-Solutions session is working in parallel on the marketing-site BYOK pivot per `~\PycharmProjects\Corporate-AI-Solutions\BYOK_PIVOT_REQUIREMENTS.md`.
- **Marketplace tile is the funnel apex.** The CQR README is the technical reference; the marketplace tile on corporate-ai-solutions is where users arrive from. Coordinate so the marketplace tile flips from "Coming Soon" to live on the same day CQR goes public.
- **Cross-session URL handoff:** once this session makes the CQR repo public + enables GitHub Template + gets the Vercel Deploy button URL working, **report those URLs back** so the sibling session can fill in placeholders in:
  - `corporate-ai-solutions/src/lib/constants.ts` CQR entry — `githubUrl`, `deployUrl` fields.
  - `/marketplace/cqr` page CTAs.
- **Telemetry endpoint readiness.** Task 8's install telemetry POSTs to `corporate-ai-solutions/api/byok-telemetry/install`. Coordinate with the sibling session to confirm that endpoint exists and is signature-verifying before CQR's first public install. If the endpoint isn't ready by Task 16b, Task 8's POST silently fails (non-blocking) and the install completes — but the portfolio loses visibility on that install.
- **Read `MONETISATION_STATE.md` at session start.** The Pipeline table tracks CQR's status. Update it as items complete. Weekly cadence — log progress in the Weekly update log section.
