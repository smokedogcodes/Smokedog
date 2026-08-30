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
    <div className="flex items-end justify-center gap-8">
      <button
        type="button"
        disabled={!canDraw}
        onClick={onDraw}
        className={`group relative flex flex-col items-center focus:outline-none ${
          canDraw ? "cursor-pointer" : "cursor-default opacity-70"
        }`}
      >
        <div
          className={`relative aspect-[5/7] w-24 rounded-xl border-2 border-crimson/50 bg-gradient-to-br from-crimson/20 to-crimson/5 shadow-lg transition ${
            canDraw ? "group-hover:scale-105 group-hover:ring-2 group-hover:ring-crimson animate-pulse" : ""
          }`}
        >
          <div className="absolute inset-0 flex items-center justify-center text-3xl opacity-40">
            🐱
          </div>
          <div className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-crimson text-xs font-bold text-manila">
            {ek.drawPileCount}
          </div>
        </div>
        <span className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
          {canDraw ? "Draw" : "Draw pile"}
        </span>
      </button>

      <div className="flex flex-col items-center">
        {ek.discardTop ? (
          <ExplodingKittensCardFace card={ek.discardTop} width={96} />
        ) : (
          <div className="aspect-[5/7] w-24 rounded-xl border-2 border-dashed border-crimson/25 bg-manila/50" />
        )}
        <span className="mt-2 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
          Discard ({ek.discardCount})
        </span>
      </div>
    </div>
  );
}
