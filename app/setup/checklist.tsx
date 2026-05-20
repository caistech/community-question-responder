'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Circle, Mic, MessageSquare, Hash, User } from 'lucide-react';

interface ChecklistConfig {
  setup_complete: boolean;
  agent_id: string | null;
  operator_name: string | null;
  operator_url: string | null;
  operator_signature: string | null;
  bot_display_name: string;
  deployment_mode: 'customer-self-serve' | 'vendor-self-deploy';
  telemetry_opt_out: boolean;
  install_id: string;
}

interface Props {
  userEmail: string;
  config: ChecklistConfig;
  workspaceCount: number;
}

export function SetupChecklist({ userEmail, config, workspaceCount }: Props) {
  const router = useRouter();
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Operator identity local state — pre-fill with whatever's in DB
  const [name, setName] = useState(config.operator_name ?? '');
  const [url, setUrl] = useState(config.operator_url ?? '');
  const [signature, setSignature] = useState(config.operator_signature ?? '');
  const [botName, setBotName] = useState(
    config.bot_display_name || 'Community Reply Bot'
  );
  const [deploymentMode, setDeploymentMode] = useState<
    'customer-self-serve' | 'vendor-self-deploy'
  >(config.deployment_mode);
  const [telemetryOptOut, setTelemetryOptOut] = useState(
    config.telemetry_opt_out
  );

  const identityComplete =
    !!config.operator_name && !!config.operator_url && !!config.operator_signature;
  const agentComplete = !!config.agent_id;
  const workspaceConnected = workspaceCount > 0;

  // Required to enable Complete: identity + agent. Workspace is optional.
  const canComplete = identityComplete && agentComplete;

  const callApi = async (path: string, body?: object) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
    return json;
  };

  const saveIdentity = () => {
    setError(null);
    startTransition(async () => {
      try {
        await callApi('/api/setup/identity', {
          operator_name: name,
          operator_url: url,
          operator_signature: signature,
          bot_display_name: botName,
          deployment_mode: deploymentMode,
          telemetry_opt_out: telemetryOptOut,
        });
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const createAgent = () => {
    setError(null);
    startTransition(async () => {
      try {
        await callApi('/api/setup/create-agent');
        router.refresh();
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  const completeSetup = () => {
    setError(null);
    startTransition(async () => {
      try {
        await callApi('/api/setup/complete');
        router.push('/drafts');
      } catch (e) {
        setError((e as Error).message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <StepRow
        icon={<User className="h-5 w-5" />}
        title="Operator identity"
        done={identityComplete}
        summary={
          identityComplete
            ? `${config.operator_name} · ${config.operator_url}`
            : 'Required — these fields replace hardcoded vendor references in voice rules and reply signatures.'
        }
      >
        <div className="space-y-3 pt-3">
          <Input
            label="Your name"
            value={name}
            onChange={setName}
            placeholder="Your full name"
            required
          />
          <Input
            label="Your URL"
            value={url}
            onChange={setUrl}
            placeholder="https://example.com"
            required
          />
          <Input
            label="Reply signature"
            value={signature}
            onChange={setSignature}
            placeholder="— Your Name, Your Company · https://example.com"
            required
            help="Appended to every draft reply CQR generates."
          />
          <Input
            label="Bot display name"
            value={botName}
            onChange={setBotName}
            placeholder="Community Reply Bot"
            help="Slack/Discord posts will appear under this name."
          />

          <div>
            <label className="mb-1 block text-sm text-gray-300">
              Deployment mode
            </label>
            <select
              value={deploymentMode}
              onChange={(e) =>
                setDeploymentMode(
                  e.target.value as 'customer-self-serve' | 'vendor-self-deploy'
                )
              }
              className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="customer-self-serve">
                Customer self-serve — drafts only, never auto-post anywhere
              </option>
              <option value="vendor-self-deploy">
                Vendor self-deploy — approved drafts post to your own communities
              </option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              You can change this later in <code>system_config</code>.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={telemetryOptOut}
              onChange={(e) => setTelemetryOptOut(e.target.checked)}
              className="accent-emerald-500"
            />
            <span>
              Opt out of anonymous install telemetry{' '}
              <span className="text-xs text-gray-500">
                (one-time POST when setup completes — no PII, just install_id +
                version)
              </span>
            </span>
          </label>

          <button
            type="button"
            onClick={saveIdentity}
            disabled={busy || !name || !url || !signature}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? 'Saving…' : identityComplete ? 'Update identity' : 'Save identity'}
          </button>
        </div>
      </StepRow>

      <StepRow
        icon={<Mic className="h-5 w-5" />}
        title="ElevenLabs voice agent"
        done={agentComplete}
        summary={
          agentComplete
            ? `Agent ${config.agent_id?.slice(0, 12)}… ready`
            : 'Required — we POST to ElevenLabs with your ELEVENLABS_API_KEY and store the agent_id here. No clicking around their dashboard.'
        }
      >
        <div className="pt-3">
          <button
            type="button"
            onClick={createAgent}
            disabled={busy || agentComplete}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {busy ? 'Calling ElevenLabs…' : agentComplete ? 'Already created' : 'Create my ElevenLabs agent'}
          </button>
        </div>
      </StepRow>

      <StepRow
        icon={<Hash className="h-5 w-5" />}
        title="Connect Slack (optional)"
        done={workspaceConnected}
        summary={
          workspaceConnected
            ? `${workspaceCount} workspace${workspaceCount === 1 ? '' : 's'} connected`
            : 'Optional — paste a Slack bot token (xoxb-) for each workspace the bot should watch. You can do this later from the dashboard.'
        }
      >
        <div className="pt-3">
          <a
            href="/setup/slack"
            className="inline-block rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Open Slack setup →
          </a>
          <p className="mt-2 text-xs text-gray-500">
            Add Discord workspaces from{' '}
            <a href="/setup/discord" className="underline hover:text-white">
              /setup/discord
            </a>{' '}
            after this.
          </p>
        </div>
      </StepRow>

      <StepRow
        icon={<MessageSquare className="h-5 w-5" />}
        title="Connect Discord (optional)"
        done={workspaceConnected}
        summary="Optional — invite a Discord bot into your guild and paste the bot token. Same shape as Slack."
        expanded={false}
      >
        <div className="pt-3">
          <a
            href="/setup/discord"
            className="inline-block rounded-lg border border-gray-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            Open Discord setup →
          </a>
        </div>
      </StepRow>

      <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-white">
              Complete setup
            </div>
            <div className="text-xs text-gray-400">
              Marks <code>system_config.setup_complete = true</code> and
              redirects you into the dashboard. Voice FAB will appear after this.
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={completeSetup}
          disabled={busy || !canComplete}
          className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-medium text-gray-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
        >
          {busy
            ? 'Completing…'
            : !canComplete
            ? 'Complete identity + agent steps first'
            : 'Complete setup → go to dashboard'}
        </button>
        {!canComplete && (
          <p className="mt-2 text-center text-xs text-gray-500">
            Slack and Discord are optional — leave them for later if needed.
          </p>
        )}
      </div>

      <div className="text-center text-xs text-gray-500">
        Signed in as <span className="text-gray-400">{userEmail}</span> ·
        install <code>{config.install_id.slice(0, 8)}…</code>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local component helpers
// ---------------------------------------------------------------------------

function StepRow({
  icon,
  title,
  done,
  summary,
  children,
  expanded,
}: {
  icon: React.ReactNode;
  title: string;
  done: boolean;
  summary: string;
  children: React.ReactNode;
  expanded?: boolean;
}) {
  // Default: expanded if not done, collapsed if done (with override)
  const showChildren = expanded ?? !done;

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-5">
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${
            done
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'border border-gray-700 text-gray-500'
          }`}
        >
          {done ? <Check className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="text-gray-400">{icon}</span>
            {title}
          </div>
          <div className="mt-1 text-xs text-gray-400">{summary}</div>
        </div>
      </div>
      {showChildren && children}
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  help?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm text-gray-300">
        {label}
        {required && <span className="text-red-400"> *</span>}
      </label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
      />
      {help && <p className="mt-1 text-xs text-gray-500">{help}</p>}
    </div>
  );
}
