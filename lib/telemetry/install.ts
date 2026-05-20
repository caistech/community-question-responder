import { createHmac } from 'node:crypto';
import { createServiceClient } from '@/lib/supabase/service';
import { PORTFOLIO_LINKS } from '@/lib/portfolio-links';
import packageJson from '../../package.json';

/**
 * Install-time telemetry per CQR_RELEASE_REQUIREMENTS.md Task 8 (Rule 10
 * carve-out). One POST per install, fired when the first-run /setup wizard
 * marks system_config.setup_complete = true. Lets BYOK Factory see which
 * tools are deployed where, in aggregate — no PII.
 *
 * Opt-out: BYOK_TELEMETRY=off (env) OR system_config.telemetry_opt_out=true.
 *
 * Failure is non-blocking — if the telemetry endpoint is unreachable
 * (vendor offline, network blocked), setup still completes.
 *
 * The signing key is a build-identity marker, not an auth secret. It
 * proves "this came from a CQR build" not "this came from THE legitimate
 * operator." That's the right shape for an open-source BYOK distribution.
 */

const BUILD_SIGNATURE_KEY =
  'cqr-byok-factory-2026-public-build-identity-v1-non-secret';

const TELEMETRY_HEADER = 'x-cqr-build-signature';

interface InstallPingPayload {
  tool: 'cqr';
  version: string;
  install_id: string;
  timestamp: string;
}

export async function sendInstallPing(): Promise<{
  sent: boolean;
  skipped?: 'env-opt-out' | 'db-opt-out' | 'no-install-id' | 'unreachable';
}> {
  // Opt-out 1: env var (deploy-time)
  if (process.env.BYOK_TELEMETRY === 'off') {
    return { sent: false, skipped: 'env-opt-out' };
  }

  const db = createServiceClient();
  const { data, error } = await db
    .from('system_config')
    .select('install_id, telemetry_opt_out')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) {
    return { sent: false, skipped: 'no-install-id' };
  }

  // Opt-out 2: DB flag (runtime, operator-configurable in /setup)
  if (data.telemetry_opt_out) {
    return { sent: false, skipped: 'db-opt-out' };
  }

  const payload: InstallPingPayload = {
    tool: 'cqr',
    version: packageJson.version,
    install_id: data.install_id as string,
    timestamp: new Date().toISOString(),
  };

  const signature = createHmac('sha256', BUILD_SIGNATURE_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');

  try {
    await fetch(PORTFOLIO_LINKS.telemetryEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [TELEMETRY_HEADER]: signature,
      },
      body: JSON.stringify(payload),
      // Don't block the setup flow on a slow vendor endpoint.
      signal: AbortSignal.timeout(5000),
    });
    return { sent: true };
  } catch {
    return { sent: false, skipped: 'unreachable' };
  }
}
