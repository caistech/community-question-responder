import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';
import { ingestDocument } from '@/lib/kb/ingest';
import { draftAnnounce } from '@/lib/ai/announce-drafter';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface Body {
  content: string;
  title?: string;
  namespace: string;
  channel_id?: string; // slack_channels.id — required if also queueing an announce
  announce?: boolean;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60);
}

export async function POST(request: NextRequest) {
  const { user, db, error } = await authenticateAndGetDb(request);
  if (error || !db || !user)
    return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Partial<Body>;
  const content = body.content?.trim();
  const namespace = body.namespace?.trim();
  if (!content || content.length < 30) {
    return NextResponse.json({ error: 'content must be at least 30 characters' }, { status: 400 });
  }
  if (!namespace) {
    return NextResponse.json({ error: 'namespace is required' }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const slug = slugify(body.title || content.slice(0, 60));
  const sourcePath = `learnings/${today}-${slug}.md`;
  const title = body.title?.trim() || content.slice(0, 80) + (content.length > 80 ? '…' : '');

  // 1. Ingest into KB
  let kbResult;
  try {
    kbResult = await ingestDocument(db, {
      namespace,
      source_path: sourcePath,
      source_kind: 'learning',
      title,
      content,
    });
  } catch (e) {
    return NextResponse.json(
      { error: `KB ingest failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  // 2. Optionally draft an announce post for review
  let announceDraftId: string | null = null;
  if (body.announce) {
    if (!body.channel_id) {
      return NextResponse.json(
        { error: 'channel_id required when announce=true' },
        { status: 400 }
      );
    }

    // Confirm the channel exists and use its namespace as the retrieval namespace
    const { data: channel } = await db
      .from('slack_channels')
      .select('id, kb_namespace')
      .eq('id', body.channel_id)
      .single();
    if (!channel) {
      return NextResponse.json({ error: 'channel not found' }, { status: 404 });
    }

    const draft = await draftAnnounce(db, channel.kb_namespace, content, title);

    const { data: row, error: insertErr } = await db
      .from('slack_drafts')
      .insert({
        channel_id: channel.id,
        slack_msg_ts: null,
        kind: 'announce',
        asker_name: null,
        question_text: content,
        classification: 'announce',
        classifier_reason: 'Operator-captured learning, queued for community announce',
        draft_text: draft.draft_text,
        confidence_score: draft.confidence_score,
        cite_files: draft.cite_files,
        status: 'pending_review',
        drafted_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertErr) {
      return NextResponse.json(
        { ok: true, kb: kbResult, announce_error: insertErr.message },
        { status: 200 }
      );
    }
    announceDraftId = row?.id ?? null;
  }

  return NextResponse.json({
    ok: true,
    kb: kbResult,
    source_path: sourcePath,
    announce_draft_id: announceDraftId,
  });
}
