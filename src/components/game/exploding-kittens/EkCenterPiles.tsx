"use client";

import type { ExplodingKittensPublicState } from "@/lib/types";
import { ExplodingKittensCardFace } from "./ExplodingKittensCardFace";

export function EkCenterPiles({
  ek,
  canDraw,
  onDraw,
}: {
  ek: ExplodingKittensPublicState;
  canDraw: boolean;
  onDraw: () => void;
}) {
  return (
    <div className="flex items-end justify-center gap-10">
      {/* Draw Pile */}
      <button
        type="button"
        disabled={!canDraw}
        onClick={onDraw}
        className={`group relative flex flex-col items-center focus:outline-none ${
          canDraw ? "cursor-pointer" : "cursor-default opacity-70"
        }`}
      >
        {canDraw && (
          <span className="absolute -top-7 animate-bounce rounded-full bg-crimson px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-manila shadow-md whitespace-nowrap">
            Draw to End Turn
          </span>
        )}
        <div
          className={`relative aspect-[5/7] w-28 rounded-xl border-2 transition-all duration-300 shadow-xl ${
            canDraw
              ? "border-amber-400 bg-gradient-to-br from-crimson/30 via-crimson/20 to-crimson/10 ring-4 ring-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.4)] group-hover:scale-105 group-hover:ring-amber-400"
              : "border-crimson/40 bg-gradient-to-br from-crimson/15 to-crimson/5"
          }`}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl opacity-80 group-hover:scale-110 transition-transform">
              💣
            </span>
            <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-wider text-crimson-dark">
              Draw Pile
            </span>
          </div>
          <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-crimson text-xs font-bold text-manila shadow-md ring-2 ring-manila">
            {ek.drawPileCount}
          </div>
        </div>
        <span
          className={`mt-2 font-mono text-[10px] uppercase tracking-widest ${
            canDraw ? "font-bold text-crimson" : "text-ink-steel"
          }`}
        >
          {canDraw ? "Click to Draw" : "Draw pile"}
        </span>
      </button>

      {/* Discard Pile */}
      <div className="flex flex-col items-center">
        {ek.discardTop ? (
          <div className="relative group">
            <ExplodingKittensCardFace card={ek.discardTop} width={112} />
            <div className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-ink-steel text-[10px] font-bold text-manila shadow-md">
              {ek.discardCount}
            </div>
          </div>
        ) : (
          <div className="aspect-[5/7] w-28 rounded-xl border-2 border-dashed border-crimson/25 bg-manila/50 flex items-center justify-center">
            <span className="font-mono text-[10px] uppercase text-ink-steel/50">
              Empty
            </span>
          </div>
        )}
        <span className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
          Discard ({ek.discardCount})
        </span>
      </div>
    </div>
  );
}
