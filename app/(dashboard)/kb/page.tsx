import { createServiceClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

interface DocRow {
  id: string;
  namespace: string;
  source_path: string;
  source_kind: string;
  title: string | null;
  updated_at: string;
}

interface ChunkCount {
  document_id: string;
  count: number;
}

export default async function KbPage() {
  const db = createServiceClient();

  const { data: docs } = await db
    .from('kb_documents')
    .select('id, namespace, source_path, source_kind, title, updated_at')
    .order('namespace')
    .order('source_path');

  const { data: chunks } = await db
    .from('kb_chunks')
    .select('document_id');

  const chunkMap = new Map<string, number>();
  for (const c of chunks ?? []) {
    chunkMap.set(c.document_id, (chunkMap.get(c.document_id) ?? 0) + 1);
  }

  const rows = (docs ?? []) as DocRow[];

  const byNamespace = new Map<string, DocRow[]>();
  for (const d of rows) {
    if (!byNamespace.has(d.namespace)) byNamespace.set(d.namespace, []);
    byNamespace.get(d.namespace)!.push(d);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">Knowledge base</div>
      <h1 className="mb-2 text-3xl font-bold">Ingested documents</h1>
      <p className="mb-8 max-w-2xl text-sm text-gray-400">
        Source documents the drafter retrieves from when building a reply. Each
        document is chunked and embedded with OpenAI <code className="text-xs">text-embedding-3-small</code>.
        Re-ingesting a path replaces the chunks atomically.
      </p>

      {byNamespace.size === 0 ? (
        <div className="rounded-2xl border border-gray-800 bg-gray-900/30 p-10 text-center text-gray-400">
          No documents ingested yet. POST to{' '}
          <code className="text-xs text-emerald-400">/api/kb/ingest</code> to seed
          a namespace.
        </div>
      ) : (
        <div className="space-y-8">
          {Array.from(byNamespace.entries()).map(([ns, items]) => (
            <div key={ns}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 className="text-lg font-semibold">{ns}</h2>
                <span className="text-xs text-gray-500">
                  {items.length} document{items.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="overflow-hidden rounded-2xl border border-gray-800">
                <table className="w-full text-sm">
                  <thead className="bg-gray-900/60 text-left text-xs uppercase tracking-wide text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Path</th>
                      <th className="px-4 py-3">Kind</th>
                      <th className="px-4 py-3">Chunks</th>
                      <th className="px-4 py-3">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {items.map((d) => (
                      <tr key={d.id} className="text-gray-300">
                        <td className="px-4 py-3 font-mono text-xs">{d.source_path}</td>
                        <td className="px-4 py-3 text-gray-400">{d.source_kind}</td>
                        <td className="px-4 py-3 text-gray-400">{chunkMap.get(d.id) ?? 0}</td>
                        <td className="px-4 py-3 text-gray-500">
                          {new Date(d.updated_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
