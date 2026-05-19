import { promises as fs } from 'fs';
import path from 'path';

let _voiceRules: string | null = null;

/**
 * Load voice.md once per process and cache. The drafter loads this into
 * its system prompt at every call.
 */
export async function loadVoiceRules(): Promise<string> {
  if (_voiceRules) return _voiceRules;
  const p = path.join(process.cwd(), 'lib', 'ai', 'voice.md');
  try {
    _voiceRules = await fs.readFile(p, 'utf-8');
  } catch {
    _voiceRules = '';
  }
  return _voiceRules;
}
