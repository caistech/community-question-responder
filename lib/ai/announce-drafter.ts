import { anthropic, MODEL_DRAFTER } from './anthropic';
import { loadVoiceRules } from './voice';
import { retrieveKb, type KbHit } from '../kb/retrieve';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AnnounceDraftResult {
  draft_text: string;
  confidence_score: number;
  cite_files: string[];
}

const BASE_SYSTEM = `You are drafting an outbound announcement to a developer-community Slack channel.

This is NOT a reply to someone's question. It is a proactive, top-level post sharing something the operator learned while building on the vendor's API. The operator's purpose: contribute substantively to the community so they earn the reputation of being a thoughtful technical voice — which, over time, converts to inbound work.

Output rules:
- Return ONLY the body of the Slack message. No JSON wrapping, no preamble.
- Start with a one-sentence framing of WHAT the learning is, not WHO the operator is. No "Hi everyone — " or "Just sharing — " openers; start with the technical observation.
- Body: structure as Observation → Implication → Workaround. Keep it under ~250 words for an announce post (community attention spans are shorter for unsolicited posts than for replies).
- Use plain Slack markdown: *bold*, _italic_, \`inline code\`, triple-backtick code blocks.
- The signature line at the end is required, verbatim — already in the voice rules.

Tone: same voice as the reply drafter — opinionated practitioner, concrete numbers, push back on conventional wisdom where you have evidence. The announce voice should feel of-a-piece with the reply voice; same person, just initiating instead of responding.

If the KB context for this topic is thin, prefer fewer words over manufactured specifics. Better to share a precise observation than a padded essay.`;

export async function draftAnnounce(
  db: SupabaseClient,
  namespace: string,
  rawLearning: string,
  title: string | null
): Promise<AnnounceDraftResult> {
  const voice = await loadVoiceRules();
  const hits = await retrieveKb(db, namespace, rawLearning, { topK: 5, threshold: 0.65 });

  const kbBlock = hits.length
    ? hits
        .map(
          (h: KbHit, i: number) =>
            `--- KB chunk ${i + 1} (similarity ${h.similarity.toFixed(2)}) — source: ${h.source_path} ---\n${h.content}`
        )
        .join('\n\n')
    : '(no KB matches above the threshold)';

  const userPrompt = `Raw learning captured by the operator (just typed into a form, not polished):

"""
${title ? `Working title: ${title}\n\n` : ''}${rawLearning}
"""

KB context retrieved for this topic (may inform the post or be irrelevant):

${kbBlock}

Draft the community announce post now. Lead with the technical observation, follow with implication and workaround, end with the signature. Under 250 words.`;

  const msg = await anthropic().messages.create({
    model: MODEL_DRAFTER,
    max_tokens: 1200,
    system: `${BASE_SYSTEM}\n\n---\nVOICE RULES (load-bearing):\n${voice}`,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const draftText =
    msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n')
      .trim() || '';

  const confidence = hits.length === 0 ? 0.55 : Math.min(0.95, 0.65 + hits.length * 0.06);

  return {
    draft_text: draftText,
    confidence_score: confidence,
    cite_files: hits.map((h) => h.source_path),
  };
}
