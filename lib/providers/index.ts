import type { Provider, ProviderName } from './types';
import { slackProvider } from './slack';
import { discordProvider } from './discord';

const PROVIDERS: Record<ProviderName, Provider> = {
  slack: slackProvider,
  discord: discordProvider,
};

export function getProvider(name: ProviderName): Provider {
  const p = PROVIDERS[name];
  if (!p) throw new Error(`Unknown provider: ${name}`);
  return p;
}

export type { Provider, ProviderName, WorkspaceRow, ChannelRow } from './types';
