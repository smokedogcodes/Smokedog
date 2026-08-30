"use client";

import {
  BookOpen,
  Copy,
  LogOut,
  Menu,
  Pause,
  Play,
  Shield,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CopyToast } from "@/components/ui/CopyToast";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import type { Phase, PublicGameState } from "@/lib/types";
import { MidGameSettings } from "@/components/game/mafia/MidGameSettings";

function format(seconds: number) {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function GameHud({
  state,
  onPause,
  onResume,
  onQuit,
  onSettings,
  quitting = false,
  knowGame = false,
  onKnowGameChange,
}: {
  state: PublicGameState;
  onPause: () => void;
  onResume: () => void;
  onQuit: () => void;
  onSettings?: (settings: Partial<import("@/lib/types").RoomSettings>) => void;
  quitting?: boolean;
  knowGame?: boolean;
  onKnowGameChange?: (value: boolean) => void;
}) {
  const [now, setNow] = useState(Date.now());
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const remaining = state.phaseEndsAt
    ? Math.ceil((state.phaseEndsAt - now) / 1000)
    : 0;

  const phaseLabel: Record<Phase, string> = {
    lobby: "LOBBY",
    reveal: "REVEAL",
    night: `NIGHT ${state.cycle}`,
    day:
      state.daySubPhase === "vote"
        ? `VOTE ${state.cycle}`
        : `DAY ${state.cycle}`,
    fivealive_turn: `TURN ${state.cycle}`,
    fivealive_bomb: "BOMB RESOLUTION",
    fivealive_dealing: "DEALING",
    ek_turn: `TURN ${state.cycle}`,
    ek_defuse: "DEFUSE",
    ek_pick_discard: "PICK DISCARD",
    ek_steal: "STEAL",
    ek_favor: "FAVOR",
    ek_triple: "TRIPLE",
    spotit_play: "SPOT IT",
    ttt_play: "TIC-TAC-TOE",
    connect4_play: "CONNECT 4",
    battleship_setup: "SETUP",
    battleship_play: "BATTLESHIP",
    gameover: "DEBRIEF",
  };

  const { copy, copied } = useCopyToClipboard();
  const showMidGameSettings =
    (state.gameId === "mafia-city" || state.gameId === "five-alive") &&
    state.you?.isHost &&
    onSettings &&
    state.phase !== "lobby" &&
    state.phase !== "gameover";

  const showTimer =
    state.phase !== "lobby" &&
    state.phase !== "gameover" &&
    state.gameId !== "spot-it" &&
    (!!state.phaseEndsAt || state.paused);

  const showPause =
    !!state.you?.isHost &&
    state.phase !== "lobby" &&
    state.phase !== "gameover";

  const urgent =
    remaining <= 10 && !state.paused && !!state.phaseEndsAt;

  const timerClass = `inline-flex min-w-[4.75rem] shrink-0 items-center justify-center rounded-sm border bg-surface/80 px-2.5 py-1.5 font-mono text-sm tabular-nums tracking-normal sm:min-w-[5.25rem] sm:px-3 sm:py-2 sm:text-sm ${
    urgent
      ? "animate-pulse border-crimson text-crimson"
      : "border-crimson/20 text-crimson"
  }`;

  const menuItemClass =
    "flex w-full items-center gap-2 rounded-sm border border-crimson/20 bg-manila px-3 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-crimson transition hover:border-crimson/40 hover:bg-crimson/[0.04] disabled:opacity-50";

  const showKnowGameToggle =
    !!onKnowGameChange &&
    state.gameId === "five-alive" &&
    state.phase !== "lobby" &&
    state.phase !== "gameover";

  const knowGameToggleClass = knowGame
    ? "border-crimson/60 bg-crimson/10 text-crimson"
    : "border-crimson/20 text-crimson/70 hover:border-crimson/40 hover:text-crimson";

  return (
    <>
      <CopyToast show={copied} message="Room code copied" />

      {/* Mobile: timer + overflow menu */}
      <div className="relative flex items-center justify-end gap-2 md:hidden" ref={menuRef}>
        {showTimer && (
          <div className={timerClass} aria-live="polite">
            {state.paused ? "PAUSE" : format(remaining)}
          </div>
        )}
        {state.gameId === "spot-it" && state.paused && (
          <div className={timerClass}>PAUSE</div>
        )}
        <button
          type="button"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((v) => !v)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border border-crimson/30 bg-manila text-crimson"
        >
          {menuOpen ? <X size={16} /> : <Menu size={16} />}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full z-40 mt-2 w-[min(18rem,calc(100vw-2rem))] rounded-sm border-2 border-crimson bg-manila p-2 shadow-stamp">
            <p className="px-2 pb-2 font-mono text-[9px] uppercase tracking-[0.18em] text-crimson/60">
              {phaseLabel[state.phase]}
            </p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                onClick={() => {
                  copy(state.roomId);
                }}
                className={menuItemClass}
              >
                <Copy size={12} />
                Code {state.roomId}
              </button>
              {showMidGameSettings && (
                <div className="rounded-sm border border-crimson/20 p-1">
                  <MidGameSettings
                    settings={state.settings}
                    onUpdate={onSettings}
                    gameId={state.gameId}
                  />
                </div>
              )}
              {showKnowGameToggle && (
                <button
                  type="button"
                  role="switch"
                  aria-checked={knowGame}
                  onClick={() => onKnowGameChange?.(!knowGame)}
                  className={menuItemClass}
                >
                  <BookOpen size={12} />
                  {knowGame ? "Know game — on" : "Know game — off"}
                </button>
              )}
              {showPause && (
                <button
                  type="button"
                  onClick={() => {
                    if (state.paused) onResume();
                    else onPause();
                    setMenuOpen(false);
                  }}
                  className={menuItemClass}
                >
                  {state.paused ? <Play size={12} /> : <Pause size={12} />}
                  {state.paused ? "Resume" : "Pause"}
                </button>
              )}
              {state.you?.isHost && (
                <div className="flex items-center gap-2 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-crimson/70">
                  <Shield size={12} /> Host
                </div>
              )}
              <button
                type="button"
                disabled={quitting}
                onClick={() => {
                  setMenuOpen(false);
                  onQuit();
                }}
                className={menuItemClass}
              >
                <LogOut size={12} />
                {quitting ? "Leaving…" : "Quit"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Desktop: full toolbar */}
      <div className="hidden w-full min-w-0 flex-wrap items-center justify-end gap-1.5 md:flex md:gap-3">
        <button
          type="button"
          onClick={() => copy(state.roomId)}
          className="inline-flex shrink-0 items-center gap-2 rounded-sm border border-crimson/20 bg-surface/80 px-3 py-2 font-mono text-xs tracking-[0.2em]"
        >
          {state.roomId} <Copy size={12} />
        </button>
        {showTimer && (
          <div className={timerClass} aria-live="polite">
            {state.paused ? "PAUSED" : format(remaining)}
          </div>
        )}
        {state.gameId === "spot-it" && state.paused && (
          <div className={timerClass}>PAUSED</div>
        )}
        <div className="shrink-0 rounded-sm border border-crimson/20 bg-surface/80 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em]">
          {phaseLabel[state.phase]}
        </div>
        {showMidGameSettings && (
          <MidGameSettings
            settings={state.settings}
            onUpdate={onSettings}
            gameId={state.gameId}
          />
        )}
        {showKnowGameToggle && (
          <button
            type="button"
            role="switch"
            aria-checked={knowGame}
            aria-label={
              knowGame
                ? "I know this game — popups hidden"
                : "I know this game — show popups"
            }
            title={
              knowGame
                ? "Popups hidden — game runs normally"
                : "Hide phase result and action popups"
            }
            onClick={() => onKnowGameChange?.(!knowGame)}
            className={`inline-flex shrink-0 items-center gap-1 rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-widest transition ${knowGameToggleClass}`}
          >
            <BookOpen size={12} />
            Know game
          </button>
        )}
        {showPause && (
          <button
            type="button"
            onClick={state.paused ? onResume : onPause}
            className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-crimson/40 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-crimson"
          >
            {state.paused ? <Play size={12} /> : <Pause size={12} />}
            {state.paused ? "Resume" : "Pause"}
          </button>
        )}
        {state.you?.isHost && (
          <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-crimson/70">
            <Shield size={12} /> Host
          </span>
        )}
        <button
          type="button"
          disabled={quitting}
          onClick={onQuit}
          className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-crimson/20 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-crimson/80 transition hover:border-crimson/40 hover:text-crimson disabled:opacity-50"
        >
          <LogOut size={12} />
          {quitting ? "Leaving…" : "Quit"}
        </button>
      </div>
    </>
  );
}
