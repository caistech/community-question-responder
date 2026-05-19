import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';
import { ingestDocument } from '@/lib/kb/ingest';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const { user, db, error } = await authenticateAndGetDb(request);
  if (error || !db || !user) return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { namespace, source_path, source_kind, title, content } = body;

  if (!namespace || !source_path || !source_kind || !content) {
    return NextResponse.json(
      { error: 'namespace, source_path, source_kind, content are required' },
      { status: 400 }
    );
  }
  if (!['doc', 'code', 'reply_example'].includes(source_kind)) {
    return NextResponse.json({ error: 'invalid source_kind' }, { status: 400 });
  }

  try {
    const result = await ingestDocument(db, { namespace, source_path, source_kind, title, content });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
