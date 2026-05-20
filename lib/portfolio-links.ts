/**
 * Portfolio links — single source of truth for CQR's outbound references to
 * the wider BYOK Factory portfolio. Per CQR_RELEASE_REQUIREMENTS.md Task 4b.
 *
 * Concrete consumers:
 *   - README footer "From BYOK Factory" block
 *   - Dashboard chrome footer / brand strip
 *   - Voice agent default greeting
 *   - Install-telemetry POST endpoint
 *
 * Grep gate: every CQR-side outbound link reads from this file. There should
 * be zero hardcoded `corporate-ai-solutions.vercel.app/...` strings elsewhere
 * (except the README's auto-generated block, which is regenerated from here).
 */
export const PORTFOLIO_LINKS = {
  /** Marketplace tile for CQR — where new operators arrive from. */
  marketplace: 'https://corporate-ai-solutions.vercel.app/marketplace/cqr',

  /** BYOK Factory doctrine. Falls back to /engagement until the gist is live. */
  doctrineGist: 'https://corporate-ai-solutions.vercel.app/engagement',

  /** Studio-in-residence engagement page. */
  engagement: 'https://corporate-ai-solutions.vercel.app/engagement',

  /** Install-telemetry endpoint (Rule 10 carve-out — opt-out via BYOK_TELEMETRY=off). */
  telemetryEndpoint: 'https://corporate-ai-solutions.vercel.app/api/byok-telemetry/install',

  /** Factory Floor essay #1 — null until published. */
  factoryFloorEssay: null as string | null,

  /** Portfolio root for catch-all linking. */
  portfolioRoot: 'https://corporate-ai-solutions.vercel.app',
} as const;

export type PortfolioLink = keyof typeof PORTFOLIO_LINKS;
