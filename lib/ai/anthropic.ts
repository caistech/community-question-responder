import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

/**
 * Singleton Anthropic client. Server-only. Reads ANTHROPIC_API_KEY at
 * first call. Routes through OpenRouter if OPENROUTER_API_KEY is set and
 * ANTHROPIC_API_KEY is not — fewer integrations, same SDK surface.
 */
export function anthropic(): Anthropic {
  if (_client) return _client;

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (anthropicKey) {
    _client = new Anthropic({ apiKey: anthropicKey });
  } else if (openrouterKey) {
    _client = new Anthropic({
      apiKey: openrouterKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer':
          process.env.NEXT_PUBLIC_APP_URL ||
          'https://community-question-responder.vercel.app',
        'X-Title': 'Community Question Responder',
      },
    });
  } else {
    throw new Error('Missing ANTHROPIC_API_KEY or OPENROUTER_API_KEY');
  }
  return _client;
}

export const MODEL_CLASSIFIER = process.env.CLASSIFIER_MODEL || 'claude-haiku-4-5-20251001';
export const MODEL_DRAFTER = process.env.DRAFTER_MODEL || 'claude-sonnet-4-5';
