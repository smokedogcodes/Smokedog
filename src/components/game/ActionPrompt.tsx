"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Clock } from "lucide-react";
import { pendingPlayerAction } from "@/lib/action-prompt";
import { pendingFiveAliveActionPrompt } from "@/lib/action-prompt";
import type { PublicGameState } from "@/lib/types";

export function ActionPrompt({ state }: { state: PublicGameState }) {
  const [now, setNow] = useState(Date.now());
  const [compactMobile, setCompactMobile] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setCompactMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const remaining = state.phaseEndsAt
    ? Math.ceil((state.phaseEndsAt - now) / 1000)
    : null;
  const pending =
    state.gameId === "five-alive"
      ? pendingFiveAliveActionPrompt(state)
      : pendingPlayerAction(state);
  if (!pending) return null;
  if (state.gameId === "five-alive") {
    if (state.phase !== "fivealive_turn" && state.phase !== "fivealive_bomb")
      return null;
  } else {
    if (state.phase !== "night" && state.phase !== "day") return null;
  }

  const closing = remaining != null && remaining > 0 && remaining <= 10;
  const urgent = closing;
  const faCompact = state.gameId === "five-alive" && compactMobile;

  return (
    <AnimatePresence>
      <motion.div
        key={`${pending.title}-${urgent ? "urgent" : "idle"}`}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={`flex items-start gap-2 rounded-sm border ${
          faCompact ? "mb-3 px-3 py-2" : "mb-6 gap-3 px-4 py-3"
        } ${
          urgent
            ? "animate-pulse border-crimson bg-crimson/15 text-crimson-glow shadow-glow"
            : "border-crimson/40 bg-crimson/10 text-crimson"
        }`}
      >
        {urgent ? (
          <Clock size={faCompact ? 14 : 16} className="mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle size={faCompact ? 14 : 16} className="mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <p
            className={`font-mono uppercase tracking-[0.2em] ${
              faCompact ? "text-[9px]" : "text-[10px]"
            }`}
          >
            {urgent && remaining != null
              ? `${pending.title} — ${remaining}s left`
              : pending.title}
          </p>
          <p className={`${faCompact ? "mt-0.5 text-xs" : "mt-1 text-sm"}`}>
            {pending.detail}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
