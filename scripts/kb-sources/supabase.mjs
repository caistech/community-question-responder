// KB sources for the `supabase` namespace.
//
// Run: node scripts/seed-kb.mjs supabase

const MEMORY = 'C:/Users/denni/.claude/projects/C--Users-denni-PycharmProjects-investorpilot/memory';
const INVESTORPILOT = 'C:/Users/denni/PycharmProjects/investorpilot';

export default {
  fileSources: [
    {
      absolutePath: `${MEMORY}/reference_jwt_claim_multi_org_pattern.md`,
      source_path: 'memory/reference_jwt_claim_multi_org_pattern.md',
      source_kind: 'doc',
      title: 'JWT-claim multi-org RLS pattern (Supabase, pooler-safe)',
    },
    {
      absolutePath: `${MEMORY}/feedback_supabase_set_local_pooler.md`,
      source_path: 'memory/feedback_supabase_set_local_pooler.md',
      source_kind: 'doc',
      title: 'SET LOCAL is broken through the Supabase transaction-mode pooler',
    },
    {
      absolutePath: `${MEMORY}/feedback_middleware_allowlist_pattern.md`,
      source_path: 'memory/feedback_middleware_allowlist_pattern.md',
      source_kind: 'doc',
      title: 'Middleware allowlist pattern for self-authenticating /api routes',
    },
    {
      absolutePath: `${MEMORY}/reference_dual_fk_relational_trap.md`,
      source_path: 'memory/reference_dual_fk_relational_trap.md',
      source_kind: 'doc',
      title: 'Dual FK relational trap: PGRST201 when two FKs point at one table',
    },
    {
      absolutePath: `${MEMORY}/feedback_atomic_migration_sequencing.md`,
      source_path: 'memory/feedback_atomic_migration_sequencing.md',
      source_kind: 'doc',
      title: 'Atomic migration sequencing — schema + code must land together',
    },
    {
      absolutePath: `${INVESTORPILOT}/supabase/migrations/029_multi_org_memberships.sql`,
      source_path: 'supabase/migrations/029_multi_org_memberships.sql',
      source_kind: 'code',
      title: 'Reference migration: multi-org memberships + JWT auth hook',
    },
  ],
  inlineReplies: [
    {
      source_path: 'reply-examples/supabase-multi-org-rls.md',
      title: 'Reply example: multi-org RLS scoping (JWT-claim pattern)',
      content: `# Reply example: multi-org RLS scoping (Supabase Discord)

**Question pattern:** Variations of "how do I scope RLS so users can be in multiple organisations and switch between them at runtime? My current setup uses a single \`profile.organisation_id\` and I can't figure out how to handle multi-org without leaking across tenants."

**Reply body:**

Hey {name} — I hit exactly this six weeks ago and went through about three wrong patterns before landing somewhere stable. Short answer: don't use \`SET LOCAL\`, don't use membership-IN subqueries — use a JWT custom claim populated by Supabase's auth hook, and read it from RLS via a SQL helper.

The three patterns I tried that broke:

1. **\`SET LOCAL app.active_org_id\`** — the obvious one. Looks clean. Doesn't work in production. Reason: Supabase's default pooler is transaction-mode (Supavisor with \`pool_mode = "transaction"\`), and PostgREST wraps every REST call in its own transaction. \`SET LOCAL\` is transaction-scoped, so the value is gone before the next \`SELECT\` runs. Works fine in local dev with direct connections; silently fails the moment you deploy.

2. **Membership-IN RLS** (\`organisation_id IN (SELECT FROM memberships WHERE user_id = auth.uid())\`) — works correctly but it's "open RLS": every client query has to add an explicit \`.eq('organisation_id', x)\` to scope. One missed filter and the user sees data from every org they belong to. Defensive but error-prone.

3. **URL-only scoping** with no JWT claim — RLS has no enforcement layer, becomes app-perimeter-only. Fine until someone bypasses the route.

**What actually works — JWT-claim pattern:**

1. \`memberships(user_id, organisation_id, role)\` table, PK \`(user_id, organisation_id)\`. Role is per-org so a user can be owner of one and member of another.
2. \`profiles.active_organisation_id UUID\` — server-side pointer to the org the user is currently operating in.
3. **Custom Auth Hook** (\`custom_access_token_hook(event jsonb)\`) reads \`profiles.active_organisation_id\` for the user and writes it into \`event.claims.app.active_org_id\`. Enable via \`supabase/config.toml\` for local + Dashboard → Authentication → Hooks for prod. Don't forget \`GRANT EXECUTE ON FUNCTION ... TO supabase_auth_admin\` + \`GRANT ALL ON TABLE public.profiles TO supabase_auth_admin\` or the hook fires with no access.
4. **SQL helper** with COALESCE fallback:
\`\`\`sql
CREATE OR REPLACE FUNCTION public.current_active_org_id()
RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::jsonb
           #>> '{app,active_org_id}', '')::uuid,
    (SELECT active_organisation_id FROM public.profiles WHERE id = auth.uid())
  )
$$;
\`\`\`
The COALESCE fallback is load-bearing — it keeps the system functional during the deploy window before users refresh their tokens, and also covers the case where the hook is misconfigured. Don't skip it.
5. **RLS policies** read the helper: \`USING (organisation_id = public.current_active_org_id())\`. Same shape on every org-scoped table.
6. **Switching orgs** at runtime: app endpoint updates \`profiles.active_organisation_id\`, calls \`supabase.auth.refreshSession()\` to mint a new JWT with the updated claim. Downstream queries pick it up immediately.

The thing nobody warns you about: when you migrate from \`profiles.organisation_id\` to \`profiles.active_organisation_id\`, you now have **two FKs from profiles to organisations**. PostgREST relational shorthand like \`.select('*, organisations(*)')\` returns \`PGRST201\` ambiguity error — and worse, returns the join field as null silently if your client treats the 300 status loosely. Disambiguate explicitly: \`.select('*, organisations!profiles_active_organisation_id_fkey(*)')\`.

Drop the migration + the code-swap in the same PR. Don't stage them. I learned this the hard way: my migration nulled \`profiles.organisation_id\` to "fail-closed" and broke every existing read site in production. The fail-closed logic only holds if the reads have already been swapped. Two recovery migrations later, lesson absorbed.

{{operator_signature}}`,
    },
    {
      source_path: 'reply-examples/supabase-middleware-allowlist.md',
      title: 'Reply example: Next.js middleware returning 401 on webhook/cron routes',
      content: `# Reply example: Next.js middleware returning 401 on webhook/cron routes (Supabase Discord)

**Question pattern:** Variations of "my Next.js API route at \`/api/webhooks/...\` (or \`/api/cron/...\`) is returning 401 Unauthorized even though I'm verifying the webhook signature inside the handler. The signature is valid. Why is the route 401-ing before my handler runs?"

**Reply body:**

Hey {name} — almost certain this is your Supabase auth middleware running before the route handler. Same class of bug has bitten me twice in production. Quick check + the fix.

If you're using the standard \`@supabase/ssr\` middleware pattern (the one in Supabase's Next.js auth docs), the middleware gate checks for a valid Supabase auth cookie on every \`/api/*\` request. No cookie → 401, *before* your route handler runs. Webhooks from Resend/Stripe/Unipile/Slack don't carry your Supabase cookie — they carry a signature header instead. Cron requests from Vercel don't either; they carry a \`CRON_SECRET\` header. Both get rejected at the middleware gate before they ever reach your signature-verifying code.

Diagnosis:
- Response body is the *exact string* \`{"error": "Unauthorized"}\` — that's the middleware's shape, not a typical route handler.
- Curl with a valid signature header still returns 401.
- The route's own auth logic never logs anything.

Fix: add the route prefix to the middleware allowlist. In \`src/lib/supabase/middleware.ts\` (or wherever your auth-cookie check lives), add a negated path check so self-authenticating routes pass through:

\`\`\`ts
// Skip auth-cookie check for routes that authenticate themselves
if (
  !path.startsWith('/api/webhooks') &&
  !path.startsWith('/api/cron') &&
  !path.startsWith('/auth/')
) {
  // existing auth-cookie + session-refresh logic
}
\`\`\`

Two pieces of advice from the second time this bit me:

1. **Centralise the allowlist in middleware.** Don't try to "skip auth" inside the route handler — by the time the request reaches the handler, middleware has already gated it. The skip lives at the gate.

2. **Comment WHY each entry is allowlisted.** Otherwise the next person tries to "tighten security" by removing the allowlist and the entire integration silently breaks again. Specifically: webhook routes verify by signature, cron routes verify by shared secret, public invite-link landing pages don't need a session yet.

For verifying your route handler works once you've allowlisted: curl directly with the expected header. If it returns 200 + your real response, you're past the middleware gate and into your handler. The first time it gives a route-specific error message (rather than the generic \`Unauthorized\`), you've fixed it.

{{operator_signature}}`,
    },
  ],
};
