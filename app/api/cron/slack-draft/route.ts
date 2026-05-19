import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyCronSecret } from '@/lib/supabase/auth';
import { draftReply } from '@/lib/ai/drafter';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const BATCH = 6;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();

  const { data: rows, error } = await db
    .from('slack_drafts')
    .select(
      `id, question_text, asker_name, channel_id,
       slack_channels!inner(kb_namespace)`
    )
    .eq('status', 'pending_draft')
    .order('created_at', { ascending: true })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ drafted: 0 });

  let ok = 0;
  let failed = 0;

  for (const row of rows) {
    const namespace =
      // @ts-expect-error joined relation shape varies on supabase-js
      row.slack_channels?.kb_namespace ?? 'default';
    try {
      const result = await draftReply(db, namespace, row.question_text, row.asker_name);
      await db
        .from('slack_drafts')
        .update({
          draft_text: result.draft_text,
          confidence_score: result.confidence_score,
          cite_files: result.cite_files,
          status: 'pending_review',
          drafted_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      ok++;
    } catch (e) {
      console.error('draft error on', row.id, e);
      failed++;
    }
  }

  return NextResponse.json({ drafted: rows.length, ok, failed });
}
