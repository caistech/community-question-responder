'use client';

import { useState } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { Mic, MicOff, X } from 'lucide-react';

interface VoiceFABProps {
  agentId: string;
}

/**
 * Floating action button — bottom-right voice surface per the VOICE AI
 * STANDARD RULE. Click to start a duplex ConvAI session with the
 * operator agent. Persona config lives in lib/voice/persona.json (the
 * placeholder ships with CQR; swap to canonical when the hub config
 * lands).
 *
 * The agent is created at setup time by the wizard; this component just
 * connects to the existing agent by ID.
 *
 * Note: ConversationProvider must wrap any component using
 * useConversation hook (per @elevenlabs/react v1.6 contract).
 */
export function VoiceFAB({ agentId }: VoiceFABProps) {
  return (
    <ConversationProvider>
      <VoiceFABInner agentId={agentId} />
    </ConversationProvider>
  );
}

function VoiceFABInner({ agentId }: VoiceFABProps) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const conv = useConversation({
    onConnect: () => setError(null),
    onError: (message: string) => setError(message),
  });

  const active = conv.status === 'connected' || conv.status === 'connecting';

  const start = () => {
    setError(null);
    try {
      conv.startSession({ agentId });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stop = () => {
    try {
      conv.endSession();
    } catch {
      // Best-effort
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open voice assistant"
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-gray-950 shadow-lg shadow-emerald-500/30 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-emerald-300"
      >
        <Mic className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border border-gray-800 bg-gray-900 p-4 shadow-2xl">
      <div className="mb-3 flex items-start justify-between">
        <div>
          <div className="text-sm font-semibold text-white">Voice capture</div>
          <div className="text-xs text-gray-400">
            Dictate a learning. The agent confirms before ingest.
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (active) stop();
            setOpen(false);
          }}
          aria-label="Close voice assistant"
          className="rounded-md p-1 text-gray-400 hover:bg-gray-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 rounded-md bg-gray-950 px-3 py-2 text-xs text-gray-400">
        Status: <span className="text-emerald-400">{conv.status}</span>
      </div>

      {error && (
        <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex gap-2">
        {!active ? (
          <button
            type="button"
            onClick={start}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-gray-950 transition-colors hover:bg-emerald-400"
          >
            <Mic className="mr-1 inline h-4 w-4" />
            Start
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            className="flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-400"
          >
            <MicOff className="mr-1 inline h-4 w-4" />
            Stop
          </button>
        )}
      </div>
    </div>
  );
}
