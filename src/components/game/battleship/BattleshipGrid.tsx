"use client";

import { cn } from "@/lib/cn";
import type { PublicGridCell } from "@/lib/games/battleship/selectors";
import { COL_LABELS } from "@/lib/games/battleship/grid";

export function BattleshipGrid({
  cells,
  interactive,
  onCellClick,
  selected,
  preview,
  title,
}: {
  cells: PublicGridCell[][];
  interactive?: boolean;
  onCellClick?: (col: number, row: number) => void;
  selected?: { col: number; row: number } | null;
  preview?: { col: number; row: number }[];
  title: string;
}) {
  const previewSet = new Set(
    (preview ?? []).map((c) => `${c.col},${c.row}`)
  );

  return (
    <div className="w-full">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-widest text-cyan-400/80">
        {title}
      </p>
      <div
        className="grid gap-px rounded-sm border border-cyan-500/40 bg-slate-950/80 p-1"
        style={{
          gridTemplateColumns: `18px repeat(10, minmax(0, 1fr))`,
        }}
      >
        <div />
        {COL_LABELS.map((l) => (
          <div
            key={l}
            className="flex items-center justify-center font-mono text-[9px] text-cyan-500/70"
          >
            {l}
          </div>
        ))}
        {cells.map((row, ri) => (
          <div key={`r-${ri}`} className="contents">
            <div className="flex items-center justify-center font-mono text-[9px] text-cyan-500/70">
              {ri + 1}
            </div>
            {row.map((cell) => {
              const key = `${cell.col},${cell.row}`;
              const isSel =
                selected?.col === cell.col && selected?.row === cell.row;
              const isPrev = previewSet.has(key);
              return (
                <button
                  key={key}
                  type="button"
                  disabled={!interactive}
                  onClick={() => onCellClick?.(cell.col, cell.row)}
                  className={cn(
                    "aspect-square min-h-[22px] rounded-[2px] border border-cyan-900/60 transition",
                    interactive && "cursor-pointer hover:border-cyan-400 hover:bg-cyan-500/20",
                    !interactive && "cursor-default",
                    cell.ship && "bg-slate-600/80",
                    cell.hitOnShip && "bg-amber-500/90",
                    cell.mark === "hit" && "bg-amber-500 animate-pulse",
                    cell.mark === "miss" && "bg-slate-700/90",
                    cell.mark === "obscured" && "bg-violet-700/70",
                    cell.mark === "revealed_ship" && "bg-emerald-700/50",
                    cell.mark === "revealed_empty" && "bg-slate-800/50",
                    cell.smoke && "ring-1 ring-violet-400/60",
                    isSel && "ring-2 ring-cyan-300",
                    isPrev && "bg-cyan-500/30"
                  )}
                >
                  {cell.mark === "hit" || cell.hitOnShip ? (
                    <span className="text-[10px] text-red-200">●</span>
                  ) : cell.mark === "miss" ? (
                    <span className="text-[10px] text-slate-300">○</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
