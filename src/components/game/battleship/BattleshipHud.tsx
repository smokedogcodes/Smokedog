"use client";

import { useEffect, useState } from "react";

export function BattleshipHud({
  yourTurn,
  phaseEndsAt,
  log,
  setup,
}: {
  yourTurn: boolean;
  phaseEndsAt: number | null;
  log: string[];
  setup?: boolean;
}) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!phaseEndsAt) {
      setLeft(0);
      return;
    }
    const tick = () => setLeft(Math.max(0, phaseEndsAt - Date.now()));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [phaseEndsAt]);

  const secs = Math.ceil(left / 1000);
  const warn = secs > 0 && secs <= 5;

  return (
    <div
      className={`rounded-sm border px-3 py-2 sm:px-4 sm:py-2.5 ${
        yourTurn
          ? "border-amber-400/50 bg-amber-500/10"
          : "border-cyan-700/40 bg-slate-950/70"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-widest text-cyan-100 sm:text-xs">
          {setup
            ? "Fleet placement"
            : yourTurn
              ? "Your turn — select target"
              : "Opponent is targeting…"}
        </p>
        {phaseEndsAt ? (
          <p
            className={`font-display text-xl font-bold tabular-nums sm:text-2xl ${
              warn ? "animate-pulse text-red-400" : "text-cyan-200"
            }`}
          >
            {secs}s
          </p>
        ) : null}
      </div>
      {log[0] ? (
        <p className="mt-1 text-xs text-cyan-200/80 sm:text-sm">
          {log[log.length - 1]}
        </p>
      ) : null}
    </div>
  );
}
