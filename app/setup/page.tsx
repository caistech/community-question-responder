import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { SetupChecklist } from './checklist';

export const dynamic = 'force-dynamic';

interface SystemConfig {
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

export default async function SetupPage() {
  // Auth gate — must be signed in to run setup
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login?next=/setup');
  }

  // Read current setup state
  const db = createServiceClient();
  const { data, error } = await db
    .from('system_config')
    .select(
      'setup_complete, agent_id, operator_name, operator_url, operator_signature, bot_display_name, deployment_mode, telemetry_opt_out, install_id'
    )
    .eq('id', 1)
    .maybeSingle();

  if (error) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-12">
        <h1 className="mb-2 text-2xl font-bold text-red-300">
          Could not read setup state
        </h1>
        <p className="text-sm text-gray-400">
          Supabase returned an error reading <code>system_config</code>:{' '}
          <code className="text-red-300">{error.message}</code>. Run the
          migration suite (
          <code>supabase db push</code>) and reload.
        </p>
      </div>
    );
  }

  const config = (data ?? {
    setup_complete: false,
    agent_id: null,
    operator_name: null,
    operator_url: null,
    operator_signature: null,
    bot_display_name: 'Community Reply Bot',
    deployment_mode: 'customer-self-serve' as const,
    telemetry_opt_out: false,
    install_id: '',
  }) as SystemConfig;

  // Already set up — bounce to the main app
  if (config.setup_complete) {
    redirect('/drafts');
  }

  // Workspace count — operator can skip Slack/Discord (optional) but we
  // surface the count so they know whether they've connected one.
  const { count: workspaceCount } = await db
    .from('slack_workspaces')
    .select('id', { count: 'exact', head: true });

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
        First-run setup
      </div>
      <h1 className="mb-2 text-3xl font-bold">Get CQR running in your infra</h1>
      <p className="mb-8 max-w-xl text-sm text-gray-400">
        One-time setup. You can re-visit this page until it&apos;s complete —
        we remember the steps you&apos;ve finished. Slack and Discord
        connections are optional here; you can add workspaces later from the
        dashboard.
      </p>

      <SetupChecklist
        userEmail={user.email ?? ''}
        config={config}
        workspaceCount={workspaceCount ?? 0}
      />
    </div>
  );
}
