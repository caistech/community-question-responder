/**
 * Rule 10 BYOK env-var classification.
 *
 * Per CQR_RELEASE_REQUIREMENTS.md Task 2 — every `process.env.X` reference
 * in CQR's runtime source MUST be classified as one of:
 *
 *   (a) USER-PROVIDED — operator brings their own; appears in
 *       `setup-manifest.json`; encrypted at rest per-user; no CAS fallback.
 *
 *   (b) CAS-OWNED-BUT-DISCLOSED — scales with install count, NOT with
 *       end-user usage. Allowed under the Rule 10 carve-out provided it's
 *       opt-out-able and disclosed in README.
 *
 *   (c) CAS-OWNED-AND-USAGE-SCALING — BLOCKING. Would mean CQR sneaks a
 *       CAS key into runtime that the operator's traffic spends. MUST be
 *       refactored to (a) before public release.
 *
 * Audit cadence: re-run `grep -roE 'process\.env\.[A-Z_]+' --include="*.ts" --include="*.tsx" --include="*.mjs"`
 * against the source tree on every release prep; update the table below
 * if the inventory changes; verify no entries are class (c).
 *
 * Last audited: 2026-05-21 — zero (c)-class entries.
 */

/* eslint-disable @typescript-eslint/no-unused-vars */
const BYOK_CLASSIFICATION = {
  // ---------------------------------------------------------------------
  // (a) USER-PROVIDED — every key below is in setup-manifest.json + README
  //     and the operator provides their own value at deploy time.
  // ---------------------------------------------------------------------
  NEXT_PUBLIC_SUPABASE_URL: 'a',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'a',
  SUPABASE_SERVICE_ROLE_KEY: 'a',
  ANTHROPIC_API_KEY: 'a', // alternative to OPENROUTER_API_KEY
  OPENROUTER_API_KEY: 'a', // alternative to ANTHROPIC_API_KEY
  OPENAI_API_KEY: 'a',
  ELEVENLABS_API_KEY: 'a',
  CRON_SECRET: 'a', // operator generates random; nothing else uses this
  NEXT_PUBLIC_APP_URL: 'a',
  RESEND_API_KEY: 'a', // (not currently referenced in code — magic-link
  RESEND_FROM_EMAIL: 'a', //  delivery is handled by Supabase Auth's SMTP config)
  CLASSIFIER_MODEL: 'a', // optional model override
  DRAFTER_MODEL: 'a', // optional model override

  // ---------------------------------------------------------------------
  // (b) CAS-OWNED-BUT-DISCLOSED — install-time telemetry only.
  //     The telemetry endpoint is on a CAS-owned vercel.app surface; the
  //     POST fires once per install (when /setup completes) and carries
  //     no PII. Operators opt out via BYOK_TELEMETRY=off env var OR
  //     system_config.telemetry_opt_out=true OR ticking the box in /setup.
  //     Disclosed in README under "Install telemetry (Rule 10 carve-out)".
  // ---------------------------------------------------------------------
  BYOK_TELEMETRY: 'b', // value of 'off' opts out; absent = opted in

  // ---------------------------------------------------------------------
  // (c) CAS-OWNED-AND-USAGE-SCALING — MUST BE ZERO.
  // ---------------------------------------------------------------------
  // (none — verified 2026-05-21)
} as const;
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * Build-only helper kept here so anyone audit-reading this file can see
 * the classification table directly. The table itself is not imported
 * anywhere at runtime — it's documentation, not configuration.
 *
 * If you need to surface env-var-class info programmatically (e.g. for
 * an admin diagnostics page), import BYOK_CLASSIFICATION from here. For
 * now, no consumer exists.
 */
export type BYOKClass = 'a' | 'b' | 'c';
