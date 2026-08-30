"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";

function ArenaBrand() {
  return (
    <Link
      href="/"
      className="flex shrink-0 items-center gap-2.5 transition hover:opacity-90 sm:gap-3"
    >
      <motion.div
        className="flex h-8 w-8 items-center justify-center rounded-sm border-2 border-crimson bg-manila text-crimson shadow-stamp sm:h-9 sm:w-9"
        animate={{ rotate: [-6, -10, -6] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="font-mono text-[10px] font-bold tracking-[0.12em] sm:text-xs">
          SD
        </span>
      </motion.div>
      <span className="font-display text-lg font-bold tracking-tight text-crimson sm:text-xl">
        SMOKEDOG
      </span>
    </Link>
  );
}

export function SiteHeader({
  right,
  avatarId,
  animate = true,
  onAvatarClick,
}: {
  right?: ReactNode;
  avatarId?: number;
  animate?: boolean;
  onAvatarClick?: () => void;
}) {
  const trailing =
    right ??
    (avatarId !== undefined ? (
      <>
        <span className="hidden font-mono text-[10px] uppercase tracking-widest text-crimson/60 sm:block">
          Case file
        </span>
        {onAvatarClick ? (
          <button
            type="button"
            onClick={onAvatarClick}
            className="flex items-center gap-2 rounded-sm border border-transparent px-1 py-0.5 transition hover:border-crimson/30"
            aria-label="Edit profile"
            title="Edit profile"
          >
            <PlayerAvatar id={avatarId} size={36} />
            <span className="hidden font-mono text-[9px] uppercase tracking-widest text-crimson/70 sm:inline">
              Edit
            </span>
          </button>
        ) : (
          <div className="bg-transparent">
            <PlayerAvatar id={avatarId} size={36} />
          </div>
        )}
      </>
    ) : null);

  const className =
    "relative flex items-center justify-between gap-3 border-b border-crimson/20 px-3 pb-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] sm:px-6 sm:py-4 md:px-10";

  if (animate) {
    return (
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className={className}
      >
        <ArenaBrand />
        {trailing && (
          <div className="min-w-0 shrink">
            {trailing}
          </div>
        )}
      </motion.header>
    );
  }

  return (
    <header className={className}>
      <ArenaBrand />
      {trailing && <div className="min-w-0 shrink">{trailing}</div>}
    </header>
  );
}
