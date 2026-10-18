"use client";

import type { BattleshipPublicState } from "@/lib/games/battleship/selectors";
import type { PowerUpType } from "@/lib/games/battleship/powerups";

const POWERUP_ICONS: Record<PowerUpType, string> = {
  sonar: "📡",
  cluster: "💥",
  torpedo: "🚀",
  smoke: "🌫️",
  recon: "🛰️",
};

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
    <div className="space-y-3 rounded-sm border border-cyan-800/40 bg-slate-950/70 p-3 shadow-md">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400">⚡</span>
          <p className="font-mono text-[10px] uppercase font-bold tracking-widest text-emerald-400 sm:text-xs">
            Tactical Action Points (AP)
          </p>
        </div>
        <div className="flex items-center gap-1 font-mono text-sm font-bold text-emerald-300">
          <span className="text-lg text-emerald-200">{bs.yourAp}</span>
          <span className="text-emerald-500/70 text-xs">/ 12 AP</span>
        </div>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-800 border border-slate-700/60">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 via-emerald-400 to-cyan-400 transition-all duration-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
          style={{ width: `${Math.min(100, (bs.yourAp / 12) * 100)}%` }}
        />
      </div>

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5 sm:gap-2">
        {bs.powerUps.map((p) => {
          const active = selected === p.type;
          const icon = POWERUP_ICONS[p.type] ?? "⚡";
          return (
            <button
              key={p.type}
              type="button"
              disabled={disabled || !p.affordable}
              title={p.blurb}
              onClick={() => onSelect(active ? null : p.type)}
              className={`rounded border p-2 text-left transition ${
                active
                  ? "border-amber-400 bg-amber-500/25 ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                  : p.affordable
                    ? "border-cyan-700/80 bg-slate-900/90 hover:border-cyan-400 hover:bg-cyan-950/50"
                    : "border-slate-800/80 bg-slate-950/50 opacity-40 cursor-not-allowed"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm">{icon}</span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-wider text-cyan-300">
                  {p.cost} AP
                </span>
              </div>
              <p className="mt-1 text-[11px] font-bold leading-tight text-cyan-50">
                {p.label}
              </p>
              <p className="mt-0.5 line-clamp-1 text-[9px] text-cyan-200/60">
                {p.blurb}
              </p>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-cyan-200/60 sm:text-xs">
        💡 Power-ups replace your strike this turn. Select a power-up or tap enemy radar for standard cannon fire.
      </p>
    </div>
  );
}
