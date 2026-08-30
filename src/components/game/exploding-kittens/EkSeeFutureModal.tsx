"use client";

import { useEffect, useState } from "react";
import { GlassPanel } from "@/components/ui/primitives";
import type { PublicEkCard } from "@/lib/types";
import { ExplodingKittensCardFace } from "./ExplodingKittensCardFace";

export function EkSeeFutureModal({ cards }: { cards: PublicEkCard[] }) {
  return (
    <GlassPanel className="border-crimson/30 p-4">
      <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
        See the Future — top of deck
      </p>
      <div className="mt-3 flex justify-center gap-3">
        {cards.map((c, i) => (
          <div key={c.id} className="relative">
            <span className="absolute -left-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-crimson text-xs font-bold text-manila">
              {i + 1}
            </span>
            <ExplodingKittensCardFace card={c} width={72} />
          </div>
        ))}
      </div>
    </GlassPanel>
  );
}

export function EkNopeBar({
  endsAt,
  eligible,
  nopeCardId,
  onNope,
}: {
  endsAt: number;
  eligible: boolean;
  nopeCardId: string | null;
  onNope: () => void;
}) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [endsAt]);

  if (!eligible || !nopeCardId) return null;

  return (
    <GlassPanel className="flex items-center justify-between gap-4 border-crimson/40 bg-crimson/5 p-4">
      <div>
        <p className="font-display text-lg font-bold">Nope window!</p>
        <p className="text-sm text-ink-steel">
          {(remaining / 1000).toFixed(1)}s to cancel the action
        </p>
      </div>
      <button
        type="button"
        onClick={onNope}
        className="rounded-sm border border-crimson bg-crimson px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-manila hover:bg-crimson/90"
      >
        Play Nope
      </button>
    </GlassPanel>
  );
}
