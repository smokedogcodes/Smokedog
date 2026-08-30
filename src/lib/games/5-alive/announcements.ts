import type { FiveAliveCardInstance } from "./cards";
import { cardLabel } from "./cards";
import type { FiveAlivePlayResult, FiveAliveSeat } from "./actions";
import type { FiveAliveTableState } from "./actions";
import { bombResponderIds } from "./actions";

export type FiveAliveAnnouncement = {
  title: string;
  detail: string;
  tone?: "info" | "good" | "bad";
};

function seatName(seats: FiveAliveSeat[], id: string): string {
  return seats.find((s) => s.id === id)?.name ?? "Someone";
}

function seatNames(seats: FiveAliveSeat[], ids: string[]): string {
  if (ids.length === 0) return "no one";
  if (ids.length === 1) return seatName(seats, ids[0]!);
  if (ids.length === 2) {
    return `${seatName(seats, ids[0]!)} and ${seatName(seats, ids[1]!)}`;
  }
  return `${ids
    .slice(0, -1)
    .map((id) => seatName(seats, id))
    .join(", ")}, and ${seatName(seats, ids[ids.length - 1]!)}`;
}

function nextPlayerName(
  seats: FiveAliveSeat[],
  fromId: string,
  state: FiveAliveTableState
): string {
  const n = seats.length;
  const fromIdx = seats.findIndex((s) => s.id === fromId);
  if (fromIdx < 0) return "Next player";
  let idx = fromIdx;
  for (let i = 0; i < n; i++) {
    idx = (idx + state.direction + n) % n;
    const s = seats[idx];
    if (s?.alive && s.lives > 0 && s.id !== fromId) {
      return s.name;
    }
  }
  return "Next player";
}

export function fiveAlivePlayAnnouncement(
  card: FiveAliveCardInstance,
  actorName: string,
  seats: FiveAliveSeat[],
  state: FiveAliveTableState,
  result: FiveAlivePlayResult
): FiveAliveAnnouncement | null {
  const label = cardLabel(card);

  if (result.kind === "bust") {
    return {
      tone: "bad",
      title: `${actorName} busts!`,
      detail: `${result.reason} — loses 1 life. Total reset to 0, new hands dealt.`,
    };
  }

  if (result.kind === "bomb") {
    const responders = bombResponderIds(seats, result.actorId, state.direction);
    return {
      tone: "bad",
      title: `${actorName} plays Bomb!`,
      detail:
        responders.length > 0
          ? `Running total reset to 0. ${seatNames(seats, responders)} need a number 0 to defuse (or lose 1 life).`
          : "Running total reset to 0. No other players to respond.",
    };
  }

  // Number cards update the on-table total — no popup.
  if (card.type === "number") {
    return null;
  }

  switch (card.type) {
    case "eq21":
      return {
        tone: "info",
        title: `${actorName} plays =21`,
        detail: "Running total set to 21 — action cards only until it changes.",
      };
    case "eq10":
      return {
        tone: "info",
        title: `${actorName} plays =10`,
        detail: "Running total set to 10.",
      };
    case "reset0":
      return {
        tone: "info",
        title: `${actorName} plays =0`,
        detail: "Running total reset to 0.",
      };
    case "draw1": {
      const drawer = nextPlayerName(seats, result.actorId, state);
      return {
        tone: "info",
        title: `${actorName} plays Draw 1`,
        detail: `${drawer} will draw 1 card, then turn passes to the player after them.`,
      };
    }
    case "draw2": {
      const drawer = nextPlayerName(seats, result.actorId, state);
      return {
        tone: "info",
        title: `${actorName} plays Draw 2`,
        detail: `${drawer} will draw 2 cards, then turn passes to the player after them.`,
      };
    }
    case "skip": {
      const skipped = nextPlayerName(seats, result.actorId, state);
      return {
        tone: "info",
        title: `${actorName} plays Skip`,
        detail: `${skipped}'s turn is skipped.`,
      };
    }
    case "reverse":
      if (result.kind === "repeat_turn") {
        return {
          tone: "info",
          title: `${actorName} plays Reverse`,
          detail: `With 2 players — ${actorName} plays again.`,
        };
      }
      return {
        tone: "info",
        title: `${actorName} plays Reverse`,
        detail: `Turn order reversed — now ${
          state.direction === 1 ? "counter-clockwise" : "clockwise"
        }.`,
      };
    case "passmeby": {
      const next = nextPlayerName(seats, result.actorId, state);
      return {
        tone: "info",
        title: `${actorName} plays Pass By Me`,
        detail: `Play passes to ${next}. Running total unchanged.`,
      };
    }
    case "shuffle":
      return {
        tone: "info",
        title: `${actorName} plays Shuffle`,
        detail:
          "All hands collected and shuffled. Total reset to 0. Redealing from the next player.",
      };
    default:
      return {
        tone: "info",
        title: `${actorName} plays ${label}`,
        detail: `Running total: ${state.runningTotal}.`,
      };
  }
}

export function fiveAliveBombResponseAnnouncement(
  actorName: string,
  defused: boolean,
  cardLabelText?: string
): FiveAliveAnnouncement {
  if (defused) {
    return {
      tone: "good",
      title: `${actorName} is saved!`,
      detail: cardLabelText
        ? `Auto-played ${cardLabelText} to defuse the bomb.`
        : "Auto-played a number 0 — bomb defused.",
    };
  }
  return {
    tone: "bad",
    title: `${actorName} fails to defuse`,
    detail: "No number 0 — loses 1 life.",
  };
}

export function fiveAlivePassAnnouncement(actorName: string): FiveAliveAnnouncement {
  return {
    tone: "bad",
    title: `${actorName} has no playable cards`,
    detail: "Loses 1 life — total reset to 0. Hands stay the same.",
  };
}
