export type FiveAliveDealKind = "initial" | "round_reset" | "shuffle";

export type FiveAliveDealStep = {
  playerId: string;
  cardIndex: number;
};

export const FA_ROUND_BANNER_MS = 1600;
/** Per-card flight duration (center → seat). */
export const FA_DEAL_CARD_MS = 1450;
export const FA_DEAL_MIN_STAGGER_MS = 180;
export const FA_DEAL_MAX_STAGGER_MS = 320;
/** Target window for the staggered deal sequence (excluding banner). */
export const FA_DEAL_TARGET_MS = 6200;

export function computeDealStaggerMs(stepCount: number): number {
  if (stepCount <= 1) return FA_DEAL_MAX_STAGGER_MS;
  const raw = Math.floor(
    (FA_DEAL_TARGET_MS - FA_DEAL_CARD_MS) / Math.max(1, stepCount - 1)
  );
  return Math.min(
    FA_DEAL_MAX_STAGGER_MS,
    Math.max(FA_DEAL_MIN_STAGGER_MS, raw)
  );
}

export function dealAnimationDurationMs(
  stepCount: number,
  showBanner: boolean
): number {
  if (stepCount === 0) return showBanner ? FA_ROUND_BANNER_MS + 200 : 200;
  const stagger = computeDealStaggerMs(stepCount);
  // Overlapping flights: last card starts at (n-1)*stagger, then flies FA_DEAL_CARD_MS.
  return (
    (showBanner ? FA_ROUND_BANNER_MS : 0) +
    (stepCount - 1) * stagger +
    FA_DEAL_CARD_MS +
    600
  );
}

/** Round-robin deal order: P1 card0, P2 card0, …, P1 card1, … */
export function buildRoundRobinDealSteps(
  playerIds: string[],
  cardsPerPlayer: number | Record<string, number>
): FiveAliveDealStep[] {
  if (playerIds.length === 0) return [];

  const counts: Record<string, number> =
    typeof cardsPerPlayer === "number"
      ? Object.fromEntries(playerIds.map((id) => [id, cardsPerPlayer]))
      : cardsPerPlayer;

  const maxCards = Math.max(0, ...playerIds.map((id) => counts[id] ?? 0));
  const steps: FiveAliveDealStep[] = [];

  for (let c = 0; c < maxCards; c++) {
    for (const playerId of playerIds) {
      if ((counts[playerId] ?? 0) > c) {
        steps.push({ playerId, cardIndex: c });
      }
    }
  }

  return steps;
}

export function buildDealStepsFromHands(
  playerIds: string[],
  handsByPlayerId: Record<string, unknown[]>
): FiveAliveDealStep[] {
  const counts: Record<string, number> = {};
  for (const id of playerIds) {
    counts[id] = handsByPlayerId[id]?.length ?? 0;
  }
  return buildRoundRobinDealSteps(playerIds, counts);
}
