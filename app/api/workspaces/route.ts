import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';
import { getProvider } from '@/lib/providers';
import type { ProviderName } from '@/lib/providers';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const { user, db, error } = await authenticateAndGetDb(request);
  if (error || !db || !user)
    return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const token: string | undefined = body.token;
  const signingSecret: string | undefined = body.signing_secret;
  const providerName: ProviderName = (body.provider as ProviderName) ?? 'slack';

  if (!token) return NextResponse.json({ error: 'token is required' }, { status: 400 });
  if (!['slack', 'discord'].includes(providerName)) {
    return NextResponse.json({ error: `invalid provider: ${providerName}` }, { status: 400 });
  }

  let validation;
  try {
    const provider = getProvider(providerName);
    validation = await provider.validateToken(token);
  } catch (e) {
    return NextResponse.json(
      { error: `${providerName} rejected token: ${(e as Error).message}` },
      { status: 400 }
    );
  }

  const scopes =
    providerName === 'slack'
      ? ['channels:history', 'channels:read', 'chat:write', 'users:read']
      : ['bot', 'messages.read', 'send_messages'];

  const tokenType: 'xoxb' | 'discord-bot' =
    providerName === 'slack' ? 'xoxb' : 'discord-bot';

  const { error: upsertErr } = await db
    .from('slack_workspaces')
    .upsert(
      {
        provider: providerName,
        workspace_id: validation.workspace_id,
        workspace_name: validation.workspace_name,
        encrypted_token: token,
        token_type: tokenType,
        signing_secret: providerName === 'slack' ? (signingSecret ?? null) : null,
        scopes,
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
    provider: providerName,
    workspace_id: validation.workspace_id,
    workspace_name: validation.workspace_name,
    user_id: validation.user_id,
    user_name: validation.user_name,
  });
}
