"use client";

import { forwardRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { FiveAliveSampleCard } from "@/lib/mockups/five-alive-sample";
import { FiveAliveDeckCard } from "./FiveAliveDeckCard";
import { FA_EASE } from "./FiveAliveTableAnimation";

const CARD_W = 92;

export const FiveAliveHandCard = forwardRef<
  HTMLButtonElement,
  {
    card: FiveAliveSampleCard;
    selected?: boolean;
    hidden?: boolean;
    disabled?: boolean;
    onSelect: (card: FiveAliveSampleCard) => void;
  }
>(function FiveAliveHandCard(
  { card, selected, hidden, disabled, onSelect },
  ref
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      layout
      disabled={disabled}
      className={cn(
        "shrink-0 snap-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        hidden && "pointer-events-none"
      )}
      animate={{
        y: selected ? -12 : 0,
        scale: selected ? 1.05 : 1,
        opacity: hidden ? 0 : disabled ? 0.55 : 1,
      }}
      transition={{ layout: { duration: 0.28, ease: FA_EASE } }}
      whileHover={!disabled && !hidden ? { y: -8, scale: 1.02 } : undefined}
      onClick={() => {
        if (disabled || hidden) return;
        onSelect(card);
      }}
    >
      <FiveAliveDeckCard
        card={card}
        width={CARD_W}
        selected={selected}
        elevated={selected}
      />
    </motion.button>
  );
});

export function FiveAliveMockHand({
  cards,
  selectedId,
  hiddenCardId,
  disabled,
  onSelect,
  registerCardRef,
}: {
  cards: FiveAliveSampleCard[];
  selectedId?: string | null;
  hiddenCardId?: string | null;
  disabled?: boolean;
  onSelect: (card: FiveAliveSampleCard) => void;
  registerCardRef?: (id: string, el: HTMLButtonElement | null) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-2">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 pt-2">
        {cards.map((card) => (
          <FiveAliveHandCard
            key={card.id}
            ref={(el) => registerCardRef?.(card.id, el)}
            card={card}
            selected={selectedId === card.id}
            hidden={hiddenCardId === card.id}
            disabled={disabled}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

export function FiveAliveOpponentHand({
  cards,
  label,
  drawTargetRef,
}: {
  cards: FiveAliveSampleCard[];
  label: string;
  drawTargetRef?: (el: HTMLDivElement | null) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-2">
      <p className="mb-2 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
        {label}
      </p>
      <div className="flex min-h-[118px] snap-x snap-mandatory gap-2 overflow-x-auto pb-2 pt-1">
        {cards.map((card) => (
          <div key={card.id} className="shrink-0 snap-center">
            <FiveAliveDeckCard card={card} width={76} />
          </div>
        ))}
        <div
          ref={drawTargetRef}
          className="flex aspect-[5/7] w-[76px] shrink-0 snap-center items-center justify-center rounded-[10px] border border-dashed border-white/15 bg-black/20 font-mono text-[8px] uppercase tracking-widest text-white/25"
        >
          +draw
        </div>
      </div>
    </div>
  );
}

export function FiveAliveRunningTotal({
  total,
  className,
}: {
  total: number;
  className?: string;
}) {
  const tone =
    total > 21 ? "text-[#FF5252]" : total >= 18 ? "text-[#FFB300]" : "text-white";

  return (
    <div className={cn("text-center", className)}>
      <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/45">
        Running total
      </p>
      <motion.p
        key={total}
        initial={{ scale: 1.15, opacity: 0.6 }}
        animate={{ scale: 1, opacity: 1 }}
        className={cn(
          "font-black tabular-nums",
          tone
        )}
        style={{ fontFamily: "Arial Black, sans-serif", fontSize: "3.5rem", lineHeight: 1 }}
      >
        {total}
      </motion.p>
      {total > 21 ? (
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-[#FF5252]">
          Bust zone
        </p>
      ) : null}
    </div>
  );
}

export function FiveAliveCenterPile({
  card,
  pileCount,
  centerRef,
  placeholder,
}: {
  card: FiveAliveSampleCard | null;
  pileCount: number;
  centerRef?: (el: HTMLDivElement | null) => void;
  placeholder?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
        Center pile
      </p>
      <div ref={centerRef} className="relative min-h-[140px] min-w-[100px]">
        {card && !placeholder ? (
          <motion.div
            key={card.id}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: FA_EASE }}
          >
            <FiveAliveDeckCard card={card} width={96} elevated />
          </motion.div>
        ) : (
          <div className="flex aspect-[5/7] w-[96px] items-center justify-center rounded-[10px] border-2 border-dashed border-white/20 bg-black/20 font-mono text-[9px] uppercase tracking-widest text-white/35">
            Play here
          </div>
        )}
        {pileCount > 1 ? (
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-2 py-0.5 font-mono text-[9px] text-white/55">
            {pileCount} cards
          </span>
        ) : null}
      </div>
    </div>
  );
}
