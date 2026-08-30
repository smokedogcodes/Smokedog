import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";

/** Dossier panel — manila field, crimson ink only. */
export function GlassPanel({
  children,
  className = "",
  onClick,
  style,
  variant = "desk",
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  style?: CSSProperties;
  variant?: "desk" | "paper";
}) {
  const surface =
    variant === "paper"
      ? "rounded-sm border-2 border-crimson bg-manila text-crimson shadow-stamp"
      : "rounded-sm border border-crimson/25 bg-manila text-crimson";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      style={style}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`${surface} ${className}`}
    >
      {children}
    </div>
  );
}

export function Stamp({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`animate-stamp inline-block -rotate-[8deg] border-2 border-crimson bg-manila px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-crimson ${className}`}
    >
      {children}
    </span>
  );
}

export function StatusChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "live" | "dead" | "mute" | "afk" | "mafia" | "town" | "bot";
}) {
  const tones: Record<string, string> = {
    neutral: "text-crimson/70 border-crimson/25",
    live: "text-crimson border-crimson/50",
    dead: "text-crimson/45 border-crimson/20 line-through opacity-60",
    mute: "text-crimson/80 border-crimson/40",
    afk: "text-crimson border-crimson/60",
    mafia: "bg-crimson text-manila border-crimson",
    town: "text-crimson border-crimson/45",
    bot: "text-crimson/60 border-crimson/30",
  };
  return (
    <span
      className={`inline-flex items-center rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function PrimaryButton({
  children,
  className = "",
  loading = false,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-sm bg-crimson px-5 py-3 font-mono text-xs font-bold uppercase tracking-[0.16em] text-manila shadow-glow transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none ${className}`}
    >
      {loading && <LoadingSpinner size={16} className="text-manila" />}
      {children}
    </button>
  );
}
