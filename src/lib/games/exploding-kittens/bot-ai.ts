import type { EkCard } from "./cards";
import { isCatType } from "./cards";
import type { EkGameState } from "./state";

export function botEkDelayMs(): number {
  return 800 + Math.floor(Math.random() * 1200);
}

export function pickBotEkPlay(hand: EkCard[]): {
  cardIds: string[];
  draw: boolean;
} | null {
  const action = hand.find(
    (c) =>
      c.type === "skip" ||
      c.type === "attack" ||
      c.type === "shuffle" ||
      c.type === "see_future" ||
      c.type === "favor"
  );
  if (action && Math.random() < 0.35) {
    return {
      cardIds: [action.id],
      draw: action.type === "shuffle" || action.type === "see_future",
    };
  }

  const cats = hand.filter((c) => isCatType(c.type));
  if (cats.length >= 2 && Math.random() < 0.2) {
    const type = cats[0]!.type;
    const pair = cats.filter((c) => c.type === type).slice(0, 2);
    if (pair.length === 2) {
      return { cardIds: pair.map((c) => c.id), draw: false };
    }
  }

  return null;
}

export function pickBotNope(hand: EkCard[]): string | null {
  const nope = hand.find((c) => c.type === "nope");
  if (!nope || Math.random() > 0.4) return null;
  return nope.id;
}

export function pickBotDefusePosition(deckSize: number): number {
  if (Math.random() < 0.2) return 0;
  if (Math.random() < 0.2) return deckSize;
  return Math.floor(Math.random() * (deckSize + 1));
}

export function pickBotStealTarget(
  playerIds: string[],
  selfId: string,
  handCounts: Record<string, number>
): string | null {
  const others = playerIds.filter(
    (id) => id !== selfId && (handCounts[id] ?? 0) > 0
  );
  if (others.length === 0) return null;
  return others[Math.floor(Math.random() * others.length)] ?? null;
}

export function pickBotDiscardIndex(discardSize: number): number {
  if (discardSize <= 0) return 0;
  return Math.floor(Math.random() * discardSize);
}

export function pickBotFavorCard(hand: EkCard[]): string | null {
  if (hand.length === 0) return null;
  const idx = Math.floor(Math.random() * hand.length);
  return hand[idx]?.id ?? null;
}

export function pickBotTripleType(hand: EkCard[]): EkCard["type"] | null {
  const action = hand.find((c) => !isCatType(c.type) && c.type !== "nope");
  return action?.type ?? "skip";
}

export function shouldBotDraw(state: EkGameState, botId: string): boolean {
  return state.turnPlayerId === botId && state.subPhase === "draw";
}
