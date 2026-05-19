/**
 * Markdown-aware chunker. Splits on heading boundaries first, then on
 * paragraph boundaries when a section is too large.
 *
 * Token-approximation: 1 token ≈ 4 chars. Target chunk size ~600 tokens
 * (~2400 chars), max ~800 tokens (~3200 chars), small chunks merged.
 */
const TARGET_CHARS = 2400;
const MAX_CHARS = 3200;
const MIN_CHARS = 400;

export interface Chunk {
  content: string;
  index: number;
  token_count: number;
}

export function chunkMarkdown(raw: string): Chunk[] {
  const sections = splitOnHeadings(raw);

  const out: string[] = [];
  for (const sec of sections) {
    if (sec.length <= MAX_CHARS) {
      out.push(sec);
    } else {
      out.push(...splitParagraphs(sec, TARGET_CHARS, MAX_CHARS));
    }
  }

  // Merge small adjacent chunks
  const merged: string[] = [];
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

function splitOnHeadings(raw: string): string[] {
  // Split on H1/H2/H3 boundaries while keeping the heading with its body
  const lines = raw.split('\n');
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (current.length) sections.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length) sections.push(current.join('\n'));
  return sections.filter((s) => s.trim().length > 0);
}

function splitParagraphs(text: string, target: number, max: number): string[] {
  const paras = text.split(/\n\s*\n/);
  const out: string[] = [];
  let buf = '';
  for (const p of paras) {
    if (buf.length === 0) {
      buf = p;
    } else if (buf.length + p.length + 2 < target) {
      buf += '\n\n' + p;
    } else if (buf.length + p.length + 2 < max) {
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
