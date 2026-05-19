import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <section className="px-6 pt-24 pb-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Private beta
          </div>
          <h1 className="mb-6 text-4xl font-bold leading-tight md:text-6xl">
            Be present in every community.
            <br />
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              Without burning a human in each one.
            </span>
          </h1>
          <p className="mb-10 max-w-2xl text-lg text-gray-400 md:text-xl">
            Community Question Responder watches the developer-community Slacks
            and Discords your product lives in, drafts thoughtful technical
            replies against your own knowledge base, and holds each one for
            one-click human approval. Earn the expert reputation your tool
            deserves — at the cadence the community moves at.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/drafts"
              className="rounded-lg bg-emerald-500 px-6 py-3 font-medium text-gray-950 transition-colors hover:bg-emerald-400"
            >
              Open drafts queue
            </Link>
            <a
              href="https://corporate-ai-solutions.vercel.app/"
              className="rounded-lg border border-gray-700 px-6 py-3 font-medium text-gray-200 transition-colors hover:bg-gray-900"
            >
              Talk to us about a build
            </a>
          </div>
        </div>
      </section>

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
                body: 'Drafts queue in a dashboard. You read, edit if needed, click Post. We send it as you.',
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

      <section className="px-6 py-16">
        <div className="mx-auto max-w-3xl text-sm text-gray-400">
          Built by{' '}
          <a
            href="https://corporate-ai-solutions.vercel.app/"
            className="text-emerald-400 hover:underline"
          >
            Corporate AI Solutions
          </a>
          .
        </div>
      </section>
    </main>
  );
}
