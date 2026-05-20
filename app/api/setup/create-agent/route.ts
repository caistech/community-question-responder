import { NextRequest, NextResponse } from 'next/server';
import { authenticateAndGetDb } from '@/lib/supabase/auth';
import persona from '@/lib/voice/persona.json';

export const dynamic = 'force-dynamic';

/**
 * POST /api/setup/create-agent
 *
 * Mirrors the hub wizard's create_elevenlabs_agent post-action, but runs
 * inside the deployed app's /setup wizard (Task 7 of CQR_RELEASE_REQUIREMENTS).
 *
 * Reads ELEVENLABS_API_KEY from server env (operator BYOK), POSTs to the
 * ElevenLabs ConvAI API to create an agent matching the persona config in
 * lib/voice/persona.json, then writes the resulting agent_id into
 * system_config.agent_id (NOT into an env var — env vars require a manual
 * dashboard round-trip, breaking the no-CLI deploy promise).
 *
 * Idempotent: if system_config.agent_id is already set, returns 200 with
 * the existing id and skips the API call.
 */
export async function POST(request: NextRequest) {
  const { db, error } = await authenticateAndGetDb(request);
  if (error || !db) {
    return NextResponse.json({ error: error ?? 'Unauthorized' }, { status: 401 });
  }

  // Check if already created
  const { data: existing } = await db
    .from('system_config')
    .select('agent_id')
    .eq('id', 1)
    .maybeSingle();

  if (existing?.agent_id) {
    return NextResponse.json({ ok: true, agent_id: existing.agent_id, reused: true });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          'ELEVENLABS_API_KEY is not set in the deployed environment. Add it in your Vercel project settings and redeploy.',
      },
      { status: 400 }
    );
  }

  const payload = {
    name: persona.name,
    conversation_config: {
      agent: {
        prompt: { prompt: persona.system_prompt },
        first_message: persona.first_message,
        language: persona.language,
      },
      tts: { voice_id: persona.voice_id },
    },
  };

  let agentId: string | undefined;
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/convai/agents/create', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    if (!r.ok) {
      const text = await r.text();
      return NextResponse.json(
        {
          error: `ElevenLabs rejected the request (HTTP ${r.status}): ${text.slice(0, 300)}`,
        },
        { status: 502 }
      );
    }
    const json = (await r.json()) as { agent_id?: string; id?: string };
    agentId = json.agent_id ?? json.id;
    if (!agentId) {
      return NextResponse.json(
        { error: 'ElevenLabs returned no agent_id in response' },
        { status: 502 }
      );
    }
  } catch (e) {
    return NextResponse.json(
      { error: `ElevenLabs request failed: ${(e as Error).message}` },
      { status: 502 }
    );
  }

  const { error: updateErr } = await db
    .from('system_config')
    .update({ agent_id: agentId })
    .eq('id', 1);

  if (updateErr) {
    return NextResponse.json(
      {
        error: `Agent ${agentId} was created on ElevenLabs but writing it to system_config failed: ${updateErr.message}. Paste the agent_id manually into the agent_id column.`,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, agent_id: agentId, reused: false });
}
