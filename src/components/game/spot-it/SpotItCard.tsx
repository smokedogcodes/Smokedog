"use client";

import { useMemo } from "react";
import { symbolEmoji, twemojiSvgUrl } from "@/lib/games/spot-it/symbols";

function hashSeed(symbols: number[]): number {
  return symbols.reduce((a, b) => (a * 31 + b) >>> 0, 7);
}

function layoutFor(symbols: number[]) {
  const seed = hashSeed(symbols);
  const n = symbols.length;
  return symbols.map((id, i) => {
    const angle = ((seed + i * 47) % 360) + i * (360 / n);
    const rad = ((angle % 360) * Math.PI) / 180;
    const radius = 18 + ((seed + i * 13) % 22);
    const size = 18 + ((seed + i * 19) % 16);
    const rot = (seed + i * 29) % 360;
    return {
      id,
      x: 50 + Math.cos(rad) * radius,
      y: 50 + Math.sin(rad) * radius,
      size,
      rot,
    };
  });
}

export function SpotItCard({
  symbols,
  onPick,
  disabled,
  flashId,
  size = "md",
}: {
  symbols: number[];
  onPick?: (symbolId: number) => void;
  disabled?: boolean;
  flashId?: number | null;
  size?: "sm" | "md" | "lg";
}) {
  const items = useMemo(() => layoutFor(symbols), [symbols]);
  const dim =
    size === "lg" ? "w-[min(92vw,22rem)]" : size === "sm" ? "w-40" : "w-56";

  return (
    <div
      className={`relative aspect-square ${dim} rounded-full border-2 border-crimson/30 bg-gradient-to-br from-[#fff8ef] via-[#f3e6d4] to-[#e8d2b8] shadow-lg`}
    >
      {items.map((item) => {
        const emoji = symbolEmoji(item.id);
        const flashing = flashId === item.id;
        return (
          <button
            key={`${item.id}-${item.x}`}
            type="button"
            disabled={disabled || !onPick}
            onClick={() => onPick?.(item.id)}
            aria-label={emoji}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-0.5 transition hover:scale-110 disabled:cursor-default ${
              flashing
                ? "scale-125 drop-shadow-[0_0_10px_rgba(230,25,25,0.55)]"
                : ""
            }`}
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              width: `${item.size}%`,
              height: `${item.size}%`,
              transform: `translate(-50%, -50%) rotate(${item.rot}deg)`,
            }}
          >
            {/* Twemoji SVGs — colorful figures, independent of site palette */}
            <img
              src={twemojiSvgUrl(emoji)}
              alt=""
              draggable={false}
              className="pointer-events-none h-full w-full select-none object-contain"
            />
          </button>
        );
      })}
    </div>
  );
}
