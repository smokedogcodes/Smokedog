import type { EkCard, EkCardType } from "./cards";

export type EkPlayerRef = { id: string; name: string; alive: boolean };

export type EkSubPhase = "play" | "draw";

export type EkPendingAction =
  | { kind: "nope"; actionLabel: string; actorId: string }
  | { kind: "favor_pick_target"; actorId: string }
  | { kind: "favor_give"; fromId: string; toId: string }
  | { kind: "steal_pair"; actorId: string }
  | { kind: "triple_declare"; actorId: string }
  | { kind: "pick_discard"; actorId: string }
  | { kind: "defuse_insert"; playerId: string };

export type EkGameState = {
  drawDeck: EkCard[];
  discardPile: EkCard[];
  handsByPlayerId: Record<string, EkCard[]>;
  turnPlayerId: string | null;
  turnOrder: string[];
  turnsRemaining: number;
  subPhase: EkSubPhase;
  pendingAction: EkPendingAction | null;
  nopeStack: { playerId: string; cardId: string }[];
  nopeWindowEndsAt: number | null;
  seeFutureByPlayer: Record<string, EkCard[]>;
  defusePlayerId: string | null;
  pendingKitten: EkCard | null;
  pendingDefuseCard: EkCard | null;
  stealActorId: string | null;
  pickDiscardPlayerId: string | null;
  favorFromId: string | null;
  favorToId: string | null;
  tripleActorId: string | null;
  tripleTargetId: string | null;
  tripleDemandedType: EkCardType | null;
  winnerId: string | null;
  pendingNopeCards: EkCard[] | null;
  pendingNopeType: "action" | null;
};

export type EkActionResult = {
  logs: string[];
  phase?: "ek_turn" | "ek_defuse" | "ek_steal" | "ek_pick_discard" | "ek_favor" | "ek_triple";
  gameOver?: boolean;
};
