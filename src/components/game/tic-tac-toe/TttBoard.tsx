"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import type { PublicGameState } from "@/lib/types";
import { TurnIndicator } from "@/components/game/board/TurnIndicator";
import { ChatPanel } from "@/components/game/ChatPanel";
import type { GameSocket } from "@/lib/socket/client";
import type { ChatChannel } from "@/lib/types";

function MarkSvg({
  mark,
  ghost,
}: {
  mark: "X" | "O";
  ghost?: boolean;
}) {
  const opacity = ghost ? 0.28 : 1;
  if (mark === "O") {
    return (
      <motion.svg
        viewBox="0 0 100 100"
        className="h-[62%] w-[62%]"
        initial={ghost ? false : { scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity }}
        transition={{ type: "spring", stiffness: 420, damping: 18 }}
      >
        <motion.circle
          cx="50"
          cy="50"
          r="32"
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          initial={ghost ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.35 }}
        />
      </motion.svg>
    );
  }
  return (
    <motion.svg
      viewBox="0 0 100 100"
      className="h-[62%] w-[62%]"
      initial={ghost ? false : { scale: 0.4, opacity: 0 }}
      animate={{ scale: 1, opacity }}
      transition={{ type: "spring", stiffness: 420, damping: 18 }}
    >
      <motion.path
        d="M28 28 L72 72"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        initial={ghost ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28 }}
      />
      <motion.path
        d="M72 28 L28 72"
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        strokeLinecap="round"
        initial={ghost ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.28, delay: 0.08 }}
      />
    </motion.svg>
  );
}

export function TttBoard({
  state,
  socket,
  onMove,
  onSendChat,
  enableVoice = true,
  joinVoiceRequest,
  onVoiceJoined,
}: {
  state: PublicGameState;
  socket: GameSocket | null;
  onMove: (cellIndex: number) => void;
  onSendChat: (channel: ChatChannel, text: string) => void;
  enableVoice?: boolean;
  joinVoiceRequest?: { nonce: number; channel: ChatChannel } | null;
  onVoiceJoined?: (channel: ChatChannel) => void;
}) {
  const ttt = state.ttt;
  const [hover, setHover] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const secondsLeft = state.phaseEndsAt
    ? Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000))
    : null;
  void now;

  if (!ttt || !state.you) return null;
  const myMark = ttt.marks[state.you.id];
  const myTurn = ttt.turnPlayerId === state.you.id && state.phase === "ttt_play";
  const turnPlayer = state.players.find((p) => p.id === ttt.turnPlayerId);

  const line = ttt.winningLine;
  const linePath = (() => {
    if (!line || line.length < 3) return null;
    const pos = (i: number) => {
      const r = Math.floor(i / 3);
      const c = i % 3;
      return { x: c * 100 + 50, y: r * 100 + 50 };
    };
    const a = pos(line[0]!);
    const b = pos(line[2]!);
    return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  })();

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div>
        <TurnIndicator
          name={turnPlayer?.name ?? "…"}
          detail={myMark ? `You are ${myMark}` : undefined}
          secondsLeft={secondsLeft}
          yours={myTurn}
        />
        <div className="relative mx-auto mt-6 aspect-square w-full max-w-md">
          <div className="grid h-full grid-cols-3 grid-rows-3 gap-2">
            {ttt.board.map((cell, i) => {
              const empty = cell === null;
              const showGhost = myTurn && empty && hover === i && myMark;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={!myTurn || !empty}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => onMove(i)}
                  className="relative flex items-center justify-center rounded-sm border border-crimson/25 bg-surface/80 text-crimson-glow transition hover:border-crimson/40 disabled:cursor-default"
                >
                  {cell && <MarkSvg mark={cell} />}
                  {showGhost && myMark && <MarkSvg mark={myMark} ghost />}
                </button>
              );
            })}
          </div>
          {linePath && (
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full text-crimson-glow drop-shadow-[0_0_12px_rgba(230,25,25,0.65)]"
              viewBox="0 0 300 300"
            >
              <motion.path
                d={linePath}
                fill="none"
                stroke="currentColor"
                strokeWidth="10"
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.45 }}
              />
            </svg>
          )}
        </div>
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
