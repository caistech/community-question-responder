import { SlackSetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

export default function SlackSetupPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
        Slack setup
      </div>
      <h1 className="mb-2 text-3xl font-bold">Connect a Slack workspace</h1>
      <p className="mb-8 max-w-2xl text-sm text-gray-400">
        Paste a Slack <strong>user token</strong> (one that operates as your
        Slack user, not a bot). The cron uses it to read messages you can see
        and post replies from your account. Required scopes:
        <code className="ml-1 text-xs text-emerald-400">
          channels:history, channels:read, chat:write, users:read
        </code>
        .
      </p>

      <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900/40 p-6 text-sm text-gray-400">
        <div className="mb-3 font-semibold text-gray-200">How to mint a user token</div>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Go to{' '}
            <a
              href="https://api.slack.com/apps"
              target="_blank"
              rel="noopener"
              className="text-emerald-400 hover:underline"
            >
              api.slack.com/apps
            </a>{' '}
            and click <strong>Create New App</strong> → <strong>From scratch</strong>.
          </li>
          <li>
            Pick any workspace you belong to (your own dev workspace is fine
            for app creation — the token works in any workspace once you
            authorise it there).
          </li>
          <li>
            Under <strong>OAuth &amp; Permissions</strong> → <strong>User Token Scopes</strong>, add:
            <code className="ml-1 text-xs text-emerald-400">
              channels:history, channels:read, chat:write, users:read
            </code>
            .
          </li>
          <li>
            Click <strong>Install to Workspace</strong>. Authorise. Copy the{' '}
            <strong>User OAuth Token</strong> (starts with <code className="text-xs">xoxp-</code>) at
            the top of the OAuth page.
          </li>
          <li>
            To use it in a community Slack you don&apos;t own, sign in to that
            community first (web/desktop), then install the same app — the
            scopes are honoured per-workspace.
          </li>
          <li>Paste the token below. We validate it via <code>auth.test</code> before saving.</li>
        </ol>
      </div>

      <SlackSetupForm />
    </div>
  );
}
