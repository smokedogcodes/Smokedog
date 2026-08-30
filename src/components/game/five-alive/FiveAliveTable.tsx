"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Ban, Mic } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Ref } from "react";
import { useEffect, useId, useMemo, useState } from "react";
import type { PublicFiveAliveCard, PublicGameState } from "@/lib/types";
import { lifeColorForPlayerIndex } from "@/lib/games/5-alive/rules";
import { FiveAliveDeckCard } from "@/components/mockups/five-alive/FiveAliveDeckCard";
import { FA_EASE } from "@/components/mockups/five-alive/FiveAliveTableAnimation";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { FiveAliveLifeCard } from "./FiveAliveLifeCard";

/** Sage felt + cream pods — Gemini circular reference. */
const FA_FELT = "#E1E5DC";
const FA_POD = "#F2F1E9";
const FA_INK = "#7D2D2D";
const FA_MUTED = "#8a8580";

const LIFE_RING: Record<number, string> = {
  0: "#96C93D",
  1: "#F0E040",
  2: "#F7A740",
  3: "#8C3BFF",
  4: "#35C4C4",
  5: "#D6323F",
  6: "#96C93D",
  7: "#2E7D32",
};

function totalTone(total: number): string {
  if (total > 21) return "text-[#8B1E1E]";
  if (total >= 18) return "text-[#a67c00]";
  return "text-[#7D2D2D]";
}

function nextLivingPlayerId(
  players: PublicGameState["players"],
  fromId: string,
  direction: 1 | -1
): string | null {
  const n = players.length;
  const fromIdx = players.findIndex((p) => p.id === fromId);
  if (fromIdx < 0 || n === 0) return null;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIdx + direction * step + n * 8) % n;
    const p = players[idx];
    if (p && p.alive && (p.lives ?? 0) > 0) return p.id;
  }
  return null;
}

/**
 * Fixed pod size for all player counts; only orbit radius scales.
 * Prevents the 2p "giant circles" distortion.
 */
function boardGeometry(n: number, compact: boolean) {
  const podSize = compact ? 102 : 116;
  const hubRadius = compact ? 78 : 96;
  // Clearance between hub edge and pod inner edge
  const gap = compact ? 14 : 18;
  let orbit = hubRadius + podSize / 2 + gap;
  // Ensure pods don't overlap each other
  if (n >= 2) {
    const minOrbit = podSize / (2 * Math.sin(Math.PI / Math.max(n, 2)));
    orbit = Math.max(orbit, minOrbit * 1.05);
  }
  // Cap for mobile viewport
  if (compact) orbit = Math.min(orbit, 148);
  else orbit = Math.min(orbit, 178);

  const boardSize = orbit * 2 + podSize + (compact ? 12 : 20);
  const discSize = hubRadius * 2;

  return { podSize, orbit, boardSize, discSize, hubRadius };
}

function ArcedName({
  text,
  compact,
  muted,
  color,
}: {
  text: string;
  compact?: boolean;
  muted?: boolean;
  color?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const pathId = `fa-arc-${uid}`;
  const label = text.length > 16 ? `${text.slice(0, 15)}…` : text;
  return (
    <svg
      viewBox="0 0 160 36"
      className={cn(
        "pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 overflow-visible",
        compact ? "h-[18px] w-[7.5rem]" : "h-5 w-[8.5rem]"
      )}
      aria-hidden
    >
      <defs>
        <path id={pathId} d="M 12 30 Q 80 2 148 30" fill="none" />
      </defs>
      <text
        fill={muted ? FA_MUTED : color ?? FA_INK}
        fontSize={compact ? 9 : 10.5}
        fontWeight="700"
        letterSpacing="0.06em"
        style={{ textTransform: "uppercase", fontFamily: "system-ui, sans-serif" }}
      >
        <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
          {label}
        </textPath>
      </text>
    </svg>
  );
}

/** Thick curved arrows — sized to sit inside the cream hub disc. */
function DirectionArcs({
  direction,
  size,
}: {
  direction: 1 | -1;
  size: number;
}) {
  const uid = useId().replace(/:/g, "");
  return (
    <motion.svg
      key={direction}
      initial={{ opacity: 0.35, rotate: direction === 1 ? -10 : 10 }}
      animate={{ opacity: 1, rotate: 0 }}
      transition={{ duration: 0.45, ease: FA_EASE }}
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className="pointer-events-none absolute inset-0 m-auto"
      aria-hidden
    >
      <defs>
        <marker
          id={`fa-arr-${uid}`}
          markerWidth="5"
          markerHeight="5"
          refX="4"
          refY="2.5"
          orient="auto"
        >
          <path d="M0,0 L5,2.5 L0,5 Z" fill="#8B6914" opacity="0.7" />
        </marker>
      </defs>
      <g
        fill="none"
        stroke="#8B6914"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.5"
        markerEnd={`url(#fa-arr-${uid})`}
        style={{
          transformOrigin: "100px 100px",
          transform: direction === -1 ? "scaleX(-1)" : undefined,
        }}
      >
        {/* Rim ring — sits at the edge of the hub disc, clear of center text/cards */}
        <path d="M 100 8 A 92 92 0 0 1 192 100" />
        <path d="M 192 100 A 92 92 0 0 1 100 192" />
        <path d="M 100 192 A 92 92 0 0 1 8 100" />
        <path d="M 8 100 A 92 92 0 0 1 100 8" />
      </g>
    </motion.svg>
  );
}

function HandCountBadge({
  count,
  compact,
}: {
  count: number;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "absolute z-20 flex items-center gap-0.5 rounded-md border border-[#d4cfc4] bg-[#ebe6dc] font-sans font-bold text-[#5c4033] shadow-sm",
        compact
          ? "-right-1.5 top-0 px-1 py-0.5 text-[8px]"
          : "-right-2 top-0.5 px-1.5 py-0.5 text-[9px]"
      )}
      title={`${count} cards in hand`}
      aria-label={`${count} cards in hand`}
    >
      <svg
        viewBox="0 0 16 16"
        className={compact ? "size-2.5" : "size-3"}
        aria-hidden
      >
        <rect
          x="3"
          y="2"
          width="8"
          height="11"
          rx="1.2"
          fill="#d4c4a8"
          stroke="#5c4033"
          strokeWidth="1"
        />
        <rect
          x="5"
          y="3.5"
          width="8"
          height="11"
          rx="1.2"
          fill="#f3eee4"
          stroke="#5c4033"
          strokeWidth="1"
        />
      </svg>
      <span>{count}</span>
    </div>
  );
}

function LastPlayedFan({
  cards,
  compact,
  centerRef,
  centerPlaceholder,
}: {
  cards: PublicFiveAliveCard[];
  compact?: boolean;
  centerRef?: (el: HTMLDivElement | null) => void;
  centerPlaceholder?: boolean;
}) {
  const cardW = compact ? 42 : 52;
  const show = cards.length > 0 && !centerPlaceholder;
  const fan = show ? cards.slice(-3) : [];

  return (
    <div className="relative flex min-h-[3.75rem] w-full items-center justify-center sm:min-h-[4.75rem]">
      <div className="relative flex items-center justify-center overflow-visible">
        {fan.length > 0 ? (
          fan.map((card, i) => {
            const isTop = i === fan.length - 1;
            const mid = (fan.length - 1) / 2;
            const rot = (i - mid) * 10;
            const x = (i - mid) * (compact ? 9 : 12);
            return (
              <div
                key={card.id}
                ref={isTop ? centerRef : undefined}
                className="absolute overflow-visible"
                style={{
                  zIndex: i + 1,
                  transform: `translateX(${x}px) rotate(${rot}deg)`,
                }}
              >
                <motion.div
                  initial={isTop ? { scale: 0.92, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.35, ease: FA_EASE }}
                  className="overflow-visible"
                >
                  <FiveAliveDeckCard card={card} width={cardW} elevated={isTop} />
                </motion.div>
              </div>
            );
          })
        ) : (
          <div
            ref={centerRef}
            className={cn(
              "flex aspect-[5/7] items-center justify-center rounded-[8px] border border-dashed border-[#9a6b4a]/40 bg-white/40 font-sans uppercase tracking-widest text-[#7D2D2D]/50",
              compact ? "w-[38px] text-[6px]" : "w-[46px] text-[7px]"
            )}
          >
            —
          </div>
        )}
        <div
          className="pointer-events-none invisible"
          style={{ width: cardW + 24, height: (cardW * 7) / 5 + 6 }}
          aria-hidden
        />
      </div>
    </div>
  );
}

function FannedLifeCards({
  lives,
  heartColor,
  lifeAnim,
  playerId,
  compact,
  grey,
}: {
  lives: number;
  heartColor: ReturnType<typeof lifeColorForPlayerIndex>;
  lifeAnim?: { playerId: string; slot: number } | null;
  playerId: string;
  compact?: boolean;
  grey?: boolean;
}) {
  const w = compact ? 16 : 19;
  const overlap = compact ? -5.5 : -6.5;
  return (
    <div
      className={cn(
        "mt-1 flex items-end justify-center",
        grey && "grayscale opacity-75"
      )}
      title={`${lives} of 5 lives`}
      aria-label={`${lives} of 5 lives`}
    >
      {Array.from({ length: 5 }, (_, i) => {
        const mid = 2;
        const rot = (i - mid) * 10;
        return (
          <div
            key={i}
            className="relative"
            style={{
              marginLeft: i === 0 ? 0 : overlap,
              transform: `rotate(${rot}deg) translateY(${Math.abs(i - mid) * 1.2}px)`,
              zIndex: i,
            }}
          >
            <FiveAliveLifeCard
              heartColor={heartColor}
              face={i < lives ? "heart" : "skull"}
              width={w}
              flipping={lifeAnim?.playerId === playerId && lifeAnim.slot === i}
            />
          </div>
        );
      })}
    </div>
  );
}

/**
 * Compact strip fallback when LifeTracker is not used with `five`.
 */
export function FiveAliveTable({
  five,
  centerRef,
  centerPlaceholder = false,
  drawRef,
}: {
  five: NonNullable<PublicGameState["fiveAlive"]>;
  centerRef?: (el: HTMLDivElement | null) => void;
  centerPlaceholder?: boolean;
  drawRef?: Ref<HTMLDivElement>;
}) {
  const recent =
    five.centerRecentCards && five.centerRecentCards.length > 0
      ? five.centerRecentCards
      : five.centerTopCard
        ? [five.centerTopCard]
        : [];
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return (
    <div className="flex w-full max-w-full items-center justify-center gap-3 overflow-visible py-1">
      <LastPlayedFan
        cards={recent}
        compact={compact}
        centerRef={centerRef}
        centerPlaceholder={centerPlaceholder}
      />
      <div className="text-center">
        <p className="font-sans text-[8px] font-bold uppercase tracking-widest text-[#7D2D2D]/70">
          Running total
        </p>
        <p
          className={cn(
            "font-sans text-2xl font-extrabold sm:text-3xl",
            totalTone(five.runningTotal)
          )}
        >
          {five.runningTotal}
        </p>
      </div>
      {/* Invisible deal-fly origin when this strip is used without LifeTracker */}
      <div
        ref={drawRef}
        className="pointer-events-none size-1 opacity-0"
        aria-hidden
      />
    </div>
  );
}

export function FiveAliveLifeTracker({
  players,
  turnPlayerId,
  direction = 1,
  skipNext = false,
  lifeAnim,
  registerSeatRef,
  youId,
  onInviteVoice,
  five,
  centerRef,
  centerPlaceholder = false,
  drawRef,
}: {
  players: PublicGameState["players"];
  turnPlayerId: string | null;
  direction?: 1 | -1;
  skipNext?: boolean;
  lifeAnim?: { playerId: string; slot: number } | null;
  registerSeatRef?: (playerId: string, el: HTMLElement | null) => void;
  youId?: string | null;
  onInviteVoice?: (playerId: string) => void;
  five?: NonNullable<PublicGameState["fiveAlive"]> | null;
  centerRef?: (el: HTMLDivElement | null) => void;
  centerPlaceholder?: boolean;
  drawRef?: Ref<HTMLDivElement>;
}) {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setCompact(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const skippedPlayerId = useMemo(() => {
    if (!skipNext || !turnPlayerId) return null;
    return nextLivingPlayerId(players, turnPlayerId, direction);
  }, [skipNext, turnPlayerId, players, direction]);

  const turnName =
    players.find((p) => p.id === turnPlayerId)?.name ?? "Someone";
  const n = Math.max(players.length, 1);
  const twoPlayer = n === 2;
  const { podSize, orbit, boardSize, discSize } = boardGeometry(n, compact);

  const seats = useMemo(() => {
    if (!twoPlayer || !youId) {
      return players.map((p, i) => ({ p, colorIndex: i }));
    }
    const youIdx = players.findIndex((p) => p.id === youId);
    if (youIdx < 0) return players.map((p, i) => ({ p, colorIndex: i }));
    // YOU at 6 o'clock (last in clockwise list starting from top+1)
    const ordered = [
      ...players.slice(youIdx + 1),
      ...players.slice(0, youIdx + 1),
    ];
    return ordered.map((p) => ({
      p,
      colorIndex: players.findIndex((orig) => orig.id === p.id),
    }));
  }, [players, twoPlayer, youId]);

  const recentCards = useMemo(() => {
    if (!five) return [] as PublicFiveAliveCard[];
    if (five.centerRecentCards && five.centerRecentCards.length > 0) {
      return five.centerRecentCards;
    }
    return five.centerTopCard ? [five.centerTopCard] : [];
  }, [five]);

  const handCounts = five?.handCounts;

  return (
    <div className="relative mx-auto w-full max-w-lg select-none overflow-visible">
      <div
        className="relative mx-auto overflow-visible rounded-[1.25rem]"
        style={{
          width: boardSize,
          height: boardSize,
          maxWidth: "100%",
          background: FA_FELT,
        }}
      >
        {/* Soft guide circle under hub */}
        <div
          className="absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40"
          style={{
            width: discSize * 1.35,
            height: discSize * 1.35,
            background:
              "radial-gradient(circle, rgba(255,255,255,0.55) 0%, transparent 70%)",
          }}
        />

        {/* Cream hub disc + direction arrows (contained inside) */}
        <div
          className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full shadow-[0_4px_20px_rgba(61,50,41,0.12)]"
          style={{
            width: discSize,
            height: discSize,
            background: FA_POD,
          }}
        >
          <DirectionArcs direction={direction} size={discSize} />
        </div>

        {/* Hub content */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 z-30 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-1 overflow-visible sm:gap-1.5"
          style={{ width: discSize * 0.72, height: discSize * 0.72 }}
        >
          {five ? (
            <>
              <div className="relative z-10 shrink-0 px-1 text-center">
                <p
                  className={cn(
                    "font-sans font-bold uppercase tracking-[0.12em]",
                    compact ? "text-[8px]" : "text-[9px] sm:text-[10px]",
                    totalTone(five.runningTotal)
                  )}
                >
                  Running total:{" "}
                  <motion.span
                    key={five.runningTotal}
                    initial={{ scale: 1.1, opacity: 0.75 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.28, ease: FA_EASE }}
                    className="font-extrabold"
                  >
                    {five.runningTotal}
                  </motion.span>
                </p>
                {five.runningTotal === 21 ? (
                  <p className="mt-0.5 font-sans text-[6px] uppercase tracking-widest text-[#457b9d] sm:text-[7px]">
                    Non-number cards only
                  </p>
                ) : null}
              </div>

              <div className="pointer-events-auto relative z-10 w-full shrink-0 overflow-visible px-1">
                <LastPlayedFan
                  cards={recentCards}
                  compact={compact}
                  centerRef={centerRef}
                  centerPlaceholder={centerPlaceholder}
                />
              </div>

              <p
                className={cn(
                  "relative z-10 max-w-[95%] shrink-0 text-center font-sans font-semibold text-[#8B1E1E]",
                  compact ? "text-[9px]" : "text-[10px] sm:text-[11px]"
                )}
              >
                Turn: {turnName}
              </p>

              {/* Invisible deal-fly origin (draw pile UI removed) */}
              <div
                ref={drawRef}
                className="pointer-events-none absolute left-1/2 top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 opacity-0"
                aria-hidden
              />
            </>
          ) : (
            <div className="relative z-10 text-center">
              <p className="font-sans text-[11px] font-semibold text-[#8B1E1E] sm:text-xs">
                Turn: {turnName}
              </p>
            </div>
          )}
        </div>

        {/* Seat pods — fixed size for all n */}
        {seats.map(({ p, colorIndex }, seatIndex) => {
          const lives = p.lives ?? 0;
          const dead = !p.alive || lives <= 0;
          const isTurn = turnPlayerId === p.id && !dead;
          const isSkipped = skippedPlayerId === p.id;
          const isYou = p.id === youId;
          const heartColor = lifeColorForPlayerIndex(colorIndex);
          const handCount = handCounts?.[p.id] ?? 0;
          const ringColor = LIFE_RING[heartColor] ?? "#96C93D";

          const angle = -Math.PI / 2 + (seatIndex / n) * Math.PI * 2;
          const x = Math.cos(angle) * orbit;
          const y = Math.sin(angle) * orbit;

          const canInvite =
            !!onInviteVoice && !dead && !p.isBot && p.connected && !isYou;

          return (
            <div
              key={p.id}
              ref={(el) => registerSeatRef?.(p.id, el)}
              className="absolute left-1/2 top-1/2 z-20"
              style={{
                width: podSize,
                height: podSize,
                marginLeft: -podSize / 2,
                marginTop: -podSize / 2,
                transform: `translate(${x}px, ${y}px)`,
              }}
            >
              <motion.div
                className={cn(
                  "relative flex h-full w-full flex-col items-center justify-center rounded-full",
                  dead && "opacity-40 grayscale",
                  isSkipped && !dead && "opacity-55 grayscale"
                )}
                style={{
                  background: isSkipped || dead ? "#d5d5d5" : FA_POD,
                }}
                animate={
                  isTurn
                    ? {
                        boxShadow: [
                          `0 0 0 3px ${ringColor}66, 0 0 14px 3px ${ringColor}55`,
                          `0 0 0 5px ${ringColor}99, 0 0 22px 5px ${ringColor}70`,
                          `0 0 0 3px ${ringColor}77, 0 0 16px 4px ${ringColor}60`,
                        ],
                      }
                    : {
                        boxShadow: "0 3px 12px rgba(61,50,41,0.14)",
                      }
                }
                transition={{ duration: 1.6, repeat: isTurn ? Infinity : 0 }}
              >
                <ArcedName
                  text={isYou ? `${p.name} (you)` : p.name}
                  compact={compact}
                  muted={dead || isSkipped}
                  color={isSkipped || dead ? undefined : FA_INK}
                />

                <div className="relative mt-3.5 sm:mt-4">
                  <div
                    className={cn(
                      "relative overflow-hidden rounded-full bg-[#e0d9cc]/50",
                      compact ? "size-9" : "size-11 sm:size-12"
                    )}
                    style={{
                      boxShadow: `0 0 0 ${isTurn ? 2.5 : 1.5}px ${
                        isSkipped || dead ? "#9a9a9a" : ringColor
                      }`,
                    }}
                  >
                    <PlayerAvatar
                      id={p.avatarId}
                      size={compact ? 36 : 48}
                      className="h-full w-full"
                    />
                  </div>

                  {!dead ? (
                    <HandCountBadge count={handCount} compact={compact} />
                  ) : null}

                  <AnimatePresence>
                    {isSkipped ? (
                      <motion.div
                        key="skip"
                        initial={{ scale: 0.6, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.6, opacity: 0 }}
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <span className="absolute inset-[-5px] rounded-full border-2 border-[#6a6a6a]/50" />
                        <span className="relative flex size-8 items-center justify-center rounded-full bg-[#6a6a6a]/92 text-white shadow-md">
                          <Ban size={16} strokeWidth={2.5} />
                        </span>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>

                <FannedLifeCards
                  lives={lives}
                  heartColor={heartColor}
                  lifeAnim={lifeAnim}
                  playerId={p.id}
                  compact={compact}
                  grey={dead || isSkipped}
                />

                {canInvite ? (
                  <button
                    type="button"
                    onClick={() => onInviteVoice(p.id)}
                    className="absolute -bottom-0.5 left-1/2 z-30 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-[#7D2D2D]/35 bg-[#F2F1E9] px-1.5 py-0.5 font-sans text-[8px] uppercase tracking-wider text-[#7D2D2D] shadow-sm"
                    aria-label={`Invite ${p.name} to voice`}
                  >
                    <Mic size={9} /> Voice
                  </button>
                ) : null}
              </motion.div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Felt wrapper for five-alive play panels only. */
export const FA_BOARD_PANEL_CLASS =
  "overflow-visible border-[#c5cbb8]/90 text-[#3d3229] shadow-[0_2px_16px_rgba(61,50,41,0.08)]";

export const FA_BOARD_PANEL_STYLE = {
  background: FA_FELT,
} as const;

export const FA_HAND_PANEL_CLASS =
  "min-w-0 overflow-x-hidden overflow-y-visible border-[#c5cbb8]/70 text-[#3d3229] shadow-[0_2px_12px_rgba(61,50,41,0.06)]";

export const FA_HAND_PANEL_STYLE = {
  background: "#F4F2EC",
} as const;
