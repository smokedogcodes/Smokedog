import type { ReactNode } from "react";

/**
 * 5 Alive action glyphs — matched to the physical deck reference.
 * Reverse · Pass By Me · Skip · Shuffle
 */

const VB = "0 0 100 100";
const PURPLE = "#8E24AA";
const PINK = "#D81B60";
const ORANGE = "#FB8C00";

function tint(color: "white" | "purple" | "pink" | "orange", corner: boolean) {
  if (!corner) return "white";
  if (color === "purple") return PURPLE;
  if (color === "pink") return PINK;
  return ORANGE;
}

/** Purple — reverse (two curved arrows, no background plate). */
export function FaReverseIcon({ corner = false }: { corner?: boolean }) {
  const c = tint("purple", corner);
  return (
    <svg viewBox={VB} className="h-full w-full" aria-hidden>
      <path
        fill="none"
        stroke={c}
        strokeWidth={corner ? 9 : 11}
        strokeLinecap="round"
        d="M 72 28 A 26 26 0 0 0 28 42"
      />
      <polygon fill={c} points="28,42 38,32 40,50" />
      <path
        fill="none"
        stroke={c}
        strokeWidth={corner ? 9 : 11}
        strokeLinecap="round"
        d="M 28 72 A 26 26 0 0 0 72 58"
      />
      <polygon fill={c} points="72,58 62,68 60,50" />
    </svg>
  );
}

/** Pink — large horizontal arrow pointing LEFT (Pass By Me). */
export function FaPassMeByIcon({
  corner = false,
  direction = "left",
}: {
  corner?: boolean;
  direction?: "left" | "right";
}) {
  const c = tint("pink", corner);
  const left = "14,36 14,64 52,64 52,78 86,50 52,22 52,36";
  const right = "86,36 86,64 48,64 48,78 14,50 48,22 48,36";
  const points = direction === "left" ? left : right;

  return (
    <svg viewBox={VB} className="h-full w-full" aria-hidden>
      <polygon fill={c} points={points} />
    </svg>
  );
}

/** Orange — person silhouette with semi-circular arrow over head (Skip). */
export function FaSkipIcon({ corner = false }: { corner?: boolean }) {
  const c = tint("orange", corner);
  const headR = corner ? 7 : 11;
  const cx = 50;
  const headCy = corner ? 54 : 52;

  return (
    <svg viewBox={VB} className="h-full w-full" aria-hidden>
      {/* Arc over head — left to right */}
      <path
        fill="none"
        stroke={c}
        strokeWidth={corner ? 9 : 12}
        strokeLinecap="round"
        d="M 22 36 Q 50 8 78 36"
      />
      <polygon fill={c} points="78,36 66,28 66,44" />

      {/* Head */}
      <circle cx={cx} cy={headCy} r={headR} fill={c} />
      {/* Shoulders */}
      <path
        fill={c}
        d={
          corner
            ? "M 34 68 Q 50 58 66 68 L 62 78 Q 50 70 38 78 Z"
            : "M 28 72 Q 50 58 72 72 L 68 86 Q 50 76 32 86 Z"
        }
      />
    </svg>
  );
}

/** Pink — fan of 5 cards + circular shuffle arrows above & below. */
export function FaShuffleIcon({ corner = false, center = true }: { corner?: boolean; center?: boolean }) {
  const c = tint("pink", corner);

  if (!center) {
    /* Corner: refresh/sync double-arrow circle */
    return (
      <svg viewBox={VB} className="h-full w-full" aria-hidden>
        <path
          fill="none"
          stroke={c}
          strokeWidth={corner ? 8 : 10}
          strokeLinecap="round"
          d="M 68 28 A 22 22 0 0 0 32 42"
        />
        <polygon fill={c} points="32,42 40,32 40,52" />
        <path
          fill="none"
          stroke={c}
          strokeWidth={corner ? 8 : 10}
          strokeLinecap="round"
          d="M 32 72 A 22 22 0 0 0 68 58"
        />
        <polygon fill={c} points="68,58 60,68 60,48" />
      </svg>
    );
  }

  return (
    <svg viewBox={VB} className="h-full w-full" aria-hidden>
      {/* Top shuffle arc */}
      <path
        fill="none"
        stroke={c}
        strokeWidth={9}
        strokeLinecap="round"
        d="M 24 28 A 26 26 0 0 1 76 28"
      />
      <polygon fill={c} points="76,28 66,20 66,36" />

      {/* Bottom shuffle arc */}
      <path
        fill="none"
        stroke={c}
        strokeWidth={9}
        strokeLinecap="round"
        d="M 76 72 A 26 26 0 0 1 24 72"
      />
      <polygon fill={c} points="24,72 34,64 34,80" />

      {/* Fan of 5 cards */}
      <rect x="18" y="42" width="14" height="22" rx="2" fill={c} transform="rotate(-24 25 53)" />
      <rect x="28" y="38" width="14" height="22" rx="2" fill={c} transform="rotate(-12 35 49)" />
      <rect x="38" y="36" width="14" height="22" rx="2" fill={c} transform="rotate(0 45 47)" />
      <rect x="48" y="38" width="14" height="22" rx="2" fill={c} transform="rotate(12 55 49)" />
      <rect x="58" y="42" width="14" height="22" rx="2" fill={c} transform="rotate(24 65 53)" />
    </svg>
  );
}

export type FaActionType = "reverse" | "passmeby" | "skip" | "shuffle";

export function FaActionCornerIcon({
  type,
  position = "top",
}: {
  type: FaActionType;
  position?: "top" | "bottom";
}) {
  const wrap = (node: ReactNode) => (
    <div className="h-[1.15em] w-[1.15em]">{node}</div>
  );

  switch (type) {
    case "reverse":
      return wrap(<FaReverseIcon corner />);
    case "passmeby":
      return wrap(<FaSkipIcon corner />);
    case "skip":
      return wrap(
        <FaPassMeByIcon
          corner
          direction={position === "top" ? "right" : "left"}
        />
      );
    case "shuffle":
      return wrap(<FaShuffleIcon corner center={false} />);
  }
}

export function FaActionCenterIcon({
  type,
  className,
}: {
  type: FaActionType;
  className?: string;
}) {
  return (
    <div className={className ?? "h-[2.55em] w-[2.55em]"}>
      {type === "reverse" ? <FaReverseIcon /> : null}
      {type === "passmeby" ? <FaSkipIcon /> : null}
      {type === "skip" ? <FaPassMeByIcon direction="left" /> : null}
      {type === "shuffle" ? <FaShuffleIcon center /> : null}
    </div>
  );
}
