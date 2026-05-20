import { promises as fs } from 'fs';
import path from 'path';

let _voiceRulesTemplate: string | null = null;

async function loadTemplate(): Promise<string> {
  if (_voiceRulesTemplate !== null) return _voiceRulesTemplate;
  const p = path.join(process.cwd(), 'lib', 'ai', 'voice.md');
  try {
    _voiceRulesTemplate = await fs.readFile(p, 'utf-8');
  } catch {
    _voiceRulesTemplate = '';
  }
  return _voiceRulesTemplate;
}

/**
 * Load voice.md and substitute the `{{operator_signature}}` placeholder
 * with the per-install operator signature. Caller fetches the signature
 * from system_config (via service-role client) and passes it in — keeps
 * voice.ts framework-agnostic.
 *
 * Template is cached per-process; substitution happens on every call so
 * an in-flight operator-identity change reflects on the next draft
 * without a restart.
 */
export async function loadVoiceRules(operatorSignature: string): Promise<string> {
  const template = await loadTemplate();
  return template.replace(/\{\{operator_signature\}\}/g, operatorSignature ?? '');
}
