import { randomUUID } from "crypto";
import { cardLabel, isCatType, shuffle, type EkCard } from "./cards";
import {
  drawTop,
  insertIntoDeck,
  matchingCatCount,
  nextAlivePlayerId,
  peekTop,
  shuffleDeck,
  stealRandomCard,
  takeCardsFromHand,
  transferOneCardOfType,
} from "./logic";
import type { EkActionResult, EkGameState, EkPlayerRef } from "./state";
import { actionLabel } from "./validate";

const NOPE_WINDOW_MS = 4000;

export function aliveSet(players: EkPlayerRef[]): Set<string> {
  return new Set(players.filter((p) => p.alive).map((p) => p.id));
}

export function ekMaybeWin(
  players: EkPlayerRef[],
  turnOrder: string[]
): string | null {
  const living = turnOrder.filter((id) => {
    const p = players.find((x) => x.id === id);
    return p?.alive;
  });
  if (living.length === 1) return living[0]!;
  return null;
}

function playerName(players: EkPlayerRef[], id: string): string {
  return players.find((p) => p.id === id)?.name ?? "Player";
}

function clearNope(state: EkGameState) {
  state.nopeStack = [];
  state.nopeWindowEndsAt = null;
  state.pendingAction = null;
}

function openNopeWindow(
  state: EkGameState,
  actorId: string,
  label: string
) {
  state.pendingAction = { kind: "nope", actionLabel: label, actorId };
  state.nopeWindowEndsAt = Date.now() + NOPE_WINDOW_MS;
}

function isNopeCancelled(state: EkGameState): boolean {
  return state.nopeStack.length % 2 === 1;
}

function finishTurnAfterDraw(state: EkGameState, players: EkPlayerRef[], actorId: string) {
  state.seeFutureByPlayer = {};
  if (state.turnsRemaining > 1) {
    state.turnsRemaining -= 1;
    state.subPhase = "play";
    return;
  }
  state.turnsRemaining = 1;
  state.subPhase = "play";
  const alive = aliveSet(players);
  const next = nextAlivePlayerId(state.turnOrder, actorId, alive);
  state.turnPlayerId = next;
}

function advanceAfterSkipOrAttack(
  state: EkGameState,
  players: EkPlayerRef[],
  actorId: string,
  endWithoutDraw: boolean
) {
  state.seeFutureByPlayer = {};
  if (endWithoutDraw) {
    if (state.turnsRemaining > 1) {
      state.turnsRemaining -= 1;
      state.subPhase = "play";
      return;
    }
    state.turnsRemaining = 1;
    state.subPhase = "play";
    const alive = aliveSet(players);
    const next = nextAlivePlayerId(state.turnOrder, actorId, alive);
    state.turnPlayerId = next;
    return;
  }
  state.subPhase = "draw";
}

export function ekPlayCards(
  state: EkGameState,
  players: EkPlayerRef[],
  actorId: string,
  cards: EkCard[]
): EkActionResult {
  const logs: string[] = [];
  state.discardPile.push(...cards);
  const name = playerName(players, actorId);
  const label = actionLabel(cards);

  if (cards.length === 1 && !isCatType(cards[0]!.type)) {
    const card = cards[0]!;
    state.pendingNopeCards = [card];
    state.pendingNopeType = "action";
    openNopeWindow(state, actorId, cardLabel(card));
    logs.push(`${name} plays ${cardLabel(card)}.`);
    return { logs, phase: "ek_turn" };
  }

  if (cards.length === 1 && isCatType(cards[0]!.type)) {
    logs.push(`${name} plays ${cardLabel(cards[0]!)}.`);
    return { logs, phase: "ek_turn" };
  }

  const combo = matchingCatCount(
    [...cards, ...(state.handsByPlayerId[actorId] ?? [])],
    cards.map((c) => c.id)
  );

  if (cards.length === 2 && combo.count === 2) {
    state.stealActorId = actorId;
    state.pendingAction = { kind: "steal_pair", actorId };
    logs.push(`${name} plays Two of a Kind — pick a player to steal from.`);
    return { logs, phase: "ek_steal" };
  }

  if (cards.length === 3 && combo.count === 3) {
    state.tripleActorId = actorId;
    state.pendingAction = { kind: "triple_declare", actorId };
    logs.push(`${name} plays Three of a Kind — name a card to demand.`);
    return { logs, phase: "ek_triple" };
  }

  if (cards.length === 5 && combo.allDistinct) {
    state.pickDiscardPlayerId = actorId;
    state.pendingAction = { kind: "pick_discard", actorId };
    logs.push(`${name} plays Five Different Cats — pick from the discard pile.`);
    return { logs, phase: "ek_pick_discard" };
  }

  logs.push(`${name} plays ${label}.`);
  return { logs, phase: "ek_turn" };
}

export function ekResolveNopeWindow(
  state: EkGameState,
  players: EkPlayerRef[]
): EkActionResult {
  const actorId =
    state.pendingAction?.kind === "nope" ? state.pendingAction.actorId : "";
  const pendingCards = state.pendingNopeCards ?? [];
  const pendingType = state.pendingNopeType ?? "action";
  const name = playerName(players, actorId);
  const logs: string[] = [];

  if (isNopeCancelled(state)) {
    for (const pc of pendingCards) {
      const idx = state.discardPile.findIndex((c) => c.id === pc.id);
      if (idx >= 0) {
        const [c] = state.discardPile.splice(idx, 1);
        if (c) {
          const hand = state.handsByPlayerId[actorId] ?? [];
          hand.push(c);
          state.handsByPlayerId[actorId] = hand;
        }
      }
    }
    logs.push(`Nope! ${name}'s action was cancelled.`);
    state.pendingNopeCards = null;
    state.pendingNopeType = null;
    clearNope(state);
    return { logs, phase: "ek_turn" };
  }

  state.pendingNopeCards = null;
  state.pendingNopeType = null;
  clearNope(state);
  const card = pendingCards[0];
  if (!card) return { logs, phase: "ek_turn" };

  if (pendingType === "action" && !isCatType(card.type)) {
    return ekResolveAction(state, players, actorId, card, logs);
  }

  return { logs, phase: "ek_turn" };
}

function ekResolveAction(
  state: EkGameState,
  players: EkPlayerRef[],
  actorId: string,
  card: EkCard,
  logs: string[]
): EkActionResult {
  const name = playerName(players, actorId);
  switch (card.type) {
    case "skip":
      logs.push(`${name}'s Skip resolves.`);
      advanceAfterSkipOrAttack(state, players, actorId, true);
      return { logs, phase: "ek_turn" };
    case "attack": {
      const remaining = state.turnsRemaining;
      const alive = aliveSet(players);
      const next = nextAlivePlayerId(state.turnOrder, actorId, alive);
      state.turnPlayerId = next;
      state.turnsRemaining = Math.max(1, remaining - 1) + 2;
      state.subPhase = "play";
      logs.push(`${name}'s Attack passes ${state.turnsRemaining} turns to ${playerName(players, next ?? "")}.`);
      return { logs, phase: "ek_turn" };
    }
    case "shuffle":
      shuffleDeck(state.drawDeck);
      logs.push(`${name} shuffles the draw pile.`);
      state.subPhase = "draw";
      return { logs, phase: "ek_turn" };
    case "see_future": {
      const peek = peekTop(state.drawDeck, 3);
      state.seeFutureByPlayer[actorId] = peek;
      logs.push(`${name} sees the future (${peek.length} cards).`);
      state.subPhase = "draw";
      return { logs, phase: "ek_turn" };
    }
    case "favor": {
      const aliveOthers = players.filter((p) => p.alive && p.id !== actorId);
      if (aliveOthers.length === 1) {
        const target = aliveOthers[0]!;
        state.favorFromId = actorId;
        state.favorToId = target.id;
        state.pendingAction = { kind: "favor_give", fromId: target.id, toId: actorId };
        logs.push(`${name} plays Favor on ${target.name}.`);
        return { logs, phase: "ek_favor" };
      }
      state.favorFromId = actorId;
      state.pendingAction = { kind: "favor_pick_target", actorId };
      logs.push(`${name} plays Favor — pick a target.`);
      return { logs, phase: "ek_favor" };
    }
    default:
      state.subPhase = "draw";
      return { logs, phase: "ek_turn" };
  }
}

export function ekBeginDrawPhase(state: EkGameState, actorId: string): EkActionResult {
  if (state.turnPlayerId !== actorId) return { logs: [] };
  state.subPhase = "draw";
  return { logs: [] };
}

export function ekDraw(
  state: EkGameState,
  players: EkPlayerRef[],
  actorId: string,
  rng: () => number = Math.random
): EkActionResult {
  const name = playerName(players, actorId);
  const drawn = drawTop(state.drawDeck);
  if (!drawn) {
    return { logs: [`${name} tries to draw but the deck is empty.`], phase: "ek_turn" };
  }

  if (drawn.type !== "exploding_kitten") {
    const hand = state.handsByPlayerId[actorId] ?? [];
    hand.push(drawn);
    state.handsByPlayerId[actorId] = hand;
    finishTurnAfterDraw(state, players, actorId);
    return {
      logs: [`${name} draws ${cardLabel(drawn)}.`],
      phase: "ek_turn",
    };
  }

  const hand = state.handsByPlayerId[actorId] ?? [];
  const defIdx = hand.findIndex((c) => c.type === "defuse");
  if (defIdx < 0) {
    const actor = players.find((p) => p.id === actorId);
    if (actor) actor.alive = false;
    state.discardPile.push(drawn);
    for (const c of hand) state.discardPile.push(c);
    state.handsByPlayerId[actorId] = [];
    const winner = ekMaybeWin(players, state.turnOrder);
    if (winner) {
      state.winnerId = winner;
      return {
        logs: [`${name} explodes and is out!`],
        phase: "ek_turn",
        gameOver: true,
      };
    }
    finishTurnAfterDraw(state, players, actorId);
    return { logs: [`${name} explodes and is out!`], phase: "ek_turn" };
  }

  const [defuse] = hand.splice(defIdx, 1);
  state.handsByPlayerId[actorId] = hand;
  state.defusePlayerId = actorId;
  state.pendingKitten = drawn;
  state.pendingDefuseCard = defuse ?? null;
  state.discardPile.push(drawn);
  state.pendingAction = { kind: "defuse_insert", playerId: actorId };
  return {
    logs: [`${name} draws an Exploding Kitten — must Defuse!`],
    phase: "ek_defuse",
  };
}

export function ekPlaceDefuse(
  state: EkGameState,
  players: EkPlayerRef[],
  playerId: string,
  deckIndex: number
): EkActionResult {
  const kitten = state.pendingKitten;
  const defuse = state.pendingDefuseCard;
  if (!kitten || !defuse) return { logs: [] };

  insertIntoDeck(state.drawDeck, deckIndex, kitten);
  state.discardPile.push(defuse);
  state.defusePlayerId = null;
  state.pendingKitten = null;
  state.pendingDefuseCard = null;
  state.pendingAction = null;

  const name = playerName(players, playerId);
  finishTurnAfterDraw(state, players, playerId);
  return {
    logs: [`${name} hides the Exploding Kitten in the deck.`],
    phase: "ek_turn",
  };
}

export function ekPlayNope(
  state: EkGameState,
  playerId: string,
  cardId: string
): EkActionResult | null {
  if (!state.nopeWindowEndsAt || Date.now() > state.nopeWindowEndsAt) return null;
  const hand = state.handsByPlayerId[playerId] ?? [];
  const idx = hand.findIndex((c) => c.id === cardId && c.type === "nope");
  if (idx < 0) return null;
  const [nope] = hand.splice(idx, 1);
  if (!nope) return null;
  state.discardPile.push(nope);
  state.nopeStack.push({ playerId, cardId: nope.id });
  state.nopeWindowEndsAt = Date.now() + NOPE_WINDOW_MS;
  return { logs: [`${playerId} plays Nope!`] };
}

export function ekStealTarget(
  state: EkGameState,
  players: EkPlayerRef[],
  actorId: string,
  targetId: string,
  rng: () => number = Math.random
): EkActionResult {
  const fromHand = state.handsByPlayerId[targetId] ?? [];
  const toHand = state.handsByPlayerId[actorId] ?? [];
  if (fromHand.length === 0) return { logs: [] };
  const stolen = stealRandomCard(fromHand, toHand, rng);
  state.stealActorId = null;
  state.pendingAction = null;
  const logs = stolen
    ? [
        `${playerName(players, actorId)} steals ${cardLabel(stolen)} from ${playerName(players, targetId)}.`,
      ]
    : [];
  state.subPhase = "draw";
  return { logs, phase: "ek_turn" };
}

export function ekPickDiscard(
  state: EkGameState,
  players: EkPlayerRef[],
  playerId: string,
  discardIndex: number
): EkActionResult {
  const idx = Math.max(0, Math.min(state.discardPile.length - 1, discardIndex));
  const picked = state.discardPile.splice(idx, 1)[0] ?? null;
  if (picked) {
    const hand = state.handsByPlayerId[playerId] ?? [];
    hand.push(picked);
    state.handsByPlayerId[playerId] = hand;
  }
  state.pickDiscardPlayerId = null;
  state.pendingAction = null;
  state.subPhase = "draw";
  return {
    logs: picked
      ? [`${playerName(players, playerId)} takes ${cardLabel(picked)} from discard.`]
      : [],
    phase: "ek_turn",
  };
}

export function ekFavorTarget(
  state: EkGameState,
  actorId: string,
  targetId: string
): EkActionResult {
  state.favorFromId = actorId;
  state.favorToId = targetId;
  state.pendingAction = { kind: "favor_give", fromId: targetId, toId: actorId };
  return { logs: [], phase: "ek_favor" };
}

export function ekFavorGive(
  state: EkGameState,
  players: EkPlayerRef[],
  fromId: string,
  cardId: string
): EkActionResult {
  const toId = state.favorToId;
  if (!toId) return { logs: [] };
  const fromHand = state.handsByPlayerId[fromId] ?? [];
  const idx = fromHand.findIndex((c) => c.id === cardId);
  if (idx < 0) return { logs: [] };
  const [card] = fromHand.splice(idx, 1);
  if (!card) return { logs: [] };
  const toHand = state.handsByPlayerId[toId] ?? [];
  toHand.push(card);
  state.handsByPlayerId[toId] = toHand;
  state.favorFromId = null;
  state.favorToId = null;
  state.pendingAction = null;
  state.subPhase = "draw";
  return {
    logs: [
      `${playerName(players, fromId)} gives a card to ${playerName(players, toId)}.`,
    ],
    phase: "ek_turn",
  };
}

export function ekTripleDeclare(
  state: EkGameState,
  players: EkPlayerRef[],
  actorId: string,
  targetId: string,
  demandedType: EkCard["type"]
): EkActionResult {
  state.tripleActorId = actorId;
  state.tripleTargetId = targetId;
  state.tripleDemandedType = demandedType;
  const fromHand = state.handsByPlayerId[targetId] ?? [];
  const toHand = state.handsByPlayerId[actorId] ?? [];
  const transferred = transferOneCardOfType(fromHand, toHand, demandedType);
  state.tripleActorId = null;
  state.tripleTargetId = null;
  state.tripleDemandedType = null;
  state.pendingAction = null;
  state.subPhase = "draw";
  const logs = transferred
    ? [
        `${playerName(players, actorId)} demands ${cardLabel({ type: demandedType })} — ${playerName(players, targetId)} surrenders one.`,
      ]
    : [
        `${playerName(players, actorId)} demands ${cardLabel({ type: demandedType })} — ${playerName(players, targetId)} has none.`,
      ];
  return { logs, phase: "ek_turn" };
}

export function ekRandomDefuseIndex(deckSize: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * (deckSize + 1));
}

export function newEkLog(text: string) {
  return { id: randomUUID(), text, at: Date.now() };
}

export function toPublicEkCard(card: EkCard) {
  return { id: card.id, type: card.type };
}

export { validatePlayCards } from "./validate";
