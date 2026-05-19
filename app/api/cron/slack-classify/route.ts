import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { verifyCronSecret } from '@/lib/supabase/auth';
import { classify } from '@/lib/ai/classifier';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BATCH = 20;

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = createServiceClient();

  const { data: rows, error } = await db
    .from('slack_drafts')
    .select('id, question_text')
    .eq('status', 'pending_classification')
    .order('created_at', { ascending: true })
    .limit(BATCH);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!rows?.length) return NextResponse.json({ classified: 0 });

  let worth = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      const result = await classify(row.question_text);
      const nextStatus =
        result.classification === 'worth_answering' ? 'pending_draft' : 'classified_skip';
      await db
        .from('slack_drafts')
        .update({
          classification: result.classification,
          classifier_reason: result.reason,
          status: nextStatus,
          classified_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (nextStatus === 'pending_draft') worth++;
      else skipped++;
    } catch (e) {
      console.error('classify error on', row.id, e);
    }
  }

  return NextResponse.json({ classified: rows.length, worth, skipped });
}
