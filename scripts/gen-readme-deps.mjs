#!/usr/bin/env node
/**
 * scripts/gen-readme-deps.mjs
 *
 * Regenerate the @caistech/* consumption block in README.md from package.json.
 * Per CQR_RELEASE_REQUIREMENTS.md Task 10 item 6 — the consumption list is
 * the methodology proof per Rule 9 (readers see the shared substrate). It
 * MUST be generated at build time, not hand-curated, or it drifts.
 *
 * Marker:  the block lives between the HTML comments:
 *   <!-- @caistech-block:start -->
 *   <!-- @caistech-block:end -->
 *
 * Re-runnable. Idempotent. Safe to call from `npm run build`.
 *
 * Usage:
 *   node scripts/gen-readme-deps.mjs        # rewrite README in place
 *   node scripts/gen-readme-deps.mjs --check  # exit 1 if README is stale
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const PKG_PATH = join(repoRoot, 'package.json');
const README_PATH = join(repoRoot, 'README.md');
const START = '<!-- @caistech-block:start -->';
const END = '<!-- @caistech-block:end -->';

// One-line description per known @caistech/* package. Keep brief —
// the README block is a pointer, not documentation.
const KNOWN = {
  'elevenlabs-convai':
    'ElevenLabs Conversational AI — agent CRUD, webhooks, persistent memory. Used by the operator voice-capture FAB.',
  'ai-client': 'Anthropic SDK wrapper with OpenRouter routing helper.',
  'openrouter-client': 'OpenRouter LLM client with retry + streaming.',
  'security-gate': 'CaMeL pipeline, prompt-injection guardrails, red-team probes.',
  'platform-trust-middleware': 'Rate limiting, audit logging, withTrust wrapper.',
  'agent-trust-score': 'Agent scanner + badge (security/correctness/observability).',
  agents: 'AI agent provisioning, prompt templates, secure gateway.',
  security: 'AI-agent permissions, PII classification, audit, consent, retention.',
  'api-key-auth': 'B2B opaque API keys, monthly quota, Stripe billing webhook.',
  'sanctions-screen': 'OFAC / UN / AU DFAT / UK / EU sanctions screening with fuzzy match.',
  'language-config': '80+ language definitions with TTS provider mapping.',
  'stt-noise-filter': 'Ambient-noise filter for STT output.',
  'elevenlabs-voice': 'ElevenLabs TTS/STT one-shot.',
  'abn-lookup': 'Australian Business Number validation + ABR lookup.',
  'business-registry': 'Multi-country business registry (AU/CN/VN/MY).',
  'cert-extractor': 'OCR + structured extraction for ISO 9001 / business licences.',
  extractors: 'LLM extractors for business profile from websites + social.',
  'ghl-client': 'Go High Level CRM client (contacts, opportunities, workflows).',
  'hunter-email': 'Hunter.io email-finder / domain-search / verifier.',
  'unipile-channels': 'LinkedIn + Gmail/Outlook send + hosted OAuth.',
  'brave-search': 'Brave Search API for prospect discovery + research.',
  mapbox: 'Mapbox Geocoding v5 (AU-biased) + satellite static maps.',
  'property-services-sdk': 'Property-services edge functions (derive, assess, onboard).',
  'coordination-sdk': 'Cross-project issue / coordination tracker.',
  'nudge-core': 'Evaluator registry, frequency caps, email builder, cron handler.',
  'report-generator': 'Markdown → branded PDF (disclaimer / watermark / page numbers).',
  'corporate-components': 'React header/footer, ABN lookup, address autocomplete.',
  'portfolio-env-sync': 'Manifest-driven Vercel env audit + apply.',
  'db-schema': 'Shared Supabase migrations (multi-tenancy, agents, audit, consent).',
  'site-intelligence': 'Site intelligence (placeholder, not yet published).',
};

function describe(name) {
  return KNOWN[name] ?? '(no description registered in scripts/gen-readme-deps.mjs)';
}

async function readPackage() {
  const raw = await readFile(PKG_PATH, 'utf-8');
  return JSON.parse(raw);
}

function consumedCaistechPackages(pkg) {
  const merged = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  return Object.entries(merged)
    .filter(([name]) => name.startsWith('@caistech/'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, version]) => ({
      shortName: name.replace('@caistech/', ''),
      fullName: name,
      version,
    }));
}

function renderBlock(packages) {
  if (packages.length === 0) {
    return `${START}\n_No \`@caistech/*\` packages consumed yet._\n${END}`;
  }
  const lines = packages.map(
    (p) => `- **\`${p.fullName}\`** \`${p.version}\` — ${describe(p.shortName)}`
  );
  return `${START}\n${lines.join('\n')}\n${END}`;
}

async function rewriteReadme(block, check) {
  const text = await readFile(README_PATH, 'utf-8');
  if (!text.includes(START) || !text.includes(END)) {
    console.error(
      `ERROR: README.md is missing the markers ${START} and ${END}. ` +
        'Add an empty block at the @caistech consumption section before running this script.'
    );
    process.exit(2);
  }
  const before = text.slice(0, text.indexOf(START));
  const after = text.slice(text.indexOf(END) + END.length);
  const next = `${before}${block}${after}`;

  if (text === next) {
    console.log('README @caistech block is up to date.');
    return;
  }

  if (check) {
    console.error('ERROR: README @caistech block is stale. Re-run without --check to fix.');
    process.exit(1);
  }
  await writeFile(README_PATH, next, 'utf-8');
  console.log('README @caistech block updated.');
}

async function main() {
  const check = process.argv.includes('--check');
  const pkg = await readPackage();
  const packages = consumedCaistechPackages(pkg);
  const block = renderBlock(packages);
  await rewriteReadme(block, check);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
