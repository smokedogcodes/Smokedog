"use client";

import { useState } from "react";
import { GlassPanel, PrimaryButton } from "@/components/ui/primitives";

export function EkDefuseSlider({
  deckSize,
  onPlace,
}: {
  deckSize: number;
  onPlace: (index: number) => void;
}) {
  const [index, setIndex] = useState(Math.floor(deckSize / 2));

  return (
    <GlassPanel className="space-y-4 p-4">
      <h3 className="font-display text-xl font-bold">Defuse the Exploding Kitten!</h3>
      <p className="text-sm text-ink-steel">
        Insert the kitten back into the draw pile. 0 = top, {deckSize} = bottom.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPlace(0)}
          className="rounded-sm border border-crimson/25 px-3 py-2 font-mono text-xs uppercase hover:bg-crimson/5"
        >
          Top
        </button>
        <button
          type="button"
          onClick={() => onPlace(deckSize)}
          className="rounded-sm border border-crimson/25 px-3 py-2 font-mono text-xs uppercase hover:bg-crimson/5"
        >
          Bottom
        </button>
        <button
          type="button"
          onClick={() =>
            onPlace(Math.floor(Math.random() * (deckSize + 1)))
          }
          className="rounded-sm border border-crimson/25 px-3 py-2 font-mono text-xs uppercase hover:bg-crimson/5"
        >
          Random
        </button>
      </div>
      <div>
        <label className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
          Depth: {index}
        </label>
        <input
          type="range"
          min={0}
          max={deckSize}
          value={index}
          onChange={(e) => setIndex(Number(e.target.value))}
          className="mt-2 w-full"
        />
      </div>
      <PrimaryButton type="button" onClick={() => onPlace(index)}>
        Hide kitten
      </PrimaryButton>
    </GlassPanel>
  );
}
