"use client";

import { useMemo } from "react";
import { symbolEmoji } from "@/lib/games/spot-it/symbols";

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
    const size = 20 + ((seed + i * 19) % 14);
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
  variant = "center",
}: {
  symbols: number[];
  onPick?: (symbolId: number) => void;
  disabled?: boolean;
  flashId?: number | null;
  size?: "sm" | "md" | "lg";
  variant?: "center" | "player";
}) {
  const items = useMemo(() => layoutFor(symbols), [symbols]);
  const dim =
    size === "lg" ? "w-[min(90vw,22rem)]" : size === "sm" ? "w-40" : "w-56";

  const isPlayer = variant === "player";

  return (
    <div
      className={`relative aspect-square ${dim} rounded-full bg-gradient-to-br from-[#fffdfa] via-[#f7ede1] to-[#e8d5be] shadow-2xl transition-all select-none ${
        isPlayer
          ? "border-4 border-emerald-500/50 ring-4 ring-emerald-400/20 shadow-[0_12px_35px_rgba(16,185,129,0.2)]"
          : "border-4 border-amber-500/50 ring-4 ring-amber-400/20 shadow-[0_12px_35px_rgba(245,158,11,0.2)]"
      }`}
    >
      {/* Outer subtle concentric decorative ring */}
      <div className="pointer-events-none absolute inset-2 rounded-full border border-amber-900/10" />

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
            className={`group absolute -translate-x-1/2 -translate-y-1/2 rounded-full p-1 transition-all duration-150 focus:outline-none ${
              onPick && !disabled
                ? "cursor-pointer hover:scale-125 hover:bg-white/60 hover:ring-2 hover:ring-amber-400/80 active:scale-95"
                : "cursor-default"
            } ${
              flashing
                ? "scale-140 bg-emerald-400/30 ring-4 ring-emerald-500 animate-pulse"
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
            {/* Crisp Zero-Latency Native Color Emoji */}
            <span
              className="pointer-events-none flex h-full w-full select-none items-center justify-center font-['Apple_Color_Emoji','Segoe_UI_Emoji','Noto_Color_Emoji','Android_Emoji','Twemoji_Mozilla',sans-serif] leading-none transition-transform"
              style={{
                fontSize: `clamp(22px, ${item.size * 1.5}px, 46px)`,
                filter: flashing
                  ? "drop-shadow(0 0 12px rgba(34,197,94,0.9))"
                  : "drop-shadow(0 2px 3px rgba(0,0,0,0.22))",
              }}
            >
              {emoji}
            </span>
          </button>
        );
      })}
    </div>
  );
}
