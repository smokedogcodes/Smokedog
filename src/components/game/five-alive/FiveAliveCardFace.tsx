"use client";

import {
  Bomb,
  SkipForward,
  Sparkles,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { fiveAliveCardVisual } from "@/lib/games/5-alive/card-visual";
import { faFooterName } from "@/lib/mockups/five-alive-deck-art";
import type { PublicFiveAliveCard } from "@/lib/types";
import { FaReverseIcon, FaPassMeByIcon } from "@/components/mockups/five-alive/FiveAliveActionIcons";

export type FiveAliveCardFaceProps = {
  card: PublicFiveAliveCard;
  className?: string;
  width?: number;
  selected?: boolean;
  highlight?: "defuse" | "playable" | null;
  elevated?: boolean;
};

function CategoryIcon({
  category,
  className,
}: {
  category: ReturnType<typeof fiveAliveCardVisual>["category"];
  className?: string;
}) {
  const props = { className: cn("size-[1.1em]", className), strokeWidth: 2.5 };
  switch (category) {
    case "action":
      return <Zap {...props} />;
    case "penalty":
      return <Bomb {...props} />;
    case "wild":
      return <Sparkles {...props} />;
    case "special":
      return <SkipForward {...props} />;
    default:
      return null;
  }
}

export function FiveAliveCardFace({
  card,
  className,
  width = 88,
  selected = false,
  highlight = null,
  elevated = false,
}: FiveAliveCardFaceProps) {
  const visual = fiveAliveCardVisual(card);
  const footer = faFooterName(card);
  const isUtility =
    card.type === "skip" || card.type === "reverse";

  return (
    <div
      className={cn(
        "relative aspect-[5/7] select-none overflow-hidden rounded-xl border-2 bg-manila text-crimson shadow-[0_2px_4px_rgba(139,30,30,0.12),0_8px_20px_rgba(139,30,30,0.08)] transition-all duration-200",
        visual.borderClass,
        selected && "ring-2 ring-[#8B1E1E] ring-offset-2 ring-offset-transparent scale-105",
        highlight === "defuse" && "ring-2 ring-[#2a9d8f]",
        highlight === "playable" && "hover:-translate-y-1 hover:shadow-xl",
        elevated && "-translate-y-2 shadow-xl",
        className
      )}
      style={{ fontSize: width / 11, width }}
      title={footer}
    >
      <div className="absolute inset-x-0 top-[0.5em] text-center font-display text-[0.72em] font-extrabold uppercase tracking-[0.18em] text-[#8B1E1E]">
        5 Alive
      </div>

      <div className="absolute right-[0.55em] top-[0.55em] opacity-70">
        <CategoryIcon category={visual.category} className={visual.accentClass} />
      </div>

      <div className="absolute inset-[12%_8%_20%_8%] flex flex-col items-center justify-center px-1">
        {isUtility ? (
          card.type === "reverse" ? (
            <div className={cn("mb-0.5 size-[1.7em]", visual.accentClass)}>
              <FaReverseIcon corner />
            </div>
          ) : (
            <div className={cn("mb-0.5 size-[1.55em]", visual.accentClass)}>
              <FaPassMeByIcon corner direction="right" />
            </div>
          )
        ) : null}
        <span
          className={cn(
            "font-display font-extrabold",
            visual.label.length > 3 ? "text-[1.7em]" : "text-[2.45em]",
            visual.accentClass
          )}
          style={{ lineHeight: 0.92 }}
        >
          {visual.label}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-[0.35em] px-1 text-center">
        <span className="block truncate font-mono text-[0.55em] font-bold uppercase tracking-wider text-[#5c4033]/90">
          {footer}
        </span>
      </div>
    </div>
  );
}
