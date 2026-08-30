import type { EkCard } from "./cards";
import { EK_CAT_TYPES, isCatType } from "./cards";

export function nextAlivePlayerId(
  order: string[],
  fromId: string,
  alive: Set<string>
): string | null {
  const idx = order.indexOf(fromId);
  if (idx < 0) return order.find((id) => alive.has(id)) ?? null;
  for (let i = 1; i <= order.length; i++) {
    const next = order[(idx + i) % order.length]!;
    if (alive.has(next)) return next;
  }
  return null;
}

export function alivePlayerIds(order: string[], alive: Set<string>): string[] {
  return order.filter((id) => alive.has(id));
}

export function matchingCatCount(
  hand: EkCard[],
  selectedIds: string[]
): { type: EkCard["type"] | null; count: number; allDistinct: boolean } {
  if (selectedIds.length === 0) {
    return { type: null, count: 0, allDistinct: false };
  }
  const selected = hand.filter((c) => selectedIds.includes(c.id));
  if (selected.length !== selectedIds.length) {
    return { type: null, count: 0, allDistinct: false };
  }
  const cats = selected.filter((c) => isCatType(c.type));
  if (cats.length !== selected.length) {
    return { type: null, count: 0, allDistinct: false };
  }
  const types = new Set(cats.map((c) => c.type));
  if (types.size === 1) {
    return { type: cats[0]!.type, count: cats.length, allDistinct: false };
  }
  if (types.size === cats.length && cats.length === 5) {
    return { type: null, count: 5, allDistinct: true };
  }
  return { type: null, count: 0, allDistinct: false };
}

export function takeCardsFromHand(
  hand: EkCard[],
  cardIds: string[]
): { taken: EkCard[]; remaining: EkCard[] } {
  const idSet = new Set(cardIds);
  const taken: EkCard[] = [];
  const remaining: EkCard[] = [];
  for (const c of hand) {
    if (idSet.has(c.id)) taken.push(c);
    else remaining.push(c);
  }
  return { taken, remaining };
}

export function drawTop(deck: EkCard[]): EkCard | null {
  return deck.shift() ?? null;
}

export function peekTop(deck: EkCard[], count: number): EkCard[] {
  return deck.slice(0, Math.min(count, deck.length));
}

export function insertIntoDeck(deck: EkCard[], index: number, card: EkCard) {
  const idx = Math.max(0, Math.min(deck.length, Math.floor(index)));
  deck.splice(idx, 0, card);
}

export function shuffleDeck(deck: EkCard[]) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]!];
  }
}

export function stealRandomCard(
  fromHand: EkCard[],
  toHand: EkCard[],
  rng: () => number = Math.random
): EkCard | null {
  if (fromHand.length === 0) return null;
  const idx = Math.floor(rng() * fromHand.length);
  const [stolen] = fromHand.splice(idx, 1);
  if (!stolen) return null;
  toHand.push(stolen);
  return stolen;
}

export function hasCardType(hand: EkCard[], type: EkCard["type"]): boolean {
  return hand.some((c) => c.type === type);
}

export function transferOneCardOfType(
  fromHand: EkCard[],
  toHand: EkCard[],
  type: EkCard["type"]
): EkCard | null {
  const idx = fromHand.findIndex((c) => c.type === type);
  if (idx < 0) return null;
  const [card] = fromHand.splice(idx, 1);
  if (!card) return null;
  toHand.push(card);
  return card;
}

export function countDistinctCatTypes(hand: EkCard[]): number {
  const types = new Set(
    hand.filter((c) => isCatType(c.type)).map((c) => c.type)
  );
  return types.size;
}

export { EK_CAT_TYPES };
