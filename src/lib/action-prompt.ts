import { nightActionFor } from "@/lib/games/mafia-city/roles";
import { handHasPlayableCard } from "@/lib/games/5-alive/rules";
import type { PublicGameState } from "@/lib/types";

export const NIGHT_ACTION_PROMPTS: Record<
  import("@/lib/types").NightActionType,
  string
> = {
  mafia_kill: "Mark someone for the hit",
  doctor_protect: "Choose someone to heal",
  detective_inspect: "Investigate an alignment",
  bodyguard_protect: "Stand in front of someone",
  vigilante_shoot: "Fire a round — or skip this night",
  blackmail: "Silence a civilian",
  poison: "Poison someone's power for the night",
};

export const NIGHT_ACTION_LOCKED: Record<
  import("@/lib/types").NightActionType,
  (name: string) => string
> = {
  mafia_kill: (name) => `You marked ${name} for the hit`,
  doctor_protect: (name) => `You will heal ${name}`,
  detective_inspect: (name) => `You are investigating ${name}`,
  bodyguard_protect: (name) => `You are guarding ${name}`,
  vigilante_shoot: (name) =>
    name === "__skip__" ? "You skipped your shot tonight" : `You aimed at ${name}`,
  blackmail: (name) => `You silenced ${name}`,
  poison: (name) => `You poisoned ${name}`,
};

export function pendingPlayerAction(state: PublicGameState): {
  title: string;
  detail: string;
} | null {
  const you = state.you;
  if (!you) return null;

  const deadVillagerVote = !!state.deadVillagerVote;

  if (state.phase === "night") {
    if (!you.alive) return null;
    const type = you.role
      ? (nightActionFor(you.role) as import("@/lib/types").NightActionType | null)
      : null;
    const noBullets = you.role === "vigilante" && (you.bulletsLeft ?? 0) <= 0;
    if (!type || noBullets) return null;
    if (state.submittedNightAction) return null;
    return {
      title: "Action needed",
      detail: NIGHT_ACTION_PROMPTS[type],
    };
  }

  // Vote cue lives in the single "Voting has started" announcement — no second dialog.
  // Juggler nudge can still show in local vote-only days.
  if (state.phase === "day" && state.jugglerAvailable) {
    return {
      title: "Juggle ready",
      detail: "Pick four players once this game to learn how many are evil.",
    };
  }

  if (state.phase === "day" && state.daySubPhase === "vote") {
    return null;
  }

  return null;
}

export function pendingFiveAliveActionPrompt(state: PublicGameState): {
  title: string;
  detail: string;
} | null {
  if (state.gameId !== "five-alive") return null;
  const you = state.you;
  if (!you?.alive) return null;
  const five = state.fiveAlive;
  if (!five) return null;

  if (state.phase === "fivealive_dealing") {
    return {
      title: "Dealing cards",
      detail: "Please wait while hands are dealt…",
    };
  }

  if (state.phase === "fivealive_turn") {
    if (five.turnPlayerId !== you.id) return null;
    const hand = five.yourHand ?? [];
    if (hand.length > 0 && !handHasPlayableCard(hand, five.runningTotal)) {
      return {
        title: "No playable cards",
        detail: "Losing 1 life — total reset to 0.",
      };
    }
    if (five.runningTotal === 21) {
      return {
        title: "Total is 21",
        detail: "Play a non-number card (=0, =10, Skip, Draw, Bomb, etc.).",
      };
    }
    return {
      title: "Play a card",
      detail: `Running total: ${five.runningTotal} (keep ≤ 21)`,
    };
  }

  if (state.phase === "fivealive_bomb") {
    if (five.bombAwaitingPlayerId !== you.id) return null;
    return {
      title: "Bomb response needed",
      detail: `Play a number 0 (or pass to lose 1 life)`,
    };
  }

  return null;
}
