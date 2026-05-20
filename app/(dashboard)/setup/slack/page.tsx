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
        Paste a Slack <strong>bot token</strong> (starts with{' '}
        <code className="text-xs">xoxb-</code>). The cron uses it to read
        messages the bot can see and post replies as the bot. The workspace
        admin (you, on your own install) authorises the bot once. Required
        bot scopes:{' '}
        <code className="ml-1 text-xs text-emerald-400">
          channels:history, channels:read, chat:write, users:read
        </code>
        .
      </p>

      <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900/40 p-6 text-sm text-gray-400">
        <div className="mb-3 font-semibold text-gray-200">
          How to create the Slack bot
        </div>
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
            and click <strong>Create New App</strong> →{' '}
            <strong>From scratch</strong>.
          </li>
          <li>
            Name it (e.g. <em>Community Reply Bot</em> — this is the display
            name users see on your posts), pick the workspace you want it
            installed in.
          </li>
          <li>
            Left sidebar → <strong>OAuth &amp; Permissions</strong>. Scroll
            to <strong>Bot Token Scopes</strong> (NOT User Token Scopes).
            Add:{' '}
            <code className="text-xs text-emerald-400">
              channels:history
            </code>
            ,{' '}
            <code className="text-xs text-emerald-400">channels:read</code>,{' '}
            <code className="text-xs text-emerald-400">chat:write</code>,{' '}
            <code className="text-xs text-emerald-400">users:read</code>.
          </li>
          <li>
            Scroll to the top of the OAuth page. Click{' '}
            <strong>Install to Workspace</strong>. Authorise. Copy the{' '}
            <strong>Bot User OAuth Token</strong> (starts with{' '}
            <code className="text-xs">xoxb-</code>) — NOT the User OAuth
            Token below it.
          </li>
          <li>
            Invite the bot into each channel you want it watching: in Slack,
            type <code className="text-xs">/invite @your-bot-name</code> in
            the channel. Without an explicit invite, the bot can&apos;t read
            the channel even with <code>channels:history</code> scope.
          </li>
          <li>
            <em>(Optional)</em> If you plan to add Slack event-subscription
            webhooks later, copy the <strong>Signing Secret</strong> from{' '}
            <strong>Basic Information</strong> → <strong>App Credentials</strong>{' '}
            and paste it below. The poller doesn&apos;t need it; the field
            is here so the credential lives alongside the token.
          </li>
          <li>
            Paste the bot token below. We validate it via{' '}
            <code>auth.test</code> before saving.
          </li>
        </ol>
      </div>

      <SlackSetupForm />
    </div>
  );
}
