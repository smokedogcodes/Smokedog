"use client";

import type { BattleshipPublicState } from "@/lib/games/battleship/selectors";
import type { PowerUpType } from "@/lib/games/battleship/powerups";

export function BattleshipPowerBar({
  bs,
  selected,
  onSelect,
  disabled,
}: {
  bs: BattleshipPublicState;
  selected: PowerUpType | null;
  onSelect: (type: PowerUpType | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[9px] uppercase tracking-widest text-emerald-400 sm:text-[10px]">
          Energy AP
        </p>
        <p className="font-display text-xl font-bold text-emerald-300 sm:text-2xl">
          {bs.yourAp}
        </p>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-800 sm:h-2">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${Math.min(100, (bs.yourAp / 12) * 100)}%` }}
        />
      </div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5 sm:gap-2">
        {bs.powerUps.map((p) => {
          const active = selected === p.type;
          return (
            <button
              key={p.type}
              type="button"
              disabled={disabled || !p.affordable}
              title={p.blurb}
              onClick={() => onSelect(active ? null : p.type)}
              className={`rounded-sm border p-1.5 text-left transition sm:p-2 ${
                active
                  ? "border-amber-400 bg-amber-500/20"
                  : p.affordable
                    ? "border-cyan-700 bg-slate-900/80 hover:border-cyan-400"
                    : "border-slate-800 bg-slate-950/50 opacity-40"
              }`}
            >
              <p className="font-mono text-[8px] uppercase tracking-wider text-cyan-300 sm:text-[9px]">
                {p.cost} AP
              </p>
              <p className="mt-0.5 text-[10px] font-semibold leading-tight text-cyan-50 sm:mt-1 sm:text-xs">
                {p.label}
              </p>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-cyan-200/60 sm:text-xs">
        Or tap the radar for a standard strike. Power-ups replace your shot this
        turn.
      </p>
    </div>
  );
}
