"use client";

import { GlassPanel } from "@/components/ui/primitives";
import type { PublicEkCard, PublicGameState } from "@/lib/types";
import { ExplodingKittensCardFace } from "./ExplodingKittensCardFace";

export function EkFavorModals({
  state,
  mode,
  onTarget,
  onGive,
}: {
  state: PublicGameState;
  mode: "target" | "give";
  onTarget: (targetId: string) => void;
  onGive: (cardId: string) => void;
}) {
  const you = state.you;
  const ek = state.explodingKittens!;

  if (mode === "target") {
    return (
      <GlassPanel className="space-y-4 p-4">
        <h3 className="font-display text-xl font-bold">Favor — pick a player</h3>
        <div className="flex flex-wrap gap-2">
          {state.players
            .filter((p) => p.alive && p.id !== you?.id)
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onTarget(p.id)}
                className="rounded-sm border border-crimson/25 px-4 py-2 font-mono text-xs uppercase hover:bg-crimson/5"
              >
                {p.name}
              </button>
            ))}
        </div>
      </GlassPanel>
    );
  }

  const hand = ek.yourHand;
  return (
    <GlassPanel className="space-y-4 p-4">
      <h3 className="font-display text-xl font-bold">Give a card</h3>
      <p className="text-sm text-ink-steel">Favor — choose one card to surrender.</p>
      <div className="flex flex-wrap gap-2">
        {hand.map((c) => (
          <button key={c.id} type="button" onClick={() => onGive(c.id)}>
            <ExplodingKittensCardFace card={c} width={72} />
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}

export function EkTripleDeclareModal({
  state,
  onDeclare,
}: {
  state: PublicGameState;
  onDeclare: (targetId: string, cardType: PublicEkCard["type"]) => void;
}) {
  const you = state.you;
  const cardTypes: PublicEkCard["type"][] = [
    "skip",
    "attack",
    "favor",
    "shuffle",
    "see_future",
    "taco_cat",
    "beard_cat",
    "rainbow_ralphing_cat",
    "hairy_potato_cat",
    "cattermelon",
  ];

  return (
    <GlassPanel className="space-y-4 p-4">
      <h3 className="font-display text-xl font-bold">Three of a Kind</h3>
      <p className="text-sm text-ink-steel">
        Name a card type and pick a player. If they have it, you take one.
      </p>
      {state.players
        .filter((p) => p.alive && p.id !== you?.id)
        .map((p) => (
          <div key={p.id} className="space-y-2">
            <p className="font-semibold">{p.name}</p>
            <div className="flex flex-wrap gap-1">
              {cardTypes.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onDeclare(p.id, t)}
                  className="rounded-sm border border-crimson/20 px-2 py-1 font-mono text-[9px] uppercase hover:bg-crimson/5"
                >
                  {t.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
        ))}
    </GlassPanel>
  );
}
