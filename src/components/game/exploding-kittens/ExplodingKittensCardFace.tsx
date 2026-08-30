"use client";

import { cn } from "@/lib/cn";
import { ekCardVisual } from "@/lib/games/exploding-kittens/card-visual";
import type { PublicEkCard } from "@/lib/types";

export function ExplodingKittensCardFace({
  card,
  width = 96,
  selected = false,
  elevated = false,
  className,
}: {
  card: PublicEkCard;
  width?: number;
  selected?: boolean;
  elevated?: boolean;
  className?: string;
}) {
  const visual = ekCardVisual(card);

  return (
    <div
      className={cn(
        "relative aspect-[5/7] select-none overflow-hidden rounded-xl border-2 transition-all duration-200",
        visual.bgClass,
        visual.borderClass,
        visual.textClass,
        "shadow-[0_2px_4px_rgba(139,30,30,0.12),0_8px_20px_rgba(139,30,30,0.08)]",
        selected && "ring-2 ring-crimson ring-offset-2 ring-offset-manila scale-105",
        elevated && "-translate-y-2 shadow-xl",
        className
      )}
      style={{ fontSize: width / 14, width }}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-[0.5em] text-center font-display text-[0.55em] font-extrabold uppercase tracking-[0.14em]",
          visual.accentClass
        )}
      >
        Exploding Kittens
      </div>
      <div className="absolute right-[0.5em] top-[0.5em] text-[1.1em] leading-none opacity-90">
        {visual.icon}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 pt-3">
        <span className="text-[2.2em] leading-none">{visual.icon}</span>
        <span
          className={cn(
            "mt-[0.35em] text-center font-display text-[0.75em] font-bold leading-tight",
            visual.textClass
          )}
        >
          {visual.label}
        </span>
      </div>
      <div
        className={cn(
          "absolute inset-x-[0.45em] bottom-[0.45em] rounded-md px-1 py-[0.15em] text-center font-mono text-[0.5em] font-semibold uppercase tracking-wider",
          visual.tagClass
        )}
      >
        {visual.tagLabel}
      </div>
    </div>
  );
}
