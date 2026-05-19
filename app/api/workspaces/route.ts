import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';
import { slackClientFor } from '@/lib/slack/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, db, error } = await authenticateAndGetDb(request);
  if (error || !db || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body.token;
  if (!token || !token.startsWith('xoxp-')) {
    return NextResponse.json({ error: 'Token must be a user OAuth token (xoxp-…)' }, { status: 400 });
  }

  // Validate via auth.test
  let info: { team_id?: string; team?: string; user_id?: string; user?: string };
  try {
    info = (await slackClientFor(token).auth.test()) as typeof info;
  } catch (e) {
    return NextResponse.json({ error: `Slack rejected token: ${(e as Error).message}` }, { status: 400 });
  }

  if (!info.team_id) {
    return NextResponse.json({ error: 'auth.test missing team_id' }, { status: 400 });
  }

  const { error: upsertErr } = await db
    .from('slack_workspaces')
    .upsert(
      {
        workspace_id: info.team_id,
        workspace_name: info.team ?? null,
        encrypted_token: token,
        scopes: ['channels:history', 'channels:read', 'chat:write', 'users:read'],
        installed_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'workspace_id' }
    );

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    workspace_id: info.team_id,
    workspace_name: info.team,
    user_id: info.user_id,
    user_name: info.user,
  });
}
