"use client";

import { motion } from "framer-motion";
import type { PublicEkCard } from "@/lib/types";
import { EK_THROW_EASE } from "@/components/mockups/ek/EkPlayAnimation";
import { ExplodingKittensCardFace } from "./ExplodingKittensCardFace";

const CARD_WIDTH = 96;

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
  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 pt-2">
        {cards.map((card) => {
          const isSelected = selectedIds.includes(card.id);
          const isThrowing = throwingCardId === card.id;

          return (
            <motion.button
              key={card.id}
              type="button"
              layout
              disabled={disabled || !!throwingCardId}
              className="shrink-0 snap-center focus:outline-none focus-visible:ring-2 focus-visible:ring-crimson"
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
                      y: isSelected ? -14 : 0,
                      scale: isSelected ? 1.06 : 1,
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
