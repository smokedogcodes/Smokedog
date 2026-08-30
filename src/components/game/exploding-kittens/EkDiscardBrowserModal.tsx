"use client";

import { GlassPanel } from "@/components/ui/primitives";
import type { PublicEkCard } from "@/lib/types";
import { ExplodingKittensCardFace } from "./ExplodingKittensCardFace";

export function EkDiscardBrowserModal({
  cards,
  onPick,
}: {
  cards: PublicEkCard[];
  onPick: (index: number) => void;
}) {
  return (
    <GlassPanel className="space-y-4 p-4">
      <h3 className="font-display text-xl font-bold">Pick from discard</h3>
      <p className="text-sm text-ink-steel">
        Five Different Cats — choose any card from the discard pile.
      </p>
      <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
        {cards.map((c, idx) => (
          <button
            key={`${c.id}-${idx}`}
            type="button"
            onClick={() => onPick(idx)}
            className="shrink-0 transition hover:scale-105"
          >
            <ExplodingKittensCardFace card={c} width={72} />
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}
