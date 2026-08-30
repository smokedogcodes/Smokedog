"use client";

import { motion } from "framer-motion";
import { Clock, Shield, UserMinus, UserPlus } from "lucide-react";
import type { PublicGameState, RoomSettings } from "@/lib/types";
import { PrimaryButton, GlassPanel, StatusChip } from "@/components/ui/primitives";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { fadeUp, stagger } from "@/components/ui/motion";

export function BoardLobbyView({
  state,
  title,
  blurb,
  maxPlayers = 2,
  onStart,
  starting = false,
  onKick,
  onAddBot,
  onRemoveBot,
  onSettings,
}: {
  state: PublicGameState;
  title: string;
  blurb: string;
  maxPlayers?: number;
  onStart: () => void;
  starting?: boolean;
  onKick: (id: string) => void;
  onAddBot: (fillTo?: number) => void;
  onRemoveBot: () => void;
  onSettings?: (settings: Partial<RoomSettings>) => void;
}) {
  const host = !!state.you?.isHost;
  const full = state.players.length >= maxPlayers;
  const canStart = state.players.length >= 2 && state.players.length <= maxPlayers;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-3xl"
    >
      <motion.div variants={fadeUp}>
        <p className="font-mono text-xs uppercase tracking-[0.22em] text-crimson-glow">
          Lobby
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold">{title}</h1>
        <p className="mt-2 text-ink-steel">{blurb}</p>
      </motion.div>

      <motion.div
        variants={fadeUp}
        className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-2"
      >
        {Array.from({ length: maxPlayers }).map((_, i) => {
          const p = state.players[i];
          if (!p) {
            return (
              <GlassPanel
                key={`empty-${i}`}
                className="flex min-h-[140px] flex-col items-center justify-center p-4 text-ink-steel"
              >
                <UserPlus size={22} />
                <span className="mt-2 font-mono text-[10px] uppercase">
                  Seat {i + 1}
                </span>
              </GlassPanel>
            );
          }
          return (
            <GlassPanel key={p.id} className="flex flex-col p-3">
              <div className="relative mx-auto aspect-square w-full max-w-[5.5rem] bg-transparent">
                <PlayerAvatar id={p.avatarId} size={96} className="h-full w-full" />
              </div>
              <p className="mt-2 truncate text-center font-display text-sm font-semibold">
                {p.name}
              </p>
              <div className="mt-1 flex justify-center gap-1">
                {p.isHost && <StatusChip>Host</StatusChip>}
                {p.isBot ? (
                  <StatusChip tone="bot">Auto</StatusChip>
                ) : (
                  <StatusChip tone={p.connected ? "live" : "neutral"}>
                    {p.connected ? "Online" : "Away"}
                  </StatusChip>
                )}
              </div>
              {host && !p.isHost && (
                <button
                  type="button"
                  onClick={() => onKick(p.id)}
                  className="mt-2 font-mono text-[10px] uppercase text-crimson-glow"
                >
                  {p.isBot ? "Remove" : "Kick"}
                </button>
              )}
            </GlassPanel>
          );
        })}
      </motion.div>

      {host && (
        <motion.div variants={fadeUp} className="mt-6 space-y-4">
          <div className="rounded-sm border border-crimson/20 bg-crimson/[0.04] p-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
              Auto players
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onAddBot()}
                disabled={full}
                className="inline-flex items-center justify-center gap-1 rounded-sm border border-crimson/20 py-2 font-mono text-[10px] uppercase tracking-widest disabled:opacity-40"
              >
                <UserPlus size={12} /> Add bot
              </button>
              <button
                type="button"
                onClick={onRemoveBot}
                disabled={state.autoPlayerCount === 0}
                className="inline-flex items-center justify-center gap-1 rounded-sm border border-crimson/20 py-2 font-mono text-[10px] uppercase tracking-widest disabled:opacity-40"
              >
                <UserMinus size={12} /> Remove bot
              </button>
            </div>
          </div>
          {onSettings && (
            <label className="flex items-center justify-between gap-3 rounded-sm border border-crimson/20 bg-crimson/[0.04] px-4 py-3">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                <Clock size={12} /> Turn seconds
              </span>
              <input
                type="number"
                min={10}
                max={60}
                value={state.settings.daySeconds}
                onChange={(e) =>
                  onSettings({
                    daySeconds: Math.min(
                      60,
                      Math.max(10, Number(e.target.value) || 15)
                    ),
                  })
                }
                className="w-20 rounded-sm border border-crimson/20 bg-manila px-2 py-1 font-mono text-sm text-crimson"
              />
            </label>
          )}
          <PrimaryButton
            disabled={!canStart || starting}
            loading={starting}
            onClick={onStart}
            className="w-full"
          >
            <Shield size={14} /> Start match
          </PrimaryButton>
        </motion.div>
      )}
    </motion.div>
  );
}
