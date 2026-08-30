"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import { FiveAliveDeckCardBack } from "./FiveAliveDeckCard";

export const FiveAliveDrawPile = forwardRef<
  HTMLDivElement,
  {
    count: number;
    width?: number;
    drawing?: boolean;
    label?: string;
    hint?: string;
    variant?: "mockup" | "game";
  }
>(function FiveAliveDrawPile(
  {
    count,
    width = 80,
    drawing,
    label = "Draw pile",
    hint,
    variant = "mockup",
  },
  ref
) {
  const isGame = variant === "game";
  const layers = Math.min(4, Math.max(1, count > 0 ? 4 : 0));
  const height = (width * 7) / 5;
  const resolvedHint =
    hint ?? (isGame ? undefined : "Auto-draw only on +1 / +2");

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={ref}
        className="relative"
        style={{ width, height }}
        aria-label={`${label}, ${count} cards remaining`}
      >
        {count === 0 ? (
          <div
            className={cn(
              "flex aspect-[5/7] w-full items-center justify-center rounded-[10px] border border-dashed font-mono text-[9px] uppercase tracking-widest",
              isGame
                ? "border-crimson/25 bg-crimson/[0.03] text-ink-steel"
                : "border-white/25 bg-black/30 text-white/40"
            )}
          >
            Empty
          </div>
        ) : (
          <>
            {Array.from({ length: layers }, (_, i) => (
              <motion.div
                key={i}
                className="absolute left-0"
                style={{
                  width,
                  top: i * 2.5,
                  zIndex: i,
                  transform: `rotate(${i === 0 ? -2.5 : i === 1 ? 1 : i === 2 ? -0.5 : 0}deg)`,
                }}
                animate={
                  drawing && i === layers - 1
                    ? { y: -6, scale: 0.97, opacity: 0.85 }
                    : { y: 0, scale: 1, opacity: 1 }
                }
                transition={{ duration: 0.3 }}
              >
                <FiveAliveDeckCardBack width={width} />
              </motion.div>
            ))}
            <motion.span
              key={count}
              initial={{ scale: 1.25 }}
              animate={{ scale: 1 }}
              className={cn(
                "absolute -right-2 -top-2 z-20 flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 font-mono text-xs font-bold shadow-md",
                isGame
                  ? "bg-[#8B1E1E] text-manila"
                  : "border-2 border-[#2a1810] bg-white text-black"
              )}
            >
              {count}
            </motion.span>
          </>
        )}
      </div>
      <p
        className={cn(
          "font-mono text-[10px] uppercase tracking-[0.2em]",
          isGame ? "text-ink-steel" : "text-white/50"
        )}
      >
        {label}
      </p>
      {resolvedHint ? (
        <p
          className={cn(
            "max-w-[120px] text-center font-sans text-[10px] leading-snug",
            isGame ? "text-ink-steel/70" : "text-white/35"
          )}
        >
          {resolvedHint}
        </p>
      ) : null}
    </div>
  );
});
