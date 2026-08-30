import type { ExplodingKittensPublicState, PublicEkCard } from "@/lib/types";
import type { EkGameState } from "./state";
import { toPublicEkCard } from "./reducer";

export function projectExplodingKittensPublic(
  state: EkGameState,
  viewerId: string | null
): ExplodingKittensPublicState {
  const discardTop =
    state.discardPile.length > 0
      ? toPublicEkCard(state.discardPile[state.discardPile.length - 1]!)
      : null;

  const opponentHandCounts: Record<string, number> = {};
  for (const [pid, hand] of Object.entries(state.handsByPlayerId)) {
    if (pid !== viewerId) opponentHandCounts[pid] = hand.length;
  }

  const seeFutureCards =
    viewerId && state.seeFutureByPlayer[viewerId]
      ? state.seeFutureByPlayer[viewerId]!.map(toPublicEkCard)
      : null;

  const nopeEligible =
    !!state.nopeWindowEndsAt &&
    Date.now() < state.nopeWindowEndsAt &&
    !!viewerId &&
    (state.handsByPlayerId[viewerId] ?? []).some((c) => c.type === "nope");

  return {
    turnPlayerId: state.turnPlayerId,
    turnsRemaining: state.turnsRemaining,
    subPhase: state.subPhase,
    yourHand: viewerId
      ? (state.handsByPlayerId[viewerId] ?? []).map(toPublicEkCard)
      : [],
    drawPileCount: state.drawDeck.length,
    discardCount: state.discardPile.length,
    discardTop,
    discardPreview: state.discardPile.slice(-30).map(toPublicEkCard),
    seeFutureCards,
    awaitingDefuse: state.defusePlayerId === viewerId,
    awaitingPickDiscard: state.pickDiscardPlayerId === viewerId,
    awaitingStealTarget: state.stealActorId === viewerId,
    awaitingFavorGive: state.favorToId === viewerId,
    awaitingFavorTarget: state.pendingAction?.kind === "favor_pick_target" &&
      state.pendingAction.actorId === viewerId,
    awaitingTripleDeclare: state.tripleActorId === viewerId,
    stealTargetIds: Object.keys(opponentHandCounts).filter(
      (id) => id !== viewerId && (opponentHandCounts[id] ?? 0) > 0
    ),
    opponentHandCounts,
    nopeWindowEndsAt: state.nopeWindowEndsAt,
    nopeEligible: !!nopeEligible,
    pendingActionKind: state.pendingAction?.kind ?? null,
  };
}

export type { PublicEkCard };
