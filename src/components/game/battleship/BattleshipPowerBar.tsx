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
        <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
          Energy AP
        </p>
        <p className="font-display text-2xl font-bold text-emerald-300">
          {bs.yourAp}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full bg-emerald-500 transition-all"
          style={{ width: `${Math.min(100, (bs.yourAp / 12) * 100)}%` }}
        />
      </div>
      <div className="grid gap-2 sm:grid-cols-5">
        {bs.powerUps.map((p) => {
          const active = selected === p.type;
          return (
            <button
              key={p.type}
              type="button"
              disabled={disabled || !p.affordable}
              title={p.blurb}
              onClick={() => onSelect(active ? null : p.type)}
              className={`rounded-sm border p-2 text-left transition ${
                active
                  ? "border-amber-400 bg-amber-500/20"
                  : p.affordable
                    ? "border-cyan-700 bg-slate-900/80 hover:border-cyan-400"
                    : "border-slate-800 bg-slate-950/50 opacity-40"
              }`}
            >
              <p className="font-mono text-[9px] uppercase tracking-wider text-cyan-300">
                {p.cost} AP
              </p>
              <p className="mt-1 text-xs font-semibold text-cyan-50">
                {p.label}
              </p>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-cyan-200/60">
        Or tap the radar for a standard strike. Power-ups replace your shot this
        turn.
      </p>
    </div>
  );
}
