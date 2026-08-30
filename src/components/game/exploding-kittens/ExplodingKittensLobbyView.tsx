"use client";

import { motion } from "framer-motion";
import { Clock, UserMinus, UserPlus } from "lucide-react";
import type { PublicGameState, RoomSettings } from "@/lib/types";
import { PrimaryButton, GlassPanel, StatusChip } from "@/components/ui/primitives";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { fadeUp, stagger } from "@/components/ui/motion";

function AutoPlayerControls({
  state,
  onAddBot,
  onRemoveBot,
}: {
  state: PublicGameState;
  onAddBot: (fillTo?: number) => void;
  onRemoveBot: () => void;
}) {
  const full = state.players.length >= 5;
  const autoCount = state.autoPlayerCount;

  return (
    <div className="mt-4 rounded-sm border border-crimson/20 bg-crimson/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
          Auto players
        </p>
        {autoCount > 0 && <StatusChip tone="bot">{autoCount} active</StatusChip>}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onAddBot()}
          disabled={full}
          className="inline-flex items-center justify-center gap-1 rounded-sm border border-crimson/20 py-2 font-mono text-[10px] uppercase tracking-widest transition hover:border-crimson/50 disabled:opacity-40"
        >
          <UserPlus size={12} /> Add one
        </button>
        <button
          type="button"
          onClick={onRemoveBot}
          disabled={autoCount === 0}
          className="inline-flex items-center justify-center gap-1 rounded-sm border border-crimson/20 py-2 font-mono text-[10px] uppercase tracking-widest transition hover:border-crimson/50 disabled:opacity-40"
        >
          <UserMinus size={12} /> Remove one
        </button>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {([2, 3, 5] as const).map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => onAddBot(target)}
            disabled={state.players.length >= target}
            className="rounded-sm border border-crimson/20 py-2 font-mono text-[10px] uppercase tracking-widest transition hover:border-crimson/50 disabled:opacity-40"
          >
            Fill {target}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ExplodingKittensLobbyView({
  state,
  onStart,
  starting = false,
  onSettings,
  onKick,
  onAddBot,
  onRemoveBot,
}: {
  state: PublicGameState;
  onStart: () => void;
  starting?: boolean;
  onSettings: (settings: Partial<RoomSettings>) => void;
  onKick: (playerId: string) => void;
  onAddBot: (fillTo?: number) => void;
  onRemoveBot: () => void;
}) {
  const you = state.you;
  const host = !!you?.isHost;
  const canStart = host && state.players.length >= 2;
  const slots = Math.max(5, state.players.length);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-crimson-glow">
          Card table
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold">Exploding Kittens</h1>
        <p className="mt-2 text-ink-steel">
          Play cards, draw carefully, and be the last player standing.
        </p>

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3"
        >
          {Array.from({ length: slots }, (_, i) => {
            const p = state.players[i];
            if (!p) {
              return (
                <motion.div key={`empty-${i}`} variants={fadeUp} className="min-w-0">
                  <GlassPanel className="flex aspect-square flex-col items-center justify-center text-ink-steel">
                    <UserPlus size={22} />
                    <span className="mt-2 font-mono text-[10px] uppercase">Awaiting</span>
                  </GlassPanel>
                </motion.div>
              );
            }
            return (
              <motion.div key={p.id} variants={fadeUp} className="min-w-0">
                <GlassPanel className="flex h-full flex-col p-3">
                  <div className="relative mx-auto aspect-square w-full max-w-[6.5rem]">
                    <PlayerAvatar id={p.avatarId} size={128} className="h-full w-full" />
                  </div>
                  <div className="mt-2 flex min-w-0 items-center justify-between gap-1">
                    <p className="min-w-0 truncate font-display text-sm font-semibold">
                      {p.name}
                    </p>
                    {p.isHost && <StatusChip>Host</StatusChip>}
                  </div>
                  <div className="mt-1 flex min-h-[1.5rem] items-center gap-1">
                    <StatusChip tone={p.connected ? "live" : "neutral"}>
                      {p.connected ? "Online" : "Away"}
                    </StatusChip>
                    {p.isBot && <StatusChip tone="bot">Auto</StatusChip>}
                  </div>
                  {host && !p.isHost ? (
                    <button
                      type="button"
                      onClick={() => onKick(p.id)}
                      className="mt-2 font-mono text-[10px] uppercase text-crimson-glow"
                    >
                      {p.isBot ? "Remove" : "Kick"}
                    </button>
                  ) : null}
                </GlassPanel>
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      <GlassPanel className="h-fit p-6">
        <h2 className="font-display text-lg font-bold">Game Settings</h2>
        {host ? (
          <>
            <div className="mt-4">
              <label className="block font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Turn timer — {state.settings.daySeconds}s
              </label>
              <div className="mt-2 flex items-center gap-2">
                <Clock size={14} className="text-ink-steel" />
                <input
                  type="range"
                  min={30}
                  max={120}
                  value={state.settings.daySeconds}
                  onChange={(e) =>
                    onSettings({ daySeconds: Number(e.target.value) })
                  }
                  className="w-full"
                />
              </div>
            </div>
            <AutoPlayerControls
              state={state}
              onAddBot={onAddBot}
              onRemoveBot={onRemoveBot}
            />
            <PrimaryButton
              className="mt-6 w-full"
              disabled={!canStart || starting}
              onClick={onStart}
            >
              {starting ? "Starting…" : "Start game"}
            </PrimaryButton>
          </>
        ) : (
          <p className="mt-4 text-sm text-ink-steel">Waiting for the host to start.</p>
        )}
      </GlassPanel>
    </div>
  );
}
