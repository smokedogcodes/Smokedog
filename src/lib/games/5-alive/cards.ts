import { randomUUID } from "crypto";

export type FiveAliveCardType =
  | "number"
  | "eq21"
  | "eq10"
  | "reset0"
  | "skip"
  | "reverse"
  | "passmeby"
  | "shuffle"
  | "draw1"
  | "draw2"
  | "bomb";

export type FiveAliveCardInstance =
  | { id: string; type: "number"; value: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 }
  | { id: string; type: "eq21" }
  | { id: string; type: "eq10" }
  | { id: string; type: "reset0" }
  | { id: string; type: "skip" }
  | { id: string; type: "reverse" }
  | { id: string; type: "passmeby" }
  | { id: string; type: "shuffle" }
  | { id: string; type: "draw1" }
  | { id: string; type: "draw2" }
  | { id: string; type: "bomb" };

/** Standard playable deck composition (life/ALIVE cards are separate).
 *  Per-type counts from the physical deck. Life/ALIVE cards (30) stay out of this pile.
 */
export const FIVE_ALIVE_DECK_COMPOSITION = {
  numbers: {
    0: 8,
    1: 8,
    2: 8,
    3: 8,
    4: 8,
    5: 4,
    6: 2,
    7: 1,
  },
  eq21: 5,
  eq10: 2,
  reset0: 3,
  draw1: 2,
  draw2: 2,
  /** Pass Me By / Skip combined = 10 (distinct effects kept). */
  skip: 6,
  passmeby: 4,
  reverse: 6,
  shuffle: 1,
  bomb: 1,
} as const;

export function isNumber0(
  card: FiveAliveCardInstance
): card is Extract<FiveAliveCardInstance, { type: "number" }> {
  return card.type === "number" && card.value === 0;
}

export function isWild(_card: FiveAliveCardInstance): boolean {
  return false;
}

export function cardLabel(card: FiveAliveCardInstance): string {
  switch (card.type) {
    case "number":
      return String(card.value);
    case "eq21":
      return "=21";
    case "eq10":
      return "=10";
    case "reset0":
      return "=0";
    case "skip":
      return "Skip";
    case "reverse":
      return "Reverse";
    case "passmeby":
      return "Pass By Me";
    case "shuffle":
      return "Shuffle";
    case "draw1":
      return "Draw 1";
    case "draw2":
      return "Draw 2";
    case "bomb":
      return "Bomb";
  }
}

export function buildFiveAliveDeck(): FiveAliveCardInstance[] {
  const cards: FiveAliveCardInstance[] = [];
  const c = FIVE_ALIVE_DECK_COMPOSITION;

  const addNumberValue = (value: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7, copies: number) => {
    for (let i = 0; i < copies; i++) {
      cards.push({ id: randomUUID(), type: "number", value });
    }
  };

  (Object.keys(c.numbers) as unknown as Array<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7>).forEach(
    (v) => addNumberValue(v, c.numbers[v])
  );

  const addNonNumber = (
    type: Exclude<FiveAliveCardInstance["type"], "number">,
    copies: number
  ) => {
    for (let i = 0; i < copies; i++) {
      cards.push({ id: randomUUID(), type } as FiveAliveCardInstance);
    }
  };

  addNonNumber("eq21", c.eq21);
  addNonNumber("eq10", c.eq10);
  addNonNumber("reset0", c.reset0);
  addNonNumber("skip", c.skip);
  addNonNumber("passmeby", c.passmeby);
  addNonNumber("reverse", c.reverse);
  addNonNumber("shuffle", c.shuffle);
  addNonNumber("draw1", c.draw1);
  addNonNumber("draw2", c.draw2);
  addNonNumber("bomb", c.bomb);

  return shuffle(cards);
}

/** Count cards in a freshly built (unshuffled logic) deck for tests/verification. */
export function fiveAliveDeckSize(): number {
  const c = FIVE_ALIVE_DECK_COMPOSITION;
  const numbers = (Object.values(c.numbers) as number[]).reduce((a, b) => a + b, 0);
  return (
    numbers +
    c.eq21 +
    c.eq10 +
    c.reset0 +
    c.skip +
    c.passmeby +
    c.reverse +
    c.shuffle +
    c.draw1 +
    c.draw2 +
    c.bomb
  );
}

export function shuffle<T>(arr: T[]): T[] {
  // Fisher–Yates shuffle
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
