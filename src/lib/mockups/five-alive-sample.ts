import type { PublicFiveAliveCard } from "@/lib/types";
import type { FiveAliveGalleryOnlyCard, FiveAliveLifeDisplayCard } from "@/lib/mockups/five-alive-deck-art";

export type FiveAliveSampleCard = PublicFiveAliveCard & {
  heartColor?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

export type FiveAliveGalleryCard =
  | FiveAliveSampleCard
  | FiveAliveGalleryOnlyCard
  | FiveAliveLifeDisplayCard;

export const FIVE_ALIVE_MAX_LIVES = 5;

const uid = (n: number) => `fa-sample-${n}`;

/** Player 1 starting hand — play cards only (life cards sit in the life pile). */
export const FIVE_ALIVE_START_HAND: FiveAliveSampleCard[] = [
  { id: uid(1), type: "number", value: 3 },
  { id: uid(2), type: "number", value: 7 },
  { id: uid(3), type: "skip" },
  { id: uid(4), type: "draw1" },
  { id: uid(5), type: "reset0" },
  { id: uid(6), type: "bomb" },
];

export const FIVE_ALIVE_P2_START_HAND: FiveAliveSampleCard[] = [
  { id: uid(50), type: "number", value: 2 },
  { id: uid(51), type: "number", value: 4 },
  { id: uid(52), type: "reverse" },
];

/** Play deck draw pool — no life (heart) cards; those track lives separately. */
export const FIVE_ALIVE_DRAW_POOL: FiveAliveSampleCard[] = [
  { id: uid(10), type: "number", value: 5 },
  { id: uid(11), type: "number", value: 1 },
  { id: uid(12), type: "reverse" },
  { id: uid(13), type: "eq21" },
  { id: uid(14), type: "number", value: 4 },
  { id: uid(15), type: "draw2" },
  { id: uid(16), type: "number", value: 6 },
  { id: uid(18), type: "number", value: 0 },
  { id: uid(19), type: "skip" },
  { id: uid(20), type: "number", value: 7 },
];

export const FIVE_ALIVE_INITIAL_DRAW_COUNT = 38;

/** Playable deck cards for the gallery. */
export const FIVE_ALIVE_PLAY_GALLERY: FiveAliveGalleryCard[] = [
  { id: "g-num-0", type: "number", value: 0 },
  { id: "g-num-1", type: "number", value: 1 },
  { id: "g-num-2", type: "number", value: 2 },
  { id: "g-num-3", type: "number", value: 3 },
  { id: "g-num-4", type: "number", value: 4 },
  { id: "g-num-5", type: "number", value: 5 },
  { id: "g-num-6", type: "number", value: 6 },
  { id: "g-num-7", type: "number", value: 7 },
  { id: "g-draw1", type: "draw1" },
  { id: "g-draw2", type: "draw2" },
  { id: "g-reset0", type: "reset0" },
  { id: "g-eq10", type: "eq10" },
  { id: "g-eq21", type: "eq21" },
  { id: "g-reverse", type: "reverse" },
  { id: "g-passmeby", type: "passmeby" },
  { id: "g-skip", type: "skip" },
  { id: "g-shuffle", type: "shuffle" },
  { id: "g-bomb", type: "bomb" },
];

/** Alive heart cards — each member starts with 5; busting removes one. */
export const FIVE_ALIVE_LIFE_GALLERY: FiveAliveLifeDisplayCard[] = [
  { id: "g-life-g", type: "life", heartColor: 6 },
  { id: "g-life-p", type: "life", heartColor: 3 },
  { id: "g-life-o", type: "life", heartColor: 1 },
  { id: "g-life-r", type: "life", heartColor: 0 },
  { id: "g-life-k", type: "life", heartColor: 7 },
  { id: "g-life-b", type: "life", heartColor: 4 },
];

export const FIVE_ALIVE_GALLERY_CARDS: FiveAliveGalleryCard[] = [
  ...FIVE_ALIVE_PLAY_GALLERY,
  ...FIVE_ALIVE_LIFE_GALLERY,
];

export function cloneStartHand(): FiveAliveSampleCard[] {
  return FIVE_ALIVE_START_HAND.map((c) => ({ ...c }));
}

export function cloneP2Hand(): FiveAliveSampleCard[] {
  return FIVE_ALIVE_P2_START_HAND.map((c) => ({ ...c }));
}

export function cloneDrawPool(): FiveAliveSampleCard[] {
  return FIVE_ALIVE_DRAW_POOL.map((c) => ({ ...c }));
}

export function mockRunningTotalAfterPlay(
  current: number,
  card: FiveAliveSampleCard
): number {
  switch (card.type) {
    case "number":
      return current + (card.value ?? 0);
    case "reset0":
      return 0;
    case "eq21":
      return 21;
    default:
      return current;
  }
}

export { cardTypeName } from "@/lib/mockups/five-alive-deck-art";
