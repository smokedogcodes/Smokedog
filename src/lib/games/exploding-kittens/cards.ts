import { randomUUID } from "crypto";

export const EXPLODING_KITTENS_ID = "exploding-kittens";

export type EkCardType =
  | "exploding_kitten"
  | "defuse"
  | "skip"
  | "attack"
  | "favor"
  | "shuffle"
  | "see_future"
  | "nope"
  | "taco_cat"
  | "beard_cat"
  | "rainbow_ralphing_cat"
  | "hairy_potato_cat"
  | "cattermelon";

export type EkCard = { id: string; type: EkCardType };

export type EkCatType = Extract<
  EkCardType,
  | "taco_cat"
  | "beard_cat"
  | "rainbow_ralphing_cat"
  | "hairy_potato_cat"
  | "cattermelon"
>;

export const EK_CAT_TYPES: EkCatType[] = [
  "taco_cat",
  "beard_cat",
  "rainbow_ralphing_cat",
  "hairy_potato_cat",
  "cattermelon",
];

export function isCatType(type: EkCardType): type is EkCatType {
  return (EK_CAT_TYPES as EkCardType[]).includes(type);
}

export function makeCard(type: EkCardType): EkCard {
  return { id: randomUUID(), type };
}

export function cardLabel(card: Pick<EkCard, "type">): string {
  switch (card.type) {
    case "exploding_kitten":
      return "Exploding Kitten";
    case "defuse":
      return "Defuse";
    case "skip":
      return "Skip";
    case "attack":
      return "Attack (2x)";
    case "favor":
      return "Favor";
    case "shuffle":
      return "Shuffle";
    case "see_future":
      return "See the Future (3x)";
    case "nope":
      return "Nope";
    case "taco_cat":
      return "Taco Cat";
    case "beard_cat":
      return "Beard Cat";
    case "rainbow_ralphing_cat":
      return "Rainbow-Ralphing Cat";
    case "hairy_potato_cat":
      return "Hairy Potato Cat";
    case "cattermelon":
      return "Cattermelon";
  }
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]!];
  }
  return out;
}

function add(cards: EkCard[], type: EkCardType, copies: number) {
  for (let i = 0; i < copies; i++) cards.push(makeCard(type));
}

/** 50-card action + cat pool (no EK, no Defuse). */
export function buildActionPool(): EkCard[] {
  const cards: EkCard[] = [];
  add(cards, "skip", 4);
  add(cards, "attack", 4);
  add(cards, "favor", 4);
  add(cards, "shuffle", 4);
  add(cards, "see_future", 5);
  add(cards, "nope", 5);
  for (const cat of EK_CAT_TYPES) add(cards, cat, 4);
  return cards;
}

export function dealFromPool(pool: EkCard[], count: number): EkCard[] {
  const out: EkCard[] = [];
  while (out.length < count && pool.length > 0) {
    const c = pool.shift();
    if (c) out.push(c);
  }
  return out;
}
