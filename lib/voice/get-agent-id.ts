import { createServiceClient } from '@/lib/supabase/service';

/**
 * Server-side helper to read the operator's ElevenLabs agent_id from
 * system_config. Returns null if setup hasn't completed yet — the FAB
 * loader uses that to skip rendering the voice surface.
 *
 * Per CQR_RELEASE_REQUIREMENTS.md Task 3+6: the agent is created by the
 * setup wizard (which calls ElevenLabs API with the operator's BYOK
 * ELEVENLABS_API_KEY) and stored in system_config.agent_id. Reading
 * from system_config — not process.env — is what makes the runtime
 * portable across per-operator deploys.
 */
export async function getAgentId(): Promise<string | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from('system_config')
    .select('agent_id, setup_complete')
    .eq('id', 1)
    .maybeSingle();

  if (error || !data) return null;
  if (!data.setup_complete) return null;
  return (data.agent_id as string | null) ?? null;
}
