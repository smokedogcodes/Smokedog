import { CODENAMES_WORDS } from "./words";
import type {
  CodenamesCardType,
  CodenamesPublicCard,
  CodenamesPublicState,
  CodenamesRole,
  CodenamesTeam,
} from "@/lib/types";

export interface CodenamesCard {
  id: number;
  word: string;
  type: CodenamesCardType;
  revealed: boolean;
}

export interface CodenamesRoomState {
  cards: CodenamesCard[];
  currentTurn: CodenamesTeam;
  turnSubPhase: "clue" | "guess";
  startingTeam: CodenamesTeam;
  currentClue: {
    word: string;
    number: number;
  } | null;
  guessesRemaining: number;
  winner: CodenamesTeam | null;
  winReason?: "agents" | "assassin";
  teams: {
    red: {
      spymasterId: string | null;
      operativeIds: string[];
    };
    blue: {
      spymasterId: string | null;
      operativeIds: string[];
    };
  };
  turnEndsAt: number | null;
  log: Array<{
    text: string;
    team: CodenamesTeam;
    at: number;
  }>;
}

/**
 * Generate 25 unique cards and shuffle identities according to standard Codenames:
 * - Starting team: 9 cards
 * - Opponent team: 8 cards
 * - Neutral Bystanders: 7 cards
 * - Assassin: 1 card
 */
export function generateCodenamesBoard(startingTeam: CodenamesTeam): CodenamesCard[] {
  // Shuffle words array and pick 25 unique words
  const wordsShuffled = [...CODENAMES_WORDS].sort(() => Math.random() - 0.5);
  const selectedWords = wordsShuffled.slice(0, 25);

  const otherTeam: CodenamesTeam = startingTeam === "red" ? "blue" : "red";

  // Build the 25 identities
  const identities: CodenamesCardType[] = [
    ...Array(9).fill(startingTeam),
    ...Array(8).fill(otherTeam),
    ...Array(7).fill("neutral"),
    "assassin",
  ];

  // Shuffle identities
  identities.sort(() => Math.random() - 0.5);

  return selectedWords.map((word, idx) => ({
    id: idx,
    word,
    type: identities[idx]!,
    revealed: false,
  }));
}

/**
 * Validates a clue submitted by a Spymaster.
 * Rules:
 * - Single word (no spaces or hyphens)
 * - Must be at least 2 letters
 * - Cannot match an unrevealed word on the board (case-insensitive)
 * - Number must be between 0 and 9 (0 = unlimited guesses under standard rules)
 */
export function validateClue(
  word: string,
  number: number,
  cards: CodenamesCard[]
): { valid: boolean; error?: string } {
  const trimmed = word.trim().toUpperCase();

  if (!trimmed) {
    return { valid: false, error: "Clue cannot be empty." };
  }

  if (/\s/.test(trimmed)) {
    return { valid: false, error: "Clue must be a single word (no spaces)." };
  }

  if (trimmed.length < 2) {
    return { valid: false, error: "Clue must be at least 2 letters." };
  }

  if (number < 0 || number > 9 || !Number.isInteger(number)) {
    return { valid: false, error: "Number must be an integer between 0 and 9." };
  }

  // Check if clue matches any unrevealed word on the board
  const unrevealed = cards.filter((c) => !c.revealed).map((c) => c.word.toUpperCase());
  if (unrevealed.includes(trimmed)) {
    return {
      valid: false,
      error: `Clue cannot be "${trimmed}" because it is an unrevealed card on the board!`,
    };
  }

  return { valid: true };
}

/**
 * Helper to count remaining unrevealed agents for each team.
 */
export function getRemainingAgentCounts(cards: CodenamesCard[]): { red: number; blue: number } {
  let red = 0;
  let blue = 0;
  for (const c of cards) {
    if (!c.revealed) {
      if (c.type === "red") red++;
      if (c.type === "blue") blue++;
    }
  }
  return { red, blue };
}

/**
 * Apply an operative's card guess:
 * Returns status result.
 */
export function applyCardGuess(
  state: CodenamesRoomState,
  cardIndex: number
): {
  card: CodenamesCard;
  turnEnded: boolean;
  gameEnded: boolean;
  winner: CodenamesTeam | null;
  winReason?: "agents" | "assassin";
} {
  const card = state.cards[cardIndex];
  if (!card || card.revealed) {
    throw new Error("Invalid or already revealed card.");
  }

  card.revealed = true;
  const currentTeam = state.currentTurn;
  const opponentTeam: CodenamesTeam = currentTeam === "red" ? "blue" : "red";

  // Case 1: Assassin clicked -> Instant loss for current team, opponent wins!
  if (card.type === "assassin") {
    state.winner = opponentTeam;
    state.winReason = "assassin";
    state.log.push({
      text: `${currentTeam.toUpperCase()} Operatives contacted the ASSASSIN! ${opponentTeam.toUpperCase()} team wins!`,
      team: opponentTeam,
      at: Date.now(),
    });
    return {
      card,
      turnEnded: true,
      gameEnded: true,
      winner: opponentTeam,
      winReason: "assassin",
    };
  }

  const { red, blue } = getRemainingAgentCounts(state.cards);

  // Check if either team has found all agents
  if (red === 0) {
    state.winner = "red";
    state.winReason = "agents";
    state.log.push({
      text: `RED team identified all secret agents and WON the game!`,
      team: "red",
      at: Date.now(),
    });
    return {
      card,
      turnEnded: true,
      gameEnded: true,
      winner: "red",
      winReason: "agents",
    };
  }

  if (blue === 0) {
    state.winner = "blue";
    state.winReason = "agents";
    state.log.push({
      text: `BLUE team identified all secret agents and WON the game!`,
      team: "blue",
      at: Date.now(),
    });
    return {
      card,
      turnEnded: true,
      gameEnded: true,
      winner: "blue",
      winReason: "agents",
    };
  }

  // Case 2: Own team card guessed correctly!
  if (card.type === currentTeam) {
    state.guessesRemaining -= 1;
    state.log.push({
      text: `${currentTeam.toUpperCase()} guessed "${card.word}" — CORRECT Agent!`,
      team: currentTeam,
      at: Date.now(),
    });

    // If no more guesses remaining, turn ends and switches to other team's Spymaster
    if (state.guessesRemaining <= 0) {
      state.currentTurn = opponentTeam;
      state.turnSubPhase = "clue";
      state.currentClue = null;
      state.log.push({
        text: `${currentTeam.toUpperCase()} has no more guesses. Turn passes to ${opponentTeam.toUpperCase()}.`,
        team: opponentTeam,
        at: Date.now(),
      });
      return { card, turnEnded: true, gameEnded: false, winner: null };
    }

    // Still has guesses, can continue or end turn
    return { card, turnEnded: false, gameEnded: false, winner: null };
  }

  // Case 3: Opponent team card guessed -> gives opponent a free point and ends turn immediately
  if (card.type === opponentTeam) {
    state.log.push({
      text: `${currentTeam.toUpperCase()} guessed "${card.word}" — OPPONENT Agent! Turn ended.`,
      team: opponentTeam,
      at: Date.now(),
    });
    state.currentTurn = opponentTeam;
    state.turnSubPhase = "clue";
    state.currentClue = null;
    return { card, turnEnded: true, gameEnded: false, winner: null };
  }

  // Case 4: Neutral bystander guessed -> ends turn immediately
  state.log.push({
    text: `${currentTeam.toUpperCase()} guessed "${card.word}" — Innocent Bystander. Turn ended.`,
    team: currentTeam,
    at: Date.now(),
  });
  state.currentTurn = opponentTeam;
  state.turnSubPhase = "clue";
  state.currentClue = null;
  return { card, turnEnded: true, gameEnded: false, winner: null };
}

/**
 * End turn voluntarily by Operatives.
 */
export function endOperativesTurn(state: CodenamesRoomState): void {
  const opponentTeam: CodenamesTeam = state.currentTurn === "red" ? "blue" : "red";
  state.log.push({
    text: `${state.currentTurn.toUpperCase()} Operatives ended their turn.`,
    team: state.currentTurn,
    at: Date.now(),
  });
  state.currentTurn = opponentTeam;
  state.turnSubPhase = "clue";
  state.currentClue = null;
  state.guessesRemaining = 0;
}

/**
 * Public state projector with anti-cheat masking:
 * If viewer is a Spymaster or the game is over, reveals all card types.
 * Otherwise, reveals card type ONLY if revealed === true!
 */
export function projectCodenamesPublic(
  state: CodenamesRoomState,
  viewerPlayerId: string | null
): CodenamesPublicState {
  const isRedSpymaster = viewerPlayerId != null && state.teams.red.spymasterId === viewerPlayerId;
  const isBlueSpymaster = viewerPlayerId != null && state.teams.blue.spymasterId === viewerPlayerId;
  const isSpymaster = isRedSpymaster || isBlueSpymaster;
  const isGameOver = state.winner != null;

  const canSeeAllIdentities = isSpymaster || isGameOver;

  const publicCards: CodenamesPublicCard[] = state.cards.map((c) => ({
    id: c.id,
    word: c.word,
    revealed: c.revealed,
    type: canSeeAllIdentities || c.revealed ? c.type : undefined,
  }));

  const { red: redRemaining, blue: blueRemaining } = getRemainingAgentCounts(state.cards);
  const redTotal = state.startingTeam === "red" ? 9 : 8;
  const blueTotal = state.startingTeam === "blue" ? 9 : 8;

  return {
    cards: publicCards,
    currentTurn: state.currentTurn,
    turnSubPhase: state.turnSubPhase,
    startingTeam: state.startingTeam,
    redScore: redRemaining,
    blueScore: blueRemaining,
    redTotal,
    blueTotal,
    currentClue: state.currentClue,
    guessesRemaining: state.guessesRemaining,
    winner: state.winner,
    winReason: state.winReason,
    teams: {
      red: {
        spymasterId: state.teams.red.spymasterId,
        operativeIds: [...state.teams.red.operativeIds],
      },
      blue: {
        spymasterId: state.teams.blue.spymasterId,
        operativeIds: [...state.teams.blue.operativeIds],
      },
    },
    log: [...state.log],
  };
}

/**
 * Auto balance players into Red and Blue teams with 1 Spymaster each.
 */
export function autoBalanceTeams(playerIds: string[]): {
  red: { spymasterId: string | null; operativeIds: string[] };
  blue: { spymasterId: string | null; operativeIds: string[] };
} {
  const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
  const redPlayers: string[] = [];
  const bluePlayers: string[] = [];

  shuffled.forEach((pid, idx) => {
    if (idx % 2 === 0) redPlayers.push(pid);
    else bluePlayers.push(pid);
  });

  return {
    red: {
      spymasterId: redPlayers[0] ?? null,
      operativeIds: redPlayers.slice(1),
    },
    blue: {
      spymasterId: bluePlayers[0] ?? null,
      operativeIds: bluePlayers.slice(1),
    },
  };
}
