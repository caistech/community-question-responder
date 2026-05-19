import type { SupabaseClient } from '@supabase/supabase-js';
import { chunkMarkdown } from './chunker';
import { embedBatch } from './embedder';

export interface IngestInput {
  namespace: string;
  source_path: string;
  source_kind: 'doc' | 'code' | 'reply_example';
  title?: string;
  content: string;
}

export interface IngestResult {
  document_id: string;
  chunks: number;
}

/**
 * Ingest one document: upsert the document row, chunk the content,
 * embed each chunk, and insert chunks. Idempotent — re-ingesting the
 * same (namespace, source_path) replaces all existing chunks.
 */
export async function ingestDocument(
  db: SupabaseClient,
  input: IngestInput
): Promise<IngestResult> {
  // Upsert the document
  const { data: doc, error: docErr } = await db
    .from('kb_documents')
    .upsert(
      {
        namespace: input.namespace,
        source_path: input.source_path,
        source_kind: input.source_kind,
        title: input.title ?? null,
        raw_content: input.content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'namespace,source_path' }
    )
    .select('id')
    .single();

  if (docErr || !doc) {
    throw new Error(`upsert kb_documents failed: ${docErr?.message}`);
  }

  // Wipe existing chunks for this document (idempotent re-ingest)
  await db.from('kb_chunks').delete().eq('document_id', doc.id);

  // Chunk + embed
  const chunks = chunkMarkdown(input.content);
  if (chunks.length === 0) return { document_id: doc.id, chunks: 0 };

  const embeddings = await embedBatch(chunks.map((c) => c.content));

  const rows = chunks.map((c, i) => ({
    document_id: doc.id,
    namespace: input.namespace,
    chunk_index: c.index,
    content: c.content,
    embedding: embeddings[i] as unknown as string, // Supabase JSON serialises arrays
    token_count: c.token_count,
  }));

  const { error: chunkErr } = await db.from('kb_chunks').insert(rows);
  if (chunkErr) throw new Error(`insert kb_chunks failed: ${chunkErr.message}`);

  return { document_id: doc.id, chunks: chunks.length };
}
