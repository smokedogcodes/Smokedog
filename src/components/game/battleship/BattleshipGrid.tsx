"use client";

import { cn } from "@/lib/cn";
import type { PublicGridCell } from "@/lib/games/battleship/selectors";
import { COL_LABELS } from "@/lib/games/battleship/grid";
import {
  BattleshipHitMarker,
  BattleshipMissMarker,
  BattleshipShipSprite,
  shipsFromCells,
  type GridShipSprite,
} from "./BattleshipShipSprites";

const LABEL = 12;

export function BattleshipGrid({
  cells,
  interactive,
  onCellClick,
  onCellHover,
  onCellLeave,
  selected,
  preview,
  placementPreview,
  title,
  compact,
  ships: shipsProp,
}: {
  cells: PublicGridCell[][];
  interactive?: boolean;
  onCellClick?: (col: number, row: number) => void;
  onCellHover?: (col: number, row: number) => void;
  onCellLeave?: () => void;
  selected?: { col: number; row: number } | null;
  preview?: { col: number; row: number }[];
  placementPreview?: { cells: { col: number; row: number }[]; valid: boolean } | null;
  title: string;
  compact?: boolean;
  ships?: GridShipSprite[];
}) {
  const previewSet = new Set(
    (preview ?? []).map((c) => `${c.col},${c.row}`)
  );
  const placementSet = new Set(
    (placementPreview?.cells ?? []).map((c) => `${c.col},${c.row}`)
  );
  const ships = shipsProp ?? shipsFromCells(cells);

  return (
    <div
      className={cn(
        "mx-auto w-full",
        compact
          ? "max-w-[18.5rem] sm:max-w-[20rem]"
          : "max-w-[19.5rem] sm:max-w-[22rem]"
      )}
    >
      <p className="mb-1.5 font-mono text-[9px] uppercase tracking-widest text-cyan-400/80">
        {title}
      </p>

      <div
        className="relative rounded-sm border border-cyan-500/40 bg-[#071a33] p-0.5 sm:p-1"
        onMouseLeave={onCellLeave}
      >
        <div
          className="relative z-0 grid gap-px"
          style={{
            gridTemplateColumns: `${LABEL}px repeat(10, minmax(0, 1fr))`,
          }}
        >
          <div />
          {COL_LABELS.map((l) => (
            <div
              key={l}
              className="flex h-3.5 items-center justify-center font-mono text-[8px] text-cyan-200/70 sm:text-[9px]"
            >
              {l}
            </div>
          ))}
          {cells.map((row, ri) => (
            <div key={`r-${ri}`} className="contents">
              <div className="flex items-center justify-center font-mono text-[8px] text-cyan-200/70 sm:text-[9px]">
                {ri + 1}
              </div>
              {row.map((cell) => {
                const key = `${cell.col},${cell.row}`;
                const isSel =
                  selected?.col === cell.col && selected?.row === cell.row;
                const isPrev = previewSet.has(key);
                const isPlacement = placementSet.has(key);
                const isHit = cell.mark === "hit" || !!cell.hitOnShip;
                const isMiss = cell.mark === "miss";

                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!interactive}
                    onClick={() => onCellClick?.(cell.col, cell.row)}
                    onMouseEnter={() => onCellHover?.(cell.col, cell.row)}
                    className={cn(
                      "group relative aspect-square rounded-[1px] border border-cyan-400/20 bg-[#0a2748] transition",
                      interactive &&
                        "cursor-pointer hover:border-cyan-300 hover:bg-cyan-400/20",
                      !interactive && "cursor-default",
                      cell.mark === "obscured" && "bg-violet-800/50",
                      cell.mark === "revealed_ship" && "bg-emerald-800/40",
                      cell.mark === "revealed_empty" && "bg-slate-800/40",
                      cell.smoke && "ring-1 ring-violet-400/50",
                      isSel && "ring-2 ring-amber-300",
                      isPrev && "bg-cyan-400/25",
                      isPlacement &&
                        (placementPreview?.valid
                          ? "bg-emerald-500/45 ring-1 ring-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] z-10"
                          : "bg-red-500/50 ring-1 ring-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)] z-10")
                    )}
                  >
                    {/* Targeting reticle on interactive hover */}
                    {interactive && !isHit && !isMiss && (
                      <div className="pointer-events-none absolute inset-0 hidden items-center justify-center group-hover:flex z-10">
                        <div className="h-full w-[1px] bg-cyan-300/80" />
                        <div className="absolute h-[1px] w-full bg-cyan-300/80" />
                        <div className="absolute h-2 w-2 rounded-full border border-cyan-200/90" />
                      </div>
                    )}
                    {isMiss ? (
                      <BattleshipMissMarker className="pointer-events-none absolute inset-[8%] z-[3]" />
                    ) : null}
                    {isHit ? (
                      <BattleshipHitMarker className="pointer-events-none absolute inset-[6%] z-[3] drop-shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Continuous ship sprites under markers */}
        <div
          className="pointer-events-none absolute inset-0.5 z-[1] sm:inset-1"
          aria-hidden
        >
          <div
            className="grid h-full w-full gap-px"
            style={{
              gridTemplateColumns: `${LABEL}px repeat(10, minmax(0, 1fr))`,
              gridTemplateRows: `14px repeat(10, minmax(0, 1fr))`,
            }}
          >
            {ships.map((ship) => (
              <ShipOverlay
                key={`${ship.type}-${ship.col}-${ship.row}-${ship.orientation}`}
                ship={ship}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ShipOverlay({ ship }: { ship: GridShipSprite }) {
  const horizontal = ship.orientation === "horizontal";
  const uid = `${ship.type}-${ship.col}-${ship.row}`;

  const style: React.CSSProperties = horizontal
    ? {
        gridColumn: `${ship.col + 2} / span ${ship.length}`,
        gridRow: `${ship.row + 2}`,
      }
    : {
        gridColumn: `${ship.col + 2}`,
        gridRow: `${ship.row + 2} / span ${ship.length}`,
      };

  return (
    <div className="relative overflow-visible" style={style}>
      {horizontal ? (
        <div className="absolute inset-[12%]">
          <BattleshipShipSprite
            type={ship.type}
            length={ship.length}
            uid={uid}
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className="absolute inset-0">
          <BattleshipShipSprite
            type={ship.type}
            length={ship.length}
            uid={uid}
            className="absolute left-1/2 top-1/2"
            style={{
              // Parent is 1×N cells; size SVG as N×1 then rotate 90° so bow points up
              width: `${ship.length * 100}%`,
              height: `${100 / ship.length}%`,
              transform: "translate(-50%, -50%) rotate(90deg)",
            }}
          />
        </div>
      )}
    </div>
  );
}
