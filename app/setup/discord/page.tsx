import { DiscordSetupForm } from './setup-form';

export const dynamic = 'force-dynamic';

export default function DiscordSetupPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-2 text-xs uppercase tracking-wide text-gray-500">
        Discord setup
      </div>
      <h1 className="mb-2 text-3xl font-bold">Connect a Discord guild</h1>
      <p className="mb-8 max-w-2xl text-sm text-gray-400">
        Discord works differently from Slack — you create a <strong>bot</strong>{' '}
        (not a user app), invite the bot into a Discord server (called a
        guild), and paste the <strong>bot token</strong> here. Posts will
        appear as the bot&apos;s identity, not yours; the signature line in
        each reply attributes the post to whatever you set in{' '}
        <code>operator_signature</code> during first-run /setup.
      </p>

      <div className="mb-8 rounded-2xl border border-gray-800 bg-gray-900/40 p-6 text-sm text-gray-400">
        <div className="mb-3 font-semibold text-gray-200">How to set up a Discord bot</div>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Go to{' '}
            <a
              href="https://discord.com/developers/applications"
              target="_blank"
              rel="noopener"
              className="text-emerald-400 hover:underline"
            >
              discord.com/developers/applications
            </a>
            , click <strong>New Application</strong>.
          </li>
          <li>
            Name it whatever the community will see on every reply — for
            example, <em>Community Reply Bot</em> or your company name with{' '}
            <em>Bot</em> appended. Set an avatar that visually attributes
            to your brand — Discord shows this on every post.
          </li>
          <li>
            Left sidebar → <strong>Bot</strong>. Click <strong>Reset Token</strong> and copy the
            new token. This is your <code className="text-xs text-emerald-400">bot token</code> —
            keep it secret, treat it like a password.
          </li>
          <li>
            Still on the Bot page, scroll to{' '}
            <strong>Privileged Gateway Intents</strong>. Enable{' '}
            <strong>Message Content Intent</strong> (required to read the body
            of community messages — Discord gates this).
          </li>
          <li>
            Left sidebar → <strong>OAuth2</strong> → <strong>URL Generator</strong>.
            Tick scopes: <code className="text-xs text-emerald-400">bot</code>. Then under
            Bot Permissions, tick: <code className="text-xs text-emerald-400">Read Messages/View Channels</code>,{' '}
            <code className="text-xs text-emerald-400">Read Message History</code>,{' '}
            <code className="text-xs text-emerald-400">Send Messages</code>.
          </li>
          <li>
            Copy the generated URL at the bottom of that page. Open it in a
            browser — Discord will ask which guild to add the bot to. Pick the
            guild you want to watch (your own server first, for testing; the
            target community after).
          </li>
          <li>
            For a community guild you don't own (Supabase, Vercel, etc.) you
            need server-admin approval to invite the bot. DM the admin with
            the OAuth URL and the four scopes shown above. Same friction
            profile as Slack workspace install.
          </li>
          <li>Paste the bot token below. We validate it via /users/@me and /users/@me/guilds.</li>
        </ol>
      </div>

      <DiscordSetupForm />
    </div>
  );
}
