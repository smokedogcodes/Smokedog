import type { PublicFiveAliveCard } from "@/lib/types";

/** Number card colors from the physical 5 Alive deck. */
export const FA_NUMBER_COLORS: Record<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7, string> = {
  0: "#E53935",
  1: "#FB8C00",
  2: "#FDD835",
  3: "#8E24AA",
  4: "#00838F",
  5: "#D81B60",
  6: "#9EEB00",
  7: "#2E7D32",
};

export type FiveAliveDeckCard = PublicFiveAliveCard;

export type FiveAliveVisualCard = FiveAliveDeckCard & {
  heartColor?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

/** Gallery-only cards from the physical deck. */
export type FiveAliveGalleryOnlyCard = {
  id: string;
  type: "eq10" | "shuffle" | "passmeby";
};

/** Life pile display (not in playable deck). */
export type FiveAliveLifeDisplayCard = {
  id: string;
  type: "life";
  heartColor: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

export type FiveAliveRenderableCard =
  | FiveAliveVisualCard
  | FiveAliveGalleryOnlyCard
  | FiveAliveLifeDisplayCard;

export type FaActionCardType = "reverse" | "passmeby" | "skip" | "shuffle";

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
}

export function faDarken(hex: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const f = 1 - amount;
  return rgbToHex(r * f, g * f, b * f);
}

export function faStripeBackground(mainColor: string): string {
  const edge = faDarken(mainColor, 0.38);
  return `linear-gradient(135deg, ${edge} 0%, ${edge} 21%, ${mainColor} 21%, ${mainColor} 79%, ${edge} 79%, ${edge} 100%)`;
}

export const FA_DEATH_STRIPE =
  "linear-gradient(135deg, #3a3a3a 0%, #3a3a3a 21%, #111111 21%, #111111 79%, #2d2d2d 79%, #2d2d2d 100%)";

export function faAccentColor(card: FiveAliveRenderableCard): string {
  if (card.type === "eq10") return FA_NUMBER_COLORS[4];
  if (card.type === "shuffle") return FA_NUMBER_COLORS[5];
  if (card.type === "passmeby") return FA_NUMBER_COLORS[1];

  switch (card.type) {
    case "number":
      return FA_NUMBER_COLORS[card.value ?? 0] ?? FA_NUMBER_COLORS[0];
    case "reset0":
      return FA_NUMBER_COLORS[6];
    case "eq21":
      return FA_NUMBER_COLORS[3];
    case "draw1":
      return "#1565C0";
    case "draw2":
      return "#00ACC1";
    case "reverse":
      return FA_NUMBER_COLORS[3];
    case "skip":
      return FA_NUMBER_COLORS[5];
    case "bomb":
      return FA_NUMBER_COLORS[0];
    case "life":
      return FA_NUMBER_COLORS[card.heartColor ?? 6];
    default:
      return FA_NUMBER_COLORS[0];
  }
}

export function faIsLifeCard(card: FiveAliveRenderableCard): boolean {
  return card.type === "life";
}

export function faIsDeathCard(_card: FiveAliveRenderableCard): boolean {
  return false;
}

export function faActionType(card: FiveAliveRenderableCard): FaActionCardType | null {
  if (
    card.type === "reverse" ||
    card.type === "skip" ||
    card.type === "shuffle" ||
    card.type === "passmeby"
  ) {
    return card.type;
  }
  return null;
}

export function faCenterLabel(card: FiveAliveRenderableCard): string {
  if (card.type === "eq10") return "=10";

  switch (card.type) {
    case "number":
      return String(card.value);
    case "reset0":
      return "=0";
    case "eq21":
      return "=21";
    case "draw1":
      return "+1";
    case "draw2":
      return "+2";
    default:
      return "";
  }
}

export function faCornerLabel(card: FiveAliveRenderableCard): string {
  if (card.type === "eq10") return "=10";

  switch (card.type) {
    case "number":
      return String(card.value);
    case "reset0":
      return "=0";
    case "eq21":
      return "=21";
    case "draw1":
      return "+1";
    case "draw2":
      return "+2";
    case "bomb":
      return "●";
    case "life":
      return "♥";
    default:
      return "";
  }
}

export function faUsesIcon(card: FiveAliveRenderableCard): boolean {
  return (
    faActionType(card) !== null ||
    card.type === "bomb" ||
    card.type === "draw1" ||
    card.type === "draw2" ||
    card.type === "life"
  );
}

export function faUsesCenterText(card: FiveAliveRenderableCard): boolean {
  return (
    card.type === "number" ||
    card.type === "reset0" ||
    card.type === "eq21" ||
    card.type === "eq10"
  );
}

export function cardTypeName(card: FiveAliveRenderableCard): string {
  if (card.type === "eq10") return "Equals 10";
  if (card.type === "shuffle") return "Shuffle";
  if (card.type === "passmeby") return "Pass By Me";

  switch (card.type) {
    case "number":
      return `Number ${card.value}`;
    case "eq21":
      return "Equals 21";
    case "reset0":
      return "Reset to 0";
    case "skip":
      return "Skip";
    case "reverse":
      return "Reverse";
    case "draw1":
      return "Draw +1";
    case "draw2":
      return "Draw +2";
    case "bomb":
      return "Bomb";
    case "life":
      return "Alive — Life";
  }
}

/** Compact name for the card-face footer strip. */
export function faFooterName(card: FiveAliveRenderableCard): string {
  if (card.type === "eq10") return "Equals 10";
  if (card.type === "shuffle") return "Shuffle";
  if (card.type === "passmeby") return "Pass By Me";

  switch (card.type) {
    case "number":
      return `Number ${card.value}`;
    case "eq21":
      return "Equals 21";
    case "reset0":
      return "Reset 0";
    case "skip":
      return "Skip";
    case "reverse":
      return "Reverse";
    case "draw1":
      return "Draw 1";
    case "draw2":
      return "Draw 2";
    case "bomb":
      return "Bomb";
    case "life":
      return "Life";
  }
}
