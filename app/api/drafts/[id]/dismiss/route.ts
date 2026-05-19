import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, db, error } = await authenticateAndGetDb(request);
  if (error || !db || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const reason: string | undefined = body.reason;

  const { error: updateErr } = await db
    .from('slack_drafts')
    .update({ status: 'dismissed', reviewed_by: user.id })
    .eq('id', id);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await db.from('audit_log').insert({
    draft_id: id,
    actor_id: user.id,
    action: 'dismissed',
    payload: { reason: reason ?? null },
  });

  return NextResponse.json({ ok: true });
}
