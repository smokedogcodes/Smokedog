import type { EkCard, EkCardType } from "./cards";
import { cardLabel } from "./cards";

export type EkCardCategory = "danger" | "save" | "action" | "cat" | "interrupt";

export type EkCardVisual = {
  label: string;
  category: EkCardCategory;
  bgClass: string;
  borderClass: string;
  accentClass: string;
  textClass: string;
  tagClass: string;
  tagLabel: string;
  icon: string;
};

const BASE_BG = "bg-manila";
const BASE_TEXT = "text-crimson";
const BASE_TAG = "bg-crimson/10 text-crimson";

const ICONS: Record<EkCardType, string> = {
  exploding_kitten: "💣",
  defuse: "🛡",
  skip: "⏭",
  attack: "⚡",
  favor: "🎁",
  shuffle: "🔀",
  see_future: "👁",
  nope: "🙅",
  taco_cat: "🌮",
  beard_cat: "🧔",
  rainbow_ralphing_cat: "🌈",
  hairy_potato_cat: "🥔",
  cattermelon: "🍈",
};

export function ekCardVisual(card: { type: EkCardType }): EkCardVisual {
  const icon = ICONS[card.type];
  const label = cardLabel({ type: card.type });

  switch (card.type) {
    case "exploding_kitten":
      return {
        label,
        category: "danger",
        bgClass: BASE_BG,
        borderClass: "border-crimson",
        accentClass: "text-crimson",
        textClass: BASE_TEXT,
        tagClass: BASE_TAG,
        tagLabel: "BOOM",
        icon,
      };
    case "defuse":
      return {
        label,
        category: "save",
        bgClass: BASE_BG,
        borderClass: "border-crimson/70",
        accentClass: "text-crimson",
        textClass: BASE_TEXT,
        tagClass: BASE_TAG,
        tagLabel: "Defuse",
        icon,
      };
    case "nope":
      return {
        label,
        category: "interrupt",
        bgClass: BASE_BG,
        borderClass: "border-crimson/80",
        accentClass: "text-crimson",
        textClass: BASE_TEXT,
        tagClass: BASE_TAG,
        tagLabel: "Nope",
        icon,
      };
    case "skip":
    case "attack":
    case "favor":
    case "shuffle":
    case "see_future":
      return {
        label,
        category: "action",
        bgClass: BASE_BG,
        borderClass: "border-crimson/60",
        accentClass: "text-crimson/90",
        textClass: BASE_TEXT,
        tagClass: BASE_TAG,
        tagLabel:
          card.type === "attack"
            ? "Attack"
            : card.type === "skip"
              ? "Skip"
              : card.type === "favor"
                ? "Favor"
                : "Action",
        icon,
      };
    default:
      return {
        label,
        category: "cat",
        bgClass: BASE_BG,
        borderClass: "border-crimson/40",
        accentClass: "text-crimson/80",
        textClass: BASE_TEXT,
        tagClass: BASE_TAG,
        tagLabel: "Cat",
        icon,
      };
  }
}

export function ekCardLabel(card: EkCard): string {
  return cardLabel(card);
}
