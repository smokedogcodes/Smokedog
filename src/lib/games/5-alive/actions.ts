import type { FiveAliveCardInstance } from "./cards";
import { cardLabel, isNumber0, shuffle } from "./cards";
import { isFiveAliveActionCard } from "./rules";

/** Seat in turn order (index in room.players). */
export type FiveAliveSeat = {
  id: string;
  name: string;
  alive: boolean;
  lives: number;
};

export type FiveAliveTableState = {
  handsByPlayerId: Record<string, FiveAliveCardInstance[]>;
  drawDeck: FiveAliveCardInstance[];
  discardPile: FiveAliveCardInstance[];
  centerPile: FiveAliveCardInstance[];
  runningTotal: number;
  direction: 1 | -1;
  turnPlayerId: string | null;
  skipNext: boolean;
  pendingDrawCount: number;
  bombAwaitingPlayerId: string | null;
  bombActorId: string | null;
  bombResponderIds: string[];
  /** Same player plays again (2-player Reverse). */
  repeatTurnForPlayerId: string | null;
  /** When Shuffle Hands runs, keep running total (house rule default). */
  shuffleRedealKeepTotal: boolean;
};

export type FiveAlivePlayResult =
  | {
      kind: "advance";
      logs: string[];
      actorId: string;
    }
  | {
      kind: "repeat_turn";
      logs: string[];
      actorId: string;
    }
  | {
      kind: "bomb";
      logs: string[];
      actorId: string;
    }
  | {
      kind: "bust";
      logs: string[];
      actorId: string;
      reason: string;
    }
  | {
      kind: "shuffle";
      logs: string[];
      actorId: string;
      dealSteps: import("./dealing").FiveAliveDealStep[];
    };

export function livingSeats(seats: FiveAliveSeat[]): FiveAliveSeat[] {
  return seats.filter((s) => s.alive && s.lives > 0);
}

export function livingCount(seats: FiveAliveSeat[]): number {
  return livingSeats(seats).length;
}

/** Walk turn order; skips eliminated seats. */
export function nextLivingSeatId(
  seats: FiveAliveSeat[],
  fromPlayerId: string,
  direction: 1 | -1,
  steps = 1
): string | null {
  const n = seats.length;
  const fromIdx = seats.findIndex((s) => s.id === fromPlayerId);
  if (fromIdx < 0 || steps <= 0) return null;

  let remaining = steps;
  let idx = fromIdx;
  while (remaining > 0) {
    idx = (idx + direction + n) % n;
    const candidate = seats[idx];
    if (candidate && candidate.alive && candidate.lives > 0) {
      remaining -= 1;
    }
    if (remaining > 0 && idx === fromIdx) return null;
  }
  return seats[idx]?.id ?? null;
}

/** Reshuffle discard into draw pile. Center pile stays out of the shuffle. */
export function replenishDrawPile(
  state: FiveAliveTableState,
  rebuildDeck: () => FiveAliveCardInstance[]
): void {
  if (state.drawDeck.length > 0) return;
  if (state.discardPile.length > 0) {
    state.drawDeck = shuffle(state.discardPile);
    state.discardPile = [];
    return;
  }
  state.drawDeck = rebuildDeck();
}

export function drawIntoHand(
  state: FiveAliveTableState,
  playerId: string,
  count: number,
  rebuildDeck: () => FiveAliveCardInstance[]
): void {
  if (count <= 0) return;
  if (!state.handsByPlayerId[playerId]) state.handsByPlayerId[playerId] = [];

  for (let i = 0; i < count; i++) {
    replenishDrawPile(state, rebuildDeck);
    const drawn = state.drawDeck.pop();
    if (!drawn) {
      state.drawDeck = rebuildDeck();
      const fallback = state.drawDeck.pop();
      if (fallback) state.handsByPlayerId[playerId].push(fallback);
      continue;
    }
    state.handsByPlayerId[playerId].push(drawn);
  }
}

export function clearCenterToDiscard(state: FiveAliveTableState): void {
  if (state.centerPile.length === 0) return;
  state.discardPile.push(...state.centerPile);
  state.centerPile = [];
}

/** Number play would bust (>21). */
export function wouldNumberBust(
  runningTotal: number,
  value: number
): boolean {
  return runningTotal + value > 21;
}

/** Only a number 0 card defuses a Bomb. */
export function isBombDefuseCard(card: FiveAliveCardInstance): boolean {
  return isNumber0(card);
}

/**
 * Collect every living player's hand, shuffle the pool, reset total to 0,
 * clear the center pile, then redeal round-robin starting from the next
 * living seat after `actorId`. Returns animation steps in deal order.
 */
export function shuffleAndRedealHands(
  state: FiveAliveTableState,
  seats: FiveAliveSeat[],
  actorId: string
): import("./dealing").FiveAliveDealStep[] {
  const living = livingSeats(seats);
  const pool: FiveAliveCardInstance[] = [];

  for (const seat of living) {
    pool.push(...(state.handsByPlayerId[seat.id] ?? []));
    state.handsByPlayerId[seat.id] = [];
  }

  state.runningTotal = 0;
  state.pendingDrawCount = 0;
  state.skipNext = false;
  state.repeatTurnForPlayerId = null;
  clearCenterToDiscard(state);

  if (pool.length === 0 || living.length === 0) return [];

  const shuffled = shuffle(pool);
  const startId =
    nextLivingSeatId(seats, actorId, state.direction, 1) ?? living[0]!.id;

  const order: string[] = [];
  let cur: string | null = startId;
  for (let i = 0; i < living.length; i++) {
    if (!cur) break;
    order.push(cur);
    cur = nextLivingSeatId(seats, cur, state.direction, 1);
  }
  if (order.length === 0) return [];

  const steps: import("./dealing").FiveAliveDealStep[] = [];
  let oi = 0;
  for (const card of shuffled) {
    const pid = order[oi % order.length]!;
    if (!state.handsByPlayerId[pid]) state.handsByPlayerId[pid] = [];
    const cardIndex = state.handsByPlayerId[pid].length;
    state.handsByPlayerId[pid].push(card);
    steps.push({ playerId: pid, cardIndex });
    oi += 1;
  }

  return steps;
}

function seatName(seats: FiveAliveSeat[], id: string): string {
  return seats.find((s) => s.id === id)?.name ?? "Someone";
}

/**
 * Resolve a card played during fivealive_turn (card already removed from hand
 * and placed on center pile).
 */
export function resolveFiveAliveTurnPlay(
  state: FiveAliveTableState,
  card: FiveAliveCardInstance,
  actorId: string,
  seats: FiveAliveSeat[]
): FiveAlivePlayResult {
  const actorName = seatName(seats, actorId);
  const living = livingCount(seats);

  state.repeatTurnForPlayerId = null;

  switch (card.type) {
    case "number": {
      const tentative = state.runningTotal + card.value;
      if (tentative > 21) {
        return {
          kind: "bust",
          logs: [`${actorName} busts (>21) — lose 1 life, reset to 0.`],
          actorId,
          reason: ">21",
        };
      }
      state.runningTotal = tentative;
      return {
        kind: "advance",
        logs: [`${actorName} plays ${cardLabel(card)} (total: ${state.runningTotal}).`],
        actorId,
      };
    }

    case "reset0":
      state.runningTotal = 0;
      return {
        kind: "advance",
        logs: [`${actorName} plays =0 (total: 0).`],
        actorId,
      };

    case "eq10":
      state.runningTotal = 10;
      return {
        kind: "advance",
        logs: [`${actorName} plays =10 (total: 10).`],
        actorId,
      };

    case "eq21":
      state.runningTotal = 21;
      return {
        kind: "advance",
        logs: [`${actorName} plays =21 (total: 21).`],
        actorId,
      };

    case "draw1":
      state.pendingDrawCount = 1;
      return {
        kind: "advance",
        logs: [`${actorName} plays Draw 1.`],
        actorId,
      };

    case "draw2":
      state.pendingDrawCount = 2;
      return {
        kind: "advance",
        logs: [`${actorName} plays Draw 2.`],
        actorId,
      };

    case "skip":
      state.skipNext = true;
      return {
        kind: "advance",
        logs: [`${actorName} plays Skip.`],
        actorId,
      };

    case "reverse": {
      state.direction = state.direction === 1 ? -1 : 1;
      if (living === 2) {
        state.repeatTurnForPlayerId = actorId;
        return {
          kind: "repeat_turn",
          logs: [`${actorName} plays Reverse (2 players — play again).`],
          actorId,
        };
      }
      return {
        kind: "advance",
        logs: [`${actorName} plays Reverse.`],
        actorId,
      };
    }

    case "passmeby":
      return {
        kind: "advance",
        logs: [`${actorName} plays Pass By Me — turn passes to the next player.`],
        actorId,
      };

    case "shuffle": {
      const dealSteps = shuffleAndRedealHands(state, seats, actorId);
      return {
        kind: "shuffle",
        logs: [
          `${actorName} plays Shuffle — hands collected, total reset to 0, redealing from next player.`,
        ],
        actorId,
        dealSteps,
      };
    }

    case "bomb":
      state.runningTotal = 0;
      state.skipNext = false;
      state.pendingDrawCount = 0;
      return {
        kind: "bomb",
        logs: [`${actorName} plays Bomb — running total reset to 0.`],
        actorId,
      };

    default:
      return {
        kind: "advance",
        logs: [`${actorName} plays a card.`],
        actorId,
      };
  }
}

/** Build bomb responder queue (every living player except actor). */
export function bombResponderIds(
  seats: FiveAliveSeat[],
  actorId: string,
  direction: 1 | -1
): string[] {
  const living = livingSeats(seats);
  if (living.length <= 1) return [];

  const n = seats.length;
  const actorIdx = seats.findIndex((s) => s.id === actorId);
  const responders: string[] = [];
  let idx = actorIdx;

  while (responders.length < living.length - 1) {
    idx = (idx + direction + n) % n;
    const candidate = seats[idx];
    if (
      candidate &&
      candidate.alive &&
      candidate.lives > 0 &&
      candidate.id !== actorId &&
      !responders.includes(candidate.id)
    ) {
      responders.push(candidate.id);
    }
    if (idx === actorIdx && responders.length >= living.length - 1) break;
    if (idx === actorIdx && responders.length < living.length - 1) break;
  }

  return responders;
}

/** Returns whether others should lose a life when `actorId` emptied their hand. */
export function shouldPenalizeOnEmptyHand(
  seats: FiveAliveSeat[],
  actorId: string
): boolean {
  const actor = seats.find((s) => s.id === actorId);
  return !!actor?.alive && actor.lives > 0;
}
