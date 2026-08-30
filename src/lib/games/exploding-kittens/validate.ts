import type { EkCard } from "./cards";
import { cardLabel, isCatType } from "./cards";
import { matchingCatCount, takeCardsFromHand } from "./logic";

export function validatePlayCards(
  hand: EkCard[],
  cardIds: string[]
): { ok: true; cards: EkCard[] } | { ok: false; reason: string } {
  if (cardIds.length === 0) {
    return { ok: false, reason: "No cards selected." };
  }

  const { taken, remaining } = takeCardsFromHand(hand, cardIds);
  if (taken.length !== cardIds.length) {
    return { ok: false, reason: "Invalid card selection." };
  }

  const forbidden = taken.filter(
    (c) =>
      c.type === "defuse" ||
      c.type === "exploding_kitten" ||
      c.type === "nope"
  );
  if (forbidden.length > 0) {
    return { ok: false, reason: "Those cards cannot be played now." };
  }

  const cats = taken.filter((c) => isCatType(c.type));
  const actions = taken.filter((c) => !isCatType(c.type));

  if (actions.length > 0 && cats.length > 0) {
    return { ok: false, reason: "Cannot mix action and cat cards." };
  }
  if (actions.length > 1) {
    return { ok: false, reason: "Play one action card at a time." };
  }

  if (cats.length > 0) {
    const combo = matchingCatCount(hand, cardIds);
    if (combo.count !== cardIds.length) {
      return { ok: false, reason: "Invalid cat combo." };
    }
    if (combo.count > 3 && !combo.allDistinct) {
      return { ok: false, reason: "Max three matching cats." };
    }
    if (combo.count === 5 && !combo.allDistinct) {
      return { ok: false, reason: "Five cards must be five different cats." };
    }
  }

  void remaining;
  return { ok: true, cards: taken };
}

export function validateNopePlay(hand: EkCard[], cardId: string): EkCard | null {
  const card = hand.find((c) => c.id === cardId);
  if (!card || card.type !== "nope") return null;
  return card;
}

export function validateStealTarget(
  targetId: string,
  actorId: string,
  handCounts: Record<string, number>
): boolean {
  if (targetId === actorId) return false;
  return (handCounts[targetId] ?? 0) > 0;
}

export function actionLabel(cards: EkCard[]): string {
  if (cards.length === 1) return cardLabel(cards[0]!);
  if (cards.length === 2) return "Two of a Kind";
  if (cards.length === 3) return "Three of a Kind";
  if (cards.length === 5) return "Five Different Cats";
  return "Cards played";
}
