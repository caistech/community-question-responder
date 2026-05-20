import Link from 'next/link';
import { Check, Github, ArrowRight, Lock, Unlock } from 'lucide-react';
import { PORTFOLIO_LINKS } from '@/lib/portfolio-links';

// Public Vercel-Deploy URL — same env-var schema as README. Keep these
// two strings in sync if you change either.
const GITHUB_REPO = 'https://github.com/dennissolver/community-question-responder';
const VERCEL_DEPLOY_URL =
  'https://vercel.com/new/clone' +
  '?repository-url=https%3A%2F%2Fgithub.com%2Fdennissolver%2Fcommunity-question-responder' +
  '&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,' +
  'ANTHROPIC_API_KEY,OPENAI_API_KEY,RESEND_API_KEY,RESEND_FROM_EMAIL,ELEVENLABS_API_KEY,' +
  'CRON_SECRET,NEXT_PUBLIC_APP_URL' +
  '&envDescription=Required+credentials+%E2%80%94+all+BYOK%2C+see+README+for+links' +
  '&envLink=https%3A%2F%2Fgithub.com%2Fdennissolver%2Fcommunity-question-responder%23required-credentials';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* ============================================================
          HERO — value prop + primary CTAs
          ============================================================ */}
      <section className="px-6 pt-24 pb-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Unlock className="h-3 w-3" />
            BYOK · MIT-licensed · self-hosted
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
            Be present in every community.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Without burning a human in each one.
            </span>
          </h1>
          <p className="mb-10 max-w-2xl text-lg text-gray-400 md:text-xl">
            CQR watches developer-community Slacks and Discords, drafts
            thoughtful technical replies against your own knowledge base, and
            holds each one for one-click approval. Self-hosted in your own
            infrastructure. BYOK. Free.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <a
              href={VERCEL_DEPLOY_URL}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-medium text-gray-950 transition-colors hover:bg-emerald-400"
            >
              Deploy your own
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={GITHUB_REPO}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-6 py-3 font-medium text-gray-200 transition-colors hover:bg-gray-900"
            >
              <Github className="h-4 w-4" />
              View source on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* ============================================================
          LP-3 — Product-in-action mock. Designed render of a draft
          card so visitors see what they're actually getting before
          they deploy.
          ============================================================ */}
      <section className="px-6 pb-16">
        <div className="mx-auto max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-gray-800 bg-gray-900/60 shadow-2xl shadow-emerald-500/5">
            <div className="border-b border-gray-800 bg-gray-900/80 px-5 py-3">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <div className="h-2 w-2 rounded-full bg-red-400" />
                <div className="h-2 w-2 rounded-full bg-amber-400" />
                <div className="h-2 w-2 rounded-full bg-emerald-400" />
                <span className="ml-3">your-app.vercel.app / drafts</span>
              </div>
            </div>
            <div className="p-6">
              <div className="mb-4 flex items-center gap-3 text-xs text-gray-500">
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-emerald-300">
                  Pending review
                </span>
                <span>#supabase-help · vendor-docs KB · confidence 0.86</span>
              </div>
              <div className="mb-3 text-sm text-gray-400">
                <span className="font-medium text-gray-300">Owen</span> asked
                12 min ago:
              </div>
              <div className="mb-5 rounded-lg border border-gray-800 bg-gray-950 px-4 py-3 text-sm text-gray-300">
                Why is my Next.js webhook route at <code>/api/webhooks/stripe</code>{' '}
                returning 401 even though I&apos;m verifying the signature
                inside the handler?
              </div>
              <div className="mb-5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-gray-200">
                <div className="mb-2 text-xs font-medium text-emerald-300">
                  Drafted reply
                </div>
                Hey Owen — almost certain this is your Supabase auth
                middleware running before the route handler. Same class of
                bug has bitten me twice in production. Quick check + the fix.
                <br />
                <br />
                If you&apos;re using the standard <code>@supabase/ssr</code>{' '}
                middleware pattern, the gate checks for a valid Supabase auth
                cookie on every <code>/api/*</code> request. Webhooks from
                Stripe don&apos;t carry that cookie — they carry a signature
                header instead. Rejected at the gate, before your handler
                runs.
                <br />
                <br />
                <span className="text-gray-500">[2 more paragraphs · cites 3 KB chunks]</span>
              </div>
              <div className="flex gap-2 text-sm">
                <button className="rounded-lg bg-emerald-500 px-4 py-2 font-medium text-gray-950" disabled>
                  Approve & post
                </button>
                <button className="rounded-lg border border-gray-700 px-4 py-2 text-gray-300" disabled>
                  Edit
                </button>
                <button className="rounded-lg border border-gray-700 px-4 py-2 text-gray-300" disabled>
                  Dismiss
                </button>
              </div>
            </div>
          </div>
          <p className="mt-3 text-center text-xs text-gray-500">
            One draft from the dashboard — what the operator sees, all day.
          </p>
        </div>
      </section>

      {/* ============================================================
          How it works
          ============================================================ */}
      <section className="border-y border-gray-800 bg-gray-900/40 px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-10 text-2xl font-semibold">How it works</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            {[
              {
                step: '1',
                title: 'Watch',
                body: 'A scheduled job polls each community channel for top-level questions you have not answered yet.',
              },
              {
                step: '2',
                title: 'Classify',
                body: 'A cheap LLM call decides whether the question is on-topic, technical, and worth answering.',
              },
              {
                step: '3',
                title: 'Draft',
                body: 'A second call drafts a reply in your voice, grounded in your knowledge base, with citations.',
              },
              {
                step: '4',
                title: 'You approve',
                body: 'Drafts queue in a dashboard. You read, edit if needed, click Post. Bot posts in your channel.',
              },
            ].map((s) => (
              <div
                key={s.step}
                className="rounded-2xl border border-gray-800 bg-gray-950 p-6"
              >
                <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 font-bold text-gray-950">
                  {s.step}
                </div>
                <div className="mb-2 font-semibold">{s.title}</div>
                <div className="text-sm text-gray-400">{s.body}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          LP-5 — Two deployment modes side-by-side
          ============================================================ */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-2 text-2xl font-semibold">Two ways to run this</h2>
          <p className="mb-10 max-w-2xl text-sm text-gray-400">
            One codebase. One config switch (captured during first-run setup).
            Pick whichever fits your install.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-cyan-500/15 px-3 py-1 text-xs font-medium text-cyan-300">
                customer-self-serve
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                For operators on multi-vendor stacks
              </h3>
              <p className="mb-4 text-sm text-gray-400">
                Point CQR at vendor docs you depend on. When you have a bug,
                query the KB. Drafts queue for <em>you only</em> — nothing
                posts anywhere. Don&apos;t wait for vendor support; generate
                answers from public surfaces in seconds.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  Personal productivity tool — no community posting
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  Ingest any vendor&apos;s docs, GitHub, public issues
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  90-second workarounds, copy the text to wherever
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-gray-800 bg-gray-900/40 p-6">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                vendor-self-deploy
              </div>
              <h3 className="mb-2 text-lg font-semibold">
                For vendors / community admins
              </h3>
              <p className="mb-4 text-sm text-gray-400">
                Point CQR at <em>your own</em> docs, GitHub, community archive.
                When members ask questions, CQR drafts replies. You approve
                before anything posts. Clear the community queue faster
                without scaling headcount.
              </p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  Approved drafts post to your Slack/Discord as the bot
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  60-day human-only review before auto-post is even an option
                </li>
                <li className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                  Audit log on every approval, edit, dismiss, post
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          LP-4 + LP-7 — Deploy section with operator strip
          ============================================================ */}
      <section className="border-t border-gray-800 bg-gradient-to-b from-emerald-500/5 to-transparent px-6 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            <Lock className="h-3 w-3" />
            Your infra · your keys · your data
          </div>
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">
            Deploy in under five minutes
          </h2>
          <p className="mb-10 text-sm text-gray-400 md:text-base">
            BYOK — you bring your own Anthropic, OpenAI, Supabase, Resend,
            and ElevenLabs keys. CQR never touches anything CAS-owned at
            runtime. Vercel button below walks you through every required
            env var; first visit lands you on <code>/setup</code> which
            creates your voice agent programmatically (no clicking around
            ElevenLabs&apos; dashboard).
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href={VERCEL_DEPLOY_URL}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-8 py-4 text-base font-medium text-gray-950 transition-colors hover:bg-emerald-400"
            >
              Deploy to Vercel
              <ArrowRight className="h-4 w-4" />
            </a>
            <a
              href={GITHUB_REPO}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-8 py-4 text-base font-medium text-gray-200 transition-colors hover:bg-gray-900"
            >
              <Github className="h-4 w-4" />
              Read the source first
            </a>
          </div>
          <div className="mt-6 text-xs text-gray-500">
            Zero terminal commands · MIT-licensed · No SaaS upsell, no Pro tier
          </div>
        </div>
      </section>

      {/* ============================================================
          LP-6 — Footer with portfolio links
          ============================================================ */}
      <section className="border-t border-gray-800 px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col gap-4 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="font-semibold text-gray-300">
                A <a href={PORTFOLIO_LINKS.marketplace} className="text-emerald-400 hover:underline">BYOK Factory</a> tool
              </div>
              <div className="mt-1 text-xs text-gray-500">
                Free, source-first portfolio of small AI products.
              </div>
            </div>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
              <a href={PORTFOLIO_LINKS.marketplace} className="hover:text-white">
                Marketplace
              </a>
              <a href={PORTFOLIO_LINKS.engagement} className="hover:text-white">
                Studio-in-residence
              </a>
              <a href={GITHUB_REPO} className="hover:text-white">
                GitHub
              </a>
              <Link href="/login" className="hover:text-white">
                Operator sign in
              </Link>
            </nav>
          </div>
        </div>
      </section>
    </main>
  );
}
