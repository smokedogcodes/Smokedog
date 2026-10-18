import type { FiveAliveCardInstance } from "./cards";
import type { PublicFiveAliveCard } from "@/lib/types";

/** Playable non-number cards when the running total is locked at 21. */
export function isFiveAliveActionCard(type: string): boolean {
  return (
    type === "skip" ||
    type === "reverse" ||
    type === "passmeby" ||
    type === "shuffle" ||
    type === "draw1" ||
    type === "draw2" ||
    type === "bomb"
  );
}

/** Total-setters (=0 / =10 / =21) are also legal at 21 — they change the lock. */
export function isFiveAliveTotalSetter(type: string): boolean {
  return type === "reset0" || type === "eq10" || type === "eq21";
}

/** Any non-number card that can be played while total is 21. */
export function isPlayableAtTwentyOne(type: string): boolean {
  return isFiveAliveActionCard(type) || isFiveAliveTotalSetter(type);
}

function asFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function canPlayFiveAliveCardAtTotal(
  card: FiveAliveCardInstance | PublicFiveAliveCard,
  runningTotal: number
): boolean {
  // Coerce — socket/DO payloads can occasionally deliver numeric fields as strings,
  // and `"5" + 4 === "54"` would incorrectly mark every number card unplayable.
  const total = asFiniteNumber(runningTotal, 0);

  // At 21: number 0 stays legal (21+0); other numbers blocked. Actions + setters OK.
  if (total === 21) {
    if (card.type === "number") return asFiniteNumber(card.value, -1) === 0;
    return isPlayableAtTwentyOne(card.type);
  }
  if (card.type === "number") {
    const value = asFiniteNumber(card.value, 0);
    return total + value <= 21;
  }
  return true;
}

export function handHasPlayableCard(
  hand: Array<FiveAliveCardInstance | PublicFiveAliveCard>,
  runningTotal: number
): boolean {
  return hand.some((c) => canPlayFiveAliveCardAtTotal(c, runningTotal));
}

export function handHasFiveAliveActionCard(
  hand: Array<FiveAliveCardInstance | PublicFiveAliveCard>
): boolean {
  return hand.some((c) => isFiveAliveActionCard(c.type));
}

/** One heart stripe color per seat (not related to playable cards). */
export const FA_PLAYER_LIFE_COLORS = [6, 2, 4, 1, 5, 3, 7, 0] as const;

export type FaPlayerLifeColor = (typeof FA_PLAYER_LIFE_COLORS)[number];

export function lifeColorForPlayerIndex(index: number): FaPlayerLifeColor {
  return FA_PLAYER_LIFE_COLORS[index % FA_PLAYER_LIFE_COLORS.length]!;
}
