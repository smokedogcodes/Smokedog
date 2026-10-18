"use client";

import { cn } from "@/lib/cn";
import {
  faAccentColor,
  faActionType,
  faCenterLabel,
  faCornerLabel,
  faFooterName,
  faIsDeathCard,
  faStripeBackground,
  faUsesCenterText,
  faUsesIcon,
  FA_DEATH_STRIPE,
  FA_NUMBER_COLORS,
  type FiveAliveRenderableCard,
} from "@/lib/mockups/five-alive-deck-art";
import {
  FaActionCenterIcon,
  FaActionCornerIcon,
} from "./FiveAliveActionIcons";

const CARD_FONT = "Arial Black, Impact, Haettenschweiler, sans-serif";

function DrawStackIcon({ label }: { label: "+1" | "+2" }) {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <rect x="8" y="34" width="44" height="58" rx="5" fill="white" opacity="0.82" />
      <rect x="18" y="24" width="44" height="58" rx="5" fill="white" opacity="0.92" />
      <rect x="28" y="14" width="44" height="58" rx="5" fill="white" />
      <text
        x="50"
        y="52"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#111"
        fontSize="28"
        fontWeight="900"
        style={{ fontFamily: CARD_FONT }}
      >
        {label}
      </text>
    </svg>
  );
}

function BombIcon() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <circle cx="42" cy="58" r="26" fill="#111" />
      <path
        d="M58 38 L72 24 L78 30 L64 44"
        fill="none"
        stroke="#111"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M74 22 C78 20 82 22 84 26"
        fill="none"
        stroke="#FFB300"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <circle cx="86" cy="20" r="6" fill="#FFB300" />
      <circle cx="78" cy="14" r="3.5" fill="#FF6F00" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <path
        d="M50 84 S14 62 14 38 C14 24 24 14 38 14 C48 14 50 22 50 22 C50 22 52 14 62 14 C76 14 86 24 86 38 C86 62 50 84 50 84 Z"
        fill="white"
      />
    </svg>
  );
}

function CenterGlyph({
  card,
  className,
}: {
  card: FiveAliveRenderableCard;
  className?: string;
}) {
  const action = faActionType(card);
  const isDraw = card.type === "draw1" || card.type === "draw2";
  const isBomb = card.type === "bomb";

  if (action) {
    return (
      <FaActionCenterIcon
        type={action}
        className={cn(className, "h-[2.55em] w-[2.55em]")}
      />
    );
  }

  return (
    <div
      className={cn(
        className,
        isDraw && "h-[2.7em] w-[2.7em]",
        isBomb && "h-[2.85em] w-[2.85em]",
        !isDraw && !isBomb && "h-[2.45em] w-[2.45em]"
      )}
    >
      {card.type === "bomb" ? <BombIcon /> : null}
      {card.type === "draw1" ? <DrawStackIcon label="+1" /> : null}
      {card.type === "draw2" ? <DrawStackIcon label="+2" /> : null}
      {card.type === "life" ? <HeartIcon /> : null}
    </div>
  );
}

function CornerGlyph({
  card,
  label,
  position,
}: {
  card: FiveAliveRenderableCard;
  label: string;
  position: "top" | "bottom";
}) {
  const action = faActionType(card);
  if (action) {
    return <FaActionCornerIcon type={action} position={position} />;
  }

  return (
    <span
      className="font-black leading-none text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.55)]"
      style={{
        fontFamily: CARD_FONT,
        fontSize: "0.95em",
        fontStyle: "italic",
        transform: "skewX(-10deg)",
      }}
    >
      {label}
    </span>
  );
}

function CenterText({ label }: { label: string }) {
  // Sized to fit inside the padded center zone without top/bottom clipping
  // (Arial Black italic + skew overflows the em box).
  const size =
    label.length > 3
      ? "1.25em"
      : label.length > 2
        ? "1.45em"
        : label.length > 1
          ? "1.85em"
          : "2.15em";
  return (
    <span
      className="max-w-[88%] text-center font-black text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.55)]"
      style={{
        fontFamily: CARD_FONT,
        fontSize: size,
        fontStyle: "italic",
        lineHeight: 0.92,
        transform: "skewX(-10deg)",
        display: "block",
      }}
    >
      {label}
    </span>
  );
}

export function FiveAliveDeckCardBack({
  width = 96,
  className,
}: {
  width?: number;
  className?: string;
}) {
  const miniW = width * 0.14;
  const miniH = (miniW * 7) / 5;
  const fanColors = [0, 2, 3, 6, 7, 5, 0] as const;

  return (
    <div
      className={cn(
        "relative aspect-[5/7] overflow-hidden rounded-[10px] border-[3px] border-white shadow-lg",
        className
      )}
      style={{ width, fontSize: width / 9 }}
    >
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 flex items-center justify-center">
        {fanColors.map((n, i) => {
          const rot = -28 + i * 9;
          const x = -width * 0.12 + i * (width * 0.04);
          return (
            <div
              key={i}
              className="absolute rounded-[3px] border border-white/80"
              style={{
                width: miniW,
                height: miniH,
                background: faStripeBackground(FA_NUMBER_COLORS[n]),
                transform: `translateX(${x}px) rotate(${rot}deg)`,
                zIndex: i,
              }}
            />
          );
        })}
        <svg
          viewBox="0 0 64 80"
          className="relative z-10 h-[38%] w-[38%]"
          aria-hidden
        >
          <ellipse cx="32" cy="40" rx="18" ry="22" fill="white" />
          <circle cx="26" cy="36" r="4" fill="#111" />
          <circle cx="38" cy="36" r="4" fill="#111" />
          <path
            d="M22 50c4 6 16 6 20 0M26 56h12"
            fill="none"
            stroke="#111"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
}

export function FiveAliveDeckCard({
  card,
  width = 96,
  selected = false,
  elevated = false,
  ghost = false,
  highlight = null,
  selectedRingClass,
  className,
}: {
  card: FiveAliveRenderableCard;
  width?: number;
  selected?: boolean;
  elevated?: boolean;
  ghost?: boolean;
  highlight?: "defuse" | "playable" | null;
  /** Override selected/highlight ring styling (game UI vs mockup page). */
  selectedRingClass?: string;
  className?: string;
}) {
  const accent = faAccentColor(card);
  const center = faCenterLabel(card);
  const corner = faCornerLabel(card);
  const footer = faFooterName(card);
  const isDeath = faIsDeathCard(card);
  const bg = isDeath ? FA_DEATH_STRIPE : faStripeBackground(accent);
  const ringClass =
    selectedRingClass ??
    (highlight === "defuse"
      ? "ring-2 ring-[#2a9d8f] ring-offset-2 ring-offset-[#2a1810]"
      : selected
        ? "ring-2 ring-white ring-offset-2 ring-offset-[#2a1810] scale-[1.04]"
        : "");
  // px floor so names stay readable on tiny center-fan cards too
  const footerPx = Math.max(6.5, Math.min(10.5, width * 0.105));

  return (
    <div
      className={cn(
        "relative aspect-[5/7] select-none overflow-hidden rounded-[10px] border-[3px] border-white shadow-lg transition-transform duration-200",
        ringClass,
        elevated && "-translate-y-1 shadow-2xl",
        ghost && "opacity-0",
        className
      )}
      style={{ width, fontSize: width / 9, background: bg }}
      title={footer}
    >
      <div className="absolute left-[0.4em] top-[0.32em] z-[1]">
        <CornerGlyph card={card} label={corner} position="top" />
      </div>
      <div
        className={cn(
          "absolute bottom-[1.05em] right-[0.4em] z-[1]",
          card.type !== "skip" && "rotate-180"
        )}
      >
        <CornerGlyph card={card} label={corner} position="bottom" />
      </div>

      <div
        className="absolute inset-[11%_9%_24%_9%] flex items-center justify-center"
        style={{ transform: "rotate(4deg)" }}
      >
        {faUsesIcon(card) ? <CenterGlyph card={card} /> : null}
        {faUsesCenterText(card) ? <CenterText label={center} /> : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/55 via-black/28 to-transparent pb-[0.18em] pt-[0.65em]">
        <p
          className="truncate px-[0.2em] text-center font-black uppercase leading-none text-white"
          style={{
            fontFamily: CARD_FONT,
            fontSize: footerPx,
            letterSpacing: width < 60 ? "0.02em" : "0.05em",
            textShadow: "0 1px 1px rgba(0,0,0,0.75)",
          }}
        >
          {footer}
        </p>
      </div>
    </div>
  );
}
