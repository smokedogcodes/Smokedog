import type { CSSProperties } from "react";
import type { ShipType } from "@/lib/games/battleship/ships";
import type { Orientation } from "@/lib/games/battleship/powerups";

export type GridShipSprite = {
  type: ShipType;
  col: number;
  row: number;
  length: number;
  orientation: Orientation;
};

const CELL = 40;
const HULL = "#8b939e";
const HULL_DARK = "#5c6570";
const HULL_LIGHT = "#c5ccd6";
const DECK = "#6b7280";
const WOOD = "#8b6914";
const METAL = "#a8b0bc";

/** Classic top-down battleship sprite spanning `length` cells (always drawn bow→stern left→right). */
export function BattleshipShipSprite({
  type,
  length,
  uid,
  className,
  style,
}: {
  type: ShipType;
  length: number;
  /** Unique id fragment so SVG gradients don't collide */
  uid: string;
  className?: string;
  style?: CSSProperties;
}) {
  const w = length * CELL;
  const h = CELL;
  const midY = h / 2;
  const gid = `s-${uid}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      style={style}
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <filter id={`${gid}-sh`} x="-10%" y="-25%" width="130%" height="160%">
          <feDropShadow dx="1.4" dy="2" stdDeviation="1.4" floodOpacity="0.5" />
        </filter>
        <linearGradient id={`${gid}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={HULL_LIGHT} />
          <stop offset="40%" stopColor={HULL} />
          <stop offset="100%" stopColor={HULL_DARK} />
        </linearGradient>
      </defs>

      <g filter={`url(#${gid}-sh)`}>
        <path
          d={hullPath(w, midY, type)}
          fill={`url(#${gid}-g)`}
          stroke="#2f3640"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
        {type === "carrier" ? (
          <CarrierDeck w={w} midY={midY} />
        ) : type === "submarine" ? (
          <SubmarineDeck w={w} midY={midY} />
        ) : (
          <WarshipDeck type={type} w={w} midY={midY} length={length} />
        )}
      </g>
    </svg>
  );
}

function hullPath(w: number, midY: number, type: ShipType): string {
  const halfH = type === "submarine" ? 9.5 : type === "destroyer" ? 10.5 : 12;
  const bow = type === "submarine" ? 11 : 15;
  const stern = type === "carrier" ? 5 : 9;
  return [
    `M ${bow} ${midY - halfH}`,
    `L ${w - stern} ${midY - halfH}`,
    `Q ${w - 1} ${midY - halfH} ${w - 1} ${midY}`,
    `Q ${w - 1} ${midY + halfH} ${w - stern} ${midY + halfH}`,
    `L ${bow} ${midY + halfH}`,
    `Q 2 ${midY + 4} 1 ${midY}`,
    `Q 2 ${midY - 4} ${bow} ${midY - halfH}`,
    "Z",
  ].join(" ");
}

function CarrierDeck({ w, midY }: { w: number; midY: number }) {
  return (
    <g>
      <rect
        x={12}
        y={midY - 7.5}
        width={w - 22}
        height={15}
        rx={1}
        fill={DECK}
        stroke="#4b5563"
        strokeWidth={0.7}
      />
      <line
        x1={16}
        y1={midY}
        x2={w - 14}
        y2={midY}
        stroke="#e5e7eb"
        strokeWidth={1.4}
        strokeDasharray="5 3"
      />
      <rect
        x={w * 0.58}
        y={midY - 12}
        width={16}
        height={9}
        rx={1}
        fill={METAL}
        stroke="#374151"
        strokeWidth={0.7}
      />
      <rect
        x={w * 0.58 + 4}
        y={midY - 15}
        width={7}
        height={4}
        rx={0.5}
        fill={HULL_DARK}
      />
      {[0.22, 0.38, 0.72, 0.88].map((t) => (
        <text
          key={t}
          x={w * t}
          y={midY + 5}
          fill="#9ca3af"
          fontSize="8"
          fontFamily="monospace"
          textAnchor="middle"
        >
          +
        </text>
      ))}
      <ellipse cx={w * 0.28} cy={midY - 3.5} rx={5} ry={1.8} fill="#d1d5db" />
      <ellipse cx={w * 0.42} cy={midY + 3.8} rx={5} ry={1.8} fill="#d1d5db" />
    </g>
  );
}

function SubmarineDeck({ w, midY }: { w: number; midY: number }) {
  return (
    <g>
      <ellipse
        cx={w / 2}
        cy={midY}
        rx={w * 0.36}
        ry={5.5}
        fill={HULL_DARK}
        opacity={0.45}
      />
      <rect
        x={w / 2 - 6}
        y={midY - 13}
        width={12}
        height={11}
        rx={2}
        fill={METAL}
        stroke="#374151"
        strokeWidth={0.8}
      />
      <rect
        x={w / 2 - 2.5}
        y={midY - 16}
        width={5}
        height={4}
        rx={0.5}
        fill={HULL_DARK}
      />
      <line
        x1={w / 2}
        y1={midY - 16}
        x2={w / 2}
        y2={midY - 19}
        stroke="#e5e7eb"
        strokeWidth={1.2}
      />
    </g>
  );
}

function WarshipDeck({
  type,
  w,
  midY,
  length,
}: {
  type: ShipType;
  w: number;
  midY: number;
  length: number;
}) {
  const wood = type === "battleship" || type === "cruiser";
  const turrets =
    length >= 4 ? [0.2, 0.5, 0.8] : length === 3 ? [0.28, 0.72] : [0.5];

  return (
    <g>
      <rect
        x={14}
        y={midY - 5.5}
        width={w - 26}
        height={11}
        rx={2}
        fill={wood ? WOOD : DECK}
        opacity={wood ? 0.9 : 0.75}
        stroke="#4b5563"
        strokeWidth={0.5}
      />
      <rect
        x={w * 0.4}
        y={midY - 11}
        width={w * 0.2}
        height={9}
        rx={1}
        fill={METAL}
        stroke="#374151"
        strokeWidth={0.7}
      />
      <rect
        x={w * 0.44}
        y={midY - 14}
        width={w * 0.12}
        height={4}
        rx={0.5}
        fill={HULL_DARK}
      />
      {turrets.map((t) => (
        <g key={t} transform={`translate(${w * t}, ${midY})`}>
          <circle r={4.5} fill={METAL} stroke="#374151" strokeWidth={0.9} />
          <circle r={2.1} fill={HULL_DARK} />
          <rect x={2.2} y={-1.1} width={8} height={2.2} rx={0.6} fill="#4b5563" />
          {length >= 4 ? (
            <rect x={2.2} y={1.4} width={7} height={1.3} rx={0.4} fill="#4b5563" />
          ) : null}
        </g>
      ))}
    </g>
  );
}

export function BattleshipHitMarker({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <polygon
        points="20,2 23,14 36,8 26,18 38,22 26,24 34,36 20,28 6,36 14,24 2,22 14,18 4,8 17,14"
        fill="#ef4444"
        stroke="#7f1d1d"
        strokeWidth={0.8}
      />
      <polygon
        points="20,10 22,16 29,13 24,19 32,22 24,23 28,30 20,25 12,30 16,23 8,22 16,19 11,13 18,16"
        fill="#fbbf24"
      />
      <circle cx={20} cy={21} r={3.5} fill="#fff7ed" opacity={0.9} />
    </svg>
  );
}

export function BattleshipMissMarker({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <ellipse cx={20} cy={22} rx={10} ry={5} fill="#38bdf8" opacity={0.45} />
      <path
        d="M12 20 Q20 8 28 20"
        fill="none"
        stroke="#e0f2fe"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <path
        d="M14 24 Q20 14 26 24"
        fill="none"
        stroke="#7dd3fc"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <circle cx={16} cy={14} r={1.5} fill="#fff" />
      <circle cx={24} cy={12} r={1.2} fill="#e0f2fe" />
      <circle cx={20} cy={10} r={1} fill="#fff" />
    </svg>
  );
}

export function shipsFromCells(
  cells: {
    ship?: ShipType | null;
    shipIndex?: number;
    shipLength?: number;
    shipOrientation?: Orientation;
    col: number;
    row: number;
  }[][]
): GridShipSprite[] {
  const ships: GridShipSprite[] = [];
  for (const row of cells) {
    for (const cell of row) {
      if (
        !cell.ship ||
        cell.shipIndex !== 0 ||
        !cell.shipLength ||
        !cell.shipOrientation
      ) {
        continue;
      }
      ships.push({
        type: cell.ship,
        col: cell.col,
        row: cell.row,
        length: cell.shipLength,
        orientation: cell.shipOrientation,
      });
    }
  }
  return ships;
}

export function shipsFromFleet(
  fleet: {
    type: ShipType;
    cells: { col: number; row: number }[];
  }[]
): GridShipSprite[] {
  return fleet.map((ship) => {
    const orientation =
      ship.cells.length > 1 && ship.cells[1]!.col === ship.cells[0]!.col
        ? ("vertical" as const)
        : ("horizontal" as const);
    const origin = ship.cells[0]!;
    return {
      type: ship.type,
      col: origin.col,
      row: origin.row,
      length: ship.cells.length,
      orientation,
    };
  });
}
