"use client";

import { motion } from "framer-motion";
import type { PublicEkCard } from "@/lib/types";
import { EK_THROW_EASE } from "@/components/mockups/ek/EkPlayAnimation";
import { ExplodingKittensCardFace } from "./ExplodingKittensCardFace";

import { useMemo } from "react";
import { isCatType } from "@/lib/games/exploding-kittens/cards";

const CARD_WIDTH = 100;

export function EkPlayerHand({
  cards,
  selectedIds,
  disabled,
  throwingCardId,
  onToggle,
}: {
  cards: PublicEkCard[];
  selectedIds: string[];
  disabled?: boolean;
  throwingCardId?: string | null;
  onToggle: (card: PublicEkCard) => void;
}) {
  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cards) {
      counts[c.type] = (counts[c.type] ?? 0) + 1;
    }
    return counts;
  }, [cards]);

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto pb-4 pt-2 px-1">
        {cards.map((card) => {
          const isSelected = selectedIds.includes(card.id);
          const isThrowing = throwingCardId === card.id;
          const count = typeCounts[card.type] ?? 1;
          const isCat = isCatType(card.type);

          return (
            <motion.button
              key={card.id}
              type="button"
              layout
              disabled={disabled || !!throwingCardId}
              className="group relative shrink-0 snap-center focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
              initial={false}
              animate={
                isThrowing
                  ? {
                      y: -160,
                      scale: 1.08,
                      opacity: 0,
                      transition: { duration: 0.52, ease: EK_THROW_EASE },
                    }
                  : {
                      y: isSelected ? -16 : 0,
                      scale: isSelected ? 1.07 : 1,
                      opacity: disabled && !isSelected ? 0.55 : 1,
                    }
              }
              transition={{ layout: { duration: 0.3, ease: EK_THROW_EASE } }}
              whileHover={!disabled && !throwingCardId ? { y: -10, scale: 1.03 } : undefined}
              onClick={() => {
                if (disabled || throwingCardId) return;
                onToggle(card);
              }}
            >
              {isCat && count >= 2 && !isSelected && (
                <span className="absolute -top-2 right-1 z-10 rounded-full bg-amber-500 px-1.5 py-0.5 font-mono text-[8px] font-bold text-white shadow-sm ring-1 ring-white">
                  {count === 2 ? "Pair" : `${count}x`}
                </span>
              )}
              <ExplodingKittensCardFace
                card={card}
                width={CARD_WIDTH}
                selected={isSelected}
                elevated={isSelected}
              />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
