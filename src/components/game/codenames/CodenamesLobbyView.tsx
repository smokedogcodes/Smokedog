"use client";

import { motion } from "framer-motion";
import { Clock, Dna, Play, Shuffle, Sparkles, UserCheck, Users } from "lucide-react";
import type { CodenamesRole, CodenamesTeam, PublicGameState, RoomSettings } from "@/lib/types";
import { PrimaryButton, GlassPanel } from "@/components/ui/primitives";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { fadeUp, stagger } from "@/components/ui/motion";

export function CodenamesLobbyView({
  state,
  onStart,
  starting = false,
  onSetRole,
  onRandomizeTeams,
  onSettings,
}: {
  state: PublicGameState;
  onStart: () => void;
  starting?: boolean;
  onSetRole: (team: CodenamesTeam, role: CodenamesRole) => void;
  onRandomizeTeams: () => void;
  onSettings?: (settings: Partial<RoomSettings>) => void;
}) {
  const host = !!state.you?.isHost;
  const players = state.players;
  const cnState = state.codenames;

  // Retrieve current team assignments
  const redSpymasterId = cnState?.teams.red.spymasterId;
  const redOperativeIds = cnState?.teams.red.operativeIds ?? [];
  const blueSpymasterId = cnState?.teams.blue.spymasterId;
  const blueOperativeIds = cnState?.teams.blue.operativeIds ?? [];

  const getPlayer = (id: string | null | undefined) =>
    players.find((p) => p.id === id);

  const yourId = state.you?.id;
  const isYourRole = (team: CodenamesTeam, role: CodenamesRole) => {
    if (role === "spymaster") {
      return (team === "red" ? redSpymasterId : blueSpymasterId) === yourId;
    }
    return (team === "red" ? redOperativeIds : blueOperativeIds).includes(yourId ?? "");
  };

  const clueSeconds = state.settings?.codenamesClueSeconds ?? 60;
  const guessSeconds = state.settings?.codenamesGuessSeconds ?? 90;

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-4xl px-2 sm:px-4"
    >
      {/* Header */}
      <motion.div variants={fadeUp} className="text-center">
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-crimson-glow">
          Spymasters vs Operatives
        </p>
        <h1 className="mt-2 font-display text-4xl sm:text-5xl font-black tracking-tight text-white">
          CODENAMES
        </h1>
        <p className="mt-2 text-sm sm:text-base text-ink-steel max-w-lg mx-auto">
          Two rival spymasters know the secret identities of 25 agents. Can your team decode the one-word clues and contact all friendly agents before the assassin strikes?
        </p>
      </motion.div>

      {/* Team Selection Arena */}
      <motion.div variants={fadeUp} className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Red Team Column */}
        <div className="rounded-2xl border-2 border-red-500/30 bg-red-950/20 p-5 backdrop-blur-md shadow-lg shadow-red-950/20">
          <div className="flex items-center justify-between border-b border-red-500/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-red-500 animate-pulse" />
              <h2 className="font-display text-xl font-bold tracking-wider text-red-400">
                RED TEAM
              </h2>
            </div>
            <span className="text-xs font-mono text-red-300/70">
              {(redSpymasterId ? 1 : 0) + redOperativeIds.length} Agents
            </span>
          </div>

          {/* Red Spymaster Slot */}
          <div className="mt-4">
            <span className="text-xs font-mono uppercase tracking-wider text-red-300/80">
              Spymaster (1 Player)
            </span>
            <div className="mt-1.5">
              {redSpymasterId ? (
                <div className="flex items-center justify-between rounded-xl border border-red-500/40 bg-red-900/30 p-2.5">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar
                      id={getPlayer(redSpymasterId)?.avatarId ?? 0}
                      size={36}
                    />
                    <div>
                      <p className="font-bold text-sm text-red-100">
                        {getPlayer(redSpymasterId)?.name}
                        {redSpymasterId === yourId && " (You)"}
                      </p>
                      <p className="text-[10px] font-mono text-red-400/80">Views Secret Keycard</p>
                    </div>
                  </div>
                  {redSpymasterId === yourId ? (
                    <span className="rounded-md bg-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-300">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => onSetRole("red", "spymaster")}
                      className="rounded-lg border border-red-500/30 bg-red-950/60 px-2.5 py-1 text-xs font-medium text-red-200 hover:bg-red-900/60 transition"
                    >
                      Switch
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => onSetRole("red", "spymaster")}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-red-500/40 bg-red-950/10 py-3 text-xs font-semibold text-red-300 hover:bg-red-900/20 hover:border-red-400 transition"
                >
                  <UserCheck className="h-4 w-4" /> Become Red Spymaster
                </button>
              )}
            </div>
          </div>

          {/* Red Operatives Slot */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-red-300/80">
                Field Operatives
              </span>
              {!isYourRole("red", "operative") && (
                <button
                  onClick={() => onSetRole("red", "operative")}
                  className="text-xs font-semibold text-red-400 hover:text-red-300 hover:underline"
                >
                  + Join Operatives
                </button>
              )}
            </div>
            <div className="mt-2 space-y-2 min-h-[90px]">
              {redOperativeIds.length === 0 ? (
                <p className="py-6 text-center text-xs text-red-400/40 italic">
                  No operatives yet. Guessers join here.
                </p>
              ) : (
                redOperativeIds.map((id) => {
                  const p = getPlayer(id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-950/40 p-2"
                    >
                      <PlayerAvatar
                        id={p?.avatarId ?? 0}
                        size={28}
                      />
                      <span className="text-xs font-medium text-red-100">
                        {p?.name}
                        {id === yourId && " (You)"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Blue Team Column */}
        <div className="rounded-2xl border-2 border-blue-500/30 bg-blue-950/20 p-5 backdrop-blur-md shadow-lg shadow-blue-950/20">
          <div className="flex items-center justify-between border-b border-blue-500/20 pb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 rounded-full bg-blue-500 animate-pulse" />
              <h2 className="font-display text-xl font-bold tracking-wider text-blue-400">
                BLUE TEAM
              </h2>
            </div>
            <span className="text-xs font-mono text-blue-300/70">
              {(blueSpymasterId ? 1 : 0) + blueOperativeIds.length} Agents
            </span>
          </div>

          {/* Blue Spymaster Slot */}
          <div className="mt-4">
            <span className="text-xs font-mono uppercase tracking-wider text-blue-300/80">
              Spymaster (1 Player)
            </span>
            <div className="mt-1.5">
              {blueSpymasterId ? (
                <div className="flex items-center justify-between rounded-xl border border-blue-500/40 bg-blue-900/30 p-2.5">
                  <div className="flex items-center gap-3">
                    <PlayerAvatar
                      id={getPlayer(blueSpymasterId)?.avatarId ?? 0}
                      size={36}
                    />
                    <div>
                      <p className="font-bold text-sm text-blue-100">
                        {getPlayer(blueSpymasterId)?.name}
                        {blueSpymasterId === yourId && " (You)"}
                      </p>
                      <p className="text-[10px] font-mono text-blue-400/80">Views Secret Keycard</p>
                    </div>
                  </div>
                  {blueSpymasterId === yourId ? (
                    <span className="rounded-md bg-blue-500/20 px-2 py-0.5 text-[10px] font-bold text-blue-300">
                      Active
                    </span>
                  ) : (
                    <button
                      onClick={() => onSetRole("blue", "spymaster")}
                      className="rounded-lg border border-blue-500/30 bg-blue-950/60 px-2.5 py-1 text-xs font-medium text-blue-200 hover:bg-blue-900/60 transition"
                    >
                      Switch
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => onSetRole("blue", "spymaster")}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-blue-500/40 bg-blue-950/10 py-3 text-xs font-semibold text-blue-300 hover:bg-blue-900/20 hover:border-blue-400 transition"
                >
                  <UserCheck className="h-4 w-4" /> Become Blue Spymaster
                </button>
              )}
            </div>
          </div>

          {/* Blue Operatives Slot */}
          <div className="mt-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-wider text-blue-300/80">
                Field Operatives
              </span>
              {!isYourRole("blue", "operative") && (
                <button
                  onClick={() => onSetRole("blue", "operative")}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 hover:underline"
                >
                  + Join Operatives
                </button>
              )}
            </div>
            <div className="mt-2 space-y-2 min-h-[90px]">
              {blueOperativeIds.length === 0 ? (
                <p className="py-6 text-center text-xs text-blue-400/40 italic">
                  No operatives yet. Guessers join here.
                </p>
              ) : (
                blueOperativeIds.map((id) => {
                  const p = getPlayer(id);
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-3 rounded-lg border border-blue-500/20 bg-blue-950/40 p-2"
                    >
                      <PlayerAvatar
                        id={p?.avatarId ?? 0}
                        size={28}
                      />
                      <span className="text-xs font-medium text-blue-100">
                        {p?.name}
                        {id === yourId && " (You)"}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Host Controls & Timer Options */}
      <motion.div variants={fadeUp} className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/40 p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Quick Team Balance */}
          <button
            onClick={onRandomizeTeams}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-white hover:bg-white/10 transition"
          >
            <Shuffle className="h-3.5 w-3.5 text-amber-400" />
            Randomize / Auto-Balance Teams
          </button>

          {/* Timer Settings (Host Only) */}
          {host && onSettings && (
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-ink-steel">
                <Clock className="h-3.5 w-3.5" /> Clue Timer:
              </span>
              <select
                value={clueSeconds}
                onChange={(e) => onSettings({ codenamesClueSeconds: Number(e.target.value) })}
                className="rounded border border-white/10 bg-stone-900 px-2 py-1 text-xs text-white"
              >
                <option value={45}>45s</option>
                <option value={60}>60s</option>
                <option value={90}>90s</option>
                <option value={120}>120s</option>
              </select>

              <span className="flex items-center gap-1 text-ink-steel ml-2">
                Guess Timer:
              </span>
              <select
                value={guessSeconds}
                onChange={(e) => onSettings({ codenamesGuessSeconds: Number(e.target.value) })}
                className="rounded border border-white/10 bg-stone-900 px-2 py-1 text-xs text-white"
              >
                <option value={60}>60s</option>
                <option value={90}>90s</option>
                <option value={120}>120s</option>
              </select>
            </div>
          )}
        </div>

        {/* Start Game Button */}
        <div>
          {host ? (
            <PrimaryButton
              onClick={onStart}
              disabled={starting || players.length < 2}
              className="px-6 py-2.5 font-bold"
            >
              {starting ? (
                "Dealing Board..."
              ) : players.length < 2 ? (
                "Waiting for Players (Min 2)"
              ) : (
                <span className="flex items-center gap-2">
                  <Play className="h-4 w-4 fill-current" /> Start Match
                </span>
              )}
            </PrimaryButton>
          ) : (
            <div className="flex items-center gap-2 text-xs text-ink-steel font-mono">
              <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              Waiting for host to start...
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
