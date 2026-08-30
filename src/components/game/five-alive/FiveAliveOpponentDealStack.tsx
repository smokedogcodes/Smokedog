"use client";

import { cn } from "@/lib/cn";
import { FiveAliveDeckCardBack } from "@/components/mockups/five-alive/FiveAliveDeckCard";

export function FiveAliveOpponentDealStack({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count <= 0) return null;
  const layers = Math.min(3, count);
  return (
    <div className={cn("relative ml-auto h-[52px] w-[40px]", className)}>
      {Array.from({ length: layers }, (_, i) => (
        <div
          key={i}
          className="absolute left-0"
          style={{ top: i * 2, zIndex: i, transform: `rotate(${i * 2 - 2}deg)` }}
        >
          <FiveAliveDeckCardBack width={40} />
        </div>
      ))}
      <span className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#8B1E1E] px-1 font-mono text-[9px] font-bold text-manila">
        {count}
      </span>
    </div>
  );
}
