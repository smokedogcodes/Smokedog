import type { FiveAliveCardInstance } from "./cards";
import {
  canPlayFiveAliveCardAtTotal,
  isFiveAliveActionCard,
  isPlayableAtTwentyOne,
} from "./rules";
import { isBombDefuseCard } from "./actions";

function pick<T>(items: T[]): T | undefined {
  if (items.length === 0) return undefined;
  return items[Math.floor(Math.random() * items.length)];
}

export function botFiveAliveDelayMs(): number {
  return 4000 + Math.floor(Math.random() * 5500);
}

export function pickBotFiveAliveTurnPlay(
  hand: FiveAliveCardInstance[],
  runningTotal: number
): { cardId?: string; pass?: boolean } | null {
  if (hand.length === 0) return null;

  const total = Number(runningTotal);
  if (!Number.isFinite(total)) return null;

  if (total === 21) {
    const zeros = hand.filter(
      (c) => c.type === "number" && Number(c.value) === 0
    );
    if (zeros.length > 0) return { cardId: pick(zeros)!.id };
    const unlocks = hand.filter((c) => isPlayableAtTwentyOne(c.type));
    if (unlocks.length === 0) return { pass: true };
    // Prefer total-setters, then other actions.
    const setters = unlocks.filter(
      (c) => c.type === "reset0" || c.type === "eq10" || c.type === "eq21"
    );
    if (setters.length > 0) return { cardId: pick(setters)!.id };
    return { cardId: pick(unlocks)!.id };
  }

  const safeNumbers = hand.filter(
    (c): c is Extract<FiveAliveCardInstance, { type: "number" }> =>
      c.type === "number" && total + Number(c.value) <= 21
  );
  if (safeNumbers.length > 0) {
    const sorted = [...safeNumbers].sort((a, b) => b.value - a.value);
    const topHalf = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
    return { cardId: pick(topHalf)!.id };
  }

  const reset0 = hand.find((c) => c.type === "reset0");
  if (reset0) return { cardId: reset0.id };

  const eq10 = hand.find((c) => c.type === "eq10");
  if (eq10 && runningTotal !== 10) return { cardId: eq10.id };

  const eq21 = hand.find((c) => c.type === "eq21");
  if (eq21 && runningTotal !== 21) return { cardId: eq21.id };

  const utilities = hand.filter((c) => isFiveAliveActionCard(c.type));
  if (utilities.length > 0 && Math.random() < 0.55) {
    return { cardId: pick(utilities)!.id };
  }

  const bomb = hand.find((c) => c.type === "bomb");
  if (bomb) return { cardId: bomb.id };

  const playable = hand.filter((c) =>
    canPlayFiveAliveCardAtTotal(c, runningTotal)
  );
  if (playable.length > 0) return { cardId: playable[0]!.id };

  return { pass: true };
}

export function pickBotFiveAliveBombResponse(
  hand: FiveAliveCardInstance[]
): { cardId: string } | { pass: true } {
  const defuse = hand.find((c) => isBombDefuseCard(c));
  if (defuse) return { cardId: defuse.id };
  return { pass: true };
}
