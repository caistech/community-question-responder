import { anthropic, MODEL_DRAFTER } from './anthropic';
import { loadVoiceRules } from './voice';
import { retrieveKb, type KbHit } from '../kb/retrieve';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface DraftResult {
  draft_text: string;
  confidence_score: number;
  cite_files: string[];
  hits_count: number;
}

const BASE_SYSTEM = `You are drafting a reply to a question in a developer-community Slack channel.

You are writing AS the operator (a senior technical practitioner), not as a generic helper. The operator has real production experience with the vendor's API and has shipped this code; you must reflect that voice.

Output rules:
- Return ONLY the body of the Slack message. No JSON wrapping, no preamble, no "here is the reply" framing.
- The signature line at the end is required and must appear verbatim — already included in the voice rules below.
- Use plain Slack markdown: *bold*, _italic_, \`inline code\`, triple-backtick code blocks. No emoji unless the source content used them.

If the supplied KB context is thin or the question is outside the KB's scope, reply briefly and honestly — never manufacture pseudo-specifics. Prefer 80 words of true to 400 words of plausible.`;

export async function draftReply(
  db: SupabaseClient,
  namespace: string,
  questionText: string,
  askerName: string | null
): Promise<DraftResult> {
  const { data: cfg } = await db
    .from('system_config')
    .select('operator_signature')
    .eq('id', 1)
    .maybeSingle();
  const operatorSignature = (cfg?.operator_signature as string | null) ?? '';
  const voice = await loadVoiceRules(operatorSignature);
  const hits = await retrieveKb(db, namespace, questionText, { topK: 6, threshold: 0.7 });

  const kbBlock = hits.length
    ? hits
        .map(
          (h: KbHit, i: number) =>
            `--- KB chunk ${i + 1} (similarity ${h.similarity.toFixed(2)}) — source: ${h.source_path} ---\n${h.content}`
        )
        .join('\n\n')
    : '(no KB matches above the threshold)';

  const askerLabel = askerName || 'there';

  const userPrompt = `Question from ${askerLabel} in the community channel:

"""
${questionText.slice(0, 4000)}
"""

KB context retrieved for this question:

${kbBlock}

Draft your reply now. Address the asker by first name ("Hey ${askerLabel.split(' ')[0]} — "). Follow every rule in the voice guide above.`;

  const msg = await anthropic().messages.create({
    model: MODEL_DRAFTER,
    max_tokens: 1500,
    system: `${BASE_SYSTEM}\n\n---\nVOICE RULES (load-bearing):\n${voice}`,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const draftText =
    msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n')
      .trim() || '';

  const confidence = hits.length === 0 ? 0.4 : Math.min(0.95, 0.55 + hits.length * 0.07);

  return {
    draft_text: draftText,
    confidence_score: confidence,
    cite_files: hits.map((h) => h.source_path),
    hits_count: hits.length,
  };
}
