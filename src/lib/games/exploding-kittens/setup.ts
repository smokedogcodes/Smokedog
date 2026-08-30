import {
  buildActionPool,
  dealFromPool,
  makeCard,
  shuffle,
  type EkCard,
} from "./cards";
import type { EkGameState, EkPlayerRef } from "./state";

function shuffleWithRng<T>(arr: T[], rng: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]!];
  }
  return out;
}

export function createExplodingKittensState(
  players: EkPlayerRef[],
  rng: () => number = Math.random
): EkGameState {
  const n = Math.max(2, Math.min(5, players.length));
  const pool = shuffleWithRng(buildActionPool(), rng);

  const defuseCards = Array.from({ length: 6 }, () => makeCard("defuse"));
  const kittenCards = Array.from({ length: n - 1 }, () =>
    makeCard("exploding_kitten")
  );

  const handsByPlayerId: Record<string, EkCard[]> = {};
  for (const p of players.slice(0, n)) {
    const hand: EkCard[] = [defuseCards.pop()!];
    hand.push(...dealFromPool(pool, 7));
    handsByPlayerId[p.id] = hand;
  }

  const drawDeck = shuffleWithRng(
    [...pool, ...defuseCards, ...kittenCards],
    rng
  );
  const turnOrder = players.slice(0, n).map((p) => p.id);
  const startIdx = Math.floor(rng() * turnOrder.length);

  return {
    drawDeck,
    discardPile: [],
    handsByPlayerId,
    turnPlayerId: turnOrder[startIdx] ?? null,
    turnOrder,
    turnsRemaining: 1,
    subPhase: "play",
    pendingAction: null,
    nopeStack: [],
    nopeWindowEndsAt: null,
    seeFutureByPlayer: {},
    defusePlayerId: null,
    pendingKitten: null,
    pendingDefuseCard: null,
    stealActorId: null,
    pickDiscardPlayerId: null,
    favorFromId: null,
    favorToId: null,
    tripleActorId: null,
    tripleTargetId: null,
    tripleDemandedType: null,
    winnerId: null,
    pendingNopeCards: null,
    pendingNopeType: null,
  };
}
