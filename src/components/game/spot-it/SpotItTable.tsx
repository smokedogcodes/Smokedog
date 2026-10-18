"use client";

import { useEffect, useState } from "react";
import type { ChatChannel, PublicGameState } from "@/lib/types";
import { SpotItCard } from "@/components/game/spot-it/SpotItCard";
import { ChatPanel } from "@/components/game/ChatPanel";
import { GlassPanel, StatusChip } from "@/components/ui/primitives";
import type { GameSocket } from "@/lib/socket/client";
import { playBadNews, playGoodNews } from "@/lib/sounds";

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
  const [cooldown, setCooldown] = useState(false);
  const [matchSuccess, setMatchSuccess] = useState(false);

  useEffect(() => {
    if (!socket) return;
    const onReject = () => {
      setFlash(null);
      setShake(true);
      setCooldown(true);
      playBadNews();
      setTimeout(() => setShake(false), 350);
      setTimeout(() => setCooldown(false), 550);
    };
    socket.on("spotit:reject", onReject);
    return () => {
      socket.off("spotit:reject", onReject);
    };
  }, [socket]);

  if (!spot) return null;

  const pick = (symbolId: number) => {
    if (state.paused || cooldown) return;

    // Check if the symbol actually matches the center card
    const isMatch = spot.centerCard.includes(symbolId);
    if (!isMatch) {
      // Wrong pick! Lockout briefly to prevent mindless spam clicking
      playBadNews();
      setShake(true);
      setCooldown(true);
      setTimeout(() => setShake(false), 350);
      setTimeout(() => setCooldown(false), 500);
      return;
    }

    // Correct match!
    playGoodNews();
    setFlash(symbolId);
    setMatchSuccess(true);
    onMatch(symbolId);
    setTimeout(() => {
      setFlash(null);
      setMatchSuccess(false);
    }, 600);
  };

  // Sort scores descending
  const sortedScores = [...spot.scores].sort((a, b) => b.score - a.score);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        {/* Game Title & Deck Tracker */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crimson/15 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⚡</span>
              <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-crimson-glow">
                Spot It • Speed Match
              </p>
            </div>
            <h2 className="font-display text-2xl font-bold tracking-tight">
              Spot the 1 matching icon between the cards!
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {state.paused && <StatusChip tone="afk">Paused</StatusChip>}
            <div className="flex items-center gap-1.5 rounded-full border border-amber-600/40 bg-amber-500/10 px-3 py-1 font-mono text-xs font-bold text-amber-900 shadow-sm">
              <span>🃏 Deck:</span>
              <span className="text-crimson font-extrabold">{spot.deckRemaining} left</span>
            </div>
          </div>
        </div>

        {/* Cooldown / Alert Banner */}
        {cooldown && (
          <div className="rounded border border-red-500/50 bg-red-500/15 py-1.5 text-center font-mono text-xs font-bold text-red-700 animate-pulse">
            ⚠️ Incorrect match! Please wait 0.5s…
          </div>
        )}

        {matchSuccess && (
          <div className="rounded border border-emerald-500/50 bg-emerald-500/15 py-1.5 text-center font-mono text-xs font-bold text-emerald-800 animate-bounce">
            🎉 Match spotted! +1 Point!
          </div>
        )}

        {/* The Two Cards Side by Side */}
        <div
          className={`flex flex-col items-center gap-8 md:flex-row md:justify-center ${
            shake ? "animate-[shake_0.35s_ease-in-out]" : ""
          } ${state.paused ? "pointer-events-none opacity-60" : ""}`}
        >
          {/* Center Card */}
          <div className="flex flex-col items-center">
            <div className="mb-3 flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1">
              <span className="text-xs">🎯</span>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-amber-900">
                Center Target
              </p>
            </div>
            <SpotItCard
              symbols={spot.centerCard}
              size="lg"
              variant="center"
              disabled
            />
          </div>

          {/* Player Hand Card */}
          <div className="flex flex-col items-center">
            <div className="mb-3 flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1">
              <span className="text-xs">🖐️</span>
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-900">
                Your Hand (Click 1 Match)
              </p>
            </div>
            {spot.yourCard ? (
              <SpotItCard
                symbols={spot.yourCard}
                size="lg"
                variant="player"
                onPick={pick}
                flashId={flash}
                disabled={state.paused || cooldown}
              />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center rounded-full border-2 border-dashed border-ink-steel/30 bg-manila/30">
                <p className="text-xs text-ink-steel">No card in hand</p>
              </div>
            )}
          </div>
        </div>

        {/* Live Leaderboard */}
        <GlassPanel className="p-4 shadow-md">
          <div className="flex items-center justify-between border-b border-crimson/10 pb-2">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-ink-steel">
              Live Arena Leaderboard
            </p>
            <span className="font-mono text-[10px] text-ink-steel">
              Cards Claimed
            </span>
          </div>
          <ul className="mt-3 divide-y divide-crimson/5">
            {sortedScores.map((s, idx) => {
              const isYou = state.you?.id === s.playerId;
              const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`;
              return (
                <li
                  key={s.playerId}
                  className={`flex items-center justify-between py-2 text-sm transition ${
                    isYou
                      ? "font-bold text-emerald-900 bg-emerald-50/50 px-2 rounded"
                      : "text-ink"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 text-center">{medal}</span>
                    <span>{s.name}</span>
                    {isYou && (
                      <span className="rounded bg-emerald-600/20 px-1.5 py-0.2 font-mono text-[9px] uppercase text-emerald-800">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 font-mono">
                    <span className="text-base font-bold text-crimson-glow">
                      {s.score}
                    </span>
                    <span className="text-[10px] text-ink-steel">pts</span>
                  </div>
                </li>
              );
            })}
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
