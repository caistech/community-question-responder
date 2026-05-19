// KB sources for the `unipile` namespace.
//
// Re-run: node scripts/seed-kb.mjs unipile

const INVESTORPILOT = 'C:/Users/denni/PycharmProjects/investorpilot';

export default {
  fileSources: [
    {
      absolutePath: `${INVESTORPILOT}/docs/sprint-0/03-unipile-research.md`,
      source_path: 'docs/sprint-0/03-unipile-research.md',
      source_kind: 'doc',
      title: 'Unipile research brief',
    },
    {
      absolutePath: `${INVESTORPILOT}/docs/sprint-0/08-unipile-spike-spec.md`,
      source_path: 'docs/sprint-0/08-unipile-spike-spec.md',
      source_kind: 'doc',
      title: 'Unipile capability spike spec',
    },
    {
      absolutePath: `${INVESTORPILOT}/docs/sprint-0/12-discovery-architecture.md`,
      source_path: 'docs/sprint-0/12-discovery-architecture.md',
      source_kind: 'doc',
      title: 'Discovery architecture v3',
    },
    {
      absolutePath: `${INVESTORPILOT}/src/lib/channels/channel-guard.ts`,
      source_path: 'src/lib/channels/channel-guard.ts',
      source_kind: 'code',
      title: 'channel-guard: daily caps + warmup curve',
    },
  ],
  inlineReplies: [
    // Reference replies are kept in scripts/seed-kb-unipile-replies.mjs to
    // avoid duplicating the long-form content here. The first seeding pass
    // wrote them under reply-examples/{lucas,jitin,mikus,juan}-*.md, which
    // are now in the KB; re-seeding doesn't need to re-include them inline
    // since the upsert is keyed on (namespace, source_path).
  ],
};
