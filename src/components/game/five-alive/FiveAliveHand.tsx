"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type Ref,
} from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import type { PublicFiveAliveCard } from "@/lib/types";
import { FiveAliveDeckCard } from "@/components/mockups/five-alive/FiveAliveDeckCard";
import { FA_EASE } from "@/components/mockups/five-alive/FiveAliveTableAnimation";

const CARD_W_DESKTOP = 88;
const CARD_W_MOBILE = 70;
const CARD_W_MIN = 58;
const GAP = 10;
/** End inset so the last card clears the mobile chat FAB. */
const MOBILE_END_PAD = 56;
const MOBILE_BREAK = 640;

const GAME_RING =
  "ring-2 ring-[#8B1E1E] ring-offset-2 ring-offset-manila scale-[1.04]";
const GAME_DEFUSE_RING =
  "ring-2 ring-[#2a9d8f] ring-offset-2 ring-offset-manila scale-[1.04]";

const FiveAliveHandCard = forwardRef<
  HTMLButtonElement,
  {
    card: PublicFiveAliveCard;
    width: number;
    selected?: boolean;
    hidden?: boolean;
    disabled?: boolean;
    highlight?: "playable" | "defuse" | null;
    onSelect?: (card: PublicFiveAliveCard) => void;
  }
>(function FiveAliveHandCard(
  { card, width, selected, hidden, disabled, highlight, onSelect },
  ref
) {
  return (
    <motion.button
      ref={ref}
      type="button"
      layout
      disabled={disabled}
      className={cn(
        "shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8B1E1E]/50",
        hidden && "pointer-events-none"
      )}
      animate={{
        y: selected ? -10 : 0,
        scale: selected ? 1.04 : 1,
        opacity: hidden ? 0 : disabled ? 0.55 : 1,
      }}
      transition={{ layout: { duration: 0.28, ease: FA_EASE } }}
      whileHover={!disabled && !hidden ? { y: -6, scale: 1.02 } : undefined}
      onClick={() => {
        if (disabled || hidden) return;
        onSelect?.(card);
      }}
    >
      <FiveAliveDeckCard
        card={card}
        width={width}
        selected={selected}
        elevated={selected}
        highlight={highlight}
        selectedRingClass={
          highlight === "defuse"
            ? GAME_DEFUSE_RING
            : selected
              ? GAME_RING
              : undefined
        }
      />
    </motion.button>
  );
});

/** Pick a card width that fits ~N cards per row; extras wrap to new lines. */
function cardWidthForWrap(containerWidth: number, count: number): number {
  const isMobile = containerWidth > 0 && containerWidth < MOBILE_BREAK;
  const base = isMobile ? CARD_W_MOBILE : CARD_W_DESKTOP;
  const avail = isMobile
    ? Math.max(0, containerWidth - MOBILE_END_PAD)
    : containerWidth;

  if (count <= 0 || avail <= 0) return base;

  // Prefer full-size cards; shrink only enough to keep a sensible per-row count.
  const targetPerRow = isMobile
    ? Math.min(count, 5)
    : Math.min(count, count <= 8 ? count : 6);

  for (const w of [base, Math.min(base, isMobile ? 64 : 76), CARD_W_MIN]) {
    const cardW = Math.max(CARD_W_MIN, w);
    const perRow = Math.max(1, Math.floor((avail + GAP) / (cardW + GAP)));
    if (perRow >= Math.min(targetPerRow, count) || cardW <= CARD_W_MIN) {
      return cardW;
    }
  }
  return CARD_W_MIN;
}

export function FiveAliveHand({
  cards,
  disabled,
  hiddenCardId,
  selectedCardId,
  playableFilter,
  onSelect,
  registerCardRef,
  handTargetRef,
}: {
  cards: PublicFiveAliveCard[];
  disabled?: boolean;
  hiddenCardId?: string | null;
  selectedCardId?: string | null;
  playableFilter?: (card: PublicFiveAliveCard) => boolean;
  onSelect?: (card: PublicFiveAliveCard) => void;
  registerCardRef?: (id: string, el: HTMLButtonElement | null) => void;
  handTargetRef?: Ref<HTMLDivElement>;
}) {
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const update = () => {
      const parentW = el.parentElement?.clientWidth ?? 0;
      const selfW = el.clientWidth;
      setWidth(parentW > 0 ? Math.min(parentW, selfW || parentW) : selfW);
    };
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.parentElement) ro.observe(el.parentElement);
    update();
    return () => ro.disconnect();
  }, []);

  const cardW = cardWidthForWrap(width, cards.length);
  const isMobile = width > 0 && width < MOBILE_BREAK;

  return (
    <div
      ref={(node) => {
        measureRef.current = node;
        if (typeof handTargetRef === "function") {
          handTargetRef(node);
        } else if (handTargetRef) {
          (handTargetRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
        }
      }}
      className="mx-auto w-full min-w-0 max-w-full"
    >
      <div
        className="flex w-full min-w-0 max-w-full flex-wrap justify-center gap-x-2.5 gap-y-3 pb-2 pt-3"
        style={{
          paddingLeft: 6,
          paddingRight: isMobile ? MOBILE_END_PAD : 6,
        }}
      >
        {cards.map((card) => {
          const isHidden = hiddenCardId === card.id;
          const isSelected = selectedCardId === card.id;
          const canPlay = !disabled && (!playableFilter || playableFilter(card));
          const highlight = playableFilter?.(card)
            ? "defuse"
            : canPlay
              ? "playable"
              : null;

          return (
            <FiveAliveHandCard
              key={card.id}
              ref={(el) => registerCardRef?.(card.id, el)}
              card={card}
              width={cardW}
              selected={isSelected}
              hidden={isHidden}
              disabled={disabled || !canPlay}
              highlight={highlight}
              onSelect={onSelect}
            />
          );
        })}
      </div>
    </div>
  );
}
