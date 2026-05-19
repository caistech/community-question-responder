import type { SupabaseClient } from '@supabase/supabase-js';
import { embed } from './embedder';

export interface KbHit {
  chunk_id: string;
  document_id: string;
  source_path: string;
  content: string;
  similarity: number;
}

export interface RetrieveOptions {
  topK?: number;
  threshold?: number;
}

/**
 * Retrieve top-K matching chunks for a query against a KB namespace.
 * Calls the `match_documents()` SQL function defined in migration 0001.
 */
export async function retrieveKb(
  db: SupabaseClient,
  namespace: string,
  query: string,
  opts: RetrieveOptions = {}
): Promise<KbHit[]> {
  const topK = opts.topK ?? 6;
  const threshold = opts.threshold ?? 0.7;

  const embedding = await embed(query);

  const { data, error } = await db.rpc('match_documents', {
    query_embedding: embedding,
    match_namespace: namespace,
    match_threshold: threshold,
    match_count: topK,
  });

  if (error) {
    console.error('retrieveKb error', error);
    return [];
  }
  return (data as KbHit[]) ?? [];
}
