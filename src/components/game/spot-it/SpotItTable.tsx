"use client";

import { useEffect, useState } from "react";
import type { ChatChannel, PublicGameState } from "@/lib/types";
import { SpotItCard } from "@/components/game/spot-it/SpotItCard";
import { ChatPanel } from "@/components/game/ChatPanel";
import { GlassPanel, StatusChip } from "@/components/ui/primitives";
import type { GameSocket } from "@/lib/socket/client";

export function SpotItTable({
  state,
  socket,
  onMatch,
  onSendChat,
  enableVoice = true,
  joinVoiceRequest,
  onVoiceJoined,
}: {
  state: PublicGameState;
  socket: GameSocket | null;
  onMatch: (symbolId: number) => void;
  onSendChat: (channel: ChatChannel, text: string) => void;
  enableVoice?: boolean;
  joinVoiceRequest?: { nonce: number; channel: ChatChannel } | null;
  onVoiceJoined?: (channel: ChatChannel) => void;
}) {
  const spot = state.spotIt;
  const [flash, setFlash] = useState<number | null>(null);
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const onReject = () => {
      setFlash(null);
      setShake(true);
      setTimeout(() => setShake(false), 350);
    };
    socket.on("spotit:reject", onReject);
    return () => {
      socket.off("spotit:reject", onReject);
    };
  }, [socket]);

  if (!spot) return null;

  const pick = (symbolId: number) => {
    if (state.paused) return;
    setFlash(symbolId);
    onMatch(symbolId);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-crimson-glow">
              Spot It
            </p>
            <h2 className="font-display text-2xl font-bold">
              Match the center card
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {state.paused && <StatusChip tone="afk">Paused</StatusChip>}
            <StatusChip tone="live">{spot.deckRemaining} in deck</StatusChip>
          </div>
        </div>

        <div
          className={`mt-8 flex flex-col items-center gap-8 md:flex-row md:justify-center ${
            shake ? "animate-[shake_0.35s_ease-in-out]" : ""
          } ${state.paused ? "pointer-events-none opacity-60" : ""}`}
        >
          <div className="text-center">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
              Center
            </p>
            <SpotItCard
              symbols={spot.centerCard}
              size="lg"
              disabled
            />
          </div>
          <div className="text-center">
            <p className="mb-3 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
              Your card
            </p>
            {spot.yourCard ? (
              <SpotItCard
                symbols={spot.yourCard}
                size="lg"
                onPick={pick}
                flashId={flash}
                disabled={state.paused}
              />
            ) : (
              <p className="text-sm text-ink-steel">No card</p>
            )}
          </div>
        </div>
        <GlassPanel className="mt-8 p-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
            Scores
          </p>
          <ul className="mt-2 space-y-1">
            {spot.scores.map((s) => (
              <li
                key={s.playerId}
                className="flex justify-between text-sm text-ink"
              >
                <span>{s.name}</span>
                <span className="font-mono text-crimson-glow">{s.score}</span>
              </li>
            ))}
          </ul>
        </GlassPanel>
      </div>
      <ChatPanel
        state={state}
        socket={socket}
        onSend={onSendChat}
        enableVoice={enableVoice}
        joinVoiceRequest={joinVoiceRequest}
        onVoiceJoined={onVoiceJoined}
      />
    </div>
  );
}
