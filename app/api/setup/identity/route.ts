import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/setup/identity
 *
 * Writes operator identity + deployment mode + telemetry preference into
 * the singleton system_config row. Used by the first-run /setup wizard
 * and re-usable for operator-profile edits later.
 */
export async function POST(request: NextRequest) {
  const { db, error } = await authenticateAndGetDb(request);
  if (error || !db) {
    return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const {
    operator_name,
    operator_url,
    operator_signature,
    bot_display_name,
    deployment_mode,
    telemetry_opt_out,
  } = body as {
    operator_name?: string;
    operator_url?: string;
    operator_signature?: string;
    bot_display_name?: string;
    deployment_mode?: 'customer-self-serve' | 'vendor-self-deploy';
    telemetry_opt_out?: boolean;
  };

  if (!operator_name || !operator_url || !operator_signature) {
    return NextResponse.json(
      { error: 'operator_name, operator_url, and operator_signature are required' },
      { status: 400 }
    );
  }

  if (
    deployment_mode &&
    !['customer-self-serve', 'vendor-self-deploy'].includes(deployment_mode)
  ) {
    return NextResponse.json(
      { error: `invalid deployment_mode: ${deployment_mode}` },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {
    operator_name,
    operator_url,
    operator_signature,
  };
  if (bot_display_name) update.bot_display_name = bot_display_name;
  if (deployment_mode) update.deployment_mode = deployment_mode;
  if (typeof telemetry_opt_out === 'boolean') {
    update.telemetry_opt_out = telemetry_opt_out;
  }

  const { error: updateErr } = await db
    .from('system_config')
    .update(update)
    .eq('id', 1);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
