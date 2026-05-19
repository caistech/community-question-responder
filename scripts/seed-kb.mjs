#!/usr/bin/env node
/**
 * Seed the `unipile` KB namespace with the InvestorPilot Unipile corpus
 * plus the four hand-written reference replies.
 *
 * Run:
 *   node scripts/seed-kb.mjs
 *
 * Reads from .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   OPENAI_API_KEY
 *
 * Idempotent — re-running replaces all chunks for the same (namespace, source_path).
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, '..');

// ---------------------------------------------------------------------------
// Env
// ---------------------------------------------------------------------------
async function loadEnv() {
  const envPath = path.join(PROJECT_ROOT, '.env.local');
  const raw = await fs.readFile(envPath, 'utf-8');
  const out = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return out;
}

// ---------------------------------------------------------------------------
// Markdown-aware chunker (port of lib/kb/chunker.ts)
// ---------------------------------------------------------------------------
const TARGET_CHARS = 2400;
const MAX_CHARS = 3200;
const MIN_CHARS = 400;

function splitOnHeadings(raw) {
  const lines = raw.split('\n');
  const sections = [];
  let cur = [];
  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      if (cur.length) sections.push(cur.join('\n'));
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length) sections.push(cur.join('\n'));
  return sections.filter((s) => s.trim().length > 0);
}

function splitParagraphs(text, target, max) {
  const paras = text.split(/\n\s*\n/);
  const out = [];
  let buf = '';
  for (const p of paras) {
    if (buf.length === 0) buf = p;
    else if (buf.length + p.length + 2 < target) buf += '\n\n' + p;
    else if (buf.length + p.length + 2 < max) {
      buf += '\n\n' + p;
      out.push(buf);
      buf = '';
    } else {
      out.push(buf);
      buf = p;
    }
  }
  if (buf.length) out.push(buf);
  return out;
}

function chunkMarkdown(raw) {
  const sections = splitOnHeadings(raw);
  const out = [];
  for (const sec of sections) {
    if (sec.length <= MAX_CHARS) out.push(sec);
    else out.push(...splitParagraphs(sec, TARGET_CHARS, MAX_CHARS));
  }
  const merged = [];
  for (const c of out) {
    const last = merged[merged.length - 1];
    if (last && last.length + c.length + 2 < TARGET_CHARS) {
      merged[merged.length - 1] = last + '\n\n' + c;
    } else {
      merged.push(c);
    }
  }
  return merged
    .filter((c) => c.trim().length >= MIN_CHARS || merged.length === 1)
    .map((content, index) => ({
      content: content.trim(),
      index,
      token_count: Math.ceil(content.length / 4),
    }));
}

// ---------------------------------------------------------------------------
// Ingest
// ---------------------------------------------------------------------------
async function ingest(db, openai, input) {
  const { data: doc, error: docErr } = await db
    .from('kb_documents')
    .upsert(
      {
        namespace: input.namespace,
        source_path: input.source_path,
        source_kind: input.source_kind,
        title: input.title ?? null,
        raw_content: input.content,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'namespace,source_path' }
    )
    .select('id')
    .single();
  if (docErr || !doc) throw new Error(`upsert kb_documents failed: ${docErr?.message}`);

  await db.from('kb_chunks').delete().eq('document_id', doc.id);

  const chunks = chunkMarkdown(input.content);
  if (chunks.length === 0) return { document_id: doc.id, chunks: 0 };

  const embResp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: chunks.map((c) => c.content.slice(0, 8000)),
  });
  const embeddings = embResp.data.map((d) => d.embedding);

  const rows = chunks.map((c, i) => ({
    document_id: doc.id,
    namespace: input.namespace,
    chunk_index: c.index,
    content: c.content,
    embedding: embeddings[i],
    token_count: c.token_count,
  }));

  const { error: chunkErr } = await db.from('kb_chunks').insert(rows);
  if (chunkErr) throw new Error(`insert kb_chunks failed: ${chunkErr.message}`);
  return { document_id: doc.id, chunks: chunks.length };
}

// ---------------------------------------------------------------------------
// Source files from InvestorPilot
// ---------------------------------------------------------------------------
const INVESTORPILOT = 'C:/Users/denni/PycharmProjects/investorpilot';
const SOURCE_FILES = [
  {
    rel: 'docs/sprint-0/03-unipile-research.md',
    kind: 'doc',
    title: 'Unipile research brief',
  },
  {
    rel: 'docs/sprint-0/08-unipile-spike-spec.md',
    kind: 'doc',
    title: 'Unipile capability spike spec',
  },
  {
    rel: 'docs/sprint-0/12-discovery-architecture.md',
    kind: 'doc',
    title: 'Discovery architecture v3',
  },
  {
    rel: 'src/lib/channels/channel-guard.ts',
    kind: 'code',
    title: 'channel-guard: daily caps + warmup curve',
  },
];

// ---------------------------------------------------------------------------
// Reference replies — gold-standard few-shot examples for the drafter
// ---------------------------------------------------------------------------
const REFERENCE_REPLIES = [
  {
    source_path: 'reply-examples/lucas-ops-center-architecture.md',
    title: 'Reply: ops-center architecture for multi-account Unipile',
    content: `# Reply: Lucas — ops-center architecture for multi-account Unipile

**Question summary:** B2B outbound agency owner asks how to build a centralised dashboard over multiple clients × multiple LinkedIn accounts on Unipile — webhooks vs polling, Supabase modelling, scaling concerns.

**Reply body:**

Hey Lucas — built something close to this, so a few concrete things that might save you time.

The core thing to internalise: don't poll Unipile for day-to-day updates. Their model is webhook-push, and they explicitly position it as a replacement for polling. You register one endpoint and subscribe to message events, account-status events, and new-relation (accepted invitation) events across all your connected accounts. For your use case the ones that matter are roughly \`message.created\`, \`connection.accepted\`, and the \`account.status\` updates. Each payload carries the \`account_id\`, so a single endpoint cleanly handles every client and every LinkedIn account — you just route on \`account_id\` when it lands.

So the architecture I'd suggest:

**Webhooks for the live stream.** One ingestion endpoint. When Unipile POSTs an event, write it straight into Supabase and return a 200 fast. Unipile expects a 200 within 30 seconds or it retries up to 5 times with backoff — so do not do heavy processing inside the handler. Validate signature, insert raw, upsert normalized, respond 200. Any enrichment (LLM classification, scoring, notifications) gets pushed to an async worker via pg_cron or a queue. This is the single most common thing people get wrong.

**Polling as a real peer, not a safety net.** I'd push back slightly on the "webhooks = truth, polling = insurance" framing. In practice Unipile's webhook delivery for LinkedIn DMs is lossy — they drop events during their own re-auth cycles, and on busy accounts. Run a reconciliation job every 15–30 min that lists recent conversations/messages per account and upserts anything missed. Treat it as a co-primary source, not a backup. Idempotent upserts make this free.

**Initial sync is its own phase.** When a new account connects, the historical backfill is a separate one-time job from the live webhook stream — don't conflate them. Right after connect, history fills in progressively, so treat first-sync as "eventually consistent" and let webhooks take over once it settles. Surface a "syncing" state in the UI so reps don't think the account is broken.

**Supabase modelling.** Keep a thin raw events table (append-only, every webhook lands here untouched — audit log + replay source) and separate normalized tables: \`clients\`, \`accounts\`, \`conversations\`, \`messages\`, \`account_status_history\`. Use Unipile's event/message IDs as primary keys and upsert everywhere. Between webhook retries and the polling backfill you will see the same event two or three times — upsert-on-ID makes that a non-issue. The dashboard reads only normalized tables, and Supabase Realtime pushes changes to the UI so reps see replies live.

**Watch out for \`message.created\` firing on outbound messages.** It fires for both directions. Filter on direction/sender or you'll double-count "replies" in your acceptance and reply-rate metrics. Easy bug, common bug.

**Conversation threading.** \`chat_id\` is your thread key, but messages can arrive out of order on retries and after a backfill. Sort by \`created_at\` on read, don't trust insert order, and don't compute "last message" by latest insert.

Now the thing nobody talks about that will actually bite you at scale:

**Account disconnects are the silent killer.** LinkedIn sessions expire, users log in elsewhere, MFA challenges land, Unipile flips the account to \`credentials\` status. If you don't monitor \`account.status\` events explicitly and surface them loudly in the UI, your campaigns silently stop and the dashboard happily shows green. Persist \`status\` + \`last_status_change_at\` per channel, alert on transitions, and **pause dependent sequencer steps when a channel is unhealthy** — don't let them fail silently. This is operational table-stakes for an agency setup.

**Per-LinkedIn-account daily rate caps are your real scaling problem, not the data plumbing.** LinkedIn burns accounts at >~80–100 connection requests/day or >~150 messages/day. With multiple clients × multiple accounts × multiple campaigns, you can't naïvely send from "any account with capacity" — you need a per-account daily ledger and a sender that respects it. Build this on day one, not day ninety.

For your metrics (connections sent, acceptance rate, replies, sends-per-account-today), derive them as views/aggregations over the normalized tables rather than tracking counters live — far easier to keep correct and you can recompute history when (not if) you find a counting bug.

**One nuance on Realtime.** Supabase Realtime is the right call for an internal ops console with a handful of seats. Don't expose it directly to client-facing dashboards at thousands of concurrent connections — it doesn't love that. For client portals, plain fetch with a short polling interval is fine.

That structure has held up well as account count grows, because the live path is push (cost scales with events, not account count) and the only thing that scales with accounts is the cheap periodic reconciliation. The data architecture is the easy part though — the operational layer (daily caps, account health monitoring, re-auth UX) is where agencies running this at scale actually live or die.

Happy to go deeper on the worker/queue side if useful.

— Dennis, Corporate AI Solutions · https://corporate-ai-solutions.vercel.app/`,
  },
  {
    source_path: 'reply-examples/jitin-linkedin-ban-risk.md',
    title: 'Reply: Jitin — LinkedIn ban risk + channel-guard architecture',
    content: `# Reply: Jitin — LinkedIn ban risk + channel-guard architecture

**Question summary:** "Will using Unipile with LinkedIn for outreach impact the individual's account in any way? like ban or something?"

**Reply body:**

Hey Jitin — short answer: yes, there's real risk. Long answer: it's manageable if you respect the platform.

Every automation tool in this space (Unipile, Phantombuster, Expandi, Heyreach, La Growth Machine — all of them) talks to LinkedIn through unofficial endpoints. That's against LinkedIn's ToS regardless of which vendor you pick. LinkedIn doesn't care what tool you used; they care about the behavioural signal.

**One thing that's specific to Unipile and easy to miss:** Unipile does NOT enforce LinkedIn daily caps for you. Their own docs say "provider limits respected but not enforced by Unipile." That means if you just call their send endpoints in a loop you will burn accounts — Unipile will happily relay 200 invites/day until LinkedIn restricts you. You have to build the cap layer yourself, *above* Unipile, before any send hits their API.

In InvestorPilot we run every send through a \`channel-guard\` middleware that enforces three layers in order:

1. **Kill switch** — per-channel + global. One operator click pauses all sends for a tenant. Hooked to the \`account.status\` webhook so a captcha/login challenge auto-pauses the channel before more damage is done.
2. **Daily cap** — per-channel counter that rolls at midnight. Hard ceiling at 20 connection requests/day and 20 DMs/day per account. No UI override on the ceiling itself.
3. **Warmup curve** — for new accounts, the effective cap ramps over 21 days:
   - LinkedIn DMs: 10/day week 1 → 15/day weeks 2-3 → 20/day week 4+
   - LinkedIn connects: 25% → 50% → 75% → 100% of the 20/day ceiling
   - Email (we run Resend separately): same 25/50/75/100% curve over 21 days

Hard cap, no override on fresh accounts. The warmup is the single biggest thing protecting newly-connected accounts.

What actually gets accounts restricted:

- **Volume over the safe envelope.** LinkedIn currently caps invites at roughly 100/week per account (they enforce this server-side now, regardless of tool). Messages tolerate higher but ~100–150/day is the practical ceiling. We deliberately sit at 20/day per account because LinkedIn's invisible spam classifier flags templated bulk DMs to connections well below the literal API throughput limit.
- **New / cold accounts being hammered.** A 3-month-old account with 80 connections suddenly sending 100 invites/day is the most obvious red flag they have. Warm new accounts for 2-4 weeks of normal manual use before automating, then layer the warmup curve on top.
- **Robotic timing.** 24/7 sending, exact-interval pacing, sending during the account owner's local 3am. Use working-hours + 30-180s jitter between actions.
- **High withdrawn/ignored invite ratio.** If 70% of your invites get ignored or you mass-withdraw, LinkedIn reads that as spam.
- **Multiple tools on the same account.** Don't run Unipile + a Chrome extension + Sales Nav scraper on the same login simultaneously. Session/IP fingerprint gets weird and you get flagged faster.
- **Recipient complaints.** A few "this is spam" reports is the fastest path to a restriction.

What helps:

- LinkedIn Premium or Sales Navigator on the account.
- Consistent location/IP — Unipile gives each account a residential proxy, keep it stable.
- Personalised messages, not blasted templates.
- Connection requests *without* a note often have higher accept rates and lower spam-flag rates than bad-template notes.
- An operator-level kill switch wired to your \`account.status\` webhook handler, so an unhealthy account auto-pauses instead of grinding through its remaining cap.

The first restriction is almost always recoverable (verification + a few weeks of human-only use). The second one less so. So treat each LinkedIn account as a finite, fragile asset, not a disposable channel.

Net: it's safe enough to build a business on if you (a) cap-and-warmup outside of Unipile in your own middleware, and (b) react to account-health webhooks instead of ignoring them. It's not safe if you treat Unipile as a "send button" and assume the platform handles the rest.

— Dennis, Corporate AI Solutions · https://corporate-ai-solutions.vercel.app/`,
  },
  {
    source_path: 'reply-examples/mikus-whatsapp-first-sync.md',
    title: 'Reply: Mikus — WhatsApp first-sync eventual consistency',
    content: `# Reply: Mikus — WhatsApp first-sync eventual consistency

**Question summary:** Right after a fresh WhatsApp connect, the first Unipile sync is incomplete — few chats/contacts come back, more on retry, history fills in over time, large chats time out. Is history really ready after \`sync_success\`? Recommended retry pattern? Better approach for initial import?

**Reply body:**

Hey Mikus — this is one of the most common "is this broken?" moments with Unipile + WhatsApp, and the short answer is no, it's working as intended — you just have to model first-sync as eventually consistent, not atomic. Quick take on your three questions:

**1. Is history fully ready after \`sync_success\`? No.** \`sync_success\` means "the WhatsApp Web session is paired and live" — it does not mean history is complete. WhatsApp's multi-device protocol delivers history via its own "history sync" stream that trickles in over hours, sometimes days, depending on account size. Unipile is relaying that stream; they can't make it land faster than WhatsApp delivers it. So \`/chats\` and \`/chats/{id}/messages\` will absolutely return partial data for a while after \`sync_success\` fires, and that's not a bug. The big trap is treating \`sync_success\` as "safe to do a single full backfill now and forget" — that's the exact path that gives you the symptoms you describe.

**2. Recommended wait/retry pattern.** Don't tight-loop retries in the minute after connect (you'll hammer Unipile for data WhatsApp hasn't delivered yet). What works:

- **Progressive reconciliation schedule**, not a fixed retry. Run a backfill job at roughly \`t+5min, t+30min, t+2h, t+6h, t+24h, t+48h\` after connect. Each pass paginates \`/chats\` and upserts. By 48h you're effectively complete on normal accounts.
- **Per-request timeouts ~10–15s** with \`Promise.allSettled\` style handling — never \`Promise.all\` where one slow chat blocks the rest. The "ignoring other contacts" symptom you mentioned is almost certainly a request-level timeout taking the whole batch down.
- **Surface a "syncing" state in the UI** for the first 24h after connect with a soft progress indicator (X chats imported so far). Reps stop thinking it's broken and you stop getting tickets.

**3. Better approach — combine all three of your options.** Don't pick one:

- **Webhook + backfill in parallel from t=0.** Subscribe to \`message.created\` and \`chat.created\` immediately on connect. Webhooks will catch everything from t=connect forward — that's your live stream working from minute one. Backfill is purely about pre-connect history.
- **Contacts → chat list → messages, decoupled.** Three separate phases. Contacts are cheap and complete fast. Chat list comes back next. Messages per chat is where the time and timeouts live. Don't block phase 2 on phase 3 completing.
- **For large chats, don't try to pull full history at all.** Cap initial backfill at ~100 most recent messages per chat. The rest fills in via webhook as new activity happens, or via a "load older" on-demand fetch when a user actually opens that chat. Trying to pull 50K messages from a 5-year-old WhatsApp group in the first sync is the #1 cause of the timeout symptom.
- **Idempotent upserts on Unipile message IDs.** Between the webhook stream and the multiple backfill passes, you'll see the same message 2-3 times — that's fine if you upsert on ID.

The mental model that helps: webhooks are your live truth from t=connect onward, backfill is a best-effort eventually-consistent pull of pre-connect history, and \`sync_success\` is just the starter pistol, not the finish line. Build the dashboard around "always converging" rather than "sync complete or not".

— Dennis, Corporate AI Solutions · https://corporate-ai-solutions.vercel.app/`,
  },
  {
    source_path: 'reply-examples/juan-whatsapp-401-disconnected-account.md',
    title: 'Reply: Juan — connection_status null + 401 disconnected_account false positive',
    content: `# Reply: Juan — connection_status null + 401 disconnected_account false positive

**Question summary:** Two issues since 13 May ~15:00 UTC on Unipile WhatsApp: (1) \`GET /accounts\` returns \`connection_status: null\`, real status now in nested \`sources[]\` with \`_MESSAGING\` suffix; (2) \`POST /chats\` returns HTTP 401 \`disconnected_account\` while the message is actually delivered, and the webhook reports the same false 401.

**Reply body:**

Hey Juan — I've hit both of these in the last week as well, so adding what's actually working in our integration while Unipile responds.

**Issue 1 — \`connection_status\` null, status in \`sources[]\`.**

This looks like a real (uncommunicated) schema change rather than a bug. The \`sources[]\` array with \`_MESSAGING\` / \`_CALLING\` suffixes is Unipile's new shape for accounts that can carry multiple capabilities under a single connection (WhatsApp Business multi-device is the obvious driver — same account, different surfaces). It's been progressively rolling out across providers but they haven't bumped a version or sent a changelog entry I can find.

Practical handling until they confirm:

- Read \`sources[].find(s => s.id.endsWith('_MESSAGING'))?.status\` as the **primary** health field for WhatsApp.
- Fall back to \`connection_status\` only when \`sources[]\` is empty or absent — keeps you working for LinkedIn / Gmail / Outlook accounts that may still populate the old field.
- Treat \`connection_status: null\` as "look at \`sources\` instead", not as "disconnected".
- Status values I've observed: \`OK\`, \`CREDENTIALS\`, \`CONNECTING\`, \`DISCONNECTED\`, \`ERROR\`. Same vocabulary as the old field — so the *values* are stable, only the *location* moved.

I'd code defensively to both shapes regardless of what they say next — Unipile's API evolves through silent shape changes more than through versioned deprecations, and "support both for 6 months" is the cheap insurance.

**Issue 2 — 401 \`disconnected_account\` while the message actually delivers.**

We're seeing this too, since roughly the same window. The pattern suggests Unipile's send pipeline is now doing a **post-flight session check** after dispatching the WhatsApp protocol message, and surfacing the result of that check rather than the result of the send. The protocol message goes out (because the WA Web session is still valid at the moment of dispatch), then the post-send auth probe fails (likely against a different cookie/token rotation), and the 401 is what Unipile returns to you — even though the user already has the message.

This is a Unipile-side classification bug, but until they fix it, the practical workarounds:

1. **Stop trusting the HTTP response code as ground truth for delivery.** Treat 401 \`disconnected_account\` as ambiguous, not a failure.
2. **Cross-reference with Issue 1.** If \`sources[].status === 'OK'\` on the same account at send-time, a 401 from \`POST /chats\` is almost certainly the false-positive pattern, not a real disconnect. We use the combined signal as our actual "did it send" classifier.
3. **Verify via the outbound message in \`GET /chats/{id}/messages\` ~5s after send** — if the message you just dispatched shows up in the chat history, it landed. Slow but authoritative.
4. **Webhook handling**: because the webhook carries the same misleading 401, don't auto-pause channels on a single \`disconnected_account\` event. We now require **two consecutive \`disconnected_account\` events within 5 minutes + a \`sources[].status !== 'OK'\`** before we trip the kill switch. That removed the false positives without losing the real disconnects.
5. **Don't retry on this 401.** Retrying after a "succeeded but reported failed" send is the way you accidentally send the same WhatsApp message three times to a customer.

On the timing question — I can't confirm an incident, but the 13 May ~15:00 UTC window matches a behaviour shift we observed in our own logs, and the cross-account-on-same-key blast radius is consistent with a dispatcher/auth pipeline change rolled out at that boundary rather than per-account session decay. Worth Unipile checking deploy history around that timestamp.

Net for ops: the "real" health for WhatsApp right now is \`sources[*=_MESSAGING].status\`, and the "real" delivery status is "did the message appear in chat history", not "what HTTP code did \`POST /chats\` return". Until they fix the post-flight classification, code to both signals and you can ride out the noise.

— Dennis, Corporate AI Solutions · https://corporate-ai-solutions.vercel.app/`,
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const env = await loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const oaiKey = env.OPENAI_API_KEY;
  if (!url || !key) throw new Error('Missing Supabase env in .env.local');
  if (!oaiKey) throw new Error('Missing OPENAI_API_KEY in .env.local');

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const openai = new OpenAI({ apiKey: oaiKey });

  const NAMESPACE = 'unipile';
  let totalChunks = 0;
  let totalDocs = 0;

  console.log(`Seeding KB namespace: ${NAMESPACE}\n`);

  // 1. InvestorPilot source files
  for (const f of SOURCE_FILES) {
    const fp = path.join(INVESTORPILOT, f.rel);
    try {
      const content = await fs.readFile(fp, 'utf-8');
      const r = await ingest(db, openai, {
        namespace: NAMESPACE,
        source_path: f.rel,
        source_kind: f.kind,
        title: f.title,
        content,
      });
      console.log(`  ✓ ${f.rel} (${r.chunks} chunks)`);
      totalChunks += r.chunks;
      totalDocs++;
    } catch (e) {
      console.warn(`  ⚠ skipped ${f.rel}: ${e.message}`);
    }
  }

  // 2. Reference replies
  for (const reply of REFERENCE_REPLIES) {
    try {
      const r = await ingest(db, openai, {
        namespace: NAMESPACE,
        source_path: reply.source_path,
        source_kind: 'reply_example',
        title: reply.title,
        content: reply.content,
      });
      console.log(`  ✓ ${reply.source_path} (${r.chunks} chunks)`);
      totalChunks += r.chunks;
      totalDocs++;
    } catch (e) {
      console.warn(`  ⚠ skipped ${reply.source_path}: ${e.message}`);
    }
  }

  console.log(`\nDone. ${totalDocs} documents, ${totalChunks} chunks embedded into '${NAMESPACE}'.`);
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
