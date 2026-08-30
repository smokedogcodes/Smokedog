"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import type { PhaseAnnouncement } from "@/lib/types";
import {
  playBadNews,
  playGoodNews,
  playVoteStart,
} from "@/lib/sounds";

const AUTO_DISMISS_MS = 3000;

export function PhaseResultPopup({
  announcement,
  onDismiss,
  durationMs = AUTO_DISMISS_MS,
  skipScrollToTop = false,
}: {
  announcement: PhaseAnnouncement;
  onDismiss: () => void;
  durationMs?: number;
  /** Skip scroll-to-top (e.g. five-alive on mobile). */
  skipScrollToTop?: boolean;
}) {
  useEffect(() => {
    if (announcement.title.toLowerCase().includes("voting")) {
      playVoteStart();
    } else if (announcement.tone === "good") {
      playGoodNews();
    } else if (announcement.tone === "bad") {
      playBadNews();
    }
    if (!skipScrollToTop) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    const t = setTimeout(onDismiss, durationMs);
    return () => clearTimeout(t);
  }, [
    announcement.id,
    announcement.title,
    announcement.tone,
    durationMs,
    skipScrollToTop,
    onDismiss,
  ]);

  const accent =
    announcement.tone === "bad"
      ? "border-crimson bg-crimson text-manila"
      : "border-crimson bg-manila text-crimson";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[45] flex items-center justify-center bg-crimson/35 p-4 backdrop-blur-[4px]"
        onClick={onDismiss}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-[min(92vw,28rem)] rounded-sm border-2 px-5 py-5 shadow-stamp ${accent}`}
        >
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className={`absolute right-2 top-2 rounded-sm p-1 transition ${
              announcement.tone === "bad"
                ? "text-manila/80 hover:bg-manila/15 hover:text-manila"
                : "text-crimson/60 hover:bg-crimson/10 hover:text-crimson"
            }`}
          >
            <X size={16} />
          </button>
          <p className="pr-6 font-mono text-[10px] uppercase tracking-[0.22em] opacity-90">
            {announcement.title}
          </p>
          {announcement.detail && (
            <p
              className={`mt-2 pr-2 text-sm leading-relaxed ${
                announcement.tone === "bad" ? "text-manila" : "text-crimson"
              }`}
            >
              {announcement.detail}
            </p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
