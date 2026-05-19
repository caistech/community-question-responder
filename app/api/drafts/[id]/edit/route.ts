import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { user, db, error } = await authenticateAndGetDb(request);
  if (error || !db || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const text: string | undefined = body.text;
  if (!text || !text.trim()) return NextResponse.json({ error: 'Empty text' }, { status: 400 });

  const { error: updateErr } = await db
    .from('slack_drafts')
    .update({ draft_text: text.trim() })
    .eq('id', id)
    .in('status', ['pending_review', 'post_failed']);

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await db.from('audit_log').insert({
    draft_id: id,
    actor_id: user.id,
    action: 'edited',
    payload: { length: text.length },
  });

  return NextResponse.json({ ok: true });
}
