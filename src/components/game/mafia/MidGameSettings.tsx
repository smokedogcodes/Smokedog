"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import type { RoomSettings } from "@/lib/types";

export function MidGameSettings({
  settings,
  onUpdate,
  gameId,
}: {
  settings: RoomSettings;
  onUpdate: (patch: Partial<RoomSettings>) => void;
  gameId?: string;
}) {
  const [open, setOpen] = useState(false);
  const isFiveAlive = gameId === "five-alive";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-sm border border-crimson/20 px-2 py-1.5 font-mono text-[10px] uppercase tracking-widest text-ink-steel sm:px-3 sm:py-2"
      >
        <Settings size={12} /> {isFiveAlive ? "Timer" : "Timers"}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-sm border border-crimson/20 bg-surface p-4 shadow-lg">
          <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
            {isFiveAlive ? "Turn timer" : "Mid-game timers"}
          </p>
          {!isFiveAlive && (
            <>
              <label className="mt-3 block font-mono text-[10px] uppercase text-ink-steel">
                Night — {settings.nightSeconds}s
              </label>
              <input
                type="range"
                min={15}
                max={120}
                value={settings.nightSeconds}
                onChange={(e) =>
                  onUpdate({ nightSeconds: Number(e.target.value) })
                }
                className="mt-1 w-full"
              />
            </>
          )}
          <label className="mt-3 block font-mono text-[10px] uppercase text-ink-steel">
            {isFiveAlive
              ? `Turn — ${settings.daySeconds}s`
              : `Day — ${settings.daySeconds}s`}
          </label>
          <input
            type="range"
            min={isFiveAlive ? 10 : 20}
            max={isFiveAlive ? 120 : 200}
            value={settings.daySeconds}
            onChange={(e) => onUpdate({ daySeconds: Number(e.target.value) })}
            className="mt-1 w-full"
          />
          <p className="mt-2 text-xs text-ink-steel">
            {isFiveAlive
              ? "Applies to the current turn and later turns."
              : "Role distribution cannot change mid-game."}
          </p>
        </div>
      )}
    </div>
  );
}
