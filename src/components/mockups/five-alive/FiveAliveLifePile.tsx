"use client";

import { cn } from "@/lib/cn";
import { FiveAliveDeckCard } from "./FiveAliveDeckCard";
import type { FiveAliveRenderableCard } from "@/lib/mockups/five-alive-deck-art";

const DEFAULT_LIFE_COLOR = 6 as const;

export function FiveAliveLifePile({
  lives,
  maxLives = 5,
  heartColor = DEFAULT_LIFE_COLOR,
  label,
  compact = false,
  className,
}: {
  lives: number;
  maxLives?: number;
  heartColor?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
  label: string;
  compact?: boolean;
  className?: string;
}) {
  const cardW = compact ? 48 : 56;
  const lifeCard = (i: number): FiveAliveRenderableCard => ({
    id: `life-${label}-${i}`,
    type: "life",
    heartColor,
  });

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div className="text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
          {label}
        </p>
        <p className="font-mono text-[9px] uppercase tracking-widest text-white/30">
          Member lives
        </p>
      </div>
      <div className="relative flex min-h-[72px] items-end justify-center">
        {lives === 0 ? (
          <div className="flex aspect-[5/7] w-[52px] items-center justify-center rounded-[8px] border border-dashed border-white/15 bg-black/30 font-mono text-[8px] uppercase tracking-widest text-white/25">
            Out
          </div>
        ) : (
          Array.from({ length: lives }, (_, i) => (
            <div
              key={i}
              className="relative shrink-0 transition-transform"
              style={{
                marginLeft: i === 0 ? 0 : -cardW * 0.38,
                zIndex: i,
                transform: `rotate(${(i - (lives - 1) / 2) * 5}deg)`,
              }}
            >
              <FiveAliveDeckCard card={lifeCard(i)} width={cardW} />
            </div>
          ))
        )}
      </div>
      <p className="font-mono text-[10px] tabular-nums text-white/50">
        {lives}/{maxLives} alive
      </p>
    </div>
  );
}
