#!/usr/bin/env node
/**
 * Seed a KB namespace from local source files + inline reference replies.
 *
 * Usage:
 *   node scripts/seed-kb.mjs <namespace>
 *   node scripts/seed-kb.mjs unipile
 *   node scripts/seed-kb.mjs supabase
 *
 * No arg = unipile (back-compat with the first seed run).
 *
 * Sources for each namespace live in scripts/kb-sources/<namespace>.mjs as
 * { fileSources: [{path, kind, title}], inlineReplies: [{source_path, title, content}] }.
 *
 * Idempotent — re-running replaces all chunks for the same (namespace, source_path).
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
async function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env.local');
  const raw = await fs.readFile(envPath, 'utf-8');
  const out = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Markdown-aware chunker (port of lib/kb/chunker.ts)
// ---------------------------------------------------------------------------
const TARGET_CHARS = 2400;
const MAX_CHARS = 3200;
const MIN_CHARS = 400;

function splitOnHeadings(raw) {
  const lines = raw.split('\n');
  const sections = [];
  let cur = [];
  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (cur.length) sections.push(cur.join('\n'));
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) sections.push(cur.join('\n'));
  return sections.filter((s) => s.trim().length > 0);
}

function splitParagraphs(text, target, max) {
  const paras = text.split(/\n\s*\n/);
  const out = [];
  let buf = '';
  for (const p of paras) {
    if (buf.length === 0) buf = p;
    else if (buf.length + p.length + 2 < target) buf += '\n\n' + p;
    else if (buf.length + p.length + 2 < max) {
      buf += '\n\n' + p;
      out.push(buf);
      buf = '';
    } else {
      out.push(buf);
      buf = p;
    }
  }
  if (buf.length) out.push(buf);
  return out;
}

function chunkMarkdown(raw) {
  const sections = splitOnHeadings(raw);
  const out = [];
  for (const sec of sections) {
    if (sec.length <= MAX_CHARS) out.push(sec);
    else out.push(...splitParagraphs(sec, TARGET_CHARS, MAX_CHARS));
  }
  const merged = [];
  for (const c of out) {
    const last = merged[merged.length - 1];
    if (last && last.length + c.length + 2 < TARGET_CHARS) {
      merged[merged.length - 1] = last + '\n\n' + c;
    } else {
      merged.push(c);
    }
  }
  return merged
    .filter((c) => c.trim().length >= MIN_CHARS || merged.length === 1)
    .map((content, index) => ({
      content: content.trim(),
      index,
      token_count: Math.ceil(content.length / 4),
    }));
}

async function ingest(db, openai, input) {
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
  if (docErr || !doc) throw new Error(`upsert kb_documents failed: ${docErr?.message}`);

  await db.from('kb_chunks').delete().eq('document_id', doc.id);

  const chunks = chunkMarkdown(input.content);
  if (chunks.length === 0) return { document_id: doc.id, chunks: 0 };

  const embResp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks.map((c) => c.content.slice(0, 8000)),
  });
  const embeddings = embResp.data.map((d) => d.embedding);

  const rows = chunks.map((c, i) => ({
    document_id: doc.id,
    namespace: input.namespace,
    chunk_index: c.index,
    content: c.content,
    embedding: embeddings[i],
    token_count: c.token_count,
  }));

  const { error: chunkErr } = await db.from('kb_chunks').insert(rows);
  if (chunkErr) throw new Error(`insert kb_chunks failed: ${chunkErr.message}`);
  return { document_id: doc.id, chunks: chunks.length };
}

// ---------------------------------------------------------------------------
async function main() {
  const namespace = process.argv[2] || 'unipile';
  const sourcesPath = path.join(__dirname, 'kb-sources', `${namespace}.mjs`);

  let sources;
  try {
    sources = (await import('file://' + sourcesPath.replace(/\\/g, '/'))).default;
  } catch (e) {
    console.error(`Could not load sources for namespace '${namespace}': ${e.message}`);
    console.error(`Expected file: scripts/kb-sources/${namespace}.mjs`);
    process.exit(1);
  }

  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const oaiKey = env.OPENAI_API_KEY;
  if (!url || !key) throw new Error('Missing Supabase env in .env.local');
  if (!oaiKey) throw new Error('Missing OPENAI_API_KEY in .env.local');

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const openai = new OpenAI({ apiKey: oaiKey });

  let totalChunks = 0;
  let totalDocs = 0;

  console.log(`Seeding KB namespace: ${namespace}\n`);

  for (const f of sources.fileSources ?? []) {
    try {
      const content = await fs.readFile(f.absolutePath, 'utf-8');
      const r = await ingest(db, openai, {
        namespace,
        source_path: f.source_path,
        source_kind: f.source_kind,
        title: f.title,
        content,
      });
      console.log(`  ✓ ${f.source_path} (${r.chunks} chunks)`);
      totalChunks += r.chunks;
      totalDocs++;
    } catch (e) {
      console.warn(`  ⚠ skipped ${f.source_path}: ${e.message}`);
    }
  }

  for (const reply of sources.inlineReplies ?? []) {
    try {
      const r = await ingest(db, openai, {
        namespace,
        source_path: reply.source_path,
        source_kind: 'reply_example',
        title: reply.title,
        content: reply.content,
      });
      console.log(`  ✓ ${reply.source_path} (${r.chunks} chunks)`);
      totalChunks += r.chunks;
      totalDocs++;
    } catch (e) {
      console.warn(`  ⚠ skipped ${reply.source_path}: ${e.message}`);
    }
  }

  console.log(`\nDone. ${totalDocs} documents, ${totalChunks} chunks embedded into '${namespace}'.`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
