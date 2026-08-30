"use client";

import { useEffect, useRef } from "react";
import type { GameLog } from "@/lib/types";
import { GlassPanel } from "@/components/ui/primitives";

export function FiveAliveGameLog({
  logs,
  title = "Game log",
  maxHeightPx,
}: {
  logs: GameLog[];
  title?: string;
  /** Override responsive max-height (180px mobile / 260px desktop). */
  maxHeightPx?: number;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const prevLenRef = useRef(0);

  // Keep newest entries in view; user scrolls up for older history.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const grew = logs.length > prevLenRef.current;
    prevLenRef.current = logs.length;
    if (grew || logs.length > 0) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs]);

  return (
    <GlassPanel className="relative z-10 flex flex-col p-3 sm:p-4">
      <div className="flex shrink-0 items-baseline justify-between gap-2">
        <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
          {title}
        </h3>
        <span className="font-mono text-[9px] text-ink-steel/70">
          {logs.length} entries
        </span>
      </div>
      <div
        ref={scrollerRef}
        className="mt-2 min-h-0 max-h-[180px] overflow-y-scroll overscroll-y-contain touch-pan-y pr-1 [-webkit-overflow-scrolling:touch] md:max-h-[260px]"
        style={maxHeightPx != null ? { maxHeight: maxHeightPx } : undefined}
      >
        {logs.length === 0 ? (
          <p className="text-sm text-ink-steel/70">No events yet.</p>
        ) : (
          <ul className="space-y-2 text-sm text-ink-steel">
            {logs.map((l) => (
              <li
                key={l.id}
                className="border-b border-crimson/10 pb-2 last:border-0"
              >
                {l.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </GlassPanel>
  );
}
