import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';
import { sendInstallPing } from '@/lib/telemetry/install';

export const dynamic = 'force-dynamic';

/**
 * POST /api/setup/complete
 *
 * Final step of the first-run /setup wizard. Validates that the required
 * setup prerequisites are present (operator identity + ElevenLabs agent),
 * then flips system_config.setup_complete = true and fires the one-time
 * install-telemetry ping (Rule 10 carve-out — disclosed, opt-out).
 *
 * Slack/Discord workspace connections are intentionally NOT required —
 * the operator can complete setup with zero workspaces connected and add
 * them later from the dashboard.
 */
export async function POST(request: NextRequest) {
  const { db, error } = await authenticateAndGetDb(request);
  if (error || !db) {
    return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });
  }

  // Prereq check
  const { data, error: readErr } = await db
    .from('system_config')
    .select(
      'setup_complete, agent_id, operator_name, operator_url, operator_signature'
    )
    .eq('id', 1)
    .maybeSingle();

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json(
      { error: 'system_config singleton row not found — run migrations' },
      { status: 500 }
    );
  }
  if (data.setup_complete) {
    return NextResponse.json({ ok: true, already_complete: true });
  }
  if (!data.agent_id) {
    return NextResponse.json(
      { error: 'ElevenLabs agent has not been created yet' },
      { status: 400 }
    );
  }
  if (!data.operator_name || !data.operator_url || !data.operator_signature) {
    return NextResponse.json(
      { error: 'Operator identity has not been saved yet' },
      { status: 400 }
    );
  }

  // Flip the flag
  const { error: updateErr } = await db
    .from('system_config')
    .update({ setup_complete: true })
    .eq('id', 1);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  // Fire-and-forget install telemetry. Non-blocking — operator's setup
  // completes regardless of telemetry endpoint reachability.
  const telemetry = await sendInstallPing();

  return NextResponse.json({ ok: true, telemetry });
}
