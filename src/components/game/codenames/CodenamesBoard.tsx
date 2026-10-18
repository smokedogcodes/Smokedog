"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  HelpCircle,
  LogOut,
  Send,
  Shield,
  Skull,
  User,
  Users,
} from "lucide-react";
import type {
  CodenamesCardType,
  CodenamesPublicCard,
  CodenamesPublicState,
  CodenamesTeam,
  PublicGameState,
} from "@/lib/types";
import { PrimaryButton } from "@/components/ui/primitives";
import confetti from "canvas-confetti";

export function CodenamesBoard({
  state,
  onGiveClue,
  onGuess,
  onEndTurn,
  onReturnToLobby,
}: {
  state: PublicGameState;
  onGiveClue: (word: string, number: number) => void;
  onGuess: (cardIndex: number) => void;
  onEndTurn: () => void;
  onReturnToLobby: () => void;
}) {
  const cn = state.codenames;
  const youId = state.you?.id;
  const isHost = !!state.you?.isHost;

  const [clueWord, setClueWord] = useState("");
  const [clueNumber, setClueNumber] = useState<number>(1);
  const [clueError, setClueError] = useState<string | null>(null);

  if (!cn) {
    return (
      <div className="py-20 text-center text-ink-steel">
        Initializing Codenames arena...
      </div>
    );
  }

  // Identify roles
  const isRedSpymaster = cn.teams.red.spymasterId === youId;
  const isBlueSpymaster = cn.teams.blue.spymasterId === youId;
  const isSpymaster = isRedSpymaster || isBlueSpymaster;

  const isRedOperative = cn.teams.red.operativeIds.includes(youId ?? "");
  const isBlueOperative = cn.teams.blue.operativeIds.includes(youId ?? "");

  const yourTeam: CodenamesTeam | null =
    isRedSpymaster || isRedOperative ? "red" : isBlueSpymaster || isBlueOperative ? "blue" : null;

  const isYourTurn = yourTeam === cn.currentTurn;
  const canGiveClue =
    isYourTurn && isSpymaster && cn.turnSubPhase === "clue" && cn.winner == null;
  const canGuess =
    isYourTurn &&
    !isSpymaster &&
    cn.turnSubPhase === "guess" &&
    cn.winner == null &&
    cn.guessesRemaining > 0;

  // Handle Clue Submission
  const handleSubmitClue = (e: React.FormEvent) => {
    e.preventDefault();
    setClueError(null);
    const trimmed = clueWord.trim().toUpperCase();

    if (!trimmed) {
      setClueError("Please enter a clue word.");
      return;
    }
    if (/\s/.test(trimmed)) {
      setClueError("Clue must be a single word (no spaces).");
      return;
    }
    if (trimmed.length < 2) {
      setClueError("Clue must be at least 2 letters.");
      return;
    }

    onGiveClue(trimmed, clueNumber);
    setClueWord("");
  };

  // Card appearance helper
  const getCardStyle = (card: CodenamesPublicCard) => {
    if (card.revealed) {
      switch (card.type) {
        case "red":
          return "bg-gradient-to-br from-red-600 to-rose-900 border-red-400 text-white shadow-md shadow-red-900/50";
        case "blue":
          return "bg-gradient-to-br from-blue-600 to-cyan-900 border-blue-400 text-white shadow-md shadow-blue-900/50";
        case "neutral":
          return "bg-stone-800/90 border-stone-600 text-stone-400 opacity-60";
        case "assassin":
          return "bg-gradient-to-br from-black via-zinc-900 to-stone-950 border-red-600 text-red-500 shadow-xl shadow-red-950/80 animate-pulse";
        default:
          return "bg-stone-800 border-stone-600 text-stone-300";
      }
    }

    // Unrevealed Card
    // Spymaster view overlay (subtle tinting so Spymaster knows identity)
    if (isSpymaster && card.type) {
      switch (card.type) {
        case "red":
          return "bg-stone-900/90 border-red-500/80 text-red-100 hover:border-red-400 shadow-sm shadow-red-500/20";
        case "blue":
          return "bg-stone-900/90 border-blue-500/80 text-blue-100 hover:border-blue-400 shadow-sm shadow-blue-500/20";
        case "neutral":
          return "bg-stone-900/90 border-amber-500/30 text-amber-100/70";
        case "assassin":
          return "bg-zinc-950 border-black ring-1 ring-red-500 text-red-400";
      }
    }

    // Regular operative unrevealed card
    return "bg-stone-900/80 border-white/10 text-stone-200 hover:border-amber-400/60 hover:bg-stone-800/90 shadow-sm";
  };

  return (
    <div className="mx-auto max-w-5xl px-2 sm:px-4 pb-8">
      {/* Top Status Bar: Scores and Turn Indicator */}
      <div className="grid grid-cols-3 items-center gap-2 rounded-2xl border border-white/10 bg-black/60 p-3 sm:p-4 backdrop-blur-md">
        {/* Red Score */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-800 font-display text-xl sm:text-2xl font-black text-white shadow-lg shadow-red-900/40">
            {cn.redScore}
          </div>
          <div>
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-red-400">
              Red Team
            </p>
            <p className="text-[10px] text-ink-steel hidden sm:block">
              {cn.redTotal - cn.redScore} of {cn.redTotal} Found
            </p>
          </div>
        </div>

        {/* Center: Active Phase Banner */}
        <div className="text-center">
          {cn.winner ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 border border-amber-500/40">
              <Sparkles className="h-4 w-4 text-amber-400 animate-spin" />
              <span className="font-display text-sm font-bold uppercase tracking-wider text-amber-300">
                Match Finished
              </span>
            </div>
          ) : (
            <div>
              <div className="inline-flex items-center gap-2">
                <span
                  className={`h-2.5 w-2.5 rounded-full animate-ping ${
                    cn.currentTurn === "red" ? "bg-red-500" : "bg-blue-500"
                  }`}
                />
                <span
                  className={`font-display text-sm sm:text-base font-extrabold uppercase tracking-wide ${
                    cn.currentTurn === "red" ? "text-red-400" : "text-blue-400"
                  }`}
                >
                  {cn.currentTurn} Turn •{" "}
                  {cn.turnSubPhase === "clue" ? "Spymaster Clue" : "Operatives Guessing"}
                </span>
              </div>

              {/* Time Remaining Bar */}
              {state.phaseEndsAt && (
                <div className="mt-1 flex items-center justify-center gap-1.5 text-xs font-mono text-ink-steel">
                  <Clock className="h-3.5 w-3.5" />
                  <span>
                    {Math.max(0, Math.round((state.phaseEndsAt - Date.now()) / 1000))}s remaining
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Blue Score */}
        <div className="flex items-center justify-end gap-3">
          <div className="text-right">
            <p className="text-xs font-mono font-bold uppercase tracking-wider text-blue-400">
              Blue Team
            </p>
            <p className="text-[10px] text-ink-steel hidden sm:block">
              {cn.blueTotal - cn.blueScore} of {cn.blueTotal} Found
            </p>
          </div>
          <div className="flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-800 font-display text-xl sm:text-2xl font-black text-white shadow-lg shadow-blue-900/40">
            {cn.blueScore}
          </div>
        </div>
      </div>

      {/* Clue Announcement Bar */}
      {cn.currentClue && cn.turnSubPhase === "guess" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
              <Eye className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-amber-400/80">
                Active Clue
              </p>
              <p className="font-display text-lg sm:text-xl font-black text-amber-200">
                &ldquo;{cn.currentClue.word}&rdquo; — {cn.currentClue.number}{" "}
                <span className="text-xs font-normal text-amber-300/70">
                  ({cn.guessesRemaining} guesses remaining)
                </span>
              </p>
            </div>
          </div>

          {canGuess && (
            <button
              onClick={onEndTurn}
              className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/20 transition"
            >
              End Turn
            </button>
          )}
        </motion.div>
      )}

      {/* Spymaster Keycard Banner Indicator */}
      {isSpymaster && (
        <div className="mt-3 flex items-center justify-between px-2 text-xs font-mono text-ink-steel">
          <span className="flex items-center gap-1.5 text-amber-400">
            <Shield className="h-3.5 w-3.5" /> Spymaster Secret Keycard Overlay Active
          </span>
          <span className="text-[11px] text-stone-400 hidden sm:inline">
            Red / Blue = Agents • Beige = Bystander • Skull = Assassin
          </span>
        </div>
      )}

      {/* 5x5 Grid of 25 Cards */}
      <div className="mt-4 grid grid-cols-5 gap-2 sm:gap-3">
        {cn.cards.map((card, idx) => {
          const isClickable = canGuess && !card.revealed;

          return (
            <motion.div
              key={card.id}
              whileHover={isClickable ? { scale: 1.03, y: -2 } : undefined}
              whileTap={isClickable ? { scale: 0.97 } : undefined}
              onClick={() => isClickable && onGuess(idx)}
              className={`relative flex h-16 sm:h-24 md:h-28 flex-col items-center justify-center rounded-xl border p-1 sm:p-2 text-center transition-all select-none ${getCardStyle(
                card
              )} ${isClickable ? "cursor-pointer" : "cursor-default"}`}
            >
              {/* Spymaster indicator badge for unrevealed card */}
              {isSpymaster && !card.revealed && card.type && (
                <div className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5">
                  {card.type === "red" && (
                    <span className="flex h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-red-500 shadow-sm shadow-red-500" />
                  )}
                  {card.type === "blue" && (
                    <span className="flex h-2.5 w-2.5 sm:h-3 sm:w-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500" />
                  )}
                  {card.type === "assassin" && (
                    <Skull className="h-3 w-3 sm:h-4 sm:w-4 text-red-500 fill-current animate-pulse" />
                  )}
                </div>
              )}

              {/* Word on Card */}
              <span
                className={`font-display text-xs sm:text-base md:text-lg font-black tracking-wider break-words ${
                  card.revealed && card.type === "neutral" ? "line-through opacity-50" : ""
                }`}
              >
                {card.word}
              </span>

              {/* Revealed Status Icon */}
              {card.revealed && (
                <div className="mt-0.5 sm:mt-1">
                  {card.type === "assassin" ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-red-400">
                      <Skull className="h-3 w-3 sm:h-4 sm:w-4" /> ASSASSIN
                    </span>
                  ) : card.type === "neutral" ? (
                    <span className="text-[10px] font-mono text-stone-400 uppercase">Civilian</span>
                  ) : (
                    <span className="text-[10px] font-mono text-white/90 uppercase font-bold tracking-wider">
                      {card.type} Agent
                    </span>
                  )}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Spymaster Input Controls */}
      {canGiveClue && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-2xl border-2 border-amber-500/40 bg-black/80 p-4 sm:p-6 backdrop-blur-xl shadow-2xl"
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <h3 className="font-display text-base sm:text-lg font-bold text-amber-300 flex items-center gap-2">
              <Send className="h-4 w-4" /> Give Clue as {cn.currentTurn.toUpperCase()} Spymaster
            </h3>
            <span className="text-xs font-mono text-ink-steel">
              1 word + number of matching cards
            </span>
          </div>

          <form onSubmit={handleSubmitClue} className="mt-4 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[180px]">
              <input
                type="text"
                placeholder="CLUE WORD (e.g. RIVER)"
                value={clueWord}
                onChange={(e) => setClueWord(e.target.value.toUpperCase().replace(/\s/g, ""))}
                className="w-full rounded-xl border border-white/20 bg-stone-900/90 px-4 py-2.5 font-display text-base font-bold text-white tracking-wider placeholder:text-stone-600 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="w-24">
              <select
                value={clueNumber}
                onChange={(e) => setClueNumber(Number(e.target.value))}
                className="w-full rounded-xl border border-white/20 bg-stone-900/90 px-3 py-2.5 font-display text-base font-bold text-white focus:border-amber-400 focus:outline-none"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                  <option key={num} value={num}>
                    {num === 0 ? "0 (∞)" : num}
                  </option>
                ))}
              </select>
            </div>

            <PrimaryButton type="submit" className="px-6 py-2.5 font-bold">
              Submit Clue
            </PrimaryButton>
          </form>

          {clueError && (
            <p className="mt-2 text-xs font-medium text-red-400 flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {clueError}
            </p>
          )}
        </motion.div>
      )}

      {/* Operatives Guess Instructions */}
      {canGuess && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-black/40 p-3 sm:p-4">
          <p className="text-xs sm:text-sm text-stone-200">
            👉 <strong>Your turn to guess!</strong> Click cards on the board that match the clue.
          </p>
          <button
            onClick={onEndTurn}
            className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/20 transition"
          >
            End Turn
          </button>
        </div>
      )}

      {/* Game Over Banner */}
      {cn.winner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mt-6 rounded-2xl border-2 p-6 text-center backdrop-blur-xl ${
            cn.winner === "red"
              ? "border-red-500/60 bg-red-950/40 shadow-2xl shadow-red-950/80"
              : "border-blue-500/60 bg-blue-950/40 shadow-2xl shadow-blue-950/80"
          }`}
        >
          <h2
            className={`font-display text-3xl sm:text-5xl font-black uppercase tracking-tight ${
              cn.winner === "red" ? "text-red-400" : "text-blue-400"
            }`}
          >
            {cn.winner} TEAM WINS!
          </h2>
          <p className="mt-2 text-sm sm:text-base text-stone-300">
            {cn.winReason === "assassin"
              ? "The opposing team contacted the ASSASSIN!"
              : "All secret agents identified successfully!"}
          </p>

          <div className="mt-6 flex justify-center gap-4">
            {isHost && (
              <PrimaryButton onClick={onReturnToLobby} className="px-6 py-2.5 font-bold">
                Return to Lobby
              </PrimaryButton>
            )}
          </div>
        </motion.div>
      )}

      {/* Match Activity Log */}
      {cn.log.length > 0 && (
        <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-3">
          <p className="text-[10px] font-mono uppercase tracking-wider text-ink-steel pb-2 border-b border-white/5">
            Mission Chronicle
          </p>
          <div className="mt-2 max-h-32 overflow-y-auto space-y-1 text-xs">
            {cn.log.slice(-6).reverse().map((entry, idx) => (
              <p
                key={idx}
                className={`font-mono text-[11px] ${
                  entry.team === "red"
                    ? "text-red-300/80"
                    : entry.team === "blue"
                    ? "text-blue-300/80"
                    : "text-stone-400"
                }`}
              >
                • {entry.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Sparkles(props: any) {
  return <Flame {...props} />;
}
