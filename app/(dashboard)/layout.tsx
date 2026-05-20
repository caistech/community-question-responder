import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { VoiceFABLoader } from '@/components/voice/voice-fab-loader';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/40">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/drafts" className="font-semibold">
              CQR <span className="text-gray-500">/ dashboard</span>
            </Link>
            <nav className="flex gap-4 text-sm text-gray-400">
              <Link href="/drafts" className="hover:text-white">Drafts</Link>
              <Link href="/learnings/new" className="hover:text-white">+ Learning</Link>
              <Link href="/channels" className="hover:text-white">Channels</Link>
              <Link href="/kb" className="hover:text-white">KB</Link>
              <Link href="/setup/slack" className="hover:text-white">Slack setup</Link>
              <Link href="/setup/discord" className="hover:text-white">Discord setup</Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span>{user?.email}</span>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="text-gray-400 hover:text-white">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main>{children}</main>

      {/* Voice FAB — bottom-right, every authenticated page (VOICE AI RULE).
          Silent no-op until system_config.agent_id is populated by /setup. */}
      <VoiceFABLoader />
    </div>
  );
}
