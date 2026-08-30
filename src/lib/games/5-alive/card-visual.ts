import type { FiveAliveCardInstance } from "./cards";
import { cardLabel } from "./cards";

/** Two-color Ledger palette only: manila + crimson. */
export const FIVE_ALIVE_COLORS = {
  primary: "#8B1E1E",
  action: "#8B1E1E",
  success: "#8B1E1E",
  warning: "#8B1E1E",
  neutral: "#8B1E1E",
  cardBack: "#8B1E1E",
} as const;

export type FiveAliveCardCategory =
  | "number"
  | "special"
  | "action"
  | "penalty"
  | "wild";

export type FiveAliveCardVisual = {
  label: string;
  category: FiveAliveCardCategory;
  borderClass: string;
  accentClass: string;
  tagLabel: string;
};

export function fiveAliveCardVisual(card: {
  type: FiveAliveCardInstance["type"];
  value?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}): FiveAliveCardVisual {
  switch (card.type) {
    case "number":
      return {
        label: String(card.value),
        category: "number",
        borderClass: "border-crimson/50",
        accentClass: "text-crimson",
        tagLabel: "Number",
      };
    case "reset0":
      return {
        label: "=0",
        category: "special",
        borderClass: "border-crimson",
        accentClass: "text-crimson",
        tagLabel: "Special",
      };
    case "eq21":
      return {
        label: "=21",
        category: "special",
        borderClass: "border-crimson",
        accentClass: "text-crimson",
        tagLabel: "Special",
      };
    case "eq10":
      return {
        label: "=10",
        category: "special",
        borderClass: "border-crimson",
        accentClass: "text-crimson",
        tagLabel: "Special",
      };
    case "passmeby":
      return {
        label: "Pass By Me",
        category: "action",
        borderClass: "border-crimson/60",
        accentClass: "text-crimson",
        tagLabel: "Action",
      };
    case "shuffle":
      return {
        label: "Shuffle",
        category: "action",
        borderClass: "border-crimson/60",
        accentClass: "text-crimson",
        tagLabel: "Action",
      };
    case "skip":
      return {
        label: "Skip",
        category: "action",
        borderClass: "border-crimson/60",
        accentClass: "text-crimson",
        tagLabel: "Action",
      };
    case "reverse":
      return {
        label: "Reverse",
        category: "action",
        borderClass: "border-crimson/60",
        accentClass: "text-crimson",
        tagLabel: "Action",
      };
    case "draw1":
      return {
        label: "+1",
        category: "action",
        borderClass: "border-crimson/60",
        accentClass: "text-crimson",
        tagLabel: "Action",
      };
    case "draw2":
      return {
        label: "+2",
        category: "action",
        borderClass: "border-crimson/60",
        accentClass: "text-crimson",
        tagLabel: "Action",
      };
    case "bomb":
      return {
        label: "Bomb",
        category: "penalty",
        borderClass: "border-crimson",
        accentClass: "text-crimson",
        tagLabel: "Penalty",
      };
  }
}

export function fiveAliveCardLabel(card: {
  type: FiveAliveCardInstance["type"];
  value?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
}): string {
  return cardLabel(card as FiveAliveCardInstance);
}
