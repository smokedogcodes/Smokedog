"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  faStripeBackground,
  FA_DEATH_STRIPE,
  FA_NUMBER_COLORS,
} from "@/lib/mockups/five-alive-deck-art";
import type { FaPlayerLifeColor } from "@/lib/games/5-alive/rules";
import { FA_EASE } from "@/components/mockups/five-alive/FiveAliveTableAnimation";

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

function SkullIcon() {
  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
      <ellipse cx="50" cy="54" rx="28" ry="32" fill="#e8e8e8" />
      <circle cx="38" cy="48" r="9" fill="#111" />
      <circle cx="62" cy="48" r="9" fill="#111" />
      <path
        d="M42 66 Q50 74 58 66"
        fill="none"
        stroke="#111"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M46 58 L50 62 L54 58"
        fill="none"
        stroke="#111"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FiveAliveLifeCard({
  heartColor,
  face,
  width = 44,
  flipping = false,
  className,
}: {
  heartColor: FaPlayerLifeColor;
  face: "heart" | "skull";
  width?: number;
  flipping?: boolean;
  className?: string;
}) {
  const heartBg = faStripeBackground(FA_NUMBER_COLORS[heartColor]);
  const showSkull = flipping ? undefined : face === "skull";
  // Scale radius with width so mini seats stay rectangular cards, not lemon pills.
  const radius = Math.max(2, Math.round(width * 0.14));
  const border = Math.max(1, Math.round(width * 0.08));

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width, height: (width * 7) / 5, perspective: 600 }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={{
          rotateY: flipping ? 180 : showSkull ? 180 : 0,
        }}
        transition={{ duration: 0.65, ease: FA_EASE }}
      >
        <div
          className="absolute inset-0 overflow-hidden border-white shadow-md"
          style={{
            borderRadius: radius,
            borderWidth: border,
            borderStyle: "solid",
            backfaceVisibility: "hidden",
            background: heartBg,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center p-[16%]">
            <HeartIcon />
          </div>
        </div>
        <div
          className="absolute inset-0 overflow-hidden border-white shadow-md"
          style={{
            borderRadius: radius,
            borderWidth: border,
            borderStyle: "solid",
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: FA_DEATH_STRIPE,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center p-[14%]">
            <SkullIcon />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
