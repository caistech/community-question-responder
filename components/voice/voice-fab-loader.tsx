import { getAgentId } from '@/lib/voice/get-agent-id';
import { VoiceFAB } from './voice-fab';

/**
 * Server-side loader for the voice FAB. Reads agent_id from
 * system_config — if setup hasn't completed or the agent doesn't exist
 * yet, the FAB is silently skipped (no error, no broken button).
 *
 * Mounted in app/(dashboard)/layout.tsx so the FAB appears on every
 * authenticated page per the VOICE AI STANDARD RULE.
 */
export async function VoiceFABLoader() {
  const agentId = await getAgentId();
  if (!agentId) return null;
  return <VoiceFAB agentId={agentId} />;
}
