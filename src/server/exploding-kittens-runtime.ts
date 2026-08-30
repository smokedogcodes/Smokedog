export type { EkCard, EkCardType, EkCatType } from "@/lib/games/exploding-kittens/cards";
export {
  EXPLODING_KITTENS_ID,
  cardLabel,
  isCatType,
  EK_CAT_TYPES,
} from "@/lib/games/exploding-kittens/cards";
export { createExplodingKittensState } from "@/lib/games/exploding-kittens/setup";
export type {
  EkGameState,
  EkPlayerRef,
  EkPendingAction,
} from "@/lib/games/exploding-kittens/state";
export {
  ekMaybeWin,
  ekPlayCards,
  ekResolveNopeWindow,
  ekDraw,
  ekPlaceDefuse,
  ekPlayNope,
  ekStealTarget,
  ekPickDiscard,
  ekFavorTarget,
  ekFavorGive,
  ekTripleDeclare,
  ekBeginDrawPhase,
  ekRandomDefuseIndex,
  newEkLog,
  toPublicEkCard,
  validatePlayCards,
  aliveSet,
} from "@/lib/games/exploding-kittens/reducer";
export { takeCardsFromHand } from "@/lib/games/exploding-kittens/logic";
export { projectExplodingKittensPublic } from "@/lib/games/exploding-kittens/selectors";
export { explodingKittensModule } from "@/lib/games/exploding-kittens/engine";

export type ExplodingKittensRoomState = import("@/lib/games/exploding-kittens/state").EkGameState;

export function createExplodingKittensRoomState(
  players: import("@/lib/games/exploding-kittens/state").EkPlayerRef[]
) {
  return createExplodingKittensState(players);
}

import { createExplodingKittensState } from "@/lib/games/exploding-kittens/setup";
