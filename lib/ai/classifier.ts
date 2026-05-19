import { anthropic, MODEL_CLASSIFIER } from './anthropic';

export type Classification = 'worth_answering' | 'off_topic' | 'noise' | 'meta';

export interface ClassifierResult {
  classification: Classification;
  reason: string;
}

const SYSTEM = `You are a triage classifier for a developer-community Slack channel.

Given one top-level message, decide whether it is worth a thoughtful technical reply from a senior practitioner.

Return JSON only, this exact shape:
{"classification": "worth_answering" | "off_topic" | "noise" | "meta", "reason": "<one sentence>"}

Guidelines:
- "worth_answering": a real technical question about the vendor's API, integration, architecture, scaling, debugging, or a workflow built on top.
- "off_topic": billing, account freezes, payment issues, "is this on your end" without detail, lost-password requests, language requests.
- "noise": greetings, PSAs, "hi everyone", emoji reactions, links without question, demo requests.
- "meta": questions about the community itself, requests for collaborators in a specific language, job posts.

Be generous on borderline cases — when in doubt, classify as "worth_answering" and let the drafter decide. The cost of a wasted draft is one cheap LLM call; the cost of missing a real question is reputation.`;

export async function classify(questionText: string): Promise<ClassifierResult> {
  const msg = await anthropic().messages.create({
    model: MODEL_CLASSIFIER,
    max_tokens: 256,
    system: SYSTEM,
    messages: [{ role: 'user', content: questionText.slice(0, 4000) }],
  });

  const text =
    msg.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('\n') || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { classification: 'noise', reason: 'classifier returned no JSON' };
  }

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    const c = parsed.classification as Classification;
    if (!['worth_answering', 'off_topic', 'noise', 'meta'].includes(c)) {
      return { classification: 'noise', reason: 'invalid classification value' };
    }
    return { classification: c, reason: parsed.reason ?? '' };
  } catch (e) {
    return {
      classification: 'noise',
      reason: `parse error: ${(e as Error).message}`,
    };
  }
}
