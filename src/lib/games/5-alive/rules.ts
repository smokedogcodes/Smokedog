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

export function canPlayFiveAliveCardAtTotal(
  card: FiveAliveCardInstance | PublicFiveAliveCard,
  runningTotal: number
): boolean {
  // At 21: number 0 stays legal (21+0); other numbers blocked. Actions + setters OK.
  if (runningTotal === 21) {
    if (card.type === "number") return (card.value ?? -1) === 0;
    return isPlayableAtTwentyOne(card.type);
  }
  if (card.type === "number") {
    return runningTotal + (card.value ?? 0) <= 21;
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
